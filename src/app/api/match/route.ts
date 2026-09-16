import { NextResponse } from "next/server";

interface WaitingPeer {
  peerId: string;
  timestamp: number;
}

// Global in-memory matchmaking queue (persists across API invocations on the running server)
declare global {
  // eslint-disable-next-line no-var
  var __waitingPeersQueue: WaitingPeer[] | undefined;
  // eslint-disable-next-line no-var
  var __matchedPairs: Map<string, string> | undefined;
}

if (!global.__waitingPeersQueue) {
  global.__waitingPeersQueue = [];
}
if (!global.__matchedPairs) {
  global.__matchedPairs = new Map();
}

const queue = global.__waitingPeersQueue;
const matches = global.__matchedPairs;

// Cleanup queue entries older than 30 seconds
function cleanQueue() {
  const now = Date.now();
  const valid = queue.filter((item) => now - item.timestamp < 30000);
  queue.length = 0;
  queue.push(...valid);
}

// POST /api/match - Join matching queue or get paired with a waiting peer
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { peerId } = body;

    if (!peerId || typeof peerId !== "string") {
      return NextResponse.json({ error: "peerId is required" }, { status: 400 });
    }

    cleanQueue();

    // Check if peer is already in queue; remove old entry
    const existingIdx = queue.findIndex((p) => p.peerId === peerId);
    if (existingIdx !== -1) {
      queue.splice(existingIdx, 1);
    }

    // Look for another waiting peer
    const partnerIdx = queue.findIndex((p) => p.peerId !== peerId);

    if (partnerIdx !== -1) {
      // Match found!
      const partner = queue.splice(partnerIdx, 1)[0];
      // Record match so partner can poll or know who to connect to
      matches.set(partner.peerId, peerId);
      matches.set(peerId, partner.peerId);

      return NextResponse.json({
        status: "matched",
        matchPeerId: partner.peerId,
        initiator: true, // This client calls the partner
      });
    }

    // No partner currently waiting, add to queue
    queue.push({ peerId, timestamp: Date.now() });

    return NextResponse.json({
      status: "waiting",
      matchPeerId: null,
      initiator: false,
    });
  } catch (err: unknown) {
    console.error("Match API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET /api/match?peerId=xxx - Poll to see if an incoming match was assigned
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const peerId = searchParams.get("peerId");

  if (!peerId) {
    return NextResponse.json({ error: "peerId is required" }, { status: 400 });
  }

  // Check if someone matched with us
  if (matches.has(peerId)) {
    const matchPeerId = matches.get(peerId);
    matches.delete(peerId); // Clean up after reading
    return NextResponse.json({
      status: "matched",
      matchPeerId,
      initiator: false, // We were waiting, other peer will call us
    });
  }

  // Check if still in queue
  cleanQueue();
  const inQueue = queue.some((p) => p.peerId === peerId);

  return NextResponse.json({
    status: inQueue ? "waiting" : "idle",
  });
}

// DELETE /api/match?peerId=xxx - Leave matching queue
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const peerId = searchParams.get("peerId");

  if (peerId) {
    const idx = queue.findIndex((p) => p.peerId === peerId);
    if (idx !== -1) {
      queue.splice(idx, 1);
    }
    matches.delete(peerId);
  }

  return NextResponse.json({ status: "ok" });
}

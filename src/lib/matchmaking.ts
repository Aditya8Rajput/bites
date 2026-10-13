import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export interface MatchTicket {
  userId: string;
  peerId: string;
  userEmail: string;
  status: "waiting" | "matched" | "cancelled";
  matchId: string | null;
  createdAt: number;
}

export interface MatchSession {
  matchId: string;
  initiatorPeerId: string;
  initiatorUid: string;
  receiverPeerId: string;
  receiverUid: string;
  status: "active" | "ended";
  createdAt: number;
}

export type MatchRole = "initiator" | "receiver";

export interface MatchResult {
  matched: boolean;
  matchId: string | null;
  role: MatchRole | null;
  remotePeerId: string | null;
}

const QUEUE_COLLECTION = "match_queue";
const MATCHES_COLLECTION = "matches";
const STALE_TIMEOUT_MS = 25000; // 25 seconds stale queue threshold

/**
 * Open STUN + open TURN relay ICE servers to ensure WebRTC connectivity
 * across symmetric NATs, cellular networks, and restrictive firewalls.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelay",
    credential: "openrelay",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelay",
    credential: "openrelay",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelay",
    credential: "openrelay",
  },
];

/**
 * Atomically attempt to match with a waiting peer in Firestore.
 * If another waiting peer exists, pairs them atomically in a transaction.
 * If no candidate is waiting, registers this user as "waiting".
 */
export async function findOrQueueMatch(
  userId: string,
  peerId: string,
  userEmail: string
): Promise<MatchResult> {
  const now = Date.now();
  const queueRef = collection(db, QUEUE_COLLECTION);

  // 1. Query candidate tickets currently waiting
  const waitingQuery = query(
    queueRef,
    where("status", "==", "waiting")
  );

  const snapshot = await getDocs(waitingQuery);
  const candidates: Array<{ id: string; data: MatchTicket }> = [];

  snapshot.forEach((d) => {
    const data = d.data() as MatchTicket;
    // Exclude self and stale tickets
    if (data.userId !== userId && now - (data.createdAt || 0) < STALE_TIMEOUT_MS) {
      candidates.push({ id: d.id, data });
    } else if (now - (data.createdAt || 0) >= STALE_TIMEOUT_MS) {
      // Opportunistic cleanup of stale tickets
      deleteDoc(d.ref).catch(() => {});
    }
  });

  // Sort by oldest first for FIFO fairness
  candidates.sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));

  // 2. If a candidate is available, attempt atomic transaction to lock the match
  for (const candidate of candidates) {
    try {
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const candidateDocRef = doc(db, QUEUE_COLLECTION, candidate.id);
      const myDocRef = doc(db, QUEUE_COLLECTION, userId);
      const matchDocRef = doc(db, MATCHES_COLLECTION, matchId);

      const matched = await runTransaction(db, async (transaction) => {
        const candidateDoc = await transaction.get(candidateDocRef);
        if (!candidateDoc.exists()) return false;

        const candidateData = candidateDoc.data() as MatchTicket;
        if (candidateData.status !== "waiting") return false;

        // Create the match document: Current user is Initiator, candidate is Receiver
        const matchData: MatchSession = {
          matchId,
          initiatorPeerId: peerId,
          initiatorUid: userId,
          receiverPeerId: candidateData.peerId,
          receiverUid: candidateData.userId,
          status: "active",
          createdAt: Date.now(),
        };

        transaction.set(matchDocRef, matchData);

        // Update candidate ticket to matched
        transaction.update(candidateDocRef, {
          status: "matched",
          matchId,
        });

        // Update / create our ticket as matched
        transaction.set(myDocRef, {
          userId,
          peerId,
          userEmail,
          status: "matched",
          matchId,
          createdAt: Date.now(),
        });

        return true;
      });

      if (matched) {
        return {
          matched: true,
          matchId,
          role: "initiator",
          remotePeerId: candidate.data.peerId,
        };
      }
    } catch (err) {
      console.warn("Transaction conflict while pairing, trying next candidate...", err);
    }
  }

  // 3. No available candidate: register self in queue as waiting
  const myDocRef = doc(db, QUEUE_COLLECTION, userId);
  await setDoc(myDocRef, {
    userId,
    peerId,
    userEmail,
    status: "waiting",
    matchId: null,
    createdAt: Date.now(),
  });

  return {
    matched: false,
    matchId: null,
    role: "receiver",
    remotePeerId: null,
  };
}

/**
 * Listen on user's own ticket in match_queue.
 * When another user pairs with them, Firestore updates their ticket to 'matched'.
 */
export function listenForIncomingMatch(
  userId: string,
  onMatched: (result: MatchResult) => void
): Unsubscribe {
  const myDocRef = doc(db, QUEUE_COLLECTION, userId);

  return onSnapshot(myDocRef, async (docSnap) => {
    if (!docSnap.exists()) return;

    const data = docSnap.data() as MatchTicket;
    if (data.status === "matched" && data.matchId) {
      try {
        const matchDocRef = doc(db, MATCHES_COLLECTION, data.matchId);
        const matchSnap = await getDoc(matchDocRef);
        if (matchSnap.exists()) {
          const matchData = matchSnap.data() as MatchSession;
          if (matchData.status === "active") {
            const isInitiator = matchData.initiatorUid === userId;
            onMatched({
              matched: true,
              matchId: data.matchId,
              role: isInitiator ? "initiator" : "receiver",
              remotePeerId: isInitiator ? matchData.receiverPeerId : matchData.initiatorPeerId,
            });
          }
        }
      } catch (err) {
        console.error("Error loading match session details:", err);
      }
    }
  });
}

/**
 * Listen to the active match document to detect if the other user disconnected or skipped.
 */
export function listenToActiveMatch(
  matchId: string,
  onMatchEnded: () => void
): Unsubscribe {
  const matchDocRef = doc(db, MATCHES_COLLECTION, matchId);

  return onSnapshot(matchDocRef, (snap) => {
    if (!snap.exists()) {
      onMatchEnded();
      return;
    }
    const data = snap.data() as MatchSession;
    if (data.status === "ended") {
      onMatchEnded();
    }
  });
}

/**
 * End an active match session in Firestore so both participants are notified.
 */
export async function endMatchSession(matchId: string | null): Promise<void> {
  if (!matchId) return;
  try {
    const matchDocRef = doc(db, MATCHES_COLLECTION, matchId);
    await setDoc(
      matchDocRef,
      { status: "ended", endedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn("Notice ending match session:", err);
  }
}

/**
 * Remove user's ticket from the queue on unmount, cancel, or leave.
 */
export async function leaveMatchQueue(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const myDocRef = doc(db, QUEUE_COLLECTION, userId);
    await deleteDoc(myDocRef);
  } catch (err) {
    console.warn("Notice leaving match queue:", err);
  }
}

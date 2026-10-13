import { NextResponse } from "next/server";

// Bites Matchmaking API - Health Check & System Status
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "bites-matchmaking",
    strategy: "firestore-atomic-transactions",
  });
}

export async function POST() {
  return NextResponse.json({
    status: "ok",
    message: "Client matchmaking is handled atomically via Firestore transactions.",
  });
}

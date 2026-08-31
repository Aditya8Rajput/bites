# Project: Bites (College-Only Live Video Dating)

## Tech Stack
- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
- Backend/Database: Firebase Cloud Firestore, Firebase Authentication
- Real-Time Media: WebRTC (Peer-to-Peer), STUN/TURN servers
- Agent Tooling: Antigravity IDE / CLI

## Core Constraints & Rules
- Platform is strictly for verified `@college.edu` email domains.
- No text chat or group calls—video interaction only.
- User matching queue is managed via Firestore.
- WebRTC signaling (Offer/Answer/ICE) routes through Firestore collections.
- Calls are P2P and NEVER recorded or stored.

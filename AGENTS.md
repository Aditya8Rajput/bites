# Bites - College Video Dating Platform

## Tech Stack Overview
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Dark theme with glassmorphism and emerald/cyan neon accents)
- **Authentication**: Firebase Authentication (Email/Password with Email Verification)
- **Database**: Google Cloud Firestore
- **Real-Time Communication**: WebRTC for peer-to-peer 1-on-1 video dating
- **Icons & UI Utilities**: Lucide React, clsx, tailwind-merge

## Core Domain Rules & Policies
1. **Strict `@thapar.edu` Email Requirement**:
   - Only verified `@thapar.edu` college email addresses are permitted to register and participate. Any other email domains are strictly rejected.
   - Users must verify their email (`sendEmailVerification`) before accessing dating rooms.
2. **Completely Random Matching**:
   - Matching is 100% random across the active queue and is **NOT** based on gender or preferences.
3. **User Profiles in Firestore**:
   - Collection: `users/{uid}`
   - Initial fields:
     - `uid`: string (Firebase Auth UID)
     - `email`: string (must end in `@thapar.edu`)
     - `gender`: 'Male' | 'Female' | 'Other' (recorded on signup, but ignored during matching)
     - `isVerified`: boolean (default `false`)
     - `status`: 'idle' | 'waiting' | 'in-call' (default `'idle'`)
     - `createdAt`: timestamp

## Real-Time Matching & WebRTC Architecture
- Firestore signaling channels (offers, answers, ICE candidates) for WebRTC connections between randomly paired students.
- Peer-to-peer media streams ensure low-latency 1-on-1 video dates.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

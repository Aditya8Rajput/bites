import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

// Load .env.local
try {
  process.loadEnvFile(".env.local");
} catch (e) {
  console.log("process.loadEnvFile notice:", e.message);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("Connecting to Firebase project:", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const QUEUE_COLLECTION = "match_queue";
const MATCHES_COLLECTION = "matches";
const STALE_TIMEOUT_MS = 25000;

async function findOrQueueMatch(userId, peerId, userEmail) {
  const now = Date.now();
  const queueRef = collection(db, QUEUE_COLLECTION);

  const waitingQuery = query(queueRef, where("status", "==", "waiting"));
  const snapshot = await getDocs(waitingQuery);
  const candidates = [];

  snapshot.forEach((d) => {
    const data = d.data();
    if (data.userId !== userId && now - (data.createdAt || 0) < STALE_TIMEOUT_MS) {
      candidates.push({ id: d.id, data });
    }
  });

  candidates.sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));

  for (const candidate of candidates) {
    try {
      const matchId = `test_match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const candidateDocRef = doc(db, QUEUE_COLLECTION, candidate.id);
      const myDocRef = doc(db, QUEUE_COLLECTION, userId);
      const matchDocRef = doc(db, MATCHES_COLLECTION, matchId);

      const matched = await runTransaction(db, async (transaction) => {
        const candidateDoc = await transaction.get(candidateDocRef);
        if (!candidateDoc.exists()) return false;

        const candidateData = candidateDoc.data();
        if (candidateData.status !== "waiting") return false;

        const matchData = {
          matchId,
          initiatorPeerId: peerId,
          initiatorUid: userId,
          receiverPeerId: candidateData.peerId,
          receiverUid: candidateData.userId,
          status: "active",
          createdAt: Date.now(),
        };

        transaction.set(matchDocRef, matchData);
        transaction.update(candidateDocRef, {
          status: "matched",
          matchId,
        });
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
      console.warn("Transaction conflict:", err.message);
    }
  }

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

async function runTest() {
  console.log("\n--- STARTING TWO-USER REAL-TIME MATCHMAKING TEST ---");

  const userA = {
    uid: `test_user_A_${Date.now()}`,
    peerId: `peer_A_${Math.random().toString(36).substring(2, 7)}`,
    email: "alice@gmail.com",
  };

  const userB = {
    uid: `test_user_B_${Date.now()}`,
    peerId: `peer_B_${Math.random().toString(36).substring(2, 7)}`,
    email: "bob@gmail.com",
  };

  console.log(`[TEST] User A (Alice): ${userA.uid} (${userA.peerId})`);
  console.log(`[TEST] User B (Bob): ${userB.uid} (${userB.peerId})`);

  // Step 1: User A enters queue
  console.log("\n[STEP 1] User A enters queue...");
  const resultA = await findOrQueueMatch(userA.uid, userA.peerId, userA.email);
  console.log("[STEP 1 Result A]:", resultA);

  if (resultA.matched !== false || resultA.role !== "receiver") {
    throw new Error("FAIL: User A should be waiting as receiver with no candidates present");
  }
  console.log("✓ PASS: User A is properly waiting in queue.");

  // Set up snapshot listener on User A's ticket
  let userAMatchedPromiseResolve;
  const userAMatchedPromise = new Promise((resolve) => {
    userAMatchedPromiseResolve = resolve;
  });

  const docRefA = doc(db, QUEUE_COLLECTION, userA.uid);
  const unsubA = onSnapshot(docRefA, async (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status === "matched" && data.matchId) {
      const matchDoc = await getDoc(doc(db, MATCHES_COLLECTION, data.matchId));
      if (matchDoc.exists()) {
        userAMatchedPromiseResolve({ ticket: data, match: matchDoc.data() });
      }
    }
  });

  // Step 2: User B enters queue
  console.log("\n[STEP 2] User B enters queue and pairs atomically with User A...");
  const resultB = await findOrQueueMatch(userB.uid, userB.peerId, userB.email);
  console.log("[STEP 2 Result B]:", resultB);

  if (!resultB.matched || resultB.role !== "initiator" || resultB.remotePeerId !== userA.peerId) {
    throw new Error(`FAIL: User B should be initiator paired with User A's peerId ${userA.peerId}`);
  }
  console.log("✓ PASS: User B atomically matched User A as Initiator!");

  // Step 3: Wait for User A's listener to receive the match event
  console.log("\n[STEP 3] Waiting for User A to receive matched event via onSnapshot...");
  const matchEventForA = await Promise.race([
    userAMatchedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for User A snapshot")), 5000)),
  ]);

  console.log("[STEP 3 Event for A]:", {
    matchId: matchEventForA.match.matchId,
    initiatorPeerId: matchEventForA.match.initiatorPeerId,
    receiverPeerId: matchEventForA.match.receiverPeerId,
  });

  if (matchEventForA.match.matchId !== resultB.matchId) {
    throw new Error("FAIL: Match IDs between User A and User B do not match");
  }
  if (matchEventForA.match.initiatorPeerId !== userB.peerId) {
    throw new Error("FAIL: Initiator peerId on match document does not equal User B's peerId");
  }
  if (matchEventForA.match.receiverPeerId !== userA.peerId) {
    throw new Error("FAIL: Receiver peerId on match document does not equal User A's peerId");
  }
  console.log("✓ PASS: User A successfully received match event with User B's peer ID!");

  // Step 4: Test disconnect notification
  console.log("\n[STEP 4] Testing disconnect notification: User B ends match...");
  let matchEndedForAResolve;
  const matchEndedForAPromise = new Promise((resolve) => {
    matchEndedForAResolve = resolve;
  });

  const matchDocRef = doc(db, MATCHES_COLLECTION, resultB.matchId);
  const unsubMatch = onSnapshot(matchDocRef, (snap) => {
    if (snap.exists() && snap.data().status === "ended") {
      matchEndedForAResolve();
    }
  });

  // User B ends the match
  await setDoc(matchDocRef, { status: "ended" }, { merge: true });
  await Promise.race([
    matchEndedForAPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for match ended event")), 5000)),
  ]);
  console.log("✓ PASS: User A immediately detected that the match ended!");

  // Cleanup
  console.log("\n[STEP 5] Cleaning up test tickets & matches...");
  unsubA();
  unsubMatch();
  await deleteDoc(doc(db, QUEUE_COLLECTION, userA.uid)).catch(() => {});
  await deleteDoc(doc(db, QUEUE_COLLECTION, userB.uid)).catch(() => {});
  await deleteDoc(matchDocRef).catch(() => {});

  console.log("✓ PASS: Test artifacts cleaned up successfully.");
  console.log("\n=======================================================");
  console.log("🎉 ALL MATCHMAKING INTEGRATION TESTS PASSED CLEANLY!");
  console.log("=======================================================\n");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});

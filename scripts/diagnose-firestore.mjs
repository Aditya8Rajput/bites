import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

process.loadEnvFile(".env.local");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("=== FIRESTORE EXACT OPERATION DIAGNOSIS ===");
console.log("Firebase Project:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testOperation(name, fn) {
  try {
    process.stdout.write(`Testing [${name}] ... `);
    await fn();
    console.log("✅ SUCCESS");
    return true;
  } catch (err) {
    console.log(`❌ DENIED (${err.code}): ${err.message}`);
    return false;
  }
}

async function runDiagnosis() {
  // 1. Authenticate with an existing test user or create one
  const testEmail = "test_diag_" + Date.now() + "@gmail.com";
  const testPassword = "Password123!";
  
  let user;
  try {
    const cred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    user = cred.user;
    console.log(`Authenticated as UID: ${user.uid} (${testEmail})`);
  } catch (e) {
    console.error("Failed to authenticate test user:", e.message);
    process.exit(1);
  }

  // 2. Test users/{uid} write (create profile)
  await testOperation("users.create (own profile)", async () => {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      gender: "Other",
      isVerified: false,
      status: "idle",
      createdAt: serverTimestamp(),
    });
  });

  // 3. Test users/{uid} read (own profile)
  await testOperation("users.get (own profile)", async () => {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("Document not found");
  });

  // 4. Test match_queue list query
  await testOperation("match_queue.list (waiting peers query)", async () => {
    const q = query(collection(db, "match_queue"), where("status", "==", "waiting"));
    await getDocs(q);
  });

  // 5. Test match_queue create (queue own ticket as waiting)
  await testOperation("match_queue.create (status == waiting)", async () => {
    await setDoc(doc(db, "match_queue", user.uid), {
      userId: user.uid,
      peerId: "peer_test_123",
      userEmail: user.email,
      status: "waiting",
      matchId: null,
      createdAt: Date.now(),
    });
  });

  // 6. Test match_queue create (status == matched) -> What User B was doing!
  await testOperation("match_queue.create (status == matched)", async () => {
    const testDocId = "test_ticket_" + Date.now();
    await setDoc(doc(db, "match_queue", testDocId), {
      userId: testDocId,
      peerId: "peer_test_matched",
      userEmail: "matched@gmail.com",
      status: "matched",
      matchId: "match_123",
      createdAt: Date.now(),
    });
    await deleteDoc(doc(db, "match_queue", testDocId)).catch(() => {});
  });

  // 7. Test matches.create (initiator creates active match)
  const testMatchId = "match_diag_" + Date.now();
  await testOperation("matches.create (as initiator)", async () => {
    await setDoc(doc(db, "matches", testMatchId), {
      matchId: testMatchId,
      initiatorPeerId: "peer_test_123",
      initiatorUid: user.uid,
      receiverPeerId: "peer_remote_456",
      receiverUid: "user_remote_456",
      status: "active",
      createdAt: Date.now(),
    });
  });

  // 8. Test matches.get (as participant)
  await testOperation("matches.get (as participant)", async () => {
    const snap = await getDoc(doc(db, "matches", testMatchId));
    if (!snap.exists()) throw new Error("Match not found");
  });

  // 9. Test matches.update (set status == ended)
  await testOperation("matches.update (status == ended)", async () => {
    await setDoc(doc(db, "matches", testMatchId), {
      status: "ended",
    }, { merge: true });
  });

  // 10. Cleanup
  await deleteDoc(doc(db, "match_queue", user.uid)).catch(() => {});
  await deleteDoc(doc(db, "users", user.uid)).catch(() => {});
  await deleteDoc(doc(db, "matches", testMatchId)).catch(() => {});

  console.log("\n=== DIAGNOSIS COMPLETE ===");
  process.exit(0);
}

runDiagnosis().catch(console.error);

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import CyberVideoChat from "@/components/CyberVideoChat";

export default function CallPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLeave = async () => {
    if (user) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          status: "idle",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
      router.push("/dashboard");
    } else {
      router.push("/");
    }
  };

  return <CyberVideoChat onLeave={handleLeave} />;
}

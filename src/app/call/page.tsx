"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import CyberVideoChat from "@/components/CyberVideoChat";
import { Loader2, Zap } from "lucide-react";

export default function CallPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        console.warn("[CallPage] Unauthenticated access attempt, redirecting to login.");
        router.push("/?error=unauthorized");
        return;
      }

      // Reload user from Firebase Auth to get authoritative emailVerified status
      try {
        await currentUser.reload();
      } catch (err) {
        console.warn("[CallPage] Notice reloading auth user:", err);
      }

      const isDevBypass = typeof window !== "undefined" && sessionStorage.getItem("bites_dev_bypass") === "true";
      const isVerified = currentUser.emailVerified || isDevBypass;

      if (!isVerified) {
        console.warn("[CallPage] Unverified user attempted to enter matchmaking, redirecting to dashboard.");
        router.push("/dashboard?notice=verify_required");
        return;
      }

      setUser(currentUser);
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, [router]);

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

  if (authChecking) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center font-mono text-zinc-400 gap-3">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
          <Zap className="w-5 h-5 fill-emerald-400" />
          <span>bites.</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Verifying authorization and connecting to video network...</span>
        </div>
      </div>
    );
  }

  return <CyberVideoChat user={user} onLeave={handleLeave} />;
}

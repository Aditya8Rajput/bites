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
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Auth protection
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
      } else {
        setUser(currentUser);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Handle leaving speed date
  const handleLeaveDate = async () => {
    if (user) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          status: "idle",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }
    router.push("/dashboard");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-zinc-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-6 h-6 text-black fill-black" />
          </div>
          <div className="flex items-center gap-2 text-sm font-mono text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Connecting to secure WebRTC terminal...</span>
          </div>
        </div>
      </div>
    );
  }

  return <CyberVideoChat onLeave={handleLeaveDate} />;
}

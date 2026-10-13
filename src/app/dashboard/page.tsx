"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut,
  sendEmailVerification,
  User,
} from "firebase/auth";
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Zap,
  ShieldCheck,
  LogOut,
  Loader2,
  Mail,
  AlertTriangle,
  Sparkles,
  Radio,
  RefreshCw,
  XCircle,
  Video,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";

type UserStatus = "idle" | "in-queue" | "in-call";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<UserStatus>("idle");
  const [statusLoading, setStatusLoading] = useState(false);

  // Email verification state
  const [isVerified, setIsVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [refreshingAuth, setRefreshingAuth] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const statusRef = useRef<UserStatus>("idle");
  statusRef.current = userStatus;

  // 1. Listen for Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }

      setUser(currentUser);
      setIsVerified(currentUser.emailVerified);
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  // 2. Auto-poll email verification state every 4 seconds if unverified
  useEffect(() => {
    if (!user || isVerified) return;

    const intervalId = setInterval(async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            setUser({ ...auth.currentUser });
            setIsVerified(true);
            setVerificationNotice("Email verified successfully! Welcome to Bites.");

            const userDocRef = doc(db, "users", auth.currentUser.uid);
            await setDoc(userDocRef, { isVerified: true }, { merge: true }).catch(() => {});
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        // Silent catch for periodic polling
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [user, isVerified]);

  // 3. Real-time Firestore listener on users/{uid}
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeDoc = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const currentStatus: UserStatus = data.status || "idle";
          setUserStatus(currentStatus);

          if (data.isVerified === true && !isVerified) {
            setIsVerified(true);
          }

          if (currentStatus === "in-call") {
            router.push("/call");
          }
        } else {
          setDoc(
            userDocRef,
            {
              uid: user.uid,
              email: user.email,
              gender: "Other",
              isVerified: isVerified,
              status: "idle",
              createdAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});
        }
      },
      (err) => {
        console.error("Firestore listener error:", err);
      }
    );

    const handleBeforeUnload = () => {
      if (statusRef.current === "in-queue" && auth.currentUser) {
        setDoc(
          doc(db, "users", auth.currentUser.uid),
          { status: "idle" },
          { merge: true }
        ).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubscribeDoc();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user, isVerified, router]);

  // Handle Find your partner / Enter Queue -> Navigate directly to 1-on-1 video call room
  const handleEnterQueue = () => {
    router.push("/call");
  };

  // Handle Cancel Queue
  const handleLeaveQueue = async () => {
    if (!user) return;
    setErrorNotice(null);
    setStatusLoading(true);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(
        userDocRef,
        {
          status: "idle",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setUserStatus("idle");
    } catch (err: unknown) {
      console.error("Error leaving queue:", err);
      setErrorNotice("Failed to leave matching queue. Please try again.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Resend verification email
  const handleResendEmail = async () => {
    if (!auth.currentUser) return;
    setResendLoading(true);
    setVerificationNotice(null);
    setErrorNotice(null);

    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationNotice(
        `Verification email sent to ${auth.currentUser.email}. Please check your inbox & spam folder.`
      );
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr.code === "auth/too-many-requests") {
        setErrorNotice("Too many requests sent. Please wait 1 minute before resending.");
      } else {
        setErrorNotice(fbErr.message || "Failed to send verification email.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  // Re-check email verification status manually
  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;
    setRefreshingAuth(true);
    setErrorNotice(null);
    setVerificationNotice(null);

    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setUser({ ...auth.currentUser });
        setIsVerified(true);
        setVerificationNotice("Email verified successfully! Welcome to Bites.");

        await setDoc(
          doc(db, "users", auth.currentUser.uid),
          { isVerified: true },
          { merge: true }
        ).catch(() => {});
      } else {
        setErrorNotice(
          "Email not verified yet. Please open the link received in your student email inbox."
        );
      }
    } catch (err: unknown) {
      const fbErr = err as { message?: string };
      setErrorNotice(fbErr.message || "Failed to refresh verification status.");
    } finally {
      setRefreshingAuth(false);
    }
  };

  // Test Bypass: Allows instant verification for local development & testing
  const handleDevBypass = async () => {
    if (!user) return;
    try {
      setIsVerified(true);
      await setDoc(
        doc(db, "users", user.uid),
        { isVerified: true },
        { merge: true }
      ).catch(() => {});
      setVerificationNotice("Development bypass active: Account verified for testing.");
    } catch (err) {
      console.error("Dev bypass error:", err);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      if (user && userStatus === "in-queue") {
        await setDoc(doc(db, "users", user.uid), { status: "idle" }, { merge: true }).catch(() => {});
      }
      await signOut(auth);
      router.push("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#05080f] flex flex-col items-center justify-center text-zinc-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-6 h-6 text-black fill-black" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-emerald-400/20 blur-md -z-10 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm font-mono text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Verifying campus credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#05080f] text-zinc-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden font-sans">
      {/* High-Tech Ambient Neon Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 left-1/3 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-24 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 left-10 w-[450px] h-[450px] bg-emerald-600/10 rounded-full blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a15_1px,transparent_1px),linear-gradient(to_bottom,#0f172a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,#000_70%,transparent_100%)]" />
      </div>

      {/* Futuristic Dashboard Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between border-b border-emerald-500/10 backdrop-blur-xl bg-[#05080f]/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-300/40">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white">
              bites<span className="text-emerald-400">.</span>
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Dashboard
            </span>
          </div>
        </div>

        {/* User Info & Sign Out */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300 font-mono bg-zinc-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="truncate max-w-[180px]">{user?.email}</span>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 text-xs font-mono transition-all hover:border-zinc-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard View */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* CASE A: Email NOT Verified */}
        {!isVerified ? (
          <div className="w-full max-w-lg">
            <div className="relative rounded-2xl bg-zinc-900/60 border border-amber-500/20 p-8 shadow-[0_0_50px_-12px_rgba(245,158,11,0.15)] backdrop-blur-2xl text-center">
              {/* Alert Badge */}
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                Verify Your Email
              </h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
                To keep the Bites community safe and authentic, speed dating requires a verified{" "}
                <span className="text-emerald-300 font-mono font-medium">{user?.email}</span> address.
              </p>

              {/* Feedback messages */}
              {verificationNotice && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 text-left">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{verificationNotice}</span>
                </div>
              )}

              {errorNotice && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{errorNotice}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleRefreshVerification}
                  disabled={refreshingAuth}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 focus:outline-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {refreshingAuth ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Checking verification status...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-black" />
                      <span>I&apos;ve verified my email</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleResendEmail}
                  disabled={resendLoading}
                  className="w-full py-2.5 px-4 bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                      <span>Dispatching link...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Resend Verification Email</span>
                    </>
                  )}
                </button>
              </div>

              {/* Dev / Testing Bypass Option */}
              <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-col items-center gap-2">
                <button
                  onClick={handleDevBypass}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-mono border border-emerald-500/30 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Testing Locally? Click here to bypass email verification</span>
                </button>
                <p className="text-[11px] font-mono text-zinc-500">
                  Auto-checking status every 4 seconds in background.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* CASE B: Email IS Verified - Main Matching Dashboard */
          <div className="w-full max-w-xl flex flex-col items-center text-center">
            {/* Status Indicator Chip */}
            <div className="mb-8">
              {userStatus === "in-queue" ? (
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-semibold shadow-lg shadow-cyan-500/10 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>Searching for available partner on campus...</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-medium shadow-sm">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Live Matchmaking Queue • Verified Students</span>
                </div>
              )}
            </div>

            {/* Error notice if any */}
            {errorNotice && (
              <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 max-w-md w-full">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Central Glow Core & Glowing Action CTA */}
            <div className="relative my-4 flex flex-col items-center justify-center">
              {/* Pulsating background ring aura */}
              <div
                className={`absolute -inset-8 rounded-full transition-all duration-700 pointer-events-none ${
                  userStatus === "in-queue"
                    ? "bg-cyan-500/20 blur-3xl animate-pulse scale-110"
                    : "bg-emerald-500/20 blur-3xl animate-pulse"
                }`}
              />

              {/* The Hero Button */}
              {userStatus === "in-queue" ? (
                <div className="flex flex-col items-center gap-4">
                  {/* Glowing Radar Box */}
                  <div className="relative w-56 h-56 rounded-full bg-zinc-900/80 border border-cyan-400/50 flex flex-col items-center justify-center p-6 shadow-[0_0_60px_-10px_rgba(6,182,212,0.3)] backdrop-blur-2xl">
                    <div className="absolute inset-2 rounded-full border border-cyan-400/20 animate-spin [animation-duration:8s]" />
                    <div className="absolute inset-6 rounded-full border border-cyan-400/10 animate-ping [animation-duration:3s]" />
                    
                    <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
                    <span className="text-lg font-bold text-white tracking-tight">Searching...</span>
                    <span className="text-[11px] font-mono text-cyan-300 mt-1">
                      Matching random partner
                    </span>
                  </div>

                  {/* Cancel Queue CTA */}
                  <button
                    onClick={handleLeaveQueue}
                    disabled={statusLoading}
                    className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition-all hover:border-red-500/50 hover:text-red-300 shadow-md"
                  >
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Cancel Search</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleEnterQueue}
                    disabled={statusLoading}
                    className="group relative px-10 py-6 sm:px-14 sm:py-7 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-black text-xl sm:text-2xl tracking-tight shadow-[0_0_50px_rgba(16,185,129,0.4)] hover:shadow-[0_0_70px_rgba(6,182,212,0.6)] focus:outline-none transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 flex items-center gap-3.5"
                  >
                    {statusLoading ? (
                      <>
                        <Loader2 className="w-7 h-7 animate-spin text-black" />
                        <span>Entering queue...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-7 h-7 text-black fill-black transition-transform group-hover:rotate-12" />
                        <span>Find your partner.</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs font-mono text-zinc-500 mt-4">
                    Click to enter the randomized 1-on-1 video date queue.
                  </p>
                </div>
              )}
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl mt-12">
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 backdrop-blur-md text-left">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5">
                  <Radio className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">100% Random</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Unbiased video matchmaking across all verified participants.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 backdrop-blur-md text-left">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2.5">
                  <Video className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">P2P WebRTC</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Direct encrypted video stream with zero latency.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 backdrop-blur-md text-left">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">Verified Community</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Open for all verified Google Gmail accounts.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 text-center text-xs font-mono text-zinc-600 border-t border-emerald-500/10">
        &copy; {new Date().getFullYear()} Bites. Peer-to-peer 1-on-1 random video chat.
      </footer>
    </div>
  );
}

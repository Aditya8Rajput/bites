"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Video,
  Mail,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  ShieldCheck,
  Radio,
} from "lucide-react";

type AuthMode = "signup" | "login";
type Gender = "Male" | "Female" | "Other";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("Female");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const isSubmittingRef = useRef(false);

  // Auto-redirect if already authenticated and not in the middle of submitting form
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !isSubmittingRef.current) {
        router.push("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Strict validation: must end with @thapar.edu
  const validateThaparEmail = (emailStr: string): boolean => {
    const trimmed = emailStr.trim().toLowerCase();
    return trimmed.endsWith("@thapar.edu") && trimmed.length > "@thapar.edu".length;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    // Strict validation check
    if (!validateThaparEmail(cleanEmail)) {
      setError("Registration restricted: Only official @thapar.edu email addresses are permitted.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    isSubmittingRef.current = true;

    try {
      if (mode === "signup") {
        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;

        // 2. Send verification email
        try {
          await sendEmailVerification(user);
        } catch (emailErr) {
          console.warn("sendEmailVerification notice:", emailErr);
        }

        // 3. Create initial user document in Firestore under users/{uid}
        await setDoc(
          doc(db, "users", user.uid),
          {
            uid: user.uid,
            email: user.email || cleanEmail,
            gender: gender,
            isVerified: false,
            status: "idle",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        setVerificationPending(true);
        setSuccessMessage("Verification link dispatched! Redirecting to campus dashboard...");

        setTimeout(() => {
          isSubmittingRef.current = false;
          router.push("/dashboard");
        }, 800);
      } else {
        // 1. Log in existing user
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        isSubmittingRef.current = false;
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      const firebaseError = err as { code?: string; message?: string };
      switch (firebaseError.code) {
        case "auth/email-already-in-use":
          setError("An account with this @thapar.edu email already exists. Please switch to Sign In.");
          break;
        case "auth/invalid-email":
          setError("Invalid email address format.");
          break;
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Invalid credentials. Please verify your email and password.");
          break;
        case "auth/too-many-requests":
          setError("Too many consecutive attempts. Please wait a moment and try again.");
          break;
        default:
          setError(firebaseError.message || "Authentication error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      await sendEmailVerification(auth.currentUser);
      setSuccessMessage("A fresh verification email has been dispatched to your @thapar.edu inbox.");
    } catch (err: unknown) {
      const firebaseError = err as { message?: string };
      setError(firebaseError.message || "Failed to resend verification email. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#05080f] text-zinc-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden font-sans">
      {/* High-Tech Ambient Neon Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-20 w-[450px] h-[450px] bg-cyan-500/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-24 left-10 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[120px]" />
        {/* Subtle grid backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a15_1px,transparent_1px),linear-gradient(to_bottom,#0f172a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Futuristic Navigation Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between border-b border-emerald-500/10 backdrop-blur-xl bg-[#05080f]/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-300/40">
            <Zap className="w-5 h-5 text-black fill-black" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white">
              bites<span className="text-emerald-400">.</span>
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Thapar Campus
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 font-mono bg-zinc-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-inner">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Restricted to <span className="text-emerald-300 font-semibold">@thapar.edu</span></span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Prominent Marketing Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-medium mb-5 shadow-sm shadow-emerald-500/10">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Randomized 1-on-1 P2P Video Dates</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400 tracking-tight leading-tight mb-2">
            Bites<span className="text-emerald-400">.</span>
          </h1>

          <h2 className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight mb-4">
            Find your partner.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 max-w-lg mx-auto leading-relaxed">
            High-speed, peer-to-peer 1-on-1 video matching exclusively for verified Thapar University students.
          </p>
        </div>

        {/* Authentication Glass Card */}
        <div className="w-full max-w-md">
          <div className="relative rounded-2xl bg-zinc-900/50 border border-white/10 p-8 shadow-[0_0_50px_-12px_rgba(16,185,129,0.15)] backdrop-blur-2xl transition-all">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 mb-6 bg-black/50 rounded-xl border border-white/5 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === "signup"
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold shadow-lg shadow-emerald-500/25"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold shadow-lg shadow-emerald-500/25"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Notification & Feedback Alerts */}
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 backdrop-blur-md">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 backdrop-blur-md">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>
                  <p>{successMessage}</p>
                  {verificationPending && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      className="mt-2 text-xs underline font-semibold text-cyan-300 hover:text-cyan-200 block"
                    >
                      Didn&apos;t receive it? Resend verification link
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              {/* College Email Input */}
              <div>
                <label className="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                  College Email (@thapar.edu) <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rollno@thapar.edu"
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-zinc-800 focus:border-emerald-400/80 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1 font-mono">
                  <span className="text-emerald-400 font-bold">@</span> Strictly requires <code className="text-zinc-300">@thapar.edu</code>
                </p>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                  Password <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-zinc-800 focus:border-emerald-400/80 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Gender Selection (Male / Female / Other) */}
              {mode === "signup" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono font-medium text-zinc-300">
                      Gender <span className="text-emerald-400">*</span>
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      (Matching is 100% random)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Female", "Male", "Other"] as Gender[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setGender(opt)}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          gender === opt
                            ? "bg-emerald-500/15 border-emerald-400/70 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm shadow-emerald-500/20"
                            : "bg-black/30 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black fill-black" />
                    <span>{mode === "signup" ? "Create Account & Join Queue" : "Sign In to Bites"}</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Tech Details */}
            <div className="mt-6 pt-5 border-t border-zinc-800/60 text-center">
              <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1">
                  <Video className="w-3 h-3 text-cyan-400" /> WebRTC P2P
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" /> 100% Random Pairings
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 text-center text-xs font-mono text-zinc-600 border-t border-emerald-500/10">
        &copy; {new Date().getFullYear()} Bites. Exclusive peer-to-peer 1-on-1 video dating for Thapar University.
      </footer>
    </div>
  );
}

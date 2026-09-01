"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  BadgeCheck,
  Camera,
  GraduationCap,
  HeartHandshake,
  Lock,
  LogOut,
  Mail,
  Mic,
  ShieldCheck,
  Sparkles,
  Video,
  VideoOff,
} from "lucide-react";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

const guardrails = [
  {
    icon: GraduationCap,
    title: "College email only",
    text: "Students verify with an official .edu email before entering Bites.",
  },
  {
    icon: Video,
    title: "Video only",
    text: "No text chat and no group calls, just one-to-one live video.",
  },
  {
    icon: Lock,
    title: "Never recorded",
    text: "Calls are designed for peer-to-peer WebRTC sessions only.",
  },
];

type AuthMode = "sign-in" | "create-account";
type Step = "login" | "otp" | "permissions" | "matching";

function isCollegeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.edu$/i.test(email.trim());
}

async function readApiResponse(response: Response) {
  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    devOtp?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Something went wrong.");
  }

  return data;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const campusName = useMemo(() => {
    const domain = email.trim().split("@")[1];
    if (!domain) {
      return "your campus";
    }

    return domain.replace(/\.edu$/i, "").replaceAll(".", " ");
  }, [email]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDevOtp("");

    if (!isCollegeEmail(email)) {
      setError("Use your official .edu college email to continue.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsBusy(true);

    try {
      if (auth && isFirebaseConfigured) {
        if (authMode === "sign-in") {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } else {
          await createUserWithEmailAndPassword(auth, email.trim(), password);
        }
      }

      const response = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await readApiResponse(response);

      setDevOtp(data.devOtp ?? "");
      setOtp("");
      setStep("otp");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message.replace("Firebase: ", "")
          : "Could not continue.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the six-digit OTP from your email.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      await readApiResponse(response);
      setStep("permissions");
    } catch (otpError) {
      setError(
        otpError instanceof Error ? otpError.message : "Could not verify OTP.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function requestCameraAndMic() {
    setError("");
    setIsBusy(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "user",
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });

      setStream(mediaStream);
      setStep("matching");
    } catch {
      setError("Allow camera and microphone permission to start matching.");
    } finally {
      setIsBusy(false);
    }
  }

  async function endSession() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setStep("login");
    setPassword("");
    setOtp("");
    setDevOtp("");
    setError("");

    if (auth && isFirebaseConfigured) {
      await signOut(auth);
    }
  }

  function statusText() {
    if (step === "login") {
      return "Login required";
    }
    if (step === "otp") {
      return "OTP sent";
    }
    if (step === "permissions") {
      return "Camera permission";
    }
    return "Looking for match";
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#151515]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-8 px-5 py-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div className="flex min-h-[calc(100vh-2.5rem)] flex-col justify-between gap-8 rounded-[8px] border border-black/10 bg-[#fffaf1] p-5 shadow-[0_24px_80px_rgba(33,26,17,0.10)] sm:p-8">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-[8px] bg-[#141414] text-white">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xl font-black tracking-normal">Bites</p>
                <p className="text-sm font-medium text-[#6b6259]">
                  College-only live dating
                </p>
              </div>
            </div>
            <span className="rounded-[8px] border border-[#b44437]/25 bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#9e3328]">
              .edu only
            </span>
          </header>

          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-[8px] bg-[#e4f2ea] px-3 py-2 text-sm font-bold text-[#17613d]">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Verified campus network
            </p>
            <h1 className="text-4xl font-black leading-[1.04] tracking-normal text-[#141414] sm:text-5xl">
              Log in before the camera opens.
            </h1>
            <p className="mt-4 max-w-lg text-base font-medium leading-7 text-[#5f574f]">
              Bites verifies your college email with an OTP, then asks for
              camera and microphone permission before searching for a match.
            </p>
          </div>

          {step === "login" ? (
            <form
              onSubmit={handleLoginSubmit}
              className="rounded-[8px] border border-black/10 bg-white p-4 shadow-sm"
            >
              <div className="grid grid-cols-2 gap-2 rounded-[8px] bg-[#f5f1ea] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("sign-in");
                    setError("");
                  }}
                  className={`min-h-11 rounded-[6px] text-sm font-black transition ${
                    authMode === "sign-in"
                      ? "bg-white text-[#141414] shadow-sm"
                      : "text-[#6b6259] hover:bg-white/60"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("create-account");
                    setError("");
                  }}
                  className={`min-h-11 rounded-[6px] text-sm font-black transition ${
                    authMode === "create-account"
                      ? "bg-white text-[#141414] shadow-sm"
                      : "text-[#6b6259] hover:bg-white/60"
                  }`}
                >
                  Create account
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="block" htmlFor="college-email">
                  <span className="mb-2 block text-sm font-black text-[#3d3833]">
                    College email
                  </span>
                  <span className="relative block">
                    <Mail
                      className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#857b71]"
                      aria-hidden="true"
                    />
                    <input
                      id="college-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@college.edu"
                      className="min-h-14 w-full rounded-[6px] border border-black/10 bg-[#fbfaf7] px-12 text-base font-semibold outline-none transition focus:border-[#1b6f9f] focus:bg-white focus:ring-4 focus:ring-[#1b6f9f]/15"
                      autoComplete="email"
                    />
                  </span>
                </label>

                <label className="block" htmlFor="password">
                  <span className="mb-2 block text-sm font-black text-[#3d3833]">
                    Password
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    className="min-h-14 w-full rounded-[6px] border border-black/10 bg-[#fbfaf7] px-4 text-base font-semibold outline-none transition focus:border-[#1b6f9f] focus:bg-white focus:ring-4 focus:ring-[#1b6f9f]/15"
                    autoComplete={
                      authMode === "sign-in"
                        ? "current-password"
                        : "new-password"
                    }
                  />
                </label>

                <FormMessage error={error}>
                  Only official campus .edu emails can enter Bites.
                </FormMessage>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[6px] bg-[#141414] px-5 text-base font-bold text-white transition hover:bg-[#2d2d2d] focus:outline-none focus:ring-4 focus:ring-[#141414]/20 disabled:cursor-not-allowed disabled:bg-[#777]"
                >
                  <Mail className="size-5" aria-hidden="true" />
                  {isBusy ? "Sending OTP" : "Send OTP"}
                </button>
              </div>
            </form>
          ) : null}

          {step === "otp" ? (
            <form
              onSubmit={handleOtpSubmit}
              className="rounded-[8px] border border-black/10 bg-white p-4 shadow-sm"
            >
              <p className="inline-flex items-center gap-2 text-sm font-bold text-[#17613d]">
                <BadgeCheck className="size-4" aria-hidden="true" />
                OTP sent to {email}
              </p>
              <label className="mt-4 block" htmlFor="otp">
                <span className="mb-2 block text-sm font-black text-[#3d3833]">
                  Six-digit OTP
                </span>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  className="min-h-14 w-full rounded-[6px] border border-black/10 bg-[#fbfaf7] px-4 text-center text-2xl font-black tracking-[0.2em] outline-none transition focus:border-[#1b6f9f] focus:bg-white focus:ring-4 focus:ring-[#1b6f9f]/15"
                  inputMode="numeric"
                />
              </label>
              {devOtp ? (
                <p className="mt-3 rounded-[6px] bg-[#e4f2ea] px-3 py-2 text-sm font-bold text-[#17613d]">
                  Local test OTP: {devOtp}
                </p>
              ) : null}
              <FormMessage error={error}>
                The OTP expires in 10 minutes.
              </FormMessage>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[6px] bg-[#141414] px-5 text-base font-bold text-white transition hover:bg-[#2d2d2d] focus:outline-none focus:ring-4 focus:ring-[#141414]/20 disabled:cursor-not-allowed disabled:bg-[#777]"
                >
                  <BadgeCheck className="size-5" aria-hidden="true" />
                  {isBusy ? "Verifying" : "Verify OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("login");
                    setError("");
                    setOtp("");
                  }}
                  className="min-h-14 rounded-[6px] border border-black/10 px-4 text-sm font-black text-[#3d3833] transition hover:bg-[#f5f1ea]"
                >
                  Change email
                </button>
              </div>
            </form>
          ) : null}

          {step === "permissions" ? (
            <section className="rounded-[8px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-[#17613d]">
                <BadgeCheck className="size-4" aria-hidden="true" />
                Verified as {email}
              </p>
              <h2 className="mt-3 text-2xl font-black text-[#141414]">
                Allow camera and mic
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#6b6259]">
                Bites needs your camera and microphone before it can start
                looking for a live video match.
              </p>
              <FormMessage error={error}>
                Your browser will show the permission prompt.
              </FormMessage>
              <button
                type="button"
                onClick={requestCameraAndMic}
                disabled={isBusy}
                className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[6px] bg-[#141414] px-5 text-base font-bold text-white transition hover:bg-[#2d2d2d] focus:outline-none focus:ring-4 focus:ring-[#141414]/20 disabled:cursor-not-allowed disabled:bg-[#777]"
              >
                <Camera className="size-5" aria-hidden="true" />
                {isBusy ? "Opening camera" : "Allow camera and mic"}
              </button>
            </section>
          ) : null}

          {step === "matching" ? (
            <section className="rounded-[8px] border border-black/10 bg-white p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-[#17613d]">
                <BadgeCheck className="size-4" aria-hidden="true" />
                Camera is live
              </p>
              <h2 className="mt-3 text-2xl font-black text-[#141414]">
                Looking for a match at {campusName}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#6b6259]">
                Stay on this page while Bites searches the campus queue.
              </p>
              <button
                type="button"
                onClick={endSession}
                className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[6px] bg-[#d74a3a] px-5 text-base font-bold text-white transition hover:bg-[#bb3b2d] focus:outline-none focus:ring-4 focus:ring-[#d74a3a]/20"
              >
                <LogOut className="size-5" aria-hidden="true" />
                End session
              </button>
            </section>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-3">
            {guardrails.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  className="rounded-[8px] border border-black/10 bg-white p-4"
                  key={item.title}
                >
                  <Icon className="size-6 text-[#1b6f9f]" aria-hidden="true" />
                  <h2 className="mt-3 text-base font-black">{item.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#625a52]">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </section>
        </div>

        <div className="flex min-h-[calc(100vh-2.5rem)] flex-col gap-4">
          <section className="flex flex-1 flex-col overflow-hidden rounded-[8px] border border-black/10 bg-[#161616] text-white shadow-[0_24px_80px_rgba(0,0,0,0.20)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`size-3 rounded-full ${
                    step === "matching" ? "bg-[#54d17a]" : "bg-[#ffd36c]"
                  }`}
                />
                <p className="text-sm font-bold">{statusText()}</p>
              </div>
              <p className="text-sm font-semibold text-white/60">1:1 video</p>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <div className="relative min-h-[320px] overflow-hidden rounded-[8px] bg-[#284b63]">
                {stream ? (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 size-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.20),transparent_28%),linear-gradient(140deg,#365f7b,#20323d_58%,#111)]" />
                )}
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-[6px] bg-black/45 px-3 py-2 text-sm font-bold backdrop-blur">
                  <BadgeCheck className="size-4 text-[#80e2a4]" />
                  {step === "matching" ? "Live" : "Locked"}
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xl font-black">
                    {step === "matching" ? "You" : "Camera preview"}
                  </p>
                  <p className="text-sm font-semibold text-white/75">
                    {step === "matching"
                      ? `${campusName} verified`
                      : "Login and verify OTP first"}
                  </p>
                </div>
              </div>

              <div className="relative min-h-[320px] overflow-hidden rounded-[8px] bg-[#684a7b]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,255,255,0.18),transparent_26%),linear-gradient(140deg,#7f5f8e,#463554_56%,#151218)]" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-[6px] bg-black/45 px-3 py-2 text-sm font-bold backdrop-blur">
                  <HeartHandshake className="size-4 text-[#ffd36c]" />
                  Match
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="mb-4 grid aspect-[4/3] place-items-center rounded-[8px] border border-white/15 bg-white/10 text-center backdrop-blur-sm">
                    <p className="px-4 text-sm font-bold text-white/75">
                      {step === "matching"
                        ? "Searching campus queue..."
                        : "Match unlocks after permissions"}
                    </p>
                  </div>
                  <p className="text-xl font-black">
                    {step === "matching" ? "Looking for match" : "Waiting"}
                  </p>
                  <p className="text-sm font-semibold text-white/75">
                    No text chat. Video only.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-4">
              <button
                className="flex size-12 items-center justify-center rounded-[8px] bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Camera"
                title="Camera"
                type="button"
              >
                <Camera className="size-5" aria-hidden="true" />
              </button>
              <button
                className="flex size-12 items-center justify-center rounded-[8px] bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Microphone"
                title="Microphone"
                type="button"
              >
                <Mic className="size-5" aria-hidden="true" />
              </button>
              <button
                className="flex size-12 items-center justify-center rounded-[8px] bg-[#d74a3a] text-white transition hover:bg-[#bb3b2d]"
                aria-label="Leave"
                title="Leave"
                type="button"
                onClick={step === "matching" ? endSession : undefined}
              >
                <VideoOff className="size-5" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function FormMessage({
  children,
  error,
}: {
  children: string;
  error: string;
}) {
  if (error) {
    return (
      <p className="mt-3 rounded-[6px] bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#9e3328]">
        {error}
      </p>
    );
  }

  return (
    <p className="mt-3 text-sm font-semibold leading-6 text-[#6b6259]">
      {children}
    </p>
  );
}

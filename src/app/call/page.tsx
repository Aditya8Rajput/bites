"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  Video,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  Zap,
  ShieldCheck,
  Radio,
  AlertCircle,
} from "lucide-react";

export default function CallPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // 1. Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Initialize local camera & microphone media stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: true,
        })
        .then((stream) => {
          activeStream = stream;
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Camera or microphone access denied/unavailable:", err);
          setMediaError("Camera/Microphone permission denied or device not found.");
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 3. Toggle Microphone
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
    }
  };

  // 4. Toggle Camera Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  // 5. Leave Video Date
  const handleEndCall = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
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

  return (
    <div className="relative min-h-screen bg-[#05080f] text-zinc-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200 overflow-hidden font-sans">
      {/* Background ambient accents */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between border-b border-emerald-500/10 backdrop-blur-xl bg-[#05080f]/50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-4 h-4 text-black fill-black" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">bites.</span>
          <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            Live Speed Date
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-zinc-900/60 px-3 py-1 rounded-full border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Connected P2P</span>
        </div>
      </header>

      {/* Media Notice if permission issue */}
      {mediaError && (
        <div className="relative z-10 max-w-lg mx-auto mt-2 px-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{mediaError}</span>
          </div>
        </div>
      )}

      {/* Video Streams Grid */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Remote Video Container */}
        <div className="relative rounded-2xl bg-zinc-900/60 border border-emerald-500/20 flex flex-col items-center justify-center overflow-hidden shadow-2xl backdrop-blur-xl aspect-video w-full">
          <div className="text-center p-6 flex flex-col items-center">
            <div className="w-16 h-16 mb-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse shadow-lg shadow-emerald-500/10">
              <Video className="w-8 h-8" />
            </div>
            <p className="text-sm font-mono text-zinc-300">Partner Video Stream</p>
            <p className="text-xs text-zinc-500 mt-1">Connecting WebRTC peer stream...</p>
          </div>
          <div className="absolute bottom-4 left-4 text-xs font-mono text-zinc-400 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Partner</span>
          </div>
        </div>

        {/* Local Video Container */}
        <div className="relative rounded-2xl bg-black border border-zinc-800 flex flex-col items-center justify-center overflow-hidden shadow-2xl aspect-video w-full">
          {/* Live Video Feed Element */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 ${
              videoEnabled ? "block" : "hidden"
            }`}
          />

          {/* Video Off Placeholder */}
          {!videoEnabled && (
            <div className="text-center p-6 flex flex-col items-center">
              <div className="w-16 h-16 mb-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <VideoOff className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-zinc-400">Camera Paused</p>
              <p className="text-xs text-zinc-600 mt-1">Your video stream is currently muted</p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 text-xs font-mono text-zinc-400 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            <span>You ({user?.email?.split("@")[0] || "Student"})</span>
          </div>

          {!micEnabled && (
            <div className="absolute top-4 right-4 text-xs font-semibold text-red-400 bg-red-950/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-red-500/30 flex items-center gap-1">
              <MicOff className="w-3 h-3" />
              <span>Muted</span>
            </div>
          )}
        </div>
      </main>

      {/* Control Bar */}
      <footer className="relative z-10 w-full max-w-xl mx-auto px-6 py-5 flex items-center justify-center gap-4">
        <button
          onClick={toggleMic}
          className={`p-3.5 rounded-full border transition-all shadow-md ${
            micEnabled
              ? "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border-zinc-700"
              : "bg-red-500/20 border-red-500/40 text-red-300 ring-2 ring-red-500/20"
          }`}
          title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
        >
          {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-3.5 rounded-full border transition-all shadow-md ${
            videoEnabled
              ? "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border-zinc-700"
              : "bg-red-500/20 border-red-500/40 text-red-300 ring-2 ring-red-500/20"
          }`}
          title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={handleEndCall}
          className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Leave Date</span>
        </button>
      </footer>
    </div>
  );
}

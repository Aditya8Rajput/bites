"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SkipForward,
  ShieldAlert,
  Terminal,
  Radio,
  Wifi,
  RefreshCw,
  Zap,
} from "lucide-react";

type PermissionStatus = "idle" | "requesting" | "granted" | "denied";

export default function CyberVideoChat() {
  // 3. ERROR HANDLING: Hydration safety guard to ensure only client-side execution
  const [mounted, setMounted] = useState(false);

  // Media & permission states
  const [permission, setPermission] = useState<PermissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [strangerConnected, setStrangerConnected] = useState(false);

  // Video element & stream references
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Hydration safety: ensure component mounts on client before touching browser APIs
  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. COMPONENT ARCHITECTURE: Request camera & microphone on mount
  const initMedia = useCallback(async () => {
    setPermission("requesting");
    setErrorMessage(null);

    // Safeguard for browser environment and mediaDevices API
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setPermission("denied");
      setErrorMessage("MEDIA_DEVICE_UNAVAILABLE: Browser lacks getUserMedia support.");
      return;
    }

    try {
      // Release any prior tracks to prevent camera lock
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setPermission("granted");
      setMicEnabled(true);
      setVideoEnabled(true);

      // Start initial Omegle matching sequence
      simulateStrangerMatch();
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      setPermission("denied");
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setErrorMessage("SYS_ERR_PERM_DENIED: Camera/Microphone access was denied by client.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setErrorMessage("SYS_ERR_NO_DEVICE: No optical/audio hardware detected.");
      } else {
        setErrorMessage(`SYS_ERR_UNKNOWN: ${error.message || "Failed to initialize media stream."}`);
      }
    }
  }, []);

  // Request permissions once component has successfully mounted
  useEffect(() => {
    if (!mounted) return;
    initMedia();

    return () => {
      // Stop all camera and microphone tracks on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mounted, initMedia]);

  // Simulate Omegle stranger connection
  const simulateStrangerMatch = () => {
    setIsSearching(true);
    setStrangerConnected(false);

    const timer = setTimeout(() => {
      setIsSearching(false);
      setStrangerConnected(true);
    }, 1500);

    return () => clearTimeout(timer);
  };

  // Toggle Microphone Audio Track
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !micEnabled;
    });
    setMicEnabled((prev) => !prev);
  };

  // Toggle Camera Video Track
  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !videoEnabled;
    });
    setVideoEnabled((prev) => !prev);
  };

  // Next / Skip Stranger Handler
  const handleNext = () => {
    setIsSearching(true);
    setStrangerConnected(false);

    // Omegle peer renegotiation simulation
    setTimeout(() => {
      setIsSearching(false);
      setStrangerConnected(true);
    }, 1200);
  };

  // 3. Hydration Fallback: Render cyberpunk skeleton loader during SSR
  if (!mounted) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4 text-emerald-400">
          <Terminal className="w-8 h-8 animate-pulse text-emerald-400" />
          <p className="text-xs uppercase tracking-[0.3em] animate-pulse">
            INITIALIZING_CYBER_SUBSYSTEM...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] text-zinc-100 font-sans overflow-hidden flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 2. UI/UX: Deep Dark Background & Cyber Ambient Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[160px]" />
        {/* Subtle Cyber Grid Mask */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff8808_1px,transparent_1px),linear-gradient(to_bottom,#00ff8808_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Cyberpunk Top Bar */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-emerald-500/20 backdrop-blur-2xl bg-[#0a0a0a]/70">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black tracking-wider text-lg text-white">
                OMEGLE<span className="text-emerald-400">.CYBER</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 uppercase tracking-widest">
                v2.4_P2P
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry / Status indicator */}
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900/80 border border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>NODE: ENCRYPTED</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900/80 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>BANDWIDTH: OPTIMAL</span>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col justify-center">
        {/* Permission Denied / Hardware Error Banner */}
        {permission === "denied" && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-xl shadow-[0_0_25px_rgba(239,68,68,0.2)]">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage || "HARDWARE_ACCESS_RESTRICTED"}</span>
            </div>
            <button
              onClick={initMedia}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-200 transition-all cursor-pointer font-bold tracking-wider"
            >
              OVERRIDE & RETRY
            </button>
          </div>
        )}

        {/* Video Canvas Viewport Grid */}
        <div className="relative w-full h-[62vh] md:h-[68vh] rounded-2xl bg-zinc-950/90 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)] overflow-hidden backdrop-blur-2xl flex items-center justify-center">
          {/* Cyberpunk HUD Corner Brackets */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-emerald-400 pointer-events-none z-20" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-emerald-400 pointer-events-none z-20" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-emerald-400 pointer-events-none z-20" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-emerald-400 pointer-events-none z-20" />

          {/* 1. Large Main View: Remote Stranger's Stream Placeholder */}
          <div className="w-full h-full relative flex items-center justify-center bg-black/60">
            {isSearching ? (
              <div className="flex flex-col items-center gap-4 text-center px-4">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-ping" />
                  <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center">
                    <Radio className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <p className="text-cyan-400 font-mono text-sm tracking-widest uppercase font-bold">
                    SEARCHING FOR REMOTE NODE...
                  </p>
                  <p className="text-zinc-500 font-mono text-xs mt-1">
                    Matching random peer on encrypted channel
                  </p>
                </div>
              </div>
            ) : strangerConnected ? (
              <div className="w-full h-full relative flex items-center justify-center">
                {/* Remote video element for incoming WebRTC peer streams */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Visual cyber HUD placeholder */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-transparent to-black/40">
                  <div className="p-6 rounded-2xl bg-zinc-950/60 border border-emerald-500/20 backdrop-blur-md flex flex-col items-center text-center max-w-sm mx-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <Terminal className="w-6 h-6" />
                    </div>
                    <span className="font-mono text-sm text-emerald-300 font-bold tracking-wider">
                      STRANGER CONNECTED
                    </span>
                    <span className="font-mono text-xs text-zinc-400 mt-1">
                      WebRTC peer channel secured.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-zinc-500 font-mono text-xs">
                <VideoOff className="w-10 h-10 text-zinc-600" />
                <p>PEER STREAM IDLE</p>
              </div>
            )}

            {/* Remote HUD Watermark */}
            <div className="absolute top-5 left-6 font-mono text-[11px] text-zinc-400 flex items-center gap-2 z-20 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>REMOTE_FEED // STRANGER</span>
            </div>
          </div>

          {/* 1. Smaller PiP (Picture-in-Picture) for Local User Stream */}
          <div className="absolute bottom-5 right-5 z-30 w-36 h-28 sm:w-52 sm:h-36 md:w-64 md:h-44 rounded-xl overflow-hidden bg-black/90 border-2 border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.35)] backdrop-blur-xl group transition-all duration-300">
            {/* Local Video Preview */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!videoEnabled ? "hidden" : ""}`}
            />

            {/* Video Off Fallback */}
            {!videoEnabled && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 font-mono text-[10px] text-zinc-500">
                <VideoOff className="w-6 h-6 mb-1 text-zinc-600" />
                <span>VIDEO MUTED</span>
              </div>
            )}

            {/* PiP HUD Status Bar */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between font-mono text-[9px] text-emerald-300 bg-black/60 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
              <span className="truncate">YOU (LOCAL)</span>
              <span>{!micEnabled ? "MIC:OFF" : "LIVE"}</span>
            </div>
          </div>
        </div>
      </main>

      {/* 2. Glassmorphic Hacker Control Dock */}
      <footer className="relative z-20 w-full max-w-4xl mx-auto px-4 pb-6 pt-2">
        <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950/70 border border-emerald-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(16,185,129,0.15)] flex flex-wrap items-center justify-between gap-3">
          {/* Audio / Video Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mute / Unmute Mic Button */}
            <button
              onClick={toggleMic}
              disabled={permission !== "granted"}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer border ${
                micEnabled
                  ? "bg-zinc-900/90 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-red-950/50 text-red-300 border-red-500/50 hover:bg-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            >
              {micEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
              <span className="hidden sm:inline">{micEnabled ? "MUTE MIC" : "UNMUTE"}</span>
            </button>

            {/* Stop / Start Video Button */}
            <button
              onClick={toggleVideo}
              disabled={permission !== "granted"}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer border ${
                videoEnabled
                  ? "bg-zinc-900/90 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-red-950/50 text-red-300 border-red-500/50 hover:bg-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={videoEnabled ? "Stop Camera Video" : "Start Camera Video"}
            >
              {videoEnabled ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-red-400" />}
              <span className="hidden sm:inline">{videoEnabled ? "STOP VIDEO" : "START VIDEO"}</span>
            </button>
          </div>

          {/* Prominent Next (Skip) Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNext}
              disabled={permission !== "granted" || isSearching}
              className="flex items-center gap-2.5 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-mono text-xs sm:text-sm font-black tracking-wider uppercase transition-all duration-300 cursor-pointer bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>SEARCHING...</span>
                </>
              ) : (
                <>
                  <SkipForward className="w-4 h-4 fill-black text-black" />
                  <span>NEXT (SKIP)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

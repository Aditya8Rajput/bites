"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Peer, MediaConnection } from "peerjs";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  SkipForward,
  ShieldAlert,
  Terminal,
  Radio,
  Wifi,
  RefreshCw,
  Zap,
  PhoneOff,
  CheckCircle2,
  Camera,
} from "lucide-react";

export type ConnectionStatus =
  | "Initializing Camera..."
  | "Searching for Stranger..."
  | "Connected"
  | "Stranger Disconnected"
  | "Permission Denied"
  | "Hardware Error";

interface CyberVideoChatProps {
  onLeave?: () => void;
}

export default function CyberVideoChat({ onLeave }: CyberVideoChatProps) {
  // 1. Hydration safety
  const [mounted, setMounted] = useState(false);

  // Status & error states
  const [status, setStatus] = useState<ConnectionStatus>("Initializing Camera...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);

  // Media streams in state to ensure React triggers <video> binding
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Controls state
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Video element and connection references
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentCallRef = useRef<MediaConnection | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMatchingRef = useRef<boolean>(false);

  // Hydration safety: ensure component mounts on client before browser APIs
  useEffect(() => {
    setMounted(true);
  }, []);

  // Guarantee local video stream attachment
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (videoEl && localStream) {
      videoEl.srcObject = localStream;
      videoEl.onloadedmetadata = () => {
        videoEl.play().catch((err) => {
          console.warn("Local video play was prevented:", err);
        });
      };
    }
  }, [localStream]);

  // Guarantee remote video stream attachment
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl && remoteStream) {
      videoEl.srcObject = remoteStream;
      videoEl.onloadedmetadata = () => {
        videoEl.play().catch((err) => {
          console.warn("Remote video play was prevented:", err);
        });
      };
    } else if (videoEl && !remoteStream) {
      videoEl.srcObject = null;
    }
  }, [remoteStream]);

  // Cleanup active remote call & video stream
  const closeCurrentCall = useCallback(() => {
    if (currentCallRef.current) {
      try {
        currentCallRef.current.close();
      } catch (e) {
        console.warn("Error closing media connection:", e);
      }
      currentCallRef.current = null;
    }
    setRemoteStream(null);
    setConnectedPeerId(null);
  }, []);

  // Handle peer disconnection
  const handleStrangerDisconnected = useCallback(() => {
    closeCurrentCall();
    setStatus("Stranger Disconnected");
    isMatchingRef.current = false;
  }, [closeCurrentCall]);

  // Stop polling interval
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Wire event handlers to a MediaConnection
  const setupCallListeners = useCallback(
    (call: MediaConnection, remoteId: string) => {
      stopPolling();
      currentCallRef.current = call;
      setConnectedPeerId(remoteId);

      call.on("stream", (stream: MediaStream) => {
        setRemoteStream(stream);
        setStatus("Connected");
        isMatchingRef.current = false;
      });

      call.on("close", () => {
        handleStrangerDisconnected();
      });

      call.on("error", (err) => {
        console.warn("PeerJS call error:", err);
        handleStrangerDisconnected();
      });
    },
    [handleStrangerDisconnected, stopPolling]
  );

  // 1. CAMERA & MICROPHONE INITIALIZATION
  // Runs strictly inside useEffect after hydration
  const initMedia = useCallback(async () => {
    setStatus("Initializing Camera...");
    setErrorMessage(null);

    if (typeof window === "undefined") return null;

    // Check secure context (WebRTC requires HTTPS or localhost)
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      setStatus("Hardware Error");
      setErrorMessage(
        "INSECURE_CONTEXT: WebRTC media devices require HTTPS or http://localhost. If opening over LAN, please use localhost."
      );
      return null;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatus("Hardware Error");
      setErrorMessage(
        "MEDIA_UNAVAILABLE: Your browser does not support navigator.mediaDevices.getUserMedia."
      );
      return null;
    }

    // Release any previous tracks before re-requesting
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    let stream: MediaStream | null = null;

    try {
      // Primary attempt: Request both camera and audio
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (primaryErr: unknown) {
      const err = primaryErr as { name?: string; message?: string };
      console.warn("Full media request failed, attempting video-only fallback:", err);

      // Fallback attempt: If microphone is missing or errored, try video only
      if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setMicEnabled(false);
        } catch (fallbackErr: unknown) {
          const fbErr = fallbackErr as { name?: string; message?: string };
          err.name = fbErr.name;
          err.message = fbErr.message;
        }
      }

      if (!stream) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setStatus("Permission Denied");
          setErrorMessage(
            "Permission Denied: Camera and Microphone access was blocked. Please click the camera icon in your browser's address bar to allow permissions."
          );
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setStatus("Hardware Error");
          setErrorMessage(
            "Hardware Not Found: No camera or microphone device was detected on your computer."
          );
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          setStatus("Hardware Error");
          setErrorMessage(
            "Device In Use: The camera or microphone is currently reserved by another app or browser tab."
          );
        } else {
          setStatus("Hardware Error");
          setErrorMessage(
            `Hardware Error: ${err.message || "Failed to initialize media stream."}`
          );
        }
        return null;
      }
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setMicEnabled(stream.getAudioTracks().length > 0);
    setVideoEnabled(stream.getVideoTracks().length > 0);
    setStatus("Searching for Stranger...");

    return stream;
  }, []);

  // 2. REAL-TIME 1-ON-1 P2P CONNECTION (PeerJS & Matchmaking)
  const findStranger = useCallback(async () => {
    if (!peerRef.current || !localStreamRef.current || !myPeerId) return;

    isMatchingRef.current = true;
    closeCurrentCall();
    stopPolling();
    setStatus("Searching for Stranger...");

    const localStreamObj = localStreamRef.current;
    const currentId = myPeerId;

    // Strategy A: Local BroadcastChannel (instant matching for tabs on the same computer)
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "WAITING",
        peerId: currentId,
      });
    }

    // Strategy B: Matchmaking API Route (cross-device, cross-network matching)
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: currentId }),
      });

      const data = await res.json();

      if (data.status === "matched" && data.matchPeerId && data.initiator) {
        // We were matched with a waiting peer! Initiate the WebRTC media call
        const call = peerRef.current.call(data.matchPeerId, localStreamObj);
        if (call) {
          setupCallListeners(call, data.matchPeerId);
          return;
        }
      }

      // If waiting in queue, poll the matchmaking endpoint until someone pairs with us
      if (data.status === "waiting") {
        pollingIntervalRef.current = setInterval(async () => {
          if (!peerRef.current || currentCallRef.current) {
            stopPolling();
            return;
          }

          try {
            const pollRes = await fetch(`/api/match?peerId=${encodeURIComponent(currentId)}`);
            const pollData = await pollRes.json();

            if (pollData.status === "matched" && pollData.matchPeerId) {
              stopPolling();
              // The other peer will initiate the call to us, or we initiate if not started yet
              if (!currentCallRef.current) {
                const call = peerRef.current.call(pollData.matchPeerId, localStreamObj);
                if (call) {
                  setupCallListeners(call, pollData.matchPeerId);
                }
              }
            }
          } catch (e) {
            console.warn("Polling matchmaking notice:", e);
          }
        }, 2000);
      }
    } catch (apiErr) {
      console.warn("Matchmaking API notice:", apiErr);
    }
  }, [myPeerId, closeCurrentCall, setupCallListeners, stopPolling]);

  // Leave matchmaking queue on server
  const leaveQueue = useCallback(async () => {
    stopPolling();
    if (myPeerId) {
      try {
        await fetch(`/api/match?peerId=${encodeURIComponent(myPeerId)}`, {
          method: "DELETE",
        });
      } catch (e) {}
    }
  }, [myPeerId, stopPolling]);

  // Setup PeerJS and Media on mount
  useEffect(() => {
    if (!mounted) return;

    let peerInstance: Peer | null = null;
    let channel: BroadcastChannel | null = null;

    const setupP2P = async () => {
      // 1. Initialize local media
      const stream = await initMedia();
      if (!stream) return;

      // 2. Dynamically import PeerJS on client
      const { Peer } = await import("peerjs");

      // Unique ID for this peer
      const randomId = `bites-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

      peerInstance = new Peer(randomId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun.cloudflare.com:3478" },
          ],
        },
      });
      peerRef.current = peerInstance;

      // 3. Setup BroadcastChannel for zero-latency same-computer tab testing
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        channel = new BroadcastChannel("bites_matchmaking");
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          const msg = event.data;
          if (!msg || !localStreamRef.current || !peerRef.current) return;

          // Received WAITING from another tab
          if (msg.type === "WAITING" && msg.peerId !== peerRef.current.id && !currentCallRef.current) {
            const call = peerRef.current.call(msg.peerId, localStreamRef.current);
            if (call) {
              setupCallListeners(call, msg.peerId);
              channel?.postMessage({
                type: "MATCH_CONFIRMED",
                callerId: peerRef.current.id,
                targetId: msg.peerId,
              });
            }
          }

          if (msg.type === "MATCH_CONFIRMED" && msg.targetId === peerRef.current.id) {
            isMatchingRef.current = false;
            stopPolling();
          }
        };
      }

      // Peer connected to signaling server
      peerInstance.on("open", (id: string) => {
        setMyPeerId(id);
      });

      // Answering incoming media call
      peerInstance.on("call", (incomingCall: MediaConnection) => {
        if (!localStreamRef.current) return;
        incomingCall.answer(localStreamRef.current);
        setupCallListeners(incomingCall, incomingCall.peer);
      });

      // Peer error handling
      peerInstance.on("error", (err) => {
        console.warn("PeerJS error:", err);
      });
    };

    setupP2P();

    // Cleanup on unmount
    return () => {
      stopPolling();
      // Stop all camera and mic hardware tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      // Close active media call
      if (currentCallRef.current) {
        try {
          currentCallRef.current.close();
        } catch (e) {}
        currentCallRef.current = null;
      }
      // Close BroadcastChannel
      if (channel) {
        channel.close();
      }
      // Leave server matchmaking queue
      leaveQueue();
      // Destroy Peer instance
      if (peerInstance) {
        peerInstance.destroy();
        peerRef.current = null;
      }
    };
  }, [mounted, initMedia, setupCallListeners, leaveQueue, stopPolling]);

  // Once peer ID is registered and local stream exists, automatically start matchmaking
  useEffect(() => {
    if (myPeerId && localStreamRef.current) {
      findStranger();
    }
  }, [myPeerId, findStranger]);

  // 3. CONTROLS: Toggle Microphone Audio Track
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !micEnabled;
    });
    setMicEnabled((prev) => !prev);
  };

  // 3. CONTROLS: Toggle Camera Video Track
  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !videoEnabled;
    });
    setVideoEnabled((prev) => !prev);
  };

  // 3. CONTROLS: Next / Skip Button
  const handleNext = () => {
    closeCurrentCall();
    findStranger();
  };

  // Hydration fallback
  if (!mounted) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4 text-emerald-400">
          <Terminal className="w-8 h-8 animate-pulse text-emerald-400" />
          <p className="text-xs uppercase tracking-[0.3em] animate-pulse">
            INITIALIZING_CYBER_P2P_SUBSYSTEM...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] text-zinc-100 font-sans overflow-hidden flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Ambience & Cyber Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[160px]" />
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
                BITES<span className="text-emerald-400">.CYBER</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 uppercase tracking-widest">
                PeerJS P2P
              </span>
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border backdrop-blur-md shadow-md transition-all ${
              status === "Connected"
                ? "bg-emerald-950/60 border-emerald-400/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                : status === "Searching for Stranger..."
                ? "bg-cyan-950/60 border-cyan-400/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                : status === "Stranger Disconnected"
                ? "bg-amber-950/60 border-amber-400/60 text-amber-300"
                : "bg-red-950/60 border-red-500/50 text-red-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === "Connected"
                  ? "bg-emerald-400 animate-pulse"
                  : status === "Searching for Stranger..."
                  ? "bg-cyan-400 animate-ping"
                  : status === "Stranger Disconnected"
                  ? "bg-amber-400"
                  : "bg-red-500"
              }`}
            />
            <span className="font-bold tracking-wide">{status}</span>
          </div>

          {onLeave && (
            <button
              onClick={onLeave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-all text-xs cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5 text-red-400" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col justify-center">
        {/* Permission Denied / Hardware Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-200 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-xl shadow-[0_0_25px_rgba(239,68,68,0.25)]">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={initMedia}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-200 transition-all cursor-pointer font-bold tracking-wider"
            >
              RETRY CAMERA PERMISSION
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

          {/* 1. Large Main View: Remote Stranger's Video Canvas */}
          <div className="w-full h-full relative flex items-center justify-center bg-black">
            {/* Real Remote Video Element - ALWAYS kept in DOM to allow continuous audio/video decode */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                status === "Connected" && remoteStream ? "opacity-100" : "opacity-0 absolute"
              }`}
            />

            {/* Overlays when not connected */}
            {status === "Searching for Stranger..." && (
              <div className="flex flex-col items-center gap-4 text-center px-4">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-ping" />
                  <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center">
                    <Radio className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <p className="text-cyan-400 font-mono text-sm tracking-widest uppercase font-bold">
                    SEARCHING FOR STRANGER...
                  </p>
                  <p className="text-zinc-500 font-mono text-xs mt-1">
                    Matching random peer on encrypted WebRTC channel
                  </p>
                </div>
              </div>
            )}

            {status === "Stranger Disconnected" && (
              <div className="flex flex-col items-center gap-3 text-center px-4 font-mono">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <VideoOff className="w-7 h-7" />
                </div>
                <p className="text-amber-300 font-bold text-sm tracking-wide">
                  STRANGER DISCONNECTED
                </p>
                <p className="text-zinc-500 text-xs max-w-xs">
                  The peer has disconnected. Click &quot;NEXT (SKIP)&quot; to match with a new stranger.
                </p>
                <button
                  onClick={handleNext}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  FIND NEXT STRANGER
                </button>
              </div>
            )}

            {status === "Initializing Camera..." && (
              <div className="flex flex-col items-center gap-3 text-zinc-400 font-mono text-xs">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                <p>INITIALIZING CAMERA & MIC HARDWARE...</p>
              </div>
            )}

            {status === "Permission Denied" && (
              <div className="flex flex-col items-center gap-3 text-center px-4 font-mono max-w-md">
                <Camera className="w-12 h-12 text-red-400" />
                <p className="text-red-300 font-bold text-sm">CAMERA PERMISSION REQUIRED</p>
                <p className="text-zinc-400 text-xs">
                  Please click the lock or camera icon in your browser URL bar to grant camera and microphone access.
                </p>
                <button
                  onClick={initMedia}
                  className="mt-2 px-5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                >
                  ENABLE CAMERA NOW
                </button>
              </div>
            )}

            {/* Remote Feed HUD Watermark */}
            <div className="absolute top-5 left-6 font-mono text-[11px] text-zinc-400 flex items-center gap-2 z-20 pointer-events-none">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === "Connected" ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                }`}
              />
              <span>
                REMOTE_FEED //{" "}
                {connectedPeerId ? `PEER:${connectedPeerId.slice(-6)}` : "STRANGER"}
              </span>
            </div>
          </div>

          {/* 1. Smaller PiP (Picture-in-Picture) for Local User Stream */}
          <div className="absolute bottom-5 right-5 z-30 w-36 h-28 sm:w-52 sm:h-36 md:w-64 md:h-44 rounded-xl overflow-hidden bg-black/90 border-2 border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.35)] backdrop-blur-xl group transition-all duration-300">
            {/* Local Video Stream Element */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                !videoEnabled ? "hidden" : "block"
              }`}
            />

            {/* Video Paused / Camera Off Placeholder */}
            {!videoEnabled && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 font-mono text-[10px] text-zinc-500">
                <VideoOff className="w-6 h-6 mb-1 text-zinc-600" />
                <span>VIDEO MUTED</span>
              </div>
            )}

            {/* PiP HUD Status Bar */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between font-mono text-[9px] text-emerald-300 bg-black/70 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
              <span className="truncate">YOU (LOCAL)</span>
              <span>{!micEnabled ? "MIC:OFF" : "LIVE"}</span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Glassmorphic Hacker Control Dock */}
      <footer className="relative z-20 w-full max-w-4xl mx-auto px-4 pb-6 pt-2">
        <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950/70 border border-emerald-500/30 backdrop-blur-2xl shadow-[0_0_35px_rgba(16,185,129,0.15)] flex flex-wrap items-center justify-between gap-3">
          {/* Audio / Video Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mute / Unmute Mic Button */}
            <button
              onClick={toggleMic}
              disabled={!localStream}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer border ${
                micEnabled
                  ? "bg-zinc-900/90 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-red-950/50 text-red-300 border-red-500/50 hover:bg-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            >
              {micEnabled ? (
                <Mic className="w-4 h-4 text-emerald-400" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400" />
              )}
              <span className="hidden sm:inline">{micEnabled ? "MUTE MIC" : "UNMUTE"}</span>
            </button>

            {/* Stop / Start Video Button */}
            <button
              onClick={toggleVideo}
              disabled={!localStream}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl font-mono text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer border ${
                videoEnabled
                  ? "bg-zinc-900/90 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-red-950/50 text-red-300 border-red-500/50 hover:bg-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={videoEnabled ? "Stop Video Feed" : "Start Video Feed"}
            >
              {videoEnabled ? (
                <VideoIcon className="w-4 h-4 text-emerald-400" />
              ) : (
                <VideoOff className="w-4 h-4 text-red-400" />
              )}
              <span className="hidden sm:inline">{videoEnabled ? "STOP VIDEO" : "START VIDEO"}</span>
            </button>
          </div>

          {/* Prominent Next (Skip) Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleNext}
              disabled={status === "Searching for Stranger..." || !localStream}
              className="flex items-center gap-2.5 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-mono text-xs sm:text-sm font-black tracking-wider uppercase transition-all duration-300 cursor-pointer bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "Searching for Stranger..." ? (
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

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Peer, MediaConnection } from "peerjs";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  ICE_SERVERS,
  findOrQueueMatch,
  listenForIncomingMatch,
  listenToActiveMatch,
  endMatchSession,
  leaveMatchQueue,
} from "@/lib/matchmaking";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  SkipForward,
  XCircle,
  Flag,
  Heart,
  Loader2,
  AlertTriangle,
  Camera,
  RefreshCw,
  Radio,
  Zap,
} from "lucide-react";

export type ConnectionStatus =
  | "Initializing Camera..."
  | "Looking for a stranger..."
  | "Connected"
  | "Stranger Disconnected"
  | "Permission Denied"
  | "Hardware Error";

interface CyberVideoChatProps {
  onLeave?: () => void;
  user?: User | null;
}

export default function CyberVideoChat({ onLeave, user: propUser }: CyberVideoChatProps) {
  // UI Presentation States ONLY (never store MediaStreams or Peer instances in state)
  const [status, setStatus] = useState<ConnectionStatus>("Initializing Camera...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [reported, setReported] = useState(false);
  const [liked, setLiked] = useState(false);

  // Video Element Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Hardware & Network Objects in Refs (prevents re-render cascades & memory leaks)
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const currentCallRef = useRef<MediaConnection | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const currentMatchIdRef = useRef<string | null>(null);
  const matchListenerUnsubRef = useRef<(() => void) | null>(null);
  const queueListenerUnsubRef = useRef<(() => void) | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMatchmakingActiveRef = useRef(false);

  // Helper: Get active authenticated user UID
  const getUserId = useCallback((): { uid: string; email: string } => {
    const active = propUser || auth.currentUser;
    if (active) {
      return { uid: active.uid, email: active.email || "user@gmail.com" };
    }
    // Fallback guest identifier if accessed directly in local dev
    let guestId = "";
    if (typeof window !== "undefined") {
      guestId = sessionStorage.getItem("bites_guest_uid") || "";
      if (!guestId) {
        guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem("bites_guest_uid", guestId);
      }
    }
    return { uid: guestId || "guest_default", email: "guest@bites.live" };
  }, [propUser]);

  // Clean up any ongoing active WebRTC MediaConnection and clear remote video feed
  const closeCurrentCall = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (matchListenerUnsubRef.current) {
      matchListenerUnsubRef.current();
      matchListenerUnsubRef.current = null;
    }
    if (currentCallRef.current) {
      try {
        currentCallRef.current.close();
      } catch (e) {
        console.warn("Notice closing media connection:", e);
      }
      currentCallRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setConnectedPeerId(null);
    setLiked(false);
    setReported(false);
  }, []);

  // Handle Stranger disconnect (called when peer hangs up, clicks Next, or leaves)
  const handleStrangerDisconnected = useCallback(() => {
    closeCurrentCall();
    setStatus("Stranger Disconnected");
  }, [closeCurrentCall]);

  // Wire incoming/outgoing MediaConnection events
  const attachCallEvents = useCallback(
    (call: MediaConnection, remotePeerId: string, matchId: string) => {
      currentCallRef.current = call;
      setConnectedPeerId(remotePeerId);
      currentMatchIdRef.current = matchId;

      // Listen for remote peer disconnecting in Firestore
      if (matchListenerUnsubRef.current) {
        matchListenerUnsubRef.current();
      }
      matchListenerUnsubRef.current = listenToActiveMatch(matchId, () => {
        handleStrangerDisconnected();
      });

      // Stream event: remote audio & video received
      call.on("stream", (remoteStream: MediaStream) => {
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
        setStatus("Connected");
      });

      call.on("close", () => {
        handleStrangerDisconnected();
      });

      call.on("error", (err) => {
        console.warn("MediaConnection error:", err);
        handleStrangerDisconnected();
      });
    },
    [handleStrangerDisconnected]
  );

  // Execute Matchmaking search via shared atomic Firestore coordinator
  const searchForStranger = useCallback(async () => {
    if (!peerRef.current || !localStreamRef.current || !myPeerIdRef.current) return;
    if (isMatchmakingActiveRef.current) return;

    isMatchmakingActiveRef.current = true;
    closeCurrentCall();
    setStatus("Looking for a stranger...");

    // End previous match session if any
    if (currentMatchIdRef.current) {
      endMatchSession(currentMatchIdRef.current).catch(() => {});
      currentMatchIdRef.current = null;
    }

    const { uid, email } = getUserId();
    const myPeerId = myPeerIdRef.current;
    const localStream = localStreamRef.current;

    try {
      const matchResult = await findOrQueueMatch(uid, myPeerId, email);

      if (matchResult.matched && matchResult.role === "initiator" && matchResult.remotePeerId && matchResult.matchId) {
        // CASE A: Current user is the INITIATOR
        currentMatchIdRef.current = matchResult.matchId;

        // Small delay to ensure receiver's PeerJS is ready to receive incoming offer
        setTimeout(() => {
          if (!peerRef.current || !localStreamRef.current) return;
          const call = peerRef.current.call(matchResult.remotePeerId!, localStream);
          if (call) {
            attachCallEvents(call, matchResult.remotePeerId!, matchResult.matchId!);

            // 8-second safety timeout if peer doesn't respond or ICE fails
            callTimeoutRef.current = setTimeout(() => {
              if (status !== "Connected") {
                console.warn("Call connection timeout, retrying queue...");
                isMatchmakingActiveRef.current = false;
                searchForStranger();
              }
            }, 8000);
          }
        }, 600);

        isMatchmakingActiveRef.current = false;
      } else {
        // CASE B: Current user is WAITING in queue as RECEIVER
        if (queueListenerUnsubRef.current) {
          queueListenerUnsubRef.current();
        }

        queueListenerUnsubRef.current = listenForIncomingMatch(uid, (incomingMatch) => {
          if (incomingMatch.matched && incomingMatch.matchId) {
            currentMatchIdRef.current = incomingMatch.matchId;
            setConnectedPeerId(incomingMatch.remotePeerId);

            // Listen to active match document so if initiator aborts, receiver is notified
            if (matchListenerUnsubRef.current) {
              matchListenerUnsubRef.current();
            }
            matchListenerUnsubRef.current = listenToActiveMatch(incomingMatch.matchId, () => {
              handleStrangerDisconnected();
            });

            // Receiver will answer incoming call on peer.on("call")
            isMatchmakingActiveRef.current = false;
          }
        });

        isMatchmakingActiveRef.current = false;
      }
    } catch (err) {
      console.error("Matchmaking error:", err);
      isMatchmakingActiveRef.current = false;
      setStatus("Stranger Disconnected");
    }
  }, [attachCallEvents, closeCurrentCall, getUserId, handleStrangerDisconnected, status]);

  // SINGLE MOUNT EFFECT: Empty dependency array []
  // Initializes camera/mic and PeerJS once on component mount
  useEffect(() => {
    let localStream: MediaStream | null = null;
    let peerInstance: Peer | null = null;

    const init = async () => {
      // 1. Hardware Camera & Microphone Initialization
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setStatus("Hardware Error");
          setErrorMessage("Your browser does not support WebRTC mediaDevices.");
          return;
        }

        // Try video + audio first, fall back to video-only if no microphone is found
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: true,
          });
        } catch (initialErr: unknown) {
          const err = initialErr as { name?: string };
          if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
            setMicEnabled(false);
          } else {
            throw initialErr;
          }
        }

        localStreamRef.current = localStream;

        // Assign to local video element ref
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(() => {});
        }

        setStatus("Looking for a stranger...");
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        console.error("Camera/Mic initialization error:", err);

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          setStatus("Permission Denied");
          setErrorMessage(
            "Camera and Microphone access was denied. Please allow permissions in your browser URL bar."
          );
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
          setStatus("Hardware Error");
          setErrorMessage("No webcam detected on this device.");
        } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
          setStatus("Hardware Error");
          setErrorMessage("Camera is currently in use by another application or browser tab.");
        } else {
          setStatus("Hardware Error");
          setErrorMessage(error.message || "Failed to access webcam hardware.");
        }
        return;
      }

      // 2. PeerJS P2P Signaling Initialization
      try {
        const { Peer } = await import("peerjs");
        const randomId = `bites-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
        myPeerIdRef.current = randomId;

        peerInstance = new Peer(randomId, {
          debug: 1,
          config: {
            iceServers: ICE_SERVERS,
          },
        });
        peerRef.current = peerInstance;

        // When Peer is connected to signaling server
        peerInstance.on("open", () => {
          searchForStranger();
        });

        // Answer incoming calls automatically with localStreamRef.current
        peerInstance.on("call", (incomingCall: MediaConnection) => {
          if (!localStreamRef.current) return;
          incomingCall.answer(localStreamRef.current);
          attachCallEvents(
            incomingCall,
            incomingCall.peer,
            currentMatchIdRef.current || `match_${incomingCall.peer}`
          );
        });

        peerInstance.on("error", (err) => {
          console.warn("PeerJS subsystem error:", err);
          if (err.type === "peer-unavailable") {
            handleStrangerDisconnected();
          }
        });
      } catch (peerErr) {
        console.error("PeerJS initialization error:", peerErr);
      }
    };

    init();

    // Keydown handler for classic Omegle Esc key behavior
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // CLEANUP ON UNMOUNT: Release all media tracks, queue tickets, and destroy peer
    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      if (queueListenerUnsubRef.current) {
        queueListenerUnsubRef.current();
      }
      if (matchListenerUnsubRef.current) {
        matchListenerUnsubRef.current();
      }

      // Leave queue and end match in Firestore
      const { uid } = getUserId();
      leaveMatchQueue(uid).catch(() => {});
      if (currentMatchIdRef.current) {
        endMatchSession(currentMatchIdRef.current).catch(() => {});
      }

      // Stop all camera and microphone hardware tracks safely
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Close active call
      if (currentCallRef.current) {
        try {
          currentCallRef.current.close();
        } catch (e) {}
        currentCallRef.current = null;
      }

      // Destroy PeerJS instance
      if (peerInstance) {
        peerInstance.destroy();
        peerRef.current = null;
      }
    };
  }, []); // Strictly empty dependency array []

  // CONTROLS: Toggle Microphone via track.enabled
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;
    const nextState = !micEnabled;
    audioTracks.forEach((track) => {
      track.enabled = nextState;
    });
    setMicEnabled(nextState);
  };

  // CONTROLS: Toggle Camera Video via track.enabled
  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;
    const nextState = !videoEnabled;
    videoTracks.forEach((track) => {
      track.enabled = nextState;
    });
    setVideoEnabled(nextState);
  };

  // CONTROLS: Classic Next / Skip Button
  const handleNext = () => {
    setStopConfirm(false);
    isMatchmakingActiveRef.current = false;
    closeCurrentCall();
    searchForStranger();
  };

  // CONTROLS: Stop / Really? Two-step confirmation (classic Omegle style)
  const handleStop = () => {
    if (!stopConfirm) {
      setStopConfirm(true);
    } else {
      // Confirmed exit
      if (onLeave) {
        onLeave();
      } else if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      }
    }
  };

  // CONTROLS: Report Stranger
  const handleReport = () => {
    setReported(true);
    handleNext();
  };

  // CONTROLS: Like stranger
  const handleLike = () => {
    setLiked((prev) => !prev);
  };

  return (
    <div className="relative h-screen w-full bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-zinc-800/80 bg-[#0c0c0c] z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-black text-xl tracking-tight text-white">
            <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            <span>bites<span className="text-emerald-400">.</span></span>
          </div>
          <span className="text-[11px] font-mono tracking-widest uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 hidden sm:inline-block">
            1-on-1 Video
          </span>
        </div>

        {/* Real-time Status Banner */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${
              status === "Connected"
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                : status === "Looking for a stranger..."
                ? "bg-cyan-950/60 border-cyan-500/50 text-cyan-300 animate-pulse"
                : status === "Stranger Disconnected"
                ? "bg-amber-950/60 border-amber-500/50 text-amber-300"
                : "bg-red-950/60 border-red-500/50 text-red-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === "Connected"
                  ? "bg-emerald-400"
                  : status === "Looking for a stranger..."
                  ? "bg-cyan-400 animate-ping"
                  : status === "Stranger Disconnected"
                  ? "bg-amber-400"
                  : "bg-red-500"
              }`}
            />
            <span className="font-semibold">{status}</span>
          </div>
        </div>
      </header>

      {/* Main Split-Screen Video Container */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-2 sm:p-4 flex flex-col justify-center min-h-0">
        {/* Permission / Hardware Error Notice */}
        {errorMessage && (
          <div className="mb-2 p-3 rounded-lg bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-mono flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-red-500/30 hover:bg-red-500/40 rounded border border-red-400/50 text-xs font-bold uppercase cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* CLASSIC OMEGLE 2-PANEL SPLIT SCREEN: Side-by-Side Desktop, Stacked Mobile */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 w-full h-full min-h-0">
          {/* PANEL 1 (PRIMARY): Stranger's Video */}
          <div className="relative w-full h-full rounded-xl bg-black border border-zinc-800 overflow-hidden flex items-center justify-center shadow-lg">
            {/* Header Tag */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/75 border border-zinc-700/80 backdrop-blur-md text-xs font-mono font-bold text-cyan-300 pointer-events-none">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === "Connected" ? "bg-cyan-400" : "bg-zinc-600"
                }`}
              />
              <span>Stranger</span>
            </div>

            {/* Like Badge Indicator */}
            {liked && status === "Connected" && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono animate-bounce">
                <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                <span>Liked</span>
              </div>
            )}

            {/* Remote Video Element */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                status === "Connected" ? "opacity-100" : "opacity-0 absolute"
              }`}
            />

            {/* Placeholder: Looking for a Stranger */}
            {status === "Looking for a stranger..." && (
              <div className="flex flex-col items-center gap-3 text-center px-4 font-mono">
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping" />
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-cyan-300 font-bold text-sm tracking-wide">
                    LOOKING FOR A STRANGER...
                  </p>
                  <p className="text-zinc-500 text-xs">
                    Searching live queue • Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Esc</kbd> to skip
                  </p>
                </div>
              </div>
            )}

            {/* Placeholder: Stranger Disconnected */}
            {status === "Stranger Disconnected" && (
              <div className="flex flex-col items-center gap-3 text-center px-4 font-mono">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <VideoOff className="w-6 h-6" />
                </div>
                <p className="text-amber-300 font-bold text-sm">
                  STRANGER HAS DISCONNECTED
                </p>
                <button
                  onClick={handleNext}
                  className="mt-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold tracking-wider uppercase transition-all cursor-pointer shadow-md"
                >
                  Find Next Stranger (Esc)
                </button>
              </div>
            )}

            {/* Placeholder: Initializing Camera */}
            {status === "Initializing Camera..." && (
              <div className="flex flex-col items-center gap-2 text-zinc-400 font-mono text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <p>Initializing camera and microphone...</p>
              </div>
            )}

            {/* Placeholder: Permission Denied */}
            {status === "Permission Denied" && (
              <div className="flex flex-col items-center gap-2 text-center px-4 font-mono">
                <Camera className="w-8 h-8 text-red-400" />
                <p className="text-red-300 font-bold text-xs">Camera Access Denied</p>
                <p className="text-zinc-500 text-[11px] max-w-xs">
                  Please enable camera permission in your browser to start video chatting.
                </p>
              </div>
            )}
          </div>

          {/* PANEL 2: You (Local Camera Feed) */}
          <div className="relative w-full h-full rounded-xl bg-black border border-zinc-800 overflow-hidden flex items-center justify-center shadow-lg">
            {/* Header Tag */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/75 border border-zinc-700/80 backdrop-blur-md text-xs font-mono font-bold text-emerald-300 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>You</span>
            </div>

            {/* Muted/Off Status Indicator */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 font-mono text-[11px] pointer-events-none">
              {!micEnabled && (
                <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/40">
                  MUTED
                </span>
              )}
              {!videoEnabled && (
                <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/40">
                  CAM OFF
                </span>
              )}
            </div>

            {/* Local Video Element (mirrored) */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${
                !videoEnabled ? "hidden" : "block"
              }`}
            />

            {/* Camera Muted Placeholder */}
            {!videoEnabled && (
              <div className="flex flex-col items-center gap-2 text-zinc-500 font-mono text-xs">
                <VideoOff className="w-8 h-8 text-zinc-600" />
                <span>YOUR CAMERA IS PAUSED</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Classic Omegle Bottom Control Dock */}
      <footer className="h-20 px-4 sm:px-6 bg-[#0c0c0c] border-t border-zinc-800 flex items-center justify-between gap-2 sm:gap-4 z-30">
        {/* Left Section: Stop / Really? */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStop}
            className={`px-4 sm:px-6 py-2.5 rounded-lg font-mono text-xs sm:text-sm font-bold tracking-wider uppercase transition-all cursor-pointer border ${
              stopConfirm
                ? "bg-red-600 text-white border-red-500 animate-pulse"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
            }`}
          >
            {stopConfirm ? "Really? (Exit)" : "Stop"}
          </button>

          {stopConfirm && (
            <button
              onClick={() => setStopConfirm(false)}
              className="px-3 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs font-mono"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Center Section: Prominent NEXT (ESC) Button */}
        <div className="flex-1 flex justify-center max-w-sm mx-2">
          <button
            onClick={handleNext}
            className="w-full py-2.5 sm:py-3 px-6 rounded-lg font-mono text-xs sm:text-sm font-black tracking-wider uppercase transition-all duration-150 cursor-pointer bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            {status === "Looking for a stranger..." ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Skip (Esc)</span>
              </>
            ) : (
              <>
                <SkipForward className="w-4 h-4 fill-black text-black" />
                <span>Next Stranger (Esc)</span>
              </>
            )}
          </button>
        </div>

        {/* Right Section: Media Toggles & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Like Button */}
          {status === "Connected" && (
            <button
              onClick={handleLike}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                liked
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : "bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-rose-300"
              }`}
              title="Like Stranger"
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-rose-400 text-rose-400" : ""}`} />
            </button>
          )}

          {/* Report Button */}
          {status === "Connected" && (
            <button
              onClick={handleReport}
              disabled={reported}
              className="p-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 border border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
              title="Report & Skip"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}

          {/* Mic Toggle */}
          <button
            onClick={toggleMic}
            className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
              micEnabled
                ? "bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border-zinc-700"
                : "bg-red-950 text-red-400 border-red-500/50"
            }`}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={toggleVideo}
            className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
              videoEnabled
                ? "bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border-zinc-700"
                : "bg-red-950 text-red-400 border-red-500/50"
            }`}
            title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}
          >
            {videoEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
}

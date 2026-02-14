"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import YouTube, { YouTubeProps, YouTubeEvent } from "react-youtube";
import {
  Music, Play, Pause, SkipForward, Square, Plus,
  Trash2, ListMusic, X, Info, Loader2, ChevronDown,
  ChevronUp, Volume2,
} from "lucide-react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Song {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  addedBy: string;
  addedByName: string;
}

interface RoomMusicPlayerProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────

/** Extract YouTube video ID from various URL formats */
function extractVideoId(input: string): string | null {
  // Already a video ID (11 chars, alphanumeric + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
    return input.trim();
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/** Format seconds to mm:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
//  RoomMusicPlayer Component
// ═══════════════════════════════════════════════════════════════

export default function RoomMusicPlayer({ roomId, isOpen, onClose }: RoomMusicPlayerProps) {
  const { socket } = useSocket();
  const { user } = useAuth();

  // ─── Queue & playback state ──────────────────────────────────
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);

  // ─── Refs ────────────────────────────────────────────────────
  const playerRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRespondedToStateRef = useRef(false);

  // ─── YouTube player opts ─────────────────────────────────────
  const playerOpts: YouTubeProps["opts"] = {
    height: "0",
    width: "0",
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    },
  };

  // ─── Time tracking ──────────────────────────────────────────
  const startTimeTracker = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (playerRef.current) {
        const ct = playerRef.current.getCurrentTime?.() ?? 0;
        const dur = playerRef.current.getDuration?.() ?? 0;
        setCurrentTime(ct);
        setDuration(dur);
      }
    }, 1000);
  }, []);

  const stopTimeTracker = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { stopTimeTracker(); };
  }, [stopTimeTracker]);

  // ─── Volume sync ────────────────────────────────────────────
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setVolume?.(volume);
    }
  }, [volume]);

  // ═══════════════════════════════════════════════════════════════
  //  Socket listeners for music sync
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!socket) return;

    const onAddToQueue = (data: { song: Song }) => {
      setQueue((prev) => [...prev, data.song]);
    };

    const onPlay = (data: { index?: number }) => {
      const idx = data.index ?? 0;
      setCurrentIndex(idx);
      setIsPlaying(true);
    };

    const onPause = () => {
      setIsPlaying(false);
      if (playerRef.current) {
        playerRef.current.pauseVideo?.();
      }
      stopTimeTracker();
    };

    const onResume = () => {
      setIsPlaying(true);
      if (playerRef.current) {
        playerRef.current.playVideo?.();
      }
      startTimeTracker();
    };

    const onSkip = () => {
      setCurrentIndex((prev) => {
        setQueue((q) => {
          const nextIdx = prev + 1;
          if (nextIdx < q.length) {
            setIsPlaying(true);
            return q;
          } else {
            // No more songs — stop
            setIsPlaying(false);
            stopTimeTracker();
            return q;
          }
        });
        return prev + 1;
      });
    };

    const onStop = () => {
      setIsPlaying(false);
      setCurrentIndex(-1);
      setCurrentTime(0);
      setDuration(0);
      if (playerRef.current) {
        playerRef.current.stopVideo?.();
      }
      stopTimeTracker();
    };

    const onRemoveFromQueue = (data: { index: number }) => {
      setQueue((prev) => {
        const next = prev.filter((_, i) => i !== data.index);
        return next;
      });
      setCurrentIndex((prev) => {
        if (data.index < prev) return prev - 1;
        if (data.index === prev) {
          // Currently playing song removed — stop
          setIsPlaying(false);
          stopTimeTracker();
          return -1;
        }
        return prev;
      });
    };

    const onClearQueue = () => {
      setQueue([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      if (playerRef.current) {
        playerRef.current.stopVideo?.();
      }
      stopTimeTracker();
    };

    // When another user joins, they request the current state
    const onStateRequest = (data: { requesterId: string }) => {
      // Only the first person in the room responds (avoid duplicates)
      if (hasRespondedToStateRef.current) return;
      hasRespondedToStateRef.current = true;
      setTimeout(() => { hasRespondedToStateRef.current = false; }, 2000);

      const state = {
        queue,
        currentIndex,
        isPlaying,
        currentTime: playerRef.current?.getCurrentTime?.() ?? 0,
      };
      socket.emit("music-state-response", {
        roomId,
        requesterId: data.requesterId,
        state,
      });
    };

    // When we receive state sync (we just joined)
    const onStateSync = (data: { state: any }) => {
      const { state } = data;
      if (state.queue?.length > 0) {
        setQueue(state.queue);
        setCurrentIndex(state.currentIndex);
        setIsPlaying(state.isPlaying);
      }
    };

    socket.on("music-add-to-queue", onAddToQueue);
    socket.on("music-play", onPlay);
    socket.on("music-pause", onPause);
    socket.on("music-resume", onResume);
    socket.on("music-skip", onSkip);
    socket.on("music-stop", onStop);
    socket.on("music-remove-from-queue", onRemoveFromQueue);
    socket.on("music-clear-queue", onClearQueue);
    socket.on("music-state-request", onStateRequest);
    socket.on("music-state-sync", onStateSync);

    // Request current state when joining
    socket.emit("music-request-state", { roomId });

    return () => {
      socket.off("music-add-to-queue", onAddToQueue);
      socket.off("music-play", onPlay);
      socket.off("music-pause", onPause);
      socket.off("music-resume", onResume);
      socket.off("music-skip", onSkip);
      socket.off("music-stop", onStop);
      socket.off("music-remove-from-queue", onRemoveFromQueue);
      socket.off("music-clear-queue", onClearQueue);
      socket.off("music-state-request", onStateRequest);
      socket.off("music-state-sync", onStateSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId]);

  // ═══════════════════════════════════════════════════════════════
  //  Actions (emit socket events)
  // ═══════════════════════════════════════════════════════════════

  const addToQueue = async () => {
    if (!linkInput.trim() || !socket || !user) return;

    const videoId = extractVideoId(linkInput.trim());
    if (!videoId) {
      toast.error("Invalid YouTube link. Please paste a valid YouTube URL.");
      return;
    }

    setIsAdding(true);

    // Fetch video info using YouTube's oembed API (no API key needed)
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl);
      if (!res.ok) throw new Error("Video not found");
      const data = await res.json();

      const song: Song = {
        videoId,
        title: data.title || "Unknown Title",
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: "", // We'll get this when the player loads
        addedBy: user._id,
        addedByName: user.name,
      };

      socket.emit("music-add-to-queue", { roomId, song });
      setLinkInput("");
      toast.success(`Added "${song.title}" to queue`);
    } catch {
      toast.error("Could not fetch video info. Please check the link.");
    } finally {
      setIsAdding(false);
    }
  };

  const handlePlay = () => {
    if (!socket) return;
    if (queue.length === 0) {
      toast.error("Queue is empty. Add a song first!");
      return;
    }
    if (isPlaying) {
      // Pause
      socket.emit("music-pause", { roomId });
    } else if (currentIndex >= 0) {
      // Resume
      socket.emit("music-resume", { roomId });
    } else {
      // Start from beginning
      socket.emit("music-play", { roomId, index: 0 });
    }
  };

  const handleSkip = () => {
    if (!socket || currentIndex < 0) return;
    socket.emit("music-skip", { roomId });
  };

  const handleStop = () => {
    if (!socket) return;
    socket.emit("music-stop", { roomId });
  };

  const handleRemove = (index: number) => {
    if (!socket) return;
    socket.emit("music-remove-from-queue", { roomId, index });
  };

  const handleClearQueue = () => {
    if (!socket) return;
    socket.emit("music-clear-queue", { roomId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addToQueue();
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //  YouTube Player Event Handlers
  // ═══════════════════════════════════════════════════════════════

  const onPlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    event.target.setVolume(volume);
  };

  const onPlayerPlay = () => {
    startTimeTracker();
  };

  const onPlayerPause = () => {
    stopTimeTracker();
  };

  const onPlayerEnd = () => {
    stopTimeTracker();
    // Auto-play next song
    if (currentIndex + 1 < queue.length) {
      if (socket) {
        socket.emit("music-skip", { roomId });
      }
    } else {
      // Queue finished
      setIsPlaying(false);
      setCurrentIndex(-1);
      setCurrentTime(0);
      setDuration(0);
    }
  };

  const onPlayerError = () => {
    toast.error("Failed to play this video. Skipping...");
    // Auto-skip on error
    if (currentIndex + 1 < queue.length) {
      if (socket) {
        socket.emit("music-skip", { roomId });
      }
    } else {
      setIsPlaying(false);
    }
  };

  // ─── Current song ───────────────────────────────────────────
  const currentSong = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/50 z-50 flex flex-col shadow-2xl"
        >
          {/* ─── Header ─── */}
          <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Music className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Music Bot</h2>
                <p className="text-xs text-zinc-500">
                  {queue.length} song{queue.length !== 1 ? "s" : ""} in queue
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ─── Now Playing ─── */}
          {currentSong && (
            <div className="p-5 border-b border-zinc-800/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                  <img
                    src={currentSong.thumbnail}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex items-center gap-0.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-1 bg-emerald-400 rounded-full animate-music-bar"
                            style={{ animationDelay: `${i * 0.15}s`, height: "16px" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">{currentSong.title}</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Added by {currentSong.addedByName}</p>
                </div>
              </div>

              {/* ─── Progress Bar ─── */}
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
                </div>
              </div>

              {/* ─── Playback Controls ─── */}
              <div className="flex items-center justify-center gap-3 mt-3">
                <button
                  onClick={handlePlay}
                  className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={currentIndex + 1 >= queue.length}
                  className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={handleStop}
                  className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2 ml-3 pl-3 border-l border-zinc-800">
                  <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 h-1 accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── Add Song Input ─── */}
          <div className="p-5 border-b border-zinc-800/50">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-3.5 h-3.5 text-zinc-500" />
              <p className="text-[11px] text-zinc-500">
                Paste a YouTube video URL to add it to the queue
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
              />
              <button
                onClick={addToQueue}
                disabled={isAdding || !linkInput.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Quick play if queue has songs but nothing playing */}
            {queue.length > 0 && currentIndex < 0 && (
              <button
                onClick={() => socket?.emit("music-play", { roomId, index: 0 })}
                className="mt-3 w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2 border border-emerald-500/20 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Play Queue
              </button>
            )}
          </div>

          {/* ─── Queue ─── */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <button
              onClick={() => setShowQueue(!showQueue)}
              className="flex items-center justify-between px-5 py-3 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4" />
                <span className="text-sm font-medium">Queue ({queue.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearQueue();
                    }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                {showQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            <AnimatePresence>
              {showQueue && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3"
                >
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                      <Music className="w-10 h-10 mb-3 opacity-50" />
                      <p className="text-sm font-medium">No songs in queue</p>
                      <p className="text-xs mt-1">Paste a YouTube link above to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {queue.map((song, index) => (
                        <motion.div
                          key={`${song.videoId}-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50 }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl transition-all group ${
                            index === currentIndex
                              ? "bg-emerald-500/10 border border-emerald-500/20"
                              : "bg-zinc-900/40 border border-transparent hover:bg-zinc-800/60 hover:border-zinc-700/50"
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                            <img
                              src={song.thumbnail}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                            {index === currentIndex && isPlaying && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <div className="flex items-center gap-px">
                                  {[0, 1, 2].map((i) => (
                                    <div
                                      key={i}
                                      className="w-0.5 bg-emerald-400 rounded-full animate-music-bar"
                                      style={{ animationDelay: `${i * 0.15}s`, height: "10px" }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${
                              index === currentIndex ? "text-emerald-300" : "text-white"
                            }`}>
                              {song.title}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {song.addedByName}
                            </p>
                          </div>

                          {/* Queue position / actions */}
                          <div className="flex items-center gap-1">
                            {index !== currentIndex && (
                              <button
                                onClick={() => {
                                  if (socket) socket.emit("music-play", { roomId, index });
                                }}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-zinc-800 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
                                title="Play this song"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemove(index)}
                              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                              title="Remove from queue"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] text-zinc-600 font-mono w-5 text-center">
                              #{index + 1}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Hidden YouTube Player ─── */}
          <div className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {currentSong && isPlaying && (
              <YouTube
                videoId={currentSong.videoId}
                opts={playerOpts}
                onReady={onPlayerReady}
                onPlay={onPlayerPlay}
                onPause={onPlayerPause}
                onEnd={onPlayerEnd}
                onError={onPlayerError}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

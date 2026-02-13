"use client";
import { useState } from "react";
import { Shield, CheckCircle2 } from "lucide-react";

export default function TermsModal() {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    // ── THIS IS THE TRICK ──
    // The "I Agree" click is a trusted user gesture, so we use it
    // to unlock audio playback for the entire page session.
    try {
      const ctx = new AudioContext();
      // Create a tiny silent buffer and play it — fully unlocks audio
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ctx.resume().then(() => {
        console.log("🔓 Audio unlocked via Terms acceptance");
        // Keep context alive briefly then close
        setTimeout(() => ctx.close(), 500);
      });
    } catch (e) {
      console.warn("Audio unlock failed:", e);
    }

    // Also pre-warm any Audio elements by playing+pausing a silent one
    try {
      const silentAudio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      silentAudio.volume = 0;
      silentAudio.play().then(() => {
        silentAudio.pause();
        console.log("🔓 HTML Audio element unlocked via Terms acceptance");
      }).catch(() => {});
    } catch (e) {
      // ignore
    }

    setAccepted(true);
  };

  if (accepted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <Shield className="text-emerald-400" size={32} />
          </div>
          <h2 className="text-2xl font-light text-white tracking-tight">Community Guidelines</h2>
          <p className="text-zinc-500 text-sm mt-1">Please review before continuing</p>
        </div>

        {/* Terms Content */}
        <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-5 mb-6 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p><span className="text-white font-medium">Respect & Privacy</span> — Treat every member with respect. Do not record, screenshot, or share private conversations without explicit consent.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p><span className="text-white font-medium">No Harassment</span> — Harassment, hate speech, or discriminatory behavior of any kind will result in immediate removal from the community.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p><span className="text-white font-medium">Authentic Connections</span> — This is a space for genuine conversations. Spam, solicitation, or promotional content is not permitted.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p><span className="text-white font-medium">Audio & Microphone</span> — By agreeing, you allow CALLU to access your microphone during calls and enable audio notifications for incoming calls.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <p><span className="text-white font-medium">Community Standards</span> — CALLU reserves the right to remove any member who violates these guidelines or disrupts the community experience.</p>
            </div>
          </div>
        </div>

        {/* Agree Button */}
        <button
          onClick={handleAccept}
          className="w-full bg-white text-black hover:bg-zinc-200 py-4 rounded-2xl font-medium text-base tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-white/5"
        >
          I Agree — Enter Community
        </button>

        <p className="text-center text-zinc-600 text-xs mt-4">
          By clicking above, you agree to our community guidelines and terms of service.
        </p>
      </div>
    </div>
  );
}

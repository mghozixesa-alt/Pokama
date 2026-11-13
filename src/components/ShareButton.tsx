"use client";
import { useState } from "react";
import { Icon } from "./Icons";

/** Bagikan tautan unit: pakai share bawaan HP bila ada, kalau tidak buka WhatsApp / salin tautan. */
export function ShareButton({ title, text, path, className = "" }: { title: string; text: string; path: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${location.origin}${path}`;
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch { /* dibatalkan */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
    }
  }
  return (
    <button onClick={share} aria-label="Bagikan" className={`w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center text-brand-navy relative ${className}`}>
      <Icon.Share size={18} />
      {copied && <span className="absolute -bottom-7 right-0 whitespace-nowrap text-[10px] font-semibold bg-brand-navy text-white px-2 py-1 rounded-md">Tautan disalin</span>}
    </button>
  );
}

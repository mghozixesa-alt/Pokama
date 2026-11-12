"use client";
import { useState } from "react";
import { Icon } from "./Icons";

export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}
      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-white border border-line text-[11px] font-bold text-brand-navy"
    >
      <Icon.Copy size={13} />{ok ? "Tersalin" : label}
    </button>
  );
}

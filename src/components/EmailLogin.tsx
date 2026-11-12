"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Login tanpa password: tautan masuk dikirim ke email (berguna sebelum Google OAuth disetel). */
export function EmailLogin({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  if (sent) return <p className="text-sm text-teal-dark">Tautan masuk dikirim ke <b>{email}</b>. Buka email itu di HP ini, lalu ketuk tautannya.</p>;
  return (
    <form onSubmit={send} className="flex flex-col gap-2">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="input" />
      {err && <p className="text-xs text-[#c0392b]">{err}</p>}
      <button disabled={busy} className="btn-outline w-full">{busy ? "Mengirim…" : "Kirim tautan masuk ke email"}</button>
    </form>
  );
}

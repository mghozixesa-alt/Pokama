"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Login email: kata sandi (akun yang dibuat admin/Supabase) atau tautan masuk ke email. */
export function EmailLogin({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sandi" | "tautan">("sandi");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    if (mode === "sandi") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { setErr(error.message === "Invalid login credentials" ? "Email atau kata sandi salah." : error.message); return; }
      router.replace(next || "/");
      router.refresh();
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  if (sent) return <p className="text-sm text-teal-dark">Tautan masuk dikirim ke <b>{email}</b>. Buka email itu di HP ini, lalu ketuk tautannya.</p>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" className="input" />
      {mode === "sandi" && <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata sandi" className="input" />}
      {err && <p className="text-xs text-[#c0392b]">{err}</p>}
      <button disabled={busy} className={mode === "sandi" ? "btn-primary w-full" : "btn-outline w-full"}>{busy ? "Memproses…" : mode === "sandi" ? "Masuk" : "Kirim tautan masuk ke email"}</button>
      <button type="button" onClick={() => { setMode(mode === "sandi" ? "tautan" : "sandi"); setErr(null); }} className="text-[12px] font-semibold text-brand mt-1">
        {mode === "sandi" ? "Tidak punya kata sandi? Kirim tautan ke email" : "Punya kata sandi? Masuk dengan kata sandi"}
      </button>
    </form>
  );
}

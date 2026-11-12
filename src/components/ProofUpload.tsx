"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icons";
import { notifyProofReceived } from "@/app/actions/notify";

export function ProofUpload({ orderId, paymentId }: { orderId: string; paymentId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [sender, setSender] = useState("");
  const [bank, setBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    if (!file) { setErr("Pilih foto/screenshot bukti transfer."); return; }
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${user!.id}/${orderId}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: upErr } = await supabase.storage.from("proofs").upload(path, file, { upsert: false });
    if (upErr) { setErr(upErr.message); setBusy(false); return; }
    const { error } = await supabase.from("payments").update({ proof_url: path, sender_name: sender || null, bank_name: bank || null, rejected_reason: null }).eq("id", paymentId);
    if (error) { setErr(error.message); setBusy(false); return; }
    await supabase.from("orders").update({ status: "menunggu_konfirmasi" }).eq("id", orderId);
    try { await notifyProofReceived(orderId); } catch {}
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-bold text-brand-navy">Kirim bukti transfer</h4>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Nama pengirim</label><input value={sender} onChange={(e) => setSender(e.target.value)} className="input" placeholder="Sesuai rekening" /></div>
        <div><label className="label">Bank pengirim</label><input value={bank} onChange={(e) => setBank(e.target.value)} className="input" placeholder="BCA / Mandiri / …" /></div>
      </div>
      <label className="flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-dashed border-line bg-white text-sm font-bold text-brand cursor-pointer">
        <Icon.Upload />{file ? file.name : "Pilih foto / screenshot"}
        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {err && <p className="text-xs text-[#c0392b]">{err}</p>}
      <button onClick={submit} disabled={busy} className="btn-primary w-full">{busy ? "Mengunggah…" : "Kirim bukti"}</button>
    </div>
  );
}

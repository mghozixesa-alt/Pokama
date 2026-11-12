"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";
import { notifyNewOffer } from "@/app/actions/notify";

const MIN_PCT = 0.85;

export function OfferForm({ unitId, publicId, price, loggedIn, disabled }: { unitId: string; publicId: string; price: number; loggedIn: boolean; disabled: boolean }) {
  const [amount, setAmount] = useState(Math.round((price * 0.92) / 10000) * 10000);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const min = Math.ceil((price * MIN_PCT) / 10000) * 10000;

  if (disabled) return null;

  function submit() {
    setErr(null);
    if (amount < min) { setErr(`Tawaran minimal ${rupiah(min)} (85% harga).`); return; }
    start(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr("Masuk dulu untuk mengirim tawaran."); return; }
      const { data: ins, error } = await supabase.from("offers").insert({ unit_id: unitId, customer_id: user.id, amount }).select("id").single();
      if (!error && ins) { try { await notifyNewOffer(ins.id); } catch {} }
      if (error) setErr(error.message); else setDone(`Tawaran ${rupiah(amount)} terkirim. Admin menjawab maksimal 24 jam lewat WhatsApp dan halaman Pesanan.`);
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-navy">Tawar harga</h3>
        <span className="text-[10px] font-bold text-teal-dark bg-teal-light px-2 py-0.5 rounded-md">Tanpa DP</span>
      </div>
      {done ? (
        <p className="text-sm text-teal-dark mt-3">{done} <Link href="/pesanan" className="font-bold underline">Lihat</Link></p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setAmount((a) => Math.max(min, a - 50000))} className="w-10 h-10 rounded-xl bg-page font-bold text-brand-navy">−</button>
            <div className="flex-1 h-12 rounded-xl border border-line flex items-center justify-center text-lg font-bold text-brand-navy">{rupiah(amount)}</div>
            <button onClick={() => setAmount((a) => Math.min(price, a + 50000))} className="w-10 h-10 rounded-xl bg-page font-bold text-brand-navy">+</button>
          </div>
          <input type="range" min={min} max={price} step={10000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full mt-3 accent-brand" aria-label="Nominal tawaran" />
          <div className="flex justify-between text-[10px] text-muted"><span>Min {rupiah(min)}</span><span>Harga {rupiah(price)}</span></div>
          {err && <p className="text-xs text-[#c0392b] mt-2">{err}</p>}
          {loggedIn ? (
            <button onClick={submit} disabled={pending} className="btn-outline w-full mt-3">{pending ? "Mengirim…" : "Kirim tawaran"}</button>
          ) : (
            <Link href={`/masuk?next=/unit/${publicId}%23tawar`} className="btn-outline w-full mt-3">Masuk untuk menawar</Link>
          )}
          <p className="text-[10px] text-muted mt-2">Tawaran yang disetujui dikunci 24 jam; booking dengan harga itu lewat halaman Pesanan.</p>
        </>
      )}
    </div>
  );
}

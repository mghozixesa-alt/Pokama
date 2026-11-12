"use client";
import { useMemo, useState, useEffect, useDeferredValue } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { UnitCardRow } from "@/components/UnitCard";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Unit } from "@/lib/types";

export type Filters = { q: string; kategori: string; merek: string; grade: string; maks: string; urut: string };

const CATS: { label: string; params: Partial<Filters> }[] = [
  { label: "Semua", params: {} },
  { label: "HP", params: { kategori: "hp" } },
  { label: "Laptop", params: { kategori: "laptop" } },
  { label: "Kamera", params: { kategori: "kamera" } },
  { label: "Tablet", params: { kategori: "tablet" } },
  { label: "Konsol", params: { kategori: "konsol" } },
  { label: "< Rp 5 jt", params: { maks: "5000000" } },
  { label: "Grade A", params: { grade: "A" } },
];
const SORTS: [string, string][] = [["baru", "Terbaru"], ["murah", "Termurah"], ["mahal", "Termahal"]];

export function KatalogClient({ units, initial }: { units: Unit[]; initial: Partial<Filters> }) {
  const [f, setF] = useState<Filters>({ q: "", kategori: "", merek: "", grade: "", maks: "", urut: "baru", ...initial });
  const q = useDeferredValue(f.q);

  // Sinkronkan URL tanpa reload supaya bisa dibagikan / tombol kembali tetap benar.
  useEffect(() => {
    const s = new URLSearchParams();
    (Object.keys(f) as (keyof Filters)[]).forEach((k) => { const v = f[k]; if (v && !(k === "urut" && v === "baru")) s.set(k, v); });
    const url = s.toString() ? `/katalog?${s}` : "/katalog";
    if (url !== location.pathname + location.search) history.replaceState(null, "", url);
  }, [f]);

  const brands = useMemo(() => {
    const count = new Map<string, number>();
    units.filter((u) => !f.kategori || u.category === f.kategori).forEach((u) => count.set(u.brand, (count.get(u.brand) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([b]) => b);
  }, [units, f.kategori]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = units.filter((u) =>
      (!f.kategori || u.category === f.kategori) &&
      (!f.merek || u.brand.toLowerCase() === f.merek.toLowerCase()) &&
      (!f.grade || u.grade === f.grade) &&
      (!f.maks || u.price_sell <= Number(f.maks)) &&
      (!needle || `${u.brand} ${u.model} ${u.variant ?? ""} ${JSON.stringify(u.specs ?? {})}`.toLowerCase().includes(needle)),
    );
    if (f.urut === "murah") out.sort((a, b) => a.price_sell - b.price_sell);
    else if (f.urut === "mahal") out.sort((a, b) => b.price_sell - a.price_sell);
    return out;
  }, [units, f.kategori, f.merek, f.grade, f.maks, f.urut, q]);

  const catActive = (p: Partial<Filters>) =>
    Object.keys(p).length === 0 ? !f.kategori && !f.grade && !f.maks : Object.entries(p).every(([k, v]) => f[k as keyof Filters] === v);
  const hasFilter = !!(f.q || f.kategori || f.merek || f.grade || f.maks);
  const reset = () => setF({ q: "", kategori: "", merek: "", grade: "", maks: "", urut: "baru" });

  return (
    <>
      <div className="bg-brand-navy text-white px-4 pt-5 pb-4 rounded-b-[24px]">
        <div className="flex items-center justify-between h-9">
          <h1 className="text-[22px] font-bold">Katalog</h1>
          {hasFilter && <button onClick={reset} className="h-8 px-3 rounded-full bg-white/15 text-xs font-semibold">Reset</button>}
        </div>
        <div className="mt-3 bg-white rounded-xl h-12 flex items-center gap-3 px-4 text-ink">
          <Icon.Search size={18} stroke="#8a93a6" />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Cari merek, model, atau spesifikasi" className="flex-1 bg-transparent text-sm outline-none min-w-0" />
          {f.q && <button aria-label="Hapus" onClick={() => setF({ ...f, q: "" })} className="text-muted text-lg leading-none">×</button>}
        </div>
        <div className="flex gap-2 mt-3 -mx-4 px-4 overflow-x-auto no-scrollbar">
          {CATS.map((c) => {
            const on = catActive(c.params);
            return (
              <button key={c.label} onClick={() => setF({ ...f, kategori: "", grade: "", maks: "", merek: "", ...c.params })} className={`shrink-0 h-9 px-3.5 rounded-full text-[12px] font-semibold transition-colors ${on ? "bg-white text-brand-navy" : "bg-white/15 text-white"}`}>{c.label}</button>
            );
          })}
        </div>
      </div>

      {brands.length > 1 && (
        <div className="flex gap-2 mt-3 px-4 overflow-x-auto no-scrollbar">
          <span className="shrink-0 h-8 flex items-center text-[11px] font-semibold text-muted">Merek</span>
          {brands.map((b) => {
            const on = f.merek.toLowerCase() === b.toLowerCase();
            return (
              <button key={b} onClick={() => setF({ ...f, merek: on ? "" : b })} className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold border transition-colors ${on ? "bg-brand text-white border-brand" : "bg-white text-ink border-line"}`}>{b}</button>
            );
          })}
        </div>
      )}

      <div className="px-4 mt-4 flex items-center justify-between text-[12px]">
        <p className="text-muted"><b className="font-bold text-brand-navy">{list.length} unit</b> · semua dicek</p>
        <div className="flex items-center gap-1">
          {SORTS.map(([v, l]) => (
            <button key={v} onClick={() => setF({ ...f, urut: v })} className={`px-2 h-7 rounded-md text-[11px] font-semibold transition-colors ${f.urut === v ? "bg-brand-light text-brand-dark" : "text-muted"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3 flex flex-col gap-2.5">
        {list.map((u) => <UnitCardRow key={u.id} u={u} />)}
        {!list.length && (
          <div className="card p-6 text-center text-sm text-muted">
            Tidak ada unit yang cocok. <Link href="/pantau-harga" className="text-brand font-semibold">Pantau harga</Link> supaya dikabari saat {f.kategori ? CATEGORY_LABEL[f.kategori as Category] : "unit"} masuk.
          </div>
        )}
      </div>
    </>
  );
}

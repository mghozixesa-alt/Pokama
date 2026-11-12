"use client";
import { useState } from "react";
import Link from "next/link";
import type { Grade } from "@/lib/types";
import { rupiah, rupiahShort, GRADE_LABEL } from "@/lib/format";
import { priceForGrade } from "@/lib/pricing";

const DESC: Record<Grade, string> = {
  A: "Seperti baru, tanpa goresan terlihat",
  B: "Lecet halus bekas pakai, fungsi 100%",
  C: "Ada minus kosmetik, dijelaskan di sertifikat",
};

export function GradePicker({ basePrice, available, publicId, variant }: { basePrice: number; available: Grade; publicId: string; variant: string | null }) {
  const [g, setG] = useState<Grade>(available);
  // harga grade A model ini, diturunkan dari harga unit yang tersedia
  const basePriceA = available === "A" ? basePrice : Math.round(basePrice / (available === "B" ? 0.9 : 0.78));
  const shown = priceForGrade(basePriceA, g);
  const isThis = g === available;

  return (
    <details className="card mt-3 group">
      <summary className="list-none cursor-pointer p-4 flex items-center justify-between">
        <span><span className="text-sm font-semibold text-brand-navy">Harga grade lain</span><span className="block text-[11px] text-muted">Unit ini grade {available} · lihat A/B/C</span></span>
        <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="px-4 pb-4">
      <div className="grid grid-cols-3 gap-2">
        {(["A", "B", "C"] as Grade[]).map((k) => {
          const on = k === g;
          return (
            <button key={k} onClick={() => setG(k)} aria-pressed={on} className={`rounded-xl border-2 p-2.5 text-left ${on ? "border-brand bg-brand-light" : "border-line bg-white"}`}>
              <p className="text-sm font-semibold text-brand-navy">Grade {k}</p>
              <p className="text-[10px] text-muted leading-3 mt-0.5">{GRADE_LABEL[k].split(" · ")[1]}</p>
              <p className="text-xs font-semibold mt-1.5 whitespace-nowrap">{rupiahShort(priceForGrade(basePriceA, k))}</p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted mt-3">{DESC[g]}{variant ? ` · ${variant}` : ""}</p>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-muted">Harga unit ini</p>
          <p className="text-2xl font-bold text-brand-navy">{rupiah(isThis ? basePrice : shown)}</p>
        </div>
        {!isThis && <p className="text-[11px] text-[#7a4a00] bg-[#fdf1dc] px-2 py-1 rounded-lg max-w-[160px]">Grade {g} belum tersedia — <Link href={`/pantau-harga?unit=${publicId}&grade=${g}`} className="font-semibold underline">pantau</Link></p>}
      </div>
      </div>
    </details>
  );
}

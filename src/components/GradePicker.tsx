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
    <div className="card p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-brand-navy">Pilih grade</h3>
        <span className="text-[11px] text-muted">Harga mengikuti grade</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["A", "B", "C"] as Grade[]).map((k) => {
          const on = k === g;
          return (
            <button key={k} onClick={() => setG(k)} aria-pressed={on} className={`rounded-xl border-2 p-2.5 text-left ${on ? "border-brand bg-brand-light" : "border-line bg-white"}`}>
              <p className="text-sm font-bold text-brand-navy">Grade {k}</p>
              <p className="text-[10px] text-muted leading-3 mt-0.5">{GRADE_LABEL[k].split(" · ")[1]}</p>
              <p className="text-xs font-bold mt-1.5 whitespace-nowrap">{rupiahShort(priceForGrade(basePriceA, k))}</p>
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
        {!isThis && <p className="text-[11px] text-[#7a4a00] bg-[#fdf1dc] px-2 py-1 rounded-lg max-w-[160px]">Unit ini grade {available}. Grade {g} belum tersedia — <Link href={`/pantau-harga?unit=${publicId}&grade=${g}`} className="font-bold underline">pantau</Link></p>}
      </div>
    </div>
  );
}

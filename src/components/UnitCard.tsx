import Link from "next/link";
import Image from "next/image";
import type { Unit } from "@/lib/types";
import { rupiahShort, savePct, BRANCH_LABEL } from "@/lib/format";
import { GradeBadge } from "./GradeBadge";
import { CategoryIcon } from "./Icons";

export function unitTitle(u: Unit) {
  const withCap = ["hp", "tablet", "konsol"].includes(u.category) && u.variant;
  return withCap ? `${u.model} ${u.variant!.split(" · ")[0]}` : `${u.brand} ${u.model}`;
}

export function unitMeta(u: Unit): string {
  const s = u.specs ?? {};
  const parts: string[] = [];
  if (s.battery_health) parts.push(`Baterai ${s.battery_health}%`);
  if (s.shutter_count) parts.push(`SC ${Math.round(Number(s.shutter_count) / 1000)} rb`);
  if (s.kelengkapan) parts.push(String(s.kelengkapan));
  if (s.stik) parts.push(`${s.stik} stik`);
  return parts.slice(0, 2).join(" · ");
}

export function unitSub(u: Unit): string {
  return (["hp", "tablet", "konsol"].includes(u.category) ? u.variant?.split(" · ").slice(1).join(" · ") : u.variant) || BRANCH_LABEL[u.branch];
}

/** Foto unit; placeholder seragam (latar putih + ikon kategori) kalau belum ada foto. */
export function Photo({ u, sizes = "(max-width: 480px) 50vw, 240px" }: { u: Unit; sizes?: string }) {
  const src = u.photos?.[0];
  if (!src) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white text-[#b3bccb]">
        <CategoryIcon category={u.category} size={28} stroke="#b3bccb" />
        <span className="text-[9px] font-semibold">Foto menyusul</span>
      </div>
    );
  }
  return <Image src={src} alt={unitTitle(u)} fill sizes={sizes} className="object-cover" />;
}

/** Gaya A — kartu grid (Beranda). Seluruh kartu adalah tautan; CTA ada di halaman unit. */
export function UnitCardGrid({ u }: { u: Unit }) {
  const save = savePct(u.price_new, u.price_sell);
  return (
    <Link href={`/unit/${u.public_id}`} className="card overflow-hidden flex flex-col active:scale-[0.99] transition">
      <div className="relative aspect-square bg-white m-1.5 mb-0 rounded-xl overflow-hidden">
        <Photo u={u} />
        <GradeBadge grade={u.grade} className="absolute top-2 left-2" />
        {u.is_hot && u.hot_label && (
          <span className="absolute top-2 right-2 px-2 h-5 inline-flex items-center rounded-md bg-[#e5636b] text-white text-[9px] font-bold">{u.hot_label}</span>
        )}
      </div>
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1">
        <span className="text-[13px] font-semibold leading-[17px] h-[34px] overflow-hidden">{unitTitle(u)}</span>
        <span className="text-[11px] text-muted truncate">{unitMeta(u) || unitSub(u)}</span>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-[15px] font-bold text-brand-navy">{rupiahShort(u.price_sell)}</span>
          {save && <span className="text-[10px] font-semibold text-brand">{save}</span>}
        </div>
      </div>
    </Link>
  );
}

/** Gaya C — baris horizontal (Katalog). */
export function UnitCardRow({ u }: { u: Unit }) {
  const save = savePct(u.price_new, u.price_sell);
  return (
    <Link href={`/unit/${u.public_id}`} className="card p-2.5 flex gap-3 active:scale-[0.99] transition">
      <div className="relative shrink-0 w-[92px] h-[92px] rounded-xl overflow-hidden bg-white border border-page">
        <Photo u={u} sizes="92px" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2"><GradeBadge grade={u.grade} /><span className="text-[11px] text-muted truncate">{unitMeta(u)}</span></div>
        <span className="text-[14px] font-semibold leading-[18px] mt-1 truncate">{unitTitle(u)}</span>
        <span className="text-[11px] text-muted leading-[15px] truncate">{unitSub(u)}</span>
        <div className="flex items-end justify-between gap-2 mt-auto pt-1.5">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[16px] font-bold text-brand-navy whitespace-nowrap">{rupiahShort(u.price_sell)}</span>
              {u.price_new && <span className="text-[10px] text-[#9aa4b5] line-through whitespace-nowrap">{rupiahShort(u.price_new)}</span>}
              {save && <span className="text-[10px] font-semibold text-brand">{save}</span>}
            </div>
            <div className="text-[10px] text-muted">Garansi {u.grade === "C" ? "7" : "30"} hari · {BRANCH_LABEL[u.branch]}</div>
          </div>
          <span className="shrink-0 h-8 px-3 inline-flex items-center rounded-lg bg-brand-light text-brand-dark text-[11px] font-semibold">Lihat</span>
        </div>
      </div>
    </Link>
  );
}

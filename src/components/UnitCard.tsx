import Link from "next/link";
import Image from "next/image";
import type { Unit } from "@/lib/types";
import { rupiahShort, savePct, BRANCH_LABEL } from "@/lib/format";
import { GradeBadge } from "./GradeBadge";
import { Icon } from "./Icons";

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

function Photo({ u, className }: { u: Unit; className?: string }) {
  const src = u.photos?.[0];
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-page text-muted text-xs ${className}`}>Belum ada foto</div>
    );
  }
  return <Image src={src} alt={unitTitle(u)} fill sizes="(max-width: 480px) 50vw, 240px" className="object-contain p-2" />;
}

/** Gaya A — kartu grid (Beranda, "Dilihat juga"). */
export function UnitCardGrid({ u }: { u: Unit }) {
  const save = savePct(u.price_new, u.price_sell);
  return (
    <div className="card overflow-hidden flex flex-col">
      <Link href={`/unit/${u.public_id}`} className="block">
        <div className="relative aspect-square bg-white border-b border-page">
          <Photo u={u} className="absolute inset-0" />
          <GradeBadge grade={u.grade} className="absolute top-2 left-2" />
          {u.is_hot && u.hot_label && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#e5636b] text-white text-[9px] font-extrabold">{u.hot_label}</span>
          )}
        </div>
        <div className="px-3 pt-2.5 pb-2 flex flex-col gap-0.5">
          <span className="text-xs font-semibold leading-4 h-8 overflow-hidden">{unitTitle(u)}</span>
          <span className="text-[10px] text-muted">{unitMeta(u)}</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-base font-extrabold text-brand-navy">{rupiahShort(u.price_sell)}</span>
            {save && <span className="text-[10px] font-extrabold text-teal-dark">{save}</span>}
          </div>
          {u.price_new && <span className="text-[10px] text-[#8a93a6] line-through">Baru {rupiahShort(u.price_new)}</span>}
        </div>
      </Link>
      <div className="flex gap-1.5 px-3 pb-3">
        <Link href={`/unit/${u.public_id}#tawar`} className="btn-soft flex-1">Tawar</Link>
        <button aria-label="Simpan" className="w-9 h-9 rounded-xl bg-page flex items-center justify-center text-brand-navy"><Icon.Heart size={16} /></button>
      </div>
    </div>
  );
}

/** Gaya C — baris horizontal (Katalog). */
export function UnitCardRow({ u }: { u: Unit }) {
  const save = savePct(u.price_new, u.price_sell);
  return (
    <div className="bg-white rounded-2xl p-2.5 flex gap-3 shadow-[0_4px_14px_rgba(16,54,92,0.06)]">
      <Link href={`/unit/${u.public_id}`} className="relative shrink-0 w-[88px] h-[88px] rounded-xl overflow-hidden bg-page">
        <Photo u={u} className="absolute inset-0" />
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <Link href={`/unit/${u.public_id}`} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5"><GradeBadge grade={u.grade} /><span className="text-[10px] text-muted truncate">{unitMeta(u)}</span></div>
          <span className="text-[13px] font-bold leading-[17px] truncate">{unitTitle(u)}</span>
          <span className="text-[11px] text-muted leading-[15px] truncate">{["hp", "tablet", "konsol"].includes(u.category) ? u.variant?.split(" · ").slice(1).join(" · ") || BRANCH_LABEL[u.branch] : u.variant}</span>
        </Link>
        <div className="flex items-end justify-between gap-2 mt-0.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-base font-extrabold text-brand-navy whitespace-nowrap">{rupiahShort(u.price_sell)}</span>
              {u.price_new && <span className="text-[10px] text-[#8a93a6] line-through whitespace-nowrap">{rupiahShort(u.price_new)}</span>}
              {save && <span className="text-[10px] font-extrabold text-teal-dark">{save}</span>}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted"><Icon.Shield size={11} stroke="#0e8f85" />Garansi {u.grade === "C" ? "7" : "30"} hr · {BRANCH_LABEL[u.branch]}</div>
          </div>
          <Link href={`/unit/${u.public_id}#tawar`} className="shrink-0 px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-extrabold">Tawar</Link>
        </div>
      </div>
    </div>
  );
}

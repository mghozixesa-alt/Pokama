import Link from "next/link";
import Image from "next/image";
import type { Unit } from "@/lib/types";
import { rupiahShort, savePct, BRANCH_LABEL } from "@/lib/format";
import { GradeBadge } from "./GradeBadge";
import { Icon } from "./Icons";

export function unitTitle(u: Unit) {
  return `${u.model}${u.variant ? " " + u.variant.split(" · ")[0] : ""}`;
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
    <div className="card p-2.5 flex gap-3">
      <Link href={`/unit/${u.public_id}`} className="relative shrink-0 w-[84px] h-[84px] rounded-xl overflow-hidden bg-white border border-[#eef1f6]">
        <Photo u={u} className="absolute inset-0" />
      </Link>
      <Link href={`/unit/${u.public_id}`} className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5"><GradeBadge grade={u.grade} /><span className="text-[10px] text-muted">{unitMeta(u)}</span></div>
        <span className="text-[13px] font-bold leading-[17px]">{unitTitle(u)}</span>
        <span className="text-[11px] text-muted leading-[15px] truncate">{u.variant}</span>
        <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
          <span className="text-base font-extrabold text-brand-navy whitespace-nowrap">{rupiahShort(u.price_sell)}</span>
          {u.price_new && <span className="text-[10px] text-[#8a93a6] line-through whitespace-nowrap">{rupiahShort(u.price_new)}</span>}
          {save && <span className="text-[10px] font-extrabold text-teal-dark">{save}</span>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted"><Icon.Shield size={11} stroke="#0e8f85" />Garansi {u.grade === "C" ? "7" : "30"} hr · {BRANCH_LABEL[u.branch]}</div>
      </Link>
      <div className="flex flex-col justify-between items-end shrink-0">
        <button aria-label="Simpan" className="w-[30px] h-[30px] rounded-full border border-line bg-white flex items-center justify-center text-brand-navy"><Icon.Heart size={14} /></button>
        <Link href={`/unit/${u.public_id}#tawar`} className="px-3 py-1.5 rounded-lg bg-brand-light text-brand-dark text-[11px] font-extrabold">Tawar</Link>
      </div>
    </div>
  );
}

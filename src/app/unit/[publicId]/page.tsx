import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { GradeBadge, CheckedBadge } from "@/components/GradeBadge";
import { GradePicker } from "@/components/GradePicker";
import { OfferForm } from "@/components/OfferForm";
import { UnitCardGrid, unitTitle } from "@/components/UnitCard";
import { Icon } from "@/components/Icons";
import { rupiah, savePct, SOURCE_LABEL, BRANCH_LABEL, CATEGORY_LABEL, tanggal, waLink } from "@/lib/format";
import type { Inspection, Unit } from "@/lib/types";

export const dynamic = "force-dynamic";

const SPEC_LABEL: Record<string, string> = {
  storage: "Penyimpanan", battery_health: "Kesehatan baterai", color: "Warna", kelengkapan: "Kelengkapan", cpu: "Prosesor",
  ram: "RAM", layar: "Layar", shutter_count: "Shutter count", megapixel: "Resolusi", lensa: "Lensa", stik: "Stik",
};

export default async function UnitPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const supabase = await createClient();
  const { data: unit } = await supabase.from("units").select("*").eq("public_id", publicId).maybeSingle();
  if (!unit) notFound();
  const u = unit as Unit;

  const [{ data: insp }, { data: related }, { data: auth }] = await Promise.all([
    supabase.from("inspections").select("*").eq("unit_id", u.id).order("inspected_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("units").select("*").eq("status", "tersedia").eq("category", u.category).neq("id", u.id).limit(4),
    supabase.auth.getUser(),
  ]);
  const inspection = insp as Inspection | null;
  const save = savePct(u.price_new, u.price_sell);
  const sold = u.status !== "tersedia";
  const specs = Object.entries(u.specs ?? {}).filter(([, v]) => v != null && v !== "");

  return (
    <Shell withNav={false}>
      <TopBar title={u.public_id} back="/katalog" right={<button aria-label="Simpan" className="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center text-brand-navy"><Icon.Heart /></button>} />

      {/* Foto */}
      <div className="mx-4 card overflow-hidden">
        <div className="relative aspect-square bg-white">
          {u.photos?.[0] ? <Image src={u.photos[0]} alt={unitTitle(u)} fill sizes="480px" className="object-contain p-6" priority /> : <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">Belum ada foto</div>}
          {inspection && <CheckedBadge className="absolute top-3 left-3" />}
          {u.is_hot && u.hot_label && <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-[#e5636b] text-white text-[10px] font-extrabold">{u.hot_label}</span>}
        </div>
        {u.photos.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
            {u.photos.map((p, i) => <span key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-line shrink-0"><Image src={p} alt="" fill className="object-cover" /></span>)}
          </div>
        )}
      </div>

      {/* Judul & harga */}
      <div className="px-4 mt-4">
        <div className="flex items-center gap-2"><GradeBadge grade={u.grade} /><span className="text-[11px] text-muted">{CATEGORY_LABEL[u.category]} · {BRANCH_LABEL[u.branch]}</span></div>
        <h1 className="text-xl font-extrabold text-ink mt-1">{u.brand} {u.model}</h1>
        <p className="text-sm text-muted">{u.variant}</p>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-[26px] font-extrabold text-brand-navy">{rupiah(u.price_sell)}</span>
          {save && <span className="text-xs font-extrabold text-teal-dark bg-teal-light px-2 py-0.5 rounded-md">{save}</span>}
        </div>
        {u.price_new && <p className="text-xs text-[#8a93a6]">Harga baru <span className="line-through">{rupiah(u.price_new)}</span></p>}
      </div>

      <div className="px-4">
        {u.grade && <GradePicker basePrice={u.price_sell} available={u.grade} publicId={u.public_id} variant={u.variant} />}
      </div>

      {/* Sertifikat ringkas */}
      {inspection && (
        <Link href={`/cek/${inspection.qr_token}`} className="mx-4 mt-3 card p-4 flex items-center gap-3 block">
          <span className="w-11 h-11 rounded-xl bg-brand-navy flex items-center justify-center"><Icon.Shield size={22} stroke="#20B4A9" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-brand-navy">Sertifikat cek 8 langkah</p>
            <p className="text-[11px] text-muted truncate">{inspection.certificate_no} · dicek {tanggal(inspection.inspected_at)} · {inspection.checklist.filter((c) => c.status === "lolos").length}/8 lolos</p>
            <p className="text-[11px] text-muted">Sumber unit: <b className="text-ink">{SOURCE_LABEL[u.source]}</b></p>
          </div>
          <Icon.ChevronRight stroke="#8a93a6" />
        </Link>
      )}

      {/* Spesifikasi */}
      {specs.length > 0 && (
        <div className="mx-4 mt-3 card p-4">
          <h3 className="text-sm font-extrabold text-brand-navy mb-2">Spesifikasi</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {specs.map(([k, v]) => (
              <div key={k}><dt className="text-[10px] text-muted">{SPEC_LABEL[k] ?? k}</dt><dd className="text-sm font-semibold">{k === "battery_health" ? `${v}%` : k === "megapixel" ? `${v} MP` : String(v)}</dd></div>
            ))}
          </dl>
          {u.condition_note && <p className="text-xs text-muted mt-3 border-t border-page pt-3">Catatan teknisi: {u.condition_note}</p>}
        </div>
      )}

      {/* Jaminan */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
        {[["Garansi", u.grade === "C" ? "7 hari" : "30 hari"], ["Ambil di", BRANCH_LABEL[u.branch]], ["Bisa tawar", "tanpa DP"]].map(([a, b]) => (
          <div key={a} className="card p-3"><p className="text-[10px] text-muted">{a}</p><p className="text-sm font-extrabold text-brand-navy">{b}</p></div>
        ))}
      </div>

      {/* Tawar */}
      <div id="tawar" className="px-4 mt-3">
        <OfferForm unitId={u.id} publicId={u.public_id} price={u.price_sell} loggedIn={!!auth.user} disabled={sold} />
      </div>

      {related && related.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="text-base font-extrabold text-brand-navy mb-3">Dilihat juga</h2>
          <div className="grid grid-cols-2 gap-3">{(related as Unit[]).map((r) => <UnitCardGrid key={r.id} u={r} />)}</div>
        </section>
      )}

      {/* CTA bawah */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-line p-4 flex gap-2 z-30">
        <a href={waLink(`Halo Niagaaja, saya mau tanya unit ${u.public_id} ${u.brand} ${u.model}`)} className="btn-outline w-12 px-0" aria-label="Tanya via WhatsApp"><Icon.Chat /></a>
        {sold ? (
          <span className="btn-primary flex-1 opacity-60">Sudah {u.status === "dipesan" ? "dipesan" : "terjual"}</span>
        ) : (
          <Link href={`/booking/${u.public_id}`} className="btn-primary flex-1">Booking sekarang · {rupiah(u.price_sell)}</Link>
        )}
      </div>
      <div className="h-20" />
    </Shell>
  );
}

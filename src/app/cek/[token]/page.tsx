import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { Icon } from "@/components/Icons";
import { GradeBadge } from "@/components/GradeBadge";
import { SOURCE_LABEL, tanggal, GRADE_LABEL } from "@/lib/format";
import type { Inspection, Unit } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sertifikat cek" };

const STATUS_STYLE = { lolos: "bg-teal-light text-teal-dark", minus: "bg-[#fdf1dc] text-[#7a4a00]", gagal: "bg-[#fde8e8] text-[#a12d2d]" };
const STATUS_LABEL = { lolos: "Lolos", minus: "Ada minus", gagal: "Gagal" };

export default async function CekPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("inspections").select("*, units(*)").eq("qr_token", token).maybeSingle();
  if (!data) notFound();
  const insp = data as Inspection & { units: Unit };
  const u = insp.units;
  const lolos = insp.checklist.filter((c) => c.status === "lolos").length;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${site}/cek/${token}`)}`;

  return (
    <Shell withNav={false}>
      <TopBar title="Sertifikat cek" back={`/unit/${u.public_id}`} />
      <div className="mx-4 rounded-2xl bg-brand-navy text-white p-5 relative overflow-hidden">
        <div className="flex items-center gap-2"><Icon.Shield size={20} stroke="#20B4A9" /><span className="text-[10px] font-bold tracking-widest uppercase opacity-80">Niagaaja Certified</span></div>
        <h1 className="text-xl font-extrabold mt-2">{u.brand} {u.model}</h1>
        <p className="text-xs opacity-80">{u.variant} · {u.public_id}</p>
        <div className="flex items-end justify-between mt-4">
          <div>
            <p className="text-[10px] opacity-70">Hasil</p>
            <p className="text-3xl font-extrabold">Grade {insp.result_grade}</p>
            <p className="text-[11px] opacity-80">{GRADE_LABEL[insp.result_grade].split(" · ")[1]} · {lolos}/8 lolos</p>
          </div>
          <div className="bg-white p-1.5 rounded-xl"><Image src={qr} alt="QR sertifikat" width={80} height={80} unoptimized /></div>
        </div>
        <p className="text-[10px] opacity-70 mt-3">No. {insp.certificate_no} · dicek {tanggal(insp.inspected_at)}</p>
      </div>

      <div className="mx-4 mt-3 card p-4">
        <h3 className="text-sm font-extrabold text-brand-navy mb-3">8 langkah pemeriksaan</h3>
        <ol className="flex flex-col gap-2">
          {insp.checklist.map((c) => (
            <li key={c.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-page text-[11px] font-extrabold text-brand-navy flex items-center justify-center shrink-0">{c.step}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{c.label}</p>
                {c.note && <p className="text-[11px] text-muted">{c.note}</p>}
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mx-4 mt-3 card p-4">
        <h3 className="text-sm font-extrabold text-brand-navy">Sumber unit</h3>
        <p className="text-sm mt-1">{SOURCE_LABEL[u.source]}</p>
        {u.source === "eks_sewa_rentalaja" && (
          <p className="text-[11px] text-muted mt-1">Unit ini pernah disewakan lewat Rentalaja (ID {u.rentalaja_asset_id ?? "—"}). Riwayat pemakaian dan servisnya tercatat, dan unit lolos QC ulang sebelum dijual. Kami sengaja menuliskannya supaya Anda tahu persis apa yang dibeli.</p>
        )}
        <div className="flex items-center gap-2 mt-3"><GradeBadge grade={u.grade} /><span className="text-[11px] text-muted">Garansi {u.grade === "C" ? "7" : "30"} hari setelah serah terima</span></div>
      </div>

      <div className="px-4 mt-4">
        <Link href={`/unit/${u.public_id}`} className="btn-primary w-full">Lihat unit</Link>
      </div>
    </Shell>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { rupiahShort } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Label unit" };

/** Label tempel 60×40 mm: QR ke halaman sertifikat, kode unit, grade, harga. Cetak via browser (stiker/label printer). */
export default async function LabelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> }) {
  const { id } = await params;
  const { n } = await searchParams;
  const supabase = await createClient();
  const [{ data: u }, { data: insp }] = await Promise.all([
    supabase.from("units").select("id, public_id, brand, model, variant, grade, price_sell, specs").eq("id", id).maybeSingle(),
    supabase.from("inspections").select("qr_token, certificate_no").eq("unit_id", id).order("inspected_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!u) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app";
  const url = insp?.qr_token ? `${site}/cek/${insp.qr_token}` : `${site}/unit/${u.public_id}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(url)}`;
  const copies = Math.min(12, Math.max(1, Number(n) || 1));
  const spec = (u.specs ?? {}) as Record<string, string | number>;
  const line2 = [u.variant, spec.storage, spec.ram ? `RAM ${spec.ram}` : null].filter(Boolean).join(" · ");

  return (
    <div>
      <style>{`@media print { .no-print { display:none !important } @page { margin: 6mm } .sheet { gap: 4mm } }`}</style>
      <div className="no-print flex items-center justify-between gap-3 mb-4">
        <div><h1 className="text-[18px] font-bold text-brand-navy">Label {u.public_id}</h1><p className="text-[11px] text-muted">60 × 40 mm · QR mengarah ke {insp ? `sertifikat ${insp.certificate_no}` : "halaman unit (belum ada sertifikat)"} · cetak {copies} lembar (ubah lewat ?n=4)</p></div>
        <PrintButton label="Cetak label" />
      </div>
      <div className="sheet flex flex-wrap gap-3">
        {[...Array(copies)].map((_, i) => (
          <div key={i} className="w-[60mm] h-[40mm] bg-white border border-line print:border-dashed rounded-md p-[3mm] flex gap-[3mm] items-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR sertifikat" className="w-[30mm] h-[30mm] shrink-0" />
            <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
              <p className="text-[8pt] font-bold text-brand-navy">{u.public_id}</p>
              <p className="text-[8pt] font-semibold truncate">{u.brand} {u.model}</p>
              <p className="text-[6.5pt] text-muted truncate">{line2}</p>
              <p className="text-[9pt] font-bold mt-[1mm]">{rupiahShort(u.price_sell)} <span className="text-[6.5pt] font-semibold px-1 rounded bg-page">Grade {u.grade ?? "-"}</span></p>
              <p className="text-[5.5pt] text-muted mt-[1mm]">Scan: cek sertifikat 8 langkah · niagaaja</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

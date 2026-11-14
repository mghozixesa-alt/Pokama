import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UnitForm } from "@/components/admin/UnitForm";
import { GradeBadge } from "@/components/GradeBadge";
import { createInspection } from "@/app/admin/actions";
import { tanggal } from "@/lib/format";
import type { Inspection, Unit } from "@/lib/types";

export const metadata = { title: "Detail unit" };
const LABELS = ["Fisik & bodi", "Layar & touch", "Baterai", "Kamera & audio", "Konektivitas", "Tombol & port", "Akun & IMEI/serial", "Kelengkapan"];

export default async function UnitAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: unit }, { data: ownership }, { data: owners }, { data: inspections }] = await Promise.all([
    supabase.from("units").select("*").eq("id", id).maybeSingle(),
    supabase.from("ownerships").select("owner_type, owner_id, cost_basis, share_owner_pct, share_niagaaja_pct").eq("unit_id", id).eq("active", true).maybeSingle(),
    supabase.from("owners").select("id, name, type").order("name"),
    supabase.from("inspections").select("*").eq("unit_id", id).order("inspected_at", { ascending: false }),
  ]);
  if (!unit) notFound();
  const u = unit as Unit;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-navy">{u.public_id} · {u.brand} {u.model}</h1>
        <GradeBadge grade={u.grade} /><span className="text-xs font-bold px-2 py-0.5 rounded-md bg-page">{u.status}</span>
        <div className="ml-auto flex gap-2"><Link href={`/admin/stok/${u.id}/label?n=2`} className="btn-soft" target="_blank">Cetak label QR</Link><Link href={`/unit/${u.public_id}`} className="btn-soft" target="_blank">Halaman publik</Link></div>
      </div>

      <div className="mt-4"><UnitForm unit={u} ownership={ownership} owners={owners ?? []} /></div>

      <section className="card p-4 mt-6">
        <h2 className="text-base font-bold text-brand-navy">Sertifikat cek 8 langkah</h2>
        {(inspections as Inspection[] | null)?.map((i) => (
          <div key={i.id} className="mt-3 p-3 rounded-xl bg-page flex items-center gap-3 flex-wrap text-sm">
            <GradeBadge grade={i.result_grade} /><b>{i.certificate_no}</b><span className="text-muted">{tanggal(i.inspected_at)} · {i.checklist.filter((c) => c.status === "lolos").length}/8 lolos</span>
            <a href={`${site}/cek/${i.qr_token}`} target="_blank" className="btn-soft ml-auto">Buka sertifikat</a>
          </div>
        ))}
        <form action={createInspection} className="mt-4 grid gap-2">
          <input type="hidden" name="unit_id" value={u.id} />
          <p className="text-xs text-muted">Buat sertifikat baru (unit masuk / kembali dari sewa). Grade hasil akan disalin ke unit dan status jadi <i>tersedia</i>.</p>
          {LABELS.map((l, i) => (
            <div key={l} className="grid grid-cols-[28px_1fr_140px_1fr] gap-2 items-center">
              <span className="w-7 h-7 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-sm font-semibold">{l}</span>
              <select name={`s${i + 1}`} defaultValue="lolos" className="input h-10"><option value="lolos">Lolos</option><option value="minus">Ada minus</option><option value="gagal">Gagal</option></select>
              <input name={`n${i + 1}`} placeholder="Catatan (opsional)" className="input h-10" />
            </div>
          ))}
          <div className="flex items-center gap-3 mt-2">
            <label className="label mb-0">Grade hasil</label>
            <select name="result_grade" defaultValue={u.grade ?? "A"} className="input w-28 h-10"><option>A</option><option>B</option><option>C</option></select>
            <button className="btn-primary h-10">Terbitkan sertifikat</button>
          </div>
        </form>
      </section>
    </div>
  );
}

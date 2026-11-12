import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { rupiah, tanggal, waLink, BRANCH_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estimasi tukar tambah" };

export default async function TradeInDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("trade_ins").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const cond = (t.condition ?? {}) as Record<string, string>;

  return (
    <Shell withNav={false}>
      <TopBar title="Estimasi harga" back="/tukar-tambah" />
      <div className="mx-4 rounded-2xl bg-brand-navy text-white p-5">
        <p className="text-[10px] uppercase tracking-widest opacity-70">{cond.mode === "tukar" ? "Tukar tambah" : "Jual ke Niagaaja"}</p>
        <h1 className="text-xl font-extrabold mt-1">{t.brand} {t.model}</h1>
        <p className="text-xs opacity-80">{t.variant}</p>
        <div className="mt-4">
          <p className="text-[10px] opacity-70">{t.final_price ? "Harga final setelah cek" : "Estimasi awal"}</p>
          <p className="text-2xl font-extrabold">{t.final_price ? rupiah(t.final_price) : t.estimate_low ? `${rupiah(t.estimate_low)} – ${rupiah(t.estimate_high)}` : "Dihitung admin dalam 1 jam kerja"}</p>
        </div>
        <p className="text-[10px] opacity-70 mt-3">Diajukan {tanggal(t.created_at)} · status: {t.status}</p>
      </div>

      <div className="mx-4 mt-3 card p-4 text-sm flex flex-col gap-2">
        <h3 className="font-extrabold text-brand-navy">Langkah berikutnya</h3>
        <ol className="list-decimal pl-5 text-muted flex flex-col gap-1">
          <li>Bawa unit ke Niagaaja {BRANCH_LABEL.garut_kota} (atau jadwalkan lewat WhatsApp).</li>
          <li>Teknisi cek 8 langkah, ±20 menit, gratis.</li>
          <li>Harga final disepakati; dibayar langsung atau jadi potongan unit pilihan Anda{cond.target_unit ? ` (${cond.target_unit})` : ""}.</li>
        </ol>
        <p className="text-[11px] text-muted">Estimasi dihitung dari harga baru dan kondisi yang Anda isi. Bisa naik atau turun setelah cek fisik.</p>
      </div>

      <div className="px-4 mt-4"><a href={waLink(`Halo Niagaaja, saya mau jadwalkan cek unit untuk pengajuan ${cond.mode === "tukar" ? "tukar tambah" : "jual"} ${t.brand} ${t.model} (ID ${id.slice(0, 8)})`)} className="btn-primary w-full">Jadwalkan cek via WhatsApp</a></div>
    </Shell>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { CATEGORY_LABEL, rupiah, tanggal } from "@/lib/format";
import { submitTradeIn } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jual / tukar tambah" };

const STATUS: Record<string, string> = { diajukan: "Diajukan, menunggu estimasi", dijadwalkan: "Dijadwalkan cek fisik", dicek: "Sudah dicek", deal: "Deal", batal: "Batal" };

export default async function TukarTambahPage({ searchParams }: { searchParams: Promise<{ gagal?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: mine }] = user
    ? await Promise.all([
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
        supabase.from("trade_ins").select("id, brand, model, variant, status, estimate_low, estimate_high, final_price, created_at").eq("customer_id", user.id).order("created_at", { ascending: false }),
      ])
    : [{ data: null }, { data: [] }];

  return (
    <Shell withNav={false}>
      <TopBar title="Jual / tukar tambah" />
      <div className="mx-4 rounded-2xl bg-gradient-to-br from-[#2F8AD6] to-[#1F5F9E] text-white p-4">
        <p className="text-sm font-extrabold">Isi 1 menit, dapat estimasi langsung</p>
        <p className="text-[11px] opacity-90 mt-1">Harga final ditentukan setelah cek fisik 8 langkah di toko — gratis. Dibayar hari itu juga, atau jadi potongan unit Niagaaja.</p>
      </div>

      {sp.gagal && <p className="mx-4 mt-3 text-xs text-[#c0392b]">Gagal menyimpan: {sp.gagal}</p>}

      <form action={submitTradeIn} className="px-4 mt-4 flex flex-col gap-3">
        <div className="card p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-3 rounded-xl border border-line has-[:checked]:border-brand has-[:checked]:bg-brand-light text-sm font-bold"><input type="radio" name="mode" value="jual" defaultChecked className="accent-brand" />Jual</label>
            <label className="flex items-center gap-2 p-3 rounded-xl border border-line has-[:checked]:border-brand has-[:checked]:bg-brand-light text-sm font-bold"><input type="radio" name="mode" value="tukar" className="accent-brand" />Tukar tambah</label>
          </div>
          <div><label className="label">Kategori</label><select name="category" className="input">{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Merek</label><input name="brand" required className="input" placeholder="Apple" /></div>
            <div><label className="label">Model</label><input name="model" required className="input" placeholder="iPhone 13" /></div>
          </div>
          <div><label className="label">Varian / spesifikasi</label><input name="variant" className="input" placeholder="128 GB, Midnight" /></div>
          <div><label className="label">Harga baru saat ini (perkiraan, untuk estimasi)</label><input name="price_new" inputMode="numeric" className="input" placeholder="12900000" /></div>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <h3 className="text-sm font-extrabold text-brand-navy">Kondisi</h3>
          <div><label className="label">Fisik</label><select name="fisik" className="input"><option value="mulus">Mulus, tanpa goresan</option><option value="lecet">Lecet pakai wajar</option><option value="rusak">Ada retak / penyok</option></select></div>
          <div><label className="label">Fungsi</label><select name="fungsi" className="input"><option value="normal">Semua normal</option><option value="minor">Ada minus kecil (baterai, speaker)</option><option value="ada_masalah">Ada masalah serius</option></select></div>
          <div><label className="label">Kelengkapan</label><select name="kelengkapan" className="input"><option value="fullset">Fullset (dus, charger)</option><option value="unit">Unit saja</option></select></div>
          <div><label className="label">Catatan</label><textarea name="catatan" rows={2} className="input h-auto py-3" placeholder="Riwayat servis, garansi, dll." /></div>
          <div><label className="label">Jika tukar tambah: unit Niagaaja yang diincar (opsional)</label><input name="target_unit" className="input" placeholder="NJ-0001 / iPhone 13" /></div>
        </div>

        <div className="card p-4">
          <label className="label">Nomor WhatsApp</label>
          <input name="phone" required inputMode="tel" defaultValue={profile?.phone ?? ""} className="input" placeholder="08xxxxxxxxxx" />
        </div>

        {user ? <button className="btn-primary w-full">Kirim & lihat estimasi</button> : <Link href="/masuk?next=/tukar-tambah" className="btn-primary w-full">Masuk untuk mengajukan</Link>}
      </form>

      {mine && mine.length > 0 && (
        <section className="px-4 mt-6">
          <h2 className="text-sm font-extrabold text-brand-navy mb-2">Pengajuan saya</h2>
          <div className="flex flex-col gap-2">
            {mine.map((t) => (
              <Link key={t.id} href={`/tukar-tambah/${t.id}`} className="card p-3 text-sm">
                <div className="flex justify-between gap-2"><b>{t.brand} {t.model}</b><span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-page">{STATUS[t.status]}</span></div>
                <p className="text-[11px] text-muted mt-1">{t.final_price ? `Harga final ${rupiah(t.final_price)}` : t.estimate_low ? `Estimasi ${rupiah(t.estimate_low)} – ${rupiah(t.estimate_high)}` : "Estimasi menyusul"} · {tanggal(t.created_at)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}

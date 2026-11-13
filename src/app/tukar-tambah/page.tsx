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
      <div className="mx-4 rounded-2xl bg-gradient-to-br from-[#2F8AD6] to-[#1F5F9E] text-white p-5">
        <p className="text-[18px] leading-6 font-bold">Jual elektronik lama, dibayar hari itu juga</p>
        <p className="text-[12px] opacity-90 mt-1.5">Isi 1 menit untuk estimasi. Harga final setelah cek fisik 8 langkah di toko — gratis, tanpa kewajiban. Bisa jadi uang tunai atau potongan harga unit Niagaaja.</p>
      </div>

      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        {[["1", "Isi form", "estimasi langsung"], ["2", "Cek di toko", "gratis, ±20 menit"], ["3", "Dibayar", "tunai / transfer"]].map(([n, a, b]) => (
          <div key={n} className="card p-3"><span className="w-6 h-6 rounded-full bg-brand text-white text-[11px] font-bold inline-flex items-center justify-center">{n}</span><p className="text-[12px] font-semibold text-brand-navy mt-2">{a}</p><p className="text-[10px] text-muted">{b}</p></div>
        ))}
      </div>

      <div className="mx-4 mt-3 card p-4">
        <p className="text-[12px] font-semibold text-brand-navy">Contoh estimasi</p>
        <div className="mt-2 flex flex-col gap-1.5 text-[12px]">
          {[["iPhone 13 128 GB, mulus, fullset", "Rp 5,6 – 6,5 jt"], ["ThinkPad T480 i5/8/256, lecet pakai", "Rp 2,9 – 3,4 jt"], ["PS5 standar, 2 stik, normal", "Rp 4,3 – 5,0 jt"]].map(([a, b]) => (
            <div key={a} className="flex justify-between gap-3"><span className="text-muted">{a}</span><span className="font-semibold text-brand-navy whitespace-nowrap">{b}</span></div>
          ))}
        </div>
        <p className="text-[10px] text-muted mt-2">Angka contoh; estimasi Anda dihitung dari harga baru dan kondisi yang diisi.</p>
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
          <h3 className="text-sm font-semibold text-brand-navy">Kondisi</h3>
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
          <h2 className="text-sm font-semibold text-brand-navy mb-2">Pengajuan saya</h2>
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

      <section className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-brand-navy mb-2">Pertanyaan umum</h2>
        <div className="card divide-y divide-page">
          {[
            ["Kenapa harganya di bawah harga pasar bekas?", "Kami membayar langsung tanpa menunggu pembeli, menanggung cek, garansi, dan risiko jual. Sebagai gantinya Anda tidak perlu meladeni calon pembeli satu per satu."],
            ["Apa yang dicek di toko?", "Fisik & bodi, layar, baterai, kamera & audio, konektivitas, tombol & port, akun & IMEI/serial, kelengkapan — 8 langkah yang sama dengan sertifikat unit yang kami jual."],
            ["Kalau estimasinya tidak cocok?", "Tidak ada kewajiban. Cek fisik gratis, unit dibawa pulang lagi."],
            ["Bisa tukar tambah?", "Bisa. Nilai unit lama langsung jadi potongan harga unit Niagaaja yang Anda pilih, sisanya dibayar manual (transfer/tunai)."],
            ["Data di HP/laptop bagaimana?", "Wajib keluar dari akun (iCloud/Google) sebelum cek. Kami hapus data dengan reset pabrik di depan Anda."],
          ].map(([q, a]) => (
            <details key={q} className="group">
              <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3 text-[13px] font-semibold text-ink"><span>{q}</span><span className="text-muted transition-transform group-open:rotate-180">⌄</span></summary>
              <p className="px-4 pb-4 text-[12px] text-muted -mt-1">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </Shell>
  );
}

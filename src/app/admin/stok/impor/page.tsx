import Link from "next/link";
import { importUnits } from "../../actions";

export const metadata = { title: "Impor stok" };

const COLS = ["kategori", "merek", "model", "varian", "harga_jual", "harga_baru", "modal", "grade", "sumber", "cabang", "status", "catatan"];
const CONTOH = [
  ["laptop", "Lenovo", "ThinkPad T480", "i5-8350U · 8 GB · SSD 256 GB", "4250000", "9500000", "3200000", "A", "beli_pelanggan", "garut_kota", "tersedia", "Baterai 84%"],
  ["hp", "Apple", "iPhone 13", "128 GB · Midnight", "7200000", "12900000", "6000000", "", "tukar_tambah", "garut_kota", "masuk", "Belum dicek"],
].map((r) => r.join("\t")).join("\n");

export default async function ImporPage({ searchParams }: { searchParams: Promise<{ ok?: string; gagal?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="max-w-3xl">
      <h1 className="text-[22px] font-bold text-brand-navy">Impor stok dari spreadsheet</h1>
      <p className="text-[12px] text-muted mt-1">Salin baris dari Google Sheets / Excel (tanpa judul kolom), tempel di bawah. Urutan kolom harus persis seperti ini:</p>
      <div className="card p-3 mt-3 overflow-x-auto"><code className="text-[11px] whitespace-nowrap">{COLS.join("  |  ")}</code></div>
      <ul className="text-[12px] text-muted mt-2 list-disc pl-5 flex flex-col gap-0.5">
        <li><b>kategori</b>: hp, laptop, kamera, tablet, konsol, audio, smartwatch, drone, aksesori</li>
        <li><b>grade</b>: A/B/C, boleh kosong (diisi saat cek 8 langkah). <b>sumber</b>: beli_pelanggan, tukar_tambah, investor, titipan, eks_sewa_rentalaja</li>
        <li><b>cabang</b>: garut_kota / bandung (kosong = garut_kota). <b>status</b>: masuk (default) atau tersedia</li>
        <li><b>modal</b> = harga beli (cost basis) — dipakai untuk hitung margin di dasbor. Angka tanpa titik/Rp.</li>
      </ul>
      {sp.ok && <p className="mt-3 text-sm text-brand-dark font-semibold">✓ {sp.ok} unit berhasil diimpor. <Link href="/admin/stok" className="underline">Lihat stok</Link></p>}
      {sp.gagal && <p className="mt-3 text-sm text-[#a12d2d]">Gagal: {decodeURIComponent(sp.gagal)}</p>}
      <form action={importUnits} className="mt-4 flex flex-col gap-3">
        <textarea name="tsv" rows={10} required className="input h-auto py-3 font-mono text-[12px]" placeholder={CONTOH} />
        <div className="flex gap-2 items-center">
          <button className="btn-primary h-10">Impor</button>
          <span className="text-[11px] text-muted">Kolom dipisah TAB (hasil tempel dari spreadsheet) atau titik koma.</span>
        </div>
      </form>
    </div>
  );
}

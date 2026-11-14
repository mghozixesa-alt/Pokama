export const metadata = { title: "Panduan admin" };

const SECTIONS: { title: string; steps: string[] }[] = [
  { title: "Rutinitas harian (urutan kerja)", steps: [
    "Buka Dasbor → bagian **Perlu tindakan**. Kerjakan dari kiri ke kanan: konfirmasi bayar → tawaran → pengajuan jual → klaim servis.",
    "Cek WhatsApp admin: setiap booking, bukti bayar, tawaran, dan pengajuan jual juga dikirim ke WA (bila token Fonnte aktif).",
    "Sore: lihat **Stok > 30 hari** di dasbor → putuskan turun harga / promo / tawarkan ke pelanggan yang memantau.",
  ]},
  { title: "Unit baru masuk (beli dari pelanggan / tukar tambah)", steps: [
    "Stok → **+ Unit baru**. Isi kategori, merek, model, varian, harga baru (untuk hitung hemat), **harga jual**, dan **modal** (harga beli) — modal wajib supaya margin di dasbor benar.",
    "Pilih **sumber** dan **kepemilikan** (sendiri / investor / titipan; titipan & investor bagi hasil 70/30 default).",
    "Unggah foto: latar putih/polos, sudut sama untuk semua unit (depan, belakang, layar menyala, kelengkapan). Foto pertama = foto utama.",
    "Status awal **masuk**. Jangan ubah ke *tersedia* sebelum cek 8 langkah selesai.",
    "Banyak unit sekaligus: Stok → **Impor spreadsheet** (tempel dari Sheets).",
  ]},
  { title: "Cek 8 langkah & sertifikat", steps: [
    "Buka unit → bagian **Sertifikat cek**. Isi 8 langkah: fisik & bodi, layar & touch, baterai, kamera & audio, konektivitas, tombol & port, akun & IMEI/serial, kelengkapan. Status tiap langkah: lolos / minus / gagal + catatan.",
    "Tentukan **grade**: A mulus & semua normal · B lecet pakai, fungsi normal · C ada minus (disebutkan jelas). Grade otomatis mengatur garansi (A/B 30 hari, C 7 hari).",
    "Simpan → nomor sertifikat & QR terbentuk. Cetak **label QR** (tombol di halaman unit) dan tempel di unit.",
    "Ubah status unit menjadi **tersedia**. Saat itu pelanggan yang memantau model tersebut otomatis dikabari via WA.",
  ]},
  { title: "Tawaran harga", steps: [
    "Admin → **Tawaran**. Pelanggan hanya bisa menawar ≥ 85% harga. Pilih Setuju / Tawar balik (counter) / Tolak.",
    "Tawaran yang disetujui dikunci **24 jam**; pelanggan booking dengan harga itu lewat halaman unit. Lewat 24 jam, kembali ke harga normal.",
    "Patokan: jangan setuju di bawah **harga dasar** (price floor) unit; cek modal + target margin di halaman unit.",
  ]},
  { title: "Booking & konfirmasi pembayaran (manual)", steps: [
    "Booking otomatis menahan unit 24 jam (status *dipesan*). Pelanggan transfer **nominal + kode unik 3 digit** lalu unggah bukti.",
    "Admin → **Konfirmasi bayar**: cocokkan nominal persis (termasuk kode unik) dengan mutasi rekening. Terima → status *dibayar*, unit jadi *terjual*, pelanggan dapat WA. Tolak → tulis alasan, pelanggan diminta unggah ulang.",
    "Tunai: pelanggan datang, bayar, lalu admin tekan Terima pada pembayaran tunai tersebut.",
    "Lewat 24 jam tanpa bayar: ubah status pesanan ke **dibatalkan** → unit otomatis kembali *tersedia*, poin yang dipakai dikembalikan.",
  ]},
  { title: "Pengiriman & penyelesaian", steps: [
    "Setelah *dibayar*: ubah ke **disiapkan** (cek ulang, bersihkan, reset, kemas) → **dikirim** (atau serah terima di toko) → **selesai** saat unit diterima.",
    "Status **selesai** mengaktifkan garansi dan memberi Niaga Poin (1 poin per Rp10.000). Nota bisa dicetak dari tabel pesanan (tautan *Nota*).",
    "Kirim ke alamat: ongkir dihitung per zona dan diinformasikan via WA sebelum dikirim.",
  ]},
  { title: "Jual / tukar tambah dari pelanggan", steps: [
    "Admin → **Tukar tambah**. Pengajuan masuk dengan estimasi otomatis (harga baru × faktor kondisi).",
    "Hubungi pelanggan, jadwalkan cek fisik (status *dijadwalkan*). Setelah cek: isi **harga final**, status *dicek* → *deal* / *batal*. Pelanggan dapat WA tiap perubahan.",
    "Deal: bayar hari itu (tunai/transfer) atau jadikan potongan unit Niagaaja; wajib pastikan akun iCloud/Google sudah keluar dan reset pabrik di depan pelanggan. Lalu input sebagai unit baru dengan sumber *tukar_tambah*.",
  ]},
  { title: "Klaim servis & garansi", steps: [
    "Admin → **Servis & klaim**. Lihat apakah masih dalam garansi (tertulis otomatis).",
    "Alur: *diajukan* → *dijadwalkan* (hubungi pelanggan ≤ 1 hari kerja) → *dicek* → *diperbaiki* / *ditukar* / *ditolak* (di luar garansi: jatuh, air, pemakaian tidak wajar) → *selesai*. Isi catatan teknisi; catatan dikirim ke WA pelanggan.",
  ]},
  { title: "Titip ke Rentalaja & kepemilikan", steps: [
    "Unit yang lebih laku disewakan: ubah status ke **dititip_rentalaja** (bagi hasil 30/30/40 sesuai kesepakatan). Fase integrasi otomatis menyusul.",
    "Unit investor/titipan: bagian pemilik tercatat di kepemilikan; dasbor menghitung margin Niagaaja = harga jual × bagian Niagaaja.",
  ]},
  { title: "Pengaturan yang perlu dijaga", steps: [
    "Rekening (settings.bank_account) dan identitas toko untuk nota (settings.store) — ubah lewat Supabase SQL editor.",
    "Peran staf: admin (semua), qc (unit & sertifikat), cs (pesanan, tawaran, klaim). Ubah di tabel profiles.role.",
    "Jangan hapus unit yang pernah terjual; gunakan status *afkir* / *ditarik*.",
  ]},
];

function md(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => p.startsWith("**") ? <b key={i} className="text-brand-navy">{p.slice(2, -2)}</b> : p.startsWith("*") ? <i key={i}>{p.slice(1, -1)}</i> : p);
}

export default function PanduanPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-[22px] font-bold text-brand-navy">Panduan operasional admin</h1>
      <p className="text-[12px] text-muted mt-1">SOP harian Niagaaja untuk staf admin, QC, dan CS. Ikuti urutan ini supaya status unit, pesanan, garansi, dan poin selalu benar.</p>
      <div className="mt-4 flex flex-col gap-3">
        {SECTIONS.map((sec, i) => (
          <section key={sec.title} className="card p-4">
            <h2 className="text-sm font-semibold text-brand-navy flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-brand text-white text-[11px] font-bold inline-flex items-center justify-center">{i + 1}</span>{sec.title}</h2>
            <ol className="mt-2 flex flex-col gap-1.5 list-decimal pl-5 text-[13px] leading-5">{sec.steps.map((st) => <li key={st}>{md(st)}</li>)}</ol>
          </section>
        ))}
      </div>
    </div>
  );
}

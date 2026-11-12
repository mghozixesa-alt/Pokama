import { Shell, TopBar } from "@/components/Shell";

export const metadata = { title: "Tentang grade & sertifikat" };

const STEPS = ["Fisik & bodi", "Layar & touch", "Baterai", "Kamera & audio", "Konektivitas", "Tombol & port", "Akun & IMEI/serial", "Kelengkapan"];

export default function SertifikatInfoPage() {
  return (
    <Shell withNav={false}>
      <TopBar title="Grade & sertifikat" back="/katalog" />
      <div className="mx-4 card p-5">
        <h2 className="text-base font-extrabold text-brand-navy">Setiap unit dicek 8 langkah</h2>
        <ol className="mt-3 grid grid-cols-2 gap-2">{STEPS.map((s, i) => <li key={s} className="flex items-center gap-2 text-sm"><span className="w-6 h-6 rounded-full bg-brand-light text-brand text-[11px] font-extrabold flex items-center justify-center">{i + 1}</span>{s}</li>)}</ol>
      </div>
      <div className="mx-4 mt-3 card p-5 flex flex-col gap-3 text-sm">
        <div><b className="text-brand-navy">Grade A · mulus</b><p className="text-muted">Seperti baru, tanpa goresan terlihat. Harga penuh, garansi 30 hari.</p></div>
        <div><b className="text-brand-navy">Grade B · lecet pakai</b><p className="text-muted">Lecet halus bekas pakai, fungsi 100%. Sekitar 10% lebih murah, garansi 30 hari.</p></div>
        <div><b className="text-brand-navy">Grade C · ada minus</b><p className="text-muted">Ada minus kosmetik yang dijelaskan di sertifikat. Sekitar 22% lebih murah, garansi 7 hari.</p></div>
        <p className="text-muted">Sumber unit (termasuk eks sewa Rentalaja) selalu ditulis di sertifikat.</p>
      </div>
    </Shell>
  );
}

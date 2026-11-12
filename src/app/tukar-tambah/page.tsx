import { Shell, TopBar } from "@/components/Shell";
import { waLink } from "@/lib/format";

export const metadata = { title: "Jual / tukar tambah" };

export default function TukarTambahPage() {
  return (
    <Shell withNav={false}>
      <TopBar title="Jual / tukar tambah" />
      <div className="mx-4 card p-5">
        <h2 className="text-base font-extrabold text-brand-navy">Fitur ini menyusul di Fase 2</h2>
        <p className="text-sm text-muted mt-2">Sementara, kirim foto dan spesifikasi unit Anda lewat WhatsApp. Tim kami membalas estimasi harga dalam 1 jam kerja, lalu dicek fisik di toko — gratis.</p>
        <a href={waLink("Halo Niagaaja, saya mau jual / tukar tambah unit: ")} className="btn-primary w-full mt-4">Kirim via WhatsApp</a>
      </div>
    </Shell>
  );
}

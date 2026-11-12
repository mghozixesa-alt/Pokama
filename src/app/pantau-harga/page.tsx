import { Shell, TopBar } from "@/components/Shell";
import { waLink } from "@/lib/format";

export const metadata = { title: "Pantau harga" };

export default async function PantauHargaPage({ searchParams }: { searchParams: Promise<{ unit?: string; grade?: string }> }) {
  const sp = await searchParams;
  return (
    <Shell withNav={false}>
      <TopBar title="Pantau harga" />
      <div className="mx-4 card p-5">
        <h2 className="text-base font-extrabold text-brand-navy">Dikabari saat unit masuk</h2>
        <p className="text-sm text-muted mt-2">Fitur pantau harga otomatis menyusul di Fase 2. Untuk sekarang, kirim model dan harga target Anda lewat WhatsApp; CS akan mengabari saat ada unit yang cocok.</p>
        <a href={waLink(`Halo Niagaaja, tolong kabari kalau ada ${sp.unit ? `unit seperti ${sp.unit}` : "unit"}${sp.grade ? ` grade ${sp.grade}` : ""} dengan harga target: `)} className="btn-primary w-full mt-4">Kirim via WhatsApp</a>
      </div>
    </Shell>
  );
}

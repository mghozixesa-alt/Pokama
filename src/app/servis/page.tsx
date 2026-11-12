import { Shell, TopBar } from "@/components/Shell";
import { waLink } from "@/lib/format";

export const metadata = { title: "Servis & garansi" };

export default async function ServisPage({ searchParams }: { searchParams: Promise<{ pesanan?: string }> }) {
  const sp = await searchParams;
  return (
    <Shell withNav={false}>
      <TopBar title="Servis & garansi" back="/akun" />
      <div className="mx-4 card p-5">
        <h2 className="text-base font-bold text-brand-navy">Klaim garansi</h2>
        <p className="text-sm text-muted mt-2">Ceritakan kendalanya lewat WhatsApp dengan menyebut kode pesanan. Unit dicek teknisi; kalau kerusakan masuk garansi, diperbaiki atau ditukar tanpa biaya.</p>
        <a href={waLink(`Halo Niagaaja, saya mau klaim garansi pesanan ${sp.pesanan ?? ""}. Kendalanya: `)} className="btn-primary w-full mt-4">Klaim via WhatsApp</a>
      </div>
    </Shell>
  );
}

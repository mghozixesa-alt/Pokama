import Image from "next/image";
import { Shell } from "@/components/Shell";
import { GoogleButton } from "@/components/GoogleButton";

export const metadata = { title: "Masuk" };

export default async function MasukPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <Shell withNav={false}>
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <Image src="/logo.png" alt="Niagaaja" width={180} height={54} className="h-12 w-auto" priority />
        <h1 className="text-xl font-extrabold text-brand-navy mt-6">Masuk ke Niagaaja</h1>
        <p className="text-sm text-muted mt-1">Untuk booking, tawar harga, dan melihat pesanan. Cukup pakai akun Google.</p>
        <div className="w-full mt-6"><GoogleButton next={next ?? "/"} /></div>
        <p className="text-[11px] text-muted mt-6">Dengan masuk, Anda setuju data nama dan email dipakai untuk pesanan Anda. Nomor WhatsApp diminta saat booking.</p>
      </div>
    </Shell>
  );
}

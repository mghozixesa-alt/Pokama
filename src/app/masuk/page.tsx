import { Logo } from "@/components/Logo";
import { Shell } from "@/components/Shell";
import { GoogleButton } from "@/components/GoogleButton";
import { EmailLogin } from "@/components/EmailLogin";

export const metadata = { title: "Masuk" };

export default async function MasukPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <Shell withNav={false}>
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <Logo height={48} />
        <h1 className="text-xl font-extrabold text-brand-navy mt-6">Masuk ke Niagaaja</h1>
        <p className="text-sm text-muted mt-1">Untuk booking, tawar harga, dan melihat pesanan. Cukup pakai akun Google.</p>
        <div className="w-full mt-6"><GoogleButton next={next ?? "/"} /></div>
        <div className="w-full flex items-center gap-3 my-5 text-[11px] text-muted"><span className="flex-1 h-px bg-line" />atau<span className="flex-1 h-px bg-line" /></div>
        <div className="w-full text-left"><EmailLogin next={next ?? "/"} /></div>
        <p className="text-[11px] text-muted mt-6">Dengan masuk, Anda setuju data nama dan email dipakai untuk pesanan Anda. Nomor WhatsApp diminta saat booking.</p>
      </div>
    </Shell>
  );
}

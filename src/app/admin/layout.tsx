import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Ringkasan"],
  ["/admin/stok", "Stok & kepemilikan"],
  ["/admin/pembayaran", "Konfirmasi bayar"],
  ["/admin/tawaran", "Tawaran"],
  ["/admin/pesanan", "Pesanan"],
  ["/admin/tukar-tambah", "Tukar tambah"],
  ["/admin/servis", "Servis & klaim"],
  ["/admin/panduan", "Panduan"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/admin");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!profile?.role || !["admin", "qc", "cs"].includes(profile.role)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div className="card p-6 max-w-sm"><p className="font-bold text-brand-navy">Akses admin diperlukan</p><p className="text-sm text-muted mt-2">Akun {user.email} belum punya peran staf. Minta admin menjalankan: <code className="text-xs">update profiles set role = &apos;admin&apos; where id = &apos;{user.id}&apos;;</code></p><Link href="/" className="btn-outline mt-4">Ke beranda</Link></div>
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="bg-brand-navy text-white p-5 flex lg:flex-col gap-4 lg:gap-2 items-center lg:items-stretch overflow-x-auto no-scrollbar">
        <span className="inline-flex items-center h-10 px-3 rounded-xl bg-white shrink-0"><Logo height={26} /></span>
        <span className="hidden lg:block text-[10px] uppercase tracking-widest opacity-60 mt-2">Admin</span>
        {NAV.map(([href, label]) => <Link key={href} href={href} className="shrink-0 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/10 whitespace-nowrap">{label}</Link>)}
        <div className="lg:mt-auto text-[11px] opacity-70 shrink-0">{profile.full_name ?? user.email} · {profile.role}</div>
      </aside>
      <main className="p-4 lg:p-8 max-w-6xl">{children}</main>
    </div>
  );
}

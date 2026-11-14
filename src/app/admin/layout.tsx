import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/admin");
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!profile?.role || !["admin", "qc", "cs"].includes(profile.role)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center bg-[#F4F6F9]">
        <div className="card p-6 max-w-sm"><p className="font-bold text-brand-navy">Akses admin diperlukan</p><p className="text-sm text-muted mt-2">Akun {user.email} belum punya peran staf. Minta admin menjalankan: <code className="text-xs">update profiles set role = &apos;admin&apos; where id = &apos;{user.id}&apos;;</code></p><Link href="/" className="btn-outline mt-4">Ke beranda</Link></div>
      </div>
    );
  }
  // Lencana angka di menu
  const [konf, taw, ti, kl] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "menunggu_konfirmasi"),
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("trade_ins").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("service_claims").select("id", { count: "exact", head: true }).in("status", ["diajukan", "dijadwalkan", "dicek"]),
  ]);
  const counts = { "/admin/pembayaran": konf.count ?? 0, "/admin/tawaran": taw.count ?? 0, "/admin/tukar-tambah": ti.count ?? 0, "/admin/servis": kl.count ?? 0 };
  const name = profile.full_name || user.email?.split("@")[0] || "Admin";

  return <AdminShell counts={counts} user={{ name, role: profile.role }}>{children}</AdminShell>;
}

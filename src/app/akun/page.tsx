import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icons";
import { tanggal } from "@/lib/format";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Akun" };

export default async function AkunPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: warranties }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    supabase.from("orders").select("public_id, warranty_until, units(brand, model, variant, public_id)").eq("customer_id", user!.id).eq("status", "selesai").not("warranty_until", "is", null).order("warranty_until", { ascending: false }),
  ]);
  const p = profile as Profile | null;
  const isStaff = p?.role && ["admin", "qc", "cs"].includes(p.role);

  return (
    <Shell active="akun">
      <div className="px-4 pt-5 flex items-center gap-3">
        <span className="relative w-14 h-14 rounded-full overflow-hidden bg-brand-light flex items-center justify-center text-brand">{p?.avatar_url ? <Image src={p.avatar_url} alt="" fill className="object-cover" /> : <Icon.User size={28} />}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold text-brand-navy truncate">{p?.full_name ?? user?.email}</h1>
          <p className="text-xs text-muted truncate">{user?.email}{p?.phone ? ` · ${p.phone}` : ""}</p>
        </div>
      </div>

      <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-[#2F8AD6] to-[#1F5F9E] text-white p-4 flex items-center justify-between">
        <div><p className="text-[11px] opacity-80">Niaga Poin</p><p className="text-2xl font-extrabold">{(p?.points_balance ?? 0).toLocaleString("id-ID")}</p><p className="text-[10px] opacity-80">1 poin = Rp 100 · dapat 1 poin tiap Rp 10.000</p></div>
        <Link href="/poin" className="h-9 px-3 rounded-full bg-white text-brand-dark text-xs font-extrabold flex items-center">Riwayat</Link>
      </div>

      {isStaff && <Link href="/admin" className="mx-4 mt-3 card p-4 flex items-center gap-3 border-brand"><span className="w-10 h-10 rounded-xl bg-brand-navy text-white flex items-center justify-center font-extrabold">A</span><span className="flex-1 text-sm font-bold">Panel admin Niagaaja</span><Icon.ChevronRight stroke="#8a93a6" /></Link>}

      <section className="mx-4 mt-4 card divide-y divide-page">
        {[["/pesanan", "Pesanan & tawaran saya"], ["/akun#tersimpan", "Unit tersimpan"], ["/tukar-tambah", "Jual / tukar tambah"], ["/pantau-harga", "Pantau harga"]].map(([href, label]) => (
          <Link key={href} href={href} className="flex items-center justify-between p-4 text-sm font-semibold"><span>{label}</span><Icon.ChevronRight stroke="#8a93a6" /></Link>
        ))}
      </section>

      <section className="px-4 mt-4">
        <h2 className="text-sm font-extrabold text-brand-navy mb-2">Garansi aktif</h2>
        <div className="flex flex-col gap-2">
          {warranties?.map((w) => {
            const u = w.units as unknown as { brand: string; model: string; variant: string | null; public_id: string };
            const active = new Date(w.warranty_until!) >= new Date();
            return (
              <div key={w.public_id} className="card p-3 flex items-center gap-3">
                <Icon.Shield size={22} stroke={active ? "#0e8f85" : "#8a93a6"} />
                <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{u.brand} {u.model} {u.variant}</p><p className="text-[11px] text-muted">{active ? "Berlaku sampai" : "Berakhir"} {tanggal(w.warranty_until)}</p></div>
                {active && <Link href={`/servis?pesanan=${w.public_id}`} className="btn-soft">Klaim</Link>}
              </div>
            );
          })}
          {!warranties?.length && <p className="text-sm text-muted">Belum ada pembelian selesai.</p>}
        </div>
      </section>

      <form action="/auth/keluar" method="post" className="px-4 mt-6"><button className="btn-outline w-full">Keluar</button></form>
      <p className="text-center text-[10px] text-muted mt-4">Niagaaja · PT Popo Karya Investama · Garut</p>
    </Shell>
  );
}

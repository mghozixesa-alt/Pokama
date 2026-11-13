import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { UnitCardRow } from "@/components/UnitCard";
import type { Unit } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unit tersimpan" };

export default async function TersimpanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user ? await supabase.from("saved_units").select("created_at, units(*)").eq("customer_id", user.id).order("created_at", { ascending: false }) : { data: [] };
  const units = (data ?? []).map((r) => r.units as unknown as Unit).filter(Boolean);
  return (
    <Shell active="akun">
      <TopBar title="Unit tersimpan" back="/akun" />
      <div className="px-4 flex flex-col gap-2.5">
        {units.map((u) => (
          <div key={u.id} className="relative">
            <UnitCardRow u={u} />
            {u.status !== "tersedia" && <span className="absolute top-2 left-2 px-2 h-5 inline-flex items-center rounded-md bg-brand-navy/80 text-white text-[10px] font-semibold">{u.status === "dipesan" ? "Dipesan" : "Terjual"}</span>}
          </div>
        ))}
        {!units.length && (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">Belum ada unit tersimpan. Ketuk ikon ♡ di halaman unit untuk menyimpannya.</p>
            <Link href="/katalog" className="btn-primary mt-4">Lihat katalog</Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

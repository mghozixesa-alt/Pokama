import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { tanggal } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Niaga Poin" };

export default async function PoinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user ? await supabase.from("points_ledger").select("*").eq("customer_id", user.id).order("created_at", { ascending: false }) : { data: [] };
  return (
    <Shell withNav={false}>
      <TopBar title="Niaga Poin" back="/akun" />
      <div className="mx-4 card divide-y divide-page">
        {data?.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between text-sm"><span><b>{r.reason}</b><br /><span className="text-[11px] text-muted">{tanggal(r.created_at)}</span></span><span className={`font-bold ${r.delta > 0 ? "text-teal-dark" : "text-[#a12d2d]"}`}>{r.delta > 0 ? "+" : ""}{r.delta}</span></div>
        ))}
        {!data?.length && <p className="p-5 text-sm text-muted">Belum ada poin. Dapat 1 poin tiap Rp 10.000 pembelian yang selesai.</p>}
      </div>
    </Shell>
  );
}

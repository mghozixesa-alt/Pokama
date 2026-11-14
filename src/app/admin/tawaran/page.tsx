import { createClient } from "@/lib/supabase/server";
import { answerOffer } from "@/app/admin/actions";
import { rupiah, tanggal } from "@/lib/format";

export const metadata = { title: "Tawaran" };

type Row = { id: string; amount: number; counter_amount: number | null; status: string; created_at: string; expires_at: string | null; profiles: { full_name: string | null; phone: string | null } | null; units: { public_id: string; brand: string; model: string; price_sell: number; price_floor: number | null } | null };

export default async function TawaranPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("offers").select("id, amount, counter_amount, status, created_at, expires_at, profiles(full_name, phone), units(public_id, brand, model, price_sell, price_floor)").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <h1 className="text-[22px] leading-7 font-bold text-brand-navy">Tawaran harga</h1>
      <p className="text-sm text-muted mt-1">Jawab maksimal 24 jam. Harga yang disetujui terkunci 24 jam untuk pelanggan.</p>
      <div className="card mt-4 divide-y divide-page">
        {rows.map((r) => {
          const floor = r.units?.price_floor ?? 0;
          const under = r.amount < floor;
          return (
            <div key={r.id} className="p-3 flex items-center gap-3 flex-wrap text-sm">
              <div className="min-w-[220px]"><b>{r.units?.brand} {r.units?.model}</b> <span className="font-mono text-xs text-muted">{r.units?.public_id}</span><br /><span className="text-xs text-muted">{r.profiles?.full_name ?? "-"} · {r.profiles?.phone ?? "-"} · {tanggal(r.created_at)}</span></div>
              <div className="min-w-[200px]"><span className="text-xs text-muted">Tawaran</span><br /><b className={under ? "text-[#a12d2d]" : "text-brand-navy"}>{rupiah(r.amount)}</b> <span className="text-xs text-muted">/ harga {rupiah(r.units?.price_sell)}{floor ? ` · floor ${rupiah(floor)}` : ""}</span></div>
              {r.status === "diajukan" ? (
                <form action={answerOffer} className="flex gap-2 items-center flex-wrap ml-auto">
                  <input type="hidden" name="offer_id" value={r.id} />
                  <button name="action" value="setuju" className="btn-primary h-9 px-3 text-xs">Setuju</button>
                  <input name="counter_amount" placeholder="Tawar balik" inputMode="numeric" className="input h-9 w-32 text-xs" />
                  <button name="action" value="counter" className="btn-soft h-9">Kirim balik</button>
                  <button name="action" value="tolak" className="btn-outline h-9 px-3 text-xs">Tolak</button>
                </form>
              ) : (
                <span className="ml-auto text-xs font-bold px-2 py-1 rounded-md bg-page">{r.status}{r.counter_amount ? ` · ${rupiah(r.counter_amount)}` : ""}{r.expires_at && r.status === "disetujui" ? ` · s/d ${tanggal(r.expires_at)}` : ""}</span>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="p-4 text-sm text-muted">Belum ada tawaran.</p>}
      </div>
    </div>
  );
}

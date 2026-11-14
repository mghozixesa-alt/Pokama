import { createClient } from "@/lib/supabase/server";
import { setOrderStatus } from "@/app/admin/actions";
import { rupiah, tanggal, ORDER_STATUS_LABEL, BRANCH_LABEL } from "@/lib/format";
import type { Branch, OrderStatus } from "@/lib/types";

export const metadata = { title: "Pesanan" };

type Row = { id: string; public_id: string; amount: number; status: OrderStatus; fulfillment: string; shipping_address: string | null; warranty_until: string | null; created_at: string; profiles: { full_name: string | null; phone: string | null } | null; units: { public_id: string; brand: string; model: string; branch: Branch } | null };
const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = { dibayar: ["disiapkan", "dibatalkan"], disiapkan: ["dikirim", "selesai"], dikirim: ["selesai"], selesai: ["retur"], menunggu_bayar: ["dibatalkan"], menunggu_konfirmasi: ["dibatalkan"] };

export default async function AdminPesananPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("id, public_id, amount, status, fulfillment, shipping_address, warranty_until, created_at, profiles(full_name, phone), units(public_id, brand, model, branch)").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <h1 className="text-[22px] leading-7 font-bold text-brand-navy">Pesanan</h1>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="text-[11px] text-muted text-left"><tr className="border-b border-page">{["Pesanan", "Unit", "Pelanggan", "Nominal", "Ambil / kirim", "Status", "Ubah"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-page last:border-0 align-top">
                <td className="px-3 py-2"><b>{r.public_id}</b><br /><span className="text-[11px] text-muted">{tanggal(r.created_at)}</span><br /><a href={`/pesanan/${r.public_id}/nota`} target="_blank" className="text-[11px] font-semibold text-brand">Nota ↗</a></td>
                <td className="px-3 py-2">{r.units?.brand} {r.units?.model}<br /><span className="font-mono text-[11px] text-muted">{r.units?.public_id}</span></td>
                <td className="px-3 py-2">{r.profiles?.full_name ?? "-"}<br /><span className="text-[11px] text-muted">{r.profiles?.phone ?? "-"}</span></td>
                <td className="px-3 py-2 font-bold whitespace-nowrap">{rupiah(r.amount)}</td>
                <td className="px-3 py-2 text-xs">{r.fulfillment === "kirim" ? `Kirim: ${r.shipping_address ?? "-"}` : `Ambil di ${r.units ? BRANCH_LABEL[r.units.branch] : "toko"}`}</td>
                <td className="px-3 py-2 text-xs"><b>{ORDER_STATUS_LABEL[r.status]}</b>{r.warranty_until && <><br /><span className="text-muted">garansi s/d {tanggal(r.warranty_until)}</span></>}</td>
                <td className="px-3 py-2">
                  <form action={setOrderStatus} className="flex gap-1 flex-wrap">
                    <input type="hidden" name="order_id" value={r.id} />
                    {(NEXT[r.status] ?? []).map((s) => <button key={s} name="status" value={s} className={s === "dibatalkan" || s === "retur" ? "btn-outline h-8 px-2 text-[11px]" : "btn-soft h-8"}>{s}</button>)}
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="p-6 text-center text-muted">Belum ada pesanan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

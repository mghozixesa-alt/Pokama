import { createClient } from "@/lib/supabase/server";
import { tanggal } from "@/lib/format";
import { updateClaim } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Servis & klaim" };

const STATUSES = ["diajukan", "dijadwalkan", "dicek", "diperbaiki", "ditukar", "ditolak", "selesai"];

export default async function AdminServis() {
  const supabase = await createClient();
  const { data: claims } = await supabase.from("service_claims").select("*, profiles(full_name, phone), orders(public_id, warranty_until, units(brand, model, variant, public_id))").order("created_at", { ascending: false }).limit(100);
  return (
    <div>
      <h1 className="text-[22px] font-bold text-brand-navy">Servis & klaim garansi</h1>
      <div className="flex flex-col gap-3 mt-4">
        {claims?.map((c) => {
          const p = c.profiles as unknown as { full_name: string | null; phone: string | null } | null;
          const o = c.orders as unknown as { public_id: string; warranty_until: string | null; units: { brand: string; model: string; variant: string | null; public_id: string } | null } | null;
          const inWarranty = o?.warranty_until && new Date(o.warranty_until).getTime() >= Date.now();
          return (
            <form key={c.id} action={updateClaim} className="card p-4 grid gap-3 lg:grid-cols-[1fr_auto]">
              <input type="hidden" name="id" value={c.id} />
              <div className="min-w-0">
                <p className="text-[11px] text-muted">{c.public_id} · {tanggal(c.created_at)} · {p?.full_name ?? "-"} · {p?.phone ?? "-"}</p>
                <p className="text-sm font-semibold mt-1">{o?.units ? `${o.units.brand} ${o.units.model} ${o.units.variant ?? ""} (${o.units.public_id})` : "Unit luar / tidak terkait pesanan"}</p>
                <p className="text-[11px] mt-0.5">{o ? (inWarranty ? <span className="text-brand-dark font-semibold">Masih garansi s/d {tanggal(o.warranty_until)}</span> : <span className="text-[#a12d2d] font-semibold">Garansi habis</span>) : <span className="text-muted">Berbayar</span>}</p>
                <p className="text-sm mt-2">{c.issue}</p>
              </div>
              <div className="flex flex-col gap-2 lg:w-72">
                <select name="status" defaultValue={c.status} className="input h-10">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <input name="admin_note" defaultValue={c.admin_note ?? ""} placeholder="Catatan untuk pelanggan (dikirim via WA)" className="input h-10" />
                <button className="btn-soft">Simpan & kabari</button>
              </div>
            </form>
          );
        })}
        {!claims?.length && <p className="text-sm text-muted">Belum ada klaim.</p>}
      </div>
    </div>
  );
}

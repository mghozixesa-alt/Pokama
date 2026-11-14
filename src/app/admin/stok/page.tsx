import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GradeBadge } from "@/components/GradeBadge";
import { rupiah, CATEGORY_LABEL, SOURCE_LABEL, BRANCH_LABEL } from "@/lib/format";
import type { Unit } from "@/lib/types";

export const metadata = { title: "Stok & kepemilikan" };

const OWNER_CHIPS = [["", "Semua"], ["sendiri", "Sendiri"], ["investor", "Investor"], ["titipan", "Titipan"]];
const STATUS_CHIPS = [["", "Semua status"], ["masuk", "Masuk"], ["qc", "QC"], ["tersedia", "Tersedia"], ["dipesan", "Dipesan"], ["terjual", "Terjual"], ["dititip_rentalaja", "Dititip"], ["afkir", "Afkir"]];
const STATUS_TONE: Record<string, string> = { tersedia: "bg-teal-light text-teal-dark", dipesan: "bg-[#fdf1dc] text-[#7a4a00]", terjual: "bg-page text-muted", dititip_rentalaja: "bg-brand-light text-brand-dark", masuk: "bg-[#eceef3] text-ink", qc: "bg-[#eceef3] text-ink", ditarik: "bg-[#eceef3] text-ink", afkir: "bg-[#fde8e8] text-[#a12d2d]" };

type Row = Unit & { ownerships: { owner_type: string; cost_basis: number; share_owner_pct: number; active: boolean; owners: { name: string } | null }[] };

export default async function StokPage({ searchParams }: { searchParams: Promise<{ pemilik?: string; status?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("units").select("*, ownerships(owner_type, cost_basis, share_owner_pct, active, owners(name))").order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) q = q.or(`public_id.ilike.%${sp.q}%,model.ilike.%${sp.q}%,brand.ilike.%${sp.q}%`);
  const { data } = await q.limit(200);
  let rows = (data ?? []) as Row[];
  if (sp.pemilik) rows = rows.filter((r) => r.ownerships?.find((o) => o.active)?.owner_type === sp.pemilik);
  const link = (p: Record<string, string | undefined>) => { const s = new URLSearchParams(); Object.entries({ ...sp, ...p }).forEach(([k, v]) => v && s.set(k, v)); return `/admin/stok?${s}`; };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-navy">Stok & kepemilikan</h1>
        <div className="flex gap-2"><Link href="/admin/stok/impor" className="btn-soft h-10">Impor spreadsheet</Link><Link href="/admin/stok/baru" className="btn-primary h-10">+ Unit baru</Link></div>
      </div>
      <form className="mt-4 flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Cari NJ-… / model" className="input max-w-xs" />{sp.status && <input type="hidden" name="status" value={sp.status} />}<button className="btn-soft h-12 px-4">Cari</button></form>
      <div className="flex gap-2 mt-3 flex-wrap">{OWNER_CHIPS.map(([v, l]) => <Link key={v} href={link({ pemilik: v || undefined })} className={`h-9 px-3 rounded-full text-xs font-bold border flex items-center ${(sp.pemilik ?? "") === v ? "bg-brand-navy text-white border-brand-navy" : "bg-white border-line"}`}>{l}</Link>)}</div>
      <div className="flex gap-2 mt-2 flex-wrap">{STATUS_CHIPS.map(([v, l]) => <Link key={v} href={link({ status: v || undefined })} className={`h-8 px-3 rounded-full text-[11px] font-bold border flex items-center ${(sp.status ?? "") === v ? "bg-brand text-white border-brand" : "bg-white border-line"}`}>{l}</Link>)}</div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="text-[11px] text-muted text-left"><tr className="border-b border-page">{["ID", "Unit", "Grade", "Pemilik", "Sumber", "Status", "Harga jual", "Modal", "Cabang", ""].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const own = r.ownerships?.find((o) => o.active);
              return (
                <tr key={r.id} className="border-b border-page last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.public_id}</td>
                  <td className="px-3 py-2"><b>{r.brand} {r.model}</b><br /><span className="text-[11px] text-muted">{CATEGORY_LABEL[r.category]} · {r.variant}</span></td>
                  <td className="px-3 py-2"><GradeBadge grade={r.grade} /></td>
                  <td className="px-3 py-2 text-xs">{own ? <>{own.owner_type}{own.owners?.name ? ` · ${own.owners.name}` : ""}{own.owner_type !== "sendiri" && <span className="text-muted"> ({own.share_owner_pct}%)</span>}</> : "-"}</td>
                  <td className="px-3 py-2 text-xs">{SOURCE_LABEL[r.source]}{r.rentalaja_asset_id ? ` · ${r.rentalaja_asset_id}` : ""}</td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${STATUS_TONE[r.status] ?? ""}`}>{r.status}</span></td>
                  <td className="px-3 py-2 font-bold whitespace-nowrap">{rupiah(r.price_sell)}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{rupiah(own?.cost_basis)}</td>
                  <td className="px-3 py-2 text-xs">{BRANCH_LABEL[r.branch]}</td>
                  <td className="px-3 py-2"><Link href={`/admin/stok/${r.id}`} className="btn-soft">Buka</Link></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={10} className="p-6 text-center text-muted">Tidak ada unit.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

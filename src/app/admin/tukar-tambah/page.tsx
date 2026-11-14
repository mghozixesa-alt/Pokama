import { createClient } from "@/lib/supabase/server";
import { updateTradeIn } from "@/app/admin/actions";
import { rupiah, tanggal, CATEGORY_LABEL } from "@/lib/format";
import type { Category } from "@/lib/types";

export const metadata = { title: "Tukar tambah & jual" };

type Row = { id: string; category: Category; brand: string | null; model: string | null; variant: string | null; condition: Record<string, string>; estimate_low: number | null; estimate_high: number | null; final_price: number | null; status: string; created_at: string; profiles: { full_name: string | null; phone: string | null } | null };
const NEXT: Record<string, string[]> = { diajukan: ["dijadwalkan", "batal"], dijadwalkan: ["dicek", "batal"], dicek: ["deal", "batal"], deal: [], batal: [] };

export default async function AdminTradeIns() {
  const supabase = await createClient();
  const { data } = await supabase.from("trade_ins").select("*, profiles(full_name, phone)").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <h1 className="text-[22px] leading-7 font-bold text-brand-navy">Tukar tambah & jual dari pelanggan</h1>
      <p className="text-sm text-muted mt-1">Balas estimasi lewat WhatsApp, jadwalkan cek, lalu isi harga final. Saat <b>deal</b>, buat unit baru di Stok dengan sumber <i>tukar_tambah</i>.</p>
      <div className="card mt-4 divide-y divide-page">
        {rows.map((r) => (
          <div key={r.id} className="p-4 grid lg:grid-cols-[1.4fr_1fr_1fr_auto] gap-3 text-sm">
            <div>
              <b>{r.brand} {r.model}</b> <span className="text-xs text-muted">{r.variant}</span>
              <p className="text-[11px] text-muted">{CATEGORY_LABEL[r.category]} · {r.condition?.mode === "tukar" ? `tukar tambah → ${r.condition?.target_unit || "?"}` : "jual"} · {tanggal(r.created_at)}</p>
              <p className="text-[11px] text-muted">Fisik {r.condition?.fisik} · fungsi {r.condition?.fungsi} · {r.condition?.kelengkapan}{r.condition?.catatan ? ` · "${r.condition.catatan}"` : ""}</p>
            </div>
            <div className="text-xs">
              <p className="font-bold">{r.profiles?.full_name ?? "-"}</p>
              {r.profiles?.phone && <a href={`https://wa.me/${r.profiles.phone.replace(/^0/, "62")}`} target="_blank" className="text-brand font-bold">{r.profiles.phone}</a>}
            </div>
            <div className="text-xs">
              <p>Estimasi: <b>{r.estimate_low ? `${rupiah(r.estimate_low)} – ${rupiah(r.estimate_high)}` : "-"}</b></p>
              <p>Final: <b>{rupiah(r.final_price)}</b> · <span className="px-1.5 py-0.5 rounded bg-page font-bold">{r.status}</span></p>
            </div>
            <form action={updateTradeIn} className="flex flex-wrap gap-1 items-center">
              <input type="hidden" name="id" value={r.id} />
              <input name="final_price" placeholder="Harga final" inputMode="numeric" defaultValue={r.final_price ?? ""} className="input h-8 w-28 text-xs" />
              {NEXT[r.status].map((s) => <button key={s} name="status" value={s} className={s === "batal" ? "btn-outline h-8 px-2 text-[11px]" : "btn-soft h-8"}>{s}</button>)}
              <button name="status" value={r.status} className="btn-soft h-8">Simpan harga</button>
            </form>
          </div>
        ))}
        {!rows.length && <p className="p-4 text-sm text-muted">Belum ada pengajuan.</p>}
      </div>
    </div>
  );
}

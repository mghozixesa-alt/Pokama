import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rupiah, rupiahShort, CATEGORY_LABEL } from "@/lib/format";

export const metadata = { title: "Beranda" };

const PAID = ["dibayar", "disiapkan", "dikirim", "selesai"];
const HOUR = 3600 * 1000;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type O = { id: string; amount: number; status: string; created_at: string; updated_at: string; unit_id: string };
type U = { id: string; category: string; status: string; price_sell: number; created_at: string };
type Own = { unit_id: string; cost_basis: number; share_niagaaja_pct: number; owner_type: string };

/** Grafik batang sederhana (SVG) — satu atau dua seri. */
function Bars({ labels, a, b, colorA = "#2A7DC1", colorB = "#9FD0B8", height = 150 }: { labels: string[]; a: number[]; b?: number[]; colorA?: string; colorB?: string; height?: number }) {
  const max = Math.max(1, ...a, ...(b ?? []));
  const W = 480, top = 14, base = height - 26, h = base - top, slot = (W - 40) / labels.length, bw = b ? Math.min(18, slot / 3) : Math.min(30, slot / 2);
  const ticks = [0, 0.5, 1];
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} role="img">
      {ticks.map((t) => <g key={t}><line x1="40" x2={W} y1={base - t * h} y2={base - t * h} stroke="#EEF1F5" /><text x="34" y={base - t * h + 3} textAnchor="end" fontSize="9" fill="#9AA4B5">{rupiahShort(max * t).replace("Rp ", "")}</text></g>)}
      {labels.map((l, i) => {
        const cx = 40 + slot * i + slot / 2;
        const ha = Math.round((a[i] / max) * h), hb = b ? Math.round((b[i] / max) * h) : 0;
        return (
          <g key={l + i}>
            {b ? (<>
              <rect x={cx - bw - 1} y={base - ha} width={bw} height={ha} rx="2" fill={colorA} />
              <rect x={cx + 1} y={base - hb} width={bw} height={hb} rx="2" fill={colorB} />
            </>) : <rect x={cx - bw / 2} y={base - ha} width={bw} height={ha} rx="2" fill={colorA} />}
            <text x={cx} y={height - 8} textAnchor="middle" fontSize="10" fill="#8A94A6">{l}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Widget({ title, sub, right, children, className = "" }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-lg border border-[#E6EAF0] ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-[#EEF1F5]">
        <div className="min-w-0"><h2 className="text-[13.5px] font-semibold text-[#10365C] truncate">{title}</h2></div>
        <div className="flex items-center gap-3 shrink-0">{sub && <span className="text-[11px] text-[#9AA4B5]">{sub}</span>}{right}</div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function Beranda() {
  const supabase = await createClient();
  const now = new Date();
  const t = now.getTime();
  const months = [...Array(6)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { y: d.getFullYear(), m: d.getMonth(), label: BULAN[d.getMonth()] }; });
  const startYear = new Date(now.getFullYear(), 0, 1);
  const since = new Date(Math.min(startYear.getTime(), new Date(months[0].y, months[0].m, 1).getTime())).toISOString();

  const [{ data: orders }, { data: units }, { data: owns }, konf, taw, ti, kl] = await Promise.all([
    supabase.from("orders").select("id, amount, status, created_at, updated_at, unit_id").gte("created_at", since),
    supabase.from("units").select("id, category, status, price_sell, created_at"),
    supabase.from("ownerships").select("unit_id, cost_basis, share_niagaaja_pct, owner_type").eq("active", true),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "menunggu_konfirmasi"),
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("trade_ins").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("service_claims").select("id", { count: "exact", head: true }).in("status", ["diajukan", "dijadwalkan", "dicek"]),
  ]);
  const O = (orders ?? []) as O[];
  const U = (units ?? []) as U[];
  const ownBy = new Map((owns ?? []).map((o: Own) => [o.unit_id, o]));
  const paid = O.filter((o) => PAID.includes(o.status));
  const margin = (o: O) => { const w = ownBy.get(o.unit_id); if (!w) return 0; return w.owner_type === "sendiri" ? o.amount - w.cost_basis : Math.round((o.amount * Number(w.share_niagaaja_pct)) / 100); };
  const inMonth = (iso: string, y: number, m: number) => { const d = new Date(iso); return d.getFullYear() === y && d.getMonth() === m; };

  // Seri 6 bulan
  const omzet6 = months.map(({ y, m }) => paid.filter((o) => inMonth(o.updated_at, y, m)).reduce((s, o) => s + o.amount, 0));
  const laba6 = months.map(({ y, m }) => paid.filter((o) => inMonth(o.updated_at, y, m)).reduce((s, o) => s + margin(o), 0));
  const unit6 = months.map(({ y, m }) => paid.filter((o) => inMonth(o.updated_at, y, m)).length);
  const beli6 = months.map(({ y, m }) => U.filter((u) => inMonth(u.created_at, y, m) && ownBy.get(u.id)?.owner_type === "sendiri").reduce((s, u) => s + (ownBy.get(u.id)?.cost_basis ?? 0), 0));

  // Watchlist: bulan ini vs tahun berjalan
  const thisM = (iso: string) => inMonth(iso, now.getFullYear(), now.getMonth());
  const ytd = (iso: string) => new Date(iso).getTime() >= startYear.getTime();
  const sumBy = (xs: O[], f: (o: O) => number) => xs.reduce((s, o) => s + f(o), 0);
  const pM = paid.filter((o) => thisM(o.updated_at)), pY = paid.filter((o) => ytd(o.updated_at));
  const buyM = U.filter((u) => thisM(u.created_at) && ownBy.get(u.id)?.owner_type === "sendiri").reduce((s, u) => s + (ownBy.get(u.id)?.cost_basis ?? 0), 0);
  const buyY = U.filter((u) => ytd(u.created_at) && ownBy.get(u.id)?.owner_type === "sendiri").reduce((s, u) => s + (ownBy.get(u.id)?.cost_basis ?? 0), 0);
  const watch: [string, string, string][] = [
    ["Penjualan", rupiah(sumBy(pM, (o) => o.amount)), rupiah(sumBy(pY, (o) => o.amount))],
    ["Laba kotor", rupiah(sumBy(pM, margin)), rupiah(sumBy(pY, margin))],
    ["Unit terjual", String(pM.length), String(pY.length)],
    ["Pembelian stok (modal)", rupiah(buyM), rupiah(buyY)],
    ["Rata-rata per unit", rupiah(pM.length ? Math.round(sumBy(pM, (o) => o.amount) / pM.length) : 0), rupiah(pY.length ? Math.round(sumBy(pY, (o) => o.amount) / pY.length) : 0)],
  ];

  // Tagihan (booking belum dibayar) per umur
  const open = O.filter((o) => ["menunggu_bayar", "menunggu_konfirmasi"].includes(o.status));
  const age = (o: O) => (t - new Date(o.created_at).getTime()) / HOUR;
  const buckets = [["< 6 jam", 0, 6], ["6–12 jam", 6, 12], ["12–24 jam", 12, 24], ["> 24 jam", 24, 1e9]] as const;
  const tagihan = buckets.map(([l, a, b]) => ({ l, v: open.filter((o) => age(o) >= a && age(o) < b).reduce((s, o) => s + o.amount, 0), n: open.filter((o) => age(o) >= a && age(o) < b).length }));
  const totalTagihan = open.reduce((s, o) => s + o.amount, 0);

  // Stok
  const ready = U.filter((u) => u.status === "tersedia");
  const nilaiStok = ready.reduce((s, u) => s + u.price_sell, 0);
  const modalStok = ready.reduce((s, u) => s + (ownBy.get(u.id)?.cost_basis ?? 0), 0);
  const perCat = Object.keys(CATEGORY_LABEL).map((c) => ({ c, n: ready.filter((u) => u.category === c).length, v: ready.filter((u) => u.category === c).reduce((s, u) => s + u.price_sell, 0) })).filter((x) => x.n).sort((a, b) => b.v - a.v);
  const maxCat = Math.max(1, ...perCat.map((x) => x.v));

  const todo = [
    { n: konf.count ?? 0, label: "Bukti bayar perlu dikonfirmasi", href: "/admin/pembayaran" },
    { n: taw.count ?? 0, label: "Penawaran harga belum dijawab", href: "/admin/tawaran" },
    { n: ti.count ?? 0, label: "Pengajuan jual / tukar tambah", href: "/admin/tukar-tambah" },
    { n: kl.count ?? 0, label: "Klaim servis terbuka", href: "/admin/servis" },
    { n: open.filter((o) => age(o) >= 24).length, label: "Booking lewat 24 jam", href: "/admin/pesanan" },
  ];

  const Kpi = ({ label, value, note, color }: { label: string; value: string; note: string; color: string }) => (
    <div className="bg-white rounded-lg border border-[#E6EAF0] p-4 relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
      <p className="text-[12px] text-[#8A94A6]">{label}</p>
      <p className="text-[20px] leading-7 font-bold text-[#10365C] mt-1 break-words">{value}</p>
      <p className="text-[11px] text-[#9AA4B5] mt-0.5">{note}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div><h1 className="text-[20px] font-bold text-[#10365C]">Beranda</h1><p className="text-[12px] text-[#8A94A6]">{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
        <div className="flex gap-2">
          <Link href="/admin/stok/baru" className="h-9 px-3.5 rounded-lg bg-[#2A7DC1] text-white text-[12.5px] font-semibold inline-flex items-center hover:bg-[#1F5F9E]">+ Unit baru</Link>
          <Link href="/admin/laporan" className="h-9 px-3.5 rounded-lg border border-[#E6EAF0] bg-white text-[12.5px] font-semibold text-[#10365C] inline-flex items-center hover:border-[#2A7DC1]">Laporan lengkap</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi label="Penjualan bulan ini" value={rupiah(sumBy(pM, (o) => o.amount))} note={`${pM.length} unit terjual`} color="#2A7DC1" />
        <Kpi label="Laba kotor bulan ini" value={rupiah(sumBy(pM, margin))} note={`margin ${sumBy(pM, (o) => o.amount) ? Math.round((sumBy(pM, margin) / sumBy(pM, (o) => o.amount)) * 100) : 0}%`} color="#1E8A5A" />
        <Kpi label="Menunggu pembayaran" value={rupiah(totalTagihan)} note={`${open.length} booking`} color="#F5A623" />
        <Kpi label="Nilai stok tersedia" value={rupiah(nilaiStok)} note={`${ready.length} unit · modal ${rupiahShort(modalStok)}`} color="#7A4FBF" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Widget title="Penjualan" sub="6 bulan terakhir">
          <Bars labels={months.map((m) => m.label)} a={omzet6} />
          <p className="text-[11px] text-[#9AA4B5] mt-1">Unit terjual: {unit6.join(" · ")}</p>
        </Widget>
        <Widget title="Laba kotor" sub="6 bulan terakhir" right={<span className="flex items-center gap-3 text-[11px] text-[#8A94A6]"><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[#2A7DC1] inline-block" />Penjualan</span><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[#9FD0B8] inline-block" />Laba kotor</span></span>}>
          <Bars labels={months.map((m) => m.label)} a={omzet6} b={laba6} />
        </Widget>

        <Widget title="Tagihan menunggu pembayaran" sub={`total ${rupiah(totalTagihan)}`}>
          <div className="flex flex-col gap-2.5">
            {tagihan.map((b, i) => (
              <div key={b.l} className="flex items-center gap-3 text-[12px]">
                <span className="w-[72px] text-[#8A94A6]">{b.l}</span>
                <div className="flex-1 h-5 rounded bg-[#F0F2F5] overflow-hidden"><div className="h-full rounded" style={{ width: `${totalTagihan ? Math.max(2, (b.v / totalTagihan) * 100) : 0}%`, background: ["#9FC5E8", "#5BA3DB", "#2A7DC1", "#E5636B"][i] }} /></div>
                <span className="w-[92px] text-right font-semibold text-[#10365C]">{rupiahShort(b.v)}</span>
                <span className="w-10 text-right text-[#9AA4B5]">{b.n}×</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#9AA4B5] mt-3">Booking otomatis dibatalkan setelah 24 jam tanpa pembayaran (dicek tiap jam).</p>
        </Widget>
        <Widget title="Pembelian stok" sub="modal unit masuk, 6 bulan">
          <Bars labels={months.map((m) => m.label)} a={beli6} colorA="#F5A623" />
        </Widget>

        <Widget title="Watchlist" right={<Link href="/admin/laporan" className="text-[12px] font-semibold text-[#2A7DC1]">Detail</Link>}>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-[11px] text-[#8A94A6]"><th className="text-left font-medium pb-2">Akun</th><th className="text-right font-medium pb-2">Bulan ini</th><th className="text-right font-medium pb-2">Tahun berjalan</th></tr></thead>
            <tbody>{watch.map(([k, m, y]) => <tr key={k} className="border-t border-[#EEF1F5]"><td className="py-2.5 text-[#2A7DC1] font-medium">{k}</td><td className="py-2.5 text-right">{m}</td><td className="py-2.5 text-right font-semibold text-[#10365C]">{y}</td></tr>)}</tbody>
          </table>
        </Widget>
        <Widget title="Perlu tindakan">
          <ul className="-my-1 divide-y divide-[#EEF1F5]">
            {todo.map((x) => (
              <li key={x.label}><Link href={x.href} className="flex items-center gap-3 py-2.5 group">
                <span className={`min-w-7 h-7 px-2 rounded-md inline-flex items-center justify-center text-[12px] font-bold ${x.n ? "bg-[#FFF4E0] text-[#C77A00]" : "bg-[#F0F2F5] text-[#9AA4B5]"}`}>{x.n}</span>
                <span className={`flex-1 text-[13px] ${x.n ? "text-[#10365C] font-medium" : "text-[#9AA4B5]"}`}>{x.label}</span>
                <span className="text-[#C3CAD5] group-hover:text-[#2A7DC1]">›</span>
              </Link></li>
            ))}
          </ul>
        </Widget>

        <Widget title="Stok per kategori" sub={`${ready.length} unit tersedia`} className="lg:col-span-2">
          {perCat.length ? (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {perCat.map((x) => (
                <div key={x.c} className="flex items-center gap-3 text-[12px]">
                  <span className="w-20 text-[#4A5568]">{CATEGORY_LABEL[x.c as keyof typeof CATEGORY_LABEL]}</span>
                  <div className="flex-1 h-4 rounded bg-[#F0F2F5] overflow-hidden"><div className="h-full rounded bg-[#2A7DC1]" style={{ width: `${(x.v / maxCat) * 100}%` }} /></div>
                  <span className="w-8 text-right text-[#9AA4B5]">{x.n}</span>
                  <span className="w-20 text-right font-semibold text-[#10365C]">{rupiahShort(x.v)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#9AA4B5]">Belum ada stok tersedia.</p>}
        </Widget>
      </div>
    </div>
  );
}

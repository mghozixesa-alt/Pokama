import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rupiah, rupiahShort, CATEGORY_LABEL, SOURCE_LABEL } from "@/lib/format";

export const metadata = { title: "Admin" };

const PAID = ["dibayar", "disiapkan", "dikirim", "selesai"];
const DAY = 24 * 3600 * 1000;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

type O = { id: string; amount: number; status: string; created_at: string; updated_at: string; offer_id: string | null; unit_id: string; units: { category: string; source: string; brand: string; model: string } | null };
type U = { id: string; public_id: string; brand: string; model: string; category: string; source: string; status: string; price_sell: number; created_at: string };
type Own = { unit_id: string; cost_basis: number; share_niagaaja_pct: number; owner_type: string };

export default async function AdminHome() {
  const supabase = await createClient();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since60 = new Date(now - 60 * DAY).toISOString();
  const [{ data: orders }, { data: units }, { data: owns }, { data: offers }, konfirmasi, tawaranOpen, klaim, tradeIns] = await Promise.all([
    supabase.from("orders").select("id, amount, status, created_at, updated_at, offer_id, unit_id, units(category, source, brand, model)").gte("created_at", since60),
    supabase.from("units").select("id, public_id, brand, model, category, source, status, price_sell, created_at"),
    supabase.from("ownerships").select("unit_id, cost_basis, share_niagaaja_pct, owner_type").eq("active", true),
    supabase.from("offers").select("id, status, created_at").gte("created_at", since30),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "menunggu_konfirmasi"),
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("service_claims").select("id", { count: "exact", head: true }).in("status", ["diajukan", "dijadwalkan", "dicek"]),
    supabase.from("trade_ins").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
  ]);
  const O = (orders ?? []) as unknown as O[];
  const U = (units ?? []) as U[];
  const ownBy = new Map((owns ?? []).map((o: Own) => [o.unit_id, o]));

  // ---- Omzet & margin ----
  const paid = O.filter((o) => PAID.includes(o.status));
  const inWindow = (o: O, days: number) => new Date(o.updated_at).getTime() >= now - days * DAY;
  const sum = (xs: O[]) => xs.reduce((s, o) => s + o.amount, 0);
  const marginOf = (o: O) => {
    const ow = ownBy.get(o.unit_id);
    if (!ow) return 0;
    return ow.owner_type === "sendiri" ? o.amount - ow.cost_basis : Math.round((o.amount * Number(ow.share_niagaaja_pct)) / 100);
  };
  const p1 = paid.filter((o) => inWindow(o, 1)), p7 = paid.filter((o) => inWindow(o, 7)), p30 = paid.filter((o) => inWindow(o, 30));
  const prev30 = paid.filter((o) => { const t = new Date(o.updated_at).getTime(); return t < now - 30 * DAY && t >= now - 60 * DAY; });
  const margin30 = p30.reduce((s, o) => s + marginOf(o), 0);
  const growth = sum(prev30) ? Math.round(((sum(p30) - sum(prev30)) / sum(prev30)) * 100) : null;

  // ---- Grafik 14 hari ----
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(now - (13 - i) * DAY); const key = d.toISOString().slice(0, 10);
    const v = paid.filter((o) => o.updated_at.slice(0, 10) === key).reduce((s, o) => s + o.amount, 0);
    return { key, label: d.getDate(), v };
  });
  const maxV = Math.max(1, ...days.map((d) => d.v));

  // ---- Stok ----
  const tersedia = U.filter((u) => u.status === "tersedia");
  const nilaiStok = tersedia.reduce((s, u) => s + u.price_sell, 0);
  const modalStok = tersedia.reduce((s, u) => s + (ownBy.get(u.id)?.cost_basis ?? 0), 0);
  const ageDays = (u: U) => Math.floor((now - new Date(u.created_at).getTime()) / DAY);
  const aging = { muda: tersedia.filter((u) => ageDays(u) < 14).length, sedang: tersedia.filter((u) => ageDays(u) >= 14 && ageDays(u) <= 30).length, tua: tersedia.filter((u) => ageDays(u) > 30) };
  const byCat = Object.keys(CATEGORY_LABEL).map((c) => ({ c, stok: tersedia.filter((u) => u.category === c).length, laku: p30.filter((o) => o.units?.category === c).length, omzet: sum(p30.filter((o) => o.units?.category === c)) })).filter((x) => x.stok || x.laku);
  const bySource = Object.keys(SOURCE_LABEL).map((s) => ({ s, n: U.filter((u) => u.source === s && u.status !== "masuk").length })).filter((x) => x.n);

  // ---- Konversi ----
  const o30 = O.filter((o) => new Date(o.created_at).getTime() >= now - 30 * DAY);
  const paidRate = pct(o30.filter((o) => PAID.includes(o.status)).length, o30.length);
  const cancelRate = pct(o30.filter((o) => o.status === "dibatalkan").length, o30.length);
  const of30 = offers ?? [];
  const offerAccept = pct(of30.filter((o) => o.status === "disetujui").length, of30.length);
  const fromOffer = pct(o30.filter((o) => o.offer_id).length, o30.length);
  const avgTicket = p30.length ? Math.round(sum(p30) / p30.length) : 0;

  const Stat = ({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) => {
    const body = (<><p className="text-[11px] text-muted">{label}</p><p className="text-[20px] leading-6 font-bold text-brand-navy mt-1 break-words">{value}</p>{sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}</>);
    return href ? <Link href={href} className="card p-3.5 block">{body}</Link> : <div className="card p-3.5">{body}</div>;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h1 className="text-[22px] font-bold text-brand-navy">Dasbor</h1>
        <p className="text-[11px] text-muted">Data 30 hari terakhir kecuali disebut lain · {new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
      </div>

      {/* Perlu tindakan */}
      <section>
        <h2 className="text-sm font-semibold text-brand-navy mb-2">Perlu tindakan</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Bukti bayar perlu konfirmasi" value={String(konfirmasi.count ?? 0)} href="/admin/pembayaran" />
          <Stat label="Tawaran belum dijawab" value={String(tawaranOpen.count ?? 0)} href="/admin/tawaran" />
          <Stat label="Pengajuan jual/tukar baru" value={String(tradeIns.count ?? 0)} href="/admin/tukar-tambah" />
          <Stat label="Klaim servis terbuka" value={String(klaim.count ?? 0)} href="/admin/servis" />
        </div>
      </section>

      {/* Penjualan */}
      <section>
        <h2 className="text-sm font-semibold text-brand-navy mb-2">Penjualan (pesanan terbayar)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Hari ini" value={rupiah(sum(p1))} sub={`${p1.length} pesanan`} />
          <Stat label="7 hari" value={rupiah(sum(p7))} sub={`${p7.length} pesanan`} />
          <Stat label="30 hari" value={rupiah(sum(p30))} sub={growth === null ? `${p30.length} pesanan` : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% vs 30 hari sebelumnya`} />
          <Stat label="Margin kotor 30 hari" value={rupiah(margin30)} sub={`${pct(margin30, sum(p30))} dari omzet · tiket rata-rata ${rupiahShort(avgTicket)}`} />
        </div>
        <div className="card p-4 mt-3">
          <div className="flex items-center justify-between"><p className="text-[12px] font-semibold text-brand-navy">Omzet harian, 14 hari</p><p className="text-[11px] text-muted">puncak {rupiahShort(maxV)}</p></div>
          <svg viewBox="0 0 420 120" className="w-full h-28 mt-2" role="img" aria-label="Grafik omzet 14 hari">
            {days.map((d, i) => {
              const h = Math.round((d.v / maxV) * 88); const x = 8 + i * 29.5;
              return (
                <g key={d.key}>
                  <rect x={x} y={96 - h} width="20" height={h} rx="4" fill={i === 13 ? "#2A7DC1" : "#BFD8F0"} />
                  <text x={x + 10} y="112" textAnchor="middle" fontSize="10" fill="#8a93a6">{d.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Stok */}
      <section>
        <h2 className="text-sm font-semibold text-brand-navy mb-2">Stok</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Unit tersedia" value={String(tersedia.length)} sub={`${U.filter((u) => u.status === "dipesan").length} dipesan · ${U.filter((u) => u.status === "masuk").length} belum dicek`} href="/admin/stok?status=tersedia" />
          <Stat label="Nilai jual stok" value={rupiah(nilaiStok)} sub={`modal ${rupiahShort(modalStok)} · potensi margin ${rupiahShort(nilaiStok - modalStok)}`} />
          <Stat label="Umur stok" value={`${aging.muda} / ${aging.sedang} / ${aging.tua.length}`} sub="<14 hr / 14–30 hr / >30 hr" />
          <Stat label="Dititip ke Rentalaja" value={String(U.filter((u) => u.status === "dititip_rentalaja").length)} href="/admin/stok?status=dititip_rentalaja" />
        </div>
        <div className="grid lg:grid-cols-2 gap-3 mt-3">
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Per kategori — stok vs laku 30 hari</p>
            <table className="w-full text-[12px]">
              <thead><tr className="text-muted text-left"><th className="font-medium pb-1">Kategori</th><th className="font-medium text-right">Stok</th><th className="font-medium text-right">Laku</th><th className="font-medium text-right">Omzet</th></tr></thead>
              <tbody>{byCat.map((r) => <tr key={r.c} className="border-t border-page"><td className="py-1.5">{CATEGORY_LABEL[r.c as keyof typeof CATEGORY_LABEL]}</td><td className="text-right">{r.stok}</td><td className="text-right">{r.laku}</td><td className="text-right font-semibold text-brand-navy">{rupiahShort(r.omzet)}</td></tr>)}</tbody>
            </table>
            {!byCat.length && <p className="text-[12px] text-muted">Belum ada data.</p>}
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Stok &gt; 30 hari (perlu turun harga / promo)</p>
            {aging.tua.length ? (
              <ul className="flex flex-col divide-y divide-page">
                {aging.tua.sort((a, b) => ageDays(b) - ageDays(a)).slice(0, 8).map((u) => (
                  <li key={u.id} className="py-1.5 flex items-center gap-2 text-[12px]"><Link href={`/admin/stok/${u.id}`} className="flex-1 min-w-0 truncate font-semibold">{u.brand} {u.model}</Link><span className="text-muted">{ageDays(u)} hr</span><span className="font-semibold text-brand-navy">{rupiahShort(u.price_sell)}</span></li>
                ))}
              </ul>
            ) : <p className="text-[12px] text-muted">Tidak ada — stok berputar sehat.</p>}
            <p className="text-[12px] font-semibold text-brand-navy mt-4 mb-1">Sumber stok</p>
            <div className="flex flex-wrap gap-1.5">{bySource.map((x) => <span key={x.s} className="px-2 h-6 inline-flex items-center rounded-md bg-page text-[11px]">{SOURCE_LABEL[x.s as keyof typeof SOURCE_LABEL]} · <b className="ml-1">{x.n}</b></span>)}</div>
          </div>
        </div>
      </section>

      {/* Konversi */}
      <section>
        <h2 className="text-sm font-semibold text-brand-navy mb-2">Konversi 30 hari</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Booking → terbayar" value={paidRate} sub={`${o30.length} booking dibuat`} />
          <Stat label="Booking batal / kedaluwarsa" value={cancelRate} />
          <Stat label="Tawaran disetujui" value={offerAccept} sub={`${of30.length} tawaran masuk`} />
          <Stat label="Pesanan lewat tawaran" value={fromOffer} sub="porsi booking yang berawal dari tawar" />
        </div>
      </section>

      <div className="card p-4 text-[12px] text-muted">
        <b className="text-brand-navy">Alur harian:</b> konfirmasi bukti bayar → jawab tawaran → input unit baru + sertifikat cek → ubah status pesanan (disiapkan → dikirim → selesai). Garansi aktif otomatis saat pesanan <i>selesai</i>. Margin memakai <i>cost basis</i> di kepemilikan unit — isi saat input stok supaya angkanya benar.
      </div>
    </div>
  );
}

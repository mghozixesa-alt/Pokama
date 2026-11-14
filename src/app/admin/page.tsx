import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rupiah, rupiahShort, CATEGORY_LABEL, SOURCE_LABEL } from "@/lib/format";

export const metadata = { title: "Admin" };

const PAID = ["dibayar", "disiapkan", "dikirim", "selesai"];
const DAY = 24 * 3600 * 1000;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

type O = { id: string; amount: number; status: string; created_at: string; updated_at: string; offer_id: string | null; unit_id: string; customer_id: string; units: { category: string; source: string; brand: string; model: string; grade: string | null } | null; profiles: { full_name: string | null } | null };
type U = { id: string; public_id: string; brand: string; model: string; category: string; source: string; status: string; grade: string | null; price_sell: number; created_at: string };
type Own = { unit_id: string; cost_basis: number; share_niagaaja_pct: number; owner_type: string };
type Off = { id: string; status: string; amount: number; counter_amount: number | null; created_at: string; units: { price_sell: number } | null };
type T = { id: string; status: string; estimate_low: number | null; estimate_high: number | null; final_price: number | null; created_at: string };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const sp = await searchParams;
  const P = [7, 30, 90].includes(Number(sp.periode)) ? Number(sp.periode) : 30;
  const supabase = await createClient();
  const now = Date.now();
  const sinceP = new Date(now - P * DAY).toISOString();
  const since2P = new Date(now - 2 * P * DAY).toISOString();
  const since90 = new Date(now - 91 * DAY).toISOString();
  const [{ data: orders }, { data: allOrders }, { data: units }, { data: owns }, { data: offers }, { data: tradeIns }, konfirmasi, tawaranOpen, klaim, tradeOpen, { data: claims }] = await Promise.all([
    supabase.from("orders").select("id, amount, status, created_at, updated_at, offer_id, unit_id, customer_id, units(category, source, brand, model, grade), profiles(full_name)").gte("created_at", since2P < since90 ? since2P : since90),
    supabase.from("orders").select("customer_id, created_at, status"),
    supabase.from("units").select("id, public_id, brand, model, category, source, status, grade, price_sell, created_at"),
    supabase.from("ownerships").select("unit_id, cost_basis, share_niagaaja_pct, owner_type").eq("active", true),
    supabase.from("offers").select("id, status, amount, counter_amount, created_at, units(price_sell)").gte("created_at", sinceP),
    supabase.from("trade_ins").select("id, status, estimate_low, estimate_high, final_price, created_at").gte("created_at", sinceP),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "menunggu_konfirmasi"),
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("service_claims").select("id", { count: "exact", head: true }).in("status", ["diajukan", "dijadwalkan", "dicek"]),
    supabase.from("trade_ins").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("service_claims").select("id, status, created_at").gte("created_at", sinceP),
  ]);
  const O = (orders ?? []) as unknown as O[];
  const U = (units ?? []) as U[];
  const ownBy = new Map((owns ?? []).map((o: Own) => [o.unit_id, o]));

  // ---- Penjualan ----
  const paid = O.filter((o) => PAID.includes(o.status));
  const tPaid = (o: O) => new Date(o.updated_at).getTime();
  const sum = (xs: O[]) => xs.reduce((s, o) => s + o.amount, 0);
  const marginOf = (o: O) => { const ow = ownBy.get(o.unit_id); if (!ow) return 0; return ow.owner_type === "sendiri" ? o.amount - ow.cost_basis : Math.round((o.amount * Number(ow.share_niagaaja_pct)) / 100); };
  const p1 = paid.filter((o) => tPaid(o) >= now - DAY), pP = paid.filter((o) => tPaid(o) >= now - P * DAY);
  const prevP = paid.filter((o) => tPaid(o) < now - P * DAY && tPaid(o) >= now - 2 * P * DAY);
  const marginP = pP.reduce((s, o) => s + marginOf(o), 0);
  const growth = sum(prevP) ? Math.round(((sum(pP) - sum(prevP)) / sum(prevP)) * 100) : null;
  const avgTicket = pP.length ? Math.round(sum(pP) / pP.length) : 0;
  const piutang = O.filter((o) => ["menunggu_bayar", "menunggu_konfirmasi"].includes(o.status));

  // ---- Tren 12 minggu ----
  const weeks = [...Array(12)].map((_, i) => {
    const end = now - (11 - i) * 7 * DAY, start = end - 7 * DAY;
    const xs = paid.filter((o) => tPaid(o) >= start && tPaid(o) < end);
    return { label: new Date(start).toLocaleDateString("id-ID", { day: "numeric", month: "short" }), v: sum(xs), n: xs.length };
  });
  const maxW = Math.max(1, ...weeks.map((w) => w.v));

  // ---- Produk & pelanggan ----
  const byModel = new Map<string, { n: number; omzet: number; margin: number }>();
  for (const o of pP) { const k = `${o.units?.brand ?? ""} ${o.units?.model ?? ""}`.trim() || "?"; const m = byModel.get(k) ?? { n: 0, omzet: 0, margin: 0 }; m.n++; m.omzet += o.amount; m.margin += marginOf(o); byModel.set(k, m); }
  const topModels = [...byModel.entries()].sort((a, b) => b[1].n - a[1].n || b[1].omzet - a[1].omzet).slice(0, 6);
  const bestMargin = pP.map((o) => ({ o, m: marginOf(o) })).sort((a, b) => b.m - a.m).slice(0, 5);
  const firstOrderAt = new Map<string, number>();
  for (const o of (allOrders ?? []) as { customer_id: string; created_at: string; status: string }[]) { const t = new Date(o.created_at).getTime(); if (!firstOrderAt.has(o.customer_id) || t < firstOrderAt.get(o.customer_id)!) firstOrderAt.set(o.customer_id, t); }
  const buyersP = new Set(pP.map((o) => o.customer_id));
  const newBuyers = [...buyersP].filter((c) => (firstOrderAt.get(c) ?? 0) >= now - P * DAY).length;
  const topCustomers = (() => { const m = new Map<string, { name: string; n: number; total: number }>(); for (const o of pP) { const k = o.customer_id; const c = m.get(k) ?? { name: o.profiles?.full_name ?? "Pelanggan", n: 0, total: 0 }; c.n++; c.total += o.amount; m.set(k, c); } return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 5); })();

  // ---- Stok ----
  const tersedia = U.filter((u) => u.status === "tersedia");
  const nilaiStok = tersedia.reduce((s, u) => s + u.price_sell, 0);
  const modalStok = tersedia.reduce((s, u) => s + (ownBy.get(u.id)?.cost_basis ?? 0), 0);
  const ageDays = (u: U) => Math.floor((now - new Date(u.created_at).getTime()) / DAY);
  const aging = { muda: tersedia.filter((u) => ageDays(u) < 14).length, sedang: tersedia.filter((u) => ageDays(u) >= 14 && ageDays(u) <= 30).length, tua: tersedia.filter((u) => ageDays(u) > 30) };
  const byCat = Object.keys(CATEGORY_LABEL).map((c) => ({ c, stok: tersedia.filter((u) => u.category === c).length, laku: pP.filter((o) => o.units?.category === c).length, omzet: sum(pP.filter((o) => o.units?.category === c)) })).filter((x) => x.stok || x.laku);
  const byGrade = ["A", "B", "C", null].map((g) => ({ g: g ?? "belum", stok: tersedia.filter((u) => u.grade === g).length, laku: pP.filter((o) => (o.units?.grade ?? null) === g).length }));
  const byOwner = ["sendiri", "investor", "titipan"].map((t) => { const us = tersedia.filter((u) => ownBy.get(u.id)?.owner_type === t); return { t, n: us.length, nilai: us.reduce((s, u) => s + u.price_sell, 0), modal: us.reduce((s, u) => s + (ownBy.get(u.id)?.cost_basis ?? 0), 0) }; });
  const bySource = Object.keys(SOURCE_LABEL).map((s) => ({ s, n: U.filter((u) => u.source === s && u.status !== "masuk").length })).filter((x) => x.n);
  const soldDays = pP.map((o) => { const u = U.find((x) => x.id === o.unit_id); return u ? Math.max(0, Math.floor((tPaid(o) - new Date(u.created_at).getTime()) / DAY)) : null; }).filter((x): x is number => x !== null);
  const avgDaysToSell = soldDays.length ? Math.round(soldDays.reduce((a, b) => a + b, 0) / soldDays.length) : null;

  // ---- Konversi ----
  const oP = O.filter((o) => new Date(o.created_at).getTime() >= now - P * DAY);
  const OF = (offers ?? []) as unknown as Off[];
  const offerPct = OF.filter((o) => o.units?.price_sell).map((o) => (o.amount / o.units!.price_sell) * 100);
  const avgOfferPct = offerPct.length ? Math.round(offerPct.reduce((a, b) => a + b, 0) / offerPct.length) : null;
  const TI = (tradeIns ?? []) as T[];
  const tiDeal = TI.filter((t) => t.status === "deal");
  const tiFinalVsEst = tiDeal.filter((t) => t.final_price && t.estimate_low && t.estimate_high).map((t) => (t.final_price! / ((t.estimate_low! + t.estimate_high!) / 2)) * 100);
  const CL = (claims ?? []) as { status: string }[];

  const Stat = ({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) => {
    const body = (<><p className="text-[11px] text-muted">{label}</p><p className="text-[20px] leading-6 font-bold text-brand-navy mt-1 break-words">{value}</p>{sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}</>);
    return href ? <Link href={href} className="card p-3.5 block">{body}</Link> : <div className="card p-3.5">{body}</div>;
  };
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="text-sm font-semibold text-brand-navy mb-2">{children}</h2>;
  const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => <th className={`font-medium pb-1 ${right ? "text-right" : "text-left"}`}>{children}</th>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div><h1 className="text-[22px] font-bold text-brand-navy">Dasbor</h1><p className="text-[11px] text-muted">{new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p></div>
        <div className="flex items-center gap-1.5">
          {[7, 30, 90].map((d) => <Link key={d} href={`/admin?periode=${d}`} className={`h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center ${P === d ? "bg-brand-navy text-white" : "bg-white border border-line text-muted"}`}>{d} hari</Link>)}
          <a href="/admin/ekspor?jenis=penjualan" className="h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center bg-brand-light text-brand-dark">CSV penjualan</a>
          <a href="/admin/ekspor?jenis=stok" className="h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center bg-brand-light text-brand-dark">CSV stok</a>
        </div>
      </div>

      <section>
        <H>Perlu tindakan</H>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Bukti bayar perlu konfirmasi" value={String(konfirmasi.count ?? 0)} href="/admin/pembayaran" />
          <Stat label="Tawaran belum dijawab" value={String(tawaranOpen.count ?? 0)} href="/admin/tawaran" />
          <Stat label="Pengajuan jual/tukar baru" value={String(tradeOpen.count ?? 0)} href="/admin/tukar-tambah" />
          <Stat label="Klaim servis terbuka" value={String(klaim.count ?? 0)} href="/admin/servis" />
        </div>
      </section>

      <section>
        <H>Penjualan {P} hari (pesanan terbayar)</H>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Hari ini" value={rupiah(sum(p1))} sub={`${p1.length} pesanan`} />
          <Stat label={`Omzet ${P} hari`} value={rupiah(sum(pP))} sub={`${pP.length} pesanan · ${growth === null ? "belum ada pembanding" : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% vs ${P} hari sebelumnya`}`} />
          <Stat label="Margin kotor" value={rupiah(marginP)} sub={`${pct(marginP, sum(pP))} dari omzet · tiket rata-rata ${rupiahShort(avgTicket)}`} />
          <Stat label="Booking belum dibayar" value={rupiah(sum(piutang))} sub={`${piutang.length} pesanan menunggu bayar/konfirmasi`} href="/admin/pesanan" />
        </div>
        <div className="card p-4 mt-3">
          <div className="flex items-center justify-between"><p className="text-[12px] font-semibold text-brand-navy">Omzet mingguan, 12 minggu</p><p className="text-[11px] text-muted">puncak {rupiahShort(maxW)} · angka = jumlah pesanan</p></div>
          <svg viewBox="0 0 480 130" className="w-full h-32 mt-2" role="img" aria-label="Grafik omzet mingguan">
            {weeks.map((w, i) => { const h = Math.round((w.v / maxW) * 86); const x = 10 + i * 39; return (
              <g key={i}>
                <rect x={x} y={100 - h} width="26" height={h} rx="4" fill={i === 11 ? "#2A7DC1" : "#BFD8F0"} />
                {w.n > 0 && <text x={x + 13} y={96 - h} textAnchor="middle" fontSize="9" fontWeight="600" fill="#10365C">{w.n}</text>}
                <text x={x + 13} y="118" textAnchor="middle" fontSize="8.5" fill="#8a93a6">{w.label}</text>
              </g>); })}
          </svg>
        </div>
        <div className="grid lg:grid-cols-3 gap-3 mt-3">
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Model terlaris</p>
            <table className="w-full text-[12px]"><thead><tr className="text-muted"><Th>Model</Th><Th right>Laku</Th><Th right>Omzet</Th><Th right>Margin</Th></tr></thead>
              <tbody>{topModels.map(([k, v]) => <tr key={k} className="border-t border-page"><td className="py-1.5 truncate max-w-[140px]">{k}</td><td className="text-right">{v.n}</td><td className="text-right">{rupiahShort(v.omzet)}</td><td className="text-right font-semibold text-brand-navy">{rupiahShort(v.margin)}</td></tr>)}</tbody></table>
            {!topModels.length && <p className="text-[12px] text-muted">Belum ada penjualan.</p>}
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Margin terbaik per unit</p>
            <ul className="flex flex-col divide-y divide-page text-[12px]">{bestMargin.map(({ o, m }) => <li key={o.id} className="py-1.5 flex gap-2"><span className="flex-1 truncate">{o.units?.brand} {o.units?.model}</span><span className="text-muted">{rupiahShort(o.amount)}</span><span className="font-semibold text-brand-navy">+{rupiahShort(m)}</span></li>)}</ul>
            {!bestMargin.length && <p className="text-[12px] text-muted">Belum ada data.</p>}
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Pelanggan</p>
            <div className="grid grid-cols-2 gap-2 text-[12px] mb-2">
              <div className="rounded-xl bg-page p-2"><p className="text-muted text-[10px]">Pembeli</p><p className="font-bold text-brand-navy text-[16px]">{buyersP.size}</p></div>
              <div className="rounded-xl bg-page p-2"><p className="text-muted text-[10px]">Baru / kembali</p><p className="font-bold text-brand-navy text-[16px]">{newBuyers} / {buyersP.size - newBuyers}</p></div>
            </div>
            <ul className="flex flex-col divide-y divide-page text-[12px]">{topCustomers.map((c, i) => <li key={i} className="py-1.5 flex gap-2"><span className="flex-1 truncate">{c.name}</span><span className="text-muted">{c.n}×</span><span className="font-semibold text-brand-navy">{rupiahShort(c.total)}</span></li>)}</ul>
          </div>
        </div>
      </section>

      <section>
        <H>Stok</H>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Unit tersedia" value={String(tersedia.length)} sub={`${U.filter((u) => u.status === "dipesan").length} dipesan · ${U.filter((u) => u.status === "masuk" || u.status === "qc").length} belum dicek`} href="/admin/stok?status=tersedia" />
          <Stat label="Nilai jual stok" value={rupiah(nilaiStok)} sub={`modal ${rupiahShort(modalStok)} · potensi margin ${rupiahShort(nilaiStok - modalStok)}`} />
          <Stat label="Umur stok" value={`${aging.muda} / ${aging.sedang} / ${aging.tua.length}`} sub={`<14 / 14–30 / >30 hari · rata-rata laku ${avgDaysToSell === null ? "–" : `${avgDaysToSell} hari`}`} />
          <Stat label="Dititip ke Rentalaja" value={String(U.filter((u) => u.status === "dititip_rentalaja").length)} href="/admin/stok?status=dititip_rentalaja" />
        </div>
        <div className="grid lg:grid-cols-3 gap-3 mt-3">
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Per kategori — stok vs laku</p>
            <table className="w-full text-[12px]"><thead><tr className="text-muted"><Th>Kategori</Th><Th right>Stok</Th><Th right>Laku</Th><Th right>Omzet</Th></tr></thead>
              <tbody>{byCat.map((r) => <tr key={r.c} className="border-t border-page"><td className="py-1.5">{CATEGORY_LABEL[r.c as keyof typeof CATEGORY_LABEL]}</td><td className="text-right">{r.stok}</td><td className="text-right">{r.laku}</td><td className="text-right font-semibold text-brand-navy">{rupiahShort(r.omzet)}</td></tr>)}</tbody></table>
            <p className="text-[12px] font-semibold text-brand-navy mt-4 mb-1">Per grade — stok / laku</p>
            <div className="flex gap-1.5 flex-wrap">{byGrade.map((g) => <span key={g.g} className="px-2 h-6 inline-flex items-center rounded-md bg-page text-[11px]">Grade {g.g}: <b className="ml-1">{g.stok}</b><span className="text-muted ml-1">/ {g.laku}</span></span>)}</div>
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Per pemilik — eksposur modal</p>
            <table className="w-full text-[12px]"><thead><tr className="text-muted"><Th>Pemilik</Th><Th right>Unit</Th><Th right>Modal</Th><Th right>Nilai jual</Th></tr></thead>
              <tbody>{byOwner.map((r) => <tr key={r.t} className="border-t border-page"><td className="py-1.5 capitalize">{r.t}</td><td className="text-right">{r.n}</td><td className="text-right">{rupiahShort(r.modal)}</td><td className="text-right font-semibold text-brand-navy">{rupiahShort(r.nilai)}</td></tr>)}</tbody></table>
            <p className="text-[12px] font-semibold text-brand-navy mt-4 mb-1">Sumber stok</p>
            <div className="flex flex-wrap gap-1.5">{bySource.map((x) => <span key={x.s} className="px-2 h-6 inline-flex items-center rounded-md bg-page text-[11px]">{SOURCE_LABEL[x.s as keyof typeof SOURCE_LABEL]} · <b className="ml-1">{x.n}</b></span>)}</div>
          </div>
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-brand-navy mb-2">Stok &gt; 30 hari (perlu turun harga / promo)</p>
            {aging.tua.length ? (
              <ul className="flex flex-col divide-y divide-page">{aging.tua.sort((a, b) => ageDays(b) - ageDays(a)).slice(0, 8).map((u) => (
                <li key={u.id} className="py-1.5 flex items-center gap-2 text-[12px]"><Link href={`/admin/stok/${u.id}`} className="flex-1 min-w-0 truncate font-semibold">{u.brand} {u.model}</Link><span className="text-muted">{ageDays(u)} hr</span><span className="font-semibold text-brand-navy">{rupiahShort(u.price_sell)}</span></li>))}</ul>
            ) : <p className="text-[12px] text-muted">Tidak ada — stok berputar sehat.</p>}
          </div>
        </div>
      </section>

      <section>
        <H>Konversi & interaksi {P} hari</H>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Booking → terbayar" value={pct(oP.filter((o) => PAID.includes(o.status)).length, oP.length)} sub={`${oP.length} booking · ${pct(oP.filter((o) => o.status === "dibatalkan").length, oP.length)} batal`} />
          <Stat label="Tawaran disetujui" value={pct(OF.filter((o) => ["disetujui", "dipakai"].includes(o.status)).length, OF.length)} sub={`${OF.length} tawaran · rata-rata ${avgOfferPct === null ? "–" : `${avgOfferPct}%`} dari harga · ${pct(oP.filter((o) => o.offer_id).length, oP.length)} pesanan via tawar`} />
          <Stat label="Jual/tukar tambah deal" value={pct(tiDeal.length, TI.length)} sub={`${TI.length} pengajuan · harga final ${tiFinalVsEst.length ? `${Math.round(tiFinalVsEst.reduce((a, b) => a + b, 0) / tiFinalVsEst.length)}% dari estimasi` : "–"} · dibeli ${rupiahShort(tiDeal.reduce((s, t) => s + (t.final_price ?? 0), 0))}`} />
          <Stat label="Klaim servis" value={String(CL.length)} sub={`${pct(CL.filter((c) => ["diperbaiki", "ditukar"].includes(c.status)).length, CL.length)} masuk garansi · ${pct(CL.length, pP.length)} dari penjualan`} />
        </div>
      </section>

      <div className="card p-4 text-[12px] text-muted">
        <b className="text-brand-navy">Catatan:</b> margin memakai <i>cost basis</i> di kepemilikan unit (unit titipan/investor dihitung bagian Niagaaja). Omzet dihitung saat pembayaran dikonfirmasi. CSV bisa dibuka di Google Sheets untuk Keuangan.
      </div>
    </div>
  );
}

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

  // Komponen tampilan (gaya dasbor akuntansi: bersih, padat, bergaris bantu)
  const Stat = ({ label, value, sub, href, tone = "navy", spark }: { label: string; value: string; sub?: string; href?: string; tone?: "navy" | "green" | "amber" | "red" | "blue"; spark?: number[] }) => {
    const color = { navy: "#10365C", green: "#1E8A5A", amber: "#C77A00", red: "#C0392B", blue: "#2A7DC1" }[tone];
    const max = spark ? Math.max(1, ...spark) : 1;
    const body = (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[11px] font-medium text-muted">{label}</p><p className="text-[22px] leading-7 font-bold mt-1 break-words" style={{ color }}>{value}</p>{sub && <p className="text-[11px] text-muted mt-1 leading-4">{sub}</p>}</div>
        {spark && <svg viewBox="0 0 60 28" className="w-[60px] h-7 shrink-0 mt-1">{spark.map((v, i) => <rect key={i} x={i * (60 / spark.length)} y={28 - Math.round((v / max) * 26)} width={60 / spark.length - 2} height={Math.round((v / max) * 26)} rx="1.5" fill={i === spark.length - 1 ? color : "#D6E4F2"} />)}</svg>}
      </div>
    );
    return href ? <Link href={href} className="card p-4 block hover:border-brand transition-colors">{body}</Link> : <div className="card p-4">{body}</div>;
  };
  const Panel = ({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) => (
    <div className={`card ${className}`}><div className="flex items-center justify-between px-4 h-11 border-b border-line"><p className="text-[13px] font-semibold text-brand-navy">{title}</p>{right}</div><div className="p-4">{children}</div></div>
  );
  const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => <th className={`font-medium text-[11px] text-muted pb-2 ${right ? "text-right" : "text-left"}`}>{children}</th>;
  const Td = ({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) => <td className={`py-2 border-t border-page ${right ? "text-right" : ""} ${bold ? "font-semibold text-brand-navy" : ""}`}>{children}</td>;
  const daily = [...Array(14)].map((_, i) => { const d = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10); return paid.filter((o) => o.updated_at.slice(0, 10) === d).reduce((s, o) => s + o.amount, 0); });
  const todo = [
    { n: konfirmasi.count ?? 0, label: "Bukti bayar perlu konfirmasi", href: "/admin/pembayaran", tone: "#C77A00" },
    { n: tawaranOpen.count ?? 0, label: "Tawaran belum dijawab", href: "/admin/tawaran", tone: "#2A7DC1" },
    { n: tradeOpen.count ?? 0, label: "Pengajuan jual/tukar baru", href: "/admin/tukar-tambah", tone: "#1E8A5A" },
    { n: klaim.count ?? 0, label: "Klaim servis terbuka", href: "/admin/servis", tone: "#C0392B" },
    { n: piutang.length, label: "Booking menunggu pembayaran", href: "/admin/pesanan", tone: "#8a93a6" },
    { n: aging.tua.length, label: "Stok > 30 hari belum laku", href: "/admin/stok?status=tersedia", tone: "#8a93a6" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header halaman */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><h1 className="text-[22px] leading-7 font-bold text-brand-navy">Dasbor</h1><p className="text-[12px] text-muted mt-0.5">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · data {P} hari terakhir</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
            {[7, 30, 90].map((d) => <Link key={d} href={`/admin?periode=${d}`} className={`h-8 px-3 rounded-md text-[12px] font-semibold inline-flex items-center ${P === d ? "bg-brand-navy text-white" : "text-muted hover:text-brand-navy"}`}>{d} hari</Link>)}
          </div>
          <a href="/admin/ekspor?jenis=penjualan" className="h-9 px-3 rounded-lg border border-line bg-white text-[12px] font-semibold inline-flex items-center text-brand-navy hover:border-brand">⇩ Penjualan CSV</a>
          <a href="/admin/ekspor?jenis=stok" className="h-9 px-3 rounded-lg border border-line bg-white text-[12px] font-semibold inline-flex items-center text-brand-navy hover:border-brand">⇩ Stok CSV</a>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`Omzet ${P} hari`} value={rupiah(sum(pP))} sub={`${pP.length} pesanan · ${growth === null ? "belum ada pembanding" : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% vs periode lalu`}`} tone="navy" spark={daily} />
        <Stat label="Margin kotor" value={rupiah(marginP)} sub={`${pct(marginP, sum(pP))} dari omzet · tiket rata-rata ${rupiahShort(avgTicket)}`} tone="green" />
        <Stat label="Hari ini" value={rupiah(sum(p1))} sub={`${p1.length} pesanan terbayar`} tone="blue" />
        <Stat label="Belum dibayar" value={rupiah(sum(piutang))} sub={`${piutang.length} booking menunggu bayar / konfirmasi`} tone="amber" href="/admin/pesanan" />
      </div>

      {/* Grafik + perlu tindakan */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-3">
        <Panel title="Omzet mingguan, 12 minggu" right={<span className="text-[11px] text-muted">puncak {rupiahShort(maxW)} · angka = jumlah pesanan</span>}>
          <svg viewBox="0 0 480 150" className="w-full h-40" role="img" aria-label="Grafik omzet mingguan">
            {[0, 1, 2, 3].map((i) => <line key={i} x1="8" x2="476" y1={20 + i * 30} y2={20 + i * 30} stroke="#EEF2F7" strokeWidth="1" />)}
            {weeks.map((w, i) => { const h = Math.round((w.v / maxW) * 90); const x = 14 + i * 39; return (
              <g key={i}>
                <rect x={x} y={110 - h} width="26" height={h} rx="3" fill={i === 11 ? "#2A7DC1" : "#BFD8F0"} />
                {w.n > 0 && <text x={x + 13} y={105 - h} textAnchor="middle" fontSize="9" fontWeight="600" fill="#10365C">{w.n}</text>}
                <text x={x + 13} y="132" textAnchor="middle" fontSize="8.5" fill="#8a93a6">{w.label}</text>
              </g>); })}
          </svg>
        </Panel>
        <Panel title="Perlu tindakan">
          <ul className="flex flex-col divide-y divide-page -my-2">
            {todo.map((t) => (
              <li key={t.label}><Link href={t.href} className="flex items-center gap-3 py-2.5 group">
                <span className="min-w-8 h-8 px-2 rounded-lg inline-flex items-center justify-center text-[13px] font-bold text-white" style={{ background: t.n ? t.tone : "#CBD3DE" }}>{t.n}</span>
                <span className={`flex-1 text-[13px] ${t.n ? "font-semibold text-ink" : "text-muted"}`}>{t.label}</span>
                <span className="text-muted group-hover:text-brand">›</span>
              </Link></li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Produk & pelanggan */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Panel title="Model terlaris">
          <table className="w-full text-[12px]"><thead><tr><Th>Model</Th><Th right>Laku</Th><Th right>Omzet</Th><Th right>Margin</Th></tr></thead>
            <tbody>{topModels.map(([k, v]) => <tr key={k}><Td><span className="block truncate max-w-[150px]">{k}</span></Td><Td right>{v.n}</Td><Td right>{rupiahShort(v.omzet)}</Td><Td right bold>{rupiahShort(v.margin)}</Td></tr>)}</tbody></table>
          {!topModels.length && <p className="text-[12px] text-muted">Belum ada penjualan pada periode ini.</p>}
        </Panel>
        <Panel title="Margin terbaik per unit">
          <table className="w-full text-[12px]"><thead><tr><Th>Unit</Th><Th right>Harga</Th><Th right>Margin</Th></tr></thead>
            <tbody>{bestMargin.map(({ o, m }) => <tr key={o.id}><Td><span className="block truncate max-w-[150px]">{o.units?.brand} {o.units?.model}</span></Td><Td right>{rupiahShort(o.amount)}</Td><Td right bold>+{rupiahShort(m)}</Td></tr>)}</tbody></table>
          {!bestMargin.length && <p className="text-[12px] text-muted">Belum ada data.</p>}
        </Panel>
        <Panel title="Pelanggan" right={<span className="text-[11px] text-muted">{buyersP.size} pembeli · {newBuyers} baru / {buyersP.size - newBuyers} kembali</span>}>
          <table className="w-full text-[12px]"><thead><tr><Th>Nama</Th><Th right>Pesanan</Th><Th right>Total</Th></tr></thead>
            <tbody>{topCustomers.map((c, i) => <tr key={i}><Td><span className="block truncate max-w-[150px]">{c.name}</span></Td><Td right>{c.n}</Td><Td right bold>{rupiahShort(c.total)}</Td></tr>)}</tbody></table>
          {!topCustomers.length && <p className="text-[12px] text-muted">Belum ada pembeli.</p>}
        </Panel>
      </div>

      {/* Stok */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Unit tersedia" value={String(tersedia.length)} sub={`${U.filter((u) => u.status === "dipesan").length} dipesan · ${U.filter((u) => u.status === "masuk" || u.status === "qc").length} belum dicek`} href="/admin/stok?status=tersedia" />
        <Stat label="Nilai jual stok" value={rupiah(nilaiStok)} sub={`modal ${rupiahShort(modalStok)} · potensi margin ${rupiahShort(nilaiStok - modalStok)}`} tone="green" />
        <Stat label="Umur stok" value={`${aging.muda} / ${aging.sedang} / ${aging.tua.length}`} sub={`<14 / 14–30 / >30 hari · rata-rata laku ${avgDaysToSell === null ? "–" : `${avgDaysToSell} hari`}`} tone={aging.tua.length ? "amber" : "navy"} />
        <Stat label="Dititip ke Rentalaja" value={String(U.filter((u) => u.status === "dititip_rentalaja").length)} href="/admin/stok?status=dititip_rentalaja" tone="blue" />
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        <Panel title="Per kategori — stok vs laku">
          <table className="w-full text-[12px]"><thead><tr><Th>Kategori</Th><Th right>Stok</Th><Th right>Laku</Th><Th right>Omzet</Th></tr></thead>
            <tbody>{byCat.map((r) => <tr key={r.c}><Td>{CATEGORY_LABEL[r.c as keyof typeof CATEGORY_LABEL]}</Td><Td right>{r.stok}</Td><Td right>{r.laku}</Td><Td right bold>{rupiahShort(r.omzet)}</Td></tr>)}</tbody></table>
          <p className="text-[11px] font-medium text-muted mt-4 mb-1.5">Per grade — stok / laku</p>
          <div className="flex gap-1.5 flex-wrap">{byGrade.map((g) => <span key={g.g} className="px-2 h-6 inline-flex items-center rounded-md bg-page text-[11px]">Grade {g.g}: <b className="ml-1">{g.stok}</b><span className="text-muted ml-1">/ {g.laku}</span></span>)}</div>
        </Panel>
        <Panel title="Per pemilik — eksposur modal">
          <table className="w-full text-[12px]"><thead><tr><Th>Pemilik</Th><Th right>Unit</Th><Th right>Modal</Th><Th right>Nilai jual</Th></tr></thead>
            <tbody>{byOwner.map((r) => <tr key={r.t}><Td><span className="capitalize">{r.t}</span></Td><Td right>{r.n}</Td><Td right>{rupiahShort(r.modal)}</Td><Td right bold>{rupiahShort(r.nilai)}</Td></tr>)}</tbody></table>
          <p className="text-[11px] font-medium text-muted mt-4 mb-1.5">Sumber stok</p>
          <div className="flex flex-wrap gap-1.5">{bySource.map((x) => <span key={x.s} className="px-2 h-6 inline-flex items-center rounded-md bg-page text-[11px]">{SOURCE_LABEL[x.s as keyof typeof SOURCE_LABEL]} · <b className="ml-1">{x.n}</b></span>)}</div>
        </Panel>
        <Panel title="Stok > 30 hari" right={<span className="text-[11px] text-muted">perlu turun harga / promo</span>}>
          {aging.tua.length ? (
            <table className="w-full text-[12px]"><thead><tr><Th>Unit</Th><Th right>Umur</Th><Th right>Harga</Th></tr></thead>
              <tbody>{aging.tua.sort((a, b) => ageDays(b) - ageDays(a)).slice(0, 8).map((u) => <tr key={u.id}><Td><Link href={`/admin/stok/${u.id}`} className="block truncate max-w-[150px] font-semibold hover:text-brand">{u.brand} {u.model}</Link></Td><Td right>{ageDays(u)} hr</Td><Td right bold>{rupiahShort(u.price_sell)}</Td></tr>)}</tbody></table>
          ) : <p className="text-[12px] text-muted">Tidak ada — stok berputar sehat.</p>}
        </Panel>
      </div>

      {/* Konversi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Booking → terbayar" value={pct(oP.filter((o) => PAID.includes(o.status)).length, oP.length)} sub={`${oP.length} booking · ${pct(oP.filter((o) => o.status === "dibatalkan").length, oP.length)} batal`} tone="blue" />
        <Stat label="Tawaran disetujui" value={pct(OF.filter((o) => ["disetujui", "dipakai"].includes(o.status)).length, OF.length)} sub={`${OF.length} tawaran · rata-rata ${avgOfferPct === null ? "–" : `${avgOfferPct}%`} dari harga · ${pct(oP.filter((o) => o.offer_id).length, oP.length)} pesanan via tawar`} tone="blue" />
        <Stat label="Jual / tukar tambah deal" value={pct(tiDeal.length, TI.length)} sub={`${TI.length} pengajuan · final ${tiFinalVsEst.length ? `${Math.round(tiFinalVsEst.reduce((a, b) => a + b, 0) / tiFinalVsEst.length)}% dari estimasi` : "–"} · dibeli ${rupiahShort(tiDeal.reduce((s, t) => s + (t.final_price ?? 0), 0))}`} tone="green" />
        <Stat label="Klaim servis" value={String(CL.length)} sub={`${pct(CL.filter((c) => ["diperbaiki", "ditukar"].includes(c.status)).length, CL.length)} masuk garansi · ${pct(CL.length, pP.length)} dari penjualan`} tone={CL.length ? "red" : "navy"} />
      </div>

      <p className="text-[11px] text-muted">Margin memakai <i>cost basis</i> di kepemilikan unit (unit titipan/investor = bagian Niagaaja). Omzet dihitung saat pembayaran dikonfirmasi. CSV terbuka rapi di Google Sheets / Excel.</p>
    </div>
  );
}

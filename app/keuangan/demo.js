/* Data contoh Panel Keuangan Pokama.
   Bentuknya sama persis dengan hasil fungsi database pk_fin_* (lihat supabase/018_keuangan_laporan.sql),
   jadi layar tidak perlu diubah saat mesin buku besar grup sudah dipasang. Angka di sini BUKAN data sungguhan. */

export const UNITS = [
  { code: 'HQ', name: 'Holding', kind: 'holding', parent: null, sort: 0 },
  { code: 'RA', name: 'Rentalaja', kind: 'bisnis', parent: null, sort: 1 },
  { code: 'WG', name: 'TripinAja', kind: 'bisnis', parent: null, sort: 2 },
  { code: 'NA', name: 'Niagaaja', kind: 'bisnis', parent: null, sort: 3 },
  { code: 'KEU', name: 'Keuangan', parent: 'HQ', sort: 1 }, { code: 'BIZ', name: 'BizDev', parent: 'HQ', sort: 2 },
  { code: 'MKT', name: 'Marketing', parent: 'HQ', sort: 3 }, { code: 'AST', name: 'Aset', parent: 'HQ', sort: 4 },
  { code: 'GK', name: 'Garut Kota', parent: 'RA', sort: 10 }, { code: 'BD', name: 'Bandung', parent: 'RA', sort: 11 },
  { code: 'WN', name: 'Wanaraja', parent: 'RA', sort: 12 }, { code: 'CP', name: 'Ciputat', parent: 'RA', sort: 13 },
  { code: 'EX', name: 'Experience', parent: 'RA', sort: 14 }, { code: 'JP', name: 'ATVaja (Jeep)', parent: 'RA', sort: 15 },
  { code: 'MP', name: 'Maripoto Photobooth', parent: 'RA', sort: 16 },
  { code: 'NL', name: 'Laptopaja', parent: 'NA', sort: 20 }, { code: 'NJ', name: 'JB (jual beli)', parent: 'NA', sort: 21 },
];
export const bizOf = (u) => { const x = UNITS.find(v => v.code === u); return !x ? 'HQ' : x.parent || x.code; };

export const ACC = {
  '1-10001': 'Kas Garut Kota', '1-10002': 'Kas Wanaraja', '1-10003': 'Kas Bandung', '1-10004': 'Kas Experience dan sopir',
  '1-10011': 'Bank Operasional', '1-10012': 'Bank Profit', '1-10013': 'Bank Pajak', '1-10014': 'Bank Gaji owner', '1-10015': 'Bank Cadangan aset',
  '1-10021': 'Saldo payment gateway', '1-10031': 'Bank Penerimaan TripinAja', '1-10032': 'Bank Operasional TripinAja', '1-10033': 'Kas TripinAja',
  '1-10041': 'Bank Penerimaan Niagaaja', '1-10042': 'Bank Operasional Niagaaja', '1-10043': 'Kas toko Niagaaja',
  '1-10051': 'Bank Operasional Holding', '1-10052': 'Bank Kewajiban (cicilan & bagi hasil)', '1-10053': 'Bank Investasi & pilot', '1-10061': 'Kas kecil Holding',
  '1-10100': 'Piutang usaha', '1-10101': 'Piutang karyawan (kasbon)', '1-10102': 'Uang muka kegiatan (RAB)', '1-10200': 'Persediaan part', '1-10210': 'Persediaan barang dagang',
  '1-10701': 'Kendaraan', '1-10702': 'Elektronik dan kamera', '1-10703': 'Peralatan camping dan piknik', '1-10704': 'Peralatan dan inventaris',
  '1-10751': 'Akumulasi penyusutan kendaraan', '1-10752': 'Akumulasi penyusutan elektronik', '1-10753': 'Akumulasi penyusutan peralatan',
  '2-20100': 'Hutang usaha', '2-20200': 'Uang muka pelanggan (DP)', '2-20300': 'Hutang bagi hasil mitra', '2-20400': 'Hutang pajak', '2-20500': 'Hutang gaji',
  '2-20600': 'Hutang reimburse karyawan', '2-21000': 'Hutang leasing', '2-21100': 'Hutang bank', '2-21200': 'Dana investor (modal kerja)',
  '3-30000': 'Modal disetor', '3-30100': 'Laba ditahan', '3-30200': 'Prive', '3-30999': 'Ekuitas saldo awal',
  '4-40001': 'Pendapatan sewa Hub', '4-40002': 'Pendapatan sewa Transportation', '4-40003': 'Pendapatan penginapan', '4-40004': 'Pendapatan trip Jeep',
  '4-40005': 'Pendapatan ongkir antar-jemput', '4-40006': 'Pendapatan mobil + sopir', '4-40007': 'Pendapatan korporat', '4-40009': 'Potongan dan diskon penjualan',
  '4-41001': 'Pendapatan paket tour', '4-41002': 'Pendapatan open trip dan custom', '4-42001': 'Penjualan laptop', '4-42002': 'Penjualan kamera', '4-42003': 'Pendapatan jasa servis',
  '5-50001': 'Penyusutan unit sewa', '5-50002': 'Servis dan part', '5-50003': 'Bagi hasil mitra', '5-51001': 'HPP barang dagang', '5-51002': 'Biaya vendor tour',
  '6-60001': 'Gaji dan upah', '6-60002': 'Sewa tempat', '6-60003': 'Listrik, air, dan internet', '6-60004': 'Iklan dan konten', '6-60005': 'Bensin dan transport',
  '6-60006': 'Biaya payment gateway dan bank', '6-60007': 'Kas kecil dan lain-lain', '6-60008': 'Bahan dan perlengkapan', '6-60009': 'Konsumsi', '6-60010': 'Jasa dan tenaga lepas',
  '6-60011': 'ATK dan kantor', '6-60012': 'Langganan dan sistem',
  '7-70001': 'Denda keterlambatan', '7-70002': 'Pendapatan klaim kerusakan', '7-70003': 'Pendapatan pembatalan', '7-70005': 'Pendapatan lain-lain',
  '8-80001': 'Beban bunga leasing', '8-80002': 'Beban pajak',
};
const GRP = { 1: 'aset', 2: 'kewajiban', 3: 'ekuitas', 4: 'pendapatan', 5: 'hpp', 6: 'beban', 7: 'pendapatan_lain', 8: 'beban_lain' };
export const grpOf = (c) => GRP[c[0]];

// biaya & pendapatan dasar per bulan (juta rupiah) per lini
const BASE = {
  GK: { '4-40001': 45, '4-40002': 20, '4-40005': 3, '7-70001': .8, '5-50001': 9, '5-50002': 4, '6-60001': 12, '6-60002': 3.5, '6-60003': 1.2, '6-60005': 1.8, '6-60006': .9, '6-60007': 1 },
  BD: { '4-40001': 30, '4-40002': 18, '7-70002': .6, '5-50001': 7, '5-50002': 3, '6-60001': 10, '6-60002': 4, '6-60003': 1, '6-60005': 1.5, '6-60006': .6 },
  WN: { '4-40002': 14, '4-40001': 6, '5-50001': 4, '5-50002': 2, '6-60001': 6, '6-60002': 1.5, '6-60005': .8 },
  CP: { '4-40001': 8, '5-50001': 2.5, '5-50002': 1, '6-60001': 4.5, '6-60002': 2, '6-60003': .6 },
  EX: { '4-40003': 22, '7-70003': .9, '5-50003': 6, '6-60001': 5, '6-60003': 1.5, '6-60007': 1.5 },
  JP: { '4-40004': 19, '5-50001': 3, '5-50002': 2.5, '5-50003': 4, '6-60001': 4, '6-60005': 1.5, '8-80001': 1.2 },
  MP: { '4-40001': 14, '5-50001': 2, '6-60001': 4, '6-60002': 1.5 },
  RA: { '6-60004': 6, '6-60006': 1.5, '6-60012': 1.2, '8-80001': 3.5 },
  WG: { '4-41001': 18, '4-41002': 9, '5-51002': 15, '6-60001': 7, '6-60004': 3, '6-60005': 1.2, '6-60009': .6 },
  NL: { '4-42001': 22, '4-42003': 1.5, '5-51001': 18.5, '6-60001': 4, '6-60004': 1.2, '6-60002': 1 },
  NJ: { '4-42002': 3, '5-51001': 2.4, '6-60001': 1.5 },
  KEU: { '6-60001': 6 }, BIZ: { '6-60001': 7, '6-60005': .6 }, MKT: { '6-60001': 9, '6-60004': 2 }, AST: { '6-60001': 5, '6-60005': 1.5 },
  HQ: { '6-60012': 1.5, '6-60011': .8, '6-60002': 2.5, '6-60003': 1, '8-80002': 1 },
};
const SEASON = [1.15, .85, .92, 1.08, 1.0, 1.18, 1.22, .96, .9, 1.0, .93, 1.3];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
const noise = (k, amp) => 1 + (hash(k) - .5) * 2 * amp;
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D = (s) => new Date(s + 'T00:00:00');
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dim = (y, m) => new Date(y, m + 1, 0).getDate();

// nilai satu akun satu lini satu bulan (rupiah)
function monthAmt(unit, acc, y, m) {
  const base = BASE[unit][acc] * 1e6, s = SEASON[m], k = unit + acc + y + '-' + m;
  const lv = unit === 'NL' ? (y === 2026 ? Math.max(.45, 1 - m * .06) : 1) : 1; // stok Laptopaja menipis sepanjang 2026
  if (acc[0] === '4' || acc[0] === '7') return base * s * lv * noise(k, .09);
  if (acc[0] === '5') return base * (acc === '5-50001' ? 1 : s * lv) * noise(k, .06);
  if (acc === '6-60001') return base;
  return base * (1 + (s - 1) * .3) * noise(k, .07);
}
// jumlah satu akun satu lini untuk rentang tanggal (proporsional per hari)
function rangeAmt(unit, acc, from, to) {
  let t = 0, d = new Date(from.getFullYear(), from.getMonth(), 1);
  while (d <= to) {
    const y = d.getFullYear(), m = d.getMonth(), n = dim(y, m);
    const a = new Date(Math.max(d, from)), b = new Date(Math.min(new Date(y, m, n), to));
    if (b >= a) t += monthAmt(unit, acc, y, m) * ((b - a) / 864e5 + 1) / n;
    d = new Date(y, m + 1, 1);
  }
  return Math.round(t / 1000) * 1000;
}
export function pl(from, to) {
  const f = D(from), t = D(to), out = [];
  for (const u of Object.keys(BASE)) for (const acc of Object.keys(BASE[u])) {
    const amt = rangeAmt(u, acc, f, t); if (amt) out.push({ acc, name: ACC[acc], grp: grpOf(acc), unit: u, biz: bizOf(u), amt });
  }
  return out.sort((a, b) => a.acc.localeCompare(b.acc) || a.unit.localeCompare(b.unit));
}
const sumBy = (rows, fn) => rows.reduce((a, r) => a + (fn(r) || 0), 0);
function agg(rows) {
  const g = (p) => sumBy(rows, r => r.acc[0] === p ? r.amt : 0);
  const rev = g('4'), hpp = g('5'), opex = g('6'), oi = g('7'), oe = g('8');
  return { rev, hpp, opex, oi, oe, net: rev + oi - hpp - opex - oe };
}

const CASH = [
  ['1-10021', null, 'penerimaan', 'Xendit', 12.4], ['1-10011', 'RA', 'operasional', 'BCA', 96.2], ['1-10012', 'RA', 'investasi', 'BCA', 61.5], ['1-10013', 'RA', 'kewajiban', 'BCA', 9.1],
  ['1-10014', 'RA', 'bersama', 'BCA', 14.0], ['1-10015', 'RA', 'investasi', 'BRI', 52.8],
  ['1-10001', 'GK', 'operasional', null, 2.35], ['1-10002', 'WN', 'operasional', null, .82], ['1-10003', 'BD', 'operasional', null, 1.64], ['1-10004', 'EX', 'operasional', null, 1.1],
  ['1-10031', 'WG', 'penerimaan', 'BCA', 14.6], ['1-10032', 'WG', 'operasional', 'BCA', 5.2], ['1-10033', 'WG', 'operasional', null, .74],
  ['1-10041', 'NA', 'penerimaan', 'BCA', 7.9], ['1-10042', 'NA', 'operasional', 'BCA', 3.3], ['1-10043', 'NA', 'operasional', null, 1.05],
  ['1-10051', 'HQ', 'bersama', 'Mandiri', 18.7], ['1-10052', 'HQ', 'kewajiban', 'Mandiri', 24.0], ['1-10053', 'HQ', 'investasi', 'Mandiri', 12.0], ['1-10061', 'HQ', 'bersama', null, .9],
];
const BAL = { '1-10100': 18.4, '1-10101': 2.1, '1-10102': 3.4, '1-10200': 6.8, '1-10210': 64.5, '2-20100': 12.2, '2-20200': 27.6, '2-20300': 9.1, '2-20400': 4.3, '2-20500': 0,
  '2-20600': 1.2, '2-21000': 214.0, '2-21100': 0, '2-21200': 0 };
const FIXED = { '1-10701': 982, '1-10702': 238, '1-10703': 86, '1-10704': 31.5, '1-10751': -312, '1-10752': -97, '1-10753': -29 };
const OBL = [
  ['Cicilan leasing Jeep Guntur', 'leasing', 'JP', 8.5, 5, 'LEASING JEEP'], ['Cicilan leasing motor (batch 2)', 'leasing', 'RA', 12.4, 10, 'ADIRA'],
  ['Bagi hasil pemilik Ruma Metua', 'bagi_hasil', 'EX', 6.0, 7, null], ['Sewa ruko Bandung Hub', 'sewa', 'BD', 4.0, 2, 'SEWA RUKO'],
  ['Langganan sistem & domain', 'langganan', 'HQ', 1.5, 15, null], ['PPh final & BPJS', 'pajak', 'HQ', 3.2, 15, 'DJP'],
  ['Cicilan leasing mobil sopir', 'leasing', 'EX', 5.6, 20, 'ACC'], ['Sewa lapak Ciputat', 'sewa', 'CP', 2.0, 28, null],
];

function ymd(d) { return iso(d); }
function monthsBack(to, n) { const o = [], d = new Date(to.getFullYear(), to.getMonth(), 1); for (let i = n - 1; i >= 0; i--) o.push(new Date(d.getFullYear(), d.getMonth() - i, 1)); return o; }

export function dashboard(from, to, today) {
  const f = D(from), t = D(to), T = D(today), len = (t - f) / 864e5 + 1;
  let pf, pt;
  if (f.getDate() === 1 && t.getDate() === dim(t.getFullYear(), t.getMonth()) && f.getMonth() === t.getMonth()) { pf = new Date(f.getFullYear(), f.getMonth() - 1, 1); pt = addD(f, -1); }
  else { pf = addD(f, -len); pt = addD(f, -1); }
  const cur = pl(from, to), prev = pl(ymd(pf), ymd(pt));
  const rev3 = sumBy(cur, r => ['RA', 'WG', 'NA'].includes(r.biz) && r.acc[0] === '4' ? r.amt : 0);
  const hq = agg(cur.filter(r => r.biz === 'HQ'));
  const units = UNITS.filter(u => u.kind).map(b => {
    const c = agg(cur.filter(r => r.biz === b.code)), p = agg(prev.filter(r => r.biz === b.code));
    return { code: b.code, name: b.name, cur: c, prev: { rev: p.rev, net: p.net }, share: b.code === 'HQ' ? null : (rev3 ? c.rev / rev3 : 1 / 3),
      lines: UNITS.filter(u => u.parent === b.code).map(u => { const a = agg(cur.filter(r => r.unit === u.code)); return { code: u.code, name: u.name, rev: a.rev, net: a.net }; }) };
  });
  const trend = monthsBack(t, 6).map(m => {
    const e = new Date(m.getFullYear(), m.getMonth() + 1, 0), rows = pl(ymd(m), ymd(e < t ? e : t)), by = {};
    for (const b of ['HQ', 'RA', 'WG', 'NA']) { const a = agg(rows.filter(r => r.biz === b)); by[b] = { rev: a.rev, net: a.net }; }
    return { m: ymd(m).slice(0, 7), by };
  });
  const totRev = agg(cur).rev, totCost = agg(cur).hpp + agg(cur).opex + agg(cur).oe;
  const daily = [];
  for (let d = new Date(Math.max(f, addD(t, -61))); d <= t; d = addD(d, 1)) {
    const k = ymd(d), wk = [0, 5, 6].includes(d.getDay()) ? 1.35 : .85;
    let o = totCost / len * noise('o' + k, .45);
    if (d.getDate() === 25) o += 96e6; // hari gaji
    if ([5, 10, 7].includes(d.getDate())) o += 9e6;
    daily.push({ d: k, in: Math.round(totRev / len * wk * noise('i' + k, .35) / 1000) * 1000, out: Math.round(o * .55 / 1000) * 1000 });
  }
  const lastStmt = ymd(addD(T, -1)), cash = CASH.map(([code, unit, pos, bank, bal], i) => {
    const book = Math.round(bal * 1e6 * noise('b' + code + today, .03) / 1000) * 1000;
    const diff = code === '1-10011' ? 1.85e6 : code === '1-10031' ? -.45e6 : 0;
    const inn = code.startsWith('1-1002') ? totRev * .62 : code === '1-10011' ? totRev * .55 : code === '1-10031' ? totRev * .09 : code === '1-10041' ? totRev * .08 : book * .4;
    return { code, name: ACC[code], unit, pos, bank, book, in: Math.round(inn / 1000) * 1000, out: Math.round(inn * .93 / 1000) * 1000,
      bank_balance: bank ? book + diff : null, bank_at: bank ? (code === '1-10052' ? ymd(addD(T, -9)) : lastStmt) : null,
      unmatched: { '1-10011': 6, '1-10031': 3, '1-10051': 2 }[code] || 0, stmt_last: bank ? (code === '1-10052' ? ymd(addD(T, -9)) : lastStmt) : null };
  });
  const balances = {}; for (const [k, v] of Object.entries(BAL)) balances[k] = { name: ACC[k], bal: v * 1e6 };
  const obligations = OBL.map(([name, kind, unit, amt, day, pattern], i) => {
    let due = new Date(T.getFullYear(), T.getMonth(), day); if (due < T) due = new Date(T.getFullYear(), T.getMonth() + 1, day);
    return { id: 'o' + i, name, kind, unit, amount: amt * 1e6, due: ymd(due), days: Math.round((due - T) / 864e5), pattern };
  }).filter(o => o.days <= 30).sort((a, b) => a.days - b.days);
  const burnRows = pl(ymd(new Date(T.getFullYear(), T.getMonth() - 3, 1)), ymd(new Date(T.getFullYear(), T.getMonth(), 0)));
  const burn = sumBy(burnRows, r => '568'.includes(r.acc[0]) && r.acc !== '5-50001' ? r.amt : 0) / 3, cashTotal = sumBy(cash, c => c.book);
  const exp = {}; cur.filter(r => '568'.includes(r.acc[0])).forEach(r => { exp[r.acc] = exp[r.acc] || { code: r.acc, name: r.name, amt: 0, by: {} }; exp[r.acc].amt += r.amt; exp[r.acc].by[r.biz] = (exp[r.acc].by[r.biz] || 0) + r.amt; });
  const mix = {}; cur.filter(r => '47'.includes(r.acc[0])).forEach(r => { mix[r.acc] = mix[r.acc] || { code: r.acc, name: r.name, amt: 0 }; mix[r.acc].amt += r.amt; });
  const sc = len / 30;
  const rab = [
    { biz: 'RA', menunggu: 4, menunggu_rp: 3.25e6, siap: 2, siap_rp: 1.8e6, nota: 5, nota_rp: 4.15e6, telat: 2, cek: 1, cair_periode: 14.2e6 * sc, real_periode: 12.9e6 * sc, darurat: 1 },
    { biz: 'WG', menunggu: 1, menunggu_rp: .65e6, siap: 0, siap_rp: 0, nota: 2, nota_rp: 1.1e6, telat: 0, cek: 1, cair_periode: 3.4e6 * sc, real_periode: 3.3e6 * sc, darurat: 0 },
    { biz: 'NA', menunggu: 0, menunggu_rp: 0, siap: 1, siap_rp: .42e6, nota: 1, nota_rp: .3e6, telat: 1, cek: 0, cair_periode: 1.6e6 * sc, real_periode: 1.2e6 * sc, darurat: 0 },
    { biz: 'HQ', menunggu: 2, menunggu_rp: 2.4e6, siap: 1, siap_rp: .75e6, nota: 2, nota_rp: 1.9e6, telat: 0, cek: 2, cair_periode: 6.8e6 * sc, real_periode: 6.1e6 * sc, darurat: 0 },
  ];
  const hrs = (h) => new Date(Date.now() - h * 36e5).toISOString();
  const sources = [
    { code: 'rentalaja', name: 'Rentalaja App (rentalaja.co.id)', unit: 'RA', kind: 'database', active: true, feeds_omzet: true, last: hrs(.1), has_key: false, n30: 2140, ok30: 2128, gagal: 3 },
    { code: 'tripinaja', name: 'Website TripinAja', unit: 'WG', kind: 'website', active: true, feeds_omzet: true, last: hrs(76), has_key: true, n30: 118, ok30: 113, gagal: 4 },
    { code: 'niagaaja', name: 'Website Niagaaja', unit: 'NA', kind: 'website', active: false, feeds_omzet: false, last: null, has_key: false, n30: 0, ok30: 0, gagal: 0 },
    { code: 'pokama', name: 'Sistem Kerja Pokama (RAB, gaji)', unit: 'HQ', kind: 'sistem', active: true, feeds_omzet: false, last: hrs(2), has_key: false, n30: 64, ok30: 64, gagal: 0 },
    { code: 'bank', name: 'Mutasi bank', unit: 'HQ', kind: 'bank', active: true, feeds_omzet: false, last: hrs(30), has_key: false, n30: 412, ok30: 401, gagal: 0 },
    { code: 'manual', name: 'Jurnal penyesuaian Keuangan', unit: 'HQ', kind: 'sistem', active: true, feeds_omzet: false, last: hrs(50), has_key: false, n30: 9, ok30: 9, gagal: 0 },
  ];
  const periods = monthsBack(T, 6).map((m, i, a) => ({ m: ymd(m).slice(0, 7), status: i < a.length - 2 ? 'locked' : 'open' }));
  return {
    period: { from, to, prev_from: ymd(pf), prev_to: ymd(pt), today },
    units, hq_cost: Math.max(-hq.net, 0), trend, daily, cash, balances, obligations,
    obligations_month: sumBy(OBL, o => o[3] * 1e6), rab,
    expense_top: Object.values(exp).sort((a, b) => b.amt - a.amt).slice(0, 10),
    revenue_mix: Object.values(mix).sort((a, b) => b.amt - a.amt),
    sources, exceptions: { gagal: 7, peta: 2, mutasi: 11 }, periods,
    health: { cash: cashTotal, burn, runway: burn > 0 ? Math.round(cashTotal / burn * 10) / 10 : null, auto: 96, entries: Math.round(1180 * sc), close_day: 5 },
  };
}

export function balanceSheet(to) {
  const t = D(to), y0 = ymd(new Date(t.getFullYear(), 0, 1)), rows = [];
  for (const [code, , , , bal] of CASH) rows.push({ acc: code, name: ACC[code], grp: 'aset', is_cash: true, bal: Math.round(bal * 1e6 * noise('b' + code + to, .03) / 1000) * 1000 });
  for (const [k, v] of Object.entries(BAL)) if (v) rows.push({ acc: k, name: ACC[k], grp: grpOf(k), is_cash: false, bal: v * 1e6 });
  for (const [k, v] of Object.entries(FIXED)) rows.push({ acc: k, name: ACC[k], grp: 'aset', is_cash: false, bal: v * 1e6 });
  const ytd = agg(pl(y0, to)).net, A = sumBy(rows, r => r.grp === 'aset' ? r.bal : 0), L = sumBy(rows, r => r.grp === 'kewajiban' ? r.bal : 0);
  rows.push({ acc: '3-30000', name: ACC['3-30000'], grp: 'ekuitas', is_cash: false, bal: 750e6 });
  rows.push({ acc: '3-30200', name: ACC['3-30200'], grp: 'ekuitas', is_cash: false, bal: -42e6 });
  rows.push({ acc: '3-30100', name: ACC['3-30100'], grp: 'ekuitas', is_cash: false, bal: A - L - 750e6 + 42e6 - ytd });
  rows.sort((a, b) => a.acc.localeCompare(b.acc));
  rows.push({ acc: '3-39999', name: 'Laba (rugi) berjalan', grp: 'ekuitas', bal: ytd });
  return rows;
}

export function journal(from, to, biz, source, q) {
  const f = D(from), t = D(to), out = []; let n = 0;
  const mk = (date, src, ref, unit, memo, lines) => { n++; out.push({ id: 'j' + n, code: 'PK-' + date.replace(/-/g, '').slice(2) + '-' + String(n).padStart(4, '0'), date, source: src, ref, unit, memo,
    proof: null, status: 'posted', at: date + 'T09:00:00', total: sumBy(lines, l => l.d), lines: lines.map(l => ({ acc: l.acc, name: ACC[l.acc], unit: l.unit || unit, d: l.d || 0, c: l.c || 0, memo: null })) }); };
  const CUST = ['Rizky', 'Dewi', 'Fajar', 'Nadia', 'Bima', 'Siska', 'Andre', 'Putri', 'Yoga', 'Laras', 'Hendra', 'Tia'];
  const PROD = [['GK', '4-40001', 'Sewa motor NMAX 3 hari'], ['BD', '4-40002', 'Sewa mobil Avanza 2 hari'], ['EX', '4-40003', 'Menginap Ruma Metua 2 malam'], ['JP', '4-40004', 'Jeep trip sunrise Guntur'],
    ['MP', '4-40001', 'Photobooth wisuda'], ['WN', '4-40002', 'Sewa motor Beat 1 hari'], ['CP', '4-40001', 'Sewa kamera Sony A6400']];
  for (let d = new Date(t); d >= f && out.length < 220; d = addD(d, -1)) {
    const k = ymd(d);
    for (let i = 0; i < 4; i++) {
      const h = hash(k + i), [u, acc, memo] = PROD[Math.floor(h * PROD.length)], amt = Math.round((350 + h * 2600) * 1e3 / 5e3) * 5e3, c = CUST[Math.floor(hash(k + 'c' + i) * CUST.length)];
      const bk = 'BK-' + k.slice(5).replace('-', '') + (i + 1);
      mk(k, 'rentalaja', 'pay:' + bk, u, 'Pembayaran ' + bk + ' · ' + c, [{ acc: '1-10021', d: amt }, { acc: '2-20200', c: amt }]);
      if (h > .35) mk(k, 'rentalaja', 'rev:' + bk, u, 'Serah-terima ' + bk + ' · ' + memo, [{ acc: '2-20200', d: amt }, { acc, c: amt }]);
    }
    if (hash(k + 'wg') > .55) { const a = Math.round((1.8 + hash(k + 'wa') * 4) * 1e6 / 5e4) * 5e4; mk(k, 'tripinaja', 'TRP-' + k.slice(5).replace('-', ''), 'WG', 'Paket tour Papandayan · ' + CUST[Math.floor(hash(k + 'wn') * 12)], [{ acc: '1-10031', d: a }, { acc: '4-41001', c: a }]); }
    if (hash(k + 'rab') > .6) { const a = Math.round((150 + hash(k + 'ra') * 900) * 1e3 / 1e3) * 1e3; mk(k, 'pokama', 'rab:RAB-' + k.slice(5).replace('-', ''), 'GK', 'RAB servis rem & oli unit motor · LPJ', [{ acc: '5-50002', d: a }, { acc: '1-10011', c: a }]); }
    if (hash(k + 'bk') > .5) { const a = Math.round(hash(k + 'fee') * 180e3 / 1e3) * 1e3 + 25e3; mk(k, 'bank', 'mut:' + k, 'RA', 'Biaya admin & transfer payment gateway', [{ acc: '6-60006', d: a }, { acc: '1-10021', c: a }]); }
    if (d.getDate() === 25) mk(k, 'pokama', 'payroll:' + k.slice(0, 7), 'HQ', 'Gaji ' + k.slice(0, 7) + ' (dibagi per unit, tanpa rincian per orang)',
      [['RA', 52e6], ['WG', 7e6], ['NA', 5.5e6], ['HQ', 27e6]].map(([u, v]) => ({ acc: '6-60001', unit: u, d: v })).concat([{ acc: '2-20500', unit: 'HQ', c: 91.5e6 }]));
    if (d.getDate() === 28) mk(k, 'manual', 'adj:' + k, 'HQ', 'Penyusutan bulanan unit sewa', [{ acc: '5-50001', unit: 'RA', d: 29.5e6 }, { acc: '1-10751', unit: 'RA', c: 21e6 }, { acc: '1-10752', unit: 'RA', c: 8.5e6 }]);
  }
  return out.filter(j => (!source || j.source === source) && (!biz || j.lines.some(l => bizOf(l.unit) === biz)) && (!q || (j.memo + j.code + j.ref).toLowerCase().includes(q.toLowerCase())));
}

export function exceptions(today) {
  const T = D(today), dd = (n) => ymd(addD(T, -n));
  return {
    keys: [
      { key: 'rev:WG:private_trip', n: 4, amt: 8.6e6, error: 'Akun pendapatan untuk kategori "private_trip" TripinAja belum dipetakan', sample: 'tripinaja · TRP-1029-07' },
      { key: 'exp:NA:ongkir_kurir', n: 2, amt: .38e6, error: 'Akun biaya untuk kategori "ongkir_kurir" Niagaaja belum dipetakan', sample: 'pokama · RAB-1030-02' },
    ],
    events: [
      { id: 'e1', source: 'tripinaja', ext: 'TRP-1029-07', type: 'penjualan', date: dd(3), unit: 'WG', amount: 2.4e6, error: 'Akun belum dipetakan', key: 'rev:WG:private_trip', memo: 'Private trip Kawah Kamojang 6 orang', attempts: 2 },
      { id: 'e2', source: 'tripinaja', ext: 'TRP-1030-02', type: 'penjualan', date: dd(2), unit: 'WG', amount: 1.9e6, error: 'Akun belum dipetakan', key: 'rev:WG:private_trip', memo: 'Private trip Situ Bagendit', attempts: 1 },
      { id: 'e3', source: 'tripinaja', ext: 'TRP-1030-05', type: 'penjualan', date: dd(2), unit: 'WG', amount: 2.1e6, error: 'Akun belum dipetakan', key: 'rev:WG:private_trip', memo: 'Private trip Papandayan', attempts: 1 },
      { id: 'e4', source: 'tripinaja', ext: 'TRP-1031-01', type: 'penjualan', date: dd(1), unit: 'WG', amount: 2.2e6, error: 'Akun belum dipetakan', key: 'rev:WG:private_trip', memo: 'Private trip Darajat', attempts: 1 },
      { id: 'e5', source: 'pokama', ext: 'RAB-1030-02', type: 'rab_lpj', date: dd(2), unit: 'NL', amount: .23e6, error: 'Akun belum dipetakan', key: 'exp:NA:ongkir_kurir', memo: 'Ongkir laptop ke pembeli Tasik', attempts: 1 },
      { id: 'e6', source: 'pokama', ext: 'RAB-1031-04', type: 'rab_lpj', date: dd(1), unit: 'NL', amount: .15e6, error: 'Akun belum dipetakan', key: 'exp:NA:ongkir_kurir', memo: 'Ongkir laptop servis', attempts: 1 },
      { id: 'e7', source: 'rentalaja', ext: 'pay:BK-1031-88', type: 'pembayaran', date: dd(1), unit: 'BD', amount: .85e6, error: 'Periode Oktober sudah dikunci; tanggal jurnal digeser perlu persetujuan', key: null, memo: 'Pembayaran susulan BK-1031-88', attempts: 3 },
    ],
    bank: [
      ['1-10011', 1, 'TRSF E-BANKING CR 3110/FTSCY/WS95051 ANDRI S', 1.25e6], ['1-10011', 1, 'TRSF E-BANKING DB 3110 TOKO BAN MAJU', -.68e6], ['1-10011', 2, 'BIAYA ADM', -.017e6],
      ['1-10011', 2, 'TRSF E-BANKING CR 3010 PT SINAR KORPORAT', 4.5e6], ['1-10011', 3, 'KR OTOMATIS LLG-ANTAR BANK DEWI', .6e6], ['1-10011', 4, 'TARIK TUNAI ATM 2910', -1.5e6],
      ['1-10031', 1, 'TRSF E-BANKING CR 3110 HENDRA W', 2.1e6], ['1-10031', 3, 'TRSF E-BANKING DB VENDOR BUS PARIWISATA', -3.6e6], ['1-10031', 4, 'BIAYA ADM', -.012e6],
      ['1-10051', 2, 'TRSF E-BANKING DB 3010 CANVA PRO', -.18e6], ['1-10051', 5, 'SETORAN TUNAI', 2e6],
    ].map(([acc, n, desc, amount], i) => ({ id: 'b' + i, acc, acc_name: ACC[acc], date: dd(n), desc, amount, unit: CASH.find(c => c[0] === acc)[1] })),
  };
}

export function bankList(acc, today) {
  const T = D(today), ex = exceptions(today).bank.filter(b => b.acc === acc).map(b => ({ id: b.id, date: b.date, desc: b.desc, amount: b.amount, balance: null, status: 'baru', match: null, note: null }));
  const ok = []; for (let i = 0; i < 14; i++) { const h = hash(acc + i); ok.push({ id: 'm' + i, date: ymd(addD(T, -1 - Math.floor(i / 2))), desc: h > .5 ? 'XENDIT SETTLEMENT ' + (1000 + i) : 'TRSF E-BANKING DB OPERASIONAL', amount: Math.round((h > .5 ? 1 : -1) * (.4 + h * 6) * 1e6 / 1e3) * 1e3, balance: null, status: h > .15 ? 'cocok' : 'diposting', match: 'PK-' + (2000 + i), note: null }); }
  return ex.concat(ok);
}
export const accounts = () => Object.entries(ACC).map(([code, name]) => ({ code, name, grp: grpOf(code), is_cash: CASH.some(c => c[0] === code), unit_code: (CASH.find(c => c[0] === code) || [])[1] || null, pos: (CASH.find(c => c[0] === code) || [])[2] || null }));

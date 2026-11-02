/* Panel Keuangan grup Pokama — app.pokama.org/keuangan
   Satu buku untuk semua unit bisnis: Rentalaja, TripinAja, Niagaaja, dan Holding.
   Data dari fungsi database pk_fin_* (supabase/018_keuangan_*.sql). Selama mesin itu belum dipasang,
   halaman otomatis memakai data contoh (demo.js) dengan bentuk yang sama, dan menandainya dengan jelas. */
import { makeSession, api, esc, rp, rpk, pct, tgl, bulan, toast } from '/mitra/af.js';
import * as X from '/keuangan/demo.js';

const A = api(makeSession('pokama.session'));
const app = document.getElementById('app');
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } };

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D = (s) => new Date(s + 'T00:00:00');
function defaultPer() { const t = D(today()); if (t.getDate() < 7) t.setMonth(t.getMonth() - 1); return ymd(t).slice(0, 7); }

const S = { demo: ls('keu.demo') === '1', per: ls('keu.per') || defaultPer(), biz: 'RA', plv: 'biz', jsrc: '', jbiz: '', jq: '', obl: 30 };
let ME = null, ENGINE = LOCAL ? false : null, UNITS = X.UNITS, ACCS = null, cur = null;

const BIZ = ['RA', 'WG', 'NA'];
const BIZN = { RA: 'Rentalaja', WG: 'TripinAja', NA: 'Niagaaja', HQ: 'Holding' };
const COL = { RA: '#1D3149', WG: '#09BEAF', NA: '#5B8DEF', HQ: '#A3ACB9' };
const POS = { penerimaan: ['Penerimaan', 'Uang masuk dari pelanggan & gateway, belum dibagi'], operasional: ['Operasional', 'Belanja harian unit & cabang'],
  kewajiban: ['Kewajiban', 'Pajak, cicilan leasing, bagi hasil'], bersama: ['Bersama & gaji owner', 'Biaya holding dan gaji owner'], investasi: ['Profit & investasi', 'Profit, cadangan aset, pilot unit baru'] };
const SRC = { rentalaja: 'Rentalaja App', tripinaja: 'TripinAja', niagaaja: 'Niagaaja', pokama: 'Sistem Kerja', bank: 'Mutasi bank', manual: 'Penyesuaian' };
const KIND = { leasing: 'Leasing', pinjaman: 'Pinjaman', bagi_hasil: 'Bagi hasil', sewa: 'Sewa', langganan: 'Langganan', pajak: 'Pajak', lain: 'Lain-lain' };

const PAGES = { ringkasan: 'Ringkasan', unit: 'Per unit bisnis', target: 'Target vs realisasi', kas: 'Kas & bank', proyeksi: 'Proyeksi kas', pf: 'Profit First',
  kewajiban: 'Kewajiban & leasing', pihak: 'Piutang & hutang', rab: 'Belanja (RAB & LPJ)', labarugi: 'Laba rugi', neraca: 'Neraca', aruskas: 'Arus kas',
  jurnal: 'Buku jurnal', antrean: 'Antrean Keuangan', akun: 'Akun & rekening', saldo: 'Saldo awal', sumber: 'Sumber data & tutup buku' };
const route = () => { const [v, a] = (location.hash || '#ringkasan').slice(1).split('/'); return PAGES[v] || v === 'menu' ? { v, a } : { v: 'ringkasan' }; };
const canWrite = () => !!ME && ['ceo', 'keuangan'].includes(ME.role);
const usingDemo = () => S.demo || ENGINE === false;

/* ---------- angka ---------- */
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const num = (n) => { n = Math.round(+n || 0); return (n < 0 ? '(' : '') + Math.abs(n).toLocaleString('id-ID') + (n < 0 ? ')' : ''); };
const rpS = (n) => (+n < 0 ? '−' : '') + rpk(Math.abs(+n || 0));
const ratio = (a, b) => (b ? a / b * 100 : null);
function delta(c, p, inverse) {
  if (!p) return '<span class="dl na">baru</span>';
  const d = (c - p) / Math.abs(p) * 100, good = inverse ? d <= 0 : d >= 0;
  return `<span class="dl ${good ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span>`;
}
const mcls = (n) => (n < 0 ? 'neg' : '');
const uname = (c) => (UNITS.find(u => u.code === c) || {}).name || BIZN[c] || c || '—';
const bizOf = (u) => { const x = UNITS.find(v => v.code === u); return !x ? 'HQ' : x.parent || x.code; };
const dot = (b) => `<i class="dot" style="background:${COL[b] || '#A3ACB9'}"></i>`;
const daysAgo = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : null);

/* ---------- periode ---------- */
function period() {
  const t = today(), T = D(t);
  if (S.per === 'ytd') return { from: T.getFullYear() + '-01-01', to: t, label: 'Januari – ' + tgl(t) + ' ' + T.getFullYear() };
  if (S.per === 'l3') { const f = new Date(T.getFullYear(), T.getMonth() - 2, 1); return { from: ymd(f), to: t, label: '3 bulan terakhir (' + bulan(ymd(f)).split(' ')[0] + ' – ' + tgl(t) + ')' }; }
  const f = D(S.per + '-01'), e = new Date(f.getFullYear(), f.getMonth() + 1, 0), to = e > T ? t : ymd(e);
  return { from: S.per + '-01', to, label: bulan(S.per + '-01') + (e > T ? ' (s.d. ' + tgl(t) + ')' : '') };
}
function perSelect() {
  const o = [], d = D(today()); d.setDate(1);
  for (let i = 0; i < 13; i++) { const k = ymd(d).slice(0, 7); o.push([k, bulan(k + '-01') + (i === 0 ? ' (berjalan)' : '')]); d.setMonth(d.getMonth() - 1); }
  o.splice(1, 0, ['l3', '3 bulan terakhir'], ['ytd', 'Tahun berjalan']);
  return `<select class="inp" data-f="per" aria-label="Periode">${o.map(([k, l]) => `<option value="${k}"${k === S.per ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
}

/* ---------- data: database bila mesin sudah dipasang, kalau belum data contoh ---------- */
const MISSING = /could not find the function|does not exist|PGRST202|schema cache/i;
async function data(name, args = {}) {
  const demo = {
    dash: () => X.dashboard(args.from, args.to, today()), pl: () => X.pl(args.from, args.to), bs: () => X.balanceSheet(args.to),
    jurnal: () => X.journal(args.from, args.to, args.biz, args.source, args.q), exc: () => X.exceptions(today()), bank: () => X.bankList(args.acc, today()), accs: () => X.accounts(),
    fc: () => X.forecast(today()), cf: () => X.cashflow(args.from, args.to), party: () => X.partyLines(args.to), loans: () => X.loans(), set: () => X.settings(),
    open: () => X.opening(), tgt: () => X.targets(args.month), omz: () => [], accfull: () => X.accounts(),
  };
  if (usingDemo()) return demo[name]();
  const call = {
    dash: () => A.rpc('pk_fin_dashboard', { p_from: args.from, p_to: args.to }), pl: () => A.rpc('pk_fin_pl', { p_from: args.from, p_to: args.to }),
    bs: () => A.rpc('pk_fin_balance_sheet', { p_to: args.to }),
    jurnal: () => A.rpc('pk_fin_journal', { p_from: args.from, p_to: args.to, p_biz: args.biz || null, p_source: args.source || null, p_q: args.q || null, p_acc: null, p_limit: 300 }),
    exc: () => A.rpc('pk_fin_exceptions'), bank: () => A.rpc('pk_fin_bank_list', { p_account: args.acc, p_limit: 300 }),
    accs: () => A.get('pk_fin_accounts?select=code,name,grp,is_cash,unit_code,pos&is_active=eq.true&order=code'),
    fc: () => A.rpc('pk_fin_forecast', { p_weeks: 13 }), cf: () => A.rpc('pk_fin_cashflow', { p_from: args.from, p_to: args.to }),
    party: () => A.rpc('pk_fin_party_lines', { p_to: args.to }), loans: () => A.get('pk_fin_loans?select=*&order=created_at'),
    set: () => A.rpc('pk_fin_settings_get'), open: () => A.rpc('pk_fin_opening_get'),
    tgt: () => A.get('pk_targets?select=unit_code,month,amount,status&month=eq.' + args.month),
    omz: () => A.get('pk_omzet?select=unit_code,amount&day=gte.' + args.from + '&day=lte.' + args.to),
    accfull: () => A.get('pk_fin_accounts?select=code,name,grp,is_cash,unit_code,pos,bank,note,is_active,sort&order=code'),
  };
  try { const r = await call[name](); ENGINE = true; return r; }
  catch (e) { if (MISSING.test(e.message) || e.status === 404) { ENGINE = false; return demo[name](); } throw e; }
}
async function accounts() { if (!ACCS) ACCS = await data('accs'); return ACCS; }

/* ---------- potongan tampilan ---------- */
const tile = (l, v, s, cls = '', href = '') => `<${href ? `a href="${href}"` : 'div'} class="tile ${cls}"><span>${l}</span><b title="${esc(String(v).replace(/<[^>]+>/g, ''))}">${v}</b><small>${s}</small></${href ? 'a' : 'div'}>`;
function header(title, sub, right = '') {
  const p = period();
  return `${usingDemo() ? `<div class="demo">DATA CONTOH · ${ENGINE === false ? 'mesin buku besar grup belum dipasang di database, jadi semua angka di halaman ini contoh (bukan angka sungguhan).' : 'mode data contoh dinyalakan.'}</div>` : ''}
    ${ME && ME.role === 'kepala_staf' ? '<div class="ro">Kepala Staf: lihat saja. Perubahan data keuangan oleh Keuangan atau CEO.</div>' : ''}
    <header class="ph"><div><span class="eyebrow">Keuangan grup · ${esc(p.label)}</span><h1>${title}</h1><div class="sub">${sub}</div></div>
    <div class="row gap">${right}${perSelect()}${ENGINE !== false ? `<label class="chipbtn ${S.demo ? 'on' : ''}" style="height:44px"><input type="checkbox" data-demo ${S.demo ? 'checked' : ''} hidden>Data contoh</label>` : ''}</div></header>`;
}
const bar = (v, max, c = 'var(--navy)') => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, max ? v / max * 100 : 0))}%;background:${c}"></i></div>`;
const empty = (t) => `<p class="muted small" style="margin:0">${t}</p>`;
const sec = (title, small, body, extra = '') => `<section class="card"${extra}><div class="hd"><h2>${title}</h2>${small ? `<small>${small}</small>` : ''}</div>${body}</section>`;
/* orang & logo (sama dengan Sistem Kerja) */
let PEOPLE = [];
const LOGO = { HQ: '/img/pk.png', RA: '/img/ra.png', WG: '/img/tr.png', NA: '/img/na.png' };
const logo = (code, size = 22) => { const src = LOGO[bizOf(code)] || LOGO[code]; return src ? `<span class="lg" style="width:${size}px;height:${size}px"><img src="${src}" alt=""></span>` : ''; };
const initials = (p) => (p.code || (p.nickname || p.name || '?').slice(0, 2)).toUpperCase();
function avatar(p, size = 32) {
  if (!p) return `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">?</span>`;
  return p.photo ? `<img class="av" src="${esc(/^(https?:)?\//.test(p.photo) ? p.photo : '/' + p.photo)}" alt="" style="width:${size}px;height:${size}px">` : `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">${esc(initials(p))}</span>`;
}
const nick = (p) => (p ? p.nickname || (p.name || '').split(' ')[0] : '');
const leaderOf = (b) => PEOPLE.find(p => p.role === 'leader' && p.unit_code && bizOf(p.unit_code) === b && p.unit_code === b) || PEOPLE.find(p => p.role === 'leader' && p.unit_code && bizOf(p.unit_code) === b);
const roleP = (r) => PEOPLE.find(p => p.role === r);
const csvDl = (name, rows) => { const s = rows.map(r => r.map(c => { c = c == null ? '' : String(c); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + s], { type: 'text/csv' })); a.download = name; a.click(); };

/* ---------- grafik (SVG sendiri, tanpa pustaka) ---------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function trendChart(trend, only) {
  const W = 640, H = 230, L = 46, B = 26, T = 12, keys = only ? [only] : BIZ;
  const rows = trend.map(t => ({ m: t.m, v: keys.map(k => Math.max(0, +(t.by[k] || {}).rev || 0)), net: sum(only ? [only] : ['RA', 'WG', 'NA', 'HQ'], k => (t.by[k] || {}).net) }));
  const max = Math.max(1, ...rows.map(r => sum(r.v, x => x)), ...rows.map(r => r.net)), min = Math.min(0, ...rows.map(r => r.net));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min)), bw = (W - L - 10) / rows.length;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; g += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#EEF0F3"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${rpk(v).replace('Rp', '')}</text>`; }
  g += `<line x1="${L}" x2="${W - 4}" y1="${y(0)}" y2="${y(0)}" stroke="#C9CED6"/>`;
  rows.forEach((r, i) => {
    let acc = 0; const x = L + i * bw + bw * .2, w = bw * .6;
    r.v.forEach((v, j) => { g += `<rect x="${x}" y="${y(acc + v)}" width="${w}" height="${Math.max(0, y(acc) - y(acc + v))}" fill="${COL[keys[j]]}" rx="2"><title>${BIZN[keys[j]]} ${rp(v)}</title></rect>`; acc += v; });
    const [yy, mm] = r.m.split('-'); g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${MON[+mm - 1]} ${yy.slice(2)}</text>`;
  });
  const pts = rows.map((r, i) => [L + i * bw + bw / 2, y(r.net)]);
  g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#F2A33A" stroke-width="2.5"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${rows[i].net < 0 ? '#C2410C' : '#F2A33A'}"><title>Laba bersih ${rp(rows[i].net)}</title></circle>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Omzet dan laba bersih 6 bulan">${g}</svg></div>
    <div class="legend">${keys.map(k => `<span>${dot(k)}Omzet ${BIZN[k]}</span>`).join('')}<span><i class="dot" style="background:#F2A33A;border-radius:5px"></i>Laba bersih${only ? '' : ' grup'}</span></div>`;
}
function dailyChart(daily) {
  if (!daily.length) return empty('Belum ada pergerakan kas.');
  const W = 640, H = 200, L = 46, B = 22, T = 10, mid = T + (H - T - B) / 2;
  const vals = daily.flatMap(d => [+d.in, +d.out]).sort((a, b) => a - b), p90 = vals[Math.floor(vals.length * .9)] || 1;
  const max = Math.max(1, Math.min(Math.max(...vals), p90 * 1.6)), h = (v) => (H - T - B) / 2 * Math.min(v, max) / max, bw = (W - L - 6) / daily.length;
  let g = `<line x1="${L}" x2="${W}" y1="${mid}" y2="${mid}" stroke="#C9CED6"/><text x="${L - 6}" y="${T + 8}" text-anchor="end">+${rpk(max).replace('Rp', '')}</text><text x="${L - 6}" y="${H - B}" text-anchor="end">−${rpk(max).replace('Rp', '')}</text>`;
  daily.forEach((d, i) => {
    const x = L + i * bw + bw * .12, w = Math.max(1, bw * .76);
    g += `<rect x="${x}" y="${mid - h(d.in)}" width="${w}" height="${h(d.in)}" fill="#09BEAF" rx="1"><title>${tgl(d.d)} masuk ${rp(d.in)}</title></rect>`;
    g += `<rect x="${x}" y="${mid}" width="${w}" height="${h(d.out)}" fill="#1D3149" rx="1"><title>${tgl(d.d)} keluar ${rp(d.out)}</title></rect>`;
    if (+d.out > max) g += `<text x="${x + w / 2}" y="${H - B + 2}" text-anchor="middle" style="fill:#9A3F0A;font-weight:900">${rpk(d.out).replace('Rp', '')}</text>`;
    if (+d.in > max) g += `<text x="${x + w / 2}" y="${T + 6}" text-anchor="middle" style="fill:#067A70;font-weight:900">${rpk(d.in).replace('Rp', '')}</text>`;
    if (i === 0 || i === daily.length - 1 || (daily.length > 10 && i % Math.ceil(daily.length / 6) === 0)) g += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${tgl(d.d)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kas masuk dan keluar harian">${g}</svg></div>
    <div class="legend"><span><i class="dot" style="background:#09BEAF"></i>Masuk ${rpk(sum(daily, d => d.in))}</span><span><i class="dot" style="background:#1D3149"></i>Keluar ${rpk(sum(daily, d => d.out))}</span><span>Bersih <b style="margin-left:4px;color:var(--navy)">${rpS(sum(daily, d => d.in - d.out))}</b></span></div>`;
}
function waterfall(steps) {
  const W = 640, H = 210, L = 10, B = 40, T = 14; let run = 0; const bars = steps.map(([l, v, tot]) => { const a = tot ? 0 : run, b = tot ? v : run + v; if (!tot) run += v; else run = v; return { l, v, a, b, tot }; });
  const max = Math.max(1, ...bars.map(b => Math.max(b.a, b.b))), min = Math.min(0, ...bars.map(b => Math.min(b.a, b.b)));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min)), bw = (W - L * 2) / bars.length;
  let g = `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#C9CED6"/>`;
  bars.forEach((b, i) => {
    const x = L + i * bw + bw * .15, w = bw * .7, top = y(Math.max(b.a, b.b)), hh = Math.max(1, Math.abs(y(b.a) - y(b.b)));
    const c = b.tot ? (b.b < 0 ? '#C2410C' : '#1D3149') : b.v < 0 ? '#E9B999' : '#09BEAF';
    g += `<rect x="${x}" y="${top}" width="${w}" height="${hh}" fill="${c}" rx="2"><title>${b.l} ${rp(b.v)}</title></rect><text x="${x + w / 2}" y="${top - 4}" text-anchor="middle" style="fill:#1F2933;font-weight:900">${rpS(b.v).replace('Rp', '')}</text>`;
    g += `<text x="${x + w / 2}" y="${H - 22}" text-anchor="middle">${b.l.split(' ')[0]}</text><text x="${x + w / 2}" y="${H - 9}" text-anchor="middle">${b.l.split(' ').slice(1).join(' ')}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Jembatan dari omzet ke laba bersih">${g}</svg></div>`;
}

/* ---------- olah data dasbor ---------- */
function digest(Dd) {
  const U = Object.fromEntries(Dd.units.map(u => [u.code, u]));
  const z = { rev: 0, hpp: 0, opex: 0, oi: 0, oe: 0, net: 0 };
  const G = Dd.units.reduce((a, u) => { for (const k in z) a[k] += +u.cur[k] || 0; return a; }, { ...z });
  const Gp = { rev: sum(Dd.units, u => u.prev.rev), net: sum(Dd.units, u => u.prev.net) };
  const hq = +Dd.hq_cost || 0;
  const rows = BIZ.filter(b => U[b]).map(b => { const u = U[b], alloc = (u.share || 0) * hq; return { ...u, alloc, after: u.cur.net - alloc, gp: u.cur.rev - u.cur.hpp }; });
  const lines = rows.flatMap(r => r.lines.map(l => ({ ...l, biz: r.code })));
  const cash = Dd.cash, byPos = {}; cash.forEach(c => { byPos[c.pos || 'operasional'] = (byPos[c.pos || 'operasional'] || 0) + +c.book; });
  const obl = Dd.obligations, obl7 = obl.filter(o => o.days <= 7), oblSum = sum(obl, o => o.amount), obl7Sum = sum(obl7, o => o.amount);
  const kewajibanCash = byPos.kewajiban || 0, bal = (k) => +((Dd.balances[k] || {}).bal || 0);
  const diffAcc = cash.filter(c => c.bank_balance != null && Math.abs(c.bank_balance - c.book) >= 1000);
  const stale = cash.filter(c => c.bank && (!c.stmt_last || daysAgo(c.stmt_last) > 3));
  const rab = Dd.rab.reduce((a, r) => { for (const k of ['menunggu', 'menunggu_rp', 'siap', 'siap_rp', 'nota', 'nota_rp', 'telat', 'cek', 'cair_periode', 'real_periode', 'darurat']) a[k] = (a[k] || 0) + (+r[k] || 0); return a; }, {});
  const exc = Dd.exceptions, excN = (+exc.gagal || 0) + (+exc.mutasi || 0);
  const lastMonth = Dd.periods[Dd.periods.length - 2], t = D(Dd.period.today), closeLate = lastMonth && lastMonth.status !== 'locked' && t.getDate() > (+Dd.health.close_day || 5);
  return { U, G, Gp, hq, rows, lines, cash, byPos, obl, obl7, oblSum, obl7Sum, kewajibanCash, bal, diffAcc, stale, rab, exc, excN, lastMonth, closeLate };
}
function decisions(Dd, g) {
  const A = [], KEU = [roleP('keuangan'), 'Keuangan'], add = (lvl, tag, html, href, pic = KEU) => A.push({ lvl, tag, html, href, pic });
  const LEAD = (b) => [leaderOf(b), 'Leader ' + (BIZN[b] || b)];
  const h = Dd.health;
  // 1. kas
  if (h.runway != null && h.runway < 3) add('r', 'KAS', `<b>Runway ${String(h.runway).replace('.', ',')} bulan.</b> Kas ${rpk(h.cash)} vs biaya ${rpk(h.burn)}/bulan. Tahan belanja non-darurat, kejar piutang ${rpk(g.bal('1-10100'))}.`, '#kas');
  else if (h.runway != null && h.runway < 6) add('y', 'KAS', `<b>Runway ${String(h.runway).replace('.', ',')} bulan</b> (aman di atas 6). Biaya rata-rata ${rpk(h.burn)}/bulan.`, '#kas');
  if (g.obl7Sum > g.kewajibanCash) add('r', 'KAS', `<b>Rekening kewajiban kurang ${rpk(g.obl7Sum - g.kewajibanCash)}</b> untuk ${g.obl7.length} tagihan 7 hari ke depan (${esc(g.obl7.map(o => o.name).slice(0, 2).join(', '))}). Isi dari rekening penerimaan.`, '#kewajiban');
  const dp = g.bal('2-20200'); if (dp > 0) add('i', 'KAS', `<b>${rpk(dp)} DP pelanggan</b> masih titipan (booking belum serah-terima). Jangan dihitung sebagai kas bebas.`, '#neraca');
  if (g.diffAcc.length) add('y', 'KAS', `<b>Saldo bank ≠ buku di ${g.diffAcc.length} rekening</b>: ${esc(g.diffAcc.map(c => c.name + ' ' + rpS(c.bank_balance - c.book)).join('; '))}.`, '#kas');
  // 2. profitabilitas
  g.rows.filter(r => r.after < 0).forEach(r => add('r', 'PROFIT', `<b>${esc(r.name)} rugi ${rpk(-r.after)}</b> setelah menanggung biaya holding ${rpk(r.alloc)} (laba unit ${rpS(r.cur.net)}).`, '#unit/' + r.code, LEAD(r.code)));
  const loss = g.lines.filter(l => l.net < 0 && l.rev > 0); if (loss.length) add('y', 'PROFIT', `<b>${loss.length} lini rugi:</b> ${esc(loss.map(l => l.name + ' ' + rpS(l.net)).join(', '))}. Putuskan: perbaiki harga/biaya, gabung, atau tutup.`, '#unit/' + loss[0].biz, [roleP('ceo'), 'CEO']);
  g.rows.forEach(r => { if (r.prev.rev > 0 && (r.cur.rev - r.prev.rev) / r.prev.rev < -.1) add('y', 'PROFIT', `<b>Omzet ${esc(r.name)} turun ${pct((r.prev.rev - r.cur.rev) / r.prev.rev * 100)}</b> dibanding periode lalu (${rpk(r.prev.rev)} → ${rpk(r.cur.rev)}).`, '#unit/' + r.code, LEAD(r.code)); });
  const hqPct = ratio(g.hq, sum(g.rows, r => r.cur.rev)); if (hqPct != null && hqPct > 20) add('y', 'PROFIT', `<b>Biaya holding ${pct(hqPct)} dari omzet unit</b> (${rpk(g.hq)}). Batas sehat ≤ 15%.`, '#unit/HQ', [roleP('ceo'), 'CEO']);
  // 3. kapasitas eksekusi
  if (g.rab.telat) add('y', 'EKSEKUSI', `<b>${g.rab.telat} LPJ telat</b> — uang sudah cair ${rpk(g.rab.nota_rp)} belum ada nota. Tagih ke pengaju.`, '#rab', [roleP('kepala_staf'), 'Kepala Staf']);
  if (g.rab.siap) add('i', 'EKSEKUSI', `<b>${g.rab.siap} belanja siap cair</b> (${rpk(g.rab.siap_rp)}) menunggu transfer Keuangan.`, '#rab');
  // 4. data & tutup buku
  if (g.closeLate) add('r', 'DATA', `<b>Buku ${bulan(g.lastMonth.m + '-01')} belum ditutup</b>, lewat tanggal ${Dd.health.close_day}. Laporan bulan itu masih bisa berubah.`, '#sumber');
  Dd.sources.filter(s => s.active && s.last && daysAgo(s.last) >= 2 && s.kind !== 'sistem').forEach(s => add('y', 'DATA', `<b>${esc(s.name)} tidak mengirim data ${daysAgo(s.last)} hari.</b> Omzet ${esc(BIZN[s.unit] || s.unit)} bisa kurang tercatat.`, '#sumber', LEAD(s.unit)));
  Dd.sources.filter(s => !s.active && s.unit !== 'HQ').forEach(s => add('i', 'DATA', `<b>${esc(s.name)} belum tersambung.</b> Omzet ${esc(BIZN[s.unit] || s.unit)} belum masuk otomatis.`, '#sumber'));
  if (g.excN) add('y', 'DATA', `<b>${g.excN} hal di antrean Keuangan</b>: ${g.exc.gagal} transaksi gagal dibukukan, ${g.exc.mutasi} mutasi bank belum dikenali.`, '#antrean');
  const rank = { r: 0, y: 1, i: 2 }, ord = { KAS: 0, PROFIT: 1, EKSEKUSI: 2, DATA: 3 };
  return A.sort((a, b) => ord[a.tag] - ord[b.tag] || rank[a.lvl] - rank[b.lvl]);
}
const alertHtml = (a) => `<a class="alert ${a.lvl === 'r' ? '' : a.lvl}" href="${a.href}"><span class="k">${a.tag}</span><span>${a.html}</span><span class="pic" title="Penanggung jawab">${avatar(a.pic[0] || { name: a.pic[1], code: a.pic[1].replace(/^Leader /, '').slice(0, 2) }, 30)}${esc(a.pic[0] ? nick(a.pic[0]) : a.pic[1])}</span></a>`;

/* ---------- 1. Ringkasan ---------- */
async function vRingkasan() {
  const p = period(), mon = /^\d{4}-\d{2}$/.test(S.per) ? S.per : null;
  const soft = (pr, dflt) => pr.catch(() => dflt);
  const [Dd, F, ST, LN, OP, TG] = await Promise.all([data('dash', p), soft(data('fc'), null), soft(settings(), {}), soft(loans(), []), soft(data('open'), null), mon ? soft(data('tgt', { month: mon + '-01' }), []) : Promise.resolve([])]);
  const g = digest(Dd), h = Dd.health, dec = decisions(Dd, g);
  setBadges(Dd, g);
  // tambahan: proyeksi kas, saldo awal, target, Profit First, pinjaman
  const KEU = [roleP('keuangan'), 'Keuangan'], push = (lvl, tag, html, href, pic = KEU) => dec.push({ lvl, tag, html, href, pic });
  if (F && F.first_low) push('r', 'KAS', `<b>Kas diproyeksikan di bawah minimum mulai ${tgl(F.first_low)}</b> (titik terendah ${rpS(F.lowest)}). Tunda belanja, percepat tagihan.`, '#proyeksi');
  if (F) setBadge('fclow', F.first_low ? '!' : 0);
  if (OP && !OP.date && !usingDemo()) push('y', 'DATA', '<b>Saldo awal belum diisi.</b> Kas, piutang, hutang, dan aset masih nol sampai neraca pembuka dimasukkan.', '#saldo');
  setBadge('saldo', OP && !OP.date && !usingDemo() ? '!' : 0);
  const tgtBiz = (b) => sum(TG.filter(t => bizOf(t.unit_code) === b), t => t.amount), dm = mon ? new Date(+mon.slice(0, 4), +mon.slice(5, 7), 0).getDate() : 0;
  const pace = mon ? Math.min(1, ((D(p.to) - D(p.from)) / 864e5 + 1) / dm) : 0, tgtAll = sum(TG, t => t.amount);
  g.rows.forEach(r => { const t = tgtBiz(r.code); if (t && r.cur.rev < t * pace * .9) push('y', 'PROFIT', `<b>${esc(r.name)} tertinggal dari target</b>: ${rpk(r.cur.rev)} dari ${rpk(t)} (${pct(r.cur.rev / t * 100)}, seharusnya ±${pct(pace * 100)}).`, '#target', [leaderOf(r.code), 'Leader ' + r.name]); });
  const PF = ST.fin_profit_first || {}, totPos = sum(Object.values(g.byPos), v => v), inbox = g.byPos.penerimaan || 0;
  const pfNeed = sum(Object.keys(FPOS), k => Math.max(0, totPos * (+PF[k] || 0) / 100 - (g.byPos[k] || 0)));
  if (inbox > 0 && pfNeed > 0) push('i', 'KAS', `<b>${rpk(Math.min(inbox, pfNeed))} belum dibagi</b> dari rekening penerimaan ke pos Profit First.`, '#pf');
  const lc = (LN || []).filter(l => l.is_active !== false).map(l => loanCalc(l, today())), loanRem = sum(lc, c => c.rem), taxEst = g.G.rev * (+ST.fin_tax_rate || 0) / 100;
  { const rank = { r: 0, y: 1, i: 2 }, ord = { KAS: 0, PROFIT: 1, EKSEKUSI: 2, DATA: 3 }; dec.sort((a, b) => ord[a.tag] - ord[b.tag] || rank[a.lvl] - rank[b.lvl]); }
  const gm = ratio(g.G.rev - g.G.hpp, g.G.rev), nm = ratio(g.G.net, g.G.rev);
  cur = { Dd, g, dec };
  let o = waShare('Keuangan grup') + header('Keuangan grup', 'Satu buku untuk Rentalaja, TripinAja, Niagaaja, dan Holding. Urutan baca: kas → profit → eksekusi → pertumbuhan.');
  o += sec('Perlu ditindak', dec.length ? dec.length + ' hal · diurutkan kas → profit → eksekusi → data' : '', dec.length ? `<div class="alerts">${dec.slice(0, 10).map(alertHtml).join('')}</div>` : '<div class="ok">Tidak ada yang perlu diputuskan hari ini.</div>');
  const lowW = F && F.weeks && F.weeks.length ? F.weeks.reduce((a, w) => (w.close < a.close ? w : a), F.weeks[0]) : null;
  o += `<div class="tiles">
    ${tile('Kas & bank', rpk(h.cash), `${g.cash.length} rekening${g.diffAcc.length ? ' · ' + g.diffAcc.length + ' selisih bank' : ' · cocok dengan bank'}`, '', '#kas')}
    ${tile('Runway', h.runway == null ? '—' : String(h.runway).replace('.', ',') + ' bln', 'biaya tunai ' + rpk(h.burn) + '/bln (rata² 3 bln)', h.runway != null && h.runway < 3 ? 'bad' : h.runway < 6 ? 'warn' : '', '#kas')}
    ${tile('Kas terendah 13 mgg', lowW ? rpS(lowW.close) : '—', lowW ? 'minggu ' + tgl(lowW.week) + (F.first_low ? ' · di bawah minimum' : '') : 'proyeksi kas', F && F.first_low ? 'bad' : '', '#proyeksi')}
    ${tile('Kewajiban 30 hari', rpk(g.oblSum), `${g.obl.length} tagihan · ${g.obl7.length} dalam 7 hari`, g.obl7Sum > g.kewajibanCash ? 'bad' : '', '#kewajiban')}
    ${tile('Belum dibagi (Profit First)', rpk(inbox), pfNeed > 0 ? 'perlu dipindah ke pos' : 'pos sudah seimbang', inbox > 0 && pfNeed > 0 ? 'warn' : '', '#pf')}
    ${tile('DP pelanggan', rpk(g.bal('2-20200')), 'titipan, belum jadi pendapatan', 'mute', '#neraca')}
    ${tile('Omzet grup', rpk(g.G.rev), delta(g.G.rev, g.Gp.rev) + ' vs periode lalu ' + rpk(g.Gp.rev))}
    ${tile('Capaian target', tgtAll ? pct(g.G.rev / tgtAll * 100) : '—', tgtAll ? 'target ' + rpk(tgtAll) + ' · laju ' + pct(pace * 100) : mon ? 'target bulan ini belum ada' : 'pilih satu bulan', tgtAll && g.G.rev < tgtAll * pace * .9 ? 'warn' : '', '#target')}
    ${tile('Laba bersih grup', rpS(g.G.net), 'margin ' + pct(nm) + ' · ' + delta(g.G.net, g.Gp.net), g.G.net < 0 ? 'bad' : '', '#labarugi')}
    ${tile('Margin kotor', pct(gm), 'laba kotor ' + rpk(g.G.rev - g.G.hpp) + ' · HPP ' + rpk(g.G.hpp), gm != null && gm < 40 ? 'warn' : '')}
    ${tile('Biaya holding', rpk(g.hq), pct(ratio(g.hq, sum(g.rows, r => r.cur.rev))) + ' dari omzet unit · dibagi ke unit', ratio(g.hq, sum(g.rows, r => r.cur.rev)) > 20 ? 'warn' : '', '#unit/HQ')}
    ${tile('Estimasi PPh final', rpk(taxEst), String(+ST.fin_tax_rate || 0).replace('.', ',') + '% × omzet bruto · cek konsultan', 'mute', '#kewajiban')}
    ${tile('Piutang usaha', rpk(g.bal('1-10100')), 'kasbon staf ' + rpk(g.bal('1-10101')), g.bal('1-10100') > h.burn * .2 ? 'warn' : '', '#pihak/piutang')}
    ${(() => { const pt = lc.filter(c => c.partial).length, ci = sum(lc.filter(c => c.left !== 0), c => c.inst); return pt ? tile('Cicilan leasing & pinjaman', rpk(ci) + '/bln', lc.length + ' kontrak · ' + pt + ' belum ada pokok/tenor' + (loanRem ? ' · sisa pokok ' + rpk(loanRem) + '+' : ''), 'warn', '#kewajiban') : tile('Sisa pokok pinjaman', rpk(lc.length ? loanRem : g.bal('2-21000')), lc.length ? lc.length + ' pinjaman · cicilan ' + rpk(ci) + '/bln' : 'dari neraca', 'mute', '#kewajiban'); })()}
    ${tile('Hutang usaha', rpk(g.bal('2-20100') + g.bal('2-20300')), 'vendor ' + rpk(g.bal('2-20100')) + ' · mitra ' + rpk(g.bal('2-20300')), '', '#pihak/hutang')}
    ${tile('Belanja berjalan', (g.rab.menunggu + g.rab.siap) + ' pengajuan', rpk(g.rab.menunggu_rp + g.rab.siap_rp) + ' · ' + g.rab.telat + ' LPJ telat', g.rab.telat ? 'warn' : '', '#rab')}
    ${tile('Pembukuan otomatis', h.auto == null ? '—' : h.auto + '%', (h.entries || 0).toLocaleString('id-ID') + ' jurnal · antrean ' + g.excN, g.excN ? 'warn' : '', '#antrean')}
    ${tile('Saldo awal', OP && OP.date ? tgl(OP.date) + ' ' + OP.date.slice(0, 4) : usingDemo() ? 'contoh' : 'belum', OP && OP.date ? 'neraca pembuka tersimpan' : 'diisi tim Keuangan', OP && !OP.date && !usingDemo() ? 'warn' : '', '#saldo')}</div>`;

  // kartu unit (gaya Unit Bisnis KKH): peringkat menurut laba setelah biaya holding
  const sorted = [...g.rows].sort((a, b) => b.after - a.after), cashOf = (b) => sum(g.cash.filter(c => bizOf(c.unit) === b), c => c.book);
  o += `<div class="ucards">${sorted.map((r, i) => {
    const L = leaderOf(r.code), m = ratio(r.after, r.cur.rev), st = r.after < 0 ? ['Rugi', 'red'] : m < 5 ? ['Tipis', 'yellow'] : ['Sehat', 'green'];
    const lmax = Math.max(...r.lines.map(l => l.rev), 1);
    return `<a class="card ucard${i === 0 && r.after > 0 ? ' first' : ''}" style="--c:${COL[r.code]}" href="#unit/${r.code}">
      <div class="uhead"><span class="rank">#${i + 1}</span>${logo(r.code, 44)}<span class="uname"><b>${esc(r.name)}</b><small>${L ? avatar(L, 18) + '<span>Leader ' + esc(nick(L)) + '</span>' : '<span>' + (r.lines.length ? r.lines.length + ' lini' : 'satu lini') + '</span>'}</small></span>
        <span class="upts"><b class="${m < 0 ? 'red' : ''}">${pct(m)}</b><small class="muted">margin bersih</small></span></div>
      <div><div class="row between"><span class="lab">LABA SETELAH BIAYA HOLDING</span><span class="chip ${st[1]}">${st[0]}</span></div>
        <div class="bigrow"><b class="big ${r.after < 0 ? 'red' : ''}">${rpS(r.after)}</b><span class="muted small">omzet <b>${rpk(r.cur.rev)}</b> ${delta(r.cur.rev, r.prev.rev)}</span></div>
        <span class="bar lg"><i style="width:${Math.max(2, (r.share || 0) * 100)}%;background:${COL[r.code]}"></i></span><span class="muted small">${pct((r.share || 0) * 100)} omzet grup</span></div>
      ${r.lines.filter(l => l.rev || l.net).length ? `<div class="mini">${r.lines.filter(l => l.rev || l.net).sort((a, b) => b.rev - a.rev).map(l => `<div><span>${esc(l.name)}</span><span class="bar"><i style="width:${l.rev / lmax * 100}%;background:${l.net < 0 ? '#C2410C' : '#09BEAF'}"></i></span><b class="${l.net < 0 ? 'red' : ''}">${rpS(l.net)}<small>omzet ${rpk(l.rev)}</small></b></div>`).join('')}</div>` : ''}
      <div class="kvs"><div><span>LABA UNIT</span><b class="${r.cur.net < 0 ? 'red' : ''}">${rpS(r.cur.net)}</b></div><div><span>BIAYA HOLDING</span><b>${rpk(r.alloc)}</b></div><div><span>KAS UNIT</span><b>${rpk(cashOf(r.code))}</b></div></div></a>`; }).join('')}</div>`;
  const hqL = UNITS.filter(u => u.parent === 'HQ'), hqU = g.U.HQ || { lines: [] };
  o += `<a class="card hqcard" href="#unit/HQ" style="text-decoration:none;color:inherit">${logo('HQ', 40)}<span class="grow"><span class="lab">HOLDING · BIAYA BERSAMA</span><b class="big">${rpk(g.hq)}</b><span class="muted small">${pct(ratio(g.hq, sum(g.rows, r => r.cur.rev)))} dari omzet unit · ditanggung ${g.rows.map(r => esc(r.name) + ' ' + rpk(r.alloc)).join(' · ')}</span></span>
    <span class="chips">${hqU.lines.filter(l => l.net).map(l => `<span class="chip">${esc(l.name)} ${rpk(-l.net)}</span>`).join('')}</span></a>`;
  void hqL;
  // kinerja unit
  const maxRev = Math.max(...g.rows.map(r => r.cur.rev), 1), totAlloc = sum(g.rows, r => r.alloc);
  const urow = (r) => `<tr class="click" data-go="#unit/${r.code}"><td class="nw"><b>${logo(r.code, 20)}${esc(r.name)}</b></td><td class="r">${rpk(r.cur.rev)}</td><td class="r">${delta(r.cur.rev, r.prev.rev)}</td>
    <td class="r">${rpk(r.gp)}</td><td class="r">${pct(ratio(r.gp, r.cur.rev))}</td><td class="r">${rpk(r.cur.opex)}</td><td class="r ${mcls(r.cur.net)}">${rpS(r.cur.net)}</td><td class="r">${pct(ratio(r.cur.net, r.cur.rev))}</td>
    <td class="r">${rpk(r.alloc)}</td><td class="r ${mcls(r.after)}"><b>${rpS(r.after)}</b></td><td style="min-width:110px">${bar(r.cur.rev, maxRev, COL[r.code])}<span class="small muted">${pct((r.share || 0) * 100)} omzet</span></td></tr>`;
  o += sec('Rincian kinerja unit', 'biaya holding dibagi menurut porsi omzet · klik baris untuk rinci', `<div class="scroll"><table class="ftbl"><thead><tr><th>Unit</th><th class="r">Omzet</th><th class="r">vs lalu</th><th class="r">Laba kotor</th><th class="r">GM</th><th class="r">Biaya operasional</th><th class="r">Laba unit</th><th class="r">Margin</th><th class="r">Biaya holding</th><th class="r">Setelah holding</th><th>Porsi</th></tr></thead><tbody>
    ${g.rows.map(urow).join('')}
    <tr class="click" data-go="#unit/HQ"><td class="nw"><b>${logo('HQ', 20)}Holding</b> <span class="muted small">biaya bersama</span></td><td class="r">${rpk(g.U.HQ ? g.U.HQ.cur.rev : 0)}</td><td></td><td></td><td></td><td class="r">${rpk(g.U.HQ ? g.U.HQ.cur.opex : 0)}</td><td class="r neg">${rpS(g.U.HQ ? g.U.HQ.cur.net : 0)}</td><td></td><td class="r">${rpS(-totAlloc)}</td><td class="r">—</td><td></td></tr>
    <tr class="tot"><td>Grup</td><td class="r">${rpk(g.G.rev)}</td><td class="r">${delta(g.G.rev, g.Gp.rev)}</td><td class="r">${rpk(g.G.rev - g.G.hpp)}</td><td class="r">${pct(gm)}</td><td class="r">${rpk(g.G.opex)}</td><td class="r ${mcls(g.G.net)}">${rpS(g.G.net)}</td><td class="r">${pct(nm)}</td><td class="r">0</td><td class="r ${mcls(g.G.net)}">${rpS(g.G.net)}</td><td></td></tr></tbody></table></div>`);

  o += `<div class="cols">${sec('Omzet & laba 6 bulan', 'per unit bisnis', trendChart(Dd.trend))}${sec('Kas masuk & keluar harian', 'semua rekening grup', dailyChart(Dd.daily))}</div>`;

  // lini bisnis + kas per pos + jatuh tempo
  const L = [...g.lines].filter(l => l.rev || l.net).sort((a, b) => a.net - b.net), lmax = Math.max(...L.map(l => Math.abs(l.net)), 1);
  const lini = `<table class="ftbl compact"><thead><tr><th>Lini</th><th class="r">Omzet</th><th class="r">Laba</th><th class="r">Margin</th><th></th></tr></thead><tbody>${L.map(l => `<tr class="click" data-go="#unit/${l.biz}"><td class="nw">${dot(l.biz)}${esc(l.name)}</td><td class="r">${rpk(l.rev)}</td><td class="r ${mcls(l.net)}">${rpS(l.net)}</td><td class="r">${pct(ratio(l.net, l.rev))}</td><td style="width:70px">${bar(Math.abs(l.net), lmax, l.net < 0 ? '#C2410C' : COL[l.biz])}</td></tr>`).join('')}</tbody></table>`;
  const posTot = sum(Object.values(g.byPos), v => v);
  const pos = `<div class="stackbar">${Object.keys(POS).map((k, i) => `<i style="width:${(g.byPos[k] || 0) / posTot * 100}%;background:${['#09BEAF', '#1D3149', '#F2A33A', '#5B8DEF', '#7FD6C9'][i]}" title="${POS[k][0]}"></i>`).join('')}</div>
    <div class="list">${Object.keys(POS).map((k, i) => `<div class="li"><i class="dot" style="background:${['#09BEAF', '#1D3149', '#F2A33A', '#5B8DEF', '#7FD6C9'][i]}"></i><div class="t"><b>${POS[k][0]}</b><span>${POS[k][1]}</span></div><b>${rpk(g.byPos[k] || 0)}</b><span class="muted small" style="width:40px;text-align:right">${pct((g.byPos[k] || 0) / posTot * 100)}</span></div>`).join('')}</div>`;
  const due = g.obl.length ? `<div class="list">${g.obl.slice(0, 7).map(oo => `<div class="li"><div class="due ${oo.days <= 3 ? 'r' : oo.days <= 7 ? 'y' : ''}">${oo.days}<small>hari</small></div><div class="t"><b>${esc(oo.name)}</b><span>${esc(KIND[oo.kind] || oo.kind)} · ${esc(uname(oo.unit))} · ${tgl(oo.due)}</span></div><b>${rpk(oo.amount)}</b></div>`).join('')}</div>` : empty('Tidak ada tagihan rutin 30 hari ke depan.');
  o += `<div class="cols3">${sec('Lini bisnis', 'diurutkan dari yang paling rugi', `<div class="scroll">${lini}</div>`)}${sec('Kas per pos', 'rekening dipisah per fungsi (Profit First)', pos)}${sec('Jatuh tempo 30 hari', rpk(g.oblSum) + ' · dana kewajiban ' + rpk(g.kewajibanCash), due)}</div>`;

  // biaya, bauran pendapatan, kesehatan data
  const emax = Math.max(...Dd.expense_top.map(e => e.amt), 1);
  const biaya = `<table class="ftbl compact"><tbody>${Dd.expense_top.slice(0, 8).map(e => `<tr><td>${esc(e.name)}<div class="stackbar" style="height:6px;margin-top:4px;width:${e.amt / emax * 100}%">${['RA', 'WG', 'NA', 'HQ'].map(b => `<i style="width:${(e.by[b] || 0) / e.amt * 100}%;background:${COL[b]}"></i>`).join('')}</div></td><td class="r">${rpk(e.amt)}</td><td class="r muted small">${pct(ratio(e.amt, g.G.rev))}</td></tr>`).join('')}</tbody></table>`;
  const mmax = Math.max(...Dd.revenue_mix.map(e => e.amt), 1);
  const mix = `<table class="ftbl compact"><tbody>${Dd.revenue_mix.slice(0, 9).map(e => `<tr><td>${esc(e.name)}${bar(e.amt, mmax, COL[e.code[0] === '4' ? (e.code.startsWith('4-41') ? 'WG' : e.code.startsWith('4-42') ? 'NA' : 'RA') : 'HQ'])}</td><td class="r">${rpk(e.amt)}</td><td class="r muted small">${pct(ratio(e.amt, g.G.rev + g.G.oi))}</td></tr>`).join('')}</tbody></table>`;
  const srcs = `<div class="list">${Dd.sources.map(s => { const a = daysAgo(s.last); const st = !s.active ? '<span class="pill">belum tersambung</span>' : s.gagal ? `<span class="pill y">${s.gagal} gagal</span>` : a != null && a >= 2 ? `<span class="pill y">${a} hari diam</span>` : '<span class="pill g">lancar</span>'; return `<div class="li"><div class="t"><b>${esc(s.name)}</b><span>${s.n30.toLocaleString('id-ID')} transaksi 30 hari · terakhir ${s.last ? (a ? a + ' hari lalu' : 'hari ini') : '—'}</span></div>${st}</div>`; }).join('')}</div>`;
  o += `<div class="cols3">${sec('Biaya terbesar', 'warna = unit penanggung', biaya + `<div class="legend">${['RA', 'WG', 'NA', 'HQ'].map(b => `<span>${dot(b)}${BIZN[b]}</span>`).join('')}</div>`)}${sec('Sumber pendapatan', 'per akun', mix)}${sec('Kesehatan data', 'semua angka berasal dari sumber ini', srcs)}</div>`;
  cur = { Dd, g, dec };
  return o;
}
/* bagikan ke WhatsApp: hanya ke nomor owner (CEO) dan Keuangan, tidak ke grup */
let WA_TO = null;
function waShare(title) {
  const allowed = PEOPLE.filter(p => ['ceo', 'keuangan'].includes(p.role));
  if (WA_TO === null) WA_TO = allowed.map(p => p.id);
  const to = allowed.filter(p => WA_TO.includes(p.id));
  return `<details class="wa" data-wa><summary><span>Laporan <b>${esc(title)}</b> · ${esc(period().label)} ke ${to.length ? esc(to.map(nick).join(', ')) : 'owner & Keuangan'}</span>
    <span class="wa-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12z"/><path d="M9 9.5c0 2.5 2 5 5 5.5l1.2-1.2-1.6-.9-.8.6c-1-.4-1.8-1.2-2.2-2.2l.6-.8-.9-1.6z"/></svg>Bagikan ke WhatsApp</span></summary>
    <div class="wa-body"><div class="wa-prev"><div>${esc(summaryText())}</div></div>
      <div class="wa-side"><div class="fl">Penerima<div class="chips">${allowed.length ? allowed.map(p => `<button type="button" class="rcp ${WA_TO.includes(p.id) ? 'on' : ''}" data-rcp="${esc(p.id)}">${avatar(p, 24)}${esc(nick(p))} · ${esc(ROLE[p.role])}</button>`).join('') : '<span class="muted small">Nomor owner & Keuangan diambil dari Tim & Peran.</span>'}</div></div>
        <div class="small muted">Laporan keuangan hanya bisa dikirim ke nomor owner dan Keuangan yang terdaftar, dan tidak bisa dibagikan ke grup.</div>
        <div class="row gap" style="flex-wrap:wrap"><button type="button" class="btn pri" data-wasend>Kirim sekarang</button><button type="button" class="btn" data-copy>Salin teks</button></div></div></div></details>`;
}
function summaryText() {
  if (!cur) return '';
  const { Dd, g, dec } = cur, p = period(), h = Dd.health;
  return [`*Keuangan grup Pokama · ${p.label}*${usingDemo() ? ' (DATA CONTOH)' : ''}`, '',
    `Kas & bank: ${rpk(h.cash)} · runway ${h.runway == null ? '—' : String(h.runway).replace('.', ',') + ' bln'}`,
    `Kewajiban 30 hari: ${rpk(g.oblSum)} (${g.obl.length} tagihan)`,
    `Omzet grup: ${rpk(g.G.rev)} · laba bersih ${rpS(g.G.net)} (margin ${pct(ratio(g.G.net, g.G.rev))})`, '',
    ...g.rows.map(r => `• ${r.name}: omzet ${rpk(r.cur.rev)}, laba unit ${rpS(r.cur.net)}, setelah holding ${rpS(r.after)}`),
    `• Biaya holding: ${rpk(g.hq)}`, '', '*Perlu keputusan*', ...dec.slice(0, 6).map((a, i) => (i + 1) + '. ' + a.html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'))].join('\n');
}

/* ---------- 2. Per unit bisnis ---------- */
async function vUnit(code) {
  const b = ['RA', 'WG', 'NA', 'HQ'].includes(code) ? code : S.biz; S.biz = b;
  const p = period(), [Dd, P] = await Promise.all([data('dash', p), data('pl', p)]), g = digest(Dd), u = g.U[b] || { cur: {}, prev: {}, lines: [] };
  setBadges(Dd, g);
  const row = g.rows.find(r => r.code === b), rows = P.filter(r => r.biz === b);
  const L0 = leaderOf(b), tabs = `<div class="chips">${['RA', 'WG', 'NA', 'HQ'].map(k => `<a href="#unit/${k}" class="chipbtn ${k === b ? 'on' : ''}">${logo(k, 22)}${BIZN[k]}</a>`).join('')}${L0 ? `<span class="row gap6 muted small" style="margin-left:auto">${avatar(L0, 26)}Leader <b>${esc(nick(L0))}</b></span>` : ''}</div>`;
  let o = header(BIZN[b], b === 'HQ' ? 'Biaya bersama holding (Keuangan, BizDev, Marketing, Aset) yang ditanggung ketiga unit menurut porsi omzet.' : 'Laba per lini, biaya, kas, kewajiban, dan belanja unit ini.') + tabs;
  const cashU = g.cash.filter(c => bizOf(c.unit) === b || (!c.unit && b === 'RA')), oblU = g.obl.filter(x => bizOf(x.unit) === b), rabU = Dd.rab.find(r => r.biz === b) || {};
  const c = u.cur;
  if (b === 'HQ') {
    o += `<div class="tiles">${tile('Biaya holding', rpk(g.hq), 'periode ini · ' + delta(-u.cur.net, -u.prev.net, true) + ' vs lalu')}${tile('Porsi dari omzet unit', pct(ratio(g.hq, sum(g.rows, r => r.cur.rev))), 'batas sehat ≤ 15%', ratio(g.hq, sum(g.rows, r => r.cur.rev)) > 20 ? 'warn' : '')}
      ${g.rows.map(r => tile('Ditanggung ' + r.name, rpk(r.alloc), pct((r.share || 0) * 100) + ' porsi omzet')).join('')}
      ${tile('Kas holding', rpk(sum(cashU, x => x.book)), cashU.length + ' rekening')}</div>`;
  } else {
    o += `<div class="tiles">${tile('Omzet', rpk(c.rev), delta(c.rev, u.prev.rev) + ' vs lalu ' + rpk(u.prev.rev))}${tile('Laba kotor', rpk(c.rev - c.hpp), 'GM ' + pct(ratio(c.rev - c.hpp, c.rev)))}
      ${tile('Biaya operasional', rpk(c.opex), pct(ratio(c.opex, c.rev)) + ' dari omzet')}${tile('Laba unit', rpS(c.net), 'margin ' + pct(ratio(c.net, c.rev)) + ' · ' + delta(c.net, u.prev.net), c.net < 0 ? 'bad' : '')}
      ${tile('Biaya holding', rpk(row ? row.alloc : 0), 'dibebankan ' + pct((u.share || 0) * 100) + ' (porsi omzet)')}${tile('Setelah holding', rpS(row ? row.after : 0), 'yang benar-benar disumbang ke grup', row && row.after < 0 ? 'bad' : '')}
      ${tile('Kas unit', rpk(sum(cashU, x => x.book)), cashU.length + ' rekening')}${tile('Kewajiban 30 hari', rpk(sum(oblU, x => x.amount)), oblU.length + ' tagihan')}
      ${tile('Pendapatan lain', rpk(c.oi), 'denda, klaim, pembatalan')}${tile('Beban lain', rpk(c.oe), 'bunga leasing, pajak')}
      ${tile('Belanja berjalan', ((+rabU.menunggu || 0) + (+rabU.siap || 0)) + ' pengajuan', (+rabU.telat || 0) + ' LPJ telat', rabU.telat ? 'warn' : '', '#rab')}${tile('Biaya per Rp100 omzet', c.rev ? 'Rp' + Math.round((c.hpp + c.opex + c.oe) / c.rev * 100) : '—', 'makin kecil makin efisien')}</div>`;
  }
  // matriks laba rugi per lini
  const lines = UNITS.filter(x => x.parent === b).map(x => x.code).concat(rows.some(r => r.unit === b) ? [b] : []).filter(code2 => rows.some(r => r.unit === code2));
  const accs = [...new Set(rows.map(r => r.acc))].sort(), v = (acc, un) => sum(rows.filter(r => r.acc === acc && r.unit === un), r => r.amt);
  const tot = (pre, un) => sum(rows.filter(r => pre.includes(r.acc[0]) && (!un || r.unit === un)), r => r.amt);
  const netOf = (un) => tot('47', un) - tot('568', un);
  const lname = (x) => x === b ? 'Bersama ' + BIZN[b] : uname(x);
  let m = `<table class="ftbl compact"><thead><tr><th>Akun</th>${lines.map(x => `<th class="r">${esc(lname(x))}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>`;
  for (const [title, pre] of [['PENDAPATAN', '4'], ['HPP', '5'], ['BIAYA OPERASIONAL', '6'], ['PENDAPATAN LAIN', '7'], ['BEBAN LAIN', '8']]) {
    const a = accs.filter(x => x[0] === pre); if (!a.length) continue;
    m += `<tr class="sec"><td colspan="${lines.length + 2}">${title}</td></tr>` + a.map(acc => `<tr><td class="ind">${esc(X.ACC[acc] || (rows.find(r => r.acc === acc) || {}).name || acc)}</td>${lines.map(x => `<td class="r">${v(acc, x) ? num(v(acc, x)) : '<span class="muted">–</span>'}</td>`).join('')}<td class="r b">${num(sum(lines, x => v(acc, x)))}</td></tr>`).join('');
  }
  m += `<tr class="tot"><td>Laba (rugi) lini</td>${lines.map(x => `<td class="r ${mcls(netOf(x))}">${num(netOf(x))}</td>`).join('')}<td class="r ${mcls(netOf())}">${num(netOf())}</td></tr>`;
  if (b !== 'HQ') m += `<tr><td class="muted">Margin</td>${lines.map(x => `<td class="r muted">${pct(ratio(netOf(x), tot('4', x)))}</td>`).join('')}<td class="r muted">${pct(ratio(netOf(), tot('4')))}</td></tr>`;
  m += '</tbody></table>';
  o += sec(b === 'HQ' ? 'Biaya per divisi' : 'Laba rugi per lini', 'rupiah · periode terpilih', `<div class="scroll">${m}</div>`);
  const kas = cashU.length ? `<table class="ftbl compact"><thead><tr><th>Rekening</th><th class="r">Saldo</th><th class="r">Masuk</th><th class="r">Keluar</th></tr></thead><tbody>${cashU.map(x => `<tr><td>${esc(x.name)}<br><span class="muted small">${esc((POS[x.pos] || [x.pos])[0] || '')}${x.bank ? ' · ' + esc(x.bank) : ' · tunai'}</span></td><td class="r b">${rpk(x.book)}</td><td class="r">${rpk(x.in)}</td><td class="r">${rpk(x.out)}</td></tr>`).join('')}</tbody></table>` : empty('Tidak ada rekening khusus unit ini.');
  const ob = oblU.length ? `<div class="list">${oblU.map(oo => `<div class="li"><div class="due ${oo.days <= 3 ? 'r' : oo.days <= 7 ? 'y' : ''}">${oo.days}<small>hari</small></div><div class="t"><b>${esc(oo.name)}</b><span>${esc(KIND[oo.kind] || oo.kind)} · ${tgl(oo.due)}</span></div><b>${rpk(oo.amount)}</b></div>`).join('')}</div>` : empty('Tidak ada tagihan rutin 30 hari ke depan.');
  o += `<div class="cols">${sec('Tren 6 bulan', b === 'HQ' ? 'biaya bersih holding (negatif)' : 'omzet & laba bersih ' + BIZN[b], trendChart(Dd.trend, b))}<div class="stack">${sec('Kas & bank unit', '', `<div class="scroll">${kas}</div>`)}${sec('Jatuh tempo unit', '', ob)}</div></div>`;
  return o;
}

/* ---------- 3. Kas & bank ---------- */
async function vKas() {
  const p = period(), Dd = await data('dash', p), g = digest(Dd), h = Dd.health; setBadges(Dd, g);
  let o = header('Kas & bank', 'Semua rekening grup dikelompokkan per pos. Saldo buku dibandingkan dengan saldo bank dari mutasi terakhir; klik rekening untuk lihat mutasi.');
  const tdiff = sum(g.diffAcc, c => c.bank_balance - c.book), unm = sum(g.cash, c => +c.unmatched || 0);
  o += `<div class="tiles">${tile('Total kas & bank', rpk(h.cash), g.cash.length + ' rekening')}${tile('Kas bebas', rpk(h.cash - g.bal('2-20200') - g.oblSum), 'kas − DP pelanggan − kewajiban 30 hari', h.cash - g.bal('2-20200') - g.oblSum < h.burn ? 'warn' : '')}
    ${tile('Runway', h.runway == null ? '—' : String(h.runway).replace('.', ',') + ' bln', 'biaya ' + rpk(h.burn) + '/bln', h.runway < 3 ? 'bad' : h.runway < 6 ? 'warn' : '')}${tile('Selisih bank vs buku', rpS(tdiff), g.diffAcc.length + ' rekening', g.diffAcc.length ? 'warn' : '')}
    ${tile('Mutasi belum dikenali', unm, 'cocokkan di Antrean', unm ? 'warn' : '', '#antrean')}${tile('Mutasi bank terbaru', g.stale.length ? g.stale.length + ' terlambat' : 'terkini', g.stale.length ? esc(g.stale.map(c => c.name).join(', ')) : 'semua rekening ≤ 3 hari', g.stale.length ? 'warn' : '')}</div>`;
  for (const k of Object.keys(POS)) {
    const L = g.cash.filter(c => (c.pos || 'operasional') === k); if (!L.length) continue;
    o += sec(POS[k][0] + ' · ' + rpk(sum(L, c => c.book)), POS[k][1], `<div class="scroll"><table class="ftbl"><thead><tr><th>Rekening</th><th>Unit</th><th class="r">Saldo buku</th><th class="r">Saldo bank</th><th class="r">Selisih</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Belum cocok</th><th>Mutasi terakhir</th></tr></thead><tbody>
      ${L.map(c => { const d = c.bank_balance == null ? null : c.bank_balance - c.book, a = daysAgo(c.stmt_last); return `<tr class="click" data-acc="${esc(c.code)}"><td><b>${esc(c.name)}</b><br><span class="muted small">${esc(c.code)}${c.bank ? ' · ' + esc(c.bank) : ' · tunai'}</span></td><td>${c.unit ? dot(bizOf(c.unit)) + esc(uname(c.unit)) : 'Grup'}</td>
        <td class="r b">${rp(c.book)}</td><td class="r">${c.bank_balance == null ? '<span class="muted">—</span>' : rp(c.bank_balance)}</td><td class="r">${d == null ? '' : Math.abs(d) < 1000 ? '<span class="pill g">cocok</span>' : `<span class="pill r">${rpS(d)}</span>`}</td>
        <td class="r">${rpk(c.in)}</td><td class="r">${rpk(c.out)}</td><td class="r">${c.unmatched ? `<span class="pill y">${c.unmatched}</span>` : '0'}</td><td>${c.bank ? (c.stmt_last ? `<span class="${a > 3 ? 'pill y' : 'small'}">${tgl(c.stmt_last)}${a > 3 ? ' · ' + a + ' hari' : ''}</span>` : '<span class="pill y">belum ada</span>') : '<span class="muted small">tunai</span>'}</td></tr>`; }).join('')}</tbody></table></div>`);
  }
  o += sec('Kas masuk & keluar harian', 'semua rekening', dailyChart(Dd.daily));
  cur = { Dd, g };
  return o;
}
async function bankPanel(acc) {
  const c = cur.Dd.cash.find(x => x.code === acc); if (!c) return;
  const L = await data('bank', { acc });
  const st = { baru: 'y', cocok: 'g', diposting: 'b', diabaikan: '' };
  panel(`<div style="display:flex;justify-content:space-between;gap:10px"><div><span class="muted small">${esc(c.code)} · ${esc(c.bank || 'tunai')}</span><h2 style="font-size:20px">${esc(c.name)}</h2></div><button class="btn sm" data-close>✕</button></div>
    <div class="kv"><div><span>Saldo buku</span><b>${rp(c.book)}</b></div><div><span>Saldo bank</span><b>${c.bank_balance == null ? '—' : rp(c.bank_balance)}</b></div><div><span>Mutasi terakhir</span><b>${c.stmt_last ? tgl(c.stmt_last) : '—'}</b></div></div>
    ${c.bank && canWrite() ? `<label class="btn" style="align-self:flex-start">Impor mutasi (CSV)<input type="file" accept=".csv,text/csv" data-import="${esc(acc)}" hidden></label><p class="muted small" style="margin:0">Kolom: tanggal (YYYY-MM-DD), keterangan, jumlah (+ masuk, − keluar), saldo. Baris kembar otomatis dilewati, lalu dicocokkan dengan jurnal.</p>` : ''}
    <table class="ftbl compact"><thead><tr><th>Tanggal</th><th>Keterangan</th><th class="r">Jumlah</th><th>Status</th></tr></thead><tbody>${L.map(l => `<tr><td>${tgl(l.date)}</td><td>${esc(l.desc)}${l.note ? `<br><span class="muted small">${esc(l.note)}</span>` : ''}</td><td class="r ${mcls(l.amount)}">${num(l.amount)}</td><td><span class="pill ${st[l.status] || ''}">${esc(l.status)}</span></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Belum ada mutasi.</td></tr>'}</tbody></table>`,
  (pn) => pn.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rows = (await f.text()).split(/\r?\n/).map(r => r.split(/[;,\t]/)).filter(r => /^\d{4}-\d{2}-\d{2}$/.test((r[0] || '').trim()))
      .map(r => ({ date: r[0].trim(), desc: (r[1] || '').trim(), amount: +String(r[2] || '').replace(/[^\d.-]/g, ''), balance: r[3] ? +String(r[3]).replace(/[^\d.-]/g, '') : null }));
    if (!rows.length) return toast('Tidak ada baris yang terbaca. Cek format kolom.', true);
    if (usingDemo()) return toast('Data contoh — mutasi tidak disimpan.');
    try { const r = await A.rpc('pk_fin_bank_import_rpc', { p_account: e.target.dataset.import, p_rows: rows }); toast('Diimpor: ' + (r.baru ?? rows.length) + ' baris'); close(); render(); } catch (er) { toast(er.message, true); }
  }));
}

/* ---------- 4. Kewajiban ---------- */
async function vKewajiban() {
  const p = period(), Dd = await data('dash', p), g = digest(Dd); setBadges(Dd, g);
  let o = header('Kewajiban & leasing', 'Tagihan rutin 30 hari ke depan, utang leasing & pinjaman, dan estimasi pajak, dibandingkan dengan dana di rekening pos Kewajiban.');
  const ST = await settings(), taxRate = +ST.fin_tax_rate || 0, gross = g.G.rev;
  let left = g.kewajibanCash;
  const L = g.obl.map(x => { left -= x.amount; return { ...x, left }; });
  const liab = ['2-20100', '2-20200', '2-20300', '2-20400', '2-20500', '2-20600', '2-21000', '2-21100', '2-21200'].map(k => ({ k, ...(Dd.balances[k] || { name: X.ACC[k], bal: 0 }) }));
  o += `<div class="tiles">${tile('Tagihan 30 hari', rpk(g.oblSum), g.obl.length + ' tagihan')}${tile('Dalam 7 hari', rpk(g.obl7Sum), g.obl7.length + ' tagihan', g.obl7Sum > g.kewajibanCash ? 'bad' : '')}
    ${tile('Dana pos Kewajiban', rpk(g.kewajibanCash), 'rekening pajak, cicilan, bagi hasil')}${tile(g.kewajibanCash >= g.oblSum ? 'Sisa setelah 30 hari' : 'Kurang untuk 30 hari', rpS(g.kewajibanCash - g.oblSum), 'perlu dipindah dari penerimaan', g.kewajibanCash < g.oblSum ? 'bad' : '')}
    ${tile('Kewajiban rutin / bulan', rpk(Dd.obligations_month), pct(ratio(Dd.obligations_month, sum(g.rows, r => r.cur.rev))) + ' dari omzet unit')}${tile('Estimasi PPh final', rpk(gross * taxRate / 100), String(taxRate).replace('.', ',') + '% × omzet bruto ' + rpk(gross) + ' · cek konsultan pajak', 'mute')}</div>`;
  o += await loanSection();
  o += `<div class="cols">${sec('Jadwal 30 hari', 'sisa dana = dana pos Kewajiban dikurangi tagihan berurutan', L.length ? `<div class="scroll"><table class="ftbl"><thead><tr><th>Jatuh tempo</th><th>Tagihan</th><th>Unit</th><th class="r">Jumlah</th><th class="r">Sisa dana</th></tr></thead><tbody>${L.map(x => `<tr><td><b>${tgl(x.due)}</b><br><span class="${x.days <= 3 ? 'pill r' : x.days <= 7 ? 'pill y' : 'muted small'}">${x.days} hari</span></td><td><b>${esc(x.name)}</b><br><span class="muted small">${esc(KIND[x.kind] || x.kind)}${x.pattern ? ' · dicocokkan dari mutasi "' + esc(x.pattern) + '"' : ''}</span></td><td>${dot(bizOf(x.unit))}${esc(uname(x.unit))}</td><td class="r b">${rp(x.amount)}</td><td class="r ${mcls(x.left)}">${rpS(x.left)}</td></tr>`).join('')}</tbody></table></div>` : empty('Tidak ada tagihan rutin 30 hari ke depan.'))}
    ${sec('Saldo hutang', 'per tanggal akhir periode', `<table class="ftbl compact"><tbody>${liab.map(x => `<tr><td>${esc(x.name)}${x.k === '2-20200' ? '<br><span class="muted small">titipan pelanggan, jadi pendapatan saat serah-terima</span>' : ''}</td><td class="r b">${rp(x.bal)}</td></tr>`).join('')}</tbody></table>`)}</div>`;
  if (canWrite() && !usingDemo()) o += sec('Tambah kewajiban rutin', 'cicilan, sewa, bagi hasil, langganan, pajak', `<form id="oblf" class="stack" style="gap:10px"><div class="cols3" style="gap:10px">
    <label class="small b">Nama<input class="inp" name="name" required style="width:100%"></label><label class="small b">Jenis<select class="inp" name="kind" style="width:100%">${Object.entries(KIND).map(([k, v2]) => `<option value="${k}">${v2}</option>`).join('')}</select></label>
    <label class="small b">Unit<select class="inp" name="unit_code" style="width:100%">${UNITS.map(u => `<option value="${u.code}">${esc(u.name)}</option>`).join('')}</select></label>
    <label class="small b">Jumlah / bulan (Rp)<input class="inp" name="amount" type="number" min="1" required style="width:100%"></label><label class="small b">Tanggal jatuh tempo (1–31)<input class="inp" name="due_day" type="number" min="1" max="31" required style="width:100%"></label>
    <label class="small b">Akun beban / hutang<input class="inp" name="account_code" placeholder="mis. 2-21000" required style="width:100%"></label><label class="small b">Selesai bulan (opsional)<input class="inp" name="end_month" type="month" style="width:100%"></label>
    <label class="small b">Kata kunci mutasi bank (opsional)<input class="inp" name="bank_pattern" style="width:100%"></label></div><button class="btn pri" style="align-self:flex-start">Simpan kewajiban</button></form>`);
  return o;
}

/* ---------- 5. RAB & LPJ ---------- */
async function vRab() {
  const p = period(), Dd = await data('dash', p), g = digest(Dd); setBadges(Dd, g);
  let o = header('Belanja (RAB & LPJ)', 'Pengajuan belanja dari Sistem Kerja: staf mengajukan → Valuer 1 → Valuer 2 → Keuangan mencairkan → LPJ (nota). LPJ yang selesai otomatis jadi jurnal biaya.', `<a class="btn" href="/#/belanja">Buka Pengajuan Belanja</a>`);
  const R = ['RA', 'WG', 'NA', 'HQ'].map(b => Dd.rab.find(r => r.biz === b) || { biz: b });
  const t = g.rab;
  o += `<div class="tiles">${tile('Menunggu valuer', t.menunggu, rpk(t.menunggu_rp))}${tile('Siap cair', t.siap, rpk(t.siap_rp), t.siap ? 'warn' : '')}${tile('Cair, belum LPJ', t.nota, rpk(t.nota_rp))}
    ${tile('LPJ telat', t.telat, 'lewat batas hari LPJ', t.telat ? 'bad' : '')}${tile('Dicairkan periode ini', rpk(t.cair_periode), 'realisasi ' + rpk(t.real_periode))}${tile('Sisa uang kembali', rpS(t.cair_periode - t.real_periode), 'cair − realisasi nota', '')}</div>`;
  o += sec('Per unit bisnis', 'jumlah pengajuan · rupiah', `<div class="scroll"><table class="ftbl"><thead><tr><th>Unit</th><th class="r">Menunggu</th><th class="r">Siap cair</th><th class="r">Cair belum LPJ</th><th class="r">LPJ telat</th><th class="r">LPJ dicek</th><th class="r">Cair periode</th><th class="r">Realisasi</th><th class="r">Akurasi RAB</th><th class="r">Darurat</th></tr></thead><tbody>
    ${R.map(r => `<tr><td><b>${dot(r.biz)}${BIZN[r.biz]}</b></td><td class="r">${r.menunggu || 0} <span class="muted small">${rpk(r.menunggu_rp)}</span></td><td class="r">${r.siap || 0} <span class="muted small">${rpk(r.siap_rp)}</span></td><td class="r">${r.nota || 0} <span class="muted small">${rpk(r.nota_rp)}</span></td>
      <td class="r">${r.telat ? `<span class="pill r">${r.telat}</span>` : 0}</td><td class="r">${r.cek || 0}</td><td class="r">${rpk(r.cair_periode)}</td><td class="r">${rpk(r.real_periode)}</td><td class="r">${pct(ratio(r.real_periode, r.cair_periode))}</td><td class="r">${r.darurat ? `<span class="pill y">${r.darurat}</span>` : 0}</td></tr>`).join('')}
    <tr class="tot"><td>Grup</td><td class="r">${t.menunggu}</td><td class="r">${t.siap}</td><td class="r">${t.nota}</td><td class="r">${t.telat}</td><td class="r">${t.cek}</td><td class="r">${rpk(t.cair_periode)}</td><td class="r">${rpk(t.real_periode)}</td><td class="r">${pct(ratio(t.real_periode, t.cair_periode))}</td><td class="r">${t.darurat}</td></tr></tbody></table></div>
    <p class="muted small" style="margin:0">Akurasi RAB = realisasi nota ÷ uang yang dicairkan. Di bawah 90% berarti anggaran sering dilebihkan; selisihnya harus kembali ke rekening.</p>`);
  return o;
}

/* ---------- 6. Laba rugi ---------- */
async function vLabaRugi() {
  const p = period(), Dd = await data('dash', p), prv = { from: Dd.period.prev_from, to: Dd.period.prev_to };
  const [P, Pp] = await Promise.all([data('pl', p), data('pl', prv)]);
  const mode = S.plv, cols = mode === 'biz' ? ['RA', 'WG', 'NA', 'HQ'] : UNITS.filter(u => u.parent === mode).map(u => u.code).concat([mode]);
  const inCol = (r, c) => (mode === 'biz' ? r.biz === c : r.unit === c);
  const rowsAll = mode === 'biz' ? P : P.filter(r => r.biz === mode), prevAll = mode === 'biz' ? Pp : Pp.filter(r => r.biz === mode);
  const usedCols = cols.filter(c => rowsAll.some(r => inCol(r, c)));
  const accs = [...new Set(rowsAll.map(r => r.acc))].sort(), name = (a) => (rowsAll.find(r => r.acc === a) || {}).name || X.ACC[a] || a;
  const v = (rows, acc, c) => sum(rows.filter(r => r.acc === acc && (c == null || inCol(r, c))), r => r.amt);
  const T = (rows, pre, c) => sum(rows.filter(r => pre.includes(r.acc[0]) && (c == null || inCol(r, c))), r => r.amt);
  const rev = T(rowsAll, '4'), cl = (n) => (n < 0 ? 'neg' : '');
  const line = (label, f, cls = 'sub') => `<tr class="${cls}"><td>${label}</td>${usedCols.map(c => `<td class="r ${cl(f(rowsAll, c))}">${num(f(rowsAll, c))}</td>`).join('')}<td class="r ${cl(f(rowsAll))}">${num(f(rowsAll))}</td><td class="r muted">${pct(ratio(f(rowsAll), rev))}</td><td class="r">${num(f(prevAll))}</td><td class="r">${delta(f(rowsAll), f(prevAll))}</td></tr>`;
  const head = (c) => (mode === 'biz' ? BIZN[c] : c === mode ? 'Bersama' : uname(c));
  let t = `<table class="ftbl compact" id="pltbl"><thead><tr><th>Akun</th>${usedCols.map(c => `<th class="r">${esc(head(c))}</th>`).join('')}<th class="r">Total</th><th class="r">% omzet</th><th class="r">Periode lalu</th><th class="r">Δ</th></tr></thead><tbody>`;
  const block = (title, pre) => { const a = accs.filter(x => x[0] === pre); if (!a.length) return ''; return `<tr class="sec"><td colspan="${usedCols.length + 5}">${title}</td></tr>` + a.map(acc => `<tr><td class="ind nw">${esc(name(acc))} <span class="muted small">${acc}</span></td>${usedCols.map(c => `<td class="r">${v(rowsAll, acc, c) ? num(v(rowsAll, acc, c)) : '<span class="muted">–</span>'}</td>`).join('')}<td class="r b">${num(v(rowsAll, acc))}</td><td class="r muted">${pct(ratio(v(rowsAll, acc), rev))}</td><td class="r">${num(v(prevAll, acc))}</td><td class="r">${delta(v(rowsAll, acc), v(prevAll, acc), pre !== '4' && pre !== '7')}</td></tr>`).join(''); };
  const gp = (r, c) => T(r, '4', c) - T(r, '5', c), op = (r, c) => gp(r, c) - T(r, '6', c), net = (r, c) => op(r, c) + T(r, '7', c) - T(r, '8', c);
  t += block('PENDAPATAN', '4') + line('Total pendapatan', (r, c) => T(r, '4', c)) + block('HARGA POKOK (HPP)', '5') + line('Laba kotor', gp)
    + block('BIAYA OPERASIONAL', '6') + line('Laba operasional', op) + block('PENDAPATAN LAIN', '7') + block('BEBAN LAIN', '8') + line('Laba (rugi) bersih', net, 'tot big') + '</tbody></table>';
  const segs = [['biz', 'Per unit bisnis'], ['RA', 'Rentalaja per lini'], ['NA', 'Niagaaja per lini'], ['HQ', 'Holding per divisi']];
  await settings().catch(() => null);
  let o = header('Laba rugi', 'Dari satu buku grup. Pendapatan Rentalaja diakui saat serah-terima; DP masih titipan. Klik tombol untuk melihat per lini.', printBtn + `<button class="btn" data-csv="pl">Unduh CSV</button>`) + printHead('Laporan laba rugi');
  o += `<div class="chips" role="group" aria-label="Tampilan">${segs.map(([k, l]) => `<button type="button" data-plv="${k}" class="chipbtn ${k === mode ? 'on' : ''}">${k === 'biz' ? '' : logo(k, 22)}${l}</button>`).join('')}</div>`;
  o += `<div class="cols">${sec('Dari omzet ke laba', mode === 'biz' ? 'grup' : BIZN[mode], waterfall([['Omzet', T(rowsAll, '4'), true], ['HPP', -T(rowsAll, '5')], ['Laba kotor', gp(rowsAll), true], ['Biaya operasional', -T(rowsAll, '6')], ['Lain-lain bersih', T(rowsAll, '7') - T(rowsAll, '8')], ['Laba bersih', net(rowsAll), true]]))}
    <div class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr))">${tile('Omzet', rpk(rev), delta(rev, T(prevAll, '4')) + ' vs lalu')}${tile('Laba bersih', rpS(net(rowsAll)), delta(net(rowsAll), net(prevAll)) + ' vs lalu', net(rowsAll) < 0 ? 'bad' : '')}
      ${tile('Margin kotor', pct(ratio(gp(rowsAll), rev)), 'lalu ' + pct(ratio(gp(prevAll), T(prevAll, '4'))))}${tile('Margin operasional', pct(ratio(op(rowsAll), rev)), 'lalu ' + pct(ratio(op(prevAll), T(prevAll, '4'))))}
      ${tile('Margin bersih', pct(ratio(net(rowsAll), rev)), 'lalu ' + pct(ratio(net(prevAll), T(prevAll, '4'))))}${tile('Biaya ÷ omzet', pct(ratio(T(rowsAll, '568'), rev)), 'HPP + operasional + beban lain')}</div></div>`;
  o += sec('Laporan laba rugi', esc(period().label) + ' · rupiah · periode lalu ' + tgl(prv.from) + '–' + tgl(prv.to), `<div class="scroll">${t}</div>`);
  cur = { csv: () => { const H = ['Akun', 'Nama', ...usedCols.map(head), 'Total', 'Periode lalu']; return [H, ...accs.map(a => [a, name(a), ...usedCols.map(c => v(rowsAll, a, c)), v(rowsAll, a), v(prevAll, a)]), ['', 'Laba bersih', ...usedCols.map(c => net(rowsAll, c)), net(rowsAll), net(prevAll)]]; } };
  return o;
}

/* ---------- 7. Neraca ---------- */
async function vNeraca() {
  const p = period(), [B, Dd] = await Promise.all([data('bs', p), data('dash', p)]);
  const g = digest(Dd); setBadges(Dd, g);
  const grp = (f) => B.filter(f), S2 = (L) => sum(L, r => r.bal);
  const cash = grp(r => r.grp === 'aset' && r.is_cash), recv = grp(r => /^1-101/.test(r.acc)), inv = grp(r => /^1-102/.test(r.acc)), fixed = grp(r => /^1-107/.test(r.acc)), oth = grp(r => r.grp === 'aset' && !r.is_cash && !/^1-10[127]/.test(r.acc));
  const cl = grp(r => /^2-20/.test(r.acc)), lt = grp(r => /^2-2[1-9]/.test(r.acc)), eq = grp(r => r.grp === 'ekuitas');
  const ca = S2(cash) + S2(recv) + S2(inv), TA = ca + S2(fixed) + S2(oth), TL = S2(cl) + S2(lt), TE = S2(eq), diff = Math.round(TA - TL - TE);
  const block = (title, L) => (L.length ? `<tr class="sec"><td colspan="2">${title}</td></tr>` + L.map(r => `<tr><td class="ind">${esc(r.name)} <span class="muted small">${esc(r.acc)}</span></td><td class="r ${mcls(r.bal)}">${num(r.bal)}</td></tr>`).join('') + `<tr class="sub"><td>Jumlah ${title.toLowerCase()}</td><td class="r">${num(S2(L))}</td></tr>` : '');
  await settings().catch(() => null);
  let o = header('Neraca', 'Posisi per tanggal akhir periode. Laba berjalan = laba bersih sejak awal buku sampai tanggal ini.', printBtn + `<button class="btn" data-csv="bs">Unduh CSV</button>`) + printHead('Neraca per ' + tgl(p.to));
  o += `<div class="tiles">${tile('Total aset', rpk(TA), 'aset lancar ' + rpk(ca))}${tile('Total kewajiban', rpk(TL), 'lancar ' + rpk(S2(cl)) + ' · jangka panjang ' + rpk(S2(lt)))}${tile('Ekuitas', rpk(TE), 'termasuk laba berjalan')}
    ${tile('Rasio lancar', S2(cl) ? (ca / S2(cl)).toFixed(2).replace('.', ',') + '×' : '—', 'aset lancar ÷ kewajiban lancar · sehat ≥ 1,5', S2(cl) && ca / S2(cl) < 1 ? 'bad' : S2(cl) && ca / S2(cl) < 1.5 ? 'warn' : '')}
    ${tile('Rasio kas', S2(cl) ? (S2(cash) / S2(cl)).toFixed(2).replace('.', ',') + '×' : '—', 'kas ÷ kewajiban lancar')}${tile('Hutang ÷ ekuitas', TE ? (TL / TE).toFixed(2).replace('.', ',') + '×' : '—', 'DER · makin kecil makin aman', TE && TL / TE > 1 ? 'warn' : '')}</div>`;
  o += diff ? `<div class="alert"><span><b>Neraca tidak seimbang ${rp(diff)}.</b> Cek saldo awal dan jurnal manual.</span></div>` : '';
  o += `<div class="cols2">${sec('Aset', 'per ' + tgl(p.to), `<table class="ftbl compact"><tbody>${block('Kas & bank', cash)}${block('Piutang & uang muka', recv)}${block('Persediaan', inv)}${block('Aset tetap', fixed)}${block('Aset lain', oth)}<tr class="tot big"><td>Total aset</td><td class="r">${num(TA)}</td></tr></tbody></table>`)}
    ${sec('Kewajiban & ekuitas', 'per ' + tgl(p.to), `<table class="ftbl compact"><tbody>${block('Kewajiban lancar', cl)}${block('Kewajiban jangka panjang', lt)}${block('Ekuitas', eq)}<tr class="tot big"><td>Total kewajiban & ekuitas</td><td class="r">${num(TL + TE)}</td></tr></tbody></table>`)}</div>`;
  cur = { csv: () => [['Akun', 'Nama', 'Kelompok', 'Saldo'], ...B.map(r => [r.acc, r.name, r.grp, r.bal])] };
  return o;
}

/* ---------- 8. Buku jurnal ---------- */
async function vJurnal() {
  const p = period(), L = await data('jurnal', { ...p, biz: S.jbiz, source: S.jsrc, q: S.jq });
  const f = `<select class="inp" data-f="jbiz"><option value="">Semua unit</option>${['RA', 'WG', 'NA', 'HQ'].map(b => `<option value="${b}"${b === S.jbiz ? ' selected' : ''}>${BIZN[b]}</option>`).join('')}</select>
    <select class="inp" data-f="jsrc"><option value="">Semua sumber</option>${Object.entries(SRC).map(([k, v]) => `<option value="${k}"${k === S.jsrc ? ' selected' : ''}>${v}</option>`).join('')}</select>
    <input class="inp" data-f="jq" value="${esc(S.jq)}" placeholder="Cari memo / kode / pihak" style="width:200px">`;
  let o = header('Buku jurnal', 'Semua jurnal grup. Hampir semuanya otomatis dari sumber data; koreksi lewat jurnal balik, tidak ada jurnal yang diubah atau dihapus.', (canWrite() ? '<button class="btn pri" type="button" data-jm>+ Jurnal manual</button>' : '') + f);
  const by = {}; L.forEach(j => { by[j.source] = (by[j.source] || 0) + 1; });
  o += `<div class="tiles">${tile('Jurnal tampil', L.length, 'maks 300 terbaru')}${tile('Nilai', rpk(sum(L, j => j.total)), 'jumlah debit')}${Object.entries(by).slice(0, 4).map(([k, n]) => tile(SRC[k] || k, n, pct(n / L.length * 100) + ' dari jurnal', k === 'manual' ? 'warn' : '')).join('')}</div>`;
  o += sec('Jurnal', 'klik untuk lihat baris', `<div class="scroll"><table class="ftbl compact"><thead><tr><th>Tanggal</th><th>Kode</th><th>Sumber</th><th>Unit</th><th>Keterangan</th><th class="r">Nilai</th></tr></thead><tbody>${L.map(j => `<tr class="click" data-j="${esc(j.id)}"><td>${tgl(j.date)}</td><td><code>${esc(j.code)}</code></td><td><span class="pill ${j.source === 'manual' ? 'y' : j.source === 'bank' ? 'b' : ''}">${esc(SRC[j.source] || j.source)}</span></td><td>${dot(bizOf(j.unit))}${esc(uname(j.unit))}</td><td>${esc(j.memo || '')}${j.status === 'void' ? ' <span class="pill r">batal</span>' : ''}</td><td class="r">${rp(j.total)}</td></tr>
    <tr data-jl="${esc(j.id)}" hidden><td></td><td colspan="5"><div class="jl"><table class="ftbl compact"><tbody>${(j.lines || []).map(l => `<tr><td>${esc(l.acc)} · ${esc(l.name)}${l.party ? ' <span class="pill b">' + esc(l.party) + '</span>' : ''}</td><td>${esc(uname(l.unit))}</td><td class="r">${+l.d ? rp(l.d) : ''}</td><td class="r">${+l.c ? rp(l.c) : ''}</td></tr>`).join('')}</tbody></table>
    ${canWrite() && j.status === 'posted' ? `<button class="btn sm warn" data-void="${esc(j.id)}" style="margin-top:6px">Batalkan dengan jurnal balik</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Tidak ada jurnal.</td></tr>'}</tbody></table></div>`);
  return o;
}

/* ---------- 9. Antrean ---------- */
async function vAntrean() {
  const [E, AC] = await Promise.all([data('exc'), accounts()]);
  const opts = (pre) => AC.filter(a => !pre || pre.includes(a.code[0])).map(a => `<option value="${a.code}">${a.code} · ${esc(a.name)}</option>`).join('');
  let o = header('Antrean Keuangan', 'Hanya pengecualian yang butuh manusia: akun yang belum dipetakan, transaksi gagal dibukukan, dan mutasi bank yang belum dikenali. Sekali dipetakan, transaksi serupa berikutnya otomatis.');
  if (!canWrite()) o += '<div class="ro">Tindakan di halaman ini oleh Keuangan atau CEO.</div>';
  o += `<div class="tiles">${tile('Peta akun kurang', E.keys.length, sum(E.keys, k => k.n) + ' transaksi tertahan', E.keys.length ? 'bad' : '')}${tile('Nilai tertahan', rpk(sum(E.keys, k => k.amt)), 'belum masuk laporan', E.keys.length ? 'warn' : '')}
    ${tile('Transaksi gagal', E.events.length, 'perlu dicoba ulang / diabaikan', E.events.length ? 'warn' : '')}${tile('Mutasi belum dikenali', E.bank.length, rpk(sum(E.bank, b => Math.abs(b.amount))), E.bank.length ? 'warn' : '')}</div>`;
  o += sec('1 · Akun belum dipetakan', 'pilih akun sekali → semua transaksi yang tertahan langsung dibukukan', E.keys.length ? `<div class="list">${E.keys.map(k => `<div class="li" style="flex-wrap:wrap"><div class="t"><b><code>${esc(k.key)}</code> · ${k.n} transaksi · ${rpk(k.amt)}</b><span>${esc(k.error)} · contoh ${esc(k.sample)}</span></div>
      ${canWrite() ? `<select class="inp" data-mapacc="${esc(k.key)}" style="max-width:300px"><option value="">Pilih akun…</option>${opts(k.key.startsWith('rev') ? '47' : k.key.startsWith('exp') || k.key.startsWith('cogs') ? '568' : '')}</select><button class="btn sm pri" data-map="${esc(k.key)}">Simpan peta</button>` : ''}</div>`).join('')}</div>` : '<div class="ok">Semua kategori sudah punya akun.</div>');
  o += sec('2 · Transaksi gagal dibukukan', '', E.events.length ? `<div class="scroll"><table class="ftbl compact"><thead><tr><th>Tanggal</th><th>Sumber</th><th>Transaksi</th><th class="r">Nilai</th><th>Sebab</th><th></th></tr></thead><tbody>${E.events.map(e => `<tr><td>${tgl(e.date)}</td><td>${esc(SRC[e.source] || e.source)}</td><td><b>${esc(e.ext)}</b><br><span class="muted small">${esc(e.memo || e.type)} · ${dot(bizOf(e.unit))}${esc(uname(e.unit))}</span></td><td class="r">${rp(e.amount)}</td><td class="small">${esc(e.error)}${e.attempts > 1 ? ` <span class="muted">(${e.attempts}×)</span>` : ''}</td>
      <td style="white-space:nowrap">${canWrite() ? `<button class="btn sm" data-retry="${esc(e.id)}">Coba lagi</button> <button class="btn sm" data-ign="${esc(e.id)}">Abaikan</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="ok">Tidak ada transaksi gagal.</div>');
  o += sec('3 · Mutasi bank belum dikenali', 'pilih akun lawan; isi kata kunci agar mutasi serupa dikenali otomatis', E.bank.length ? `<div class="scroll"><table class="ftbl compact"><thead><tr><th>Tanggal</th><th>Rekening</th><th>Keterangan</th><th class="r">Jumlah</th>${canWrite() ? '<th>Akun lawan</th><th>Kata kunci</th><th></th>' : ''}</tr></thead><tbody>${E.bank.map(b => `<tr><td>${tgl(b.date)}</td><td class="small">${esc(b.acc_name)}</td><td class="small">${esc(b.desc)}</td><td class="r ${mcls(b.amount)}">${num(b.amount)}</td>
      ${canWrite() ? `<td><select class="inp" data-bacc="${esc(b.id)}" style="max-width:220px"><option value="">Pilih…</option>${opts(b.amount > 0 ? '1247' : '12568')}</select></td><td><input class="inp" data-bpat="${esc(b.id)}" placeholder="opsional" style="width:130px"></td><td style="white-space:nowrap"><button class="btn sm pri" data-bok="${esc(b.id)}" data-unit="${esc(b.unit || '')}">Bukukan</button> <button class="btn sm" data-bign="${esc(b.id)}">Abaikan</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<div class="ok">Semua mutasi sudah dikenali.</div>');
  return o;
}

/* ---------- 10. Sumber & tutup buku ---------- */
async function vSumber() {
  const p = period(), Dd = await data('dash', p), g = digest(Dd); setBadges(Dd, g);
  let o = header('Sumber data & tutup buku', 'Dari mana angka berasal, dan bulan mana yang sudah dikunci. Bulan terkunci tidak bisa menerima jurnal baru.');
  o += sec('Sumber data', 'input sekali di sistem asal → jurnal otomatis', `<div class="scroll"><table class="ftbl"><thead><tr><th>Sumber</th><th>Unit</th><th>Jenis</th><th class="r">Transaksi 30 hari</th><th class="r">Terbukukan</th><th class="r">Gagal</th><th>Terakhir</th><th>Status</th>${canWrite() ? '<th></th>' : ''}</tr></thead><tbody>
    ${Dd.sources.map(s => { const a = daysAgo(s.last); return `<tr><td><b>${esc(s.name)}</b>${s.feeds_omzet ? '<br><span class="muted small">masuk omzet KKH</span>' : ''}</td><td>${dot(bizOf(s.unit))}${esc(uname(s.unit))}</td><td>${esc(s.kind)}${s.kind === 'website' ? (s.has_key ? ' · <span class="pill g">kunci API</span>' : ' · <span class="pill y">belum ada kunci</span>') : ''}</td>
      <td class="r">${(+s.n30).toLocaleString('id-ID')}</td><td class="r">${pct(ratio(s.ok30, s.n30))}</td><td class="r">${s.gagal ? `<span class="pill y">${s.gagal}</span>` : 0}</td><td>${s.last ? (a ? a + ' hari lalu' : 'hari ini') : '—'}</td>
      <td>${!s.active ? '<span class="pill">belum tersambung</span>' : a != null && a >= 2 && s.kind !== 'sistem' ? '<span class="pill y">diam</span>' : '<span class="pill g">lancar</span>'}</td>
      ${canWrite() ? `<td>${s.kind === 'website' ? `<button class="btn sm" data-key="${esc(s.code)}">${s.has_key ? 'Ganti kunci' : 'Buat kunci'}</button>` : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>
    <p class="muted small" style="margin:0">Website unit mengirim transaksi ke fungsi <code>pk-fin-ingest</code> dengan kunci API. Rentalaja App berada di database yang sama, jadi langsung tercatat tanpa kunci.</p>`);
  o += sec('Tutup buku', 'tutup paling lambat tanggal ' + Dd.health.close_day + ' bulan berikutnya; membuka lagi hanya oleh CEO', `<div class="list">${[...Dd.periods].reverse().map((m, i) => `<div class="li"><div class="t"><b>${bulan(m.m + '-01')}</b><span>${i === 0 ? 'bulan berjalan' : m.status === 'locked' ? 'terkunci · laporan final' : 'masih terbuka · angka bisa berubah'}</span></div>
      ${m.status === 'locked' ? '<span class="pill g">Terkunci</span>' : i === 0 ? '<span class="pill">Berjalan</span>' : '<span class="pill y">Terbuka</span>'}
      ${canWrite() && i > 0 ? (m.status === 'locked' ? (ME.role === 'ceo' ? `<button class="btn sm" data-unlock="${m.m}">Buka lagi</button>` : '') : `<button class="btn sm pri" data-lock="${m.m}">Tutup buku</button>`) : ''}</div>`).join('')}</div>
    <p class="muted small" style="margin:0">Tutup buku ditolak bila masih ada mutasi bank atau transaksi gagal di bulan itu.</p>`);
  return o;
}


/* =====================================================================
   Layar tambahan (033): target, proyeksi kas, Profit First, piutang & hutang,
   arus kas, utang leasing, akun & rekening, saldo awal, jurnal manual
   ===================================================================== */
let SET = null, LOANS = null;
async function settings() { if (!SET) SET = await data('set'); return SET; }
async function loans() { if (!LOANS) LOANS = await data('loans'); return LOANS || []; }
const company = () => (SET && SET.fin_company) || 'PT Popo Karya Investama';
const printHead = (title) => { const p = period(); return `<div class="print-head"><b>${esc(company())}</b><span>${esc(title)} · ${esc(p.label)}</span><small>Dicetak ${tgl(today())} ${new Date().getFullYear()} · Panel Keuangan Pokama</small></div>`; };
const printBtn = `<button class="btn" type="button" data-print>Cetak / PDF</button>`;
const monthOf = () => (/^\d{4}-\d{2}$/.test(S.per) ? S.per : today().slice(0, 7));
const dim = (m) => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
const FPOS = { operasional: 'Operasional', kewajiban: 'Kewajiban & pajak', bersama: 'Bersama & gaji owner', investasi: 'Profit & investasi' };

/* --- cicilan & sisa pokok pinjaman --- */
function loanCalc(l, asOf) {
  if (!+l.principal || !+l.tenor_months) {
    // data belum lengkap: hanya cicilan & tanggal yang diketahui
    const a = D(asOf), dd = Math.min(+l.due_day || 1, 28);
    let nx = new Date(a.getFullYear(), a.getMonth(), dd); if (nx < new Date(a.getFullYear(), a.getMonth(), a.getDate())) nx = new Date(a.getFullYear(), a.getMonth() + 1, dd);
    return { inst: +l.installment || 0, paid: null, left: null, rem: 0, next: { d: ymd(nx) }, end: null, interest_left: 0, sched: [], partial: true, noInst: !+l.installment };
  }
  const P = +l.principal, n = +l.tenor_months, r = +l.rate_pct / 1200;
  const inst = l.installment ? +l.installment : (l.method === 'anuitas' && r > 0 ? Math.round(P * r / (1 - Math.pow(1 + r, -n))) : Math.round(P / n + P * r));
  const s = D(l.start_month), a = D(asOf);
  let k = (a.getFullYear() - s.getFullYear()) * 12 + a.getMonth() - s.getMonth() + (a.getDate() >= +l.due_day ? 1 : 0);
  k = Math.max(+l.paid_months || 0, Math.min(n, Math.max(0, k)));
  let rem = P; const sched = [];
  for (let i = 1; i <= n; i++) {
    const int = l.method === 'anuitas' && r > 0 ? Math.round(rem * r) : Math.round(P * r), pr = l.method === 'anuitas' && r > 0 ? inst - int : Math.round(P / n);
    rem = Math.max(0, rem - pr); const d = new Date(s.getFullYear(), s.getMonth() + i - 1, Math.min(+l.due_day, 28));
    sched.push({ i, d: ymd(d), inst: pr + int, pr, int, rem });
  }
  const done = sched[k - 1], next = sched[k];
  return { inst, paid: k, left: n - k, rem: k ? done.rem : P, next, end: sched[n - 1].d, interest_left: sum(sched.slice(k), x => x.int), sched };
}

/* --- target vs realisasi --- */
async function vTarget() {
  const m = monthOf(), from = m + '-01', last = m + '-' + String(dim(m)).padStart(2, '0'), to = last > today() ? today() : last;
  const [P, T, OM] = await Promise.all([data('pl', { from, to }), data('tgt', { month: from }), data('omz', { from, to })]);
  const el = to < from ? 0 : (D(to) - D(from)) / 864e5 + 1, pace = el / dim(m);
  const rev = (codes) => sum(P.filter(r => codes.includes(r.unit) && r.acc[0] === '4'), r => r.amt);
  const kkh = (codes) => sum(OM.filter(o => codes.includes(o.unit_code)), o => o.amount);
  const tgtOf = (codes) => sum(T.filter(t => codes.includes(t.unit_code)), t => t.amount);
  const rowOf = (code, name, codes, lvl) => {
    const t = tgtOf(codes), a = rev(codes), k = kkh(codes), proj = pace ? a / pace : 0, c = t ? a / t : null;
    const st = !t ? ['Belum ada target', ''] : c >= 1 ? ['Tercapai', 'g'] : a >= t * pace * .95 ? ['Sesuai laju', 'g'] : a >= t * pace * .8 ? ['Diawasi', 'y'] : ['Tertinggal', 'r'];
    const perDay = t && a < t && dim(m) - el > 0 ? (t - a) / (dim(m) - el) : 0;
    const tr = T.filter(x => codes.includes(x.unit_code)), stat = tr.length ? (tr.every(x => x.status === 'sah') ? 'disahkan' : tr.some(x => x.status === 'usulan') ? 'usulan' : 'dicek') : '';
    return { code, name, lvl, t, a, k, proj, c, st, perDay, stat };
  };
  const R = [];
  for (const b of ['RA', 'WG', 'NA']) {
    const lines = UNITS.filter(u => u.parent === b).map(u => u.code), codes = [b, ...lines];
    R.push(rowOf(b, BIZN[b], codes, 0));
    lines.forEach(l => { const r = rowOf(l, uname(l), [l], 1); if (r.t || r.a || r.k) R.push(r); });
  }
  const G = rowOf('G', 'Grup', UNITS.map(u => u.code), 0);
  let o = header('Target vs realisasi', `Target omzet bulanan dari Unit Bisnis (KKH) dibandingkan dengan omzet di buku keuangan. Hari ke-${el} dari ${dim(m)} (${pct(pace * 100)} bulan berjalan).`);
  o += `<div class="tiles">${tile('Target grup', rpk(G.t), bulan(from))}${tile('Realisasi buku', rpk(G.a), G.c == null ? '—' : pct(G.c * 100) + ' dari target', G.st[1] === 'r' ? 'bad' : G.st[1] === 'y' ? 'warn' : '')}
    ${tile('Proyeksi akhir bulan', rpk(G.proj), 'laju saat ini · ' + (G.t ? (G.proj >= G.t ? 'di atas' : 'kurang ' + rpk(G.t - G.proj)) : '—'), G.t && G.proj < G.t ? 'warn' : '')}
    ${tile('Perlu per hari', rpk(G.perDay), 'untuk sisa ' + (dim(m) - el) + ' hari')}${tile('Lapor KKH', rpk(G.k), 'omzet dilapor tim · selisih ' + rpS(G.k - G.a))}
    ${tile('Unit tertinggal', R.filter(r => r.lvl === 0 && r.st[1] === 'r').length, R.filter(r => r.lvl === 1 && r.st[1] === 'r').length + ' lini tertinggal', R.some(r => r.st[1] === 'r') ? 'bad' : '')}</div>`;
  o += sec('Per unit & lini', 'realisasi = pendapatan di buku · lapor KKH = omzet harian yang dilapor tim', `<div class="scroll"><table class="ftbl"><thead><tr><th>Unit / lini</th><th class="r">Target</th><th class="r">Realisasi</th><th style="min-width:130px">Capaian</th><th class="r">Proyeksi akhir bulan</th><th class="r">Perlu / hari</th><th class="r">Lapor KKH</th><th class="r">Selisih KKH</th><th>Status</th><th>Target</th></tr></thead><tbody>
    ${R.map(r => `<tr class="${r.lvl ? '' : 'sub'}"><td class="${r.lvl ? 'ind' : 'nw'}">${r.lvl ? '' : logo(r.code, 20)}${esc(r.name)}</td><td class="r">${r.t ? rpk(r.t) : '<span class="muted">—</span>'}</td><td class="r b">${rpk(r.a)}</td>
      <td>${r.t ? `<div class="bar" style="position:relative"><i style="width:${Math.min(100, r.c * 100)}%;background:${r.st[1] === 'r' ? '#C2410C' : r.st[1] === 'y' ? '#E8A33A' : '#09BEAF'}"></i></div><span class="small">${pct(r.c * 100)}</span>` : ''}</td>
      <td class="r ${r.t && r.proj < r.t ? 'neg' : ''}">${rpk(r.proj)}</td><td class="r">${r.perDay ? rpk(r.perDay) : '—'}</td><td class="r">${rpk(r.k)}</td><td class="r ${Math.abs(r.k - r.a) > Math.max(r.a, 1) * .05 ? 'neg' : 'muted'}">${rpS(r.k - r.a)}</td>
      <td>${r.st[0] ? `<span class="pill ${r.st[1]}">${r.st[0]}</span>` : ''}</td><td class="small muted">${r.stat}</td></tr>`).join('')}
    <tr class="tot"><td>Grup</td><td class="r">${rpk(G.t)}</td><td class="r">${rpk(G.a)}</td><td>${G.c == null ? '' : pct(G.c * 100)}</td><td class="r">${rpk(G.proj)}</td><td class="r">${rpk(G.perDay)}</td><td class="r">${rpk(G.k)}</td><td class="r">${rpS(G.k - G.a)}</td><td></td><td></td></tr></tbody></table></div>
    <p class="muted small" style="margin:0">Target diusulkan Leader, dicek Keuangan, disahkan CEO di menu Unit Bisnis (Sistem Kerja). Selisih KKH besar berarti laporan omzet harian tim tidak sama dengan uang yang tercatat di buku — cek salah satunya.</p>`);
  return o;
}

/* --- proyeksi kas 13 minggu --- */
function fcChart(F) {
  const W = 760, H = 250, L = 56, B = 26, T = 14, n = F.weeks.length, bw = (W - L - 8) / n;
  const vals = F.weeks.flatMap(w => [w.open, w.close, w.in, w.rutin + w.kewajiban + w.cicilan + w.gaji + w.belanja]).concat([F.min_cash || 0, 0]);
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0), y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; g += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#EEF0F3"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${rpk(v).replace('Rp', '')}</text>`; }
  if (F.min_cash) g += `<line x1="${L}" x2="${W}" y1="${y(F.min_cash)}" y2="${y(F.min_cash)}" stroke="#C2410C" stroke-dasharray="5 4"/><text x="${W - 4}" y="${y(F.min_cash) - 4}" text-anchor="end" style="fill:#A12A1F">kas minimum ${rpk(F.min_cash)}</text>`;
  F.weeks.forEach((w, i) => {
    const x = L + i * bw, out = w.rutin + w.kewajiban + w.cicilan + w.gaji + w.belanja;
    g += `<rect x="${x + bw * .14}" y="${y(w.in)}" width="${bw * .32}" height="${Math.max(0, y(0) - y(w.in))}" fill="#09BEAF" rx="2"><title>Masuk ${rp(w.in)}</title></rect>`;
    g += `<rect x="${x + bw * .5}" y="${y(out)}" width="${bw * .32}" height="${Math.max(0, y(0) - y(out))}" fill="#1F2B4D" rx="2"><title>Keluar ${rp(out)}</title></rect>`;
    g += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${tgl(w.week)}</text>`;
  });
  const pts = F.weeks.map((w, i) => [L + i * bw + bw / 2, y(w.close)]);
  g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#F2A33A" stroke-width="2.5"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${F.weeks[i].low ? '#C2410C' : '#F2A33A'}"><title>Saldo akhir ${rp(F.weeks[i].close)}</title></circle>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyeksi kas 13 minggu">${g}</svg></div>
    <div class="legend"><span><i class="dot" style="background:#09BEAF"></i>Perkiraan masuk</span><span><i class="dot" style="background:#1F2B4D"></i>Perkiraan keluar</span><span><i class="dot" style="background:#F2A33A;border-radius:5px"></i>Saldo akhir minggu</span>${F.min_cash ? '<span><i class="dot" style="background:#C2410C"></i>Di bawah kas minimum</span>' : ''}</div>`;
}
async function vProyeksi() {
  const [F, ST] = await Promise.all([data('fc'), settings()]);
  const W = F.weeks, outs = (w) => w.rutin + w.kewajiban + w.cicilan + w.gaji + w.belanja, low = W.find(w => w.low), lowest = W.reduce((a, w) => (w.close < a.close ? w : a), W[0]);
  let o = header('Proyeksi kas 13 minggu', 'Saldo kas grup ke depan per minggu. Masuk & keluar rutin dari rata-rata 8 minggu terakhir; gaji, cicilan, kewajiban, dan belanja yang sudah diajukan dihitung sesuai jadwal.', printBtn);
  o += printHead('Proyeksi kas 13 minggu');
  if (+F.hist_weeks < 4) o += `<div class="demo" style="background:var(--bluebg);color:var(--blue)">Riwayat transaksi baru ${F.hist_weeks || 0} minggu, jadi perkiraan masuk & keluar rutin belum akurat. Akan makin tepat setelah 8 minggu data.</div>`;
  o += `<div class="tiles">${tile('Kas & bank sekarang', rpk(F.cash), 'semua rekening grup')}${tile('Titik terendah', rpk(lowest.close), 'minggu ' + tgl(lowest.week), lowest.close < (F.min_cash || 0) ? 'bad' : lowest.close < F.cash * .5 ? 'warn' : '')}
    ${tile('Di bawah kas minimum', low ? 'mulai ' + tgl(low.week) : 'aman', F.min_cash ? 'batas ' + rpk(F.min_cash) : 'batas belum diatur', low ? 'bad' : '')}
    ${tile('Saldo minggu ke-13', rpk(W[W.length - 1].close), rpS(W[W.length - 1].close - F.cash) + ' dari sekarang', W[W.length - 1].close < F.cash ? 'warn' : '')}
    ${tile('Masuk rata-rata / minggu', rpk(F.avg_in), 'dari ' + (F.hist_weeks || 0) + ' minggu terakhir')}${tile('Keluar rutin / minggu', rpk(F.avg_out), 'di luar gaji, cicilan, kewajiban')}</div>`;
  o += sec('Grafik 13 minggu', '', fcChart(F));
  o += sec('Rincian per minggu', 'klik baris untuk melihat tagihan terjadwal', `<div class="scroll"><table class="ftbl compact"><thead><tr><th>Minggu</th><th class="r">Saldo awal</th><th class="r">Masuk</th><th class="r">Keluar rutin</th><th class="r">Gaji</th><th class="r">Cicilan</th><th class="r">Kewajiban</th><th class="r">Belanja</th><th class="r">Total keluar</th><th class="r">Saldo akhir</th></tr></thead><tbody>
    ${W.map((w, i) => `<tr class="click" data-fw="${i}"><td class="nw"><b>${tgl(w.week)} – ${tgl(w.end)}</b>${i === 0 ? ' <span class="pill b">minggu ini</span>' : ''}</td><td class="r">${rpk(w.open)}</td><td class="r green-t">${rpk(w.in)}</td><td class="r">${rpk(w.rutin)}</td><td class="r">${w.gaji ? rpk(w.gaji) : '–'}</td><td class="r">${w.cicilan ? rpk(w.cicilan) : '–'}</td><td class="r">${w.kewajiban ? rpk(w.kewajiban) : '–'}</td><td class="r">${w.belanja ? rpk(w.belanja) : '–'}</td><td class="r">${rpk(outs(w))}</td>
      <td class="r b ${w.low ? 'neg' : ''}">${rpS(w.close)}${w.low ? ' <span class="pill r">kurang</span>' : ''}</td></tr>
      <tr data-fwl="${i}" hidden><td colspan="10"><div class="jl">${w.items.length ? w.items.map(x => `<div class="row between small"><span>${tgl(x.due)} · ${esc(x.name)} <span class="muted">${esc(KIND[x.kind] || x.kind || '')}</span></span><b>${rp(x.amt)}</b></div>`).join('') : '<span class="muted small">Tidak ada cicilan/kewajiban terjadwal.</span>'}${w.gaji ? `<div class="row between small"><span>Gaji (tanggal ${F.payday})</span><b>${rp(w.gaji)}</b></div>` : ''}${w.belanja ? `<div class="row between small"><span>Belanja RAB ${i === 0 ? 'siap cair' : 'yang diajukan'}</span><b>${rp(w.belanja)}</b></div>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`);
  if (canWrite()) o += sec('Kas minimum', 'batas aman kas grup; minggu di bawah angka ini diberi tanda merah', `<form id="minf" class="row gap" style="flex-wrap:wrap"><input class="inp" name="v" type="number" min="0" step="1000000" value="${+ST.fin_min_cash || 0}" style="width:220px"><button class="btn pri">Simpan</button><span class="muted small">Saran: minimal 1× biaya tunai bulanan + cicilan 1 bulan.</span></form>`);
  return o;
}

/* --- Profit First --- */
async function vProfitFirst() {
  const p = period(), [Dd, ST] = await Promise.all([data('dash', p), settings()]), g = digest(Dd); setBadges(Dd, g);
  const PF = ST.fin_profit_first || {}, tot = sum(Object.keys(FPOS), k => +PF[k] || 0);
  const inbox = g.byPos.penerimaan || 0, total = sum(Object.values(g.byPos), v => v);
  const recv = sum(g.cash.filter(c => c.pos === 'penerimaan'), c => +c.in) || sum(g.rows, r => r.cur.rev);
  const rows = Object.keys(FPOS).map(k => { const pctv = +PF[k] || 0, cur2 = g.byPos[k] || 0, ideal = total * pctv / 100; return { k, pctv, cur: cur2, ideal, need: Math.max(0, ideal - cur2), share: recv * pctv / 100 }; });
  const needTot = sum(rows, r => r.need), scale = needTot > inbox && needTot ? inbox / needTot : 1;
  let o = header('Profit First', 'Setiap uang masuk dibagi ke pos rekening sesuai persen yang disepakati, sebelum dipakai. Saldo pos dibandingkan dengan porsi idealnya.');
  o += `<div class="tiles">${tile('Belum dibagi', rpk(inbox), 'saldo rekening penerimaan', inbox > total * .2 ? 'warn' : '')}${tile('Uang masuk periode', rpk(recv), esc(p.label))}
    ${tile('Total kas semua pos', rpk(total), g.cash.length + ' rekening')}${tile('Perlu dipindah', rpk(needTot * scale), needTot > inbox ? 'penerimaan kurang ' + rpk(needTot - inbox) : 'dari rekening penerimaan', needTot * scale > 0 ? 'warn' : '')}
    ${tile('Total persen', tot + '%', tot === 100 ? 'sudah 100%' : 'harus 100%', tot === 100 ? '' : 'bad')}${tile('Pos terkecil vs ideal', rows.length ? pct(Math.min(...rows.map(r => r.ideal ? r.cur / r.ideal * 100 : 100))) : '—', 'saldo ÷ porsi ideal')}</div>`;
  o += sec('Pembagian per pos', 'ideal = total kas × persen pos', `<div class="scroll"><table class="ftbl"><thead><tr><th>Pos</th><th class="r">Persen</th><th class="r">Jatah dari uang masuk periode</th><th class="r">Saldo sekarang</th><th class="r">Porsi ideal</th><th style="min-width:140px">Terisi</th><th class="r">Pindahkan dari penerimaan</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><b>${FPOS[r.k]}</b><br><span class="muted small">${esc((POS[r.k] || [])[1] || '')}</span></td><td class="r">${r.pctv}%</td><td class="r">${rpk(r.share)}</td><td class="r b">${rpk(r.cur)}</td><td class="r">${rpk(r.ideal)}</td>
      <td>${bar(r.cur, r.ideal || 1, r.cur >= r.ideal ? '#09BEAF' : r.cur >= r.ideal * .7 ? '#E8A33A' : '#C2410C')}<span class="small">${pct(r.ideal ? r.cur / r.ideal * 100 : 0)}</span></td>
      <td class="r ${r.need ? 'b' : 'muted'}">${r.need ? rp(Math.round(r.need * scale)) : '—'}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="r">${tot}%</td><td class="r">${rpk(recv)}</td><td class="r">${rpk(total - inbox)}</td><td class="r">${rpk(total)}</td><td></td><td class="r">${rp(Math.round(needTot * scale))}</td></tr></tbody></table></div>
    <p class="muted small" style="margin:0">Rekening tiap pos diatur di <a href="#akun">Akun & rekening</a> (kolom Pos). Pindahan antar-rekening dibukukan lewat mutasi bank atau jurnal manual.</p>`);
  if (canWrite()) o += sec('Atur persen', 'total harus 100', `<form id="pff" class="row gap" style="flex-wrap:wrap;align-items:flex-end">${Object.keys(FPOS).map(k => `<label class="small b" style="display:flex;flex-direction:column;gap:4px">${FPOS[k]}<input class="inp" name="${k}" type="number" min="0" max="100" step="1" value="${+PF[k] || 0}" style="width:130px"></label>`).join('')}<button class="btn pri">Simpan persen</button></form>`);
  return o;
}

/* --- piutang & hutang per pihak (umur FIFO) --- */
const PARTY_ACC = { '1-10100': ['piutang', 'Piutang usaha'], '1-10101': ['piutang', 'Kasbon karyawan'], '2-20100': ['hutang', 'Hutang usaha (vendor)'], '2-20300': ['hutang', 'Hutang bagi hasil mitra'], '2-20600': ['hutang', 'Reimburse karyawan'], '2-21200': ['hutang', 'Dana investor'] };
function aging(lines, asOf) {
  const G = {};
  lines.forEach(l => { const k = l.acc + '|' + l.party; (G[k] = G[k] || { acc: l.acc, party: l.party, items: [], last: l.d, units: new Set() }); const g2 = G[k];
    const inc = l.acc[0] === '1' ? +l.dr - +l.cr : +l.cr - +l.dr; g2.last = l.d; g2.units.add(bizOf(l.unit));
    if (inc > 0) g2.items.push({ d: l.d, amt: inc, memo: l.memo });
    else { let x = -inc; while (x > 0 && g2.items.length) { const it = g2.items[0]; const t2 = Math.min(it.amt, x); it.amt -= t2; x -= t2; if (it.amt <= 0.5) g2.items.shift(); } } });
  return Object.values(G).map(g2 => { const b = [0, 0, 0, 0]; g2.items.forEach(it => { const a = (D(asOf) - D(it.d)) / 864e5; b[a <= 30 ? 0 : a <= 60 ? 1 : a <= 90 ? 2 : 3] += it.amt; });
    return { ...g2, b, bal: sum(b, x => x), oldest: g2.items.length ? g2.items[0].d : null }; }).filter(x => Math.abs(x.bal) >= 1);
}
async function vPihak(kind) {
  const k = kind === 'hutang' ? 'hutang' : 'piutang', p = period(), L = await data('party', { to: p.to }), A2 = aging(L, p.to).filter(x => PARTY_ACC[x.acc] && PARTY_ACC[x.acc][0] === k).sort((a, b) => b.bal - a.bal);
  const T = [0, 1, 2, 3].map(i => sum(A2, x => x.b[i])), tot = sum(T, x => x);
  let o = header(k === 'piutang' ? 'Piutang per pihak' : 'Hutang per pihak', k === 'piutang' ? 'Siapa yang masih berhutang ke grup, dan sudah berapa lama. Umur dihitung dari tagihan terlama yang belum dibayar.' : 'Ke siapa grup masih berhutang: vendor, mitra bagi hasil, reimburse karyawan, dan investor.', printBtn);
  o += printHead(k === 'piutang' ? 'Umur piutang' : 'Umur hutang');
  o += `<div class="chips">${['piutang', 'hutang'].map(x => `<a class="chipbtn ${x === k ? 'on' : ''}" href="#pihak/${x}">${x === 'piutang' ? 'Piutang (orang lain ke kita)' : 'Hutang (kita ke orang lain)'}</a>`).join('')}</div>`;
  o += `<div class="tiles">${tile('Total ' + k, rpk(tot), A2.length + ' pihak')}${tile('0–30 hari', rpk(T[0]), pct(ratio(T[0], tot)))}${tile('31–60 hari', rpk(T[1]), pct(ratio(T[1], tot)), T[1] ? 'warn' : '')}
    ${tile('61–90 hari', rpk(T[2]), pct(ratio(T[2], tot)), T[2] ? 'warn' : '')}${tile('> 90 hari', rpk(T[3]), k === 'piutang' ? 'pertimbangkan dihapus/ditagih keras' : 'segera dibayar', T[3] ? 'bad' : '')}
    ${tile('Pihak terbesar', A2[0] ? rpk(A2[0].bal) : '—', A2[0] ? esc(A2[0].party) : '—')}</div>`;
  const byAcc = Object.keys(PARTY_ACC).filter(a => PARTY_ACC[a][0] === k);
  for (const acc of byAcc) {
    const R = A2.filter(x => x.acc === acc); if (!R.length) continue;
    o += sec(PARTY_ACC[acc][1], rpk(sum(R, x => x.bal)) + ' · ' + R.length + ' pihak', `<div class="scroll"><table class="ftbl"><thead><tr><th>Pihak</th><th>Unit</th><th class="r">0–30</th><th class="r">31–60</th><th class="r">61–90</th><th class="r">&gt; 90</th><th class="r">Saldo</th><th>Terlama</th><th>Gerak terakhir</th></tr></thead><tbody>
      ${R.map(x => `<tr><td><b>${esc(x.party)}</b></td><td class="small">${[...x.units].map(u => dot(u) + esc(BIZN[u] || u)).join(' ')}</td>${x.b.map((v, i) => `<td class="r ${v && i >= 2 ? 'neg' : ''}">${v ? rpk(v) : '–'}</td>`).join('')}<td class="r b">${rp(x.bal)}</td>
        <td class="small">${x.oldest ? tgl(x.oldest) + ' · ' + Math.round((D(p.to) - D(x.oldest)) / 864e5) + ' hari' : '—'}</td><td class="small">${tgl(x.last)}</td></tr>`).join('')}</tbody></table></div>`);
  }
  if (!A2.length) o += sec('Belum ada ' + k, '', empty(`Tidak ada saldo ${k} per pihak. Nama pihak diisi lewat <a href="#saldo">Saldo awal</a> atau <b>Jurnal manual</b> di Buku jurnal (kolom Pihak).`));
  return o;
}

/* --- arus kas --- */
async function vArusKas() {
  const p = period(), C = await data('cf', p);
  const cats = [['operasi', 'Aktivitas operasi', 'penjualan, biaya, pajak, piutang & hutang usaha, DP pelanggan'], ['investasi', 'Aktivitas investasi', 'beli/jual aset tetap'], ['pendanaan', 'Aktivitas pendanaan', 'leasing, pinjaman, investor, modal & prive']];
  const T = Object.fromEntries(cats.map(([c]) => [c, sum(C.rows.filter(r => r.cat === c), r => r.amt)])), net = sum(C.rows, r => r.amt), diff = Math.round(C.closing - C.opening - net);
  const inOp = sum(C.rows.filter(r => r.cat === 'operasi' && r.amt > 0), r => r.amt), outOp = -sum(C.rows.filter(r => r.cat === 'operasi' && r.amt < 0), r => r.amt);
  let o = header('Arus kas', 'Dari mana uang masuk dan ke mana keluar (metode langsung). Pindahan antar-rekening sendiri tidak dihitung.', printBtn + `<button class="btn" data-csv="cf">Unduh CSV</button>`);
  o += printHead('Laporan arus kas');
  o += `<div class="tiles">${tile('Kas awal', rpk(C.opening), tgl(p.from))}${tile('Arus kas operasi', rpS(T.operasi), 'masuk ' + rpk(inOp) + ' · keluar ' + rpk(outOp), T.operasi < 0 ? 'bad' : '')}
    ${tile('Arus kas investasi', rpS(T.investasi), 'belanja aset')}${tile('Arus kas pendanaan', rpS(T.pendanaan), 'cicilan, pinjaman, modal')}${tile('Kenaikan (penurunan) kas', rpS(net), '', net < 0 ? 'warn' : '')}${tile('Kas akhir', rpk(C.closing), tgl(p.to))}</div>`;
  if (diff) o += `<div class="alert y"><span class="k">CEK</span><span><b>Selisih ${rp(diff)}</b> antara perubahan saldo kas dan arus kas. Biasanya karena jurnal saldo awal atau jurnal yang hanya berisi rekening kas.</span></div>`;
  const grp = (c) => { const R = C.rows.filter(r => r.cat === c).sort((a, b) => b.amt - a.amt); const by = {}; R.forEach(r => { by[r.acc] = by[r.acc] || { acc: r.acc, name: r.name, amt: 0, biz: {} }; by[r.acc].amt += r.amt; by[r.acc].biz[r.biz] = (by[r.acc].biz[r.biz] || 0) + r.amt; }); return Object.values(by).sort((a, b) => b.amt - a.amt); };
  let t = '<table class="ftbl compact"><thead><tr><th>Keterangan</th>' + ['RA', 'WG', 'NA', 'HQ'].map(b => `<th class="r">${BIZN[b]}</th>`).join('') + '<th class="r">Total</th></tr></thead><tbody>';
  t += `<tr class="sub"><td>Kas awal periode</td><td colspan="4"></td><td class="r">${num(C.opening)}</td></tr>`;
  for (const [c, l, hint] of cats) {
    const G2 = grp(c); t += `<tr class="sec"><td colspan="6">${l.toUpperCase()} <span style="text-transform:none;font-weight:600">· ${hint}</span></td></tr>`;
    t += G2.length ? G2.map(r => `<tr><td class="ind">${r.amt >= 0 ? 'Masuk dari' : 'Keluar untuk'} ${esc(r.name)} <span class="muted small">${r.acc}</span></td>${['RA', 'WG', 'NA', 'HQ'].map(b => `<td class="r ${mcls(r.biz[b] || 0)}">${r.biz[b] ? num(r.biz[b]) : '<span class="muted">–</span>'}</td>`).join('')}<td class="r b ${mcls(r.amt)}">${num(r.amt)}</td></tr>`).join('') : `<tr><td class="ind muted" colspan="6">Tidak ada</td></tr>`;
    t += `<tr class="sub"><td>Arus kas bersih ${l.toLowerCase()}</td>${['RA', 'WG', 'NA', 'HQ'].map(b => `<td class="r">${num(sum(C.rows.filter(r => r.cat === c && r.biz === b), r => r.amt))}</td>`).join('')}<td class="r ${mcls(T[c])}">${num(T[c])}</td></tr>`;
  }
  t += `<tr class="sub"><td>Kenaikan (penurunan) kas</td><td colspan="4"></td><td class="r ${mcls(net)}">${num(net)}</td></tr><tr class="tot big"><td>Kas akhir periode</td><td colspan="4"></td><td class="r">${num(C.closing)}</td></tr></tbody></table>`;
  o += sec('Laporan arus kas', esc(p.label) + ' · rupiah', `<div class="scroll">${t}</div>`);
  cur = { csv: () => [['Kategori', 'Akun', 'Nama', 'Unit', 'Jumlah'], ...C.rows.map(r => [r.cat, r.acc, r.name, BIZN[r.biz] || r.biz, r.amt]), ['', '', 'Kas awal', '', C.opening], ['', '', 'Kas akhir', '', C.closing]] };
  return o;
}

/* --- utang leasing & pinjaman (bagian halaman Kewajiban) --- */
async function loanSection() {
  const L = await loans(), t = today(), C = L.filter(l => l.is_active !== false).map(l => ({ l, c: loanCalc(l, t) }));
  const rem = sum(C, x => x.c.rem), inst = sum(C.filter(x => x.c.left !== 0), x => x.c.inst), intLeft = sum(C, x => x.c.interest_left);
  const part = C.filter(x => x.c.partial), noInst = C.filter(x => x.c.noInst), ends = C.map(x => x.c.end).filter(Boolean).sort();
  C.sort((a, b) => (+a.l.due_day - +b.l.due_day) || String(a.l.lender || '').localeCompare(String(b.l.lender || '')) || String(a.l.name).localeCompare(String(b.l.name)));
  let o = `<div class="tiles">${tile('Sisa pokok pinjaman', part.length === C.length && C.length ? 'belum diisi' : rpk(rem), C.length + ' pinjaman aktif' + (part.length ? ' · ' + part.length + ' tanpa pokok/tenor' : ''), part.length ? 'warn' : '')}${tile('Cicilan / bulan', rpk(inst), noInst.length ? noInst.length + ' kontrak belum ada nominal' : 'leasing, pinjaman, investor', noInst.length ? 'warn' : '')}${tile('Sisa bunga', rpk(intLeft), 'yang masih akan dibayar')}
    ${tile('Lunas terakhir', ends.length ? bulan(ends.pop()) : '—', ends.length ? 'pinjaman terpanjang' : 'tenor belum diisi')}</div>`;
  if (part.length) o += `<div class="alert y"><div><b>${part.length} kontrak belum lengkap.</b> Cicilan & tanggal jatuh tempo sudah dipakai di proyeksi kas, tapi sisa pokok dan tanggal lunas baru terhitung setelah pokok, tenor, dan bulan cicilan pertama diisi${noInst.length ? `; ${noInst.length} kontrak (${[...new Set(noInst.map(x => x.l.lender))].join(', ')}) juga belum ada nominal cicilannya` : ''}. Klik baris untuk melengkapi.</div></div>`;
  const byL = {}; C.forEach(({ l, c }) => { const k = l.lender || '—'; (byL[k] = byL[k] || { n: 0, inst: 0, rem: 0, days: new Set(), part: 0 }); byL[k].n++; byL[k].inst += c.inst; byL[k].rem += c.rem; byL[k].days.add(+l.due_day); if (c.partial) byL[k].part++; });
  if (Object.keys(byL).length > 1) o += sec('Per pemberi pinjaman', '', `<div class="scroll"><table class="ftbl"><thead><tr><th>Pemberi pinjaman</th><th class="r">Kontrak</th><th class="r">Cicilan / bulan</th><th>Tanggal tempo</th><th class="r">Sisa pokok</th></tr></thead><tbody>
    ${Object.entries(byL).sort((a, b) => b[1].inst - a[1].inst).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td class="r">${v.n}</td><td class="r b">${rp(v.inst)}</td><td class="small">tgl ${[...v.days].sort((a, b) => a - b).join(', ')}</td><td class="r">${v.part === v.n ? '<span class="muted">belum diisi</span>' : rp(v.rem) + (v.part ? ` <span class="muted small">(+${v.part} belum diisi)</span>` : '')}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="r">${C.length}</td><td class="r">${rp(inst)}</td><td></td><td class="r">${rp(rem)}</td></tr></tbody></table></div>`);
  o += sec('Utang leasing & pinjaman', 'urut tanggal jatuh tempo · klik untuk jadwal / melengkapi data', C.length ? `<div class="scroll"><table class="ftbl"><thead><tr><th>Pinjaman</th><th>Unit</th><th class="r">Pokok awal</th><th class="r">Bunga</th><th class="r">Cicilan</th><th>Tempo</th><th style="min-width:120px">Progres</th><th class="r">Sisa pokok</th><th>Berikutnya</th><th>Lunas</th></tr></thead><tbody>
    ${C.map(({ l, c }) => `<tr class="click" data-loan="${esc(l.id)}"><td><b>${esc(l.name)}</b><br><span class="muted small">${esc(l.lender || '')} · ${esc(KIND[l.kind] || (l.kind === 'investor' ? 'Investor' : l.kind))}${l.contract_no ? ' · ' + esc(l.contract_no) : ''}</span></td><td>${logo(l.unit_code, 18)} ${esc(uname(l.unit_code))}</td><td class="r">${c.partial ? '<span class="muted">—</span>' : rpk(l.principal)}</td><td class="r">${c.partial ? '<span class="muted">—</span>' : String(+l.rate_pct).replace('.', ',') + '% ' + (l.method === 'anuitas' ? 'efektif' : 'flat')}</td><td class="r b">${c.noInst ? '<span class="pill y">belum diisi</span>' : rp(c.inst)}</td><td>tgl ${l.due_day}</td>
      <td>${c.partial ? '<span class="pill y">tenor belum diisi</span>' : bar(c.paid, +l.tenor_months, '#09BEAF') + `<span class="small">${c.paid}/${l.tenor_months} bulan</span>`}</td><td class="r b">${c.partial ? '<span class="muted">—</span>' : rp(c.rem)}</td><td class="small">${c.next ? tgl(c.next.d) : '<span class="pill g">lunas</span>'}</td><td class="small">${c.end ? bulan(c.end) : '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small" style="margin:0">Cicilan leasing cukup dicatat di sini; jangan didobel di Kewajiban rutin. Proyeksi kas otomatis memakai jadwal ini.</p>` : empty('Belum ada pinjaman. Tim Keuangan bisa menambahkan dengan tombol di bawah.'));
  if (canWrite()) o += `<div><button class="btn pri" type="button" data-loanadd>+ Tambah leasing / pinjaman</button></div>`;
  return o;
}
function loanForm(l = {}) {
  const f = (n, lab, v, typ = 'text', extra = '') => `<label class="small b" style="display:flex;flex-direction:column;gap:4px">${lab}<input class="inp" name="${n}" type="${typ}" value="${esc(v ?? '')}" ${extra}></label>`;
  panel(`<div class="row between"><h2>${l.id ? 'Ubah' : 'Tambah'} leasing / pinjaman</h2><button class="btn sm" data-close>✕</button></div>
    <form id="loanf" class="stack" style="gap:10px"><input type="hidden" name="id" value="${esc(l.id || '')}">
    ${f('name', 'Nama', l.name, 'text', 'required placeholder="mis. Leasing Jeep Guntur"')}<div class="cols2" style="gap:10px">${f('lender', 'Pemberi pinjaman', l.lender, 'text', 'placeholder="ACC, Adira, bank, investor"')}
    <label class="small b" style="display:flex;flex-direction:column;gap:4px">Jenis<select class="inp" name="kind">${[['leasing', 'Leasing'], ['pinjaman', 'Pinjaman bank'], ['investor', 'Dana investor']].map(([k, v]) => `<option value="${k}"${l.kind === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="small b" style="display:flex;flex-direction:column;gap:4px">Unit<select class="inp" name="unit_code">${UNITS.map(u => `<option value="${u.code}"${l.unit_code === u.code ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
    ${f('contract_no', 'No. kontrak', l.contract_no)}${f('principal', 'Pokok pinjaman (Rp)', l.principal, 'number', 'min="1"')}${f('rate_pct', 'Bunga per tahun (%)', l.rate_pct ?? 0, 'number', 'min="0" step="0.01"')}
    <label class="small b" style="display:flex;flex-direction:column;gap:4px">Metode bunga<select class="inp" name="method"><option value="flat"${l.method !== 'anuitas' ? ' selected' : ''}>Flat (umum di leasing)</option><option value="anuitas"${l.method === 'anuitas' ? ' selected' : ''}>Anuitas / efektif (bank)</option></select></label>
    ${f('tenor_months', 'Tenor (bulan)', l.tenor_months, 'number', 'min="1" max="360"')}${f('start_month', 'Cicilan pertama (bulan)', l.start_month ? l.start_month.slice(0, 7) : '', 'month', 'required')}
    ${f('due_day', 'Tanggal jatuh tempo', l.due_day ?? 5, 'number', 'min="1" max="31"')}${f('installment', 'Cicilan per bulan (kosongkan = dihitung)', l.installment, 'number', 'min="0"')}
    ${f('paid_months', 'Sudah dibayar (bulan)', l.paid_months ?? 0, 'number', 'min="0"')}${f('bank_pattern', 'Kata kunci di mutasi bank', l.bank_pattern, 'text', 'placeholder="mis. ACC FINANCE"')}</div>
    ${f('note', 'Catatan', l.note)}${l.id ? `<label class="chk small"><input type="checkbox" name="is_active" ${l.is_active !== false ? 'checked' : ''}> Masih aktif</label>` : ''}
    <button class="btn pri">Simpan</button></form>`);
}
function loanPanel(id) {
  const l = (LOANS || []).find(x => x.id === id); if (!l) return; const c = loanCalc(l, today());
  panel(`<div class="row between"><div><span class="muted small">${esc(l.lender || '')} · ${esc(uname(l.unit_code))}</span><h2 style="font-size:20px">${esc(l.name)}</h2></div><button class="btn sm" data-close>✕</button></div>
    <div class="kv"><div><span>Cicilan</span><b>${c.noInst ? 'belum diisi' : rp(c.inst)}</b></div><div><span>Sisa pokok</span><b>${c.partial ? 'belum diisi' : rp(c.rem)}</b></div><div><span>Sisa tenor</span><b>${c.partial ? 'belum diisi' : c.left + ' bulan'}</b></div></div>
    ${l.contract_no ? `<div class="small muted">No. kontrak ${esc(l.contract_no)} · jatuh tempo tgl ${l.due_day}</div>` : ''}${l.note ? `<div class="small">${esc(l.note)}</div>` : ''}
    ${canWrite() ? `<button class="btn${c.partial ? ' pri' : ''}" type="button" data-loanedit="${esc(l.id)}" style="align-self:flex-start">${c.partial ? 'Lengkapi pokok & tenor' : 'Ubah data pinjaman'}</button>` : ''}
    ${c.partial ? '<p class="muted small">Jadwal cicilan dan sisa pokok tampil setelah pokok, tenor, dan bulan cicilan pertama diisi.</p>' : `<table class="ftbl compact"><thead><tr><th>#</th><th>Jatuh tempo</th><th class="r">Pokok</th><th class="r">Bunga</th><th class="r">Cicilan</th><th class="r">Sisa pokok</th></tr></thead><tbody>${c.sched.map(s => `<tr${s.i <= c.paid ? ' style="opacity:.5"' : ''}><td>${s.i}</td><td>${tgl(s.d)} ${s.d.slice(0, 4)}</td><td class="r">${num(s.pr)}</td><td class="r">${num(s.int)}</td><td class="r b">${num(s.inst)}</td><td class="r">${num(s.rem)}</td></tr>`).join('')}</tbody></table>`}`);
}

/* --- akun & rekening + pengaturan --- */
async function vAkun() {
  const [AC, ST] = await Promise.all([data('accfull'), settings()]);
  const G = [['aset', 'Aset'], ['kewajiban', 'Kewajiban'], ['ekuitas', 'Ekuitas'], ['pendapatan', 'Pendapatan'], ['hpp', 'Harga pokok'], ['beban', 'Biaya operasional'], ['pendapatan_lain', 'Pendapatan lain'], ['beban_lain', 'Beban lain']];
  const cash = AC.filter(a => a.is_cash);
  let o = header('Akun & rekening', 'Bagan akun satu buku PT Popo Karya Investama. Rekening kas & bank diberi unit dan pos (Profit First) supaya laporan per unit dan per pos benar.');
  if (!canWrite()) o += '<div class="ro">Perubahan akun & rekening oleh Keuangan atau CEO.</div>';
  o += `<div class="tiles">${tile('Rekening kas & bank', cash.length, cash.filter(a => a.bank).length + ' bank · ' + cash.filter(a => !a.bank).length + ' tunai')}${tile('Belum ada nomor rekening', cash.filter(a => a.bank && !a.note).length, 'isi di kolom catatan', cash.some(a => a.bank && !a.note) ? 'warn' : '')}
    ${tile('Total akun', AC.length, AC.filter(a => a.is_active === false).length + ' nonaktif')}${tile('Tanpa pos', cash.filter(a => !a.pos).length, 'rekening kas belum diberi pos', cash.some(a => !a.pos) ? 'warn' : '')}</div>`;
  o += sec('Rekening kas & bank', canWrite() ? 'klik baris untuk mengubah' : '', `<div class="scroll"><table class="ftbl"><thead><tr><th>Kode</th><th>Nama rekening</th><th>Bank</th><th>No. rekening / catatan</th><th>Unit</th><th>Pos</th><th>Status</th></tr></thead><tbody>
    ${cash.map(a => `<tr class="${canWrite() ? 'click' : ''}" data-accedit="${esc(a.code)}"><td><code>${esc(a.code)}</code></td><td><b>${esc(a.name)}</b></td><td>${esc(a.bank || 'tunai')}</td><td class="small">${esc(a.note || '')}</td><td>${a.unit_code ? dot(bizOf(a.unit_code)) + esc(uname(a.unit_code)) : 'Grup'}</td><td>${a.pos ? esc((POS[a.pos] || [a.pos])[0]) : '<span class="pill y">belum</span>'}</td><td>${a.is_active === false ? '<span class="pill">nonaktif</span>' : '<span class="pill g">aktif</span>'}</td></tr>`).join('')}</tbody></table></div>
    ${canWrite() ? '<div class="row gap"><button class="btn pri" type="button" data-accnew="cash">+ Rekening baru</button><button class="btn" type="button" data-accnew="other">+ Akun lain</button></div>' : ''}`);
  o += `<div class="cols2">${G.map(([k, l]) => { const R = AC.filter(a => a.grp === k && !a.is_cash); return R.length ? sec(l, R.length + ' akun', `<table class="ftbl compact"><tbody>${R.map(a => `<tr class="${canWrite() ? 'click' : ''}" data-accedit="${esc(a.code)}"><td style="width:90px"><code>${esc(a.code)}</code></td><td>${esc(a.name)}${a.is_active === false ? ' <span class="pill">nonaktif</span>' : ''}</td></tr>`).join('')}</tbody></table>`) : ''; }).join('')}</div>`;
  if (canWrite()) {
    const sf = (k, l, v, hint, step = 1) => `<label class="small b" style="display:flex;flex-direction:column;gap:4px">${l}<input class="inp" name="${k}" type="number" step="${step}" value="${v ?? ''}" style="width:200px"><span class="muted" style="font-weight:600">${hint}</span></label>`;
    o += sec('Pengaturan keuangan', '', `<form id="setf" class="row gap" style="flex-wrap:wrap;align-items:flex-start">${sf('fin_min_cash', 'Kas minimum grup (Rp)', +ST.fin_min_cash || 0, 'batas aman di proyeksi kas', 1000000)}${sf('fin_tax_rate', 'Tarif PPh final (%)', ST.fin_tax_rate ?? 0.5, 'estimasi; cek konsultan pajak', 0.1)}
      ${sf('fin_payroll_day', 'Tanggal gaji', ST.fin_payroll_day ?? 25, 'gaji dibukukan otomatis')}${sf('fin_close_day', 'Batas tutup buku (tanggal)', ST.fin_close_day ?? 5, 'bulan berikutnya')}${sf('fin_capitalize_min', 'Batas barang jadi aset (Rp)', ST.fin_capitalize_min ?? 500000, 'harga satuan di LPJ', 50000)}
      <button class="btn pri" style="align-self:center">Simpan pengaturan</button></form>`);
  }
  cur = { accs: AC };
  return o;
}
function accForm(a, kind) {
  const isCash = a ? a.is_cash : kind === 'cash', AC = (cur && cur.accs) || [];
  const nextCode = () => { const pre = isCash ? '1-100' : '6-600'; const n = AC.filter(x => x.code.startsWith(pre)).map(x => +x.code.slice(2)).sort((x, y) => y - x)[0]; return n ? pre[0] + '-' + String(n + 1).padStart(5, '0') : pre + '01'; };
  panel(`<div class="row between"><h2>${a ? 'Ubah akun' : isCash ? 'Rekening baru' : 'Akun baru'}</h2><button class="btn sm" data-close>✕</button></div>
    <form id="accf" class="stack" style="gap:10px"><input type="hidden" name="is_cash" value="${isCash ? 'true' : 'false'}">
    <div class="cols2" style="gap:10px"><label class="small b" style="display:flex;flex-direction:column;gap:4px">Kode<input class="inp" name="code" value="${esc(a ? a.code : nextCode())}" ${a ? 'readonly' : ''} pattern="[1-8]-[0-9]{5}" required><span class="muted" style="font-weight:600">digit pertama menentukan kelompok: 1 aset · 2 kewajiban · 3 ekuitas · 4 pendapatan · 5 HPP · 6 biaya · 7/8 lain-lain</span></label>
    <label class="small b" style="display:flex;flex-direction:column;gap:4px">Nama<input class="inp" name="name" value="${esc(a ? a.name : '')}" required></label>
    ${isCash ? `<label class="small b" style="display:flex;flex-direction:column;gap:4px">Bank (kosongkan bila kas tunai)<input class="inp" name="bank" value="${esc(a ? a.bank || '' : '')}" placeholder="BCA, BRI, Mandiri"></label>
    <label class="small b" style="display:flex;flex-direction:column;gap:4px">Pos (Profit First)<select class="inp" name="pos"><option value="">—</option>${Object.keys(POS).map(k => `<option value="${k}"${a && a.pos === k ? ' selected' : ''}>${POS[k][0]}</option>`).join('')}</select></label>` : ''}
    <label class="small b" style="display:flex;flex-direction:column;gap:4px">Unit pemilik<select class="inp" name="unit_code"><option value="">Grup / tanpa unit</option>${UNITS.map(u => `<option value="${u.code}"${a && a.unit_code === u.code ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
    <label class="small b" style="display:flex;flex-direction:column;gap:4px">${isCash ? 'No. rekening & atas nama' : 'Catatan'}<input class="inp" name="note" value="${esc(a ? a.note || '' : '')}"></label></div>
    <label class="chk small"><input type="checkbox" name="is_active" ${!a || a.is_active !== false ? 'checked' : ''}> Aktif</label>
    <button class="btn pri">Simpan</button></form>`);
}

/* --- saldo awal --- */
const OPEN_DEFAULT = ['1-10100', '1-10101', '1-10200', '1-10210', '1-10701', '1-10702', '1-10703', '1-10704', '1-10751', '1-10752', '1-10753', '2-20100', '2-20200', '2-20300', '2-20400', '2-21000', '2-21100', '2-21200', '3-30000', '3-30100'];
async function vSaldo() {
  const [OP, AC] = await Promise.all([data('open'), data('accfull')]);
  const bs = AC.filter(a => ['1', '2', '3'].includes(a.code[0]) && a.code !== '3-30999' && a.is_active !== false);
  const d0 = (() => { const t = D(today()); return ymd(new Date(t.getFullYear(), t.getMonth(), 0)); })();
  const rows = OP.lines && OP.lines.length ? OP.lines : bs.filter(a => a.is_cash).map(a => ({ acc: a.code, amount: '' })).concat(OPEN_DEFAULT.filter(c => bs.some(a => a.code === c)).map(c => ({ acc: c, amount: '' })));
  const opt = (sel) => bs.map(a => `<option value="${a.code}"${a.code === sel ? ' selected' : ''}>${a.code} · ${esc(a.name)}</option>`).join('');
  const row = (r) => `<tr data-orow><td><select class="inp" data-oacc style="width:100%;min-width:240px">${opt(r.acc)}</select></td><td><input class="inp" data-oparty value="${esc(r.party || '')}" placeholder="opsional: nama pelanggan / vendor" style="width:100%"></td>
    <td><select class="inp" data-ounit style="min-width:130px"><option value="">—</option>${UNITS.map(u => `<option value="${u.code}"${r.unit === u.code ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></td>
    <td><input class="inp" data-oamt type="number" step="1" value="${r.amount === '' || r.amount == null ? '' : Math.round(r.amount)}" placeholder="0" style="width:170px;text-align:right"></td><td><button class="btn sm" type="button" data-orem>✕</button></td></tr>`;
  let o = header('Saldo awal', 'Neraca pembuka buku Pokama (dari Jurnal Mekari atau rekening koran) per satu tanggal. Selisih otomatis masuk "Ekuitas saldo awal". Bisa disimpan ulang; versi lama diganti.');
  if (!canWrite()) o += '<div class="ro">Saldo awal diisi oleh Keuangan atau CEO.</div>';
  o += OP.date ? `<div class="ok">Saldo awal tersimpan per <b>${tgl(OP.date)} ${OP.date.slice(0, 4)}</b>${OP.by ? ' oleh ' + esc(OP.by) : ''} · penyeimbang ekuitas ${rp(OP.balancing)}${OP.first_tx && OP.first_tx <= OP.date ? ' · <b>perhatian:</b> ada transaksi lain sebelum/sama dengan tanggal ini' : ''}</div>`
    : `<div class="demo" style="background:var(--bluebg);color:var(--blue)">Belum ada saldo awal. Isi nilai per akun sesuai neraca penutup di Jurnal Mekari pada tanggal yang dipilih.</div>`;
  o += sec('Isi saldo', 'aset diisi positif · kewajiban & ekuitas diisi positif · akumulasi penyusutan diisi minus', `<form id="openf" class="stack" style="gap:12px">
    <label class="small b" style="display:flex;flex-direction:column;gap:4px;max-width:260px">Per tanggal (akhir hari)<input class="inp" type="date" name="date" value="${OP.date || d0}" required></label>
    <div class="scroll"><table class="ftbl compact" id="otbl"><thead><tr><th>Akun</th><th>Pihak (untuk piutang/hutang)</th><th>Unit</th><th class="r">Saldo (Rp)</th><th></th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>
    <template id="orowt">${row({ acc: '', amount: '' })}</template>
    <div class="row gap" style="flex-wrap:wrap"><button class="btn" type="button" data-oadd>+ Baris</button><span class="grow"></span><div class="kv" id="osum" style="min-width:min(560px,100%)"></div></div>
    ${canWrite() ? `<button class="btn pri" style="align-self:flex-start">Simpan saldo awal</button>` : ''}</form>`);
  setTimeout(openSum, 0);
  return o;
}
function openSum() {
  const el = document.getElementById('osum'); if (!el) return;
  let A2 = 0, L2 = 0, E2 = 0;
  app.querySelectorAll('[data-orow]').forEach(r => { const acc = r.querySelector('[data-oacc]').value, v = +r.querySelector('[data-oamt]').value || 0; if (acc[0] === '1') A2 += v; else if (acc[0] === '2') L2 += v; else E2 += v; });
  el.innerHTML = `<div><span>Total aset</span><b>${rp(A2)}</b></div><div><span>Kewajiban + ekuitas diisi</span><b>${rp(L2 + E2)}</b></div><div><span>Penyeimbang ekuitas</span><b class="${A2 - L2 - E2 < 0 ? 'red' : ''}">${rpS(A2 - L2 - E2)}</b></div>`;
}

/* --- jurnal manual --- */
async function journalForm() {
  const AC = (await accounts()).filter(a => a.code !== '3-30999');
  const opt = AC.map(a => `<option value="${a.code}">${a.code} · ${esc(a.name)}</option>`).join('');
  const un = `<option value="">(unit jurnal)</option>` + UNITS.map(u => `<option value="${u.code}">${esc(u.name)}</option>`).join('');
  const row = () => `<tr data-jrow><td><select class="inp" data-jacc style="min-width:220px"><option value="">Pilih akun…</option>${opt}</select></td><td><select class="inp" data-junit style="min-width:120px">${un}</select></td>
    <td><input class="inp" data-jd type="number" min="0" step="1" style="width:130px;text-align:right" placeholder="Debit"></td><td><input class="inp" data-jc type="number" min="0" step="1" style="width:130px;text-align:right" placeholder="Kredit"></td>
    <td><input class="inp" data-jparty style="width:150px" placeholder="Pihak (opsional)"></td><td><button class="btn sm" type="button" data-jrem>✕</button></td></tr>`;
  panel(`<div class="row between"><h2>Jurnal manual</h2><button class="btn sm" data-close>✕</button></div>
    <p class="muted small" style="margin:0">Untuk koreksi dan transaksi yang tidak lewat sistem (setoran modal, prive, penyusutan, pembayaran hutang di luar bank). Debit harus sama dengan kredit. Tercatat atas nama Anda dan tidak bisa diubah; koreksi lewat jurnal balik.</p>
    <form id="jmf" class="stack" style="gap:10px"><div class="cols2" style="gap:10px"><label class="small b" style="display:flex;flex-direction:column;gap:4px">Tanggal<input class="inp" type="date" name="date" value="${today()}" required></label>
      <label class="small b" style="display:flex;flex-direction:column;gap:4px">Unit jurnal<select class="inp" name="unit">${UNITS.map(u => `<option value="${u.code}"${u.code === 'HQ' ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label></div>
      <label class="small b" style="display:flex;flex-direction:column;gap:4px">Keterangan<input class="inp" name="memo" required placeholder="mis. Setoran modal owner ke Bank Operasional Holding"></label>
      <label class="small b" style="display:flex;flex-direction:column;gap:4px">Link bukti (opsional)<input class="inp" name="proof_url" placeholder="Google Drive / foto nota"></label>
      <div class="scroll"><table class="ftbl compact"><tbody id="jrows">${row()}${row()}</tbody></table></div><template id="jrowt">${row()}</template>
      <div class="row gap"><button class="btn sm" type="button" data-jadd>+ Baris</button><span class="grow"></span><span id="jbal" class="pill">Debit 0 · Kredit 0</span></div>
      <button class="btn pri">Simpan jurnal</button></form>`, (pn) => {
    const upd = () => { let dd = 0, cc = 0; pn.querySelectorAll('[data-jrow]').forEach(r => { dd += +r.querySelector('[data-jd]').value || 0; cc += +r.querySelector('[data-jc]').value || 0; });
      const b = pn.querySelector('#jbal'); b.textContent = 'Debit ' + rp(dd) + ' · Kredit ' + rp(cc) + (dd === cc && dd ? ' · seimbang' : dd !== cc ? ' · selisih ' + rp(Math.abs(dd - cc)) : ''); b.className = 'pill ' + (dd === cc && dd ? 'g' : 'r'); };
    pn.addEventListener('input', upd);
    pn.addEventListener('click', (e) => { if (e.target.closest('[data-jadd]')) { pn.querySelector('#jrows').insertAdjacentHTML('beforeend', pn.querySelector('#jrowt').innerHTML); } const rm = e.target.closest('[data-jrem]'); if (rm && pn.querySelectorAll('[data-jrow]').length > 2) { rm.closest('tr').remove(); upd(); } });
    pn.querySelector('#jmf').addEventListener('submit', (e) => {
      e.preventDefault(); if (demoAct()) return;
      const f = Object.fromEntries(new FormData(e.target)), lines = [...pn.querySelectorAll('[data-jrow]')].map(r => ({ acc: r.querySelector('[data-jacc]').value, unit: r.querySelector('[data-junit]').value, d: r.querySelector('[data-jd]').value, c: r.querySelector('[data-jc]').value, party: r.querySelector('[data-jparty]').value })).filter(l => l.acc && (+l.d || +l.c));
      act(async () => { const r = await A.rpc('pk_fin_journal_save', { p: { ...f, lines } }); toast('Jurnal ' + r.code + ' tersimpan'); close(); render(); });
    });
  });
}

/* ---------- menu (sama dengan Sistem Kerja) ---------- */
const I = {
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M4 13 7 5h10l3 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  book: '<path d="M4 4h5v16H4zM10 4h4v16h-4z"/><path d="m15 5 4-1 2 15-4 1z"/>',
  check: '<path d="M4 5h11a2 2 0 0 1 2 2v4"/><path d="M4 5v14h7"/><path d="m14 17 2 2 4-4"/>',
  cog: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  pie: '<path d="M12 3v9h9"/><circle cx="12" cy="12" r="9"/>',
  swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
  flow: '<path d="M4 6h10M4 12h16M4 18h7"/><path d="m17 3 3 3-3 3M10 15l3 3-3 3"/>',
  bank: '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  open: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
};
const svg = (k, s = 18) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const NAV = [
  ['Grup', [['ringkasan', 'Ringkasan', 'grid'], ['unit', 'Per unit bisnis', 'trophy'], ['target', 'Target vs realisasi', 'flag'], ['rab', 'Belanja RAB & LPJ', 'inbox', 'lpj']]],
  ['Kas', [['kas', 'Kas & bank', 'wallet', 'mutasi'], ['proyeksi', 'Proyeksi kas', 'trend', 'fclow'], ['pf', 'Profit First', 'pie'], ['kewajiban', 'Kewajiban & leasing', 'clock', 'due'], ['pihak', 'Piutang & hutang', 'swap']]],
  ['Laporan', [['labarugi', 'Laba rugi', 'coin'], ['neraca', 'Neraca', 'layers'], ['aruskas', 'Arus kas', 'flow'], ['jurnal', 'Buku jurnal', 'book']]],
  ['Kelola', [['antrean', 'Antrean Keuangan', 'check', 'antrean'], ['akun', 'Akun & rekening', 'bank'], ['saldo', 'Saldo awal', 'open', 'saldo'], ['sumber', 'Sumber & tutup buku', 'cog']]],
];
const MOBILE = [['ringkasan', 'Ringkasan', 'grid'], ['unit', 'Unit', 'trophy'], ['kas', 'Kas', 'wallet', 'mutasi'], ['antrean', 'Antrean', 'check', 'antrean']];
const ROLE = { ceo: 'CEO', kepala_staf: 'Kepala Staf', keuangan: 'Keuangan', leader: 'Leader', staf: 'Staf' };
function shell() {
  const me = PEOPLE.find(p => ME && (p.id === ME.id || p.email === ME.email)) || ME || {};
  document.getElementById('side').innerHTML = `<a class="brand" href="/"><img src="/img/pokama-logo.png" alt="Pokama"></a>
    <div class="side-top"><div class="side-sec">Keuangan grup</div>
      <div class="restrict"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#09BEAF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>Area terbatas · CEO, Kepala Staf, Keuangan · 2FA</span></div>
      <a class="back-link" href="/">← Sistem Kerja</a></div>
    <nav aria-label="Menu keuangan">${NAV.map(([sec, items]) => `<div class="nav-sec"><span class="nav-h">${sec}</span>${items.map(([k, l, ic, nb]) => `<a href="#${k}">${svg(ic)}<span>${l}</span>${nb ? `<b class="badge" data-nb="${nb}" hidden></b>` : ''}</a>`).join('')}</div>`).join('')}
    <div class="nav-sec"><span class="nav-h">Modul lain</span><a href="/affiliate">${svg('users')}<span>Mitra Affiliate</span></a></div></nav>
    <div class="side-me"><a href="/#/pengaturan" class="me">${avatar(me, 36)}<span><b>${esc(nick(me) || me.name || 'Uji lokal')}</b><small>${esc(me.title || ROLE[me.role] || '')}</small></span></a></div>`;
  document.getElementById('bottom').innerHTML = MOBILE.map(([k, l, ic, nb]) => `<a href="#${k}" data-k="${k}">${svg(ic, 22)}<span>${l}</span>${nb ? `<b class="badge" data-nb="${nb}" hidden></b>` : ''}</a>`).join('') + `<a href="#menu" data-k="menu">${svg('menu', 22)}<span>Lainnya</span></a>`;
}
async function vMenu() {
  return `<header class="ph"><div><span class="muted small">Keuangan grup</span><h1>Menu</h1></div></header>
    <div class="menu-list">${NAV.flatMap(([, it]) => it).map(([k, l, ic, nb]) => `<a class="card row" href="#${k}">${svg(ic, 22)}<b>${l}</b><span style="flex:1"></span>${nb ? `<b class="badge" data-nb="${nb}" hidden></b>` : ''}›</a>`).join('')}
    <a class="card row" href="/">${svg('sun', 22)}<b>Sistem Kerja</b><span style="flex:1"></span>›</a><a class="card row" href="/affiliate">${svg('users', 22)}<b>Mitra Affiliate</b><span style="flex:1"></span>›</a></div>`;
}

/* ---------- kerangka ---------- */
function setBadges(Dd, g) {
  const set = (k, n) => document.querySelectorAll(`[data-nb="${k}"]`).forEach(b => { b.textContent = n; b.hidden = !n; });
  set('mutasi', g.exc.mutasi); set('antrean', g.excN); set('due', g.obl7.length); set('lpj', g.rab.telat);
}
function setBadge(k, n) { document.querySelectorAll(`[data-nb="${k}"]`).forEach(b => { b.textContent = n; b.hidden = !n; }); }
function panel(html, after) { close(); const el = document.createElement('div'); el.className = 'scrim'; el.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(el); el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) close(); }); if (after) after(el.querySelector('.panel')); }
function close() { document.querySelectorAll('.scrim').forEach(s => s.remove()); }
const VIEWS = { menu: vMenu, ringkasan: vRingkasan, unit: vUnit, target: vTarget, kas: vKas, proyeksi: vProyeksi, pf: vProfitFirst, kewajiban: vKewajiban, pihak: vPihak, rab: vRab, labarugi: vLabaRugi, neraca: vNeraca, aruskas: vArusKas, jurnal: vJurnal, antrean: vAntrean, akun: vAkun, saldo: vSaldo, sumber: vSumber };
let seq = 0;
async function render() {
  const { v, a } = route(), my = ++seq;
  document.querySelectorAll('.side a[href^="#"]').forEach(x => { const on = x.getAttribute('href') === '#' + v; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
  document.title = (PAGES[v] || 'Menu') + ' · Keuangan Pokama';
  document.querySelectorAll('.bottom a').forEach(x => x.classList.toggle('on', x.dataset.k === v));
  try { const h = await VIEWS[v](a); if (my === seq) app.innerHTML = h; }
  catch (e) { if (my === seq) app.innerHTML = `<div class="alert"><span><b>Gagal memuat.</b> ${esc(e.message)}</span></div>`; }
}
const demoAct = () => { if (usingDemo()) { toast('Data contoh — tidak ada yang disimpan.'); return true; } return false; };
async function act(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.f) { S[t.dataset.f] = t.value; if (t.dataset.f === 'per') ls('keu.per', t.value); render(); }
  if (t.hasAttribute('data-demo')) { S.demo = t.checked; ls('keu.demo', t.checked ? '1' : null); SET = null; LOANS = null; ACCS = null; render(); }
  if (t.closest('#openf')) openSum();
});
app.addEventListener('input', (e) => { if (e.target.closest('#openf')) openSum(); });
const num0 = (v) => (v === '' || v == null ? null : +v);
document.addEventListener('submit', (e) => {
  const id = e.target.id, f = Object.fromEntries(new FormData(e.target));
  if (!['minf', 'pff', 'setf', 'openf', 'loanf', 'accf'].includes(id)) return;
  e.preventDefault(); if (demoAct()) return;
  if (id === 'minf') act(async () => { await A.rpc('pk_fin_setting_set', { p_key: 'fin_min_cash', p_value: +f.v || 0 }); SET = null; toast('Kas minimum disimpan'); render(); });
  if (id === 'pff') act(async () => { const v = Object.fromEntries(Object.keys(FPOS).map(k => [k, +f[k] || 0])); await A.rpc('pk_fin_setting_set', { p_key: 'fin_profit_first', p_value: v }); SET = null; toast('Persen Profit First disimpan'); render(); });
  if (id === 'setf') act(async () => { for (const k of ['fin_min_cash', 'fin_tax_rate', 'fin_payroll_day', 'fin_close_day', 'fin_capitalize_min']) if (f[k] !== '') await A.rpc('pk_fin_setting_set', { p_key: k, p_value: +f[k] }); SET = null; toast('Pengaturan disimpan'); render(); });
  if (id === 'openf') {
    const lines = [...app.querySelectorAll('[data-orow]')].map(r => ({ acc: r.querySelector('[data-oacc]').value, party: r.querySelector('[data-oparty]').value, unit: r.querySelector('[data-ounit]').value, amount: r.querySelector('[data-oamt]').value })).filter(l => l.acc && +l.amount);
    if (!lines.length) return toast('Isi minimal satu saldo', true);
    if (!confirm('Simpan saldo awal per ' + tgl(f.date) + ' ' + f.date.slice(0, 4) + '? Versi sebelumnya (bila ada) akan diganti.')) return;
    act(async () => { const r = await A.rpc('pk_fin_opening_save', { p_date: f.date, p_lines: lines }); toast('Saldo awal tersimpan' + (+r.selisih ? ' · penyeimbang ekuitas ' + rp(r.selisih) : '')); render(); });
  }
  if (id === 'loanf') { f.start_month = f.start_month ? f.start_month + '-01' : ''; if (f.id) f.is_active = !!e.target.querySelector('[name=is_active]')?.checked; act(async () => { await A.rpc('pk_fin_loan_save', { p: f }); LOANS = null; toast('Pinjaman tersimpan'); close(); render(); }); }
  if (id === 'accf') { f.is_cash = f.is_cash === 'true'; f.is_active = !!e.target.querySelector('[name=is_active]')?.checked; act(async () => { await A.rpc('pk_fin_account_save', { p: f }); ACCS = null; toast('Akun tersimpan'); close(); render(); }); }
});
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-loanedit]'); if (!t) return;
  loanForm((LOANS || []).find(x => x.id === t.dataset.loanedit) || {});
});
app.addEventListener('submit', (e) => {
  if (e.target.id !== 'oblf') return; e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)); if (f.end_month) f.end_month += '-01';
  act(async () => { await A.rpc('pk_fin_obligation_save', { p: f }); toast('Kewajiban tersimpan'); render(); });
});
app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-acc],[data-copy],[data-rcp],[data-wasend],[data-csv],[data-plv],[data-j],[data-void],[data-map],[data-retry],[data-ign],[data-bok],[data-bign],[data-key],[data-lock],[data-unlock],[data-print],[data-fw],[data-loan],[data-loanadd],[data-accedit],[data-accnew],[data-oadd],[data-orem],[data-jm]');
  if (!t) return;
  const d = t.dataset;
  if (d.print !== undefined) { window.print(); return; }
  if (d.fw !== undefined) { const r = app.querySelector(`[data-fwl="${d.fw}"]`); if (r) r.hidden = !r.hidden; return; }
  if (d.loan) { loanPanel(d.loan); return; }
  if (d.loanadd !== undefined) { loanForm({}); return; }
  if (d.accedit) { if (!canWrite()) return; accForm(((cur && cur.accs) || []).find(a => a.code === d.accedit), null); return; }
  if (d.accnew) { accForm(null, d.accnew); return; }
  if (d.oadd !== undefined) { app.querySelector('#otbl tbody').insertAdjacentHTML('beforeend', app.querySelector('#orowt').innerHTML); return; }
  if (d.orem !== undefined) { t.closest('tr').remove(); openSum(); return; }
  if (d.jm !== undefined) { journalForm(); return; }
  if (d.go) { location.hash = d.go; return; }
  if (d.acc) { bankPanel(d.acc); return; }
  if (d.rcp) { WA_TO = WA_TO.includes(d.rcp) ? WA_TO.filter(x => x !== d.rcp) : WA_TO.concat(d.rcp); t.classList.toggle('on'); return; }
  if (d.wasend !== undefined) {
    const to = PEOPLE.filter(p => WA_TO && WA_TO.includes(p.id) && ['ceo', 'keuangan'].includes(p.role));
    if (!to.length) return toast('Pilih penerima dulu', true);
    const txt = summaryText(), link = (p) => 'https://wa.me/' + String(p.phone || '').replace(/\D/g, '').replace(/^0/, '62') + '?text=' + encodeURIComponent(txt);
    if (to.length === 1 && to[0].phone) { window.open(link(to[0]), '_blank', 'noopener'); return; }
    panel(`<div class="row between"><h2>Kirim laporan ke WhatsApp</h2><button class="btn sm" data-close>✕</button></div><p class="muted small" style="margin:0">Buka satu per satu, lalu tekan kirim di WhatsApp.</p>
      <div class="list">${to.map(p => `<div class="li">${avatar(p, 34)}<div class="t"><b>${esc(nick(p))}</b><span>${esc(ROLE[p.role])}${p.phone ? ' · ' + esc(p.phone) : ' · nomor belum diisi'}</span></div>${p.phone ? `<a class="btn sm pri" href="${esc(link(p))}" target="_blank" rel="noopener">Buka WhatsApp</a>` : '<span class="pill y">isi di Tim & Peran</span>'}</div>`).join('')}</div>`);
    return;
  }
  if (d.copy !== undefined) { navigator.clipboard.writeText(summaryText()).then(() => toast('Ringkasan disalin. Kirim hanya ke nomor owner & Keuangan, bukan ke grup.')); return; }
  if (d.csv) { csvDl(({ pl: 'laba-rugi-', bs: 'neraca-', cf: 'arus-kas-' }[d.csv] || 'laporan-') + period().to + '.csv', cur.csv()); return; }
  if (d.plv) { S.plv = d.plv; render(); return; }
  if (d.j) { const r = app.querySelector(`[data-jl="${CSS.escape(d.j)}"]`); if (r) r.hidden = !r.hidden; return; }
  if (demoAct()) return;
  if (d.void) { const r = prompt('Alasan membatalkan jurnal ini (jurnal balik akan dibuat):'); if (r) act(async () => { await A.rpc('pk_fin_void', { p_entry: d.void, p_reason: r }); toast('Jurnal balik dibuat'); render(); }); }
  if (d.map) { const s = app.querySelector(`[data-mapacc="${CSS.escape(d.map)}"]`); if (!s.value) return toast('Pilih akun dulu', true); act(async () => { const r = await A.rpc('pk_fin_map_set', { p_key: d.map, p_account: s.value, p_note: null }); toast(r.terposting + ' transaksi dibukukan' + (r.masih_gagal ? ', ' + r.masih_gagal + ' masih gagal' : '')); ACCS = null; render(); }); }
  if (d.retry) act(async () => { const r = await A.rpc('pk_fin_event_retry', { p_id: d.retry }); toast(r === 'terposting' ? 'Berhasil dibukukan' : 'Masih gagal: ' + r, r !== 'terposting'); render(); });
  if (d.ign) { const r = prompt('Alasan diabaikan (wajib):'); if (r) act(async () => { await A.rpc('pk_fin_event_ignore', { p_id: d.ign, p_note: r }); toast('Diabaikan'); render(); }); }
  if (d.bok) { const s = app.querySelector(`[data-bacc="${CSS.escape(d.bok)}"]`), pt = app.querySelector(`[data-bpat="${CSS.escape(d.bok)}"]`); if (!s.value) return toast('Pilih akun lawan', true); act(async () => { await A.rpc('pk_fin_bank_classify', { p_line: d.bok, p_account: s.value, p_unit: d.unit || null, p_pattern: pt.value || null }); toast('Mutasi dibukukan'); render(); }); }
  if (d.bign) { const r = prompt('Alasan mutasi diabaikan (wajib):'); if (r) act(async () => { await A.rpc('pk_fin_bank_ignore', { p_line: d.bign, p_note: r }); toast('Diabaikan'); render(); }); }
  if (d.key) { if (!confirm('Buat kunci API baru? Kunci lama langsung tidak berlaku.')) return; act(async () => { const r = await A.rpc('pk_fin_source_key', { p_code: d.key }); panel(`<h2>Kunci API ${esc(d.key)}</h2><p>${esc(r.note)}</p><code style="word-break:break-all;padding:10px">${esc(r.key)}</code><button class="btn" data-close>Sudah disimpan</button>`); render(); }); }
  if (d.lock) { if (!confirm('Tutup buku ' + bulan(d.lock + '-01') + '? Jurnal baru di bulan itu akan ditolak.')) return; act(async () => { await A.rpc('pk_fin_period_set', { p_month: d.lock + '-01', p_lock: true }); toast('Buku ditutup'); render(); }); }
  if (d.unlock) { if (!confirm('Buka lagi buku ' + bulan(d.unlock + '-01') + '? Laporan bulan itu bisa berubah.')) return; act(async () => { await A.rpc('pk_fin_period_set', { p_month: d.unlock + '-01', p_lock: false }); toast('Buku dibuka lagi'); render(); }); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
window.addEventListener('hashchange', () => { close(); render(); app.focus(); });

async function boot() {
  if (!LOCAL) {
    const [u, pp] = await Promise.all([A.get('pk_units?select=code,name,kind,parent,sort&is_active=eq.true&order=sort').catch(() => null),
      A.get('pk_people?select=id,code,name,nickname,role,title,unit_code,photo,email,phone&is_active=eq.true').catch(() => null)]);
    if (Array.isArray(u) && u.length) UNITS = u; if (Array.isArray(pp)) PEOPLE = pp;
  }
  if (LOCAL && Array.isArray(window.__keuPeople)) PEOPLE = window.__keuPeople; // hanya uji lokal
  shell();
  if (ME && !['ceo', 'kepala_staf', 'keuangan'].includes(ME.role)) { app.innerHTML = `<div class="card"><h1>Khusus CEO, Kepala Staf, dan Keuangan</h1><p class="muted">Modul Keuangan grup tidak dibuka untuk peran Anda. <a href="/">Kembali ke Sistem Kerja</a></p></div>`; return; }
  render();
}
const wait = setInterval(() => {
  const p = window.mkPerson;
  if (p || LOCAL) { clearInterval(wait); ME = p || { role: 'ceo', name: 'uji lokal' }; boot(); }
}, 150);

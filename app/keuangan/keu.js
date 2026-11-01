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

const PAGES = { ringkasan: 'Ringkasan', unit: 'Per unit bisnis', kas: 'Kas & bank', kewajiban: 'Kewajiban & jatuh tempo', rab: 'Belanja (RAB & LPJ)',
  labarugi: 'Laba rugi', neraca: 'Neraca', jurnal: 'Buku jurnal', antrean: 'Antrean Keuangan', sumber: 'Sumber data & tutup buku' };
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
  };
  if (usingDemo()) return demo[name]();
  const call = {
    dash: () => A.rpc('pk_fin_dashboard', { p_from: args.from, p_to: args.to }), pl: () => A.rpc('pk_fin_pl', { p_from: args.from, p_to: args.to }),
    bs: () => A.rpc('pk_fin_balance_sheet', { p_to: args.to }),
    jurnal: () => A.rpc('pk_fin_journal', { p_from: args.from, p_to: args.to, p_biz: args.biz || null, p_source: args.source || null, p_q: args.q || null, p_acc: null, p_limit: 300 }),
    exc: () => A.rpc('pk_fin_exceptions'), bank: () => A.rpc('pk_fin_bank_list', { p_account: args.acc, p_limit: 300 }),
    accs: () => A.get('pk_fin_accounts?select=code,name,grp,is_cash,unit_code,pos&is_active=eq.true&order=code'),
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
  const p = period(), Dd = await data('dash', p), g = digest(Dd), h = Dd.health, dec = decisions(Dd, g);
  setBadges(Dd, g);
  const gm = ratio(g.G.rev - g.G.hpp, g.G.rev), nm = ratio(g.G.net, g.G.rev);
  cur = { Dd, g, dec };
  let o = waShare('Keuangan grup') + header('Keuangan grup', 'Satu buku untuk Rentalaja, TripinAja, Niagaaja, dan Holding. Urutan baca: kas → profit → eksekusi → pertumbuhan.');
  o += sec('Perlu ditindak', dec.length ? dec.length + ' hal · diurutkan kas → profit → eksekusi → data' : '', dec.length ? `<div class="alerts">${dec.slice(0, 10).map(alertHtml).join('')}</div>` : '<div class="ok">Tidak ada yang perlu diputuskan hari ini.</div>');
  o += `<div class="tiles">
    ${tile('Kas & bank', rpk(h.cash), `${g.cash.length} rekening${g.diffAcc.length ? ' · ' + g.diffAcc.length + ' selisih bank' : ' · cocok dengan bank'}`, '', '#kas')}
    ${tile('Runway', h.runway == null ? '—' : String(h.runway).replace('.', ',') + ' bln', 'biaya ' + rpk(h.burn) + '/bln (rata² 3 bln)', h.runway != null && h.runway < 3 ? 'bad' : h.runway < 6 ? 'warn' : '', '#kas')}
    ${tile('Kewajiban 30 hari', rpk(g.oblSum), `${g.obl.length} tagihan · ${g.obl7.length} dalam 7 hari`, g.obl7Sum > g.kewajibanCash ? 'bad' : '', '#kewajiban')}
    ${tile('Omzet grup', rpk(g.G.rev), delta(g.G.rev, g.Gp.rev) + ' vs periode lalu ' + rpk(g.Gp.rev))}
    ${tile('Laba bersih grup', rpS(g.G.net), 'margin ' + pct(nm) + ' · ' + delta(g.G.net, g.Gp.net), g.G.net < 0 ? 'bad' : '', '#labarugi')}
    ${tile('Margin kotor', pct(gm), 'laba kotor ' + rpk(g.G.rev - g.G.hpp) + ' · HPP ' + rpk(g.G.hpp), gm != null && gm < 40 ? 'warn' : '')}
    ${tile('DP pelanggan', rpk(g.bal('2-20200')), 'titipan, belum jadi pendapatan', 'mute', '#neraca')}
    ${tile('Piutang usaha', rpk(g.bal('1-10100')), 'kasbon staf ' + rpk(g.bal('1-10101')), g.bal('1-10100') > h.burn * .2 ? 'warn' : '', '#neraca')}
    ${tile('Biaya holding', rpk(g.hq), pct(ratio(g.hq, sum(g.rows, r => r.cur.rev))) + ' dari omzet unit · dibagi ke unit', ratio(g.hq, sum(g.rows, r => r.cur.rev)) > 20 ? 'warn' : '', '#unit/HQ')}
    ${tile('Hutang leasing', rpk(g.bal('2-21000')), 'cicilan ' + rpk(Dd.obligations_month) + '/bln semua kewajiban rutin', 'mute', '#kewajiban')}
    ${tile('Belanja berjalan', (g.rab.menunggu + g.rab.siap) + ' pengajuan', rpk(g.rab.menunggu_rp + g.rab.siap_rp) + ' · ' + g.rab.telat + ' LPJ telat', g.rab.telat ? 'warn' : '', '#rab')}
    ${tile('Pembukuan otomatis', h.auto == null ? '—' : h.auto + '%', (h.entries || 0).toLocaleString('id-ID') + ' jurnal · antrean ' + g.excN, g.excN ? 'warn' : '', '#antrean')}</div>`;

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
  let o = header('Kewajiban & jatuh tempo', 'Tagihan rutin 30 hari ke depan dibandingkan dengan dana di rekening pos Kewajiban. Saldo hutang dari neraca.');
  let left = g.kewajibanCash;
  const L = g.obl.map(x => { left -= x.amount; return { ...x, left }; });
  const liab = ['2-20100', '2-20200', '2-20300', '2-20400', '2-20500', '2-20600', '2-21000', '2-21100', '2-21200'].map(k => ({ k, ...(Dd.balances[k] || { name: X.ACC[k], bal: 0 }) }));
  o += `<div class="tiles">${tile('Tagihan 30 hari', rpk(g.oblSum), g.obl.length + ' tagihan')}${tile('Dalam 7 hari', rpk(g.obl7Sum), g.obl7.length + ' tagihan', g.obl7Sum > g.kewajibanCash ? 'bad' : '')}
    ${tile('Dana pos Kewajiban', rpk(g.kewajibanCash), 'rekening pajak, cicilan, bagi hasil')}${tile(g.kewajibanCash >= g.oblSum ? 'Sisa setelah 30 hari' : 'Kurang untuk 30 hari', rpS(g.kewajibanCash - g.oblSum), 'perlu dipindah dari penerimaan', g.kewajibanCash < g.oblSum ? 'bad' : '')}
    ${tile('Kewajiban rutin / bulan', rpk(Dd.obligations_month), pct(ratio(Dd.obligations_month, sum(g.rows, r => r.cur.rev))) + ' dari omzet unit')}${tile('Total hutang', rpk(sum(liab.filter(x => x.k !== '2-20200'), x => x.bal)), 'di luar DP pelanggan')}</div>`;
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
  let o = header('Laba rugi', 'Dari satu buku grup. Pendapatan Rentalaja diakui saat serah-terima; DP masih titipan. Klik tombol untuk melihat per lini.', `<button class="btn" data-csv="pl">Unduh CSV</button>`);
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
  let o = header('Neraca', 'Posisi per tanggal akhir periode. Laba berjalan = laba bersih sejak awal buku sampai tanggal ini.', `<button class="btn" data-csv="bs">Unduh CSV</button>`);
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
    <input class="inp" data-f="jq" value="${esc(S.jq)}" placeholder="Cari memo / kode / booking" style="width:200px">`;
  let o = header('Buku jurnal', 'Semua jurnal grup. Hampir semuanya otomatis dari sumber data; koreksi lewat jurnal balik, tidak ada jurnal yang diubah atau dihapus.', f);
  const by = {}; L.forEach(j => { by[j.source] = (by[j.source] || 0) + 1; });
  o += `<div class="tiles">${tile('Jurnal tampil', L.length, 'maks 300 terbaru')}${tile('Nilai', rpk(sum(L, j => j.total)), 'jumlah debit')}${Object.entries(by).slice(0, 4).map(([k, n]) => tile(SRC[k] || k, n, pct(n / L.length * 100) + ' dari jurnal', k === 'manual' ? 'warn' : '')).join('')}</div>`;
  o += sec('Jurnal', 'klik untuk lihat baris', `<div class="scroll"><table class="ftbl compact"><thead><tr><th>Tanggal</th><th>Kode</th><th>Sumber</th><th>Unit</th><th>Keterangan</th><th class="r">Nilai</th></tr></thead><tbody>${L.map(j => `<tr class="click" data-j="${esc(j.id)}"><td>${tgl(j.date)}</td><td><code>${esc(j.code)}</code></td><td><span class="pill ${j.source === 'manual' ? 'y' : j.source === 'bank' ? 'b' : ''}">${esc(SRC[j.source] || j.source)}</span></td><td>${dot(bizOf(j.unit))}${esc(uname(j.unit))}</td><td>${esc(j.memo || '')}${j.status === 'void' ? ' <span class="pill r">batal</span>' : ''}</td><td class="r">${rp(j.total)}</td></tr>
    <tr data-jl="${esc(j.id)}" hidden><td></td><td colspan="5"><div class="jl"><table class="ftbl compact"><tbody>${(j.lines || []).map(l => `<tr><td>${esc(l.acc)} · ${esc(l.name)}</td><td>${esc(uname(l.unit))}</td><td class="r">${+l.d ? rp(l.d) : ''}</td><td class="r">${+l.c ? rp(l.c) : ''}</td></tr>`).join('')}</tbody></table>
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
};
const svg = (k, s = 18) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const NAV = [
  ['Grup', [['ringkasan', 'Ringkasan', 'grid'], ['unit', 'Per unit bisnis', 'trophy'], ['kas', 'Kas & bank', 'wallet', 'mutasi'], ['kewajiban', 'Kewajiban', 'clock', 'due'], ['rab', 'Belanja RAB & LPJ', 'inbox', 'lpj']]],
  ['Laporan', [['labarugi', 'Laba rugi', 'coin'], ['neraca', 'Neraca', 'layers'], ['jurnal', 'Buku jurnal', 'book']]],
  ['Kelola', [['antrean', 'Antrean Keuangan', 'check', 'antrean'], ['sumber', 'Sumber & tutup buku', 'cog']]],
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
function panel(html, after) { close(); const el = document.createElement('div'); el.className = 'scrim'; el.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(el); el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) close(); }); if (after) after(el.querySelector('.panel')); }
function close() { document.querySelectorAll('.scrim').forEach(s => s.remove()); }
const VIEWS = { menu: vMenu, ringkasan: vRingkasan, unit: vUnit, kas: vKas, kewajiban: vKewajiban, rab: vRab, labarugi: vLabaRugi, neraca: vNeraca, jurnal: vJurnal, antrean: vAntrean, sumber: vSumber };
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
  if (t.hasAttribute('data-demo')) { S.demo = t.checked; ls('keu.demo', t.checked ? '1' : null); render(); }
});
app.addEventListener('submit', (e) => {
  if (e.target.id !== 'oblf') return; e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)); if (f.end_month) f.end_month += '-01';
  act(async () => { await A.rpc('pk_fin_obligation_save', { p: f }); toast('Kewajiban tersimpan'); render(); });
});
app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-acc],[data-copy],[data-rcp],[data-wasend],[data-csv],[data-plv],[data-j],[data-void],[data-map],[data-retry],[data-ign],[data-bok],[data-bign],[data-key],[data-lock],[data-unlock]');
  if (!t) return;
  const d = t.dataset;
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
  if (d.csv) { csvDl((d.csv === 'pl' ? 'laba-rugi-' : 'neraca-') + period().to + '.csv', cur.csv()); return; }
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

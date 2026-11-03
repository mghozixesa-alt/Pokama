/* Buku Keuangan Pokama — app.pokama.org/buku
   Pencatatan harian tim Keuangan dengan tampilan ala Kledo: Biaya, Kas & Bank, Daftar Akun, Buku Besar.
   Semua dokumen membukukan jurnal lewat pk_fin_post (supabase/042_buku_biaya_kas.sql),
   jadi Laba Rugi, Neraca, dan laporan lain di /keuangan langsung ikut berubah. */
import { makeSession, api, esc, toast } from '/mitra/af.js';

const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const A = LOCAL && window.__bukuMock ? window.__bukuMock : api(makeSession('pokama.session'));
const app = document.getElementById('app');
let ME = null, UNITS = [], ACCS = null, seq = 0;

/* ---------- pembantu ---------- */
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D = (s) => new Date(s + 'T00:00:00');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tgl = (s) => { if (!s) return '—'; const d = D(String(s).slice(0, 10)); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
const num = (n) => { n = Math.round(+n || 0); return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('id-ID'); };
const rp = (n) => (+n < 0 ? '−' : '') + 'Rp' + Math.abs(Math.round(+n || 0)).toLocaleString('id-ID');
const parseNum = (s) => +String(s || '').replace(/[^\d]/g, '') || 0;
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } };
const canWrite = () => !!ME && ['ceo', 'keuangan'].includes(ME.role);
const uname = (c) => (UNITS.find(u => u.code === c) || {}).name || c || '—';
const bizOf = (c) => { const u = UNITS.find(x => x.code === c); return !u ? c : (u.parent || u.code); };
const LOGO = { HQ: '/img/pk.png', RA: '/img/ra.png', WG: '/img/tr.png', NA: '/img/na.png' };
const BIZN = { HQ: 'Holding', RA: 'Rentalaja', WG: 'TripinAja', NA: 'Niagaaja' };
const GRP = { aset: 'Aset', kewajiban: 'Kewajiban', ekuitas: 'Ekuitas', pendapatan: 'Pendapatan', hpp: 'Harga pokok penjualan', beban: 'Beban operasional', pendapatan_lain: 'Pendapatan lain', beban_lain: 'Beban lain' };
const STL = { lunas: 'Lunas', belum: 'Belum dibayar', telat: 'Jatuh tempo', batal: 'Batal' };
const pill = (s) => `<span class="pill p-${s}">${STL[s] || s}</span>`;
const SRC = { biaya: 'Biaya', kasbank: 'Kas & Bank', manual: 'Penyesuaian', pokama: 'Sistem Kerja', rentalaja: 'Rentalaja App', tripinaja: 'TripinAja', niagaaja: 'Niagaaja', bank: 'Mutasi bank' };

/* periode */
const S = { per: ls('buku.per') || 'bulan', st: '', q: '' };
function range(per = S.per) {
  const t = D(today());
  if (per === 'lalu') { const f = new Date(t.getFullYear(), t.getMonth() - 1, 1); return [ymd(f), ymd(new Date(t.getFullYear(), t.getMonth(), 0))]; }
  if (per === '3bln') return [ymd(new Date(t.getFullYear(), t.getMonth() - 2, 1)), today()];
  if (per === 'tahun') return [t.getFullYear() + '-01-01', today()];
  if (per === 'semua') return ['2024-01-01', today()];
  return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), today()];
}
const PER = [['bulan', 'Bulan ini'], ['lalu', 'Bulan lalu'], ['3bln', '3 bulan terakhir'], ['tahun', 'Tahun ini'], ['semua', 'Semua']];
const perSel = () => `<select class="inp" data-per aria-label="Periode">${PER.map(([k, l]) => `<option value="${k}"${k === S.per ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

/* ---------- ikon ---------- */
const I = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  jual: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>', beli: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l3 12h11l2-8H6"/>',
  biaya: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>', bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>',
  stok: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>', aset: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  akun: '<path d="M4 6h16M4 12h16M4 18h10"/>', lap: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', jurnal: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 13h2M2 10h20"/>',
  kas: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', pl: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  bs: '<path d="M12 3v18M5 7h14M3 13l2-6 2 6a2 2 0 0 1-4 0zM17 13l2-6 2 6a2 2 0 0 1-4 0z"/>', cash: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
};
const svg = (k, s = 18) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

/* ---------- data ---------- */
async function accounts() { if (!ACCS) ACCS = await A.get('pk_fin_accounts?select=code,name,grp,is_cash,unit_code,pos,bank&is_active=eq.true&order=code'); return ACCS; }
const cashAccs = async () => (await accounts()).filter(a => a.is_cash);
function accOpts(list, sel, blank = 'Pilih akun') {
  const by = {}; for (const a of list) (by[a.grp] = by[a.grp] || []).push(a);
  return `<option value="">${blank}</option>` + Object.keys(GRP).filter(g => by[g]).map(g => `<optgroup label="${GRP[g]}">${by[g].map(a => `<option value="${a.code}"${a.code === sel ? ' selected' : ''}>${a.code} · ${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
}
function unitOpts(sel) {
  const tops = UNITS.filter(u => !u.parent);
  return tops.map(t => `<optgroup label="${esc(t.name)}"><option value="${t.code}"${t.code === sel ? ' selected' : ''}>${esc(t.name)} (umum)</option>${UNITS.filter(u => u.parent === t.code).map(u => `<option value="${u.code}"${u.code === sel ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</optgroup>`).join('');
}
function cashOpts(list, sel, blank) {
  const by = {}; for (const a of list) { const b = bizOf(a.unit_code) || 'RA'; (by[b] = by[b] || []).push(a); }
  return (blank ? `<option value="">${blank}</option>` : '') + Object.keys(by).map(b => `<optgroup label="${BIZN[b] || b}">${by[b].map(a => `<option value="${a.code}"${a.code === sel ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
}

/* ---------- kerangka ---------- */
const NAV = [
  ['dasbor', 'Dasbor', 'dash'], ['jual', 'Penjualan', 'jual', 'soon'], ['beli', 'Pembelian', 'beli', 'soon'], ['biaya', 'Biaya', 'biaya'],
  ['kas', 'Kas & Bank', 'bank'], ['stok', 'Produk & Stok', 'stok', 'soon'], ['aset', 'Aset Tetap', 'aset', 'soon'], ['akun', 'Daftar Akun', 'akun'],
];
const REPORTS = [['/keuangan#labarugi', 'Laba Rugi'], ['/keuangan#neraca', 'Neraca'], ['/keuangan#aruskas', 'Arus Kas'], ['#bukubesar', 'Buku Besar'], ['/keuangan#jurnal', 'Jurnal Umum']];
function shell() {
  const ini = (ME && (ME.code || (ME.nickname || ME.name || '?').slice(0, 2))) || '?';
  document.getElementById('top').innerHTML = `
    <button class="btn sm menu-b" type="button" data-menu aria-label="Menu">${svg('menu')}</button>
    <a class="brand" href="#dasbor"><img src="/img/pokama-logo.png" alt="Pokama"></a>
    <a class="qa" aria-disabled="true" title="Segera">${'<span class="plus">+</span>'} Jual</a>
    <a class="qa" aria-disabled="true" title="Segera"><span class="plus">+</span> Beli</a>
    <a class="qa" href="#biaya/baru"><span class="plus">+</span> Biaya</a>
    <span class="sp"></span>
    <a class="back" href="/keuangan">Panel Keuangan</a>
    <a class="back" href="/">‹ Sistem Kerja</a>
    <span class="co">PT Popo Karya Investama</span>
    <span class="me" title="${esc(ME ? ME.name : '')}">${ME && ME.photo ? `<img src="${esc(ME.photo)}" alt="">` : esc(String(ini).toUpperCase())}</span>`;
  document.getElementById('side').innerHTML = `<nav aria-label="Menu keuangan">
    ${NAV.map(([k, l, ic, soon]) => soon ? `<a aria-disabled="true">${svg(ic)}${l}<span class="soon">segera</span></a>`
      : `<a href="#${k}" data-nav="${k}">${svg(ic)}<span>${l}</span>${k === 'biaya' ? '<span class="nb" data-nb hidden></span>' : ''}</a>`).join('')}
    <details class="grp" open><summary>${svg('lap')}Laporan</summary><div class="sub">${REPORTS.map(([h, l]) => `<a href="${h}"${h[0] === '#' ? ` data-nav="${h.slice(1)}"` : ''}>${l}</a>`).join('')}<a href="#laporan" data-nav="laporan">Semua laporan</a></div></details>
    <hr><a href="/keuangan#saldo">${svg('gear')}Saldo awal & pengaturan</a></nav>`;
  document.getElementById('bottom').innerHTML = [['dasbor', 'Dasbor', 'dash'], ['biaya', 'Biaya', 'biaya'], ['biaya/baru', 'Catat', 'plus', 'add'], ['kas', 'Kas', 'bank'], ['akun', 'Akun', 'akun']]
    .map(([k, l, ic, c]) => `<a href="#${k}" data-nav="${k}"${c ? ' class="add"' : ''}>${c ? `<span class="dot">${svg(ic, 22)}</span>` : svg(ic, 22)}${l}</a>`).join('');
}
function markNav(v) {
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.getElementById('side').classList.remove('open');
}
const header = (title, right = '', crumb = '') => `<div class="ph">${crumb ? `<div class="crumb">${crumb}</div>` : ''}<h1>${title}</h1><span class="sp"></span>${right}</div>`;

/* ---------- Dasbor ---------- */
async function vDasbor() {
  const [f, t] = range('bulan');
  const [cs, ex] = await Promise.all([A.rpc('pk_fin_cash_summary', { p_from: f, p_to: t }), A.rpc('pk_fin_expense_list', { p_from: range('3bln')[0], p_to: t })]);
  const cash = sum(cs, a => a.bal), inn = sum(cs, a => a.in), out = sum(cs, a => a.out), s = ex.sum;
  const top = [...cs].sort((a, b) => Math.abs(b.bal) - Math.abs(a.bal)).slice(0, 8);
  const recent = ex.rows.slice(0, 8);
  setBadge(s.n_belum);
  return header('Dasbor', `<a class="btn pri" href="#biaya/baru">${svg('plus', 16)} Catat biaya</a>`) + `
    <div class="grid g4">
      <a class="sum t" href="#kas"><span>Total kas & bank</span><b>${rp(cash)}</b><small>${cs.length} rekening</small></a>
      <div class="sum"><span>Uang masuk bulan ini</span><b>${rp(inn)}</b><small>semua rekening</small></div>
      <div class="sum a"><span>Uang keluar bulan ini</span><b>${rp(out)}</b><small>semua rekening</small></div>
      <a class="sum r" href="#biaya" data-st="belum"><span>Biaya belum dibayar</span><b>${rp(s.belum)}</b><small>${s.n_belum} tagihan${s.n_telat ? ` · <span class="neg b">${s.n_telat} lewat jatuh tempo</span>` : ''}</small></a>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <section class="card pad"><h2>Saldo rekening</h2>${top.length ? `<table class="tbl"><tbody>${top.map(a => `<tr class="go" data-href="#kas/${a.code}"><td>${esc(a.name)}<div class="small mute">${esc(uname(a.unit) )}</div></td><td class="r b${a.bal < 0 ? ' neg' : ''}">${rp(a.bal)}</td></tr>`).join('')}</tbody></table>` : '<p class="mute">Belum ada rekening.</p>'}
        <p style="margin:10px 0 0"><a class="lnk" href="#kas">Lihat semua rekening ›</a></p></section>
      <section class="card pad"><h2>Biaya terakhir</h2>${recent.length ? `<table class="tbl"><tbody>${recent.map(r => `<tr class="go" data-href="#biaya/${r.id}"><td><b>${esc(r.party || r.accs || r.code)}</b><div class="small mute">${tgl(r.date)} · ${esc(r.code)}</div></td><td class="r">${rp(r.total)}<div>${pill(r.status)}</div></td></tr>`).join('')}</tbody></table>` : '<p class="mute">Belum ada biaya dicatat. Mulai dari tombol <b>+ Biaya</b> di atas.</p>'}
        <p style="margin:10px 0 0"><a class="lnk" href="#biaya">Lihat semua biaya ›</a></p></section>
    </div>`;
}

/* ---------- Biaya: daftar ---------- */
async function vBiaya() {
  const [f, t] = range();
  const r = await A.rpc('pk_fin_expense_list', { p_from: f, p_to: t, p_status: S.st || null, p_q: S.q || null, p_unit: null });
  const s = r.sum, rows = r.rows; setBadge(s.n_belum);
  const tabs = [['', 'Semua'], ['belum', 'Belum dibayar', s.n_belum], ['telat', 'Jatuh tempo', s.n_telat], ['lunas', 'Lunas'], ['batal', 'Batal']];
  return header('Biaya', `<button class="btn" type="button" data-csv>Ekspor CSV</button>${canWrite() ? `<a class="btn pri" href="#biaya/baru">${svg('plus', 16)} Buat biaya</a>` : ''}`) + `
    <div class="grid g3">
      <div class="sum"><span>Total biaya bulan ini</span><b>${rp(s.bulan)}</b><small>tidak termasuk yang batal</small></div>
      <a class="sum a" href="#biaya" data-st="belum"><span>Belum dibayar</span><b>${rp(s.belum)}</b><small>${s.n_belum} tagihan</small></a>
      <a class="sum r" href="#biaya" data-st="telat"><span>Lewat jatuh tempo</span><b>${rp(s.telat)}</b><small>${s.n_telat} tagihan</small></a>
    </div>
    <nav class="tabs" aria-label="Status">${tabs.map(([k, l, c]) => `<a href="#biaya" data-st="${k}" aria-current="${S.st === k}">${l}${c ? `<span class="c">${c}</span>` : ''}</a>`).join('')}</nav>
    <div class="tools"><input class="inp search" type="search" data-q placeholder="Cari nomor, penerima, keterangan" value="${esc(S.q)}">${perSel()}<span class="sp"></span><span class="small mute">${rows.length} biaya · ${rp(sum(rows, x => x.status === 'batal' ? 0 : x.total))}</span></div>
    <div class="tw">${rows.length ? `<table class="tbl cards"><thead><tr><th>Tanggal</th><th>Nomor</th><th>Penerima</th><th>Kategori</th><th>Unit</th><th>Status</th><th class="r">Sisa tagihan</th><th class="r">Total</th></tr></thead><tbody>
      ${rows.map(x => `<tr class="go" data-href="#biaya/${x.id}"><td data-m="hide">${tgl(x.date)}</td><td><a class="code" href="#biaya/${x.id}">${esc(x.code)}</a><span class="small mute" style="display:none"></span></td>
        <td data-m="full"><b>${esc(x.party || '—')}</b>${x.memo ? `<div class="small mute">${esc(x.memo)}</div>` : ''}</td><td data-m="hide">${esc(x.accs || '')}</td><td data-m="hide">${esc(uname(x.unit))}</td>
        <td>${pill(x.status)}</td><td class="r" data-m="hide">${x.owe > 0 ? rp(x.owe) : '—'}</td><td class="r b" data-m="right">${rp(x.total)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="6">Jumlah</td><td class="r">${rp(sum(rows, x => x.owe))}</td><td class="r">${rp(sum(rows, x => x.status === 'batal' ? 0 : x.total))}</td></tr></tfoot></table>`
      : `<div class="empty">Tidak ada biaya pada periode & filter ini.${canWrite() ? ' <a class="lnk" href="#biaya/baru">Catat biaya pertama</a>' : ''}</div>`}</div>`;
}

/* ---------- Biaya: formulir ---------- */
let ASSET_CACHE = {};
function lineRow(l = {}, AC) {
  return `<tr><td class="acc-c" style="min-width:230px"><select class="inp" data-l="acc" aria-label="Akun biaya">${accOpts(AC, l.acc, 'Pilih akun biaya')}</select></td>
    <td class="memo-c"><input class="inp" data-l="memo" placeholder="Deskripsi" value="${esc(l.memo || '')}" aria-label="Deskripsi"></td>
    <td style="min-width:140px"><select class="inp" data-l="unit" aria-label="Unit bisnis">${'<option value="">Ikut dokumen</option>' + unitOpts(l.unit)}</select></td>
    <td style="min-width:170px"><input class="inp" data-l="asset" list="assetList" placeholder="Unit aset (opsional)" value="${esc(l.asset_label || '')}" aria-label="Unit aset"></td>
    <td class="amt-c" style="min-width:140px"><input class="inp num" data-l="amount" inputmode="numeric" placeholder="0" value="${l.amount ? num(l.amount) : ''}" aria-label="Jumlah"></td>
    <td class="del-c"><button class="del" type="button" data-delrow aria-label="Hapus baris">×</button></td></tr>`;
}
async function vBiayaBaru() {
  if (!canWrite()) return header('Buat biaya') + '<div class="banner">Hanya Keuangan dan CEO yang bisa mencatat biaya.</div>';
  const AC = (await accounts()).filter(a => !a.is_cash && ['beban', 'hpp', 'beban_lain', 'aset'].includes(a.grp) && !a.code.startsWith('1-107'));
  const CA = await cashAccs(), d = today(), last = ls('buku.payacc') || '';
  return header('Buat biaya', '', '<a href="#biaya">Biaya</a> › Baru') + `
    <form class="doc" id="fBiaya" autocomplete="off">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <label class="sw"><input type="checkbox" name="later"> Bayar nanti (masuk hutang usaha)</label>
        <span class="small mute">Nomor dibuat otomatis (BY…)</span>
      </div>
      <div class="fg">
        <label class="w2"><span class="req">Penerima / vendor</span><input class="inp" name="party" list="partyList" placeholder="Nama bengkel, toko, orang" maxlength="120"></label>
        <label data-pay><span class="req">Bayar dari</span><select class="inp" name="pay_acc">${cashOpts(CA, last, 'Pilih kas / bank')}</select></label>
        <label><span class="req">Tanggal transaksi</span><input class="inp" type="date" name="date" value="${d}" max="${d}"></label>
        <label data-due hidden><span>Jatuh tempo</span><input class="inp" type="date" name="due"></label>
        <label><span class="req">Unit bisnis</span><select class="inp" name="unit">${unitOpts(ls('buku.unit') || 'GK')}</select></label>
        <label><span>No. nota / referensi</span><input class="inp" name="ref_no" maxlength="60"></label>
        <label class="w2"><span>Link bukti (foto nota / Drive)</span><input class="inp" name="proof_url" type="url" placeholder="https://"></label>
      </div>
      <div class="lines"><div class="tw"><table class="tbl"><thead><tr><th>Akun biaya</th><th>Deskripsi</th><th>Unit bisnis</th><th>Unit aset</th><th class="r">Jumlah</th><th></th></tr></thead>
        <tbody id="lines">${lineRow({}, AC)}</tbody></table></div>
        <button class="lnk" type="button" data-addrow style="margin-top:10px">+ Tambah baris</button>
        <datalist id="assetList"></datalist><datalist id="partyList"></datalist>
      </div>
      <div class="grid g2" style="align-items:start">
        <label class="fld" style="margin-top:14px">Keterangan<textarea class="inp" name="memo" rows="3" maxlength="400" placeholder="Contoh: servis rutin motor Garut minggu ke-1"></textarea></label>
        <div class="totals">
          <div><span>Subtotal</span><b data-sub>Rp0</b></div>
          <div><span>Potongan PPh (opsional)</span><input class="inp num" name="tax" inputmode="numeric" placeholder="0" style="width:150px"></div>
          <div class="grand"><span>Total dibayar</span><span data-tot>Rp0</span></div>
        </div>
      </div>
      <div class="foot"><a class="btn" href="#biaya">Batal</a><button class="btn pri" type="submit">Simpan biaya</button></div>
    </form>`;
}
function wireBiayaForm() {
  const f = document.getElementById('fBiaya'); if (!f) return;
  const calc = () => {
    const sub = sum([...f.querySelectorAll('[data-l="amount"]')], i => parseNum(i.value)), tax = parseNum(f.tax.value);
    f.querySelector('[data-sub]').textContent = rp(sub); f.querySelector('[data-tot]').textContent = rp(sub - tax);
  };
  const fmt = (i) => { const p = i.selectionStart, l = i.value.length; const n = parseNum(i.value); i.value = n ? num(n) : ''; const q = Math.max(0, p + i.value.length - l); i.setSelectionRange(q, q); };
  f.addEventListener('input', (e) => {
    if (e.target.matches('.num')) { fmt(e.target); calc(); }
    if (e.target.dataset.l === 'asset') assetSearch(e.target.value);
  });
  f.later.addEventListener('change', () => { f.querySelector('[data-pay]').hidden = f.later.checked; f.querySelector('[data-due]').hidden = !f.later.checked; if (f.later.checked && !f.due.value) { const d = D(f.date.value || today()); d.setDate(d.getDate() + 30); f.due.value = ymd(d); } });
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-addrow]')) { const AC = (await accounts()).filter(a => !a.is_cash && ['beban', 'hpp', 'beban_lain', 'aset'].includes(a.grp) && !a.code.startsWith('1-107')); document.getElementById('lines').insertAdjacentHTML('beforeend', lineRow({}, AC)); }
    if (e.target.closest('[data-delrow]')) { const rows = f.querySelectorAll('#lines tr'); if (rows.length > 1) e.target.closest('tr').remove(); calc(); }
  });
  partyHints();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lines = [...f.querySelectorAll('#lines tr')].map(tr => {
      const g = (k) => tr.querySelector(`[data-l="${k}"]`).value.trim();
      return { acc: g('acc'), memo: g('memo'), unit: g('unit'), asset: ASSET_CACHE[g('asset')] || null, amount: parseNum(g('amount')), _asset: g('asset') };
    }).filter(l => l.amount || l.acc);
    if (!f.party.value.trim()) return toast('Isi penerima / vendor', true);
    if (!f.later.checked && !f.pay_acc.value) return toast('Pilih rekening pembayaran, atau nyalakan "Bayar nanti"', true);
    if (!lines.length || lines.some(l => !l.acc || !l.amount)) return toast('Setiap baris perlu akun dan jumlah', true);
    if (lines.some(l => l._asset && !l.asset)) return toast('Unit aset harus dipilih dari daftar (ketik nomor aset atau plat)', true);
    const p = { date: f.date.value, due: f.later.checked ? f.due.value : null, unit: f.unit.value, party: f.party.value, memo: f.memo.value, ref_no: f.ref_no.value,
      pay_acc: f.later.checked ? null : f.pay_acc.value, tax: parseNum(f.tax.value), proof_url: f.proof_url.value, lines: lines.map(({ _asset, ...l }) => l) };
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    try {
      const r = await A.rpc('pk_fin_expense_save', { p });
      ls('buku.unit', f.unit.value); if (p.pay_acc) ls('buku.payacc', p.pay_acc);
      toast('Biaya ' + r.code + ' tersimpan dan sudah dibukukan'); location.hash = '#biaya/' + r.id;
    } catch (err) { toast(err.message, true); b.disabled = false; }
  });
}
let aTimer = null;
function assetSearch(q) {
  clearTimeout(aTimer);
  if (!q || q.length < 2 || ASSET_CACHE[q]) return;
  aTimer = setTimeout(async () => {
    try {
      const rows = await A.rpc('pk_fin_asset_pick', { p_q: q });
      for (const r of rows) ASSET_CACHE[r.label] = r.id;
      const dl = document.getElementById('assetList'); if (dl) dl.innerHTML = rows.map(r => `<option value="${esc(r.label)}"></option>`).join('');
    } catch (e) { /* abaikan */ }
  }, 250);
}
async function partyHints() {
  try {
    const r = await A.rpc('pk_fin_expense_list', { p_from: range('semua')[0], p_to: today(), p_status: null, p_q: null, p_unit: null });
    const names = [...new Set(r.rows.map(x => x.party).filter(Boolean))].slice(0, 200);
    const dl = document.getElementById('partyList'); if (dl) dl.innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
  } catch (e) { /* abaikan */ }
}

/* ---------- Biaya: detail ---------- */
async function vBiayaDetail(id) {
  const e = await A.rpc('pk_fin_expense_get', { p_id: id });
  const st = e.status === 'belum' && e.due_date && e.due_date < today() ? 'telat' : e.status, owe = e.status === 'batal' ? 0 : e.total - e.tax - e.paid;
  const acts = canWrite() && e.status !== 'batal' ? `${owe > 0 ? `<button class="btn teal" type="button" data-pay>Bayar</button>` : ''}<button class="btn dng" type="button" data-void>Batalkan</button>` : '';
  return header(`Biaya ${esc(e.code)} ${pill(st)}`, `<button class="btn" type="button" onclick="print()">Cetak</button>${acts}`, '<a href="#biaya">Biaya</a> › ' + esc(e.code)) + `
    <div class="doc">
      ${e.status === 'batal' ? `<div class="banner">Dibatalkan: ${esc(e.void_reason || '')}. Jurnalnya sudah dibalik.</div>` : ''}
      <div class="dhead">
        <div><span>Penerima</span><b>${esc(e.party || '—')}</b></div>
        <div><span>Tanggal</span><b>${tgl(e.doc_date)}</b></div>
        ${e.due_date ? `<div><span>Jatuh tempo</span><b${st === 'telat' ? ' class="neg"' : ''}>${tgl(e.due_date)}</b></div>` : ''}
        <div><span>Dibayar dari</span><b>${esc(e.pay_name || (e.status === 'belum' ? 'Belum dibayar (hutang usaha)' : '—'))}</b></div>
        <div><span>Unit bisnis</span><b>${esc(uname(e.unit_code))}</b></div>
        ${e.ref_no ? `<div><span>No. referensi</span><b>${esc(e.ref_no)}</b></div>` : ''}
        ${e.proof_url ? `<div><span>Bukti</span><b><a href="${esc(e.proof_url)}" target="_blank" rel="noopener">Buka bukti ›</a></b></div>` : ''}
      </div>
      ${e.memo ? `<p style="margin:0 0 14px">${esc(e.memo)}</p>` : ''}
      <div class="tw"><table class="tbl cards"><thead><tr><th>Akun</th><th>Deskripsi</th><th>Unit</th><th>Unit aset</th><th class="r">Jumlah</th></tr></thead><tbody>
        ${e.lines.map(l => `<tr><td data-m="full"><b>${esc(l.acc)}</b> ${esc(l.name || '')}</td><td>${esc(l.memo || '—')}</td><td data-m="hide">${esc(uname(l.unit))}</td><td data-m="hide">${l.asset_no ? esc(l.asset_no + ' · ' + l.asset_name) : '—'}</td><td class="r b" data-m="right">${rp(l.amount)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="totals">
        <div><span>Subtotal</span><b>${rp(e.total)}</b></div>
        ${+e.tax ? `<div><span>Potongan PPh</span><b>−${rp(e.tax)}</b></div>` : ''}
        <div><span>Sudah dibayar</span><b>${rp(e.paid)}</b></div>
        <div class="grand"><span>Sisa tagihan</span><span${owe > 0 ? ' class="neg"' : ''}>${rp(owe)}</span></div>
      </div>
    </div>
    <section class="card pad" style="margin-top:14px"><h2>Jurnal</h2><p class="small mute" style="margin:-6px 0 4px">Dibukukan otomatis. Laba Rugi & Neraca di Panel Keuangan langsung ikut.</p>
      ${e.journal.map(j => `<div class="jr"><div class="small"><b>${esc(j.code)}</b> · ${tgl(j.date)} · ${esc(j.memo)}</div>
        <table class="tbl"><thead><tr><th>Akun</th><th class="r">Debit</th><th class="r">Kredit</th></tr></thead><tbody>${j.lines.map(l => `<tr><td>${esc(l.acc)} ${esc(l.name)}</td><td class="r">${+l.d ? num(l.d) : ''}</td><td class="r">${+l.c ? num(l.c) : ''}</td></tr>`).join('')}</tbody></table></div>`).join('')}
    </section>`;
}
async function payPanel(id) {
  const e = await A.rpc('pk_fin_expense_get', { p_id: id }), owe = e.total - e.tax - e.paid, CA = await cashAccs();
  panel(`<div class="ph2"><h2>Bayar ${esc(e.code)}</h2><button class="x" data-close aria-label="Tutup">×</button></div>
    <p class="mute" style="margin:0">${esc(e.party || '')} · sisa ${rp(owe)}</p>
    <form id="fPay" class="grid" style="gap:12px">
      <label class="fld"><span class="req">Bayar dari</span><select class="inp" name="acc">${cashOpts(CA, ls('buku.payacc') || '', 'Pilih kas / bank')}</select></label>
      <label class="fld"><span class="req">Tanggal bayar</span><input class="inp" type="date" name="date" value="${today()}" max="${today()}"></label>
      <label class="fld"><span class="req">Jumlah</span><input class="inp num" name="amt" inputmode="numeric" value="${num(owe)}"></label>
      <div class="foot"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan pembayaran</button></div>
    </form>`, (p) => {
    const f = p.querySelector('#fPay');
    f.amt.addEventListener('input', () => { const n = parseNum(f.amt.value); f.amt.value = n ? num(n) : ''; });
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); if (!f.acc.value) return toast('Pilih rekening', true);
      try { await A.rpc('pk_fin_expense_pay', { p_id: id, p_acc: f.acc.value, p_date: f.date.value, p_amount: parseNum(f.amt.value) }); ls('buku.payacc', f.acc.value); close(); toast('Pembayaran dibukukan'); render(); }
      catch (err) { toast(err.message, true); }
    });
  });
}
function voidPanel(id) {
  panel(`<div class="ph2"><h2>Batalkan biaya</h2><button class="x" data-close aria-label="Tutup">×</button></div>
    <p class="mute" style="margin:0">Jurnal biaya dan pembayarannya akan dibalik pada tanggal hari ini. Dokumen tetap tersimpan dengan status Batal.</p>
    <form id="fVoid" class="grid" style="gap:12px"><label class="fld"><span class="req">Alasan</span><textarea class="inp" name="r" rows="3" required></textarea></label>
    <div class="foot"><button class="btn" type="button" data-close>Kembali</button><button class="btn pri" type="submit" style="background:var(--red);border-color:var(--red)">Batalkan biaya</button></div></form>`, (p) => {
    p.querySelector('#fVoid').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await A.rpc('pk_fin_expense_void', { p_id: id, p_reason: ev.target.r.value }); close(); toast('Biaya dibatalkan'); render(); } catch (err) { toast(err.message, true); }
    });
  });
}

/* ---------- Kas & Bank ---------- */
async function vKas() {
  const [f, t] = range();
  const cs = await A.rpc('pk_fin_cash_summary', { p_from: f, p_to: t });
  const by = {}; for (const a of cs) { const b = bizOf(a.unit) || 'RA'; (by[b] = by[b] || []).push(a); }
  const order = ['RA', 'WG', 'NA', 'HQ'].filter(b => by[b]).concat(Object.keys(by).filter(b => !['RA', 'WG', 'NA', 'HQ'].includes(b)));
  const w = canWrite();
  return header('Kas & Bank', w ? `<button class="btn" type="button" data-cash="transfer">Transfer dana</button><button class="btn" type="button" data-cash="terima">Terima dana</button><button class="btn pri" type="button" data-cash="kirim">Kirim dana</button>` : '') + `
    <div class="grid g3">
      <div class="sum t"><span>Total saldo</span><b>${rp(sum(cs, a => a.bal))}</b><small>per ${tgl(t)}</small></div>
      <div class="sum"><span>Uang masuk</span><b>${rp(sum(cs, a => a.in))}</b><small>${PER.find(p => p[0] === S.per)[1].toLowerCase()} · termasuk transfer antar rekening</small></div>
      <div class="sum a"><span>Uang keluar</span><b>${rp(sum(cs, a => a.out))}</b><small>${PER.find(p => p[0] === S.per)[1].toLowerCase()} · termasuk transfer antar rekening</small></div>
    </div>
    <div class="tools">${perSel()}<span class="sp"></span><a class="lnk" href="/keuangan#kas">Impor & cocokkan mutasi bank ›</a></div>
    ${order.map(b => `<div class="ghd">${LOGO[b] ? `<img src="${LOGO[b]}" alt="">` : ''}${BIZN[b] || b} · ${rp(sum(by[b], a => a.bal))}</div>
      <div class="grid g3">${by[b].map(a => `<a class="acc" href="#kas/${a.code}"><div class="h"><span class="ic">${svg(/^Kas/i.test(a.name) ? 'kas' : 'bank')}</span><div><b>${esc(a.name)}</b><small>${esc(a.code)} · ${esc(uname(a.unit))}${a.bank ? ' · ' + esc(a.bank) : ''}</small></div></div>
        <div class="bal${a.bal < 0 ? ' neg' : ''}">${rp(a.bal)}</div>
        ${a.bank_bal != null ? `<div class="small mute">Saldo di bank: ${rp(a.bank_bal)}${Math.round(a.bank_bal) !== Math.round(a.bal) ? ' · <span class="neg b">selisih ' + rp(a.bank_bal - a.bal) + '</span>' : ''}</div>` : ''}
        <div class="io"><span>Masuk <span class="in">${rp(a.in)}</span></span><span>Keluar <span class="out">${rp(a.out)}</span></span>${a.unmatched ? `<span class="pill p-belum">${a.unmatched} mutasi</span>` : ''}</div></a>`).join('')}</div>`).join('')}`;
}
async function cashPanel(kind, acc) {
  const CA = await cashAccs(), AC = (await accounts()).filter(a => !a.is_cash);
  const T = { kirim: ['Kirim dana', 'Uang keluar dari rekening untuk biaya, setoran, atau pembayaran lain.'], terima: ['Terima dana', 'Uang masuk ke rekening yang bukan dari penjualan aplikasi (setoran modal, pinjaman, pendapatan lain).'], transfer: ['Transfer dana', 'Pindah uang antar rekening sendiri. Tidak memengaruhi laba rugi.'] }[kind];
  const line = () => `<tr><td class="acc-c"><select class="inp" data-l="acc">${accOpts(AC, '', 'Pilih akun')}</select></td><td class="memo-c"><input class="inp" data-l="memo" placeholder="Deskripsi"></td><td class="amt-c"><input class="inp num" data-l="amount" inputmode="numeric" placeholder="0"></td><td class="del-c"><button class="del" type="button" data-delrow aria-label="Hapus baris">×</button></td></tr>`;
  panel(`<div class="ph2"><h2>${T[0]}</h2><button class="x" data-close aria-label="Tutup">×</button></div><p class="mute" style="margin:0">${T[1]}</p>
    <form id="fCash" class="grid" style="gap:12px" autocomplete="off">
      <label class="fld"><span class="req">${kind === 'terima' ? 'Masuk ke' : 'Dari rekening'}</span><select class="inp" name="cash">${cashOpts(CA, acc || ls('buku.payacc') || '', 'Pilih kas / bank')}</select></label>
      ${kind === 'transfer' ? `<label class="fld"><span class="req">Ke rekening</span><select class="inp" name="to">${cashOpts(CA, '', 'Pilih rekening tujuan')}</select></label>
        <label class="fld"><span class="req">Jumlah</span><input class="inp num" name="amt" inputmode="numeric" placeholder="0"></label>`
      : `<label class="fld">${kind === 'kirim' ? 'Penerima' : 'Pengirim'}<input class="inp" name="party" maxlength="120"></label>`}
      <div class="grid g2"><label class="fld"><span class="req">Tanggal</span><input class="inp" type="date" name="date" value="${today()}" max="${today()}"></label>
        <label class="fld"><span class="req">Unit bisnis</span><select class="inp" name="unit">${unitOpts(ls('buku.unit') || 'GK')}</select></label></div>
      ${kind === 'transfer' ? '' : `<div class="lines" style="margin:0"><table class="tbl"><thead><tr><th>Akun lawan</th><th>Deskripsi</th><th class="r">Jumlah</th><th></th></tr></thead><tbody id="clines">${line()}</tbody></table>
        <button class="lnk" type="button" data-addc style="margin-top:8px">+ Tambah baris</button><div class="totals"><div class="grand"><span>Total</span><span data-tot>Rp0</span></div></div></div>`}
      <label class="fld">Keterangan<input class="inp" name="memo" maxlength="300"></label>
      <label class="fld">Link bukti<input class="inp" name="proof" type="url" placeholder="https://"></label>
      <div class="foot"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan</button></div>
    </form>`, (p) => {
    const f = p.querySelector('#fCash');
    const calc = () => { const t = p.querySelector('[data-tot]'); if (t) t.textContent = rp(sum([...f.querySelectorAll('[data-l="amount"]')], i => parseNum(i.value))); };
    f.addEventListener('input', (e) => { if (e.target.matches('.num')) { const n = parseNum(e.target.value); e.target.value = n ? num(n) : ''; calc(); } });
    f.addEventListener('click', (e) => {
      if (e.target.closest('[data-addc]')) f.querySelector('#clines').insertAdjacentHTML('beforeend', line());
      if (e.target.closest('[data-delrow]') && f.querySelectorAll('#clines tr').length > 1) { e.target.closest('tr').remove(); calc(); }
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!f.cash.value) return toast('Pilih rekening', true);
      const q = { kind, date: f.date.value, cash_acc: f.cash.value, unit: f.unit.value, memo: f.memo.value, proof_url: f.proof.value };
      if (kind === 'transfer') { q.to_acc = f.to.value; q.amount = parseNum(f.amt.value); }
      else { q.party = f.party.value; q.lines = [...f.querySelectorAll('#clines tr')].map(tr => ({ acc: tr.querySelector('[data-l="acc"]').value, memo: tr.querySelector('[data-l="memo"]').value, amount: parseNum(tr.querySelector('[data-l="amount"]').value) })).filter(l => l.acc || l.amount);
        if (!q.lines.length || q.lines.some(l => !l.acc || !l.amount)) return toast('Setiap baris perlu akun dan jumlah', true); }
      const b = f.querySelector('[type=submit]'); b.disabled = true;
      try { const r = await A.rpc('pk_fin_cash_save', { p: q }); ls('buku.unit', f.unit.value); close(); toast(r.code + ' dibukukan'); render(); }
      catch (err) { toast(err.message, true); b.disabled = false; }
    });
  });
}

/* ---------- Buku besar (rekening / akun) ---------- */
async function vLedger(code, from) {
  const [f, t] = range();
  const L = await A.rpc('pk_fin_ledger', { p_acc: code, p_from: f, p_to: t }), a = L.acc, rows = L.rows;
  const end = rows.length ? rows[rows.length - 1].run : L.opening;
  const back = from === 'kas' ? '<a href="#kas">Kas & Bank</a>' : '<a href="#akun">Daftar Akun</a>';
  const right = from === 'kas' && canWrite() ? `<button class="btn" type="button" data-cash="transfer" data-acc="${code}">Transfer</button><button class="btn" type="button" data-cash="terima" data-acc="${code}">Terima dana</button><button class="btn pri" type="button" data-cash="kirim" data-acc="${code}">Kirim dana</button>` : '';
  return header(esc(a.name), right, back + ' › ' + esc(a.code)) + `
    <div class="grid g3"><div class="sum"><span>Saldo awal periode</span><b>${rp(L.opening)}</b><small>${tgl(f)}</small></div>
      <div class="sum t"><span>Mutasi periode</span><b>${rp(end - L.opening)}</b><small>${rows.length} transaksi</small></div>
      <div class="sum"><span>Saldo akhir</span><b${end < 0 ? ' class="neg"' : ''}>${rp(end)}</b><small>${tgl(t)}</small></div></div>
    <div class="tools">${perSel()}<span class="sp"></span><button class="btn sm" type="button" data-csvl="${code}">Ekspor CSV</button></div>
    <div class="tw">${rows.length ? `<table class="tbl cards"><thead><tr><th>Tanggal</th><th>Nomor</th><th>Keterangan</th><th>Sumber</th><th class="r">Debit</th><th class="r">Kredit</th><th class="r">Saldo</th></tr></thead><tbody>
      <tr><td data-m="hide"></td><td data-m="hide"></td><td data-m="full" class="mute">Saldo awal</td><td data-m="hide"></td><td data-m="hide"></td><td data-m="hide"></td><td class="r" data-m="right">${num(L.opening)}</td></tr>
      ${rows.map(r => `<tr${r.source === 'biaya' && /^BY/.test(r.ref || '') ? ` class="go" data-bref="${esc(String(r.ref).split('/')[0])}"` : ''}><td data-m="hide">${tgl(r.date)}</td><td><span class="code">${esc(r.ref || r.code)}</span><div class="small mute">${esc(r.code)}</div></td>
        <td data-m="full">${esc(r.memo || '')}${r.party ? `<div class="small mute">${esc(r.party)}</div>` : ''}</td><td data-m="hide">${esc(SRC[r.source] || r.source)}</td>
        <td class="r">${+r.d ? num(r.d) : ''}</td><td class="r neg">${+r.c ? num(r.c) : ''}</td><td class="r b" data-m="right">${num(r.run)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Belum ada transaksi pada periode ini.</div>'}</div>`;
}

/* ---------- Daftar akun ---------- */
async function vAkun() {
  const B = await A.rpc('pk_fin_balances', { p_to: today() });
  const q = S.q.toLowerCase(), rows = B.filter(a => !q || (a.code + ' ' + a.name).toLowerCase().includes(q));
  return header('Daftar Akun', `<a class="btn" href="/keuangan#akun">Kelola akun</a>`) + `
    <div class="tools"><input class="inp search" type="search" data-q placeholder="Cari kode atau nama akun" value="${esc(S.q)}"><span class="sp"></span><span class="small mute">Saldo per ${tgl(today())}</span></div>
    <div class="tw"><table class="tbl cards"><thead><tr><th>Kode</th><th>Nama akun</th><th>Kategori</th><th class="r">Saldo</th></tr></thead><tbody>
    ${Object.keys(GRP).map(g => { const r = rows.filter(a => a.grp === g); return r.length ? `<tr class="sec"><td colspan="3" data-m="full">${GRP[g]}</td><td class="r" data-m="hide">${num(sum(r, a => a.bal))}</td></tr>` +
      r.map(a => `<tr class="go" data-href="#akun/${a.code}"><td><span class="code">${esc(a.code)}</span></td><td data-m="full">${esc(a.name)}${a.unit ? ` <span class="small mute">· ${esc(uname(a.unit))}</span>` : ''}</td><td data-m="hide">${a.is_cash ? 'Kas & bank' : GRP[g]}</td><td class="r${a.bal < 0 ? ' neg' : ''}" data-m="right">${a.n ? num(a.bal) : '<span class="mute">0</span>'}</td></tr>`).join('') : ''; }).join('')}
    </tbody></table></div>`;
}
async function vBukuBesar() {
  const AC = await accounts(), sel = ls('buku.bb') || '1-10011';
  return header('Buku Besar', '', '<a href="#laporan">Laporan</a> › Buku Besar') + `<div class="tools"><select class="inp" data-bb style="min-width:280px">${accOpts(AC, sel)}</select></div><div id="bb"></div>`;
}

/* ---------- Laporan ---------- */
function vLaporan() {
  const R = [['/keuangan#labarugi', 'pl', 'Laba Rugi', 'Pendapatan, HPP, beban, dan laba per unit bisnis, lini, atau divisi. Bisa dibandingkan dengan periode lalu.'],
    ['/keuangan#neraca', 'bs', 'Neraca', 'Aset, kewajiban, dan ekuitas per tanggal.'], ['/keuangan#aruskas', 'cash', 'Arus Kas', 'Uang masuk dan keluar per kegiatan.'],
    ['#bukubesar', 'jurnal', 'Buku Besar', 'Semua transaksi satu akun beserta saldo berjalan.'], ['/keuangan#jurnal', 'akun', 'Jurnal Umum', 'Semua jurnal dari Biaya, Kas & Bank, Sistem Kerja, dan sumber lain.'],
    ['/keuangan#pihak', 'wallet', 'Hutang & Piutang', 'Umur hutang dan piutang per pihak.'], ['/keuangan#unit', 'dash', 'Kinerja per Unit Bisnis', 'Rentalaja, TripinAja, Niagaaja setelah biaya holding.'],
    ['/keuangan#proyeksi', 'pl', 'Proyeksi Kas 13 Minggu', 'Perkiraan saldo kas dari kewajiban & cicilan.']];
  return header('Laporan') + `<div class="banner info">Laporan memakai buku yang sama. Biaya dan transaksi kas yang dicatat di sini langsung muncul di semua laporan.</div>
    <div class="grid g2">${R.map(([h, ic, t, d]) => `<a class="card rep" href="${h}"><span class="ic">${svg(ic, 20)}</span><span><b>${t}</b><small>${d}</small></span></a>`).join('')}</div>`;
}

/* ---------- router ---------- */
function panel(html, after) { close(); const el = document.createElement('div'); el.className = 'scrim'; el.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(el); el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) close(); }); if (after) after(el.querySelector('.panel')); const f = el.querySelector('select,input'); if (f) f.focus(); }
function close() { document.querySelectorAll('.scrim').forEach(s => s.remove()); }
function setBadge(n) { document.querySelectorAll('[data-nb]').forEach(b => { b.textContent = n; b.hidden = !n; }); }
const route = () => { const [v, a] = (location.hash || '#dasbor').slice(1).split('/'); return { v: v || 'dasbor', a }; };
async function render() {
  const { v, a } = route(), my = ++seq;
  markNav(v === 'biaya' && a === 'baru' ? 'biaya/baru' : v);
  document.querySelectorAll('[data-nav="biaya"]').forEach(x => { if (v === 'biaya') x.setAttribute('aria-current', 'page'); });
  app.innerHTML = '<p class="loading">Memuat…</p>';
  try {
    let html;
    if (v === 'dasbor') html = await vDasbor();
    else if (v === 'biaya') html = a === 'baru' ? await vBiayaBaru() : a ? await vBiayaDetail(a) : await vBiaya();
    else if (v === 'kas') html = a ? await vLedger(a, 'kas') : await vKas();
    else if (v === 'akun') html = a ? await vLedger(a, 'akun') : await vAkun();
    else if (v === 'bukubesar') html = await vBukuBesar();
    else if (v === 'laporan') html = vLaporan();
    else { location.hash = '#dasbor'; return; }
    if (my !== seq) return;
    app.innerHTML = html; app.focus({ preventScroll: true }); window.scrollTo(0, 0);
    if (v === 'biaya' && a === 'baru') wireBiayaForm();
    if (v === 'bukubesar') loadBB();
  } catch (e) {
    if (my !== seq) return;
    app.innerHTML = `<div class="card pad"><h2>Halaman gagal dimuat</h2><p class="mute">${esc(e.message)}</p><button class="btn" type="button" onclick="location.reload()">Muat ulang</button></div>`;
  }
}
async function loadBB() {
  const s = app.querySelector('[data-bb]'), box = document.getElementById('bb'); if (!s || !box) return;
  if (!s.value) { box.innerHTML = ''; return; }
  ls('buku.bb', s.value); box.innerHTML = '<p class="loading">Memuat…</p>';
  try { const h = await vLedger(s.value, 'akun'); box.innerHTML = h.replace(/^<div class="ph">[\s\S]*?<\/div>/, ''); } catch (e) { box.innerHTML = `<p class="neg">${esc(e.message)}</p>`; }
}
let qTimer = null;
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-q]')) { clearTimeout(qTimer); qTimer = setTimeout(async () => { S.q = e.target.value.trim(); const pos = e.target.selectionStart; await render(); const i = app.querySelector('[data-q]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 350); }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-per]')) { S.per = e.target.value; ls('buku.per', S.per); if (route().v === 'bukubesar') loadBB(); else render(); }
  if (e.target.matches('[data-bb]')) loadBB();
});
document.addEventListener('click', async (e) => {
  const st = e.target.closest('[data-st]'); if (st) { e.preventDefault(); S.st = st.dataset.st; if (location.hash !== '#biaya') location.hash = '#biaya'; else render(); return; }
  if (e.target.closest('[data-menu]')) { document.getElementById('side').classList.toggle('open'); return; }
  const c = e.target.closest('[data-cash]'); if (c) { cashPanel(c.dataset.cash, c.dataset.acc); return; }
  if (e.target.closest('[data-pay]')) { payPanel(route().a); return; }
  if (e.target.closest('[data-void]')) { voidPanel(route().a); return; }
  if (e.target.closest('[data-csv]')) { exportBiaya(); return; }
  const cl = e.target.closest('[data-csvl]'); if (cl) { exportLedger(cl.dataset.csvl); return; }
  const br = e.target.closest('[data-bref]'); if (br) { const [f] = range('semua'); const r = await A.rpc('pk_fin_expense_list', { p_from: f, p_to: today(), p_status: null, p_q: br.dataset.bref, p_unit: null }); const x = r.rows.find(y => y.code === br.dataset.bref); if (x) location.hash = '#biaya/' + x.id; return; }
  const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button')) { location.hash = tr.dataset.href; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
const csvDl = (name, rows) => { const s = rows.map(r => r.map(c => { c = c == null ? '' : String(c); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + s], { type: 'text/csv' })); a.download = name; a.click(); };
async function exportBiaya() {
  const [f, t] = range(); const r = await A.rpc('pk_fin_expense_list', { p_from: f, p_to: t, p_status: S.st || null, p_q: S.q || null, p_unit: null });
  csvDl(`biaya_${f}_${t}.csv`, [['Tanggal', 'Nomor', 'Penerima', 'Keterangan', 'Kategori', 'Unit', 'Status', 'Total', 'Potongan PPh', 'Dibayar', 'Sisa', 'Jatuh tempo', 'No. referensi']]
    .concat(r.rows.map(x => [x.date, x.code, x.party, x.memo, x.accs, uname(x.unit), STL[x.status], x.total, x.tax, x.paid, x.owe, x.due, x.ref_no])));
}
async function exportLedger(code) {
  const [f, t] = range(); const L = await A.rpc('pk_fin_ledger', { p_acc: code, p_from: f, p_to: t });
  csvDl(`buku-besar_${code}_${f}_${t}.csv`, [['Tanggal', 'Nomor', 'Referensi', 'Keterangan', 'Pihak', 'Sumber', 'Debit', 'Kredit', 'Saldo'], ['', '', '', 'Saldo awal', '', '', '', '', L.opening]]
    .concat(L.rows.map(r => [r.date, r.code, r.ref, r.memo, r.party, SRC[r.source] || r.source, r.d, r.c, r.run])));
}
window.addEventListener('hashchange', () => { close(); render(); });

async function boot() {
  try { const u = await A.get('pk_units?select=code,name,kind,parent,sort&is_active=eq.true&order=sort'); if (Array.isArray(u)) UNITS = u; } catch (e) { /* tetap jalan */ }
  shell();
  if (!ME || !['ceo', 'kepala_staf', 'keuangan'].includes(ME.role)) { app.innerHTML = `<div class="card pad"><h2>Khusus CEO, Kepala Staf, dan Keuangan</h2><p class="mute">Buku Keuangan tidak dibuka untuk peran Anda. <a href="/">Kembali ke Sistem Kerja</a></p></div>`; return; }
  render();
}
const wait = setInterval(() => {
  const p = window.mkPerson;
  if (p || (LOCAL && window.__bukuMock)) { clearInterval(wait); ME = p || { role: 'keuangan', name: 'Reza (uji lokal)', code: 'RZ' }; boot(); }
}, 120);

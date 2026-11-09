import { ctx, hasSession, takeSessionFromUrl, signInPassword, signInGoogle, loadContext, signOut, esc, avatar, ROLE, toast, reloadSession, modal, field, db } from './core.js';
import { ensureMfa, idleGuard, idleExpired } from './mfa.js';
import kerja from './screens/kerja.js';
import tugas from './screens/tugas.js';
import belanja from './screens/belanja.js';
import kehadiran from './screens/kehadiran.js';
import unit from './screens/unit.js';
import tim from './screens/tim.js';
import sistem from './screens/sistem.js';
import setuju, { inboxCount } from './screens/setuju.js';
import gudang from './screens/gudang.js';
import beranda from './screens/beranda.js';

const I = {
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  check: '<path d="M4 5h11a2 2 0 0 1 2 2v4"/><path d="M4 5v14h7"/><path d="m14 17 2 2 4-4"/>',
  inbox: '<path d="M4 13 7 5h10l3 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  book: '<path d="M4 4h5v16H4zM10 4h4v16h-4z"/><path d="m15 5 4-1 2 15-4 1z"/>',
  cog: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  mega: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  gauge: '<path d="M3.5 18a9 9 0 1 1 17 0"/><path d="M12 14l4-5"/><circle cx="12" cy="14" r="1.6"/><path d="M6.5 12.5h1M16.5 12.5h1M12 7v1"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const MODIC = { pk_ops: 'clock', ops: 'gauge', pokama: 'sun', marketing: 'mega', keuangan: 'bank', buku: 'bank', affiliate: 'link', investor: 'trend', ra_mgmt: 'gauge', ra_aset: 'box' };
/* warna khas tiap modul: [warna ikon, latar] */
const MODCOL = { pk_ops: ['#09BEAF', '#E3F7F5'], ops: ['#0F766E', '#DDF5F2'], pokama: ['#1D3149', '#E4E9F1'], ra_mgmt: ['#1D3149', '#E4E9F1'], ra_cs: ['#0A8F86', '#DDF5F2'], ra_lap: ['#2563EB', '#E6EFFD'], ra_aset: ['#C2410C', '#FCEBDD'], ra_tek: ['#6B4F2A', '#F3ECE2'], ra_grt: ['#0F766E', '#DDF5F2'], ra_wnr: ['#0F766E', '#DDF5F2'], ra_bdg: ['#0F766E', '#DDF5F2'], ra_mpt: ['#B0466B', '#FBE7EF'], marketing: ['#7A3FD1', '#F1EAFD'], keuangan: ['#0B8A5E', '#E3F6EE'], buku: ['#077A70', '#E3F7F5'], affiliate: ['#1F63D8', '#E6EFFD'], investor: ['#B7791F', '#FDF3DF'] };
const modIc = (m, s = 18, t = 30) => { const c = MODCOL[m.k] || ['#1D3149', '#EEF0F3'];
  if (/^ra_/.test(m.k)) return `<span class="modi ra" style="--mc:${c[0]};--mb:${c[1]};width:${t}px;height:${t}px"><img src="/img/ra.png" alt="" style="width:${Math.round(t * .62)}px;height:${Math.round(t * .62)}px"><i>${({ ra_mgmt: 'O', ra_cs: 'CS', ra_lap: 'L', ra_aset: 'A', ra_tek: 'T', ra_grt: 'GK', ra_wnr: 'WR', ra_bdg: 'BD', ra_mpt: 'MP' })[m.k] || ''}</i></span>`;
  return `<span class="modi" style="--mc:${c[0]};--mb:${c[1]};width:${t}px;height:${t}px">${svg(MODIC[m.k] || 'grid', s)}</span>`; };
const svg = (k, s = 18) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

const BASE_ROUTES = [
  ['KERJA HARIAN', [
    ['beranda', 'Beranda', 'grid', beranda], ['setuju', 'Kotak Persetujuan', 'inbox', setuju], ['kkh', 'KKH Saya', 'sun', kerja.saya], ['kkh-tim', 'KKH Tim', 'grid', kerja.tim], ['tugas', 'Proyek & Tugas', 'layers', tugas.board],
    ['review', 'Review & Revisi', 'check', tugas.review], ['belanja', 'Pengajuan Belanja', 'wallet', belanja],
    ['kehadiran', 'Kehadiran & Cuti', 'clock', kehadiran], ['unit', 'Unit Bisnis', 'trophy', unit]]],
  ['ORANG', [['tim', 'Tim & Peran', 'users', tim.tim], ['performa', 'Performa', 'coin', tim.performa]]],
  ['SISTEM', [['library', 'Library Dokumen', 'book', sistem.library], ['pengaturan', 'Pengaturan', 'cog', sistem.pengaturan]]],
];
/* Gudang = manajemen inventory, menunya di modul Aset (Rentalaja › Aset & servis); halamannya tetap bisa dibuka lewat tautan */
const EXTRA = [['gudang', 'Gudang & Stok', 'box', gudang]];
let ROUTES = BASE_ROUTES, FLAT = ROUTES.flatMap(([, r]) => r).concat(EXTRA), MOBILE = ['beranda', 'tugas', 'kkh', 'setuju'];
// Sistem Kerja Operasional punya alamat sendiri: ops.pokama.org (app.pokama.org tetap untuk Sistem Kerja holding)
const OPS_URL = 'https://ops.pokama.org/';
function buildRoutes() {
  ROUTES = BASE_ROUTES; /* petugas lapangan: ops.pokama.org; manajemen Kerja lapangan: Rentalaja → Operasional (OpsKerja) */ MOBILE = ['beranda', 'tugas', 'kkh', 'setuju'];
  FLAT = ROUTES.flatMap(([, r]) => r).concat(EXTRA);
}
const HOME = () => 'kkh';
const HIDDEN = { performa: (r) => !['ceo', 'keuangan'].includes(r) && false };

const root = document.getElementById('app');

// ---------- login ----------
function loginView(msg) {
  root.innerHTML = `<main class="login"><div class="login-card">
    <img class="login-logo" src="img/pokama-logo.png" alt="Pokama">
    <div><h1>Masuk</h1><p class="muted small">Sistem Kerja Harian · PT Popo Karya Investama</p></div>
    ${msg ? `<p class="form-err">${esc(msg)}</p>` : ''}
    <button class="btn sec big" type="button" id="g">${googleIcon}Masuk dengan Google</button>
    <div class="or">atau pakai email</div>
    <form id="pf" class="stack" autocomplete="on">
      <label class="fld"><span>Email</span><input id="em" class="inp" type="email" autocomplete="username" required placeholder="nama@email.com"></label>
      <label class="fld"><span>Password</span><input id="pw" class="inp" type="password" autocomplete="current-password" required placeholder="Password"></label>
      <p class="form-err" id="pe" hidden></p>
      <button class="btn pri big" type="submit">Masuk</button>
    </form>
    <button class="link mute fg" type="button" id="fg">Lupa password?</button>
    <p class="note" id="fgn" hidden>Minta Kepala Staf membuat password baru dari menu Tim & Peran.</p>
  </div></main>`;
  const $ = (s) => root.querySelector(s);
  $('#g').onclick = () => signInGoogle();
  $('#fg').onclick = () => { $('#fgn').hidden = false; };
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); const b = e.submitter; b.disabled = true; $('#pe').hidden = true;
    try { await signInPassword($('#em').value, $('#pw').value); await boot(); }
    catch (er) { $('#pe').textContent = er.message; $('#pe').hidden = false; b.disabled = false; }
  };
}
const googleIcon = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.4 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

// ---------- kerangka ----------
function shell() {
  const me = ctx.me;
  const nav = ROUTES.map(([sec, items]) => `<div class="nav-sec"><span class="nav-h">${sec}</span>${items.map(([k, l, ic]) =>
    `<a href="#/${k}" data-k="${k}">${svg(ic)}<span>${l}</span><b class="badge" data-badge="${k}" hidden></b></a>`).join('')}</div>`).join('')
    + `<div class="nav-sec" id="modnav" hidden></div>`;
  root.innerHTML = `<div class="shell">
    <nav class="side" aria-label="Menu utama"><div class="brand-row"><a class="brand" href="#/${HOME()}"><img src="img/pokama-logo.png" alt="Pokama"></a><button type="button" class="bell" data-bell aria-label="Notifikasi">${svg('bell', 20)}<b class="badge" data-badge="ntf" hidden></b></button></div><span class="muted small brand-sub">Sistem Kerja Harian</span>${nav}
      <div class="side-me"><a href="#/pengaturan" class="me">${avatar(me.id, 36)}<span><b>${esc(me.nickname || me.name)}</b><small>${esc(me.title || ROLE[me.role])}</small></span></a>
      <button class="link mute" type="button" id="logout">Keluar</button></div></nav>
    <button type="button" class="bell m-bell" data-bell aria-label="Notifikasi">${svg('bell', 22)}<b class="badge" data-badge="ntf" hidden></b></button>
    <main class="main" id="view" tabindex="-1"></main>
    <nav class="bottom" aria-label="Menu bawah">${MOBILE.map(k => { const r = FLAT.find(x => x[0] === k); return `<a href="#/${k}" data-k="${k}">${svg(r[2], 22)}<span>${r[1].split(' ')[0]}</span><b class="badge" data-badge="${k}" hidden></b></a>`; }).join('')}
      <a href="#/menu" data-k="menu">${svg('menu', 22)}<span>Lainnya</span></a></nav>
  </div>`;
  root.querySelector('#logout').onclick = () => signOut();
  root.querySelectorAll('[data-bell]').forEach(b => b.onclick = openNotifs);
}
async function openNotifs() {
  const { db, modal, esc, ftime, toast } = await import('./core.js');
  const list = await db.get('pk_notifications', `select=*&person_id=eq.${ctx.me.id}&order=created_at.desc&limit=40`);
  const unread = list.filter(n => !n.read_at);
  const KIND = { marketing: 'Marketing', keuangan: 'Keuangan', affiliate: 'Affiliate', investor: 'Investor', tugas: 'Tugas', review: 'Review', rab: 'Belanja', kkh: 'KKH', cuti: 'Kehadiran', permintaan: 'Permintaan', ops: 'Operasional' };
  const onOpen = (ev) => { document.removeEventListener('modal:open', onOpen); ev.detail.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-n]'); if (!a) return; e.preventDefault();
    try { await db.update('pk_notifications', 'id=eq.' + a.dataset.n, { read_at: new Date().toISOString() }); } catch (er) {}
    const href = a.getAttribute('href') || '#/' + HOME(); document.querySelector('.modal-wrap')?.remove();
    if (!href.startsWith('#')) { location.href = href.startsWith('/') ? href : '/' + href; return; } location.hash = href; route(); }); };
  document.addEventListener('modal:open', onOpen);
  const r = await modal('Notifikasi', list.length ? `<div class="ntf-list">${list.map(n => `<a class="ntf${n.read_at ? '' : ' new'}" data-n="${n.id}" href="${esc(n.link || '#/kkh')}"><small>${esc(KIND[n.kind] || n.kind)} · ${ftime(n.created_at)}</small><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}</a>`).join('')}</div>` : '<p class="muted">Belum ada notifikasi.</p>',
    { submit: unread.length ? 'Tandai semua sudah dibaca' : null, onSubmit: async () => { await db.update('pk_notifications', `person_id=eq.${ctx.me.id}&read_at=is.null`, { read_at: new Date().toISOString() }); } });
  if (r) { toast('Semua notifikasi ditandai dibaca'); badges(true); }
}
function menuView(el) {
  el.innerHTML = `<header class="ph"><div><h1>Menu</h1><p class="muted">${esc(ctx.me.name)} · ${esc(ctx.me.title || ROLE[ctx.me.role])}</p></div></header>
    <div class="menu-list">${FLAT.map(([k, l, ic]) => `<a class="card row" href="#/${k}">${svg(ic, 22)}<b>${l}</b><span style="flex:1"></span>›</a>`).join('')}
    ${(ctx.modules || []).length ? `<span class="nav-h" style="margin-top:8px">MODUL</span>` + ctx.modules.map(m => `<a class="card row" href="${esc(m.href)}"${m.sso ? ` data-sso="${esc(m.k)}"` : ''}${m.ext ? ' target="_blank" rel="noopener"' : ''}>${modIc(m, 20, 36)}<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><b>${esc(m.name)}</b><small class="muted" style="font-weight:600">${esc(m.note || '')}</small></span>${m.n ? `<b class="badge">${m.n}</b>` : ''}›</a>`).join('') : ''}
    <button class="card row danger-t" type="button" id="lo2">Keluar</button></div>`;
  el.querySelector('#lo2').onclick = () => signOut();
}

// Label kolom tabel supaya di HP tabel tampil sebagai kartu
function labelTables(root) {
  root.querySelectorAll('table.tbl:not(.cal)').forEach(t => { const h = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    t.querySelectorAll('tbody tr, tfoot tr').forEach(tr => { let i = 0; [...tr.children].forEach(td => { if (!td.hasAttribute('data-l')) td.setAttribute('data-l', h[i] || ''); i += +td.colSpan || 1; }); }); });
}
let current = null;
async function route() {
  const k = (location.hash.replace(/^#\/?/, '').split('?')[0] || HOME());
  const view = document.getElementById('view'); if (!view) return;
  const el = document.createElement('div'); el.className = 'route'; view.replaceChildren(el);
  new MutationObserver(() => labelTables(el)).observe(el, { childList: true, subtree: true });
  document.querySelectorAll('[data-k]').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  const r = FLAT.find(x => x[0] === k);
  current = k;
  el.innerHTML = '<div class="loading">Memuat…</div>';
  window.scrollTo(0, 0);
  try {
    if (k === 'shift') { location.href = OPS_URL; return; }
    if (k === 'ops') { location.href = 'https://demo.rentalaja.co.id/#/OpsKerja'; return; }
    if (k === 'menu') { menuView(el); document.title = 'Menu · Pokama'; return; }
    if (!r) { location.hash = '#/' + HOME(); return; }
    document.title = r[1] + ' · Pokama';
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    for (const [pk, pv] of [...params]) if (!/^[\w.-]{0,64}$/.test(pv)) params.delete(pk);
    await r[3](el, params, () => { if (current === k) route(); });
    import('./screens/panel.js').then(m => m.mount(el, k, params)).catch(() => {});
  } catch (e) {
    if (!el.isConnected) return;
    el.innerHTML = `<div class="card"><h2>Gagal memuat</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Muat ulang</button></div>`;
  }
  badges();
}
// ---------- Pusat Kerja: modul Pokama sesuai peran (daftar & angka dari fungsi pk_modules) ----------
let _modAt = 0;
async function loadModules(force) {
  /* server kecil: daftar & angka modul cukup diperbarui tiap 2 menit */
  { if (force || !ctx.modules || Date.now() - _modAt > 120000) { try { const { db } = await import('./core.js'); ctx.modules = (await db.rpc('pk_modules')) || []; _modAt = Date.now(); } catch (e) { ctx.modules = ctx.modules || []; } }
    const o = ctx.ops || {};
    if ((o.field || o.mgr) && ctx.me.role !== 'lapangan' && !ctx.modules.some(m => m.k === 'pk_ops' || /Kerja Lapangan/i.test(m.name || ''))) ctx.modules = [{ k: 'pk_ops', name: 'Kerja Lapangan', href: OPS_URL, note: 'ops.pokama.org · absen, pengajuan, panel kerja petugas', n: 0, ext: true, sso: true }].concat(ctx.modules); }
  { const seen = new Set(); ctx.modules = (ctx.modules || []).filter(m => { const key = m.k || m.name; if (seen.has(key)) return false; seen.add(key); return true; }); }
  const nav = document.getElementById('modnav');
  if (nav) { nav.hidden = !ctx.modules.length; const navIt = (m => `<a href="${esc(m.href)}"${m.sso ? ` data-sso="${esc(m.k)}"` : ''}${m.ext ? ' target="_blank" rel="noopener"' : ''} title="${esc(m.note || '')}">${modIc(m, 16, 28)}<span>${esc(m.name)}</span>${m.n ? `<b class="badge${m.urgent ? '' : ' soft'}">${m.n}</b>` : ''}</a>`);
    const pm = ctx.modules.filter(m => !/^ra_/.test(m.k)), rm = ctx.modules.filter(m => /^ra_/.test(m.k));
    nav.innerHTML = (pm.length ? `<span class="nav-h">MODUL</span>` + pm.map(navIt).join('') : '') + (rm.length ? `<span class="nav-h" style="margin-top:10px">RENTALAJA</span>` + rm.map(navIt).join('') : ''); }
  const st = document.getElementById('modstrip'); if (st) st.outerHTML = modStrip();
  return ctx.modules;
}
// Dashboard Manajemen & Aset: masuk Rentalaja App memakai sesi Sistem Kerja (tanpa login & 2 langkah lagi)
async function openSSO(k) {
  const w = window.open('', '_blank');
  try { if (w) w.document.write('<p style="font:600 15px system-ui;padding:24px;color:#1D3149">Membuka…</p>'); } catch (e) {}
  try {
    const { callFn } = await import('./core.js');
    const r = await callFn('pk-ra-sso', { target: k });
    if (w) w.location.replace(r.url); else location.href = r.url;
  } catch (e) { try { w && w.close(); } catch (x) {} toast(e.message || 'Gagal membuka Rentalaja', 'err'); }
}
document.addEventListener('click', (e) => { const a = e.target.closest('a[data-sso]'); if (!a) return; e.preventDefault(); openSSO(a.dataset.sso); });
function modStrip() {
  const ms = ctx.modules || []; if (!ms.length) return '<div id="modstrip" hidden></div>';
  return `<section id="modstrip" class="modstrip" aria-label="Modul">${ms.map(m => `<a${m.sso ? ` data-sso="${esc(m.k)}"` : ''}${m.ext ? ' target="_blank" rel="noopener"' : ''} class="modc${m.urgent ? ' hot' : ''}" style="--mc:${(MODCOL[m.k] || ['#1D3149'])[0]}" href="${esc(m.href)}"><span class="modc-h">${modIc(m, 18, 32)}<b>${esc(m.name)}</b>${m.n ? `<b class="badge${m.urgent ? '' : ' soft'}">${m.n}</b>` : ''}</span><small>${esc(m.note || '')}</small></a>`).join('')}</section>`;
}
let _bAt = 0, _bLast = null;
async function badges(force) {
  /* lencana angka: paling sering tiap 30 detik (dulu setiap pindah halaman) */
  const setB = (k, n) => document.querySelectorAll(`[data-badge="${k}"]`).forEach(b => { b.hidden = !n; b.textContent = n; });
  if (!force && _bLast && Date.now() - _bAt < 30000) { Object.entries(_bLast).forEach(([k, n]) => setB(k, n)); return; }
  _bAt = Date.now(); _bLast = _bLast || {};
  loadModules();
  try {
    const { db } = await import('./core.js');
    const me = ctx.me.id;
    if (ctx.ops && ctx.ops.mgr) db.get('ops_overtime', 'select=id&status=eq.diajukan').then(r => document.querySelectorAll('[data-badge="ops"]').forEach(b => { b.hidden = !r.length; b.textContent = r.length; })).catch(() => {});
    if (ctx.me.role === 'lapangan') { const nt = await db.get('pk_notifications', `select=id&person_id=eq.${me}&read_at=is.null&limit=99`); document.querySelectorAll('[data-badge="ntf"]').forEach(b => { b.hidden = !nt.length; b.textContent = nt.length; }); return; }
        const [rv, rb, nt] = await Promise.all([
      db.get('pk_tasks', `select=id&reviewer_id=eq.${me}&status=eq.review`),
      db.get('pk_rab', 'select=id,chain,step,status&status=in.(diajukan,siap_cair,lpj)'),
      db.get('pk_notifications', `select=id&person_id=eq.${me}&read_at=is.null&limit=99`),
    ]);
    const nb = rb.filter(r => r.status === 'diajukan' && r.chain[r.step] === me).length + (ctx.me.role === 'keuangan' ? rb.filter(r => r.status !== 'diajukan').length : 0);

    const set = (k, n) => { _bLast[k] = n; setB(k, n); };
    set('ntf', nt.length); set('review', rv.length); set('belanja', nb);
    inboxCount().then(n => set('setuju', n));
    document.title = (nt.length ? `(${nt.length}) ` : '') + document.title.replace(/^\(\d+\) /, '');
  } catch (e) {}
}

async function boot() {
  root.innerHTML = '<div class="loading full">Memuat…</div>';
  let ok = false;
  // verifikasi 2 langkah wajib untuk semua staf (server juga menolak sesi tanpa 2 langkah)
  // petugas lapangan (tanpa Authenticator) langsung diarahkan ke Kerja Lapangan
  try { const { claims } = await import('./mfa.js'); const t = JSON.parse(localStorage.getItem('pokama.session') || '{}').access_token; if (t && claims(t).aal !== 'aal2') { const p = await db.rpc('ops_session'); if (p && p.role === 'lapangan') { location.replace(OPS_URL); return; } } } catch (e) {}
  try { const m = await ensureMfa(); if (!m) { loginView(); return; } reloadSession(); } catch (e) { loginView(e.message); return; }
  try { ok = await loadContext(); } catch (e) { loginView(e.message); return; }
  if (!ok) { try { const p = await db.rpc('ops_session'); if (p && p.role === 'lapangan') { location.replace(OPS_URL); return; } } catch (e) {}
    await import('./core.js').then(m => { try { localStorage.removeItem('pokama.session'); } catch (e) {} });
    loginView('Akun ini belum terdaftar di Sistem Kerja Pokama. Minta Kepala Staf menambahkan Anda di Tim & Peran.'); return; }
  try { ctx.ops = await db.rpc('ops_whoami'); } catch (e) { ctx.ops = {}; }
  if (ctx.me.role === 'lapangan') { location.replace(OPS_URL); return; }
  buildRoutes();
  shell();
  await loadModules();
  if (!location.hash || location.hash === '#/' ) location.hash = window.matchMedia('(max-width: 760px)').matches ? '#/beranda' : (ctx.me.role === 'kepala_staf' ? '#/review' : ctx.me.role === 'keuangan' ? '#/belanja' : '#/kkh');
  window.onhashchange = route;
  route();
  askPhone();
}

// nomor WA dipakai untuk peringatan keamanan & notifikasi; minta sekali bila belum ada
async function askPhone() {
  if (ctx.me.phone) return;
  try { const k = 'pokama.askwa'; if (+localStorage.getItem(k) > Date.now() - 20 * 3600e3) return; localStorage.setItem(k, String(Date.now())); } catch (e) {}
  const r = await modal('Isi nomor WhatsApp Anda', `<p class="muted small">Dipakai untuk peringatan keamanan akun dan notifikasi Sistem Kerja. Hanya terlihat oleh Anda, Kepala Staf, dan CEO.</p>`
    + field('Nomor WhatsApp', '<input name="wa" class="inp" inputmode="tel" autocomplete="tel" placeholder="0812 3456 7890" required>'),
    { submit: 'Simpan nomor', onSubmit: async (f) => { const ph = await db.rpc('pk_set_phone', { p_phone: f.wa }); ctx.me.phone = ph; if (ctx.byId[ctx.me.id]) ctx.byId[ctx.me.id].phone = ph; } });
  if (r) toast('Nomor WA tersimpan');
}

takeSessionFromUrl();
if (hasSession() && idleExpired()) { try { localStorage.removeItem('pokama.session'); } catch (e) {} reloadSession(); }
if (hasSession()) boot(); else loginView();
idleGuard(() => { if (hasSession()) signOut(); });

// Data diperbarui otomatis: badge tiap 60 detik, halaman saat aplikasi dibuka kembali (kalau tidak sedang mengisi form)
const busy = () => document.querySelector('.modal-wrap') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
setInterval(() => { if (ctx.me && document.visibilityState === 'visible') badges(); }, 60000);
let hiddenAt = 0;
// Kembali ke tab: JANGAN memuat ulang halaman (mengganggu & lambat). Perbarui badge saja;
// kalau tab ditinggal lama (>10 menit), tampilkan tombol kecil "Perbarui data" yang bisa diketuk kapan saja.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (!ctx.me) return;
  badges();
  if (hiddenAt && Date.now() - hiddenAt > 10 * 60000) showRefreshChip();
});
function showRefreshChip() {
  if (document.getElementById('pk-refresh-chip')) return;
  const b = document.createElement('button');
  b.id = 'pk-refresh-chip'; b.type = 'button'; b.textContent = '↻ Perbarui data';
  b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:400;height:40px;padding:0 16px;border-radius:20px;border:0;background:#1D3149;color:#fff;font:800 14px Nunito,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer';
  b.onclick = () => { b.remove(); if (!busy()) route(); };
  document.body.appendChild(b);
  window.addEventListener('hashchange', () => b.remove(), { once: true });
}

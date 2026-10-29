import { ctx, hasSession, takeSessionFromUrl, signInPassword, signInGoogle, loadContext, signOut, esc, avatar, ROLE, toast } from './core.js';
import kerja from './screens/kerja.js';
import tugas from './screens/tugas.js';
import belanja from './screens/belanja.js';
import kehadiran from './screens/kehadiran.js';
import unit from './screens/unit.js';
import tim from './screens/tim.js';
import sistem from './screens/sistem.js';

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
};
const svg = (k, s = 18) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

const ROUTES = [
  ['KERJA HARIAN', [
    ['kkh', 'KKH Saya', 'sun', kerja.saya], ['kkh-tim', 'KKH Tim', 'grid', kerja.tim], ['tugas', 'Proyek & Tugas', 'layers', tugas.board],
    ['review', 'Review & Revisi', 'check', tugas.review], ['belanja', 'Pengajuan Belanja', 'wallet', belanja],
    ['kehadiran', 'Kehadiran & Cuti', 'clock', kehadiran], ['unit', 'Unit Bisnis', 'trophy', unit]]],
  ['ORANG', [['tim', 'Tim & Peran', 'users', tim.tim], ['performa', 'Performa', 'coin', tim.performa]]],
  ['SISTEM', [['library', 'Library Dokumen', 'book', sistem.library], ['pengaturan', 'Pengaturan', 'cog', sistem.pengaturan]]],
];
const FLAT = ROUTES.flatMap(([, r]) => r);
const MOBILE = ['kkh', 'tugas', 'review', 'belanja'];
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
    `<a href="#/${k}" data-k="${k}">${svg(ic)}<span>${l}</span><b class="badge" data-badge="${k}" hidden></b></a>`).join('')}</div>`).join('');
  root.innerHTML = `<div class="shell">
    <nav class="side" aria-label="Menu utama"><div class="brand-row"><a class="brand" href="#/kkh"><img src="img/pokama-logo.png" alt="Pokama"></a><button type="button" class="bell" data-bell aria-label="Notifikasi">${svg('bell', 20)}<b class="badge" data-badge="ntf" hidden></b></button></div><span class="muted small brand-sub">Sistem Kerja Harian</span>${nav}
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
  const KIND = { tugas: 'Tugas', review: 'Review', rab: 'Belanja', kkh: 'KKH', cuti: 'Kehadiran', permintaan: 'Permintaan' };
  const onOpen = (ev) => { document.removeEventListener('modal:open', onOpen); ev.detail.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-n]'); if (!a) return; e.preventDefault();
    try { await db.update('pk_notifications', 'id=eq.' + a.dataset.n, { read_at: new Date().toISOString() }); } catch (er) {}
    document.querySelector('.modal-wrap')?.remove(); location.hash = a.getAttribute('href') || '#/kkh'; route(); }); };
  document.addEventListener('modal:open', onOpen);
  const r = await modal('Notifikasi', list.length ? `<div class="ntf-list">${list.map(n => `<a class="ntf${n.read_at ? '' : ' new'}" data-n="${n.id}" href="${esc(n.link || '#/kkh')}"><small>${esc(KIND[n.kind] || n.kind)} · ${ftime(n.created_at)}</small><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}</a>`).join('')}</div>` : '<p class="muted">Belum ada notifikasi.</p>',
    { submit: unread.length ? 'Tandai semua sudah dibaca' : null, onSubmit: async () => { await db.update('pk_notifications', `person_id=eq.${ctx.me.id}&read_at=is.null`, { read_at: new Date().toISOString() }); } });
  if (r) { toast('Semua notifikasi ditandai dibaca'); badges(); }
}
function menuView(el) {
  el.innerHTML = `<header class="ph"><div><h1>Menu</h1><p class="muted">${esc(ctx.me.name)} · ${esc(ctx.me.title || ROLE[ctx.me.role])}</p></div></header>
    <div class="menu-list">${FLAT.map(([k, l, ic]) => `<a class="card row" href="#/${k}">${svg(ic, 22)}<b>${l}</b><span style="flex:1"></span>›</a>`).join('')}
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
  const k = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'kkh');
  const view = document.getElementById('view'); if (!view) return;
  const el = document.createElement('div'); el.className = 'route'; view.replaceChildren(el);
  new MutationObserver(() => labelTables(el)).observe(el, { childList: true, subtree: true });
  document.querySelectorAll('[data-k]').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  const r = FLAT.find(x => x[0] === k);
  current = k;
  el.innerHTML = '<div class="loading">Memuat…</div>';
  window.scrollTo(0, 0);
  try {
    if (k === 'menu') { menuView(el); document.title = 'Menu · Pokama'; return; }
    if (!r) { location.hash = '#/kkh'; return; }
    document.title = r[1] + ' · Pokama';
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    for (const [pk, pv] of [...params]) if (!/^[\w.-]{0,64}$/.test(pv)) params.delete(pk);
    await r[3](el, params, () => { if (current === k) route(); });
  } catch (e) {
    if (!el.isConnected) return;
    el.innerHTML = `<div class="card"><h2>Gagal memuat</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Muat ulang</button></div>`;
  }
  badges();
}
async function badges() {
  try {
    const { db } = await import('./core.js');
    const me = ctx.me.id;
        const [rv, rb, nt] = await Promise.all([
      db.get('pk_tasks', `select=id&reviewer_id=eq.${me}&status=eq.review`),
      db.get('pk_rab', 'select=id,chain,step,status&status=in.(diajukan,siap_cair,lpj)'),
      db.get('pk_notifications', `select=id&person_id=eq.${me}&read_at=is.null&limit=99`),
    ]);
    const nb = rb.filter(r => r.status === 'diajukan' && r.chain[r.step] === me).length + (ctx.me.role === 'keuangan' ? rb.filter(r => r.status !== 'diajukan').length : 0);

    const set = (k, n) => document.querySelectorAll(`[data-badge="${k}"]`).forEach(b => { b.hidden = !n; b.textContent = n; });
    set('ntf', nt.length); set('review', rv.length); set('belanja', nb);
    document.title = (nt.length ? `(${nt.length}) ` : '') + document.title.replace(/^\(\d+\) /, '');
  } catch (e) {}
}

async function boot() {
  root.innerHTML = '<div class="loading full">Memuat…</div>';
  let ok = false;
  try { ok = await loadContext(); } catch (e) { loginView(e.message); return; }
  if (!ok) { await import('./core.js').then(m => { try { localStorage.removeItem('pokama.session'); } catch (e) {} });
    loginView('Akun ini belum terdaftar di Sistem Kerja Pokama. Minta Kepala Staf menambahkan Anda di Tim & Peran.'); return; }
  shell();
  if (!location.hash || location.hash === '#/' ) location.hash = window.matchMedia('(max-width: 760px)').matches ? '#/kkh' : (ctx.me.role === 'kepala_staf' ? '#/review' : ctx.me.role === 'keuangan' ? '#/belanja' : '#/kkh');
  window.onhashchange = route;
  route();
}

takeSessionFromUrl();
if (hasSession()) boot(); else loginView();

// Data diperbarui otomatis: badge tiap 60 detik, halaman saat aplikasi dibuka kembali (kalau tidak sedang mengisi form)
const busy = () => document.querySelector('.modal-wrap') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
setInterval(() => { if (ctx.me && document.visibilityState === 'visible') badges(); }, 60000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (ctx.me && Date.now() - hiddenAt > 20000 && !busy()) route();
});

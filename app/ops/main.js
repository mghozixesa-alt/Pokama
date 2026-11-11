// Kerja Lapangan Pokama (ops.pokama.org) · aplikasi petugas operasional seluruh unit
// Alur seperti aplikasi HR (GajiHub): Beranda → Clock In (selfie + lokasi) → menu cepat (cuti, izin, sakit, lembur, reimburse, kasbon,
// slip gaji, jadwal, riwayat, ceklis, performa, panel kerja) → Clock Out. Persetujuan ada di Rentalaja → Operasional → Kerja lapangan.
import { ctx, db, esc, today, addDays, fdate, ftime, toast, need, confirmBox, callFn, shrinkImage, uploadPhoto, getLocation, signedPhoto,
  hasSession, takeSessionFromUrl, signInPassword, signInGoogle, signOut, reloadSession, SB_URL } from '../core.js';
import { ensureMfa, idleGuard, idleExpired } from '../mfa.js';

const root = document.getElementById('app');
const POSC = { kasir: '#0F766E', cs: '#0A8F86', runner: '#2563EB', sopir: '#6B4F2A', qc: '#7A3FD1', teknisi: '#C2410C', kepala_cabang: '#1F2B4D' };
const POSC2 = { kasir: '#064E48', cs: '#065F59', runner: '#1E3A8A', sopir: '#3F2E18', qc: '#4C2590', teknisi: '#7C2D12', kepala_cabang: '#0F172A' };
const hm = (t) => t ? String(t).slice(0, 5).replace(':', '.') : '—';
const clock = (ts) => ts ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(':', '.') : '--.--';
const jam = (m) => { m = +m || 0; const h = Math.floor(m / 60), r = m % 60; return h ? h + ' j' + (r ? ' ' + r + ' m' : '') : r + ' m'; };
const rp = (n) => 'Rp' + Math.round(+n || 0).toLocaleString('id-ID');
const dist = (a, b, c, d) => { const R = 6371e3, r = (x) => x * Math.PI / 180; const x = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const nowHM = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);
const ST = { diajukan: ['Menunggu', 'yellow'], menunggu_keuangan: ['Menunggu Keuangan', 'yellow'], disetujui: ['Disetujui', 'green'], ditolak: ['Ditolak', 'red'], batal: ['Dibatalkan', 'gray'], dibayar: ['Dibayar', 'green'] };
const chipS = (s) => `<span class="chip ${(ST[s] || ['', 'gray'])[1]}">${(ST[s] || [s])[0]}</span>`;
// ikon garis gaya Rentalaja App (stroke, sudut membulat), dipakai di menu cepat, pengajuan, lencana
const RI = {
  cuti: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M12 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>',
  izin: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M3 21h18M14 12h.01"/>',
  sakit: '<path d="M12 20s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 5.8-8 11-8 11z"/><path d="M4.5 12H9l1.5-2.5 2.5 5 1.5-2.5h5"/>',
  lembur: '<circle cx="11" cy="13" r="8"/><path d="M11 9v4l2.5 1.5M19 2v4M17 4h4"/>',
  reimburse: '<path d="M6 3h12v18l-2.5-1.6L13 21l-2-1.6L9 21l-3-2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  kasbon: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14.5" r="1.4"/>',
  slip: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  jadwal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4"/>',
  riwayat: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
  ceklis: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8.5l1.5 1.5L12 7.5M8 14.5l1.5 1.5L12 13.5M14.5 9h2.5M14.5 15h2.5"/>',
  performa: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  panel: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  kamera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  kunci: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  api: '<path d="M12 3c.8 3.6 5 5 5 10a5 5 0 0 1-10 0c0-2.6 1.6-3.8 2-6.2 1.6 1.2 2.8 2.7 3 4.7"/>',
  keluar: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  tim: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 3.8-5 7-5s6 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5"/>',
  tepat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', hadir: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4"/>',
  kas: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14.5" r="1.4"/>', antar: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
};
const ri = (k, s = 22, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RI[k] || RI.panel}</svg>`;
const TYPES = { cuti: ['Cuti', 'cuti'], izin: ['Izin', 'izin'], sakit: ['Sakit', 'sakit'], lembur: ['Lembur', 'lembur'], reimburse: ['Reimburse', 'reimburse'], kasbon: ['Kasbon', 'kasbon'] };
const IC = {
  beranda: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  kehadiran: '<path d="M8 3v3M16 3v3"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="m9 15 2 2 4-4"/>',
  absen: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  pengajuan: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  akun: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const ico = (k, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const NAV = [['beranda', 'Beranda'], ['kehadiran', 'Kehadiran'], ['absen', 'Absen'], ['pengajuan', 'Pengajuan'], ['akun', 'Akun']];
const MENU = [['ajukan?k=cuti', 'cuti', 'Cuti'], ['ajukan?k=izin', 'izin', 'Izin'], ['ajukan?k=sakit', 'sakit', 'Sakit'], ['ajukan?k=lembur', 'lembur', 'Lembur'],
  ['ajukan?k=reimburse', 'reimburse', 'Reimburse'], ['ajukan?k=kasbon', 'kasbon', 'Kasbon'], ['slip', 'slip', 'Slip gaji'], ['jadwal', 'jadwal', 'Jadwal'],
  ['kehadiran', 'riwayat', 'Riwayat'], ['ceklis', 'ceklis', 'Ceklis'], ['performa', 'performa', 'Performa'], ['panel', 'panel', 'Panel kerja']];
const sapa = () => { const h = +nowHM().slice(0, 2); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };
const nickOf = () => ctx.me.nickname || ctx.me.name;
// header hijau ala Rentalaja; back = tombol kembali ke Beranda (halaman turunan)
const hero = (title, sub, back) => `<header class="ra-hero${back ? ' sm' : ''}"><div class="ra-wrap"><div class="top">${back ? `<a class="bk" href="#/${back}" aria-label="Kembali">‹</a>` : '<span class="pk"><img src="/img/pokama-logo.png" alt="Pokama"></span>'}<button type="button" class="av" data-go="akun" title="Akun">${esc((nickOf() || '?').slice(0, 2).toUpperCase())}</button></div>
  ${back ? '' : `<div class="greet">${sapa()}, ${esc(nickOf())}</div>`}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div></header><div class="ra-body">`;

// ---------- masuk ----------
function loginView(msg) {
  root.innerHTML = `<main class="login"><div class="login-card">
    <img class="pk-logo" src="/img/pokama-logo.png" alt="Pokama">
    <div><h1>Kerja Lapangan</h1><p class="muted small">Absen, pengajuan, slip gaji, dan panel kerja petugas operasional Pokama</p></div>
    ${msg ? `<p class="form-err">${esc(msg)}</p>` : ''}
    <button class="btn sec big" type="button" id="g">Masuk dengan Google</button>
    <div class="or">atau pakai email</div>
    <form id="pf" class="stack"><label class="fld"><span>Email</span><input id="em" class="inp" type="email" autocomplete="username" required></label>
      <label class="fld"><span>Password</span><input id="pw" class="inp" type="password" autocomplete="current-password" required></label>
      <p class="form-err" id="pe" hidden></p><button class="btn pri big" type="submit">Masuk</button></form>
    <p class="note small">Belum bisa masuk? Minta Operasional mendaftarkan email Google Anda.</p></div></main>`;
  root.querySelector('#g').onclick = () => signInGoogle();
  root.querySelector('#pf').onsubmit = async (e) => { e.preventDefault(); const b = e.submitter; b.disabled = true;
    try { await signInPassword(root.querySelector('#em').value, root.querySelector('#pw').value); await boot(); }
    catch (er) { const p = root.querySelector('#pe'); p.textContent = er.message; p.hidden = false; b.disabled = false; } };
}
function gate(title, body) {
  root.innerHTML = `<main class="ra-gate"><div class="card stack"><img class="pk-logo" src="/img/pokama-logo.png" alt="Pokama" style="width:120px"><h1>${esc(title)}</h1><p class="muted">${body}</p><button class="btn" id="lo">Keluar</button></div></main>`;
  root.querySelector('#lo').onclick = () => signOut();
}

// ---------- kerangka ----------
function shell() {
  const ini = esc((nickOf() || '?').slice(0, 2).toUpperCase());
  root.innerHTML = `<div class="ra-shell">
    <aside class="ra-side"><img class="pk-logo" src="/img/pokama-logo.png" alt="Pokama"><span class="ra-grp">KERJA LAPANGAN</span>
      <nav class="ra-nav" aria-label="Menu">${NAV.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${ico(k, 20)}${l === 'Absen' ? 'Clock in / out' : l}<small data-flag="${k}"></small></a>`).join('')}</nav>
      <span class="ra-grp" style="margin-top:12px">MENU</span>
      <nav class="ra-nav ra-nav2">${MENU.slice(6).map(([h, e, l]) => `<a href="#/${h}" data-k="${h}"><span class="em">${ri(e, 19)}</span>${l}</a>`).join('')}</nav>
      <div class="ra-me"><span class="av">${ini}</span><span><b>${esc(nickOf())}</b><small>${esc(ctx.me.title || 'Petugas operasional')}</small></span><button type="button" data-out>Keluar</button></div></aside>
    <main class="ra-main" id="view"></main>
    <nav class="ra-bottom" aria-label="Menu bawah">${NAV.map(([k, l]) => k === 'absen' ? `<a href="#/absen" data-k="absen" class="fab"><span>${ico('absen', 26)}</span>${l}</a>` : `<a href="#/${k}" data-k="${k}"><span>${ico(k, 21)}</span>${l}</a>`).join('')}</nav></div>`;
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-out]')) { if (await confirmBox('Keluar dari Kerja Lapangan?', 'Keluar')) signOut(); return; }
    const g = e.target.closest('[data-go]'); if (g) { location.hash = '#/' + g.dataset.go; return; }
    const c = e.target.closest('[data-cancel]'); if (c) { const [t, id] = c.dataset.cancel.split(':'); if (!await confirmBox('Batalkan pengajuan ini?', 'Ya, batalkan')) return;
      try { await db.rpc(t === 'lembur' ? 'ops_ot_cancel' : ['reimburse', 'kasbon'].includes(t) ? 'ops_claim_cancel' : 'ops_leave_cancel', { p_id: id }); toast('Dibatalkan'); reload(); } catch (er) { toast(er.message, 'err'); } }
  });
}

let H = null, WHO = {};
const qp = () => new URLSearchParams(location.hash.split('?')[1] || '');
// data utama disimpan (memori + localStorage) supaya pindah menu & buka ulang aplikasi langsung tampil, lalu diperbarui di belakang
let CACHE = { H: null, G: null, R: null, t: 0 }, FORCE = false, DIRTY = false, SEQ = 0;
const ckey = () => 'ops.cache.' + (ctx.me && ctx.me.id);
function loadCache() { try { const c = JSON.parse(localStorage.getItem(ckey()) || 'null'); if (c && c.day === today()) CACHE = c; } catch (e) {} }
async function fetchData() {
  const [h, g, r] = await Promise.all([db.rpc('ops_home'), db.rpc('ops_game').catch(() => null), db.rpc('ops_requests').catch(() => [])]);
  CACHE = { H: h, G: g, R: r || [], t: Date.now(), day: today() }; try { localStorage.setItem(ckey(), JSON.stringify(CACHE)); } catch (e) {}
}
document.addEventListener('input', () => { DIRTY = true; }, true); document.addEventListener('change', () => { DIRTY = true; }, true);
async function route() {
  let k = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (k === 'shift') k = 'beranda'; if (k === 'cuti') k = 'pengajuan';
  if (!VIEWS[k]) k = 'beranda';
  const navK = k === 'ajukan' ? 'pengajuan' : k, force = FORCE, seq = ++SEQ; FORCE = false; DIRTY = false;
  document.querySelectorAll('[data-k]').forEach(a => a.classList.toggle('on', a.dataset.k.split('?')[0] === navK));
  const el = document.getElementById('view'); window.scrollTo(0, 0);
  const paint = async () => { el.onclick = null; el.onsubmit = null; H = CACHE.H; flags(); await VIEWS[k](el); document.title = (document.querySelector('.ra-hero h1') || {}).textContent + ' · Kerja Lapangan'; };
  try {
    const fresh = CACHE.H && Date.now() - CACHE.t < 45000 && !force;
    if (CACHE.H && !force) await paint(); else el.innerHTML = '<div class="loading">Memuat…</div>';
    if (fresh) return;
    await fetchData();
    if (seq !== SEQ) return;                       // sudah pindah halaman
    if (!el.firstElementChild || el.querySelector('.loading') || !DIRTY) { const y = window.scrollY; await paint(); window.scrollTo(0, y); }
  } catch (e) { if (!CACHE.H) el.innerHTML = `<div class="ra-body" style="margin-top:20px"><div class="card"><h2>Gagal memuat</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Muat ulang</button></div></div>`; else toast('Koneksi lambat, menampilkan data terakhir', 'err'); }
}
const reload = () => { FORCE = true; route(); };
const go = (h) => { FORCE = true; if (location.hash === '#/' + h) route(); else location.hash = '#/' + h; };
function flags() {
  const att = H.att, isIn = !!(att && att.clock_in);
  document.querySelectorAll('[data-flag="absen"]').forEach(x => x.textContent = isIn ? (att.clock_out ? 'selesai' : '✓ ' + clock(att.clock_in)) : 'belum');
}
const state = () => { const att = H.att || null; return { att, isIn: !!(att && att.clock_in), isOut: !!(att && att.clock_out) }; };
const ckDone = (ph) => { const items = (H.items || []).filter(i => i.phase === ph), done = ((H.checks || {})[ph] || {}).items || []; return { items, done, ok: items.every(i => done.includes(i.id)) }; };

// ---------- Beranda ----------
async function vBeranda(el) {
  const A = H.assigns || [], sch = H.schedule, { att, isIn, isOut } = state();
  const B = ckDone('buka'), T = ckDone('tutup');
  const g = CACHE.G, reqs = CACHE.R || [];
  const pend = (reqs || []).filter(r => r.status === 'diajukan' || r.status === 'menunggu_keuangan').length;
  el.innerHTML = `${hero(esc(nickOf()), A.length ? A.map(a => esc(a.pos.label) + ' · ' + esc(a.branch)).join(' / ') : esc(ctx.me.title || 'Petugas operasional'))}
  ${flowCard()}
  <section class="card"><div class="qm">${MENU.map(([h, e, l]) => `<a href="#/${h}" class="qi"><span>${ri(e, 24)}</span>${l}${h === 'panel' && !(isIn && !isOut) ? `<i class="lk">${ri('kunci', 12)}</i>` : ''}${h === 'ceklis' && isIn && !isOut && !B.ok ? '<i class="dot"></i>' : ''}</a>`).join('')}</div></section>
  ${g ? `<a class="card gm-mini-card" href="#/performa"><div class="gm-badge sm"><small>Lv</small><b>${g.level}</b></div><div style="flex:1;min-width:0"><b>${esc(g.title)} · ${g.xp.toLocaleString('id-ID')} XP</b><div class="gm-bar" style="margin:6px 0"><i style="width:${Math.max(4, Math.min(100, Math.round((g.xp - g.lvl_from) / Math.max(1, g.lvl_to - g.lvl_from) * 100)))}%"></i></div><small class="muted">${g.streak}× tepat waktu beruntun · peringkat #${g.rank || '—'} bulan ini</small></div><span class="go">›</span></a>` : ''}
  <section class="card"><div class="row between"><h2>Pengajuan terbaru</h2><a class="small" href="#/pengajuan">Lihat semua${pend ? ' · ' + pend + ' menunggu' : ''}</a></div>
    <div class="list ra-list">${(reqs || []).slice(0, 3).map(reqRow).join('') || '<p class="muted small">Belum ada pengajuan.</p>'}</div></section>
  ${(H.next || []).length ? `<section class="card absen"><b>${H.next[0].kind === 'mutasi' ? 'Mutasi' : 'Penugasan'} berikutnya:</b> ${esc(H.next[0].pos.label)} · ${esc(H.next[0].branch)} mulai ${fdate(H.next[0].start_day)}${H.next[0].reason ? '<br><small class="muted">' + esc(H.next[0].reason) + '</small>' : ''}</section>` : ''}
  </div>`;
  wireCk(el); wirePanel(el);
}
const reqRow = (r) => { const t = TYPES[r.type] || [r.type, 'slip'];
  const what = r.type === 'lembur' ? fdate(r.day) + ' · ' + hm(r.starts) + '–' + hm(r.ends) + ' (' + jam(r.minutes) + ')' : ['reimburse', 'kasbon'].includes(r.type) ? rp(r.amount) + ' · ' + fdate(r.day) + (r.paid_at ? ' · ✓ sudah ' + (r.type === 'kasbon' ? 'dicairkan' : 'ditransfer') : r.pay === 'segera' && r.type === 'reimburse' ? ' · transfer segera' : r.type === 'reimburse' ? ' · dibayar bersama gaji' : '') : fdate(r.day) + (r.end_day && r.end_day !== r.day ? ' – ' + fdate(r.end_day) : '');
  return `<div class="li"><span class="ty">${ri(t[1], 20)}</span><span><b>${t[0]}</b> ${r.assigned ? '<span class="chip blue">Ditugaskan</span>' : chipS(r.status)}<br><small>${what}</small><br><small class="muted">${esc(r.note || '')}${r.by && r.status !== 'diajukan' ? ' · ' + esc(r.by) : ''}</small>${r.reply ? `<p class="reject-note${r.status === 'ditolak' ? '' : ' ok'}">${esc(r.reply)}</p>` : ''}</span>${r.status === 'diajukan' && !r.assigned ? `<button class="btn sm" data-cancel="${r.type}:${r.id}">Batalkan</button>` : ''}</div>`; };

// ---------- Clock in / out ----------
async function vAbsen(el) {
  if (state().isIn && !state().isOut) return vSelesai(el);
  const A = H.assigns || [], sch = H.schedule, { att, isIn, isOut } = state(), T = ckDone('tutup');
  const brs = [...new Map(A.map(a => [a.branch_id, a])).values()];
  const late = !isIn && sch && sch.starts && nowHM() > String(sch.starts).slice(0, 5);
  const title = isOut ? 'Shift selesai' : isIn ? 'Clock Out' : 'Clock In';
  el.innerHTML = `${hero(title, fdate(today()) + ' · ' + nowHM().replace(':', '.') + (sch ? ' · jadwal ' + hm(sch.starts) + '–' + hm(sch.ends) : ''), 'beranda')}
  ${!A.length ? `<section class="card"><h2>Belum ada penugasan</h2><p class="muted">Absen bisa dilakukan setelah Operasional menugaskan Anda ke posisi dan cabang.${WHO.mgr ? ' <a href="#/coba">Coba sebagai petugas →</a>' : ''}</p></section>`
  : isOut ? `<section class="ra-now"><div class="clk"><div class="cin done"><small>Clock In</small><b>${clock(att.clock_in)}</b></div><div class="cout done"><small>Clock Out</small><b>${clock(att.clock_out)}</b></div></div><p class="muted small" style="margin:0">Terima kasih. Lembur? <a href="#/ajukan?k=lembur">Ajukan lembur</a></p></section>`
  : !isIn ? `<section class="ra-now stack">
      ${brs.length > 1 ? `<label class="fld"><span>Lokasi kerja</span><select class="inp" id="abr">${brs.map(a => `<option value="${a.branch_id}">${esc(a.branch)}</option>`).join('')}</select></label>` : `<input type="hidden" id="abr" value="${brs[0].branch_id}"><div><span class="lbl">Lokasi kerja</span><div style="font-weight:800;font-size:16px">${esc(brs[0].branch)}</div></div>`}
      <label class="ra-shot" id="shot"><span id="selt">${ri('kamera', 22)} Ambil foto selfie</span><input type="file" accept="image/*" capture="user" id="self" hidden></label>
      <div class="ra-loc">${ri('pin', 18)} <span id="locst" class="muted">mengambil lokasi…</span><button type="button" class="btn sm" id="locbtn">Perbarui</button></div>
      ${late ? `<label class="fld"><span>Catatan telat (wajib)</span><textarea class="inp" id="anote" rows="2" placeholder="Contoh: ban bocor di jalan"></textarea></label>` : `<label class="fld"><span>Catatan (opsional)</span><input class="inp" id="anote" placeholder="Contoh: langsung ke lokasi tamu"></label>`}
      <button class="btn pri ra-big" data-a="in">Clock In sekarang</button></section>`
  : `<section class="ra-now stack"><div class="clk"><div class="cin done"><small>Clock In</small><b>${clock(att.clock_in)}</b><i>${att.late > 0 ? 'telat ' + jam(att.late) : 'tepat waktu'}</i></div><div class="cout"><small>Clock Out</small><b>${nowHM().replace(':', '.')}</b><i>sekarang</i></div></div>
      ${H.open_shift ? '<div class="note small" style="margin:0;border-color:#F3C1BA;background:#FBE9E7">Kas shift masih terbuka. Tutup shift dulu di <a href="#/panel">panel Kasir</a>.</div>' : ''}
      ${T.items.length ? `<div><div class="row between"><h2 style="margin:0">Ceklis tutup</h2>${T.ok ? '<span class="chip green">lengkap</span>' : `<span class="chip yellow">${T.done.length}/${T.items.length}</span>`}</div>${ckForm('tutup')}</div>` : ''}
      <button class="btn ra-big ra-dark" data-a="out">Clock Out sekarang</button></section>`}
  </div>`;
  let loc = null, photo = null; const st = el.querySelector('#locst');
  const takeLoc = async () => { if (!st) return; st.textContent = 'mengambil lokasi…'; st.className = 'muted';
    try { loc = await getLocation(); const b = A.find(a => a.branch_id === el.querySelector('#abr').value) || {}; const R = +H.radius || 150;
      const d = b.lat != null && b.lng != null ? dist(loc.lat, loc.lng, b.lat, b.lng) : null;
      st.textContent = d == null ? 'lokasi terbaca (±' + Math.round(loc.acc) + ' m)' : d <= R ? `di area kerja (${Math.round(d)} m)` : `di luar area kerja (${Math.round(d)} m)`; st.className = d != null && d > R ? 'red' : 'green-t'; }
    catch (e) { loc = null; st.textContent = e.message; st.className = 'red'; } };
  if (st) { takeLoc(); el.querySelector('#locbtn').onclick = takeLoc; const s = el.querySelector('#abr'); if (s.tagName === 'SELECT') s.onchange = takeLoc; }
  const sf = el.querySelector('#self'); if (sf) sf.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const t = el.querySelector('#selt'); t.textContent = 'Mengunggah…';
    try { const blob = await shrinkImage(f, 900, .8); const uid = (ctx.byId[ctx.me.id] || {}).user_id; photo = await uploadPhoto('operasional', 'absen/' + uid + '/' + today() + '.jpg', blob);
      el.querySelectorAll('#shot img').forEach(x => x.remove()); const img = document.createElement('img'); img.src = URL.createObjectURL(blob); img.alt = 'Selfie'; el.querySelector('#shot').appendChild(img); t.textContent = ''; }
    catch (er) { photo = null; t.textContent = 'Ambil ulang foto'; toast(er.message, 'err'); } };
  wireCk(el);
  el.onclick = async (e) => { const a = e.target.closest('[data-a]'); if (!a) return;
    try {
      if (a.dataset.a === 'in') { if (!photo) return toast('Ambil foto selfie dulu', 'err'); const note = (el.querySelector('#anote') || {}).value || '';
        if (late && !note.trim()) return toast('Tulis catatan telat dulu', 'err'); a.disabled = true;
        const r = await db.rpc('ops_clock_in', { p_branch: el.querySelector('#abr').value, p_selfie: photo, p_lat: loc ? loc.lat : null, p_lng: loc ? loc.lng : null, p_note: note.trim() || null });
        toast(r.late_minutes > 0 ? 'Clock in ' + clock(r.clock_in) + ' · telat ' + jam(r.late_minutes) : 'Clock in ' + clock(r.clock_in) + ' · tepat waktu', r.late_minutes > 0 ? 'err' : undefined); return go('beranda'); }
      if (a.dataset.a === 'out') { if (H.open_shift) return toast('Kas shift masih terbuka. Tutup shift dulu di panel Kasir.', 'err'); if (!T.ok) return toast('Lengkapi dan simpan ceklis tutup dulu', 'err');
        if (!await confirmBox('Clock out sekarang?', 'Clock Out')) return; await db.rpc('ops_clock_out'); toast('Clock out tercatat'); return go('beranda'); }
    } catch (er) { a.disabled = false; toast(er.message, 'err'); }
  };
}
function ckForm(ph, lbl) { const A = H.assigns || [], { items, done } = ckDone(ph), g = {};
  items.forEach(i => { const n = i.position ? ((A.find(a => a.position === i.position) || {}).pos || {}).label || i.position : 'Semua posisi'; (g[n] = g[n] || []).push(i); });
  return `<form class="ra-ck" data-ck="${ph}">${Object.entries(g).map(([n, is]) => `<h4>${esc(n)}</h4>${is.map(i => `<label><input type="checkbox" name="${i.id}" ${done.includes(i.id) ? 'checked' : ''}><span>${esc(i.label)}</span></label>`).join('')}`).join('')}
    <button class="btn ${ph === 'buka' || lbl ? 'pri' : ''} ra-big" type="submit" style="margin-top:10px">${lbl || 'Simpan ceklis ' + ph}</button></form>`; }
function wireCk(el) { el.onsubmit = async (e) => { const f = e.target.closest('[data-ck]'); if (!f) return; e.preventDefault();
  try { await db.rpc('ops_check_save', { p_phase: f.dataset.ck, p_items: [...f.querySelectorAll('input:checked')].map(i => i.name) }); toast('Ceklis ' + f.dataset.ck + ' tersimpan'); reload(); } catch (er) { toast(er.message, 'err'); } }; }

// ---------- Alur satu tombol: absen masuk → ceklis buka → bekerja → selesai shift ----------
const stage = () => { const { isIn, isOut } = state(), B = ckDone('buka'); return !isIn ? 1 : isOut ? 4 : (B.items.length && !B.ok) ? 2 : 3; };
const progBar = (n) => `<div class="fl-prog">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
const pastEnd = () => { const sch = H.schedule; if (!sch || !sch.ends) return 0; const [h, m] = String(sch.ends).slice(0, 5).split(':').map(Number), [nh, nm] = nowHM().split(':').map(Number); return (nh * 60 + nm) - (h * 60 + m); };
function flowCard() {
  const sch = H.schedule, { att } = state(), B = ckDone('buka'), n = stage(), A = H.assigns || [];
  const shiftTxt = sch && sch.starts ? esc(sch.shift || 'Shift') + ' · ' + hm(sch.starts) + ' – ' + hm(sch.ends) : sch ? esc(sch.shift || 'Libur') : 'Belum ada jadwal shift';
  if (!A.length) return `<section class="ra-now"><span class="lbl">${fdate(today())}</span><div class="sh">${shiftTxt}</div>${WHO.mgr ? '<div class="note small" style="margin:0">Anda masuk sebagai Operasional. <a href="#/coba">Coba sebagai petugas →</a></div>' : '<div class="note small" style="margin:0">Belum ada penugasan. Hubungi Operasional.</div>'}</section>`;
  if (n === 1) { const toStart = sch && sch.starts ? (() => { const [h, m] = String(sch.starts).slice(0, 5).split(':').map(Number), [nh, nm] = nowHM().split(':').map(Number); return h * 60 + m - (nh * 60 + nm); })() : null;
    return `<section class="ra-now fl"><div class="row between"><div><span class="lbl">Shift hari ini</span><div class="sh">${shiftTxt}</div><small class="muted">${sch && sch.branch ? esc(sch.branch) : 'Jadwal diatur Operasional'}</small></div>
      ${toStart != null ? `<span class="ra-pill ${toStart < 0 ? 'bad' : 'warn'}">${toStart < 0 ? 'telat ' + jam(-toStart) : toStart < 120 ? 'mulai ' + jam(toStart) : 'mulai ' + hm(sch.starts)}</span>` : ''}</div>
      <button class="btn pri ra-big fl-btn" data-go="absen">${ri('kamera', 22)} Absen masuk</button><small class="muted fl-sub">Foto selfie + lokasi${sch && sch.starts ? ' · toleransi telat 5 menit' : ''}</small>${progBar(1)}</section>`; }
  if (n === 2) return `<section class="ra-now fl"><div class="row between"><div><span class="lbl">Masuk ${clock(att.clock_in)} · ${att.late > 0 ? 'telat ' + jam(att.late) : 'tepat waktu ✓'}</span><div class="sh">Ceklis buka · ${B.done.length} dari ${B.items.length}</div></div></div>
      ${ckForm('buka', 'Simpan & mulai kerja →')}<small class="muted fl-sub">Panel kerja terbuka setelah ceklis buka lengkap</small>${progBar(2)}</section>`;
  if (n === 3) { const pe = pastEnd();
    return `<section class="ra-now fl"><div class="row between"><div><span class="lbl">Bertugas sejak ${clock(att.clock_in)}</span><div class="sh">Selamat bekerja!</div><small class="muted">${shiftTxt}</small></div><span class="ra-pill ok">Bertugas</span></div>
      ${panelCards(true)}
      ${pe > 30 ? `<div class="note small" style="margin:0">Sudah ${jam(pe)} lewat jam pulang. Saat selesai shift, Anda bisa langsung mengajukan lembur.</div>` : ''}
      <button class="btn ra-big ra-dark fl-btn" data-go="selesai">🏁 Selesai shift</button><small class="muted fl-sub">${sch && sch.ends ? 'Pulang dijadwalkan ' + hm(sch.ends) : 'Tutup kas → ceklis tutup → absen pulang'}</small>${progBar(3)}</section>`; }
  return `<section class="ra-now fl"><div class="row between"><div><span class="lbl">Shift selesai</span><div class="sh">${clock(att.clock_in)} – ${clock(att.clock_out)}</div><small class="muted">Terima kasih, sampai jumpa besok 👋</small></div><span class="ra-pill">Selesai</span></div>
    <div class="row gap"><a class="btn sm" href="#/kehadiran">Riwayat kehadiran</a><a class="btn sm" href="#/ajukan?k=lembur">Ajukan lembur</a></div>${progBar(4)}</section>`;
}
// Selesai shift: tutup kas → ceklis tutup → absen pulang, berurutan di satu layar
async function vSelesai(el) {
  const { att, isIn, isOut } = state(), T = ckDone('tutup'), A = H.assigns || [], sch = H.schedule;
  if (!isIn || isOut) { go('beranda'); return; }
  const kasA = A.find(a => ['kasir', 'kepala_cabang'].includes(a.position)), kasOk = !H.open_shift, ckOk = T.ok;
  const now = !kasOk ? 1 : !ckOk ? 2 : 3, pe = pastEnd();
  const step = (i, title, sub, body) => `<div class="fl-step${i < now ? ' done' : i === now ? ' now' : ''}"><span class="n">${i < now ? '✓' : i}</span><div style="flex:1;min-width:0"><b>${title}</b><small class="muted">${sub}</small>${i === now ? body : ''}</div></div>`;
  el.innerHTML = `${hero('Selesai shift', fdate(today()) + ' · ' + nowHM().replace(':', '.') + (sch && sch.ends ? ' · jadwal pulang ' + hm(sch.ends) : ''), 'beranda')}
  <section class="ra-now fl"><span class="lbl">3 langkah, berurutan</span>
    ${step(1, 'Tutup kas', !kasA && kasOk ? 'Tidak ada kas yang perlu ditutup' : kasOk ? 'Kas shift sudah ditutup' : 'Kas shift masih terbuka', `<button class="btn pri ra-big" style="margin-top:10px" data-start="${kasA ? kasA.id : (A[0] || {}).id}">Tutup kas di panel Kasir →</button><small class="muted fl-sub">Panel terbuka di tab baru. Setelah kas ditutup, kembali ke sini.</small><button class="btn sm" style="margin-top:8px" data-a="cek">Sudah ditutup, cek lagi</button>`)}
    ${step(2, 'Ceklis tutup', T.items.length ? (T.done.length + ' dari ' + T.items.length + (T.ok ? ' · lengkap' : '')) : 'Tidak ada ceklis tutup', T.items.length ? ckForm('tutup', 'Simpan ceklis tutup →') : '')}
    ${step(3, 'Absen pulang', 'Jam pulang tercatat ' + nowHM().replace(':', '.'), `${pe > 30 ? `<label class="chk" style="margin-top:10px"><input type="checkbox" id="otq" checked><span><b>Ajukan lembur ${jam(pe)}</b><small class="muted">${hm(sch.ends)} – ${nowHM().replace(':', '.')} · diputuskan Operasional</small></span></label><input class="inp" id="otr" placeholder="Alasan lembur (wajib bila diajukan)" style="margin-top:6px">` : ''}<button class="btn ra-big ra-dark" style="margin-top:10px" data-a="out">Absen pulang sekarang</button>`)}
    ${progBar(4)}</section>
  <p class="muted small" style="margin:0;text-align:center">Lupa absen pulang? Tercatat otomatis 1 jam setelah shift berakhir.</p></div>`;
  wireCk(el); wirePanel(el);
  const prev = el.onclick;
  el.onclick = async (e) => { const a = e.target.closest('[data-a]'); if (!a) return prev && prev(e);
    try {
      if (a.dataset.a === 'cek') return reload();
      if (a.dataset.a === 'out') { const q = el.querySelector('#otq'), why = ((el.querySelector('#otr') || {}).value || '').trim();
        if (q && q.checked && !why) return toast('Tulis alasan lembur, atau hapus centang lembur', 'err');
        if (!await confirmBox('Absen pulang sekarang?', 'Absen pulang')) return; a.disabled = true;
        await db.rpc('ops_clock_out');
        if (q && q.checked) { try { await db.rpc('ops_ot_request', { p_day: today(), p_starts: String(sch.ends).slice(0, 5), p_ends: nowHM(), p_reason: why }); toast('Absen pulang tercatat · lembur diajukan'); } catch (er) { toast('Absen pulang tercatat, tapi lembur gagal diajukan: ' + er.message, 'err'); } }
        else toast('Absen pulang tercatat · terima kasih!');
        return go('beranda'); }
    } catch (er) { a.disabled = false; toast(er.message, 'err'); }
  };
}

// ---------- Ceklis ----------
async function vCeklis(el) { const { isIn, isOut } = state(), B = ckDone('buka'), T = ckDone('tutup');
  el.innerHTML = `${hero('Ceklis', 'Buka di awal shift, tutup sebelum clock out.', 'beranda')}
  ${!isIn ? '<section class="card absen">Clock in dulu untuk mengisi ceklis. <a href="#/absen">Clock In →</a></section>' : ''}
  <section class="card"><div class="row between"><h2>Ceklis buka</h2>${B.ok ? '<span class="chip green">lengkap</span>' : `<span class="chip yellow">${B.done.length}/${B.items.length}</span>`}</div>${isIn && !isOut ? ckForm('buka') : `<p class="muted small">${B.done.length}/${B.items.length} selesai</p>`}</section>
  <section class="card"><div class="row between"><h2>Ceklis tutup</h2>${T.ok && T.done.length ? '<span class="chip green">lengkap</span>' : `<span class="chip yellow">${T.done.length}/${T.items.length}</span>`}</div>${isIn && !isOut ? ckForm('tutup') : `<p class="muted small">${T.done.length}/${T.items.length} selesai</p>`}</section></div>`;
  wireCk(el); }

// ---------- Kehadiran (riwayat) ----------
async function vKehadiran(el) {
  const m = qp().get('m') || today().slice(0, 7) + '-01'; const R = await db.rpc('ops_attendance', { p_month: m }); const s = R.sum || {};
  const prev = addDays(m, -1).slice(0, 7) + '-01', next = addDays(m, 32).slice(0, 7) + '-01', isCur = m.slice(0, 7) === today().slice(0, 7);
  const label = new Date(m + 'T00:00:00Z').toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  el.innerHTML = `${hero('Kehadiran', 'Riwayat clock in / out dan ringkasan bulanan')}
  <section class="ra-now"><div class="row between"><a class="btn sm" href="#/kehadiran?m=${prev}">‹</a><b style="font-size:16px">${label}</b>${isCur ? '<span style="width:40px"></span>' : `<a class="btn sm" href="#/kehadiran?m=${next}">›</a>`}</div>
    <div class="ra-grid3"><div class="ra-kpi"><span>Hadir</span><b>${s.hadir}${s.jadwal ? ' / ' + s.jadwal : ''}</b><small>hari</small></div><div class="ra-kpi"><span>Telat</span><b class="${s.telat ? 'red' : ''}">${s.telat}</b><small>${s.hadir ? Math.round(s.telat / s.hadir * 100) + '% dari hadir' : '—'}</small></div><div class="ra-kpi"><span>Jam kerja</span><b>${jam(s.menit)}</b><small>total</small></div></div></section>
  <section class="card"><div class="list att-list">${(R.days || []).map(d => { const a = d.att;
    const tag = a ? (a.late > 0 ? '<span class="chip yellow">Telat ' + jam(a.late) + '</span>' : '<span class="chip green">Hadir</span>') : d.leave ? `<span class="chip blue">${(TYPES[d.leave] || [d.leave])[0]}</span>` : d.holiday ? `<span class="chip blue">Libur · ${esc(d.holiday)}</span>` : d.sched && d.day < today() ? '<span class="chip red">Tidak hadir</span>' : d.sched ? '<span class="chip gray">Terjadwal</span>' : '<span class="chip gray">Libur</span>';
    return `<div class="li"><span class="dd"><b>${new Date(d.day + 'T00:00:00Z').getUTCDate()}</b><small>${fdate(d.day).split(' ')[0]}</small></span><span style="flex:1;min-width:0"><div class="row between"><b>${a ? clock(a.in) + ' – ' + (a.out ? clock(a.out) : '…') : d.sched ? hm(d.sched.starts) + ' – ' + hm(d.sched.ends) : '—'}</b>${tag}</div><small class="muted">${a ? (a.branch ? esc(a.branch) : '') + (a.mins ? ' · ' + jam(a.mins) : '') + (a.inside === false ? ' · di luar area' : '') + (a.auto ? ' · pulang otomatis (lupa absen pulang)' : '') : d.sched ? esc(d.sched.shift || '') : ''}</small>${a && a.note && a.note.replace('[absen pulang otomatis]', '').trim() ? `<br><small class="muted">Catatan: ${esc(a.note.replace('[absen pulang otomatis]', '').trim())}</small>` : ''}</span></div>`; }).join('') || '<p class="muted small">Belum ada data.</p>'}</div></section></div>`;
}

// ---------- Pengajuan ----------
async function vPengajuan(el) {
  const f = qp().get('f') || 'semua'; const all = CACHE.R || [];
  const isW = r => r.status === 'diajukan' || r.status === 'menunggu_keuangan';
  const list = all.filter(r => f === 'semua' || r.status === f || (f === 'diajukan' && isW(r)));
  el.innerHTML = `${hero('Pengajuan', 'Cuti, izin, sakit, lembur, reimburse, dan kasbon')}
  <section class="ra-now"><span class="lbl">Ajukan baru</span><div class="qm qm6">${Object.entries(TYPES).map(([k, [l, e]]) => `<a href="#/ajukan?k=${k}" class="qi"><span>${ri(e, 24)}</span>${l}</a>`).join('')}</div></section>
  <div class="seg">${[['semua', 'Semua'], ['diajukan', 'Menunggu'], ['disetujui', 'Disetujui'], ['ditolak', 'Ditolak']].map(([k, l]) => `<a href="#/pengajuan?f=${k}" class="${f === k ? 'on' : ''}">${l}${k === 'diajukan' ? ' (' + all.filter(isW).length + ')' : ''}</a>`).join('')}</div>
  <section class="card"><div class="list ra-list">${list.map(reqRow).join('') || '<p class="muted small">Tidak ada pengajuan.</p>'}</div></section></div>`;
}
async function vAjukan(el) {
  const k = TYPES[qp().get('k')] ? qp().get('k') : 'cuti', [label, em] = TYPES[k], sch = H.schedule;
  let L = null; if (k === 'cuti') { try { L = await db.rpc('ops_leave_list'); } catch (e) {} }
  const t0 = today(), d1 = k === 'cuti' ? addDays(t0, 1) : t0;
  const body = k === 'lembur' ? `<label class="fld"><span>Tanggal</span><input type="date" class="inp" name="d1" value="${t0}" min="${addDays(t0, -7)}" max="${addDays(t0, 7)}"></label>
      <div class="g2"><label class="fld"><span>Mulai</span><input type="time" class="inp" name="s" value="${sch && sch.ends ? String(sch.ends).slice(0, 5) : '17:00'}"></label><label class="fld"><span>Selesai</span><input type="time" class="inp" name="e" value="19:00"></label></div>
      <label class="fld"><span>Alasan</span><textarea class="inp" name="why" rows="3" placeholder="Contoh: antar unit ke Kamojang, tamu telat kembali"></textarea></label>`
    : ['reimburse', 'kasbon'].includes(k) ? `<label class="fld"><span>Tanggal</span><input type="date" class="inp" name="d1" value="${t0}"></label>
      <label class="fld"><span>Nominal (Rp)</span><input class="inp" name="amt" inputmode="numeric" placeholder="0"></label>
      ${k === 'reimburse' ? `<label class="fld"><span>Kategori</span><select class="inp" name="cat"><option>Bensin / transport</option><option>Parkir & tol</option><option>Makan tugas</option><option>Perlengkapan kerja</option><option>Lainnya</option></select></label>
      <label class="ra-shot" id="shot" style="min-height:110px"><span id="selt">${ri('kamera', 22)} Foto nota / bukti (wajib)</span><input type="file" accept="image/*" capture="environment" id="nota" hidden></label>
      <div class="fld"><span>Dibayar</span><div class="g2"><label class="chk"><input type="radio" name="pay" value="gaji" checked> Bersama gaji</label><label class="chk"><input type="radio" name="pay" value="segera"> Transfer segera</label></div><small class="muted">Transfer segera dibayar Keuangan setelah disetujui, tidak menunggu gajian.</small></div>` : `<p class="note small" style="margin:0">Kasbon dicairkan Keuangan setelah disetujui, lalu dipotong dari gaji bulan ini.</p>`}
      <label class="fld"><span>Keterangan</span><textarea class="inp" name="why" rows="3" placeholder="${k === 'kasbon' ? 'Contoh: keperluan keluarga, dipotong gaji bulan ini' : 'Contoh: bensin antar unit ke Cipanas'}"></textarea></label>`
    : `<div class="g2"><label class="fld"><span>Mulai</span><input type="date" class="inp" name="d1" value="${d1}"></label><label class="fld"><span>Sampai</span><input type="date" class="inp" name="d2" value="${d1}"></label></div>
      <label class="fld"><span>Alasan</span><textarea class="inp" name="why" rows="3" placeholder="${k === 'sakit' ? 'Contoh: demam, sudah ke klinik' : k === 'izin' ? 'Contoh: urusan keluarga' : 'Contoh: acara pernikahan saudara'}"></textarea></label>
      ${k === 'cuti' && L ? `<p class="note small" style="margin:0">Sisa cuti ${Math.max(0, L.quota - L.used)} dari ${L.quota} hari (hari libur perusahaan tidak dihitung).</p>` : ''}`;
  el.innerHTML = `${hero('Ajukan ' + label.toLowerCase(), 'Diputuskan Operasional · kabar masuk lewat notifikasi', 'pengajuan')}
  <form class="ra-now stack" id="fa">${body}<button class="btn pri ra-big" type="submit">Kirim pengajuan</button></form></div>`;
  let photo = null; const nf = el.querySelector('#nota');
  if (nf) nf.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const t = el.querySelector('#selt'); t.textContent = 'Mengunggah…';
    try { const blob = await shrinkImage(f, 1280, .8); const uid = (ctx.byId[ctx.me.id] || {}).user_id; photo = await uploadPhoto('operasional', 'klaim/' + uid + '/' + Date.now() + '.jpg', blob);
      const img = document.createElement('img'); img.src = URL.createObjectURL(blob); img.alt = 'Nota'; el.querySelector('#shot').appendChild(img); t.textContent = ''; } catch (er) { photo = null; t.textContent = 'Foto ulang'; toast(er.message, 'err'); } };
  const amt = el.querySelector('[name=amt]'); if (amt) amt.oninput = () => { const v = amt.value.replace(/\D/g, ''); amt.value = v ? (+v).toLocaleString('id-ID') : ''; };
  el.querySelector('#fa').onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const b = e.submitter; b.disabled = true;
    try { need((f.why || '').trim(), 'Tulis keterangan');
      if (k === 'lembur') await db.rpc('ops_ot_request', { p_day: f.d1, p_starts: f.s, p_ends: f.e, p_reason: f.why.trim() });
      else if (['reimburse', 'kasbon'].includes(k)) { const n = +String(f.amt || '').replace(/\D/g, ''); if (!n) throw new Error('Isi nominal'); if (k === 'reimburse' && !photo) throw new Error('Lampirkan foto nota');
        const args = { p_kind: k, p_day: f.d1, p_amount: n, p_category: f.cat || null, p_note: f.why.trim(), p_photo: photo, p_pay: f.pay || 'gaji' };
        try { await db.rpc('ops_claim_submit', args); }
        catch (er) { if (!/DUPLIKAT/.test(er.message)) throw er;
          if (!await confirmBox(er.message.replace(/^.*DUPLIKAT:\s*/, ''), 'Tetap ajukan')) { b.disabled = false; return; }
          await db.rpc('ops_claim_submit', { ...args, p_force: true }); } }
      else await db.rpc('ops_leave_request', { p_kind: k, p_d1: f.d1, p_d2: f.d2 || f.d1, p_reason: f.why.trim() });
      toast(label + ' diajukan ke Operasional'); go('pengajuan'); } catch (er) { b.disabled = false; toast(er.message, 'err'); } };
}

// ---------- Slip gaji ----------
async function vSlip(el) {
  const S = await db.rpc('ops_payslips'); const per = (p) => { const [y, m] = String(p).split('-'); return m ? new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : p; };
  const row = (l, v, neg) => v ? `<div class="li row between"><span>${l}</span><b class="${neg ? 'red' : ''}">${neg ? '−' : ''}${rp(v)}</b></div>` : '';
  el.innerHTML = `${hero('Slip gaji', 'Dari penggajian yang sudah disetujui', 'beranda')}
  ${S.length ? S.map((s, i) => `<details class="card slip"${i ? '' : ' open'}><summary class="row between"><span><b>${per(s.period)}</b><br><small class="muted">${s.status === 'paid' ? 'Dibayar ' + (s.paid_at ? ftime(s.paid_at) : '') : 'Disetujui, menunggu dibayar'}</small></span><b style="font-size:20px">${rp(s.net)}</b></summary>
    <div class="list">${row('Gaji pokok', s.base)}${row('Komisi', s.commission)}${row('Lembur' + (s.ot_minutes ? ' (' + Math.round(s.ot_minutes / 6) / 10 + ' jam)' : ''), s.overtime)}${row('Bonus', s.bonus)}${row('Reimburse', s.reimburse)}${row('Kekurangan kas', s.shortage, true)}${row('Kasbon', s.advance, true)}${row('Denda telat' + (s.late_count ? ' (' + s.late_count + '×)' : ''), s.late_fine, true)}
    <div class="li row between"><b>Diterima</b><b style="font-size:18px">${rp(s.net)}</b></div>${s.attendance ? `<p class="muted small">Kehadiran: ${esc(s.attendance)}</p>` : ''}</div></details>`).join('')
    : '<section class="ra-now"><b>Belum ada slip gaji</b><p class="muted small" style="margin:0">Slip muncul setelah penggajian periode Anda disetujui.</p></section>'}</div>`;
}

// ---------- Jadwal ----------
async function vJadwal(el) {
  let HL = []; try { HL = (await db.rpc('ops_holiday_list', {})) || []; } catch (e) {}
  const HU = HL.filter(h => h.day >= today());
  el.innerHTML = `${hero('Jadwal shift', '7 hari ke depan', 'beranda')}
  <section class="card"><div class="list">${(H.week || []).map(w => `<div class="li row gap"><span class="dd"><b>${new Date(w.day + 'T00:00:00Z').getUTCDate()}</b><small>${fdate(w.day).split(' ')[0]}</small></span><span style="flex:1"><b>${esc(w.shift || 'Shift')} · ${hm(w.starts)} – ${hm(w.ends)}</b><br><small class="muted">${esc(w.branch || '')}</small></span>${w.day === today() ? '<span class="chip green">Hari ini</span>' : ''}</div>`).join('') || '<p class="muted small">Jadwal belum diatur Operasional.</p>'}</div></section>
  ${HU.length ? `<section class="card"><h2>Hari libur perusahaan</h2><div class="list">${HU.map(h => `<div class="li row gap"><span class="dd"><b>${new Date(h.day + 'T00:00:00Z').getUTCDate()}</b><small>${fdate(h.day).split(' ')[0]}</small></span><span style="flex:1"><b>${esc(h.name)}</b><br><small class="muted">${esc(fdate(h.day))} · ${esc(h.branch || 'semua cabang')}</small></span></div>`).join('')}</div></section>` : ''}
  <section class="card"><h2>Penugasan</h2>${(H.next || []).map(n => `<p class="note small" style="margin-top:0"><b>${n.kind === 'mutasi' ? 'Mutasi' : 'Penugasan'} berikutnya:</b> ${esc(n.pos.label)} · ${esc(n.branch)} mulai ${fdate(n.start_day)}</p>`).join('')}
    <div class="list">${(H.history || []).map(x => `<div class="li row gap wrap"><b>${esc(x.pos.label)}</b><span style="flex:1">${esc(x.branch)} <small class="muted">${fdate(x.start_day, false)} – ${x.end_day ? fdate(x.end_day, false) : 'sekarang'}${x.kind !== 'awal' ? ' · ' + x.kind : ''}</small></span></div>`).join('') || '<p class="muted small">—</p>'}</div></section></div>`;
}

// ---------- Performa (gamifikasi) ----------
async function vPerforma(el) {
  const g = CACHE.G || await db.rpc('ops_game'), p = H.perf || {}, A = H.assigns || [];
  const pct = Math.max(4, Math.min(100, Math.round((g.xp - g.lvl_from) / Math.max(1, g.lvl_to - g.lvl_from) * 100)));
  const got = (g.badges || []).filter(b => b.got).length;
  el.innerHTML = `${hero('Performa saya', 'Kumpulkan XP, naik level, raih lencana', 'beranda')}
  <section class="ra-now"><div class="gm-lvl"><div class="gm-badge"><small>Level</small><b>${g.level}</b></div>
    <div style="flex:1;min-width:0"><span class="lbl">${esc(g.title)}</span><div style="font-size:26px;font-weight:800;line-height:1.1;margin:2px 0 8px">${g.xp.toLocaleString('id-ID')} XP</div>
      <div class="gm-bar"><i style="width:${pct}%"></i></div><small class="muted">${Math.max(0, g.lvl_to - g.xp).toLocaleString('id-ID')} XP lagi ke level ${g.level + 1}</small></div></div>
    <div class="ra-grid3"><div class="ra-kpi"><span>XP bulan ini</span><b>+${g.xp_month.toLocaleString('id-ID')}</b></div><div class="ra-kpi"><span>Peringkat</span><b>#${g.rank || '—'}</b><small>dari ${g.peers} petugas</small></div><div class="ra-kpi"><span>Lencana</span><b>${got} / ${(g.badges || []).length}</b><small>bulan ini</small></div></div></section>
  <section class="gm-streak"><span class="f">${ri('api', 34, '#E8590C')}</span><div><b>${g.streak} kali</b> <span class="muted">masuk tepat waktu berturut-turut</span><br><small class="muted">${g.streak >= 5 ? 'Mantap! Pertahankan rentetanmu.' : 'Masuk tepat waktu ' + (5 - g.streak) + ' kali lagi untuk lencana Tepat Waktu.'}</small></div></section>
  <section class="card"><div class="row between"><h2>Lencana bulan ini</h2><small class="muted">${got} diraih</small></div>
    <div class="gm-badges">${(g.badges || []).map(b => `<div class="gm-b${b.got ? ' got' : ''}"><span class="e">${ri(b.k, 24)}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${b.got ? '<span class="chip green" style="align-self:flex-start">diraih</span>' : `<div class="gm-mini"><i style="width:${Math.round(b.prog / Math.max(1, b.goal) * 100)}%"></i></div><small>${b.prog} / ${b.goal}</small>`}</div>`).join('')}</div></section>
  <section class="card gm-rank"><div class="row between"><h2>Papan peringkat bulan ini</h2><small class="muted">berdasarkan XP</small></div>
    <div class="list">${(g.top || []).map(t => `<div class="li${t.me ? ' me' : ''}"><span class="n ${t.rank <= 3 ? 'g' + t.rank : ''}">${t.rank}</span><b style="flex:1">${esc(t.nick)}${t.me ? ' (Anda)' : ''}</b><b>${t.xp.toLocaleString('id-ID')} XP</b></div>`).join('')}</div></section>
  <section class="card"><h2>Cara dapat XP</h2><div class="list small">
    <div class="li row between"><span>Clock in</span><b>+10</b></div><div class="li row between"><span>Tepat waktu</span><b>+5</b></div><div class="li row between"><span>Ceklis buka / tutup</span><b>+5</b></div>
    <div class="li row between"><span>Tugas antar/jemput selesai</span><b>+10</b></div><div class="li row between"><span>Shift kas ditutup (kas pas +5)</span><b>+10</b></div><div class="li row between"><span>Poin Rentalaja (bonus/potongan)</span><b>±</b></div></div>
    <div class="ra-grid3" style="margin-top:12px"><div class="ra-kpi"><span>Hadir</span><b>${p.hadir}${p.jadwal ? ' / ' + p.jadwal : ''}</b></div><div class="ra-kpi"><span>Telat</span><b class="${p.telat ? 'red' : ''}">${p.telat}×</b></div><div class="ra-kpi"><span>Poin</span><b>${p.poin > 0 ? '+' : ''}${p.poin}</b></div>
    ${A.some(a => ['runner', 'sopir'].includes(a.position)) || p.tugas ? `<div class="ra-kpi"><span>Antar/jemput</span><b>${p.tugas}</b></div>` : ''}${A.some(a => ['kasir', 'kepala_cabang'].includes(a.position)) || p.shift ? `<div class="ra-kpi"><span>Shift kas</span><b>${p.shift}</b><small class="${p.selisih ? 'red' : ''}">selisih ${p.selisih ? rp(p.selisih) : 'nol'}</small></div>` : ''}<div class="ra-kpi"><span>Lembur</span><b>${jam(p.lembur_min)}</b></div></div></section></div>`;
}

// ---------- Panel kerja ----------
async function startWork(assign) {
  const w = window.open('', '_blank');
  try { if (w) w.document.write('<p style="font:600 15px system-ui;padding:24px;color:#1F2B4D">Membuka panel kerja…</p>'); } catch (e) {}
  try { const r = await callFn('pk-ra-sso', { target: 'ra_kerja', assign }); if (w) w.location.replace(r.url); else location.href = r.url; }
  catch (e) { try { w && w.close(); } catch (x) {} toast(e.message || 'Gagal membuka panel', 'err'); }
}
function panelCards(compact) { const A = H.assigns || [], { isIn, isOut } = state(), open = isIn && !isOut;
  return `<div class="ra-panels${compact ? ' cp' : ''}">${A.map(a => `<button class="ra-panel${open ? '' : ' lock'}" data-start="${a.id}" style="--pc:${POSC[a.position] || '#1F2B4D'};--pc2:${POSC2[a.position] || '#0F172A'}">${open ? '' : `<span class="lk">${ri('kunci', 18, '#fff')}</span>`}
    <span class="ic"><img src="/img/ra.png" alt=""></span><b>${esc(a.pos.label)}</b><small>${esc(a.branch)}${a.kind === 'tambahan' ? ' · tambahan' : ''}</small><span class="go">Masuk →</span></button>`).join('') || '<p class="muted">Belum ada penugasan. Hubungi Operasional.</p>'}</div>`; }
let warmed = 0;
function wirePanel(el) { if (Date.now() - warmed > 120000 && el.querySelector('[data-start]')) { warmed = Date.now(); fetch(SB_URL + '/functions/v1/pk-ra-sso', { method: 'OPTIONS' }).catch(() => {}); }  // panaskan fungsi supaya panel cepat terbuka
  const prev = el.onclick; el.onclick = (e) => { const b = e.target.closest('[data-start]'); if (!b) return prev && prev(e); const { isIn, isOut } = state();
  if (!(isIn && !isOut)) return toast(isOut ? 'Shift hari ini sudah selesai' : 'Clock in dulu', 'err'); startWork(b.dataset.start); }; }
async function vPanel(el) { const { isIn, isOut } = state();
  el.innerHTML = `${hero('Panel kerja', isIn && !isOut ? 'Pilih panel tempat Anda bekerja hari ini' : isOut ? 'Shift hari ini sudah selesai' : 'Terbuka setelah clock in', 'beranda')}
  ${!isIn ? '<section class="card absen">Clock in dulu. <a href="#/absen">Clock In →</a></section>' : ''}${panelCards()}
  <p class="muted small" style="margin:0">Panel terbuka di tab baru tanpa login lagi, dan hanya menampilkan cabang penugasan Anda.</p></div>`; wirePanel(el); }

// ---------- Akun ----------
async function vAkun(el) { const me = ctx.byId[ctx.me.id] || ctx.me, A = H.assigns || [];
  el.innerHTML = `${hero('Akun', '')}
  <section class="ra-now"><div class="row gap"><span class="av-lg">${esc((nickOf() || '?').slice(0, 2).toUpperCase())}</span><div><b style="font-size:18px">${esc(me.name)}</b><br><small class="muted">${esc(me.email || '')}${me.phone ? ' · +' + esc(me.phone) : ''}</small></div></div>
    <div class="ra-pills">${A.map(a => `<span class="ra-pill ok">${esc(a.pos.label)} · ${esc(a.branch)}</span>`).join('') || '<span class="ra-pill">Belum ada penugasan</span>'}</div></section>
  <section class="card"><div class="list menu-l">
    <a class="li" href="#/slip">${ri('slip', 20)} <span>Slip gaji</span>›</a><a class="li" href="#/jadwal">${ri('jadwal', 20)} <span>Jadwal & penugasan</span>›</a><a class="li" href="#/kehadiran">${ri('riwayat', 20)} <span>Riwayat kehadiran</span>›</a>
    <a class="li" href="#/performa">${ri('performa', 20)} <span>Performa & lencana</span>›</a><a class="li" href="#/pengajuan">${ri('reimburse', 20)} <span>Pengajuan saya</span>›</a>
    ${WHO.mgr ? `<a class="li" href="https://rentalaja.co.id/#/OpsKerja" target="_blank" rel="noopener">${ri('tim', 20)} <span>Kelola petugas (Rentalaja Operasional)</span>↗</a>` : ''}
    <button class="li" type="button" data-out>${ri('keluar', 20)} <span>Keluar</span></button></div></section>
  <p class="muted small" style="text-align:center">Kerja Lapangan · PT Popo Karya Investama</p></div>`; }

// ---------- coba sebagai petugas (Operasional) ----------
async function vCoba(el) {
  const br = await db.get('branches', 'select=id,name&is_active=eq.true&order=sort');
  el.innerHTML = `${hero('Coba sebagai petugas', 'Untuk Operasional: rasakan alur petugas dari clock in sampai panel kerja', 'beranda')}
  <form class="ra-now stack" id="fc"><label class="fld"><span>Posisi</span><select class="inp" name="pos">${[['kasir', 'Kasir'], ['cs', 'CS'], ['runner', 'Runner'], ['sopir', 'Sopir jeep'], ['qc', 'QC'], ['teknisi', 'Teknisi'], ['kepala_cabang', 'Kepala cabang']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
    <label class="fld"><span>Cabang</span><select class="inp" name="br">${br.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
    <p class="muted small" style="margin:0">Absen percobaan tercatat atas nama Anda. Penugasan coba bisa diakhiri di Rentalaja → Operasional → Kerja lapangan.</p>
    <button class="btn pri ra-big" type="submit">Mulai coba</button></form></div>`;
  el.querySelector('#fc').onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { await db.rpc('ops_assign', { p_person: ctx.me.id, p_position: f.pos, p_branch: f.br, p_start: today(), p_reason: 'Coba alur petugas', p_mode: 'tambahan' }); toast('Penugasan coba aktif'); go('beranda'); } catch (er) { toast(er.message, 'err'); } };
}

const VIEWS = { selesai: vSelesai, beranda: vBeranda, absen: vAbsen, kehadiran: vKehadiran, pengajuan: vPengajuan, ajukan: vAjukan, akun: vAkun, slip: vSlip, jadwal: vJadwal, ceklis: vCeklis, performa: vPerforma, panel: vPanel, coba: vCoba };

// ---------- mulai ----------
// konteks ringan: cukup data diri + peran (tanpa memuat seluruh daftar orang & pengaturan holding)
async function lightContext() {
  const [me, who] = await Promise.all([db.rpc('ops_session'), db.rpc('ops_whoami').catch(() => ({}))]); if (!me) return false;
  let uid = null; try { uid = JSON.parse(atob((JSON.parse(localStorage.getItem('pokama.session')).access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (e) {}
  ctx.me = me; ctx.byId = { [me.id]: { ...me, user_id: uid } }; ctx.who = who || {};
  return true;
}
async function boot() {
  root.innerHTML = '<div class="loading full">Memuat…</div>';
  // petugas lapangan tidak perlu aplikasi Authenticator; Operasional (manajemen) tetap verifikasi 2 langkah
  let ok = false; try { ok = await lightContext(); } catch (e) { ok = false; }
  if (!ok || ctx.me.role !== 'lapangan') {
    try { const m = await ensureMfa(); if (!m) { loginView(); return; } reloadSession(); } catch (e) { loginView(e.message); return; }
    try { ok = await lightContext(); } catch (e) { loginView(e.message); return; }
  }
  if (!ok) { try { localStorage.removeItem('pokama.session'); } catch (e) {} loginView('Akun ini belum terdaftar sebagai petugas operasional. Minta Operasional mendaftarkan email Anda.'); return; }
  WHO = ctx.who || {};
  if (ctx.me.role !== 'lapangan' && !WHO.field && !WHO.mgr) {
    gate('Halaman ini untuk petugas operasional', 'Kerja Lapangan dipakai kasir, CS, runner, sopir, QC, teknisi, dan kepala cabang. Manajemen petugas ada di <a href="https://rentalaja.co.id/#/OpsKerja">Rentalaja → Operasional → Kerja lapangan</a>.'); return;
  }
  loadCache();
  shell(); window.onhashchange = route; if (!location.hash || location.hash === '#/') location.hash = '#/beranda'; route();
}
takeSessionFromUrl();
if (hasSession() && idleExpired()) { try { localStorage.removeItem('pokama.session'); } catch (e) {} reloadSession(); }
if (hasSession()) boot(); else loginView();
idleGuard(() => { if (hasSession()) signOut(); });

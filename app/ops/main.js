// Kerja Lapangan Pokama (ops.pokama.org) · khusus petugas operasional seluruh unit · tampilan template Rentalaja
// Urutan menu: 1 Absensi · 2 Pengajuan (cuti, izin, sakit, lembur) · 3 Performa saya · 4 Panel kerja (kiri-kanan, terbuka setelah absen)
import { ctx, db, esc, today, addDays, fdate, ftime, modal, field, toast, need, confirmBox, callFn, shrinkImage, uploadPhoto, getLocation,
  hasSession, takeSessionFromUrl, signInPassword, signInGoogle, loadContext, signOut, reloadSession } from '../core.js';
import { ensureMfa, idleGuard, idleExpired } from '../mfa.js';

const root = document.getElementById('app');
const POSC2 = { kasir: '#064E48', cs: '#065F59', runner: '#1E3A8A', sopir: '#3F2E18', qc: '#4C2590', teknisi: '#7C2D12', kepala_cabang: '#0F172A' };
const POSC = { kasir: '#0F766E', cs: '#0A8F86', runner: '#2563EB', sopir: '#6B4F2A', qc: '#7A3FD1', teknisi: '#C2410C', kepala_cabang: '#1F2B4D' };
const hm = (t) => t ? String(t).slice(0, 5).replace(':', '.') : '—';
const clock = (ts) => ts ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(':', '.') : '—';
const jam = (m) => { m = +m || 0; const h = Math.floor(m / 60), r = m % 60; return h ? h + ' j' + (r ? ' ' + r + ' m' : '') : r + ' m'; };
const dist = (a, b, c, d) => { const R = 6371e3, r = (x) => x * Math.PI / 180; const x = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const ST = { diajukan: ['menunggu', 'yellow'], disetujui: ['disetujui', 'green'], ditolak: ['ditolak', 'red'], batal: ['dibatalkan', 'gray'] };
const chipS = (s) => `<span class="chip ${(ST[s] || ['', 'gray'])[1]}">${(ST[s] || [s])[0]}</span>`;
const KIND = { cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit' };
const IC = { absen: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', cuti: '<path d="M8 3v3M16 3v3"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 14h4"/>', performa: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>', panel: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' };
const ico = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const TABS = [['absen', 'Absensi'], ['cuti', 'Pengajuan'], ['performa', 'Performa saya'], ['panel', 'Panel kerja']];
const sapa = () => { const h = +new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 13); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };
// header hijau ala Beranda Rentalaja; membuka .ra-body untuk isi halaman
const hero = (title, sub) => { const nick = ctx.me.nickname || ctx.me.name;
  return `<header class="ra-hero"><div class="ra-wrap"><div class="top"><span class="pk"><img src="/img/pokama-logo.png" alt="Pokama"></span><button type="button" class="av" data-out title="Keluar">${esc((nick || '?').slice(0, 2).toUpperCase())}</button></div>
    <div class="greet">${sapa()}, ${esc(nick)} · ${fdate(today())}</div><h1>${title}</h1><div class="sub">${sub}</div></div></header><div class="ra-body">`; };

// ---------- masuk ----------
function loginView(msg) {
  root.innerHTML = `<main class="login"><div class="login-card">
    <img class="pk-logo" src="/img/pokama-logo.png" alt="Pokama">
    <div><h1>Kerja Lapangan</h1><p class="muted small">Absen, pengajuan, performa, dan panel kerja petugas operasional Pokama</p></div>
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
  const nick = ctx.me.nickname || ctx.me.name; const ini = esc((nick || '?').slice(0, 2).toUpperCase());
  root.innerHTML = `<div class="ra-shell">
    <aside class="ra-side"><img class="pk-logo" src="/img/pokama-logo.png" alt="Pokama"><span class="ra-grp">KERJA LAPANGAN</span>
      <nav class="ra-nav" aria-label="Menu">${TABS.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${ico(k)}${l}<small data-flag="${k}"></small></a>`).join('')}</nav>
      <div class="ra-me"><span class="av">${ini}</span><span><b>${esc(nick)}</b><small>${esc(ctx.me.title || 'Petugas operasional')}</small></span><button type="button" data-out>Keluar</button></div></aside>
    <main class="ra-main" id="view"></main>
    <nav class="ra-bottom" aria-label="Menu bawah">${TABS.map(([k, l]) => `<a href="#/${k}" data-k="${k}"><span>${ico(k, 21)}</span>${l.split(' ')[0]}</a>`).join('')}</nav></div>`;
  root.addEventListener('click', async (e) => { if (!e.target.closest('[data-out]')) return; if (await confirmBox('Keluar dari Kerja Lapangan?', 'Keluar')) signOut(); });
}

let H = null, WHO = {};
async function route() {
  let k = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (k === 'shift' || !TABS.some(t => t[0] === k)) k = 'absen';
  document.querySelectorAll('[data-k]').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  const t = TABS.find(x => x[0] === k);
  document.title = t[1] + ' · Kerja Lapangan';
  const el = document.getElementById('view'); el.innerHTML = '<div class="loading">Memuat…</div>'; window.scrollTo(0, 0);
  try { H = await db.rpc('ops_home'); flags(); await VIEWS[k](el); }
  catch (e) { el.innerHTML = `<div class="card"><h2>Gagal memuat</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Muat ulang</button></div>`; }
}
const reload = () => route();
function flags() {
  const att = H.att, isIn = !!(att && att.clock_in);
  const set = (k, t) => document.querySelectorAll(`[data-flag="${k}"]`).forEach(x => x.textContent = t);
  set('absen', isIn ? (att.clock_out ? 'selesai' : '✓ ' + clock(att.clock_in)) : 'belum');
  set('panel', isIn && !(att && att.clock_out) ? '' : '🔒');
}

// ---------- 1 · Absensi ----------
async function vAbsen(el) {
  const A = H.assigns || [], att = H.att, sch = H.schedule, items = H.items || [], ck = H.checks || {};
  const isIn = !!(att && att.clock_in), isOut = !!(att && att.clock_out);
  const buka = items.filter(i => i.phase === 'buka'), tutup = items.filter(i => i.phase === 'tutup');
  const doneB = (ck.buka && ck.buka.items) || [], doneT = (ck.tutup && ck.tutup.items) || [];
  const okB = buka.every(i => doneB.includes(i.id)), okT = tutup.every(i => doneT.includes(i.id));
  const brs = [...new Map(A.map(a => [a.branch_id, a])).values()];
  const ckForm = (list, done, ph) => { const g = {}; list.forEach(i => { const n = i.position ? ((A.find(a => a.position === i.position) || {}).pos || {}).label || i.position : 'Semua'; (g[n] = g[n] || []).push(i); });
    return `<form class="ra-ck" data-ck="${ph}">${Object.entries(g).map(([n, is]) => `<h4>${esc(n)}</h4>${is.map(i => `<label><input type="checkbox" name="${i.id}" ${done.includes(i.id) ? 'checked' : ''}><span>${esc(i.label)}</span></label>`).join('')}`).join('')}
      <button class="btn ${ph === 'buka' ? 'pri' : ''} ra-big" type="submit" style="margin-top:10px">Simpan ceklis ${ph}</button></form>`; };
  el.innerHTML = `${hero('Absensi', 'Absen masuk, ceklis buka, lalu mulai kerja di panel Anda.')}
  <section class="ra-now"><div class="row"><span class="lbl">Hari ini</span></div>
    <div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="big">${isIn ? clock(att.clock_in) : '—'}</div><small>${isIn ? 'masuk' + (att.late > 0 ? ' · telat ' + jam(att.late) : ' · tepat waktu') + (isOut ? ' · pulang ' + clock(att.clock_out) : '') : 'belum absen masuk'}</small></div>
      <div style="text-align:right"><div style="font-weight:800">${sch ? esc(sch.shift || 'Shift') + ' ' + hm(sch.starts) + '–' + hm(sch.ends) : 'Belum ada jadwal'}</div><small>${sch && sch.branch ? esc(sch.branch) : 'jadwal dari Operasional'}</small></div></div>
    <div class="row">${A.map(a => `<span class="ra-pill">${esc(a.pos.label)} · ${esc(a.branch)}</span>`).join('') || '<span class="ra-pill warn">Belum ada penugasan. Hubungi Operasional.</span>'}
      <span class="ra-pill ${isOut ? '' : isIn ? 'ok' : 'warn'}">${isOut ? 'Shift selesai' : isIn ? 'Sedang bertugas' : 'Belum absen'}</span></div></section>
  ${!A.length && WHO.mgr ? `<section class="card absen"><h2>Coba sebagai petugas</h2><p class="muted small" style="margin-top:0">Anda masuk sebagai Operasional. Pilih posisi dan cabang untuk mencoba alur petugas: absen, ceklis, lalu buka panel. Penugasan coba ini bisa diakhiri di Rentalaja → Operasional → Kerja lapangan.</p><button class="btn pri ra-big" data-a="try">Pilih posisi & cabang</button></section>` : ''}
  ${!A.length ? '' : !isIn ? `<section class="card stack"><h2>Absen masuk</h2><p class="muted small" style="margin:0">Selfie di cabang dan izinkan lokasi HP.</p>
      ${brs.length > 1 ? field('Cabang', `<select class="inp" id="abr">${brs.map(a => `<option value="${a.branch_id}">${esc(a.branch)}</option>`).join('')}</select>`) : `<input type="hidden" id="abr" value="${brs[0].branch_id}">`}
      <label class="ra-shot" id="shot"><span id="selt">📷 Ketuk untuk selfie</span><input type="file" accept="image/*" capture="user" id="self" hidden></label>
      <div class="ra-loc">📍 <span id="locst" class="muted">mengambil lokasi…</span><button type="button" class="btn sm" id="locbtn">Ulang</button></div>
      <button class="btn pri ra-big" data-a="in">Absen masuk</button></section>`
    : !isOut ? `<section class="card"><div class="row between"><h2>Ceklis buka</h2>${okB ? '<span class="chip green">lengkap</span>' : `<span class="chip yellow">${doneB.length}/${buka.length}</span>`}</div>${ckForm(buka, doneB, 'buka')}</section>
      <a class="btn pri ra-big" href="#/panel" style="justify-content:center;text-decoration:none">Lanjut ke panel kerja →</a>
      <section class="card"><div class="row between"><h2>Pulang: ceklis tutup & absen keluar</h2>${H.open_shift ? '<span class="chip red">kas belum ditutup</span>' : ''}</div>${ckForm(tutup, doneT, 'tutup')}
        <button class="btn ra-big ra-dark" data-a="out" style="margin-top:10px">Absen keluar</button>
        <p class="muted small">${H.open_shift ? 'Tutup shift kas dulu di panel Kasir.' : !okT ? 'Ceklis tutup harus lengkap dan disimpan dulu.' : 'Siap pulang.'}</p></section>`
    : `<section class="card"><h2>Terima kasih, shift hari ini selesai</h2><p class="muted small">Masuk ${clock(att.clock_in)} · pulang ${clock(att.clock_out)}. Lembur? Ajukan di menu Pengajuan.</p></section>`}
  ${(H.week || []).length ? `<section class="card"><h2>Jadwal 7 hari</h2><div class="list">${H.week.map(w => `<div class="li row gap"><b style="min-width:100px">${fdate(w.day)}</b><span style="flex:1">${esc(w.shift || 'Shift')} ${hm(w.starts)}–${hm(w.ends)}</span><small class="muted">${esc(w.branch || '')}</small></div>`).join('')}</div></section>` : ''}
  </div>`;
  let loc = null, photo = null; const st = el.querySelector('#locst');
  const takeLoc = async () => { if (!st) return; st.textContent = 'mengambil lokasi…'; st.className = 'muted';
    try { loc = await getLocation(); const b = A.find(a => a.branch_id === el.querySelector('#abr').value) || {}; const R = +H.radius || 150;
      const d = b.lat != null && b.lng != null ? dist(loc.lat, loc.lng, b.lat, b.lng) : null;
      st.textContent = d == null ? 'lokasi terbaca' : d <= R ? `di area cabang (${Math.round(d)} m)` : `di luar area cabang (${Math.round(d)} m)`; st.className = d != null && d > R ? 'red' : 'green-t'; }
    catch (e) { loc = null; st.textContent = e.message; st.className = 'red'; } };
  if (st) { takeLoc(); el.querySelector('#locbtn').onclick = takeLoc; const s = el.querySelector('#abr'); if (s.tagName === 'SELECT') s.onchange = takeLoc; }
  const sf = el.querySelector('#self'); if (sf) sf.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const t = el.querySelector('#selt'); t.textContent = 'Mengunggah…';
    try { const blob = await shrinkImage(f, 900, .8); const uid = (ctx.byId[ctx.me.id] || {}).user_id; photo = await uploadPhoto('operasional', 'absen/' + uid + '/' + today() + '.jpg', blob);
      const img = document.createElement('img'); img.src = URL.createObjectURL(blob); img.alt = 'Selfie'; el.querySelector('#shot').appendChild(img); t.textContent = ''; }
    catch (er) { photo = null; t.textContent = '📷 Ketuk untuk ulang'; toast(er.message, 'err'); } };
  el.onsubmit = async (e) => { const f = e.target.closest('[data-ck]'); if (!f) return; e.preventDefault();
    try { await db.rpc('ops_check_save', { p_phase: f.dataset.ck, p_items: [...f.querySelectorAll('input:checked')].map(i => i.name) }); toast('Ceklis ' + f.dataset.ck + ' tersimpan'); reload(); } catch (er) { toast(er.message, 'err'); } };
  el.onclick = async (e) => { const a = e.target.closest('[data-a]'); if (!a) return;
    try {
      if (a.dataset.a === 'try') { const br = await db.get('branches', 'select=id,name,is_active&is_active=eq.true&order=sort');
        const r = await modal('Coba sebagai petugas', `<div class="g2">${field('Posisi', `<select name="pos" class="inp">${[['kasir', 'Kasir'], ['cs', 'CS'], ['runner', 'Runner'], ['sopir', 'Sopir jeep'], ['qc', 'QC'], ['teknisi', 'Teknisi'], ['kepala_cabang', 'Kepala cabang']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`)}${field('Cabang', `<select name="br" class="inp">${br.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select>`)}</div>`,
          { submit: 'Mulai coba', onSubmit: async (f) => { await db.rpc('ops_assign', { p_person: ctx.me.id, p_position: f.pos, p_branch: f.br, p_start: today(), p_reason: 'Coba alur petugas', p_mode: 'tambahan' }); } });
        if (r) { toast('Penugasan coba aktif'); reload(); } return; }
      if (a.dataset.a === 'in') { if (!photo) return toast('Ambil selfie dulu', 'err'); a.disabled = true;
        const r = await db.rpc('clock_in', { p_branch: el.querySelector('#abr').value, p_selfie: photo, p_lat: loc ? loc.lat : null, p_lng: loc ? loc.lng : null });
        toast(r.late_minutes > 0 ? 'Masuk ' + clock(r.clock_in) + ' · telat ' + jam(r.late_minutes) : 'Masuk ' + clock(r.clock_in) + ' · tepat waktu', r.late_minutes > 0 ? 'err' : undefined); return reload(); }
      if (a.dataset.a === 'out') { if (H.open_shift) return toast('Kas shift masih terbuka. Tutup shift dulu di panel Kasir.', 'err'); if (!okT) return toast('Lengkapi dan simpan ceklis tutup dulu', 'err');
        if (!await confirmBox('Absen keluar sekarang?', 'Absen keluar')) return; await db.rpc('ops_clock_out'); toast('Absen keluar tercatat'); return reload(); }
    } catch (er) { a.disabled = false; toast(er.message, 'err'); }
  };
}

// ---------- 2 · Pengajuan: cuti, izin, sakit, lembur ----------
async function vCuti(el) {
  const L = await db.rpc('ops_leave_list'); const OT = H.ot || [];
  el.innerHTML = `${hero('Pengajuan', `Diputuskan Operasional · kabar masuk lewat notifikasi`)}
  <div class="ra-grid2"><div class="ra-kpi"><span>Sisa cuti ${today().slice(0, 4)}</span><b>${Math.max(0, L.quota - L.used)} hari</b><small>terpakai ${L.used} dari ${L.quota}</small></div>
    <div class="ra-kpi"><span>Lembur disetujui bulan ini</span><b>${jam((H.perf || {}).lembur_min)}</b><small>${OT.filter(o => o.status === 'diajukan').length} menunggu</small></div></div>
  <section class="card"><h2>Ajukan</h2><div class="ra-acts"><button class="ra-act" data-k="cuti"><span>🏖️</span>Cuti</button><button class="ra-act" data-k="izin"><span>🙋</span>Izin</button><button class="ra-act" data-k="sakit"><span>🤒</span>Sakit</button><button class="ra-act" data-k="lembur"><span>⏱️</span>Lembur</button></div></section>
  <section class="card"><h2>Cuti, izin, sakit</h2><div class="list ra-list">${(L.rows || []).map(r => `<div class="li"><span><b>${KIND[r.kind] || r.kind}</b> ${fdate(r.day)}${r.end_day && r.end_day !== r.day ? ' – ' + fdate(r.end_day) : ''} ${chipS(r.status)}<br><small class="muted">${esc(r.reason || '')}${r.by && r.status !== 'diajukan' ? ' · ' + esc(r.by) : ''}</small>${r.note ? `<p class="reject-note${r.status === 'ditolak' ? '' : ' ok'}">${esc(r.note)}</p>` : ''}</span>${r.status === 'diajukan' ? `<button class="btn sm" data-lc="${r.id}">Batalkan</button>` : ''}</div>`).join('') || '<p class="muted small">Belum ada pengajuan.</p>'}</div></section>
  <section class="card"><h2>Lembur</h2><div class="list ra-list">${OT.map(o => `<div class="li"><span><b>${fdate(o.day)}</b> ${hm(o.starts)}–${hm(o.ends)} · ${jam(o.minutes)} ${o.kind === 'tugas' ? '<span class="chip blue">ditugaskan</span>' : chipS(o.status)}<br><small class="muted">${esc(o.reason || '')}${o.by && o.status !== 'diajukan' ? ' · ' + esc(o.by) : ''}</small>${o.note ? `<p class="reject-note${o.status === 'ditolak' ? '' : ' ok'}">${esc(o.note)}</p>` : ''}</span>${o.status === 'diajukan' ? `<button class="btn sm" data-oc="${o.id}">Batalkan</button>` : ''}</div>`).join('') || '<p class="muted small">Belum ada lembur.</p>'}</div></section>
  </div>`;
  el.onclick = async (e) => {
    try {
      const lc = e.target.closest('[data-lc]'); if (lc) { if (!await confirmBox('Batalkan pengajuan ini?', 'Ya, batalkan')) return; await db.rpc('ops_leave_cancel', { p_id: lc.dataset.lc }); toast('Dibatalkan'); return reload(); }
      const oc = e.target.closest('[data-oc]'); if (oc) { if (!await confirmBox('Batalkan pengajuan lembur?', 'Ya, batalkan')) return; await db.rpc('ops_ot_cancel', { p_id: oc.dataset.oc }); toast('Dibatalkan'); return reload(); }
      const b = e.target.closest('[data-k]'); if (!b || !b.classList.contains('ra-act')) return; const k = b.dataset.k;
      if (k === 'lembur') {
        const r = await modal('Ajukan lembur', field('Tanggal', `<input type="date" name="d" class="inp" value="${today()}" min="${addDays(today(), -7)}" max="${addDays(today(), 7)}">`)
          + `<div class="g2">${field('Mulai', `<input type="time" name="s" class="inp" value="${H.schedule && H.schedule.ends ? String(H.schedule.ends).slice(0, 5) : '17:00'}">`)}${field('Selesai', '<input type="time" name="e" class="inp" value="19:00">')}</div>`
          + field('Alasan', '<textarea name="why" class="inp" rows="3" placeholder="Contoh: antar unit ke Kamojang, tamu telat kembali"></textarea>'),
          { submit: 'Ajukan lembur', onSubmit: async (f) => { need(f.d, 'Pilih tanggal'); need(f.s, 'Isi jam mulai'); need(f.e, 'Isi jam selesai'); need((f.why || '').trim(), 'Tulis alasan');
            await db.rpc('ops_ot_request', { p_day: f.d, p_starts: f.s, p_ends: f.e, p_reason: f.why.trim() }); } });
        if (r) { toast('Lembur diajukan ke Operasional'); reload(); } return;
      }
      const r = await modal('Ajukan ' + KIND[k].toLowerCase(), `<div class="g2">${field('Mulai', `<input type="date" name="d1" class="inp" value="${k === 'cuti' ? addDays(today(), 1) : today()}">`)}${field('Sampai', `<input type="date" name="d2" class="inp" value="${k === 'cuti' ? addDays(today(), 1) : today()}">`)}</div>`
        + field('Alasan', `<textarea name="why" class="inp" rows="3" placeholder="${k === 'sakit' ? 'Contoh: demam, sudah ke klinik' : k === 'izin' ? 'Contoh: urusan keluarga' : 'Contoh: acara pernikahan saudara'}"></textarea>`)
        + (k === 'cuti' ? `<p class="note small">Sisa cuti ${Math.max(0, L.quota - L.used)} hari (Minggu tidak dihitung).</p>` : k === 'sakit' ? '<p class="note small">Kabari juga atasan lapangan lewat WhatsApp kalau hari ini.</p>' : ''),
        { submit: 'Ajukan', onSubmit: async (f) => { need(f.d1, 'Pilih tanggal'); need((f.why || '').trim(), 'Tulis alasan'); await db.rpc('ops_leave_request', { p_kind: k, p_d1: f.d1, p_d2: f.d2 || f.d1, p_reason: f.why.trim() }); } });
      if (r) { toast(KIND[k] + ' diajukan ke Operasional'); reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };
}

// ---------- 3 · Performa saya (gamifikasi: level, XP, rentetan, lencana, peringkat) ----------
async function vPerforma(el) {
  const g = await db.rpc('ops_game'), p = H.perf || {}, A = H.assigns || [];
  const pct = Math.max(4, Math.min(100, Math.round((g.xp - g.lvl_from) / Math.max(1, g.lvl_to - g.lvl_from) * 100)));
  const got = (g.badges || []).filter(b => b.got).length;
  el.innerHTML = `${hero('Performa saya', 'Kumpulkan XP dari hadir tepat waktu, ceklis, tugas, dan kas rapi. Naik level, raih lencana.')}
  <section class="ra-now"><div class="gm-lvl"><div class="gm-badge"><small>Level</small><b>${g.level}</b></div>
    <div style="flex:1;min-width:0"><span class="lbl">${esc(g.title)}</span><div style="font-size:26px;font-weight:800;line-height:1.1;margin:2px 0 8px">${g.xp.toLocaleString('id-ID')} XP</div>
      <div class="gm-bar"><i style="width:${pct}%"></i></div><small class="muted">${Math.max(0, g.lvl_to - g.xp).toLocaleString('id-ID')} XP lagi ke level ${g.level + 1}</small></div></div>
    <div class="ra-grid3"><div class="ra-kpi"><span>XP bulan ini</span><b>+${g.xp_month.toLocaleString('id-ID')}</b></div><div class="ra-kpi"><span>Peringkat</span><b>#${g.rank || '—'}</b><small>dari ${g.peers} petugas</small></div><div class="ra-kpi"><span>Lencana</span><b>${got} / ${(g.badges || []).length}</b><small>bulan ini</small></div></div></section>
  <section class="gm-streak"><span class="f">🔥</span><div><b>${g.streak} kali</b> <span class="muted">masuk tepat waktu berturut-turut</span><br><small class="muted">${g.streak >= 5 ? 'Mantap! Pertahankan rentetanmu.' : 'Masuk tepat waktu ' + (5 - g.streak) + ' kali lagi untuk lencana Tepat Waktu.'}</small></div></section>
  <section class="card"><div class="row between"><h2>Lencana bulan ini</h2><small class="muted">${got} diraih</small></div>
    <div class="gm-badges">${(g.badges || []).map(b => `<div class="gm-b${b.got ? ' got' : ''}"><span class="e">${b.ic}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${b.got ? '<span class="chip green" style="align-self:flex-start">diraih</span>' : `<div class="gm-mini"><i style="width:${Math.round(b.prog / Math.max(1, b.goal) * 100)}%"></i></div><small>${b.prog} / ${b.goal}</small>`}</div>`).join('')}</div></section>
  <section class="card gm-rank"><div class="row between"><h2>Papan peringkat bulan ini</h2><small class="muted">berdasarkan XP</small></div>
    <div class="list">${(g.top || []).map(t => `<div class="li${t.me ? ' me' : ''}"><span class="n ${t.rank <= 3 ? 'g' + t.rank : ''}">${t.rank <= 3 ? ['🥇', '🥈', '🥉'][t.rank - 1] : t.rank}</span><b style="flex:1">${esc(t.nick)}${t.me ? ' (Anda)' : ''}</b><b>${t.xp.toLocaleString('id-ID')} XP</b></div>`).join('')}</div>
    ${g.rank > 5 ? `<p class="small muted" style="margin-bottom:0">Anda di peringkat #${g.rank} dengan ${g.xp_month} XP bulan ini.</p>` : ''}</section>
  <section class="card"><h2>Rincian bulan ini</h2><div class="ra-grid3">
    <div class="ra-kpi"><span>Kehadiran</span><b>${p.hadir}${p.jadwal ? ' / ' + p.jadwal : ''}</b><small>hari · +10 XP/hari</small></div>
    <div class="ra-kpi"><span>Telat</span><b class="${p.telat ? 'red' : ''}">${p.telat}×</b><small>total ${jam(p.telat_min)}</small></div>
    <div class="ra-kpi"><span>Poin</span><b class="${p.poin < 0 ? 'red' : ''}">${p.poin > 0 ? '+' : ''}${p.poin}</b><small>bonus & potongan</small></div>
    <div class="ra-kpi"><span>Ceklis</span><b>${p.ceklis}</b><small>+5 XP tiap ceklis</small></div>
    ${A.some(a => ['runner', 'sopir'].includes(a.position)) || p.tugas ? `<div class="ra-kpi"><span>Antar/jemput</span><b>${p.tugas}</b><small>+10 XP · ${p.tugas_gagal} gagal</small></div>` : ''}
    ${A.some(a => ['kasir', 'kepala_cabang'].includes(a.position)) || p.shift ? `<div class="ra-kpi"><span>Shift kas</span><b>${p.shift}</b><small class="${p.selisih ? 'red' : ''}">selisih ${p.selisih ? 'Rp' + Math.round(p.selisih).toLocaleString('id-ID') : 'nol'}</small></div>` : ''}
    <div class="ra-kpi"><span>Lembur</span><b>${jam(p.lembur_min)}</b><small>disetujui</small></div></div>
    ${(p.poin_list || []).length ? `<h3>Poin terakhir</h3><div class="list">${p.poin_list.map(x => `<div class="li row gap"><b class="${x.delta < 0 ? 'red' : 'green-t'}" style="min-width:44px">${x.delta > 0 ? '+' : ''}${x.delta}</b><span style="flex:1">${esc(x.reason)}</span><small class="muted">${ftime(x.at)}</small></div>`).join('')}</div>` : ''}</section>
  <section class="card"><h2>Penugasan</h2>${(H.next || []).map(n => `<p class="note small" style="margin-top:0"><b>${n.kind === 'mutasi' ? 'Mutasi' : 'Penugasan'} berikutnya:</b> ${esc(n.pos.label)} · ${esc(n.branch)} mulai ${fdate(n.start_day)}${n.reason ? ' · ' + esc(n.reason) : ''}</p>`).join('')}
    <div class="list">${(H.history || []).map(x => `<div class="li row gap wrap"><b>${esc(x.pos.label)}</b><span style="flex:1">${esc(x.branch)} <small class="muted">${fdate(x.start_day, false)} – ${x.end_day ? fdate(x.end_day, false) : 'sekarang'}${x.kind !== 'awal' ? ' · ' + x.kind : ''}</small></span></div>`).join('') || '<p class="muted small">—</p>'}</div></section>
  </div>`;
}

// ---------- 4 · Panel kerja ----------
async function startWork(assign) {
  const w = window.open('', '_blank');
  try { if (w) w.document.write('<p style="font:600 15px system-ui;padding:24px;color:#1F2B4D">Membuka panel kerja…</p>'); } catch (e) {}
  try { const r = await callFn('pk-ra-sso', { target: 'ra_kerja', assign }); if (w) w.location.replace(r.url); else location.href = r.url; }
  catch (e) { try { w && w.close(); } catch (x) {} toast(e.message || 'Gagal membuka panel', 'err'); }
}
async function vPanel(el) {
  const A = H.assigns || [], att = H.att, open = !!(att && att.clock_in) && !(att && att.clock_out);
  el.innerHTML = `${hero('Panel kerja', open ? 'Pilih panel tempat Anda bekerja hari ini' : att && att.clock_out ? 'Shift hari ini sudah selesai' : 'Terbuka setelah absen masuk')}
  ${!open ? `<section class="card absen"><b>${att && att.clock_out ? 'Shift hari ini sudah selesai.' : 'Absen masuk dulu.'}</b> <a href="#/absen">Ke Absensi →</a></section>` : ''}
  <div class="ra-panels">${A.map(a => `<button class="ra-panel${open ? '' : ' lock'}" data-start="${a.id}" style="--pc:${POSC[a.position] || '#1F2B4D'};--pc2:${POSC2[a.position] || '#0F172A'}">${open ? '' : '<span class="lk">🔒</span>'}
    <span class="ic"><img src="/img/ra.png" alt=""></span><b>${esc(a.pos.label)}</b><small>Cabang ${esc(a.branch)}${a.kind === 'tambahan' ? ' · tugas tambahan' : ''}</small><span class="go">Masuk panel →</span></button>`).join('')
    || '<p class="muted">Belum ada penugasan. Hubungi Operasional.</p>'}</div>
  <p class="muted small" style="margin:0">Panel terbuka di tab baru tanpa login lagi, dan hanya menampilkan cabang penugasan Anda.</p></div>`;
  el.onclick = (e) => { const b = e.target.closest('[data-start]'); if (!b) return; if (!open) return toast(att && att.clock_out ? 'Shift hari ini sudah selesai' : 'Absen masuk dulu', 'err'); startWork(b.dataset.start); };
}
const VIEWS = { absen: vAbsen, cuti: vCuti, performa: vPerforma, panel: vPanel };

// ---------- mulai ----------
async function boot() {
  root.innerHTML = '<div class="loading full">Memuat…</div>';
  try { const m = await ensureMfa(); if (!m) { loginView(); return; } reloadSession(); } catch (e) { loginView(e.message); return; }
  let ok = false; try { ok = await loadContext(); } catch (e) { loginView(e.message); return; }
  if (!ok) { try { localStorage.removeItem('pokama.session'); } catch (e) {} loginView('Akun ini belum terdaftar sebagai petugas operasional. Minta Operasional mendaftarkan email Anda.'); return; }
  let o = {}; try { o = await db.rpc('ops_whoami'); } catch (e) {}
  WHO = o || {};
  if (ctx.me.role !== 'lapangan' && !o.field && !o.mgr) {
    gate('Halaman ini untuk petugas operasional', 'Kerja Lapangan dipakai kasir, CS, runner, sopir, QC, teknisi, dan kepala cabang untuk absen, pengajuan, performa, dan membuka panel kerja. Panel manajemen ada di <a href="https://app.pokama.org/">Sistem Kerja Pokama</a> dan <a href="https://demo.rentalaja.co.id/">Rentalaja App</a>.'); return;
  }
  shell(); window.onhashchange = route; if (!location.hash || location.hash === '#/') location.hash = '#/absen'; route();
}
takeSessionFromUrl();
if (hasSession() && idleExpired()) { try { localStorage.removeItem('pokama.session'); } catch (e) {} reloadSession(); }
if (hasSession()) boot(); else loginView();
idleGuard(() => { if (hasSession()) signOut(); });

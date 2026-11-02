// Sistem Kerja Operasional · staf lapangan Rentalaja (kasir, CS, runner, sopir, QC, teknisi, kepala cabang)
// Shift Saya: absen masuk -> ceklis buka -> Mulai kerja (panel Rentalaja sesuai penugasan) -> ceklis tutup -> absen keluar; performa & lembur.
// Tim Operasional: papan hari ini per cabang, penugasan & mutasi, jadwal shift, lembur, ceklis.
import { ctx, db, esc, today, addDays, fdate, ftime, modal, field, opts, toast, need, chip, confirmBox, callFn, shrinkImage, uploadPhoto, getLocation } from '../core.js';

export const POS = [['kasir', 'Kasir'], ['cs', 'CS'], ['runner', 'Runner'], ['sopir', 'Sopir jeep'], ['qc', 'QC'], ['teknisi', 'Teknisi'], ['kepala_cabang', 'Kepala cabang']];
const POSL = Object.fromEntries(POS);
const POSC = { kasir: '#0F766E', cs: '#0A8F86', runner: '#2563EB', sopir: '#6B4F2A', qc: '#7A3FD1', teknisi: '#C2410C', kepala_cabang: '#1D3149' };
const hm = (t) => t ? String(t).slice(0, 5).replace(':', '.') : '—';
const clock = (ts) => ts ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(':', '.') : '—';
const jam = (m) => { m = +m || 0; const h = Math.floor(m / 60), r = m % 60; return h ? h + ' j' + (r ? ' ' + r + ' m' : '') : r + ' m'; };
const posChip = (p) => `<span class="chip" style="background:${POSC[p] || '#1D3149'}1A;color:${POSC[p] || '#1D3149'}">${esc(POSL[p] || p)}</span>`;
const OTST = { diajukan: ['menunggu Operasional', 'yellow'], disetujui: ['disetujui', 'green'], ditolak: ['ditolak', 'red'], batal: ['dibatalkan', 'gray'] };
const dist = (a, b, c, d) => { const R = 6371e3, r = (x) => x * Math.PI / 180; const x = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

// buka panel Rentalaja untuk satu penugasan (tanpa login & 2 langkah lagi)
async function startWork(assign) {
  const w = window.open('', '_blank');
  try { if (w) w.document.write('<p style="font:600 15px system-ui;padding:24px;color:#1D3149">Membuka panel kerja…</p>'); } catch (e) {}
  try { const r = await callFn('pk-ra-sso', { target: 'ra_kerja', assign }); if (w) w.location.replace(r.url); else location.href = r.url; }
  catch (e) { try { w && w.close(); } catch (x) {} toast(e.message || 'Gagal membuka panel', 'err'); }
}

// ================= Shift Saya =================
async function shift(el, params, reload) {
  const h = await db.rpc('ops_home');
  const A = h.assigns || [], att = h.att, perf = h.perf || {}, items = h.items || [], ck = h.checks || {};
  const buka = items.filter(i => i.phase === 'buka'), tutup = items.filter(i => i.phase === 'tutup');
  const doneB = (ck.buka && ck.buka.items) || [], doneT = (ck.tutup && ck.tutup.items) || [];
  const okB = buka.length && buka.every(i => doneB.includes(i.id)), okT = tutup.every(i => doneT.includes(i.id));
  const isIn = !!(att && att.clock_in), isOut = !!(att && att.clock_out);
  const sch = h.schedule; const pend = (h.ot || []).filter(o => o.status === 'diajukan').length;
  const step = !isIn ? 1 : !okB ? 2 : isOut ? 6 : 3;
  const STEPS = ['Absen masuk', 'Ceklis buka', 'Kerja di panel', 'Ceklis tutup', 'Absen keluar'];
  const stepState = (i) => { const n = i + 1; if (n === 1) return isIn ? 'done' : 'now'; if (n === 2) return okB ? 'done' : isIn ? 'now' : ''; if (n === 3) return isOut ? 'done' : isIn && okB ? 'now' : '';
    if (n === 4) return doneT.length && okT ? 'done' : isIn && okB && !isOut ? 'now' : ''; return isOut ? 'done' : ''; };
  const ckList = (list, done, ph) => {
    const groups = {}; list.forEach(i => { const g = i.position ? POSL[i.position] || i.position : 'Semua posisi'; (groups[g] = groups[g] || []).push(i); });
    return `<form data-ck="${ph}" class="ck">${Object.entries(groups).map(([g, is]) => `<div class="ck-g"><small class="muted b">${esc(g)}</small>${is.map(i => `<label class="chk ck-i"><input type="checkbox" name="${i.id}" ${done.includes(i.id) ? 'checked' : ''}><span>${esc(i.label)}</span></label>`).join('')}</div>`).join('')}
      <div class="row gap"><button class="btn ${ph === 'buka' ? 'pri' : ''}" type="submit">Simpan ceklis ${ph}</button><small class="muted">${done.length} dari ${list.length} selesai${(ck[ph] || {}).at ? ' · ' + clock(ck[ph].at) : ''}</small></div></form>`;
  };
  const brOpts = [...new Map(A.map(a => [a.branch_id, a])).values()];
  const ini = (h.me.nick || 'Kamu');
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">${fdate(today())} · Sistem Kerja Operasional</span><h1>Shift Saya</h1></div>
    <div class="row gap wrap">${A.map(a => posChip(a.position) + ` <small class="muted b">${esc(a.branch)}</small>`).join(' ')}</div></header>
  ${!A.length ? `<section class="card absen"><b>Belum ada penugasan aktif</b><p class="muted small">Operasional belum menugaskan ${esc(ini)} ke posisi dan cabang. Hubungi Operasional; setelah ditugaskan, tombol kerja muncul di sini.</p>${(h.next || []).length ? `<p class="small">Penugasan berikutnya: <b>${esc(h.next[0].pos.label)} · ${esc(h.next[0].branch)}</b> mulai ${fdate(h.next[0].start_day)}</p>` : ''}</section>` : `
  <ol class="opsteps">${STEPS.map((s, i) => `<li class="${stepState(i)}"><span>${stepState(i) === 'done' ? '✓' : i + 1}</span><b>${s}</b></li>`).join('')}</ol>
  <div class="tiles">
    <div class="tile"><span>Jadwal hari ini</span><b class="small-b">${sch ? esc(sch.shift || 'Shift') + ' ' + hm(sch.starts) + '–' + hm(sch.ends) : 'Belum dijadwalkan'}</b><small>${sch && sch.branch ? esc(sch.branch) : 'Jadwal diatur Operasional'}</small></div>
    <div class="tile"><span>Absen masuk</span><b class="${att && att.late > 0 ? 'red' : ''}">${isIn ? clock(att.clock_in) : '—'}</b><small>${isIn ? (att.late > 0 ? 'telat ' + jam(att.late) : att.status === 'tanpa_jadwal' ? 'tanpa jadwal' : 'tepat waktu') + (att.inside === false ? ' · di luar area' : '') : 'belum absen'}</small></div>
    <div class="tile"><span>Ceklis</span><b>${doneB.length + doneT.length} / ${buka.length + tutup.length}</b><small>buka ${okB ? '✓' : doneB.length + '/' + buka.length} · tutup ${tutup.length && okT && doneT.length ? '✓' : doneT.length + '/' + tutup.length}</small></div>
    <div class="tile"><span>Absen keluar</span><b>${isOut ? clock(att.clock_out) : '—'}</b><small>${isOut ? 'shift selesai' : h.open_shift ? 'kas shift masih terbuka' : sch ? 'jadwal pulang ' + hm(sch.ends) : ''}</small></div>
  </div>

  ${!isIn ? `<section class="card absen" id="absen"><div class="row between wrap gap"><span class="absen-t"><b>1 · Absen masuk</b><small class="muted">Selfie di cabang dan lokasi HP. Telat dihitung dari jadwal shift.</small></span></div>
    <div class="g2">${field('Cabang', `<select class="inp" id="abr">${opts(brOpts.map(a => [a.branch_id, a.branch]), brOpts[0] && brOpts[0].branch_id)}</select>`)}
      <label class="fld"><span>Selfie</span><label class="btn" style="cursor:pointer;justify-content:center"><span id="selt">📷 Ambil selfie</span><input type="file" accept="image/*" capture="user" id="self" hidden></label></label></div>
    <div class="absen-loc"><b>📍 Lokasi</b> <span id="locst" class="muted small">mengambil lokasi…</span> <button type="button" class="btn sm" id="locbtn">Ambil ulang</button></div>
    <button class="btn pri big" data-a="in" style="width:100%">Absen masuk sekarang</button></section>` : ''}

  ${isIn && !isOut ? `<section class="card"><div class="row between wrap gap"><h2>2 · Ceklis buka</h2>${okB ? chip('lengkap', 'green') : chip('belum lengkap', 'yellow')}</div>${ckList(buka, doneB, 'buka')}</section>` : ''}

  <section class="card ops-go"><div class="row between wrap gap"><div><h2>3 · Mulai kerja</h2><p class="muted small" style="margin:0">Panel terbuka di tab baru, langsung masuk tanpa login lagi. Panel hanya menampilkan cabang penugasan Anda.</p></div></div>
    <div class="ops-btns">${A.map(a => `<button class="ops-start" data-start="${a.id}" style="--pc:${POSC[a.position] || '#1D3149'}"${isIn && !isOut ? '' : ' data-need="1"'}><span class="ops-start-i"><img src="/img/ra.png" alt=""></span><span class="col"><b>Buka panel ${esc(a.pos.label)}</b><small>${esc(a.branch)} · sejak ${fdate(a.start_day, false)}${a.kind === 'tambahan' ? ' · tugas tambahan' : ''}</small></span><span class="ops-go-a">›</span></button>`).join('')}</div>
    ${!isIn ? '<p class="note small">Absen masuk dulu, lalu ceklis buka, baru mulai kerja.</p>' : isOut ? '<p class="note small">Shift hari ini sudah selesai.</p>' : !okB ? '<p class="note small">Ceklis buka belum lengkap. Lengkapi dulu supaya tercatat di performa.</p>' : ''}</section>

  ${isIn && !isOut ? `<section class="card"><div class="row between wrap gap"><h2>4 · Ceklis tutup & absen keluar</h2>${h.open_shift ? chip('kas shift masih terbuka', 'red') : ''}</div>${ckList(tutup, doneT, 'tutup')}
    <div class="row gap wrap" style="margin-top:10px"><button class="btn pri" data-a="out"${okT && !h.open_shift ? '' : ' data-warn="1"'}>Absen keluar</button><small class="muted">${h.open_shift ? 'Tutup shift kas dulu di panel Kasir.' : !okT ? 'Lengkapi ceklis tutup dulu.' : 'Semua siap. Absen keluar menutup hari kerja Anda.'}</small></div></section>` : ''}`}

  <section class="card"><div class="row between wrap gap"><h2>Performa bulan ini</h2><small class="muted">dari absen, poin, tugas, dan kas di Rentalaja</small></div>
    <div class="tiles pf-tiles">
      <div class="tile"><span>Kehadiran</span><b>${perf.hadir}${perf.jadwal ? ' / ' + perf.jadwal : ''}</b><small>${perf.jadwal ? Math.round(perf.hadir / Math.max(1, perf.jadwal) * 100) + '% dari jadwal' : 'hari masuk'}</small></div>
      <div class="tile"><span>Telat</span><b class="${perf.telat ? 'red' : ''}">${perf.telat}×</b><small>total ${jam(perf.telat_min)}</small></div>
      <div class="tile"><span>Poin</span><b class="${perf.poin < 0 ? 'red' : ''}">${perf.poin > 0 ? '+' : ''}${perf.poin}</b><small>bonus & potongan</small></div>
      <div class="tile"><span>Lembur disetujui</span><b>${jam(perf.lembur_min)}</b><small>${pend ? pend + ' menunggu' : 'masuk rekap gaji'}</small></div>
      ${A.some(a => ['runner', 'sopir'].includes(a.position)) || perf.tugas ? `<div class="tile"><span>Tugas antar/jemput</span><b>${perf.tugas}</b><small>${perf.tugas_gagal ? perf.tugas_gagal + ' gagal' : 'selesai'}</small></div>` : ''}
      ${A.some(a => ['kasir', 'kepala_cabang'].includes(a.position)) || perf.shift ? `<div class="tile"><span>Shift kas ditutup</span><b>${perf.shift}</b><small class="${perf.selisih ? 'red' : ''}">selisih kas ${perf.selisih ? 'Rp' + Math.round(perf.selisih).toLocaleString('id-ID') : 'nol'}</small></div>` : ''}
      <div class="tile"><span>Ceklis terisi</span><b>${perf.ceklis}</b><small>catatan buka/tutup</small></div></div>
    ${(perf.poin_list || []).length ? `<div class="list" style="margin-top:10px">${perf.poin_list.map(p => `<div class="li row gap"><b class="${p.delta < 0 ? 'red' : 'green-t'}" style="min-width:44px">${p.delta > 0 ? '+' : ''}${p.delta}</b><span style="flex:1">${esc(p.reason)}</span><small class="muted">${ftime(p.at)}</small></div>`).join('')}</div>` : ''}</section>

  <div class="split2">
  <section class="card"><div class="row between wrap gap"><h2>Lembur</h2><button class="btn sm" data-a="ot">+ Ajukan lembur</button></div>
    <p class="muted small" style="margin-top:0">Diajukan paling lambat 7 hari setelahnya, diputuskan Operasional. Lembur yang ditugaskan langsung tercatat disetujui.</p>
    <div class="list">${(h.ot || []).map(o => `<div class="li"><div class="row gap"><span style="flex:1"><b>${fdate(o.day)}</b> ${hm(o.starts)}–${hm(o.ends)} · ${jam(o.minutes)} ${chip(o.kind === 'tugas' ? 'ditugaskan' : OTST[o.status][0], o.kind === 'tugas' ? 'blue' : OTST[o.status][1])}<br><small class="muted">${esc(o.reason || '')}${o.by && o.status !== 'diajukan' ? ' · ' + esc(o.by) : ''}</small></span>${o.status === 'diajukan' ? `<button class="btn sm" data-otc="${o.id}">Batalkan</button>` : ''}</div>${o.note ? `<p class="reject-note${o.status === 'ditolak' ? '' : ' ok'}">${esc(o.note)}</p>` : ''}</div>`).join('') || '<p class="muted small">Belum ada lembur bulan ini.</p>'}</div></section>
  <section class="card"><h2>Penugasan & jadwal</h2>
    ${(h.next || []).map(n => `<p class="note small" style="margin-top:0"><b>${n.kind === 'mutasi' ? 'Mutasi' : 'Penugasan'} berikutnya:</b> ${esc(n.pos.label)} · ${esc(n.branch)} mulai ${fdate(n.start_day)}${n.reason ? ' · ' + esc(n.reason) : ''}</p>`).join('')}
    ${(h.week || []).length ? `<h3>Jadwal 7 hari</h3><div class="list">${h.week.map(w => `<div class="li row gap"><b style="min-width:96px">${fdate(w.day)}</b><span style="flex:1">${esc(w.shift || 'Shift')} ${hm(w.starts)}–${hm(w.ends)}</span><small class="muted">${esc(w.branch || '')}</small></div>`).join('')}</div>` : '<p class="muted small">Jadwal 7 hari ke depan belum diatur.</p>'}
    <h3>Riwayat penugasan</h3><div class="list">${(h.history || []).map(x => `<div class="li row gap wrap">${posChip(x.position)}<span style="flex:1">${esc(x.branch)} <small class="muted">${fdate(x.start_day, false)} – ${x.end_day ? fdate(x.end_day, false) : 'sekarang'}${x.kind !== 'awal' ? ' · ' + x.kind : ''}${x.reason ? ' · ' + esc(x.reason) : ''}</small></span></div>`).join('') || '<p class="muted small">—</p>'}</div></section>
  </div>`;

  // lokasi & selfie untuk absen
  let loc = null, photo = null;
  const st = el.querySelector('#locst');
  const takeLoc = async () => { if (!st) return; st.textContent = 'mengambil lokasi…'; st.className = 'muted small';
    try { loc = await getLocation(); const b = A.find(a => a.branch_id === (el.querySelector('#abr') || {}).value) || {};
      const d = b.lat != null && b.lng != null ? dist(loc.lat, loc.lng, b.lat, b.lng) : null;
      st.textContent = d == null ? `terbaca (±${Math.round(loc.acc)} m)` : d <= (+h.radius || 150) ? `di area cabang (${Math.round(d)} m)` : `di luar area cabang (${Math.round(d)} m)`; st.className = 'small b ' + (d != null && d > (+h.radius || 150) ? 'red' : 'green-t'); }
    catch (e) { loc = null; st.textContent = e.message; st.className = 'small red'; } };
  if (st) { takeLoc(); el.querySelector('#locbtn').onclick = takeLoc; el.querySelector('#abr').onchange = takeLoc; }
  const sf = el.querySelector('#self'); if (sf) sf.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const t = el.querySelector('#selt'); t.textContent = 'Mengunggah…';
    try { const blob = await shrinkImage(f, 900, .8); const uid = (ctx.byId[ctx.me.id] || {}).user_id; photo = await uploadPhoto('operasional', 'absen/' + uid + '/' + today() + '.jpg', blob); t.textContent = '✓ Selfie siap'; }
    catch (er) { photo = null; t.textContent = '📷 Ambil ulang'; toast(er.message, 'err'); } };

  el.onsubmit = async (e) => { const f = e.target.closest('[data-ck]'); if (!f) return; e.preventDefault(); const ph = f.dataset.ck;
    const ids = [...f.querySelectorAll('input[type=checkbox]:checked')].map(i => i.name);
    try { await db.rpc('ops_check_save', { p_phase: ph, p_items: ids }); toast('Ceklis ' + ph + ' tersimpan'); reload(); } catch (er) { toast(er.message, 'err'); } };
  el.onclick = async (e) => {
    const s = e.target.closest('[data-start]'); if (s) { if (s.dataset.need) return toast(isOut ? 'Shift hari ini sudah selesai' : 'Absen masuk dulu', 'err'); return startWork(s.dataset.start); }
    const otc = e.target.closest('[data-otc]'); if (otc) { if (!await confirmBox('Batalkan pengajuan lembur ini?', 'Ya, batalkan')) return; try { await db.rpc('ops_ot_cancel', { p_id: otc.dataset.otc }); toast('Dibatalkan'); reload(); } catch (er) { toast(er.message, 'err'); } return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    try {
      if (a.dataset.a === 'in') {
        if (!photo) return toast('Ambil selfie dulu', 'err');
        a.disabled = true;
        const r = await db.rpc('clock_in', { p_branch: el.querySelector('#abr').value, p_selfie: photo, p_lat: loc ? loc.lat : null, p_lng: loc ? loc.lng : null });
        toast(r.late_minutes > 0 ? 'Absen ' + clock(r.clock_in) + ' · telat ' + jam(r.late_minutes) : 'Absen ' + clock(r.clock_in) + ' · tepat waktu', r.late_minutes > 0 ? 'err' : undefined); return reload();
      }
      if (a.dataset.a === 'out') {
        if (a.dataset.warn) return toast(h.open_shift ? 'Kas shift masih terbuka. Tutup shift dulu di panel Kasir.' : 'Lengkapi dan simpan ceklis tutup dulu', 'err');
        if (!await confirmBox('Absen keluar sekarang? Hari kerja Anda ditutup.', 'Absen keluar')) return;
        await db.rpc('ops_clock_out'); toast('Absen keluar tercatat'); return reload();
      }
      if (a.dataset.a === 'ot') {
        const r = await modal('Ajukan lembur', field('Tanggal', `<input type="date" name="d" class="inp" value="${today()}" min="${addDays(today(), -7)}" max="${addDays(today(), 7)}">`)
          + `<div class="g2">${field('Mulai', `<input type="time" name="s" class="inp" value="${sch && sch.ends ? hm(sch.ends).replace('.', ':') : '17:00'}">`)}${field('Selesai', '<input type="time" name="e" class="inp" value="19:00">')}</div>`
          + field('Alasan', '<textarea name="why" class="inp" rows="3" placeholder="Contoh: antar unit ke Kamojang, tamu terlambat kembali"></textarea>', 'Dikirim ke Operasional untuk diputuskan.'),
          { submit: 'Ajukan', onSubmit: async (f) => { need(f.d, 'Pilih tanggal'); need(f.s, 'Isi jam mulai'); need(f.e, 'Isi jam selesai'); need((f.why || '').trim(), 'Tulis alasan');
            await db.rpc('ops_ot_request', { p_day: f.d, p_starts: f.s, p_ends: f.e, p_reason: f.why.trim() }); } });
        if (r) { toast('Lembur diajukan ke Operasional'); reload(); }
      }
    } catch (er) { a.disabled = false; toast(er.message, 'err'); }
  };
}

// ================= Tim Operasional =================
async function team(el, params, reload) {
  const day = params.get('d') || today();
  const [t, LV] = await Promise.all([db.rpc('ops_team', { p_day: day }), db.rpc('ops_leave_pending')]);
  const P = t.people || [], BR = t.branches || [], OT = t.ot || [], IT = t.items || [];
  const isToday = day === today();
  const pendOT = OT.filter(o => o.status === 'diajukan');
  const assigned = P.filter(p => p.assigns.length), free = P.filter(p => !p.assigns.length);
  const inN = assigned.filter(p => p.att && p.att.in).length, lateN = assigned.filter(p => p.att && p.att.late > 0).length;
  const schN = assigned.filter(p => p.sched).length, openSh = P.filter(p => p.open_shift).length;
  const byBr = {}; assigned.forEach(p => p.assigns.forEach(a => { (byBr[a.branch] = byBr[a.branch] || []).push({ p, a }); }));
  const brOrder = BR.map(b => b.name).filter(n => byBr[n]).concat(Object.keys(byBr).filter(n => !BR.some(b => b.name === n)));
  const status = (p) => { const at = p.att;
    if (at && at.out) return chip('pulang ' + clock(at.out), 'gray');
    if (at && at.in) return chip('masuk ' + clock(at.in) + (at.late > 0 ? ' · telat ' + jam(at.late) : ''), at.late > 0 ? 'yellow' : 'green');
    if (!isToday) return chip('tidak absen', 'gray');
    if (p.sched && p.sched.starts && p.sched.starts.slice(0, 5) < new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16)) return chip('belum absen', 'red');
    return chip(p.sched ? 'belum mulai' : 'tanpa jadwal', 'gray'); };
  const row = ({ p, a }) => `<tr><td><b>${esc(p.nick)}</b>${p.linked ? '' : ' ' + chip('belum pernah masuk', 'yellow')}<br><small class="muted">${esc(p.name)}</small></td>
    <td>${posChip(a.position)}${a.kind === 'tambahan' ? ' <small class="muted">tambahan</small>' : ''}${p.next ? `<br><small class="blue-t">→ ${esc(p.next.pos.label)} · ${esc(p.next.branch)} ${fdate(p.next.start_day, false)}</small>` : ''}</td>
    <td>${p.sched ? esc(p.sched.shift || '') + ' ' + hm(p.sched.starts) + '–' + hm(p.sched.ends) : '<span class="muted">—</span>'}</td>
    <td>${status(p)}${p.open_shift ? ' ' + chip('kas terbuka', 'blue') : ''}</td>
    <td>${p.checks ? `buka ${p.checks.buka || 0} · tutup ${p.checks.tutup || 0}` : '<span class="muted">—</span>'}</td>
    <td class="small">${p.m_hadir} hadir · <span class="${p.m_telat ? 'red' : ''}">${p.m_telat} telat</span><br>lembur ${jam(p.m_lembur)} · poin ${p.m_poin}</td>
    <td><div class="row gap6 wrap"><button class="btn sm" data-mv="${p.id}">Mutasi</button><button class="btn sm" data-sc="${p.id}">Jadwal</button><button class="btn sm" data-more="${p.id}" data-as="${a.id}">⋯</button></div></td></tr>`;
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Penugasan, mutasi, jadwal, lembur, dan ceklis staf lapangan Rentalaja</span><h1>Tim Operasional</h1></div>
    <div class="row gap wrap"><a class="btn" href="#/ops?d=${addDays(day, -1)}">‹</a><b>${fdate(day)}${isToday ? ' · hari ini' : ''}</b><a class="btn" href="#/ops?d=${addDays(day, 1)}">›</a>
    <a class="btn" href="https://ops.pokama.org/" data-sso="pk_ops" target="_blank" rel="noopener">Kerja Lapangan ↗</a><button class="btn" data-a="otas">Tugaskan lembur</button><button class="btn pri" data-a="add">+ Staf lapangan</button></div></header>
  <div class="tiles">
    <div class="tile"><span>Staf bertugas</span><b>${assigned.length}</b><small>${BR.length ? Object.keys(byBr).length + ' cabang' : ''}${free.length ? ' · ' + free.length + ' belum ditugaskan' : ''}</small></div>
    <div class="tile"><span>Sudah absen</span><b>${inN} / ${schN || assigned.length}</b><small>${schN ? 'dari yang terjadwal' : 'jadwal belum diatur'}</small></div>
    <div class="tile"><span>Telat</span><b class="${lateN ? 'red' : ''}">${lateN}</b><small>${isToday ? 'hari ini' : fdate(day, false)}</small></div>
    <div class="tile"><span>Lembur menunggu</span><b class="${pendOT.length ? 'red' : ''}">${pendOT.length}</b><small>${jam(OT.filter(o => o.status === 'disetujui').reduce((s, o) => s + o.minutes, 0))} disetujui bulan ini</small></div>
  </div>
  ${pendOT.length ? `<section class="card absen"><h2>Lembur menunggu keputusan</h2><div class="list">${pendOT.map(o => `<div class="li row gap wrap"><span style="flex:1"><b>${esc(o.nick)}</b> · ${fdate(o.day)} ${hm(o.starts)}–${hm(o.ends)} (${jam(o.minutes)})<br><small class="muted">${esc(o.reason || '')}</small></span><button class="btn sm pri" data-otok="${o.id}">Setujui</button><button class="btn sm" data-otno="${o.id}">Tolak</button></div>`).join('')}</div></section>` : ''}
  ${(LV || []).length ? `<section class="card absen"><h2>Cuti, izin, sakit menunggu keputusan</h2><div class="list">${LV.map(l => `<div class="li row gap wrap"><span style="flex:1"><b>${esc(l.nick)}</b> · ${({ cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit' })[l.kind] || l.kind} ${fdate(l.day)}${l.end_day && l.end_day !== l.day ? ' – ' + fdate(l.end_day) : ''}<br><small class="muted">${esc(l.reason || '')}</small></span><button class="btn sm pri" data-lvok="${l.id}">Setujui</button><button class="btn sm" data-lvno="${l.id}">Tolak</button></div>`).join('')}</div></section>` : ''}
  ${!P.length ? `<section class="card"><h2>Belum ada staf lapangan</h2><p class="muted">Tambahkan kasir, CS, runner, sopir, QC, teknisi, atau kepala cabang. Mereka masuk ops.pokama.org dengan akun Google (email yang didaftarkan), absen dan ceklis di sini, lalu membuka panel Rentalaja sesuai penugasan tanpa login lagi.</p><button class="btn pri" data-a="add">+ Staf lapangan</button></section>` : ''}
  ${brOrder.map(n => `<section class="card pad0 scroll-x"><div class="row between" style="padding:14px 16px 4px"><h2 style="margin:0">${esc(n)}</h2><small class="muted">${byBr[n].length} orang · ${byBr[n].filter(x => x.p.att && x.p.att.in).length} sudah absen</small></div>
    <table class="tbl"><thead><tr><th>Nama</th><th>Posisi</th><th>Jadwal</th><th>Kehadiran</th><th>Ceklis</th><th>Bulan ini</th><th></th></tr></thead><tbody>${byBr[n].map(row).join('')}</tbody></table></section>`).join('')}
  ${free.length ? `<section class="card"><h2>Belum ditugaskan</h2><div class="list">${free.map(p => `<div class="li row gap wrap"><b style="flex:1">${esc(p.nick)} <small class="muted">${esc(p.email || '')}</small></b>${p.next ? `<small class="muted">mulai ${fdate(p.next.start_day, false)} sebagai ${esc(p.next.pos.label)} · ${esc(p.next.branch)}</small>` : ''}<button class="btn sm pri" data-mv="${p.id}">Tugaskan</button></div>`).join('')}</div></section>` : ''}
  <div class="split2">
  <section class="card"><h2>Riwayat penugasan & mutasi</h2><div class="list">${(t.moves || []).map(m => `<div class="li row gap wrap">${posChip(m.position)}<span style="flex:1"><b>${esc(m.nick)}</b> · ${esc(m.branch)} <small class="muted">${fdate(m.start_day, false)} – ${m.end_day ? fdate(m.end_day, false) : 'sekarang'} · ${m.kind}${m.reason ? ' · ' + esc(m.reason) : ''}${m.by && m.by !== '—' ? ' · oleh ' + esc(m.by) : ''}</small></span></div>`).join('') || '<p class="muted small">Belum ada.</p>'}</div></section>
  <section class="card"><h2>Lembur bulan ini</h2><div class="list">${OT.filter(o => o.status !== 'diajukan').map(o => `<div class="li row gap wrap"><span style="flex:1"><b>${esc(o.nick)}</b> · ${fdate(o.day, false)} ${hm(o.starts)}–${hm(o.ends)} · ${jam(o.minutes)} ${chip(o.kind === 'tugas' ? 'ditugaskan' : OTST[o.status][0], o.kind === 'tugas' ? 'blue' : OTST[o.status][1])}<br><small class="muted">${esc(o.reason || '')}${o.by ? ' · ' + esc(o.by) : ''}</small></span></div>`).join('') || '<p class="muted small">Belum ada.</p>'}</div>
    ${P.length ? `<h3>Rekap per orang</h3><div class="list">${P.filter(p => p.m_lembur).map(p => `<div class="li row gap"><span style="flex:1">${esc(p.nick)}</span><b>${jam(p.m_lembur)}</b></div>`).join('') || '<p class="muted small">—</p>'}</div>` : ''}</section>
  </div>
  <details class="card"><summary><h2 style="display:inline">Ceklis buka & tutup</h2> <small class="muted">· ${IT.filter(i => i.active).length} butir aktif</small></summary>
    <div class="row gap" style="margin:8px 0"><button class="btn sm" data-a="item">+ Butir ceklis</button><small class="muted">Butir tanpa posisi berlaku untuk semua. Ceklis tutup wajib lengkap sebelum absen keluar.</small></div>
    <table class="tbl"><thead><tr><th>Tahap</th><th>Posisi</th><th>Butir</th><th></th></tr></thead><tbody>${IT.map(i => `<tr class="${i.active ? '' : 'muted'}"><td>${i.phase}</td><td>${i.position ? posChip(i.position) : '<span class="muted">semua</span>'}</td><td>${esc(i.label)}${i.active ? '' : ' ' + chip('nonaktif', 'gray')}</td><td><button class="btn sm" data-it="${i.id}">Ubah</button></td></tr>`).join('')}</tbody></table></details>`;

  const brSel = (sel) => `<select name="br" class="inp">${opts(BR.map(b => [b.id, b.name]), sel, '— pilih cabang —')}</select>`;
  const posSel = (sel) => `<select name="pos" class="inp">${opts(POS, sel, '— pilih posisi —')}</select>`;
  const pOf = (id) => P.find(p => p.id === id);
  el.onclick = async (e) => {
    const g = (k) => e.target.closest('[data-' + k + ']'); let b;
    try {
      if ((b = g('a')) && b.dataset.a === 'add') {
        const r = await modal('Tambah staf lapangan', field('Nama lengkap', '<input name="name" class="inp">') + `<div class="g2">${field('Panggilan', '<input name="nick" class="inp">')}${field('WhatsApp', '<input name="wa" class="inp" inputmode="tel" placeholder="0812…">')}</div>`
          + field('Email Google', '<input name="email" class="inp" type="email" placeholder="nama@gmail.com">', 'Dipakai untuk masuk Sistem Kerja (Masuk dengan Google). Akun Rentalaja dibuat otomatis saat pertama masuk.')
          + `<div class="g2">${field('Posisi', posSel(''))}${field('Cabang', brSel(''))}</div>` + field('Mulai bertugas', `<input type="date" name="d" class="inp" value="${today()}">`),
          { submit: 'Tambahkan', onSubmit: async (f) => { need(f.name, 'Isi nama'); need(f.email, 'Isi email Google'); need(f.pos, 'Pilih posisi'); need(f.br, 'Pilih cabang');
            await db.rpc('ops_person_add', { p_name: f.name, p_nick: f.nick, p_email: f.email, p_phone: f.wa, p_position: f.pos, p_branch: f.br, p_start: f.d || today() }); } });
        if (r) { toast('Staf ditambahkan. Minta ia masuk ops.pokama.org dengan Google.'); reload(); } return;
      }
      if ((b = g('mv'))) { const p = pOf(b.dataset.mv); const cur = p.assigns[0];
        const r = await modal((p.assigns.length ? 'Mutasi · ' : 'Tugaskan · ') + p.nick, `${p.assigns.length ? `<p class="muted small" style="margin-top:0">Sekarang: ${p.assigns.map(a => esc(a.pos.label) + ' · ' + esc(a.branch)).join(', ')}</p>` : ''}`
          + (p.assigns.length ? field('Jenis', `<select name="mode" class="inp">${opts([['mutasi', 'Mutasi (ganti posisi/cabang, penugasan lama berakhir)'], ['tambahan', 'Tugas tambahan (penugasan lama tetap)']], 'mutasi')}</select>`) : '')
          + `<div class="g2">${field('Posisi baru', posSel(cur ? cur.position : ''))}${field('Cabang', brSel(cur ? cur.branch_id : ''))}</div>` + field('Berlaku mulai', `<input type="date" name="d" class="inp" value="${day}">`)
          + field('Alasan', '<input name="why" class="inp" placeholder="Contoh: Wanaraja kekurangan runner akhir pekan">', 'Wajib untuk mutasi. Staf mendapat notifikasi; akses panel Rentalaja ikut berubah pada tanggal berlaku.'),
          { submit: 'Simpan', onSubmit: async (f) => { need(f.pos, 'Pilih posisi'); need(f.br, 'Pilih cabang');
            await db.rpc('ops_assign', { p_person: p.id, p_position: f.pos, p_branch: f.br, p_start: f.d || today(), p_reason: f.why || null, p_mode: f.mode || 'mutasi' }); } });
        if (r) { toast('Penugasan tersimpan'); reload(); } return; }
      if ((b = g('sc'))) { const p = pOf(b.dataset.sc); if (!p.linked) return toast(p.nick + ' belum pernah masuk Sistem Kerja. Jadwal bisa diatur setelah ia masuk pertama kali.', 'err');
        const r = await modal('Jadwal shift · ' + p.nick, field('Tanggal', `<input type="date" name="d" class="inp" value="${day}">`) + `<div class="g2">${field('Nama shift', `<select name="sh" class="inp">${opts([['Pagi', 'Pagi'], ['Siang', 'Siang'], ['Sore', 'Sore'], ['Malam', 'Malam'], ['Penuh', 'Penuh']], (p.sched && p.sched.shift) || 'Pagi')}</select>`)}${field('Ulangi sampai', `<input type="date" name="to" class="inp" value="${day}">`)}</div>`
          + `<div class="g2">${field('Masuk', `<input type="time" name="s" class="inp" value="${p.sched ? hm(p.sched.starts).replace('.', ':') : '08:00'}">`)}${field('Pulang', `<input type="time" name="e" class="inp" value="${p.sched ? hm(p.sched.ends).replace('.', ':') : '16:00'}">`)}</div>`
          + '<p class="muted small">Telat dihitung dari jam masuk ini. Kosongkan jam masuk untuk menghapus jadwal.</p>',
          { submit: 'Simpan jadwal', onSubmit: async (f) => { need(f.d, 'Pilih tanggal'); const to = f.to && f.to >= f.d ? f.to : f.d; let d = f.d, n = 0;
            while (d <= to && n < 31) { await db.rpc('ops_schedule_set', { p_person: p.id, p_day: d, p_shift: f.sh, p_starts: f.s || null, p_ends: f.e || null }); d = addDays(d, 1); n++; } } });
        if (r) { toast('Jadwal tersimpan'); reload(); } return; }
      if ((b = g('more'))) { const p = pOf(b.dataset.more), a = p.assigns.find(x => x.id === b.dataset.as);
        const r = await modal(p.nick + ' · ' + a.pos.label + ' ' + a.branch, `<div class="kv"><div><span>Email</span><b>${esc(p.email || '—')}</b></div><div><span>WhatsApp</span><b>${p.phone ? '+' + esc(p.phone) : '—'}</b></div><div><span>Akun Rentalaja</span><b>${esc(p.staff_role || 'dibuat saat masuk pertama')}</b></div><div><span>Bertugas sejak</span><b>${fdate(a.start_day)}</b></div></div>`
          + field('Akhiri penugasan ini pada', `<input type="date" name="end" class="inp" value="${day}">`, 'Isi lalu tekan Akhiri. Akses panel cabang ini tertutup setelah tanggal tersebut.'),
          { submit: 'Akhiri penugasan', onSubmit: async (f) => { need(f.end, 'Pilih tanggal'); await db.rpc('ops_assign_end', { p_id: a.id, p_end: f.end }); } });
        if (r) { toast('Penugasan diakhiri'); reload(); } return; }
      if ((b = g('a')) && b.dataset.a === 'otas') {
        const r = await modal('Tugaskan lembur', field('Staf', `<select name="p" class="inp">${opts(assigned.map(p => [p.id, p.nick + ' · ' + p.assigns.map(a => a.pos.label + ' ' + a.branch).join(', ')]), '', '— pilih staf —')}</select>`)
          + field('Tanggal', `<input type="date" name="d" class="inp" value="${day}">`) + `<div class="g2">${field('Mulai', '<input type="time" name="s" class="inp" value="17:00">')}${field('Selesai', '<input type="time" name="e" class="inp" value="20:00">')}</div>`
          + field('Keperluan', '<input name="why" class="inp" placeholder="Contoh: event jeep rombongan 40 orang">'),
          { submit: 'Tugaskan', onSubmit: async (f) => { need(f.p, 'Pilih staf'); need(f.d, 'Pilih tanggal'); need(f.s, 'Isi jam mulai'); need(f.e, 'Isi jam selesai'); need((f.why || '').trim(), 'Tulis keperluan');
            await db.rpc('ops_ot_assign', { p_person: f.p, p_day: f.d, p_starts: f.s, p_ends: f.e, p_reason: f.why.trim() }); } });
        if (r) { toast('Lembur ditugaskan · staf mendapat notifikasi'); reload(); } return; }
      if ((b = g('lvok'))) { await db.rpc('ops_leave_decide', { p_id: b.dataset.lvok, p_ok: true }); toast('Disetujui'); return reload(); }
      if ((b = g('lvno'))) { const l = LV.find(x => x.id === b.dataset.lvno);
        const r = await modal('Tolak pengajuan ' + l.nick, field('Alasan penolakan', '<textarea name="note" class="inp" rows="3"></textarea>'),
          { submit: 'Tolak', onSubmit: async (f) => { need((f.note || '').trim(), 'Tulis alasan'); await db.rpc('ops_leave_decide', { p_id: l.id, p_ok: false, p_note: f.note.trim() }); } });
        if (r) { toast('Ditolak · alasan dikirim'); reload(); } return; }
      if ((b = g('otok'))) { await db.rpc('ops_ot_decide', { p_id: b.dataset.otok, p_ok: true }); toast('Lembur disetujui'); return reload(); }
      if ((b = g('otno'))) { const o = OT.find(x => x.id === b.dataset.otno);
        const r = await modal('Tolak lembur ' + o.nick, `<p class="muted small" style="margin-top:0">${fdate(o.day)} ${hm(o.starts)}–${hm(o.ends)} · ${esc(o.reason || '')}</p>` + field('Alasan penolakan', '<textarea name="note" class="inp" rows="3"></textarea>'),
          { submit: 'Tolak', onSubmit: async (f) => { need((f.note || '').trim(), 'Tulis alasan'); await db.rpc('ops_ot_decide', { p_id: o.id, p_ok: false, p_note: f.note.trim() }); } });
        if (r) { toast('Ditolak · alasan dikirim'); reload(); } return; }
      if ((b = g('it')) || ((b = g('a')) && b.dataset.a === 'item')) { const i = b.dataset.it ? IT.find(x => x.id === b.dataset.it) : { phase: 'buka', active: true };
        const r = await modal(i.id ? 'Ubah butir ceklis' : 'Butir ceklis baru', `<div class="g2">${field('Tahap', `<select name="ph" class="inp">${opts([['buka', 'Buka (awal shift)'], ['tutup', 'Tutup (akhir shift)']], i.phase)}</select>`)}${field('Posisi', `<select name="pos" class="inp">${opts([['', 'Semua posisi']].concat(POS), i.position || '')}</select>`)}</div>`
          + field('Butir', `<input name="label" class="inp" value="${esc(i.label || '')}">`) + `<div class="g2">${field('Urutan', `<input name="sort" class="inp" inputmode="numeric" value="${i.sort ?? 50}">`)}<label class="chk" style="align-self:end"><input type="checkbox" name="act" ${i.active ? 'checked' : ''}> Aktif</label></div>`,
          { submit: 'Simpan', onSubmit: async (f) => { need((f.label || '').trim(), 'Isi butir'); await db.rpc('ops_item_save', { p_id: i.id || null, p_position: f.pos || '', p_phase: f.ph, p_label: f.label, p_sort: +f.sort || 0, p_active: !!f.act }); } });
        if (r) { toast('Ceklis tersimpan'); reload(); } return; }
    } catch (er) { toast(er.message, 'err'); }
  };
}

export default { shift, team };

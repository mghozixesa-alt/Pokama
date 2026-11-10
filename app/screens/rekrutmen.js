import { ctx, db, esc, toast, modal, field, unitOpts, unitName, fdate, ftime, peopleOpts, safeUrl } from '../core.js';

/* Rekrutmen & talent pool: hanya tim rekrutmen (pk_settings.rec_viewers). Data lewat RPC rec_* (dicek ulang di server). */
export const canRec = () => !!(ctx.me && (ctx.settings.rec_viewers || []).includes(ctx.me.code));

const STAGES = [['tes', 'Tes', '#8A4B00', '#FFF1D6'], ['review', 'Review', '#1E5AA8', '#E6EFFD'], ['wawancara', 'Wawancara', '#077A70', '#E3F7F5'], ['tawaran', 'Tawaran', '#077A70', '#E3F7F5'], ['diterima', 'Diterima', '#1F2B4D', '#BFF0EA'], ['tidak_lanjut', 'Tidak lanjut', '#4A5468', '#EEF0F3']];
const SM = Object.fromEntries(STAGES.map(s => [s[0], s]));
const stChip = k => { const s = SM[k] || SM.tes; return `<span class="chip" style="background:${s[3]};color:${s[2]}">${s[1]}</span>`; };
const DISC = { D: ['Dominan', 'tegas, cepat ambil keputusan, suka target', '#C0392B'], I: ['Influence', 'ramah, persuasif, suka bertemu orang', '#D68910'], S: ['Steady', 'sabar, stabil, setia, pendengar baik', '#1E8449'], C: ['Compliance', 'teliti, rapi, taat prosedur', '#1E5AA8'] };
const POOL = { siap: 'Siap dipanggil', diproses: 'Sedang diproses', karyawan: 'Sudah karyawan', tidak_direkomendasikan: 'Tidak direkomendasikan' };
const KARIR = 'https://pokama.org/karir/';
let S = { tab: 'pelamar', job: '', stage: 'aktif', q: '' };

const waUrl = (wa, t = '') => 'https://wa.me/' + String(wa || '').replace(/\D/g, '') + (t ? '?text=' + encodeURIComponent(t) : '');
function discChip(d) { if (!d) return '<span class="chip gray">DISC belum</span>'; const k = String(d).split('/'); const c = DISC[k[0]] || DISC.S; return `<span class="chip" style="background:#fff;border:1.5px solid ${c[2]};color:${c[2]};font-weight:800">DISC ${esc(d)}</span>`; }
function discBars(sc) {
  if (!sc) return '<p class="muted small">Belum mengerjakan tes DISC.</p>';
  return `<div class="stack" style="gap:6px">${['D', 'I', 'S', 'C'].map(k => `<div style="display:grid;grid-template-columns:92px 1fr 36px;gap:8px;align-items:center;font-size:13px"><b style="color:${DISC[k][2]}">${k} · ${DISC[k][0]}</b>
    <span style="height:10px;border-radius:5px;background:#EEF0F3;overflow:hidden"><i style="display:block;height:10px;width:${+sc[k] || 0}%;background:${DISC[k][2]}"></i></span><b style="text-align:right">${+sc[k] || 0}</b></div>`).join('')}</div>`;
}
const scoreTxt = (tests, names) => Object.entries(tests || {}).filter(([k, v]) => k !== 'disc' && (v.score != null || typeof v === 'number')).map(([k, v]) => `${esc(names[k] || k)} <b>${typeof v === 'number' ? v : v.score}</b>`).join(' · ');

export default async function rekrutmen(el) {
  if (!canRec()) { el.innerHTML = '<div class="card"><p class="muted">Menu Rekrutmen hanya untuk tim rekrutmen.</p></div>'; return; }
  const D = await db.rpc('rec_board', { p_job: null });
  const jobs = D.jobs || [], apps = D.apps || [], tests = D.tests || [];
  const tname = Object.fromEntries(tests.map(t => [t.code, t.name.replace(/ \(.*\)/, '')]));
  const jobOf = Object.fromEntries(jobs.map(j => [j.id, j]));
  const cnt = k => apps.filter(a => a.stage === k && (!S.job || a.job_id === (S.job === 'pool' ? null : S.job))).length;
  const tabs = [['pelamar', `Pelamar (${apps.filter(a => !['diterima', 'tidak_lanjut'].includes(a.stage)).length})`], ['pool', 'Talent pool'], ['lowongan', `Lowongan (${jobs.filter(j => j.status === 'buka').length} buka)`], ['tes', 'Bank soal']];
  let body = '';

  if (S.tab === 'pelamar') {
    const list = apps.filter(a => (!S.job || (S.job === 'pool' ? !a.job_id : a.job_id === S.job)) && (S.stage === 'semua' || (S.stage === 'aktif' ? !['diterima', 'tidak_lanjut'].includes(a.stage) : a.stage === S.stage)));
    body = `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><select class="inp" id="fjob" style="max-width:260px;height:40px"><option value="">Semua lowongan</option><option value="pool"${S.job === 'pool' ? ' selected' : ''}>Talent pool (tanpa lowongan)</option>${jobs.map(j => `<option value="${j.id}"${S.job === j.id ? ' selected' : ''}>${esc(j.title)} · ${esc(j.city)}</option>`).join('')}</select></div>
      <div class="tiles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:12px">${[['aktif', 'Aktif', apps.filter(a => (!S.job || (S.job === 'pool' ? !a.job_id : a.job_id === S.job)) && !['diterima', 'tidak_lanjut'].includes(a.stage)).length], ...STAGES.map(s => [s[0], s[1], cnt(s[0])]), ['semua', 'Semua', '']].map(([k, l, n]) =>
        `<button type="button" class="card" data-stage="${k}" style="padding:10px 12px;text-align:left;cursor:pointer;border:2px solid ${S.stage === k ? '#09BEAF' : 'transparent'}"><span class="muted small">${l}</span><b style="display:block;font-size:20px">${n}</b></button>`).join('')}</div>
      ${list.length ? `<div class="stack">${list.map(a => {
        const j = jobOf[a.job_id]; const d = a.tests?.disc?.disc; const blur = Object.values(a.tests || {}).reduce((s, t) => s + (t.blur || 0), 0); const late = Object.values(a.tests || {}).some(t => t.late);
        const avg = a.reviews?.length ? (a.reviews.reduce((s, r) => s + (r.rating || 0), 0) / a.reviews.filter(r => r.rating).length || 0) : 0;
        return `<button type="button" class="card" data-app="${a.id}" style="text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px;width:100%">
          <div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start"><div><b style="font-size:15px">${esc(a.cand.name || '(tanpa nama)')}</b><div class="muted small">${esc(j ? j.title + ' · ' + j.city : 'Talent pool')} · ${esc(a.cand.city || '—')}${a.cand.has_sim_c === true ? ' · SIM C' : ''}</div></div>${stChip(a.stage)}</div>
          <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">${discChip(d && d.profile)}<span class="small">${scoreTxt(a.tests, tname) || '<span class="muted">Tes belum lengkap</span>'}</span>
            ${blur ? `<span class="chip" style="background:#FFF1D6;color:#8A4B00">Pindah aplikasi ${blur}×</span>` : ''}${late ? '<span class="chip" style="background:#FDE8E6;color:#C0392B">Lewat waktu</span>' : ''}${avg ? `<span class="chip gray">★ ${avg.toFixed(1)}</span>` : ''}
            ${(a.cand.labels || []).map(l => `<span class="chip gray">${esc(l)}</span>`).join('')}</div>
          <span class="muted small">Masuk ${fdate(a.created_at)}${a.interview_at ? ' · Wawancara ' + ftime(a.interview_at) : ''}</span></button>`; }).join('')}</div>` : '<div class="card"><p class="muted">Belum ada pelamar di filter ini.</p></div>'}`;
  }

  if (S.tab === 'pool') {
    body = `<div class="row" style="gap:8px;margin-bottom:10px"><input class="inp" id="pq" placeholder="Cari nama, kota, label, minat, atau nomor…" value="${esc(S.q)}" style="max-width:420px;height:40px"><button class="btn" id="pgo" type="button">Cari</button></div><div id="plist"><p class="muted">Memuat…</p></div>`;
  }

  if (S.tab === 'lowongan') {
    body = `<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="muted small">Gaji tidak ditampilkan di halaman publik. Tautan publik: <a href="${KARIR}" target="_blank" rel="noopener">pokama.org/karir</a></span><button class="btn pri" id="newjob" type="button">+ Lowongan baru</button></div>
      ${jobs.length ? `<div class="stack">${jobs.map(j => `<div class="card" style="display:flex;flex-direction:column;gap:6px">
        <div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start"><div><b style="font-size:15px">${esc(j.title)}</b><div class="muted small">${esc(unitName(j.unit_code))} · ${esc(j.city)} · ${esc(j.type)}${j.closes_on ? ' · tutup ' + fdate(j.closes_on) : ''}</div></div>
          <span class="chip ${j.status === 'buka' ? '' : 'gray'}" style="${j.status === 'buka' ? 'background:#E3F7F5;color:#077A70' : ''}">${j.status === 'buka' ? 'Buka' : 'Tutup'}</span></div>
        <div class="small">Tes: ${(j.tests || []).map(t => esc(tname[t] || t)).join(', ')} · <b>${j.n}</b> pelamar aktif</div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-ej="${j.id}" type="button">Ubah</button><button class="btn" data-copy="${KARIR}#job/${j.id}" type="button">Salin tautan</button><button class="btn" data-see="${j.id}" type="button">Lihat pelamar</button>
          <a class="btn" href="${waUrl('', 'Lowongan ' + j.title + ' di ' + unitName(j.unit_code) + ' ' + j.city + '. Lamar lewat HP: ' + KARIR + '#job/' + j.id)}" target="_blank" rel="noopener">Bagikan ke WA</a></div></div>`).join('')}</div>` : '<div class="card"><p class="muted">Belum ada lowongan. Buat lowongan pertama, lalu bagikan tautannya.</p></div>'}`;
  }

  if (S.tab === 'tes') {
    body = `<div class="stack">${tests.map(t => `<div class="card"><b>${esc(t.name)}</b><div class="muted small">${t.kind === 'disc' ? 'Pilih paling mirip & paling tidak mirip · hasil profil D/I/S/C' : 'Pilihan ganda · skor 0–100'} · ${t.n} soal · ${t.minutes} menit</div></div>`).join('')}
      <div class="note">DISC selalu dipakai di setiap lowongan. Skor tes berlaku 6 bulan: pelamar yang melamar posisi lain tidak mengulang tes yang sama. Soal disimpan di tabel pk_rec_questions; minta perubahan soal ke tim sistem.</div>
      <div class="card"><b>Cara membaca DISC</b><div class="stack" style="gap:4px;margin-top:6px">${Object.entries(DISC).map(([k, v]) => `<div class="small"><b style="color:${v[2]}">${k} · ${v[0]}</b>: ${v[1]}</div>`).join('')}<div class="small muted">Profil dua huruf (mis. D/I) berarti dua gaya sama kuat. DISC bukan nilai lulus/gagal; pakai untuk mencocokkan gaya kerja dengan posisi dan bahan wawancara.</div></div></div></div>`;
  }

  el.innerHTML = `<header class="ph"><div><span class="muted small">Orang · hanya tim rekrutmen (${esc((ctx.settings.rec_viewers || []).join(', '))})</span><h1>Rekrutmen</h1></div><a class="btn" href="${KARIR}" target="_blank" rel="noopener">Buka portal karir</a></header>
    <div class="chips">${tabs.map(([k, l]) => `<button class="chipbtn${S.tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  const rerender = () => rekrutmen(el);
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; rerender(); });
  el.querySelector('#fjob')?.addEventListener('change', e => { S.job = e.target.value; rerender(); });
  el.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { S.stage = b.dataset.stage; rerender(); });
  el.querySelectorAll('[data-app]').forEach(b => b.onclick = () => openApp(apps.find(a => a.id === b.dataset.app), jobOf, tname, rerender));
  el.querySelector('#newjob')?.addEventListener('click', () => editJob(null, tests, rerender));
  el.querySelectorAll('[data-ej]').forEach(b => b.onclick = () => editJob(jobOf[b.dataset.ej], tests, rerender));
  el.querySelectorAll('[data-see]').forEach(b => b.onclick = () => { S.tab = 'pelamar'; S.job = b.dataset.see; S.stage = 'aktif'; rerender(); });
  el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Tautan disalin'); } catch (e) { toast(b.dataset.copy); } });
  if (S.tab === 'pool') {
    const go = async () => { S.q = el.querySelector('#pq').value.trim(); await drawPool(el, tname, rerender); };
    el.querySelector('#pgo').onclick = go; el.querySelector('#pq').onkeydown = e => { if (e.key === 'Enter') go(); };
    drawPool(el, tname, rerender);
  }
}

async function drawPool(el, tname, rerender) {
  const box = el.querySelector('#plist');
  let P = [];
  try { P = await db.rpc('rec_pool', { p_q: S.q || null }); } catch (e) { box.innerHTML = `<p class="form-err">${esc(e.message)}</p>`; return; }
  box.innerHTML = P.length ? `<p class="muted small">${P.length} orang${S.q ? ' cocok dengan "' + esc(S.q) + '"' : ''}</p><div class="stack">${P.map(c => `<div class="card" style="display:flex;flex-direction:column;gap:6px">
    <div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start"><div><b style="font-size:15px">${esc(c.name)}</b><div class="muted small">${esc(c.city || '—')} · ${esc(POOL[c.pool_status] || c.pool_status)}${c.last_test ? ' · tes terakhir ' + fdate(c.last_test) : ''}</div></div>${discChip(c.disc)}</div>
    <div class="small">${scoreTxt(c.scores, tname) || '<span class="muted">Belum ada skor tes</span>'}${(c.interests || []).length ? ' · minat: ' + c.interests.map(esc).join(', ') : ''}</div>
    <div class="small muted">${(c.apps || []).map(a => esc((a.job || 'Talent pool') + ' (' + ((SM[a.stage] || [])[1] || a.stage) + ')')).join(' · ')}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${(c.labels || []).map(l => `<span class="chip gray">${esc(l)}</span>`).join('')}
      <button class="btn" data-lbl="${c.id}" type="button">Label & catatan</button><button class="btn" data-inv="${c.id}" type="button">Undang via WA</button><a class="btn" href="${waUrl(c.wa)}" target="_blank" rel="noopener">Chat</a></div></div>`).join('')}</div>` : '<div class="card"><p class="muted">Belum ada orang di talent pool.</p></div>';
  const byId = Object.fromEntries(P.map(c => [c.id, c]));
  box.querySelectorAll('[data-lbl]').forEach(b => b.onclick = async () => {
    const c = byId[b.dataset.lbl];
    const ok = await modal('Label & catatan · ' + c.name, field('Label (pisahkan dengan koma)', `<input class="inp" name="labels" value="${esc((c.labels || []).join(', '))}" placeholder="runner potensial, bisa Bandung">`) +
      field('Catatan internal', `<textarea class="inp" name="note" rows="3"></textarea>`, 'Kosongkan bila tidak mengubah catatan'), { onSubmit: async f => { await db.rpc('rec_label', { p_cand: c.id, p_labels: f.labels.split(',').map(s => s.trim()).filter(Boolean), p_note: f.note.trim() || null }); } });
    if (ok) { toast('Tersimpan'); drawPool(el, tname, rerender); }
  });
  box.querySelectorAll('[data-inv]').forEach(b => b.onclick = async () => {
    const c = byId[b.dataset.inv];
    const ok = await modal('Undang ' + c.name, field('Pesan WhatsApp', `<textarea class="inp" name="msg" rows="5">Halo ${esc(c.name)}, kami dari tim rekrutmen Pokama. Ada posisi yang mungkin cocok untuk Anda. Lihat dan lamar di ${KARIR}</textarea>`, 'Terkirim dari nomor WhatsApp sistem Pokama'), { submit: 'Kirim', onSubmit: async f => { await db.rpc('rec_invite', { p_cand: c.id, p_msg: f.msg }); } });
    if (ok) toast('Undangan dikirim');
  });
}

async function openApp(a, jobOf, tname, rerender) {
  const c = a.cand, j = jobOf[a.job_id], d = a.tests?.disc?.disc;
  const tl = Object.entries(a.tests || {}).map(([k, t]) => `<div class="row" style="justify-content:space-between;gap:8px;font-size:13px;padding:4px 0;border-top:1px solid #EEF0F3"><span>${esc(tname[k] || k)}</span><span>${t.done ? (k === 'disc' ? '<b>' + esc(t.disc?.profile || '') + '</b>' : '<b>' + t.score + '</b>/100') : '<span class="muted">belum selesai</span>'}${t.blur ? ` · pindah aplikasi ${t.blur}×` : ''}${t.late ? ' · lewat waktu' : ''}</span></div>`).join('');
  const rv = (a.reviews || []).map(r => `<div class="small" style="padding:4px 0;border-top:1px solid #EEF0F3"><b>${esc(r.by || '—')}</b> ${r.rating ? '★'.repeat(r.rating) : ''} · ${ftime(r.at)}<br>${esc(r.note || '')}</div>`).join('');
  const stOpts = STAGES.map(s => `<option value="${s[0]}"${a.stage === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('');
  const html = `<div class="stack" style="gap:12px">
    <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b style="font-size:16px">${esc(c.name)}</b><div class="muted small">${esc(j ? j.title + ' · ' + j.city : 'Talent pool')} · ${esc(c.city || '—')} · SIM C: ${c.has_sim_c == null ? '—' : c.has_sim_c ? 'ya' : 'tidak'}</div></div>${stChip(a.stage)}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn" href="${waUrl(c.wa)}" target="_blank" rel="noopener">Chat WA</a>${c.cv_url ? `<a class="btn" href="${safeUrl(c.cv_url)}" target="_blank" rel="noopener">Buka CV</a>` : ''}</div>
    ${c.experience ? `<div><b class="small">Pengalaman</b><p class="small" style="margin:4px 0 0;white-space:pre-line">${esc(c.experience)}</p></div>` : ''}
    <div><b class="small">Gaya kerja (DISC)${d ? ' · profil ' + esc(d.profile) : ''}</b><div style="margin-top:6px">${discBars(d && d.scaled)}</div>${d ? `<p class="small muted" style="margin:6px 0 0">${String(d.profile).split('/').map(k => DISC[k] ? `<b>${k}</b>: ${DISC[k][1]}` : '').join(' · ')}</p>` : ''}</div>
    <div><b class="small">Hasil tes</b>${tl || '<p class="muted small">Belum ada tes.</p>'}</div>
    <div><b class="small">Penilaian tim</b>${rv || '<p class="muted small">Belum ada penilaian.</p>'}</div>
    <fieldset style="border:1px solid #E1E5EA;border-radius:12px;padding:10px 12px"><legend class="small" style="font-weight:800">Tambah penilaian</legend>
      <div class="g2">${field('Nilai', `<select class="inp" name="rating"><option value="">—</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${'★'.repeat(n)} (${n})</option>`).join('')}</select>`)}${field('Catatan', `<input class="inp" name="rnote" placeholder="Kesan wawancara, kekuatan, catatan">`)}</div></fieldset>
    <fieldset style="border:1px solid #E1E5EA;border-radius:12px;padding:10px 12px"><legend class="small" style="font-weight:800">Pindahkan tahap</legend>
      <div class="g2">${field('Tahap', `<select class="inp" name="stage">${stOpts}</select>`)}${field('Jadwal wawancara', `<input class="inp" type="datetime-local" name="interview_at">`)}</div>
      ${field('Tempat wawancara', `<input class="inp" name="interview_place" placeholder="Kantor Rentalaja Garut Kota / Google Meet" value="${esc(a.interview_place || '')}">`)}
      ${field('Alasan (bila tidak lanjut)', `<input class="inp" name="reason" value="${esc(a.reason || '')}">`)}
      <label class="chk"><input type="checkbox" name="notify" checked> Kabari pelamar lewat WhatsApp (wawancara, tawaran, tidak lanjut)</label>
      <label class="chk"><input type="checkbox" name="not_recommended"> Tandai tidak direkomendasikan (keluar dari talent pool)</label></fieldset></div>`;
  const canHire = ['tawaran', 'diterima'].includes(a.stage) && c.pool_status !== 'karyawan';
  const ok = await modal('Pelamar', html, { wide: true, submit: 'Simpan', extra: canHire ? { label: 'Jadikan karyawan', onClick: () => hire(a, j) } : undefined,
    onSubmit: async f => {
      if (f.rating || f.rnote.trim()) await db.rpc('rec_review', { p_app: a.id, p_rating: f.rating ? +f.rating : null, p_note: f.rnote });
      const iv = f.interview_at ? new Date(f.interview_at + ':00+07:00').toISOString() : '';
      if (f.stage !== a.stage || iv || f.interview_place !== (a.interview_place || '') || (f.stage === 'tidak_lanjut' && f.reason !== (a.reason || ''))) {
        if (f.stage === 'wawancara' && !iv && !a.interview_at) throw new Error('Isi jadwal wawancara');
        await db.rpc('rec_move', { p_app: a.id, p_stage: f.stage, p: { interview_at: iv, interview_place: f.interview_place, reason: f.reason, notify: !!f.notify && f.stage !== a.stage, not_recommended: !!f.not_recommended } });
      }
    } });
  if (ok) { toast('Tersimpan'); rerender(); }
}

async function hire(a, j) {
  const c = a.cand;
  const done = await modal('Jadikan karyawan · ' + c.name, `<p class="small muted">Membuat baris baru di Data Karyawan (Tim & Peran). Akun login dibuat terpisah dari menu Tim & Peran.</p>
    <div class="g2">${field('Kode karyawan', `<input class="inp" name="code" maxlength="4" placeholder="2–4 huruf, mis. RN" required>`)}${field('Jabatan', `<input class="inp" name="title" value="${esc(j ? j.title : '')}">`)}</div>
    <div class="g2">${field('Unit', `<select class="inp" name="unit_code">${unitOpts(j ? j.unit_code : '', '— pilih unit —')}</select>`)}${field('Atasan', `<select class="inp" name="boss_id">${peopleOpts('', '— pilih atasan —')}</select>`)}</div>
    <div class="g2">${field('Peran', `<select class="inp" name="role"><option value="staf">Staf</option><option value="lapangan">Staf lapangan</option><option value="leader">Leader</option></select>`)}${field('Tanggal masuk', `<input class="inp" type="date" name="joined_on">`)}</div>
    ${field('Email (opsional)', `<input class="inp" type="email" name="email">`)}`, { submit: 'Buat data karyawan', onSubmit: async f => { if (!f.unit_code) throw new Error('Pilih unit'); return await db.rpc('rec_hire', { p_app: a.id, p: f }); } });
  if (done) toast('Data karyawan dibuat. Lengkapi di Tim & Peran.');
  return done;
}

async function editJob(j, tests, rerender) {
  j = j || { tests: ['disc', 'umum'], status: 'buka', city: 'Garut', type: 'Penuh waktu' };
  const ok = await modal(j.id ? 'Ubah lowongan' : 'Lowongan baru', `
    ${field('Nama posisi', `<input class="inp" name="title" value="${esc(j.title || '')}" placeholder="Runner Antar-Jemput" required>`)}
    <div class="g2">${field('Unit', `<select class="inp" name="unit_code">${unitOpts(j.unit_code || '', '— pilih unit —')}</select>`)}${field('Kota', `<input class="inp" name="city" value="${esc(j.city || '')}">`)}</div>
    <div class="g2">${field('Jenis kerja', `<select class="inp" name="type">${['Penuh waktu', 'Paruh waktu', 'Shift', 'Lepas', 'Magang'].map(t => `<option${j.type === t ? ' selected' : ''}>${t}</option>`).join('')}</select>`)}${field('Tutup tanggal (opsional)', `<input class="inp" type="date" name="closes_on" value="${esc(j.closes_on || '')}">`)}</div>
    ${field('Ringkasan', `<textarea class="inp" name="summary" rows="2">${esc(j.summary || '')}</textarea>`)}
    ${field('Tugas utama', `<textarea class="inp" name="duties" rows="3" placeholder="Satu tugas per baris">${esc(j.duties || '')}</textarea>`)}
    ${field('Syarat', `<textarea class="inp" name="reqs" rows="3" placeholder="Satu syarat per baris">${esc(j.reqs || '')}</textarea>`, 'Gaji tidak ditampilkan; bahas saat wawancara/penawaran')}
    <div class="fld"><span>Tes online</span><div class="row" style="gap:12px;flex-wrap:wrap">${tests.map(t => `<label class="chk"><input type="checkbox" name="t_${t.code}" ${(j.tests || []).includes(t.code) ? 'checked' : ''} ${t.code === 'disc' ? 'disabled checked' : ''}> ${esc(t.name)} (${t.minutes} mnt)</label>`).join('')}</div></div>
    ${field('Status', `<select class="inp" name="status"><option value="buka"${j.status === 'buka' ? ' selected' : ''}>Buka</option><option value="tutup"${j.status === 'tutup' ? ' selected' : ''}>Tutup</option></select>`)}`,
    { wide: true, onSubmit: async f => {
      if (!f.unit_code) throw new Error('Pilih unit');
      const p = { id: j.id || '', title: f.title, unit_code: f.unit_code, city: f.city, type: f.type, summary: f.summary, duties: f.duties, reqs: f.reqs, status: f.status, closes_on: f.closes_on, tests: ['disc', ...tests.filter(t => t.code !== 'disc' && f['t_' + t.code]).map(t => t.code)] };
      return await db.rpc('rec_job_save', { p });
    } });
  if (ok) { toast('Lowongan tersimpan'); rerender(); }
}

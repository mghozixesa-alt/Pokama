import { ctx, db, esc, today, fdate, ftime, avatar, nick, modal, field, opts, toast, unitName, unitOpts, peopleOpts, isAdmin, logo, bizOf, need, chip, confirmBox } from '../core.js';

export const ST = {
  todo: ['Belum mulai', '#C9CED6', '#1F2933'], doing: ['Dikerjakan', '#2F6FDB', '#fff'], review: ['Menunggu review', '#F2B33D', '#1F2933'],
  revisi: ['Perlu revisi', '#E4475B', '#fff'], done: ['Selesai', '#09BEAF', '#1D3149'], hold: ['Ditunda', '#8E6FD8', '#fff'],
};
const stCell = (s) => { const x = ST[s] || ST.todo; return `<span class="st" style="background:${x[1]};color:${x[2]}">${x[0]}</span>`; };
const daysTo = (d) => d ? Math.round((new Date(d + 'T00:00:00Z') - new Date(today() + 'T00:00:00Z')) / 864e5) : null;

async function load() {
  const [tasks, projects] = await Promise.all([
    db.get('pk_tasks', 'select=*&order=due.asc.nullslast,created_at.desc&limit=1000'),
    db.get('pk_projects', 'select=*&order=created_at.desc'),
  ]);
  return { tasks, projects, proj: Object.fromEntries(projects.map(p => [p.id, p])) };
}

export async function taskForm(t = {}, projects = []) {
  const me = ctx.me;
  return modal(t.id ? 'Ubah pekerjaan' : 'Tugas baru',
    field('Judul pekerjaan', `<input name="title" class="inp" value="${esc(t.title || '')}" required>`) +
    field('Selesai bila', `<textarea name="dod" class="inp" rows="2" placeholder="Hasil yang bisa dicek reviewer">${esc(t.dod || '')}</textarea>`) +
    `<div class="g2">` + field('Unit', `<select name="unit_code" class="inp">${unitOpts(t.unit_code || me.unit_code)}</select>`) +
    field('Proyek', `<select name="project_id" class="inp">${opts(projects.filter(p => !p.is_closed).map(p => [p.id, p.name]), t.project_id, '— tanpa proyek —')}</select>`) +
    field('PIC (yang mengerjakan)', `<select name="pic_id" class="inp">${peopleOpts(t.pic_id || me.id, '— pilih —')}</select>`) +
    field('Reviewer (yang mengecek)', `<select name="reviewer_id" class="inp">${peopleOpts(t.reviewer_id || (t.id ? '' : (me.boss_id || '')), '— pilih —')}</select>`) +
    field('Tenggat', `<input type="date" name="due" class="inp" value="${esc(t.due || '')}">`) +
    field('Progres (%)', `<input type="number" name="progress" min="0" max="100" class="inp" value="${t.progress || 0}">`) + `</div>`,
    { danger: t.id && (isAdmin() || t.created_by === me.id) ? { label: 'Hapus', onClick: async () => { await db.remove('pk_tasks', 'id=eq.' + t.id); return 'del'; } } : null,
      onSubmit: async (f) => {
        need(f.title, 'Isi judul pekerjaan'); need(f.pic_id, 'Pilih PIC');
        if (f.reviewer_id && f.reviewer_id === f.pic_id) throw new Error('Reviewer tidak boleh sama dengan PIC');
        const row = { title: f.title.trim(), dod: f.dod.trim() || null, unit_code: f.unit_code, project_id: f.project_id || null, pic_id: f.pic_id, reviewer_id: f.reviewer_id || null, due: f.due || null, progress: Math.max(0, Math.min(100, +f.progress || 0)) };
        if (t.id) await db.update('pk_tasks', 'id=eq.' + t.id, row);
        else { const [n] = await db.insert('pk_tasks', { ...row, created_by: me.id }); await db.insert('pk_task_log', { task_id: n.id, actor_id: me.id, action: 'dibuat' }); }
      } });
}

// ================= Proyek & Tugas =================
async function board(el, params, reload) {
  const { tasks, projects, proj } = await load();
  const scope = params.get('u') || 'ALL'; const onlyMe = params.get('me') === '1'; const attention = params.get('a') === '1'; const showDone = params.get('done') === '1';
  const me = ctx.me.id; const sel = params.get('t');
  const biz = ctx.units.filter(u => u.kind !== 'lini');
  const flag = (t) => (t.status === 'revisi') || (t.due && daysTo(t.due) <= 2 && t.status !== 'done');
  let list = tasks.filter(t => (showDone || t.status !== 'done') && (scope === 'ALL' || bizOf(t.unit_code) === scope) && (!onlyMe || [t.pic_id, t.reviewer_id].includes(me)) && (!attention || flag(t)));
  const groups = biz.map(u => ({ u, rows: list.filter(t => bizOf(t.unit_code) === u.code) })).filter(g => g.rows.length);
  const q = (o) => { const p = new URLSearchParams({ u: scope, ...(onlyMe ? { me: 1 } : {}), ...(attention ? { a: 1 } : {}), ...(showDone ? { done: 1 } : {}), ...o }); [...p].forEach(([k, v]) => { if (v === '' || v === '0') p.delete(k); }); return '#/tugas?' + p; };
  const act = tasks.filter(t => t.status !== 'done');
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Siapa mengerjakan apa, sampai kapan · selesai hanya setelah disetujui reviewer</span><h1>Proyek & Tugas</h1></div>
    <div class="row gap"><button class="btn" data-a="proj">+ Proyek</button><button class="btn pri" data-a="new">+ Tugas baru</button></div></header>
  <div class="chips">${[['ALL', 'Semua']].concat(biz.map(u => [u.code, u.name])).map(([k, l]) => `<a class="chipbtn${scope === k ? ' on' : ''}" href="${q({ u: k })}">${k !== 'ALL' ? logo(k, 18) : ''}${esc(l)}</a>`).join('')}
    <span style="flex:1"></span><a class="chipbtn${onlyMe ? ' on' : ''}" href="${q({ me: onlyMe ? '' : 1 })}">Pekerjaan saya</a><a class="chipbtn${attention ? ' on' : ''}" href="${q({ a: attention ? '' : 1 })}">Perlu perhatian</a><a class="chipbtn${showDone ? ' on' : ''}" href="${q({ done: showDone ? '' : 1 })}">Tampilkan selesai</a></div>
  <div class="tiles"><div class="tile"><span>Tugas aktif</span><b>${act.length}</b></div><div class="tile"><span>Perlu revisi</span><b class="red">${act.filter(t => t.status === 'revisi').length}</b></div>
    <div class="tile"><span>Menunggu review</span><b>${act.filter(t => t.status === 'review').length}</b></div><div class="tile"><span>Lewat / ≤2 hari tenggat</span><b class="red">${act.filter(t => t.due && daysTo(t.due) <= 2).length}</b></div></div>
  ${groups.length ? groups.map(g => `<section class="grp"><div class="grp-h">${logo(g.u.code, 30)}<b>${esc(g.u.name)}</b><span class="muted">${g.rows.length} tugas</span></div>
    <div class="card pad0 scroll-x"><table class="tbl"><thead><tr><th>Tugas</th><th>PIC</th><th>Status</th><th>Tenggat</th><th>Progres</th></tr></thead><tbody>
    ${g.rows.map(t => { const d = daysTo(t.due); return `<tr class="click" data-t="${t.id}"><td><b>${esc(t.title)}</b>${t.project_id ? `<small class="muted"> · ${esc((proj[t.project_id] || {}).name || '')}</small>` : ''}${t.source === 'permintaan' ? ' ' + chip('Dari permintaan', 'blue') : ''}</td>
      <td><span class="row gap6">${avatar(t.pic_id, 26)}${esc(nick(t.pic_id))}</span></td><td>${stCell(t.status)}</td>
      <td class="${d !== null && d < 0 && t.status !== 'done' ? 'red' : ''}">${t.due ? fdate(t.due) : '—'}${d !== null && d < 0 && t.status !== 'done' ? '<small> · lewat ' + (-d) + ' hari</small>' : ''}</td>
      <td><span class="bar"><i style="width:${t.progress}%"></i></span> ${t.progress}%</td></tr>`; }).join('')}</tbody></table></div></section>`).join('')
    : `<div class="empty-state card"><h2>Belum ada tugas di sini</h2><p class="muted">Buat tugas baru, atau terima Permintaan Bantuan supaya otomatis jadi tugas.</p><button class="btn pri" data-a="new">+ Tugas baru</button></div>`}
  ${projects.length ? `<section class="card"><h2>Proyek</h2><div class="list">${projects.map(p => { const ts = tasks.filter(t => t.project_id === p.id); const dn = ts.filter(t => t.status === 'done').length;
    return `<div class="li row gap">${logo(p.unit_code, 22)}<b style="flex:1">${esc(p.name)}</b><span class="muted small">${dn}/${ts.length} selesai · ${p.due ? 'tenggat ' + fdate(p.due) : ''} · PJ ${esc(nick(p.owner_id))}</span>${p.is_closed ? chip('Ditutup') : ''}<button class="btn sm" data-pe="${p.id}">Ubah</button></div>`; }).join('')}</div></section>` : ''}`;

  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]');
    if (a && a.dataset.a === 'new') { if (await taskForm({}, projects)) { toast('Tugas dibuat'); reload(); } return; }
    if (a && a.dataset.a === 'proj') { if (await projForm()) reload(); return; }
    const pe = e.target.closest('[data-pe]'); if (pe) { if (await projForm(proj[pe.dataset.pe])) reload(); return; }
    const tr = e.target.closest('[data-t]'); if (tr) { const r = await detail(tasks.find(t => t.id === tr.dataset.t), projects); if (r) reload(); }
  };
  if (sel) { const t = tasks.find(x => x.id === sel); if (t) { const r = await detail(t, projects); history.replaceState(null, '', q({ t: '' })); if (r) reload(); } }
}

async function projForm(p = {}) {
  return modal(p.id ? 'Ubah proyek' : 'Proyek baru',
    field('Nama proyek', `<input name="name" class="inp" value="${esc(p.name || '')}">`) +
    `<div class="g2">` + field('Unit', `<select name="unit_code" class="inp">${unitOpts(p.unit_code || ctx.me.unit_code)}</select>`) +
    field('Penanggung jawab', `<select name="owner_id" class="inp">${peopleOpts(p.owner_id || ctx.me.id)}</select>`) +
    field('Tenggat', `<input type="date" name="due" class="inp" value="${esc(p.due || '')}">`) + `</div>` +
    (p.id ? `<label class="chk"><input type="checkbox" name="is_closed" ${p.is_closed ? 'checked' : ''}> Proyek sudah ditutup</label>` : ''),
    { onSubmit: async (f) => { need(f.name, 'Isi nama proyek'); const row = { name: f.name.trim(), unit_code: f.unit_code, owner_id: f.owner_id || null, due: f.due || null, is_closed: !!f.is_closed };
      if (p.id) await db.update('pk_projects', 'id=eq.' + p.id, row); else await db.insert('pk_projects', row); } });
}

async function detail(t, projects) {
  const me = ctx.me.id; const [log, points] = await Promise.all([db.get('pk_task_log', `select=*&task_id=eq.${t.id}&order=at.desc&limit=30`), db.get('pk_review_points', `select=*&task_id=eq.${t.id}&order=created_at`)]);
  const canEdit = isAdmin() || [t.pic_id, t.reviewer_id, t.created_by].includes(me);
  const isPic = t.pic_id === me;
  const body = `<div class="kv">
    <div><span>Unit</span><b>${logo(t.unit_code, 18)} ${esc(unitName(t.unit_code))}</b></div><div><span>Status</span>${stCell(t.status)}</div>
    <div><span>PIC</span><b>${avatar(t.pic_id, 22)} ${esc(nick(t.pic_id))}</b></div><div><span>Reviewer</span><b>${t.reviewer_id ? avatar(t.reviewer_id, 22) + ' ' + esc(nick(t.reviewer_id)) : '<span class="red">belum ada</span>'}</b></div>
    <div><span>Tenggat</span><b>${t.due ? fdate(t.due) : '—'}</b></div><div><span>Versi · putaran</span><b>v${t.version} · ${t.round}</b></div></div>
    ${t.dod ? `<p class="note"><b>Selesai bila:</b> ${esc(t.dod)}</p>` : ''}
    ${t.last_link ? `<p><a href="${esc(t.last_link)}" target="_blank" rel="noopener">Buka hasil terakhir ↗</a></p>` : ''}
    ${points.length ? `<h3>Poin review</h3><ul class="pts">${points.map(p => `<li>${chip({ open: 'Belum dijawab', fixed: 'Sudah diperbaiki', disagree: 'Tidak setuju', accepted: 'Diterima' }[p.status], { open: 'red', fixed: 'blue', disagree: 'yellow', accepted: 'green' }[p.status])} ${esc(p.text)}${p.answer ? `<small> ↳ ${esc(p.answer)}</small>` : ''}</li>`).join('')}</ul>` : ''}
    ${canEdit && !['review', 'done'].includes(t.status) ? `<div class="row gap wrap"><span class="muted small">Ubah status:</span>${['todo', 'doing', 'hold'].map(s => `<label class="chk"><input type="radio" name="st" value="${s}" ${t.status === s ? 'checked' : ''}> ${ST[s][0]}</label>`).join('')}</div>` : ''}
    ${isPic && ['todo', 'doing', 'revisi', 'hold'].includes(t.status) ? field('Ajukan ke reviewer · tautan hasil', `<input name="link" class="inp" placeholder="https://drive.google.com/…" value="${esc(t.last_link || '')}">`, 'Isi tautan lalu Simpan untuk mengajukan ke reviewer. Kalau ada poin revisi, jawab dulu di Review & Revisi.') : ''}
    <h3>Riwayat</h3><ul class="log">${log.map(l => `<li><b>${esc(nick(l.actor_id))}</b> ${esc(l.action)}${l.note ? ' · ' + esc(l.note) : ''} <small class="muted">${ftime(l.at)}</small></li>`).join('') || '<li class="muted">—</li>'}</ul>`;
  let mode = 'save';
  const res = await modal(t.title, body, {
    wide: true, submit: canEdit ? 'Simpan' : null,
    danger: canEdit ? { label: 'Ubah detail', onClick: async () => { mode = 'edit'; return 'edit'; } } : null,
    onSubmit: async (f) => {
      if (isPic && ['todo', 'doing', 'revisi', 'hold'].includes(t.status) && (f.link || '').trim()) {
        await db.rpc('pk_task_submit', { p_task: t.id, p_link: f.link.trim(), p_note: null }); toast('Diajukan ke ' + nick(t.reviewer_id)); return;
      }
      
      if (f.st && f.st !== t.status) { await db.update('pk_tasks', 'id=eq.' + t.id, { status: f.st }); await db.insert('pk_task_log', { task_id: t.id, actor_id: me, action: 'status → ' + ST[f.st][0] }); }
    } });
  if (res === 'edit') return taskForm(t, projects);
  return res;
}

// ================= Review & Revisi =================
async function review(el, params, reload) {
  const me = ctx.me.id; const tab = params.get('tab') || 'cek';
  const tasks = await db.get('pk_tasks', 'select=*&status=in.(review,revisi,done)&order=updated_at.desc&limit=500');
  const ids = tasks.map(t => t.id);
  const points = ids.length ? await db.get('pk_review_points', `select=*&task_id=in.(${ids.join(',')})&order=created_at`) : [];
  const P = (id) => points.filter(p => p.task_id === id);
  const sets = {
    cek: tasks.filter(t => t.reviewer_id === me && t.status === 'review'),
    saya: tasks.filter(t => t.pic_id === me && ['review', 'revisi'].includes(t.status)),
    semua: tasks.filter(t => t.status !== 'done'),
    selesai: tasks.filter(t => t.status === 'done').slice(0, 40),
  };
  const list = sets[tab] || [];
  const sel = params.get('t') ? tasks.find(t => t.id === params.get('t')) : list[0];
  const late = (t) => t.status === 'revisi' && t.revise_due && t.revise_due < today();
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Pekerjaan baru dianggap selesai setelah dicek dan disetujui reviewer</span><h1>Review & Revisi</h1></div></header>
  <ol class="steps"><li><b>1</b><span><strong>PIC mengajukan</strong><small>hasil + tautan</small></span></li><li><b>2</b><span><strong>Dicek reviewer</strong><small>kekurangan ditulis per poin</small></span></li><li><b>3</b><span><strong>PIC memperbaiki</strong><small>tiap poin dijawab, tenggat 2 hari kerja</small></span></li><li><b class="t">4</b><span><strong>Disetujui = selesai</strong><small>PIC tidak bisa menandai sendiri</small></span></li></ol>
  <div class="chips">${[['cek', 'Perlu saya cek', sets.cek.length], ['saya', 'Pekerjaan saya', sets.saya.length], ['semua', 'Semua yang berjalan', sets.semua.length], ['selesai', 'Baru selesai', null]].map(([k, l, n]) => `<a class="chipbtn${tab === k ? ' on' : ''}" href="#/review?tab=${k}">${l}${n !== null ? ` (${n})` : ''}</a>`).join('')}</div>
  <div class="split${params.get('t') ? ' picked' : ''}">
    <div class="stack">${list.map(t => `<a class="card item${sel && sel.id === t.id ? ' sel' : ''}${late(t) ? ' late' : ''}" href="#/review?tab=${tab}&t=${t.id}">
      <span class="row gap6 small b">${logo(t.unit_code, 18)}${esc(unitName(bizOf(t.unit_code)))}</span>
      <span class="row between"><b>${esc(t.title)}</b>${stCell(t.status)}</span>
      <span class="small muted">PIC ${avatar(t.pic_id, 18)} <b>${esc(nick(t.pic_id))}</b> · reviewer <b>${esc(nick(t.reviewer_id))}</b> · v${t.version} · putaran ${t.round}</span>
      ${t.status === 'revisi' ? `<span class="small ${late(t) ? 'red' : ''}">Tenggat revisi ${fdate(t.revise_due)} · ${P(t.id).filter(p => p.status === 'accepted').length}/${P(t.id).length} poin diterima</span>` : ''}</a>`).join('') || `<div class="card empty-state"><p class="muted">${{ cek: 'Tidak ada yang menunggu Anda cek.', saya: 'Tidak ada pekerjaan Anda yang sedang direview.', semua: 'Tidak ada review yang berjalan.', selesai: 'Belum ada.' }[tab]}</p></div>`}</div>
    <div>${sel ? `<a class="m-only back" href="#/review?tab=${tab}">‹ Kembali ke daftar</a>` + detailHtml(sel, P(sel.id)) : ''}</div>
  </div>`;

  el.onclick = async (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const t = sel; const act = b.dataset.r;
    try {
      if (act === 'approve') { if (!await confirmBox('Setujui "' + t.title + '" sebagai selesai?', 'Setujui')) return; await db.rpc('pk_task_review', { p_task: t.id, p_decision: 'approve' }); toast('Disetujui. Pekerjaan selesai.'); }
      else if (act === 'revise') {
        const r = await modal('Minta revisi', field('Poin yang harus diperbaiki (satu baris satu poin)', '<textarea name="pts" class="inp" rows="5" placeholder="Harga belum dibandingkan 2 vendor\nTambahkan foto lokasi"></textarea>', 'PIC wajib menjawab setiap poin. Tenggat revisi 2 hari kerja.'),
          { submit: 'Kirim revisi', onSubmit: async (f) => { await db.rpc('pk_task_review', { p_task: t.id, p_decision: 'revise', p_points: f.pts.split('\n').map(s => s.trim()).filter(Boolean) }); } });
        if (!r) return; toast('Revisi dikirim ke ' + nick(t.pic_id));
      }
      else if (act === 'acc' || act === 'reopen') { await db.rpc('pk_point_accept', { p_point: b.dataset.p, p_accept: act === 'acc' }); }
      else if (act === 'answer') {
        const r = await modal('Jawab poin revisi', `<p class="note">${esc(b.dataset.txt)}</p>` + field('Jawaban', `<select name="st" class="inp">${opts([['fixed', 'Sudah diperbaiki'], ['disagree', 'Tidak setuju']])}</select>`) + field('Bukti atau alasan', '<input name="ans" class="inp" placeholder="Tautan / halaman / versi, atau alasan">'),
          { onSubmit: async (f) => { await db.rpc('pk_point_answer', { p_point: b.dataset.p, p_status: f.st, p_answer: f.ans }); } });
        if (!r) return;
      }
      else if (act === 'resubmit') {
        const r = await modal('Ajukan ulang', field('Tautan hasil terbaru', `<input name="link" class="inp" value="${esc(t.last_link || '')}">`), { submit: 'Ajukan ulang', onSubmit: async (f) => { await db.rpc('pk_task_submit', { p_task: t.id, p_link: f.link, p_note: 'ajukan ulang' }); } });
        if (!r) return; toast('Diajukan ulang ke ' + nick(t.reviewer_id));
      }
      reload();
    } catch (er) { toast(er.message, 'err'); }
  };

  function detailHtml(t, pts) {
    const isRev = t.reviewer_id === me || isAdmin(); const isPic = t.pic_id === me;
    const open = pts.filter(p => p.status === 'open').length; const notAcc = pts.filter(p => p.status !== 'accepted').length;
    return `<section class="card sticky-top">
      <span class="row gap6 small b">${logo(t.unit_code, 22)}${esc(unitName(t.unit_code))}</span>
      <div class="row between"><h2>${esc(t.title)}</h2>${stCell(t.status)}</div>
      ${t.dod ? `<p class="muted">Selesai bila: ${esc(t.dod)}</p>` : ''}
      <div class="kv"><div><span>PIC</span><b>${avatar(t.pic_id, 22)} ${esc(nick(t.pic_id))}</b></div><div><span>Reviewer</span><b>${avatar(t.reviewer_id, 22)} ${esc(nick(t.reviewer_id))}</b></div><div><span>Versi · putaran</span><b>v${t.version} · ${t.round}</b></div><div><span>Tenggat</span><b>${t.status === 'revisi' ? 'revisi ' + fdate(t.revise_due) : fdate(t.due)}</b></div></div>
      ${t.last_link ? `<a class="btn" href="${esc(t.last_link)}" target="_blank" rel="noopener">Buka hasil ↗</a>` : ''}
      ${t.status === 'revisi' && t.revise_due && t.revise_due < today() ? '<p class="note err">Revisi lewat tenggat. Kepala Staf menindaklanjuti langsung dengan PIC.</p>' : ''}
      <h3>Poin review (${pts.length})</h3>
      ${pts.length ? `<ul class="pts">${pts.map(p => `<li><div class="row between gap"><span>${esc(p.text)}</span>${chip({ open: 'Belum dijawab', fixed: 'Sudah diperbaiki', disagree: 'Tidak setuju', accepted: 'Diterima' }[p.status], { open: 'red', fixed: 'blue', disagree: 'yellow', accepted: 'green' }[p.status])}</div>
        ${p.answer ? `<small class="muted">↳ ${esc(p.answer)}</small>` : ''}
        <div class="row gap">${isPic && t.status === 'revisi' && p.status === 'open' ? `<button class="btn sm" data-r="answer" data-p="${p.id}" data-txt="${esc(p.text)}">Jawab</button>` : ''}
        ${isRev && t.status === 'review' && ['fixed', 'disagree'].includes(p.status) ? `<button class="btn sm pri" data-r="acc" data-p="${p.id}">Terima</button><button class="btn sm" data-r="reopen" data-p="${p.id}">Masih kurang</button>` : ''}</div></li>`).join('')}</ul>` : '<p class="muted small">Belum ada poin.</p>'}
      <div class="row gap wrap">
        ${isRev && t.status === 'review' ? `<button class="btn pri" data-r="approve" ${notAcc ? 'disabled title="Terima semua poin dulu"' : ''}>Setujui · selesai</button><button class="btn" data-r="revise">Minta revisi</button>` : ''}
        ${isPic && t.status === 'revisi' ? `<button class="btn pri" data-r="resubmit" ${open ? 'disabled title="Jawab semua poin dulu"' : ''}>Ajukan ulang</button>` : ''}
      </div>
      ${isRev && t.status === 'review' && notAcc ? `<p class="small muted">${notAcc} poin belum diterima. Terima atau kembalikan setiap poin, baru bisa disetujui.</p>` : ''}
    </section>`;
  }
}

export default { board, review };

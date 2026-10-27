import { ctx, db, esc, today, addDays, fdate, ftime, avatar, nick, modal, field, opts, toast, unitName, peopleOpts, isAdmin, need, chip, logo } from '../core.js';

const TEAMS = ['Rentalaja', 'TripinAja', 'Niagaaja', 'Marketing', 'Keuangan', 'Purchasing & Aset', 'Kepala Staf', 'Data & BizDev'];
const ST = { baru: ['Menunggu dipilah', 'yellow'], ditunda: ['Ditunda', 'gray'], diterima: ['Diberikan ke PIC', 'blue'], ditolak: ['Ditolak', 'gray'], diperjelas: ['Perlu diperjelas', 'blue'], jadi_tugas: ['Jadi tugas', 'green'], selesai: ['Selesai', 'green'] };
const PR = { tinggi: ['Tinggi', 'red'], sedang: ['Sedang', 'yellow'], rendah: ['Rendah', 'gray'] };

export default async function permintaan(el, params, reload) {
  const me = ctx.me.id; const admin = isAdmin();
  const tab = params.get('tab') || (admin ? 'pilah' : 'untuk');
  const [rows, projects] = await Promise.all([db.get('pk_requests', 'select=*&order=created_at.desc&limit=500'), db.get('pk_projects', 'select=id,name&is_closed=eq.false')]);
  const sets = {
    pilah: rows.filter(r => ['baru', 'diperjelas'].includes(r.status)),
    untuk: rows.filter(r => r.pic_id === me && r.status === 'diterima'),
    saya: rows.filter(r => r.from_id === me),
    tunda: rows.filter(r => r.status === 'ditunda'),
    semua: rows,
  };
  const tabs = [admin && ['pilah', 'Perlu dipilah'], ['untuk', 'Untuk saya kerjakan'], ['saya', 'Saya ajukan'], ['tunda', 'Ditunda'], ['semua', 'Semua']].filter(Boolean);
  const list = sets[tab] || [];
  const sel = params.get('r') ? rows.find(r => r.id === params.get('r')) : list[0];
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Minta tolong unit lain. Butuh uang? Pakai <a href="#/belanja">Pengajuan Belanja</a>.</span><h1>Permintaan Bantuan</h1></div>
    <button class="btn pri" data-a="new">+ Ajukan permintaan</button></header>
  <div class="note"><b>Bedanya dengan Proyek & Tugas:</b> permintaan belum pasti dikerjakan. Kepala Staf memilah paling lambat 24 jam: diberikan ke PIC, ditunda, atau ditolak. Setelah PIC menerima, permintaan otomatis jadi tugas di Proyek & Tugas.</div>
  <div class="chips">${tabs.map(([k, l]) => `<a class="chipbtn${tab === k ? ' on' : ''}" href="#/permintaan?tab=${k}">${l} (${sets[k].length})</a>`).join('')}</div>
  <div class="split${params.get('r') ? ' picked' : ''}">
    <div class="stack">${list.map(r => `<a class="card item${sel && sel.id === r.id ? ' sel' : ''}" href="#/permintaan?tab=${tab}&r=${r.id}">
      <span class="row between small"><span class="row gap6">${avatar(r.from_id, 20)}<b>${esc(nick(r.from_id))}</b> → ${esc(r.to_team)}</span><span class="muted">${ftime(r.created_at)}</span></span>
      <b>${esc(r.title)}</b><span class="row gap6">${chip(ST[r.status][0], ST[r.status][1])}${chip(PR[r.priority][0], PR[r.priority][1])}${r.due ? `<span class="small muted">dibutuhkan ${fdate(r.due)}</span>` : ''}</span></a>`).join('') || '<div class="card empty-state"><p class="muted">Tidak ada permintaan di sini.</p></div>'}</div>
    <div>${sel ? `<a class="m-only back" href="#/permintaan?tab=${tab}">‹ Kembali ke daftar</a>` + detail(sel) : ''}</div>
  </div>`;

  function detail(r) {
    const canTriage = admin && ['baru', 'diperjelas', 'ditunda'].includes(r.status);
    const canAccept = (r.pic_id === me || admin) && r.status === 'diterima';
    return `<section class="card sticky-top">
      <span class="small muted">Dari ${esc(nick(r.from_id))} · ${esc(unitName(ctx.byId[r.from_id] && ctx.byId[r.from_id].unit_code))} → <b>${esc(r.to_team)}</b></span>
      <div class="row between"><h2>${esc(r.title)}</h2>${chip(ST[r.status][0], ST[r.status][1])}</div>
      <p>${esc(r.description || 'Tanpa keterangan.')}</p>
      ${r.file_link ? `<p><a href="${esc(r.file_link)}" target="_blank" rel="noopener">Buka file ↗</a></p>` : ''}
      <div class="kv"><div><span>Prioritas</span><b>${PR[r.priority][0]}</b></div><div><span>Dibutuhkan</span><b>${fdate(r.due)}</b></div>
        <div><span>Dikerjakan oleh</span><b>${r.pic_id ? avatar(r.pic_id, 20) + ' ' + esc(nick(r.pic_id)) : '—'}</b></div><div><span>Dipilah</span><b>${r.triage_by ? esc(nick(r.triage_by)) + ' · ' + ftime(r.triage_at) : 'belum'}</b></div></div>
      ${r.reason ? `<p class="note">${esc(r.reason)}</p>` : ''}
      ${r.task_id ? `<a class="btn" href="#/tugas?t=${r.task_id}">Lihat tugasnya →</a>` : ''}
      <div class="row gap wrap">
        ${canTriage ? `<button class="btn pri" data-a="give">Berikan ke PIC</button><button class="btn" data-a="tunda">Tunda</button><button class="btn" data-a="perjelas">Minta diperjelas</button><button class="btn danger" data-a="tolak">Tolak</button>` : ''}
        ${canAccept ? `<button class="btn pri" data-a="accept">Terima · jadikan tugas</button>` : ''}
        ${r.from_id === me && ['diperjelas'].includes(r.status) ? `<button class="btn" data-a="clarify">Perjelas & kirim ulang</button>` : ''}
      </div></section>`;
  }

  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return; const r = sel;
    try {
      let ok = null;
      if (a.dataset.a === 'new') ok = await form();
      else if (a.dataset.a === 'give') ok = await modal('Berikan ke PIC',
        field('Dikerjakan oleh', `<select name="pic" class="inp">${peopleOpts('', '— pilih —')}</select>`) +
        field('Bagian dari proyek', `<select name="proj" class="inp">${opts(projects.map(p => [p.id, p.name]), '', '— tanpa proyek —')}</select>`) +
        field('Catatan untuk PIC (opsional)', '<input name="why" class="inp">'),
        { submit: 'Berikan', onSubmit: async (f) => { need(f.pic, 'Pilih PIC'); await db.rpc('pk_request_triage', { p_id: r.id, p_action: 'terima', p_pic: f.pic, p_reason: f.why || null, p_project: f.proj || null }); } });
      else if (['tunda', 'tolak', 'perjelas'].includes(a.dataset.a)) ok = await modal({ tunda: 'Tunda permintaan', tolak: 'Tolak permintaan', perjelas: 'Minta diperjelas' }[a.dataset.a],
        field('Alasan untuk pengaju', '<textarea name="why" class="inp" rows="3"></textarea>'),
        { submit: 'Kirim', onSubmit: async (f) => { await db.rpc('pk_request_triage', { p_id: r.id, p_action: a.dataset.a, p_reason: f.why }); } });
      else if (a.dataset.a === 'accept') ok = await modal('Terima & jadikan tugas',
        field('Tenggat', `<input type="date" name="due" class="inp" value="${r.due || addDays(today(), 7)}">`) +
        field('Reviewer hasil', `<select name="rev" class="inp">${peopleOpts(r.from_id)}</select>`, 'Biasanya pengaju yang mengecek hasilnya.'),
        { submit: 'Jadikan tugas', onSubmit: async (f) => { await db.rpc('pk_request_to_task', { p_id: r.id, p_due: f.due || null, p_reviewer: f.rev || null }); } });
      else if (a.dataset.a === 'clarify') ok = await form(r);
      if (ok) { toast('Tersimpan'); reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };

  async function form(r = {}) {
    const guess = (t) => /mobil|hiace|motor|sewa|iphone|kamera|unit/i.test(t) ? 'Rentalaja' : /konten|foto|desain|promo|video|story/i.test(t) ? 'Marketing' : /laporan|data|omzet/i.test(t) ? 'Data & BizDev' : /trip|wisata|paket/i.test(t) ? 'TripinAja' : /stok|laptop/i.test(t) ? 'Niagaaja' : /aset|beli|barang/i.test(t) ? 'Purchasing & Aset' : '';
    return modal(r.id ? 'Perjelas permintaan' : 'Ajukan permintaan bantuan',
      field('Apa yang diminta', `<input name="title" class="inp" id="rq-t" value="${esc(r.title || '')}" placeholder="Misalnya: Hiace untuk rombongan 14 orang">`) +
      `<div class="g2">` + field('Ditujukan ke', `<select name="to" class="inp" id="rq-to">${opts(TEAMS.map(t => [t, t]), r.to_team || '', '— pilih —')}</select>`, 'AI menebak dari judul; boleh diganti.') +
      field('Prioritas', `<select name="pr" class="inp">${opts(Object.entries(PR).map(([k, v]) => [k, v[0]]), r.priority || 'sedang')}</select>`) +
      field('Dibutuhkan tanggal', `<input type="date" name="due" class="inp" value="${esc(r.due || addDays(today(), 7))}">`) +
      field('Tautan file (opsional)', `<input name="link" class="inp" value="${esc(r.file_link || '')}">`) + `</div>` +
      field('Kenapa perlu', `<textarea name="desc" class="inp" rows="3">${esc(r.description || '')}</textarea>`),
      { submit: r.id ? 'Kirim ulang' : 'Kirim permintaan', onSubmit: async (f) => {
        need(f.title, 'Isi apa yang diminta'); need(f.to, 'Pilih tujuan');
        const row = { title: f.title.trim(), to_team: f.to, priority: f.pr, due: f.due || null, file_link: f.link.trim() || null, description: f.desc.trim() || null };
        if (r.id) await db.update('pk_requests', 'id=eq.' + r.id, { ...row, status: 'baru', reason: null });
        else await db.insert('pk_requests', { ...row, from_id: me, status: 'baru' });
      } }).then(v => v);
  }
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'rq-t') return; const to = document.getElementById('rq-to'); if (!to || to.dataset.touched) return;
  const t = e.target.value; const g = /mobil|hiace|motor|sewa|iphone|kamera|unit/i.test(t) ? 'Rentalaja' : /konten|foto|desain|promo|video|story/i.test(t) ? 'Marketing' : /laporan|data|omzet/i.test(t) ? 'Data & BizDev' : /trip|wisata|paket/i.test(t) ? 'TripinAja' : /stok|laptop/i.test(t) ? 'Niagaaja' : /aset|barang/i.test(t) ? 'Purchasing & Aset' : '';
  if (g) to.value = g;
});
document.addEventListener('change', (e) => { if (e.target.id === 'rq-to') e.target.dataset.touched = '1'; });

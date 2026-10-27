import { safeUrl, ctx, db, esc, ftime, avatar, nick, modal, field, opts, toast, unitName, unitOpts, isAdmin, isFin, need, chip, logo, ROLE, changePassword, rp, num } from '../core.js';

const CAT = [['strategi', 'Strategi & rencana'], ['proposal', 'Proposal & penawaran'], ['sop', 'SOP & aturan'], ['laporan', 'Laporan'], ['desain', 'Desain & brand'], ['kontrak', 'Kontrak & legal'], ['lainnya', 'Lainnya']];
const KINDS = ['Dokumen', 'Deck', 'Sheet', 'Desain', 'PDF', 'Folder'];

// ================= Library =================
async function library(el, params, reload) {
  const me = ctx.me.id; const q = (params.get('q') || '').toLowerCase(); const cat = params.get('c') || 'ALL'; const st = params.get('s') || 'ALL';
  const docs = await db.get('pk_documents', 'select=*&order=updated_at.desc');
  const list = docs.filter(d => (cat === 'ALL' || d.category === cat) && (st === 'ALL' || d.status === st) && (!q || (d.title + ' ' + unitName(d.unit_code)).toLowerCase().includes(q)));
  const link = (o) => '#/library?' + new URLSearchParams({ q, c: cat, s: st, ...o });
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Semua deck, proposal, SOP, laporan, dan draf di satu tempat · pengelola utama Kepala Staf</span><h1>Library Dokumen</h1></div>
    <button class="btn pri" data-a="new">+ Tambah dokumen</button></header>
  <div class="row gap wrap"><input class="inp grow" id="q" placeholder="Cari judul atau unit…" value="${esc(q)}">
    <select class="inp" id="c">${opts([['ALL', 'Semua kategori']].concat(CAT), cat)}</select><select class="inp" id="s">${opts([['ALL', 'Semua status'], ['Final', 'Final'], ['Draf', 'Draf'], ['Template', 'Template'], ['Arsip', 'Arsip']], st)}</select></div>
  <section class="card pad0 scroll-x"><table class="tbl"><thead><tr><th>Dokumen</th><th>Kategori</th><th>Unit</th><th>Status</th><th>Pemilik</th><th>Diperbarui</th><th></th></tr></thead><tbody>
  ${list.map(d => `<tr><td><b>${d.url ? `<a href="${safeUrl(d.url)}" target="_blank" rel="noopener">${esc(d.title)} ↗</a>` : esc(d.title)}</b> <small class="muted">${esc(d.kind)}</small>${d.restricted ? ' ' + chip('Terbatas', 'red') : ''}</td>
    <td>${esc((CAT.find(c => c[0] === d.category) || [0, d.category])[1])}</td><td><span class="row gap6">${logo(d.unit_code, 18)}${esc(unitName(d.unit_code))}</span></td>
    <td>${chip(d.status, { Final: 'green', Draf: 'yellow', Template: 'blue', Arsip: 'gray' }[d.status])}</td><td>${esc(nick(d.owner_id))}</td><td class="small muted">${ftime(d.updated_at)}</td>
    <td>${isAdmin() || d.owner_id === me ? `<button class="btn sm" data-e="${d.id}">Ubah</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7" class="muted">Belum ada dokumen. Tambahkan tautan Google Drive, Canva, atau Docs.</td></tr>`}</tbody></table></section>`;
  const go = () => { location.hash = link({ q: el.querySelector('#q').value, c: el.querySelector('#c').value, s: el.querySelector('#s').value }); };
  el.querySelector('#c').onchange = go; el.querySelector('#s').onchange = go; el.querySelector('#q').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]'), ed = e.target.closest('[data-e]'); if (!a && !ed) return;
    const d = ed ? docs.find(x => x.id === ed.dataset.e) : {};
    const r = await modal(d.id ? 'Ubah dokumen' : 'Tambah dokumen',
      field('Judul', `<input name="title" class="inp" value="${esc(d.title || '')}">`) + field('Tautan (Drive, Canva, Docs…)', `<input name="url" class="inp" value="${esc(d.url || '')}" placeholder="https://">`) +
      `<div class="g2">` + field('Kategori', `<select name="category" class="inp">${opts(CAT, d.category || 'lainnya')}</select>`) + field('Jenis', `<select name="kind" class="inp">${opts(KINDS.map(k => [k, k]), d.kind || 'Dokumen')}</select>`) +
      field('Unit', `<select name="unit_code" class="inp">${unitOpts(d.unit_code || ctx.me.unit_code)}</select>`) + field('Status', `<select name="status" class="inp">${opts([['Draf', 'Draf'], ['Final', 'Final'], ['Template', 'Template'], ['Arsip', 'Arsip']], d.status || 'Draf')}</select>`) + `</div>` +
      `<label class="chk"><input type="checkbox" name="restricted" ${d.restricted ? 'checked' : ''}> Terbatas (hanya CEO, Keuangan, dan pemilik)</label>`,
      { danger: d.id ? { label: 'Hapus', onClick: async () => { await db.remove('pk_documents', 'id=eq.' + d.id); return 'del'; } } : null,
        onSubmit: async (f) => { need(f.title, 'Isi judul'); if (f.url.trim() && !/^https?:\/\//i.test(f.url.trim())) throw new Error('Tautan harus diawali https://'); const row = { title: f.title.trim(), url: f.url.trim() || null, category: f.category, kind: f.kind, unit_code: f.unit_code, status: f.status, restricted: !!f.restricted, updated_at: new Date().toISOString() };
          if (d.id) await db.update('pk_documents', 'id=eq.' + d.id, row); else await db.insert('pk_documents', { ...row, owner_id: me }); } });
    if (r) { toast('Tersimpan'); reload(); }
  };
}

// ================= Pengaturan =================
const GROUPS = [
  ['Pengajuan Belanja', ['rab_limit_atasan', 'rab_limit_kepala_staf', 'lpj_days', 'cair_days', 'cair_time']],
  ['KKH', ['kkh_start', 'kkh_end', 'kkh_validate_by']],
  ['Kehadiran', ['leave_days_per_week', 'leave_pick_deadline']],
  ['Review', ['review_revise_days']],
  ['Performa & Liga', ['weights', 'incentive_pct', 'liga_weights']],
];
async function pengaturan(el, params, reload) {
  const me = ctx.byId[ctx.me.id]; const admin = isAdmin();
  const show = (v) => typeof v === 'object' ? (Array.isArray(v) ? v.join(', ') : Object.entries(v).map(([k, x]) => k + ' ' + x).join(' · ')) : (typeof v === 'number' && v >= 100000 ? rp(v) : String(v));
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Akun Anda dan aturan sistem</span><h1>Pengaturan</h1></div></header>
  <section class="card"><h2>Akun saya</h2><div class="row gap">${avatar(me.id, 56)}<div><b>${esc(me.name)}</b><p class="muted">${esc(me.title || ROLE[me.role])} · ${esc(unitName(me.unit_code))}</p></div></div>
    <div class="kv"><div><span>Email login</span><b>${esc(me.email || '—')}</b></div><div><span>WhatsApp</span><b>${me.phone ? '+' + esc(me.phone) : '—'}</b></div><div><span>Atasan</span><b>${esc(nick(me.boss_id))}</b></div><div><span>Valuer</span><b>${esc(nick(me.valuer1_id))}${me.valuer2_id ? ' · ' + esc(nick(me.valuer2_id)) : ''}</b></div></div>
    <button class="btn" data-a="pw">Ganti password</button></section>
  ${GROUPS.map(([g, keys]) => `<section class="card"><h2>${g}</h2><div class="list">${keys.filter(k => k in ctx.settings).map(k => `<div class="li row gap"><span style="flex:1"><b>${esc(ctx.notes[k] || k)}</b></span><span class="b">${esc(show(ctx.settings[k]))}</span>${admin ? `<button class="btn sm" data-k="${k}">Ubah</button>` : ''}</div>`).join('')}</div></section>`).join('')}
  ${!admin ? '<p class="muted small">Aturan diubah oleh Kepala Staf atau CEO.</p>' : ''}`;
  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]'); const k = e.target.closest('[data-k]');
    try {
      if (a) { const r = await modal('Ganti password', field('Password baru (min. 8 karakter)', '<input type="password" name="p1" class="inp" autocomplete="new-password">') + field('Ulangi', '<input type="password" name="p2" class="inp" autocomplete="new-password">'),
        { onSubmit: async (f) => { if ((f.p1 || '').length < 8) throw new Error('Minimal 8 karakter'); if (f.p1 !== f.p2) throw new Error('Password tidak sama'); await changePassword(f.p1); } });
        if (r) toast('Password diganti'); }
      if (k) { const key = k.dataset.k; const v = ctx.settings[key];
        const r = await modal('Ubah · ' + (ctx.notes[key] || key), field('Nilai', `<input name="v" class="inp" value="${esc(typeof v === 'object' ? JSON.stringify(v) : v)}">`, typeof v === 'object' ? 'Format JSON, contoh: ["Selasa","Jumat"]' : ''),
          { onSubmit: async (f) => { let val = f.v.trim(); if (typeof v === 'number') val = num(val); else if (typeof v === 'object') { try { val = JSON.parse(val); } catch (er) { throw new Error('Format tidak valid'); } }
            await db.update('pk_settings', 'key=eq.' + key, { value: val, updated_at: new Date().toISOString() }); ctx.settings[key] = val; } });
        if (r) { toast('Tersimpan'); reload(); } }
    } catch (er) { toast(er.message, 'err'); }
  };
}

export default { library, pengaturan };

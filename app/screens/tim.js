import { ctx, db, esc, today, fmonth, monthStart, avatar, nick, modal, field, opts, toast, active, unitName, unitOpts, peopleOpts, isAdmin, isFin, need, chip, logo, ROLE, rp, num, callFn, bizOf } from '../core.js';
import { detail, calc, cat as perfCat } from './performa.js';

// ================= Tim & Peran =================
async function tim(el, params, reload) {
  const admin = isAdmin(); const showOff = params.get('off') === '1';
  const ppl = ctx.people.filter(p => showOff || p.is_active);
  const groups = ctx.units.filter(u => u.kind !== 'lini').map(u => ({ u, rows: ppl.filter(p => bizOf(p.unit_code) === u.code) })).filter(g => g.rows.length);
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Siapa di unit mana, perannya apa, atasannya siapa, dan sudah punya akun atau belum</span><h1>Tim & Peran</h1></div>
    ${admin ? '<div class="row gap"><button class="btn" data-a="units">Kelola unit</button><button class="btn" data-a="unit">+ Lini / unit</button><button class="btn pri" data-a="add">+ Tambah orang</button></div>' : ''}</header>
  <div class="tiles"><div class="tile"><span>Orang aktif</span><b>${active().length}</b></div><div class="tile"><span>Sudah pernah masuk</span><b>${active().filter(p => p.user_id).length} / ${active().length}</b><small>${active().filter(p => !p.email).length} orang belum ada email</small></div>
    <div class="tile"><span>Unit & lini</span><b>${ctx.units.filter(u => u.is_active).length}</b></div><div class="tile"><span>Leader</span><b>${active().filter(p => p.role === 'leader').length}</b></div></div>
  ${groups.map(g => `<section class="grp"><div class="grp-h">${logo(g.u.code, 30)}<b>${esc(g.u.name)}</b><span class="muted">${g.rows.length} orang</span></div>
    <div class="pgrid">${g.rows.map(p => `<button type="button" class="card person${p.is_active ? '' : ' off'}" data-p="${p.id}">${avatar(p.id, 52)}<span><b>${esc(p.nickname || p.name)}</b><small>${esc(p.title || ROLE[p.role])}</small>
      <small class="muted">${esc(unitName(p.unit_code))} · atasan ${esc(nick(p.boss_id))}</small>
      <span class="row gap6">${chip(ROLE[p.role], p.role === 'leader' ? 'green' : ['ceo', 'kepala_staf', 'keuangan'].includes(p.role) ? 'blue' : 'gray')}${p.user_id ? chip('Sudah pernah masuk', 'green') : p.email ? chip('Bisa masuk via Google', 'blue') : chip('Belum ada email', 'red')}</span></span></button>`).join('')}</div></section>`).join('')}
  ${admin ? `<p><a href="#/tim?off=${showOff ? 0 : 1}" class="small">${showOff ? 'Sembunyikan' : 'Tampilkan'} orang nonaktif</a></p>` : ''}`;

  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]'); const pb = e.target.closest('[data-p]');
    try {
      if (a && a.dataset.a === 'add') { if (await personForm()) reload(); }
      else if (a && a.dataset.a === 'unit') { if (await unitForm()) reload(); }
      else if (a && a.dataset.a === 'units') { if (await unitsForm()) reload(); }
      else if (pb) { const p = ctx.byId[pb.dataset.p]; if (admin) { const r = await personForm(p); if (r) reload(); } else await view(p); }
    } catch (er) { toast(er.message, 'err'); }
  };

  async function view(p) {
    await modal(p.name, `<div class="row gap">${avatar(p.id, 64)}<div><b>${esc(p.title || ROLE[p.role])}</b><p class="muted">${esc(unitName(p.unit_code))}</p></div></div>
      <div class="kv"><div><span>Atasan langsung</span><b>${esc(nick(p.boss_id))}</b></div><div><span>Valuer KKH</span><b>${esc(nick(p.valuer1_id))}${p.valuer2_id ? ' · ' + esc(nick(p.valuer2_id)) : ''}</b></div>
      <div><span>Email</span><b>${esc(p.email || '—')}</b></div><div><span>WhatsApp</span><b>${p.phone ? '+' + esc(p.phone) : '—'}</b></div></div>`, { submit: null });
  }
}

async function personForm(p = null) {
  const isNew = !p; p = p || { role: 'staf', is_active: true, unit_code: 'HQ', leave_quota: 12 };
  const res = await modal(isNew ? 'Tambah orang management' : 'Ubah · ' + (p.nickname || p.name),
    `<div class="g2">` + field('Nama lengkap', `<input name="name" class="inp" value="${esc(p.name || '')}">`) + field('Nama panggilan', `<input name="nickname" class="inp" value="${esc(p.nickname || '')}">`) +
    field('Kode / inisial', `<input name="code" class="inp" maxlength="4" value="${esc(p.code || '')}" ${isNew ? '' : 'readonly'}>`) +
    field('Peran sistem', `<select name="role" class="inp">${opts(Object.entries(ROLE), p.role)}</select>`) +
    field('Jabatan / fungsi', `<input name="title" class="inp" value="${esc(p.title || '')}">`) + field('Unit', `<select name="unit_code" class="inp">${unitOpts(p.unit_code)}</select>`) +
    field('Atasan langsung', `<select name="boss_id" class="inp">${peopleOpts(p.boss_id, '— tidak ada —', x => x.id !== p.id)}</select>`) +
    field('Valuer 2', `<select name="valuer2_id" class="inp">${peopleOpts(p.valuer2_id, '— otomatis Kepala Staf —', x => x.id !== p.id)}</select>`) +
    field('Email (untuk login)', `<input name="email" type="email" class="inp" value="${esc(p.email || '')}">`) + field('WhatsApp', `<input name="phone" class="inp" value="${esc(p.phone || '')}" placeholder="62812…">`) +
    field('Mulai bekerja', `<input type="date" name="joined_on" class="inp" value="${esc(p.joined_on || '')}">`) + field('Jatah cuti / tahun', `<input type="number" name="leave_quota" class="inp" value="${p.leave_quota ?? 12}">`) +
    field('Foto (tautan gambar, opsional)', `<input name="photo" class="inp" value="${esc(p.photo || '')}">`) + `</div>` +
    (isNew ? '' : `<label class="chk"><input type="checkbox" name="is_active" ${p.is_active ? 'checked' : ''}> Aktif</label>`) +
    (isNew ? '' : `<div class="note"><b>Akun login:</b> ${p.user_id ? 'sudah tersambung' : p.email ? 'email terdaftar' : 'belum ada'}. <button type="button" class="btn sm" id="mkacc">${p.user_id ? 'Buat password baru' : 'Buat akun'}</button><span id="accout"></span></div>`),
    { wide: true, onSubmit: async (f) => {
      need(f.name, 'Isi nama'); need(f.code, 'Isi kode/inisial');
      const ks = ctx.people.find(x => x.role === 'kepala_staf');
      const row = { name: f.name.trim(), nickname: f.nickname.trim() || null, code: f.code.trim().toUpperCase(), role: f.role, title: f.title.trim() || null, unit_code: f.unit_code,
        boss_id: f.boss_id || null, valuer1_id: f.boss_id || null, valuer2_id: f.valuer2_id || (ks && ks.id !== f.boss_id && ks.id !== p.id ? ks.id : null),
        email: f.email.trim().toLowerCase() || null, phone: f.phone.replace(/\D/g, '').replace(/^0/, '62') || null, joined_on: f.joined_on || null, leave_quota: f.leave_quota === '' ? 12 : Math.max(0, +f.leave_quota || 0), photo: f.photo.trim() || null };
      if (isNew) await db.insert('pk_people', row); else await db.update('pk_people', 'id=eq.' + p.id, { ...row, is_active: !!f.is_active });
      const { loadContext } = await import('../core.js'); await loadContext();
    } });
  return res;
}
document.addEventListener('click', async (e) => {
  if (e.target.id !== 'mkacc') return; const form = e.target.closest('form'); const out = form.querySelector('#accout');
  const name = form.querySelector('[name=code]').value; const p = ctx.people.find(x => x.code === name); const email = form.querySelector('[name=email]').value.trim();
  if (!email) { out.textContent = ' Isi email dulu.'; return; }
  e.target.disabled = true; out.textContent = ' Membuat…';
  try { const r = await callFn('pk-account', { action: p.user_id ? 'reset' : 'create', person_id: p.id, email });
    out.innerHTML = `<br>Kirim ke ${esc(r.name)} lewat WhatsApp:<br><code class="copy">Email: ${esc(r.email)}<br>Password: ${esc(r.password)}<br>Masuk di https://pokama.org</code><br><small>Minta ganti password setelah masuk (menu Pengaturan).</small>`;
  } catch (er) { out.textContent = ' ' + er.message; }
  e.target.disabled = false;
});

async function unitsForm() {
  const us = (ctx.allUnits || ctx.units).filter(u => u.code !== 'HQ');
  return modal('Kelola unit & lini', `<p class="muted small">Hilangkan centang untuk menonaktifkan unit atau lini yang sudah tidak dipakai. Datanya tetap tersimpan, hanya tidak muncul lagi di pilihan.</p>
    <div class="list">${us.map(u => `<label class="li row gap chk">${u.kind !== 'lini' ? logo(u.code, 20) : '<span style="width:20px"></span>'}<span style="flex:1"><b>${esc(u.name)}</b> <small class="muted">${u.code}${u.kind === 'lini' ? ' · lini ' + esc(unitName(u.parent)) : ' · unit bisnis'}</small></span><input type="checkbox" name="u_${u.code}" ${u.is_active !== false ? 'checked' : ''}> Aktif</label>`).join('')}</div>`,
    { onSubmit: async (f) => {
      for (const u of us) { const on = !!f['u_' + u.code]; if (on !== (u.is_active !== false)) await db.update('pk_units', 'code=eq.' + u.code, { is_active: on }); }
      const { loadContext } = await import('../core.js'); await loadContext(); } });
}

async function unitForm() {
  return modal('Tambah lini / unit', `<div class="g2">` + field('Kode (2–3 huruf)', '<input name="code" class="inp" maxlength="3">') + field('Nama', '<input name="name" class="inp">') +
    field('Jenis', `<select name="kind" class="inp">${opts([['lini', 'Lini (cabang/produk)'], ['bisnis', 'Unit bisnis']], 'lini')}</select>`) +
    field('Bagian dari', `<select name="parent" class="inp">${unitOpts('RA', '— tidak ada —', ['bisnis'])}</select>`) + `</div>`,
    { onSubmit: async (f) => { need(f.code, 'Isi kode'); need(f.name, 'Isi nama');
      await db.insert('pk_units', { code: f.code.toUpperCase(), name: f.name, kind: f.kind, parent: f.kind === 'lini' ? f.parent || null : null, sort: 50 });
      const { loadContext } = await import('../core.js'); await loadContext(); } });
}

// ================= Performa =================
async function performa(el, params, reload) {
  if (params.get('p')) return detail(el, params, reload, params.get('p'));
  const me = ctx.me.id; const m = params.get('m') || monthStart(today());
  const onlySelf = !(isFin() || isAdmin()) && !active().some(p => p.boss_id === me || p.valuer1_id === me || p.valuer2_id === me);
  if (onlySelf) return detail(el, params, reload, me); const end = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
  const [outputs, perf, kkh, att, pnotes] = await Promise.all([
    db.get('pk_outputs', `select=*&month=eq.${m}&order=created_at`),
    db.get('pk_perf', `select=*&month=eq.${m}`),
    db.get('pk_kkh', `select=person_id,day,status&day=gte.${m}&day=lte.${end}&limit=20000`),
    db.get('pk_attendance', `select=person_id,day,late_min&day=gte.${m}&day=lte.${end}`),
    db.get('pk_perf_notes', `select=person_id,valuer_id,score&month=eq.${m}`),
  ]);
  const W = ctx.settings.weights || { output: 60, kkh: 25, valuer: 15 };
  const visible = active().filter(p => p.role !== 'ceo' && (isFin() || isAdmin() || p.id === me || p.boss_id === me || p.valuer1_id === me));
  const rows = visible.map(p => {
    const os = outputs.filter(o => o.person_id === p.id);
    const pf = perf.find(x => x.person_id === p.id) || {};
    const cc = calc(os, kkh.filter(x => x.person_id === p.id), pf, pnotes.filter(n => n.person_id === p.id), att.filter(x => x.person_id === p.id));
    const { cap, disc, score, fac } = cc; const valShow = cc.vs ? cc.vs.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : null;
    return { p, os, cap, disc, val: pf.valuer_score, valShow, score, fac, pf };
  });
  const cat = perfCat;
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">${fmonth(m)} · ${isFin() || isAdmin() ? 'performa seluruh tim' : 'Anda melihat performa sendiri dan tim langsung'}</span><h1>Performa</h1></div>
    <input type="month" class="inp" id="mpick" value="${m.slice(0, 7)}"></header>
  <div class="note">Skor = ${W.output}% capaian output + ${W.kkh}% disiplin KKH + ${W.valuer}% nilai valuer.</div>
  ${isFin() || isAdmin() ? `<div class="tiles"><div class="tile"><span>Orang dinilai</span><b>${rows.length}</b></div><div class="tile"><span>Sudah dinilai valuer</span><b>${rows.filter(r => r.valShow).length} / ${rows.length}</b></div>
    <div class="tile"><span>Output disepakati</span><b>${rows.filter(r => r.os.length).length} orang</b></div><div class="tile"><span>Disetujui CEO</span><b>${perf.filter(x => x.approved_at).length}</b></div></div>` : ''}
  <section class="card pad0 scroll-x"><table class="tbl"><thead><tr><th>Orang</th><th>Output disepakati</th><th class="r">Capaian</th><th class="r">Disiplin KKH</th><th class="r">Valuer</th><th class="r">Skor</th><th></th></tr></thead><tbody>
  ${rows.map(r => `<tr><td><span class="row gap6">${avatar(r.p.id, 28)}<span><a class="b" href="#/performa?p=${r.p.id}&m=${m}">${esc(r.p.nickname || r.p.name)}</a><br><small class="muted">${esc(r.p.title || ROLE[r.p.role])}</small></span></span></td>
    <td>${r.os.map(o => `<div class="small">${esc(o.name)} <span class="muted">(${o.weight}%) ${(+o.actual).toLocaleString('id-ID')}/${(+o.target).toLocaleString('id-ID')}</span></div>`).join('') || '<span class="muted small">belum disepakati</span>'}</td>
    <td class="r">${r.cap === null ? '—' : Math.round(r.cap * 100) + '%'}</td><td class="r ${r.disc !== null && r.disc < .8 ? 'red' : ''}">${r.disc === null ? '—' : Math.round(r.disc * 100) + '%'}</td><td class="r">${r.valShow || '—'}</td>
    <td class="r">${r.score ?? '—'} ${r.score !== null ? chip(cat(r.score)[0], cat(r.score)[1]) : ''}</td>
    <td>${(isFin() || isAdmin() || r.p.boss_id === me || r.p.valuer1_id === me) ? `<button class="btn sm" data-p="${r.p.id}">Atur</button>` : ''}</td></tr>`).join('')}</tbody></table></section>`;
  el.querySelector('#mpick').onchange = (e) => { location.hash = '#/performa?m=' + e.target.value + '-01'; };
  if (params.get('edit')) setTimeout(() => { history.replaceState(null, '', '#/performa?m=' + m); const b = el.querySelector(`[data-p="${params.get('edit')}"]`); if (b) b.click(); }, 0);
  el.onclick = async (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return; const r = rows.find(x => x.p.id === b.dataset.p);
    const lines = r.os.map(o => `${o.name}; ${o.weight}; ${+o.target}; ${+o.actual}; ${o.source || ''}`).join('\n');
    const res = await modal('Performa · ' + (r.p.nickname || r.p.name) + ' · ' + fmonth(m),
      field('Output disepakati · satu baris: nama; bobot %; target; realisasi; sumber', `<textarea name="out" class="inp mono" rows="5" placeholder="Trip terjual; 50; 8; 7; Unit Bisnis\nLaporan omzet tepat waktu (hari); 50; 26; 25; KKH">${esc(lines)}</textarea>`, 'Total bobot sebaiknya 100%. Disusun Leader bersama orangnya, disahkan CEO setiap tanggal 1.') +
      field('Nilai valuer (1–5)', `<select name="val" class="inp">${opts([['', '— belum —'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], r.val || '')}</select>`) +
      (ctx.me.role === 'ceo' ? `<label class="chk"><input type="checkbox" name="appr" ${r.pf.approved_at ? 'checked' : ''}> Disetujui CEO</label>` : ''),
      { wide: true, onSubmit: async (f) => {
        const parsed = f.out.split('\n').map(l => l.split(';').map(s => s.trim())).filter(x => x[0]);
        for (const x of parsed) if (!(+x[1] > 0) || !(+x[2] > 0)) throw new Error('Baris "' + x[0] + '": bobot dan target harus angka');
        for (const o of r.os) await db.remove('pk_outputs', 'id=eq.' + o.id);
        if (parsed.length) await db.insert('pk_outputs', parsed.map(x => ({ person_id: r.p.id, month: m, name: x[0], weight: +x[1], target: +x[2], actual: +(x[3] || 0), source: x[4] || null, created_by: me })));
        const pf = { person_id: r.p.id, month: m, valuer_score: f.val ? +f.val : null };
        if (ctx.me.role === 'ceo') { pf.approved_by = f.appr ? me : null; pf.approved_at = f.appr ? (r.pf.approved_at || new Date().toISOString()) : null; }
        await db.upsert('pk_perf', pf, 'person_id,month');
      } });
    if (res) { toast('Tersimpan'); reload(); }
  };
}

export default { tim, performa };

import { ctx, db, esc, today, addDays, fdate, avatar, nick, modal, field, opts, toast, active, unitName, isAdmin, logo, ROLE, waReport } from '../core.js';

const CODES = [['SW', 'SW · kerja sendiri'], ['CW', 'CW · kerja bersama tim'], ['CP/SR', 'CP/SR · checkpoint / review dengan atasan'], ['IN/EX', 'IN/EX · acara internal / eksternal'], ['IZIN', 'Izin / cuti']];
const MODES = [['kantor', 'Di kantor / cabang'], ['wfh', 'WFH'], ['wfe', 'WFE (dekat rumah)'], ['izin', 'Izin / cuti']];
const MODE_BG = { kantor: '#DDF5F2', wfh: '#E5EEF9', wfe: '#FDF3D7', izin: '#FCEBDD' };
const hours = () => { const a = +ctx.settings.kkh_start || 8, b = +ctx.settings.kkh_end || 17; const h = []; for (let i = a; i <= b; i++) h.push(i); return h; };
const hh = (h) => String(h).padStart(2, '0') + '.00';

async function dayLeave(day, ids) {
  const rows = await db.get('pk_leave', `select=person_id,kind,day,end_day,status&status=eq.disetujui&day=lte.${day}&or=(end_day.gte.${day},and(end_day.is.null,day.eq.${day}))`);
  const m = {}; rows.forEach(r => { if (!ids || ids.includes(r.person_id)) m[r.person_id] = r.kind; }); return m;
}

// ================= KKH Saya =================
async function saya(el, params, reload) {
  const me = ctx.me.id; const day = params.get('d') || today();
  const [rows, tasks, toVal, leave] = await Promise.all([
    db.get('pk_kkh', `select=*&person_id=eq.${me}&day=eq.${day}`),
    db.get('pk_tasks', `select=id,title,status&pic_id=eq.${me}&status=in.(todo,doing,revisi,review)&order=due.asc.nullslast`),
    db.get('pk_kkh', `select=id,person_id,day,hour,code,note,mode,status,task_id&status=eq.siap&order=day.desc,hour.asc&limit=200`),
    dayLeave(day, [me]),
  ]);
  // tag tim: siapa yang saya tag di slot saya, dan dari siapa slot hasil tag
  const ownIds = rows.filter(r => !r.tag_of).map(r => r.id); const fromIds = [...new Set(rows.filter(r => r.tag_of).map(r => r.tag_of))];
  const [copies, origins] = await Promise.all([
    ownIds.length ? db.get('pk_kkh', `select=id,person_id,tag_of&tag_of=in.(${ownIds.join(',')})`) : [],
    fromIds.length ? db.get('pk_kkh', `select=id,person_id&id=in.(${fromIds.join(',')})`) : [],
  ]);
  const tagsOf = (id) => copies.filter(c => c.tag_of === id).map(c => c.person_id);
  const originOf = Object.fromEntries(origins.map(o => [o.id, o.person_id]));
  const mine = toVal.filter(r => { const p = ctx.byId[r.person_id]; return p && r.person_id !== me && (isAdmin() || [p.valuer1_id, p.valuer2_id].includes(me)); });
  const by = Object.fromEntries(rows.map(r => [r.hour, r]));
  const H = hours(); const filled = rows.filter(r => r.code).length; const valid = rows.filter(r => r.status === 'valid').length;
  const taskName = Object.fromEntries(tasks.map(t => [t.id, t.title]));
  const off = leave[me];
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">${fdate(day)} · ${day === today() ? 'hari ini' : ''} isi sebelum 08.00, valuer menandai selesai</span><h1>KKH Saya</h1></div>
    <div class="row gap"><a class="btn" href="#/kkh?d=${addDays(day, -1)}" aria-label="Hari sebelumnya">‹</a><input type="date" class="inp" id="dpick" value="${day}"><a class="btn" href="#/kkh?d=${addDays(day, 1)}" aria-label="Hari berikutnya">›</a></div></header>
  ${off ? `<div class="note warn">Hari ini Anda ${off === 'cuti' ? 'cuti' : 'libur'} (sudah disetujui). Slot tidak dihitung ke disiplin KKH.</div>` : ''}
  <div class="tiles">
    <div class="tile"><span>Slot terisi</span><b>${filled} / ${H.length}</b></div>
    <div class="tile"><span>Sudah divalidasi</span><b>${valid}</b></div>
    <div class="tile"><span>Pekerjaan aktif saya</span><b>${tasks.length}</b><a href="#/tugas?me=1" class="small">lihat →</a></div>
    <div class="tile"><span>Valuer</span><b class="small-b">${ctx.byId[me].valuer1_id ? esc(nick(ctx.byId[me].valuer1_id)) + (ctx.byId[me].valuer2_id ? ' · ' + esc(nick(ctx.byId[me].valuer2_id)) : '') : 'Tidak perlu (CEO)'}</b></div>
  </div>
  <div class="row gap wrap">
    <button class="btn" data-a="copy">Salin rencana kemarin</button>
    <button class="btn" data-a="ready">Tandai semua siap divalidasi</button>
  </div>
  <section class="card pad0"><ol class="slots">${H.map(h => { const r = by[h];
    return `<li><button type="button" class="slot" data-h="${h}" style="--m:${r ? MODE_BG[r.mode] : '#fff'}">
      <span class="t">${hh(h)}</span>
      ${r ? `<span class="code">${esc(r.code)}</span><span class="nt"><b>${esc(r.note || '—')}</b><small>${r.task_id ? '↳ ' + esc(taskName[r.task_id] || 'pekerjaan') + ' · ' : ''}${esc((MODES.find(m => m[0] === r.mode) || MODES[0])[1])}</small>${tagLine(r)}</span>
        ${r.status === 'valid' ? `<span class="chip green">✓ ${esc(nick(r.validated_by))}</span>` : r.status === 'siap' ? '<span class="chip blue">Siap divalidasi</span>' : '<span class="chip gray">Rencana</span>'}`
        : '<span class="nt muted">+ isi slot ini</span>'}</button></li>`; }).join('')}</ol></section>
  ${mine.length ? `<section class="card"><div class="row between"><h2>Perlu saya validasi <span class="chip blue">${mine.length}</span></h2><button class="btn pri" data-a="valall">Validasi semua yang tampil</button></div>
    <div class="list">${mine.map(r => `<label class="li row gap"><input type="checkbox" class="vchk" value="${r.id}" checked>${avatar(r.person_id, 28)}<span style="flex:1"><b>${esc(nick(r.person_id))}</b> · ${fdate(r.day)} ${hh(r.hour)} · <b>${esc(r.code)}</b> ${esc(r.note || '')}</span></label>`).join('')}</div>
    <div class="row gap"><button class="btn pri" data-a="valsel">Validasi yang dicentang</button><button class="btn" data-a="unval">Kembalikan ke pemilik</button></div></section>` : ''}`;

  function tagLine(r) {
    if (r.tag_of) return `<small class="tagl">dari jadwal ${originOf[r.tag_of] ? avatar(originOf[r.tag_of], 16) + ' <b>' + esc(nick(originOf[r.tag_of])) + '</b>' : 'tim'}</small>`;
    const t = tagsOf(r.id); if (!t.length) return '';
    return `<small class="tagl">bersama <span class="avs">${t.slice(0, 5).map(id => avatar(id, 16)).join('')}</span> ${esc(t.map(nick).join(', '))}</small>`;
  }
  el.querySelector('#dpick').onchange = (e) => { location.hash = '#/kkh?d=' + e.target.value; };
  el.onclick = async (e) => {
    const slot = e.target.closest('.slot');
    if (slot) return editSlot(+slot.dataset.h);
    const a = e.target.closest('[data-a]'); if (!a) return;
    try {
      if (a.dataset.a === 'copy') {
        const prev = await db.get('pk_kkh', `select=hour,code,mode,note,task_id,unit_code&person_id=eq.${me}&day=eq.${addDays(day, -1)}`);
        const free = prev.filter(p => !by[p.hour]);
        if (!free.length) return toast('Tidak ada slot kemarin yang bisa disalin', 'err');
        await db.insert('pk_kkh', free.map(p => ({ ...p, person_id: me, day, status: 'rencana' })));
        toast(free.length + ' slot disalin'); reload();
      } else if (a.dataset.a === 'ready') {
        const ids = rows.filter(r => r.status === 'rencana').map(r => r.id);
        if (!ids.length) return toast('Tidak ada slot rencana', 'err');
        await db.update('pk_kkh', `id=in.(${ids.join(',')})`, { status: 'siap' }); toast('Dikirim ke valuer'); reload();
      } else if (['valall', 'valsel', 'unval'].includes(a.dataset.a)) {
        const ids = a.dataset.a === 'valall' ? mine.map(r => r.id) : [...el.querySelectorAll('.vchk:checked')].map(c => c.value);
        if (!ids.length) return toast('Pilih slot dulu', 'err');
        const n = await db.rpc('pk_kkh_validate', { p_ids: ids, p_valid: a.dataset.a !== 'unval' });
        toast(n + ' slot ' + (a.dataset.a === 'unval' ? 'dikembalikan' : 'divalidasi')); reload();
      }
    } catch (er) { toast(er.message, 'err'); }
  };

  async function editSlot(h) {
    const r = by[h];
    if (r && r.status === 'valid') return toast('Slot ini sudah divalidasi dan dikunci', 'err');
    const res = await modal(`Slot ${hh(h)} · ${fdate(day)}`,
      field('Jenis kerja', `<select name="code" class="inp">${opts(CODES, r ? r.code : 'SW')}</select>`) +
      field('Mode kerja', `<select name="mode" class="inp">${opts(MODES, r ? r.mode : 'kantor')}</select>`) +
      field('Catatan pekerjaan', `<input name="note" class="inp" value="${esc(r ? r.note : '')}" placeholder="Apa yang dikerjakan di jam ini">`) +
      field('Bagian dari pekerjaan', `<select name="task_id" class="inp">${opts(tasks.map(t => [t.id, t.title]), r ? r.task_id : '', '— tidak terkait —')}</select>`) +
      tagField(r) +
      `<label class="chk"><input type="checkbox" name="siap" ${r && r.status === 'siap' ? 'checked' : ''}> Sudah dikerjakan, siap divalidasi</label>`,
      { danger: r ? { label: r.tag_of ? 'Tidak ikut (lepas dari jadwal ini)' : 'Kosongkan', onClick: async () => {
          if (!r.tag_of && tagsOf(r.id).length) await db.remove('pk_kkh', 'tag_of=eq.' + r.id);
          await db.remove('pk_kkh', 'id=eq.' + r.id); return 'del'; } } : null,
        onSubmit: async (f, form) => {
          const picked = [...form.querySelectorAll('[name=tag]:checked')].map(c => c.value);
          let code = f.code; if (picked.length && code === 'SW') code = 'CW';
          const row = { person_id: me, day, hour: h, code, mode: code === 'IZIN' ? 'izin' : f.mode, note: f.note.trim() || null, task_id: f.task_id || null, unit_code: ctx.me.unit_code, status: f.siap ? 'siap' : 'rencana' };
          const saved = await db.upsert('pk_kkh', row, 'person_id,day,hour');
          const id = (saved && saved[0] && saved[0].id) || (r && r.id);
          if (r && r.tag_of) return true;
          const before = r ? tagsOf(r.id) : [];
          const removed = before.filter(x => !picked.includes(x));
          if (removed.length) await db.remove('pk_kkh', `tag_of=eq.${id}&person_id=in.(${removed.join(',')})`);
          if (picked.length || before.length) {
            const out = await db.rpc('pk_kkh_tag', { p_slot: id, p_people: picked }) || {};
            const locked = out.locked || [];
            toast(picked.length ? `Masuk ke KKH ${out.tagged || 0} orang` + (locked.length ? ` · ${locked.join(', ')} tidak ditimpa (jam itu sudah divalidasi)` : '') : 'Tag dilepas', locked.length ? 'err' : undefined);
          }
          return true;
        } });
    if (res) reload();
  }

  function tagField(r) {
    if (r && r.tag_of) return `<p class="note">Slot ini dari jadwal <b>${esc(nick(originOf[r.tag_of]) || 'tim')}</b>. Kalau Anda tidak ikut, pilih <b>Tidak ikut</b> di bawah.</p>`;
    const cur = r ? tagsOf(r.id) : [];
    const ppl = active().filter(p => p.id !== me).sort((a, b) => (a.unit_code === ctx.me.unit_code ? 0 : 1) - (b.unit_code === ctx.me.unit_code ? 0 : 1) || (a.nickname || a.name).localeCompare(b.nickname || b.name));
    return `<div class="fld"><span>Bersama (tag tim)</span><input class="inp" id="tagq" placeholder="Cari nama…" autocomplete="off">
      <div class="tagpick">${ppl.map(p => `<label class="tagc" data-n="${esc((p.nickname || p.name).toLowerCase())}"><input type="checkbox" name="tag" value="${p.id}" ${cur.includes(p.id) ? 'checked' : ''}>${avatar(p.id, 22)}<span>${esc(p.nickname || p.name)}</span></label>`).join('')}</div>
      <small>Slot ini otomatis masuk ke KKH orang yang di-tag dan menggantikan isi jam itu (kecuali yang sudah divalidasi).</small></div>`;
  }
}

// ================= KKH Tim =================
async function tim(el, params, reload) {
  const day = params.get('d') || today(); const scope = params.get('u') || 'ALL';
  const biz = ctx.units.filter(u => u.kind !== 'lini');
  const ppl = active().filter(p => scope === 'ALL' || p.unit_code === scope || (ctx.unit[p.unit_code] && ctx.unit[p.unit_code].parent === scope));
  const ids = ppl.map(p => p.id);
  const [rows, leave] = await Promise.all([db.get('pk_kkh', `select=*&day=eq.${day}`), dayLeave(day)]);
  const by = {}; rows.forEach(r => { by[r.person_id + '|' + r.hour] = r; });
  const H = hours(); const me = ctx.me.id;
  const canVal = (pid) => pid !== me && (isAdmin() || [ctx.byId[pid].valuer1_id, ctx.byId[pid].valuer2_id].includes(me));
  const onDuty = ppl.filter(p => !leave[p.id]).length;
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Agenda per jam tim management · klik slot berwarna biru untuk memvalidasi</span><h1>KKH Tim</h1></div>
    <div class="row gap"><a class="btn" href="#/kkh-tim?u=${scope}&d=${addDays(day, -1)}">‹</a><input type="date" class="inp" id="dpick" value="${day}"><a class="btn" href="#/kkh-tim?u=${scope}&d=${addDays(day, 1)}">›</a><button class="btn" data-a="wa">Laporan WA</button></div></header>
  <div class="chips">${[['ALL', 'Semua']].concat(biz.map(u => [u.code, u.name])).map(([k, l]) => `<a class="chipbtn${scope === k ? ' on' : ''}" href="#/kkh-tim?u=${k}&d=${day}">${k !== 'ALL' ? logo(k, 18) : ''}${esc(l)}</a>`).join('')}</div>
  <div class="tiles"><div class="tile"><span>Jaga hari ini</span><b>${onDuty} / ${ppl.length}</b></div><div class="tile"><span>Slot terisi</span><b>${rows.filter(r => ids.includes(r.person_id)).length}</b></div>
    <div class="tile"><span>Menunggu validasi</span><b>${rows.filter(r => ids.includes(r.person_id) && r.status === 'siap').length}</b></div><div class="tile"><span>Tervalidasi</span><b>${rows.filter(r => ids.includes(r.person_id) && r.status === 'valid').length}</b></div></div>
  <div class="legend"><span><i style="background:#DDF5F2"></i>Kantor</span><span><i style="background:#E5EEF9"></i>WFH</span><span><i style="background:#FDF3D7"></i>WFE</span><span><i style="background:#FCEBDD"></i>Izin</span><span><i class="dark"></i>✓ divalidasi</span></div>
  <section class="card pad0 scroll-x"><table class="kkh"><thead><tr><th class="sticky">Jam</th>${ppl.map(p => `<th>${avatar(p.id, 28)}<b>${esc(p.nickname || p.name)}</b><small>${esc(unitName(p.unit_code))}${leave[p.id] ? ' · ' + leave[p.id] : ''}</small></th>`).join('')}</tr></thead>
  <tbody>${H.map(h => `<tr><th class="sticky">${String(h).padStart(2, '0')}.00</th>${ppl.map(p => { const r = by[p.id + '|' + h];
    if (leave[p.id]) return '<td class="off"></td>';
    if (!r) return '<td class="empty"></td>';
    const v = r.status === 'valid'; const ready = r.status === 'siap' && canVal(p.id);
    return `<td><button type="button" class="cell${v ? ' valid' : ''}${ready ? ' ready' : ''}" data-id="${r.id}" data-can="${ready ? 1 : 0}" style="--m:${MODE_BG[r.mode]}" title="${esc(r.note || '')}"><b>${esc(r.code)}${v ? ' ✓' : ''}</b><small>${esc((r.note || '').slice(0, 26))}</small></button></td>`; }).join('')}</tr>`).join('')}</tbody></table></section>`;
  el.querySelector('#dpick').onchange = (e) => { location.hash = `#/kkh-tim?u=${scope}&d=${e.target.value}`; };
  el.onclick = async (e) => {
    if (e.target.closest('[data-a="wa"]')) {
      let t = `*Laporan KKH Tim${scope !== 'ALL' ? ' · ' + unitName(scope) : ''}*\n${fdate(day)}\nJaga ${onDuty}/${ppl.length} orang · ${rows.filter(r => ids.includes(r.person_id)).length} jam tercatat · ${rows.filter(r => ids.includes(r.person_id) && r.status === 'valid').length} tervalidasi\n`;
      for (const p of ppl) { const rs = rows.filter(r => r.person_id === p.id).sort((a, b) => a.hour - b.hour);
        t += `\n*${p.nickname || p.name}*${leave[p.id] ? ' · ' + leave[p.id] : rs.length ? ` · ${rs.length} jam${rs.some(r => r.status === 'valid') ? ', ' + rs.filter(r => r.status === 'valid').length + ' ✓' : ''}` : ' · _KKH kosong_'}\n`;
        for (const r of rs.filter(r => r.note)) t += `  ${String(r.hour).padStart(2, '0')}.00 ${r.code} – ${r.note}${r.status === 'valid' ? ' ✓' : ''}\n`; }
      await waReport('KKH ' + fdate(day, false), t + '\npokama.org'); return; }
    const c = e.target.closest('.cell'); if (!c) return;
    const r = rows.find(x => x.id === c.dataset.id); const p = ctx.byId[r.person_id];
    const can = c.dataset.can === '1';
    const res = await modal(`${p.nickname || p.name} · ${String(r.hour).padStart(2, '0')}.00`,
      `<p><b>${esc(r.code)}</b> · ${esc(MODES.find(m => m[0] === r.mode)[1])}</p><p>${esc(r.note || 'Tanpa catatan')}</p>
       <p class="muted small">Status: ${r.status === 'valid' ? 'divalidasi ' + esc(nick(r.validated_by)) : r.status === 'siap' ? 'siap divalidasi' : 'masih rencana'}</p>`,
      { submit: can ? 'Validasi ✓' : null, onSubmit: async () => { await db.rpc('pk_kkh_validate', { p_ids: [r.id], p_valid: true }); } });
    if (res) { toast('Divalidasi'); reload(); }
  };
}

export default { saya, tim };

// cari nama saat men-tag tim
document.addEventListener('input', (e) => {
  if (e.target.id !== 'tagq') return; const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.tagpick .tagc').forEach(l => { l.hidden = !!q && !l.dataset.n.includes(q) && !l.querySelector('input').checked; });
});

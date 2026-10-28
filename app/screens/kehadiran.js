import { ctx, db, esc, today, addDays, fdate, weekStart, dayName, avatar, nick, modal, field, opts, toast, active, unitName, isAdmin, need, chip, peopleOpts, bizOf, logo, confirmBox } from '../core.js';

export default async function kehadiran(el, params, reload) {
  const me = ctx.me.id; const ws = params.get('w') || weekStart(today());
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const yearStart = today().slice(0, 4) + '-01-01';
  const [rows, cutiYear] = await Promise.all([
    db.get('pk_leave', `select=*&day=lte.${days[6]}&or=(end_day.gte.${days[0]},and(end_day.is.null,day.gte.${days[0]}))&order=day`),
    db.get('pk_leave', `select=person_id,day,end_day,status&kind=eq.cuti&status=eq.disetujui&day=gte.${yearStart}`),
  ]);
  const span = (r) => { const out = []; let d = r.day; const e = r.end_day || r.day; while (d <= e) { out.push(d); d = addDays(d, 1); } return out; };
  const on = (pid, d) => rows.find(r => r.person_id === pid && !['ditolak', 'batal'].includes(r.status) && span(r).includes(d));
  const ppl = active().filter(p => p.role !== 'ceo');
  const myLibur = rows.filter(r => r.person_id === me && r.kind === 'libur' && !['ditolak', 'batal'].includes(r.status));
  const used = (pid) => cutiYear.filter(r => r.person_id === pid).reduce((s, r) => s + span(r).filter(d => !['Min'].includes(dayName(d))).length, 0);
  const allPending = await db.get('pk_leave', 'select=*&status=eq.diajukan&order=day');
  const mStart = today().slice(0, 8) + '01';
  const [wfaAll, wfaMine] = await Promise.all([
    db.get('pk_wfa', `select=*&or=(status.eq.diajukan,and(day.gte.${days[0]},day.lte.${days[6]}))&order=day`),
    db.get('pk_wfa', `select=*&person_id=eq.${me}&day=gte.${addDays(today(), -30)}&order=day.desc&limit=20`),
  ]);
  const wfaMax = +ctx.settings.wfa_max_month || 4;
  const wfaUsed = wfaMine.filter(w => ['diajukan', 'disetujui'].includes(w.status) && w.day.slice(0, 7) === today().slice(0, 7)).length;
  const wfaDecide = wfaAll.filter(w => w.status === 'diajukan' && w.person_id !== me && (isAdmin() || (ctx.byId[w.person_id] || {}).boss_id === me));
  const wfaOn = (pid, d) => wfaAll.find(w => w.person_id === pid && w.day === d && w.status === 'disetujui');
  const myPending = allPending.filter(r => r.person_id === me && r.kind !== 'libur');
  const myDecided = await db.get('pk_leave', `select=*&person_id=eq.${me}&status=in.(disetujui,ditolak)&decided_at=gte.${addDays(today(), -30)}&order=decided_at.desc&limit=15`).then(rs => rs.filter(r => r.kind !== 'libur' || r.status === 'ditolak').slice(0, 8));
  const toDecide = allPending.filter(r => r.person_id !== me && (isAdmin() || (ctx.byId[r.person_id] || {}).boss_id === me));
  const holdMin = 3;
  const duty = days.map(d => ({ d, hq: ppl.filter(p => bizOf(p.unit_code) === 'HQ' && !on(p.id, d)).length }));
  const meP = ctx.byId[me]; const quota = meP.leave_quota || 12;
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">2 hari libur per minggu, pilih paling lambat ${esc(ctx.settings.leave_pick_deadline || 'Jumat 17.00')} · cuti ${quota} hari/tahun</span><h1>Kehadiran, Cuti & Libur</h1></div>
    <div class="row gap"><a class="btn" href="#/kehadiran?w=${addDays(ws, -7)}">‹</a><b>Minggu ${fdate(days[0], false)} – ${fdate(days[6], false)}</b><a class="btn" href="#/kehadiran?w=${addDays(ws, 7)}">›</a></div></header>
  <div class="tiles"><div class="tile"><span>Libur saya minggu ini</span><b>${myLibur.length} / ${+ctx.settings.leave_days_per_week || 2}</b><small>${myLibur.map(r => fdate(r.day)).join(', ') || 'belum dipilih'}</small></div>
    <div class="tile"><span>Saldo cuti ${today().slice(0, 4)}</span><b>${quota - used(me)} hari</b><small>terpakai ${used(me)}</small></div>
    <div class="tile"><span>WFA bulan ini</span><b>${wfaUsed} / ${wfaMax}</b><small>ajukan paling lambat H-1</small></div>
    <div class="tile"><span>Menunggu persetujuan saya</span><b>${toDecide.length + wfaDecide.length}</b></div>
    <div class="tile"><span>Holding jaga minimal</span><b class="${duty.some(x => x.hq < holdMin) ? 'red' : ''}">${Math.min(...duty.map(x => x.hq))} / ${holdMin}</b><small>hari terendah minggu ini</small></div></div>
  <section class="card"><div class="row between"><h2>Pilih libur ${ws === weekStart(today()) ? "minggu ini" : ws > today() ? "minggu depan" : "minggu itu"}</h2><span class="muted small">Klik hari untuk memilih / membatalkan. Disetujui atasan langsung.</span></div>
    <div class="days">${days.map(d => { const r = myLibur.find(x => x.day === d); const low = duty.find(x => x.d === d).hq < holdMin && bizOf(meP.unit_code) === 'HQ';
      return `<button class="day${r ? ' on' : ''}${low && !r ? ' warn' : ''}" data-day="${d}" ${r && r.status === 'disetujui' ? 'title="Sudah disetujui"' : ''}><b>${dayName(d)}</b><span>${fdate(d, false)}</span><small>${r ? (r.status === 'disetujui' ? '✓ libur' : 'diajukan') : low ? 'kurang orang' : ''}</small></button>`; }).join('')}</div>
    <div class="row gap wrap"><button class="btn" data-a="cuti">Ajukan cuti</button><button class="btn" data-a="izin">Ajukan izin</button><button class="btn" data-a="wfa">Ajukan WFA</button></div></section>
  <details class="card rules"><summary><h2>Aturan WFA (kerja dari mana saja)</h2></summary><ul class="small">
    <li>Maksimal <b>${wfaMax} hari per bulan</b>, diajukan ke atasan paling lambat <b>H-1</b>.</li>
    <li>Hari WFA tetap <b>absen</b>, wajib <b>lokasi dan foto</b>.</li>
    <li>KKH tetap <b>${+ctx.settings.kkh_daily_hours || 8} jam</b> dan wajib divalidasi valuer.</li>
    <li>Harus bisa dihubungi selama jam kerja. Kalau tidak bisa dihubungi, atasan bisa menandai WFA tidak sah.</li></ul></details>
  ${myPending.length || myDecided.length || wfaMine.length ? `<section class="card"><h2>Pengajuan saya</h2><div class="list">
    ${wfaMine.filter(w => w.status !== 'batal').map(w => `<div class="li"><div class="row gap"><span style="flex:1"><b>WFA</b> ${fdate(w.day)} ${chip({ diajukan: 'menunggu atasan', disetujui: 'disetujui', ditolak: 'ditolak' }[w.status], { diajukan: 'yellow', disetujui: 'green', ditolak: 'red' }[w.status])} <small class="muted">${esc(w.reason || '')}</small></span>${['diajukan', 'disetujui'].includes(w.status) && w.day > today() ? `<button class="btn sm danger" data-wcancel="${w.id}">Batalkan</button>` : ''}</div>
      ${w.decide_note ? `<p class="reject-note${w.status === 'ditolak' ? '' : ' ok'}"><b>${w.status === 'ditolak' ? 'Alasan ditolak' : 'Catatan'}:</b> ${esc(w.decide_note)}</p>` : ''}</div>`).join('')}${myPending.map(r => `<div class="li row gap"><span style="flex:1"><b>${r.kind === 'cuti' ? 'Cuti' : 'Izin'}</b> ${fdate(r.day)}${r.end_day && r.end_day !== r.day ? ' – ' + fdate(r.end_day) : ''} ${chip('menunggu atasan', 'yellow')}</span><button class="btn sm danger" data-cancel="${r.id}">Batalkan</button></div>`).join('')}
    ${myDecided.map(r => `<div class="li"><div class="row gap"><span style="flex:1"><b>${{ cuti: 'Cuti', izin: 'Izin', libur: 'Libur' }[r.kind]}</b> ${fdate(r.day)}${r.end_day && r.end_day !== r.day ? ' – ' + fdate(r.end_day) : ''} ${chip(r.status === 'disetujui' ? 'disetujui' : 'ditolak', r.status === 'disetujui' ? 'green' : 'red')} <small class="muted">oleh ${esc(nick(r.decided_by))}</small></span></div>
      ${r.decide_note ? `<p class="reject-note${r.status === 'ditolak' ? '' : ' ok'}"><b>${r.status === 'ditolak' ? 'Alasan ditolak' : 'Catatan'}:</b> ${esc(r.decide_note)}</p>` : ''}</div>`).join('')}</div></section>` : ''}
  ${toDecide.length || wfaDecide.length ? `<section class="card"><h2>Perlu saya setujui</h2><div class="list">${wfaDecide.map(w => `<div class="li row gap">${avatar(w.person_id, 28)}<span style="flex:1"><b>${esc(nick(w.person_id))}</b> · WFA ${fdate(w.day)} · ${esc(w.reason || '')}</span><button class="btn sm pri" data-wok="${w.id}">Setujui</button><button class="btn sm" data-wno="${w.id}">Tolak</button></div>`).join('')}${toDecide.map(r => `<div class="li row gap">${avatar(r.person_id, 28)}<span style="flex:1"><b>${esc(nick(r.person_id))}</b> · ${r.kind} ${fdate(r.day)}${r.end_day && r.end_day !== r.day ? ' – ' + fdate(r.end_day) : ''}${r.replacement_id ? ' · pengganti ' + esc(nick(r.replacement_id)) : ''}${r.reason ? ' · ' + esc(r.reason) : ''}</span>
    <button class="btn sm pri" data-ok="${r.id}">Setujui</button><button class="btn sm" data-no="${r.id}">Tolak</button></div>`).join('')}</div></section>` : ''}
  <section class="card pad0 scroll-x"><table class="tbl cal"><thead><tr><th>Orang</th>${days.map(d => `<th>${dayName(d)}<br><small>${fdate(d, false)}</small></th>`).join('')}<th>Saldo cuti</th></tr></thead><tbody>
    ${ppl.map(p => `<tr><td><span class="row gap6">${avatar(p.id, 24)}<b>${esc(p.nickname || p.name)}</b><small class="muted">${esc(unitName(p.unit_code))}</small></span></td>${days.map(d => { const r = on(p.id, d);
      return `<td>${r ? `<span class="chip ${r.kind === 'cuti' ? 'yellow' : r.kind === 'izin' ? 'red' : 'blue'}">${r.kind}${r.status === 'diajukan' ? '?' : ''}</span>` : wfaOn(p.id, d) ? '<span class="chip green">WFA</span>' : ''}</td>`; }).join('')}<td>${(p.leave_quota || 12) - used(p.id)}</td></tr>`).join('')}
    <tr class="tot"><td>Holding jaga</td>${duty.map(x => `<td class="${x.hq < holdMin ? 'red b' : ''}">${x.hq}</td>`).join('')}<td></td></tr></tbody></table></section>`;

  el.onclick = async (e) => {
    try {
      const d = e.target.closest('[data-day]');
      if (d) { const day = d.dataset.day; const r = myLibur.find(x => x.day === day);
        if (r) { if (r.status === 'disetujui') return toast('Libur sudah disetujui. Minta atasan membatalkan.', 'err'); await db.remove('pk_leave', 'id=eq.' + r.id); }
        else { if (myLibur.length >= (+ctx.settings.leave_days_per_week || 2)) return toast('Sudah memilih ' + myLibur.length + ' hari libur minggu ini', 'err');
          await db.insert('pk_leave', { person_id: me, kind: 'libur', day, status: 'diajukan' }); }
        return reload(); }
      const cb = e.target.closest('[data-cancel]');
      if (cb) { if (!await confirmBox('Batalkan pengajuan ini?', 'Ya, batalkan')) return; await db.rpc('pk_leave_cancel', { p_id: cb.dataset.cancel }); toast('Pengajuan dibatalkan'); return reload(); }
      const wc = e.target.closest('[data-wcancel]'); if (wc) { if (!await confirmBox('Batalkan pengajuan WFA ini?', 'Ya, batalkan')) return; await db.rpc('pk_wfa_cancel', { p_id: wc.dataset.wcancel }); toast('WFA dibatalkan'); return reload(); }
      const wok = e.target.closest('[data-wok]'); if (wok) { await db.rpc('pk_wfa_decide', { p_id: wok.dataset.wok, p_approve: true }); toast('WFA disetujui'); return reload(); }
      const wno = e.target.closest('[data-wno]'); if (wno) { const w = wfaDecide.find(x => x.id === wno.dataset.wno);
        const r = await modal('Tolak WFA ' + nick(w.person_id), `<p class="muted small" style="margin-top:0">${fdate(w.day)} · ${esc(w.reason || '')}</p>` + field('Alasan penolakan', '<textarea name="note" class="inp" rows="3"></textarea>', 'Dikirim ke ' + esc(nick(w.person_id)) + ' lewat notifikasi dan email.'),
          { submit: 'Tolak WFA', onSubmit: async (f) => { need((f.note || '').trim(), 'Tulis alasan penolakan'); await db.rpc('pk_wfa_decide', { p_id: w.id, p_approve: false, p_note: f.note.trim() }); } });
        if (r) { toast('WFA ditolak · alasan dikirim'); reload(); } return; }
      const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]');
      if (ok) { await db.rpc('pk_leave_decision', { p_id: ok.dataset.ok, p_approve: true }); toast('Disetujui'); return reload(); }
      if (no) { const r0 = toDecide.find(x => x.id === no.dataset.no);
        const r = await modal('Tolak ' + r0.kind + ' ' + nick(r0.person_id), `<p class="muted small" style="margin-top:0">${esc(r0.kind)} ${fdate(r0.day)}${r0.end_day && r0.end_day !== r0.day ? ' – ' + fdate(r0.end_day) : ''}${r0.reason ? ' · alasan pengaju: ' + esc(r0.reason) : ''}</p>` +
          field('Alasan penolakan', '<textarea name="note" class="inp" rows="3" placeholder="Contoh: tanggal itu ada event TripinAja, bisa digeser ke minggu depan?"></textarea>', 'Alasan ini dikirim ke ' + esc(nick(r0.person_id)) + ' lewat notifikasi dan email.'),
          { submit: 'Tolak pengajuan', onSubmit: async (f) => { need((f.note || '').trim(), 'Tulis alasan penolakan'); await db.rpc('pk_leave_decision', { p_id: r0.id, p_approve: false, p_note: f.note.trim() }); } });
        if (r) { toast('Ditolak · alasan dikirim ke ' + nick(r0.person_id)); reload(); } return; }
      const a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'wfa') {
        if (wfaUsed >= wfaMax) return toast(`Jatah WFA bulan ini sudah ${wfaMax} hari`, 'err');
        const r = await modal('Ajukan WFA', `<p class="muted small" style="margin-top:0">Sisa jatah bulan ini ${wfaMax - wfaUsed} hari. Diajukan paling lambat H-1 ke ${esc(meP.boss_id ? nick(meP.boss_id) : 'Kepala Staf')}.</p>` +
          field('Tanggal WFA', `<input type="date" name="d" class="inp" min="${addDays(today(), 1)}" value="${addDays(today(), 1)}">`) +
          field('Alasan & rencana kerja', '<textarea name="why" class="inp" rows="3" placeholder="Contoh: survei lokasi mitra di Bandung, tetap online dan isi KKH 8 jam"></textarea>'),
          { submit: 'Ajukan', onSubmit: async (f) => { need(f.d, 'Pilih tanggal'); need((f.why || '').trim(), 'Tulis alasan'); await db.rpc('pk_wfa_request', { p_day: f.d, p_reason: f.why.trim() }); } });
        if (r) { toast('WFA diajukan ke ' + (meP.boss_id ? nick(meP.boss_id) : 'Kepala Staf')); reload(); } return; }
      if (a) { const kind = a.dataset.a;
        const r = await modal(kind === 'cuti' ? 'Ajukan cuti' : 'Ajukan izin',
          `<div class="g2">` + field('Mulai', `<input type="date" name="d1" class="inp" value="${addDays(today(), 1)}">`) + field('Sampai', `<input type="date" name="d2" class="inp" value="${addDays(today(), 1)}">`) + `</div>` +
          field('Pengganti selama tidak ada', `<select name="rep" class="inp">${peopleOpts('', '— pilih —', p => p.id !== me)}</select>`, kind === 'cuti' ? 'Wajib untuk cuti.' : '') +
          field('Alasan', '<input name="why" class="inp">') + (kind === 'cuti' ? `<p class="note">Saldo cuti Anda ${quota - used(me)} hari.</p>` : ''),
          { submit: 'Ajukan', onSubmit: async (f) => { need(f.d1, 'Isi tanggal'); if (kind === 'cuti') need(f.rep, 'Pilih pengganti'); if (f.d2 && f.d2 < f.d1) throw new Error('Tanggal selesai sebelum tanggal mulai');
            await db.insert('pk_leave', { person_id: me, kind, day: f.d1, end_day: f.d2 || f.d1, replacement_id: f.rep || null, reason: f.why || null, status: 'diajukan' }); } });
        if (r) { toast(meP.boss_id ? 'Diajukan ke ' + nick(meP.boss_id) : 'Tercatat'); reload(); } }
    } catch (er) { toast(er.message, 'err'); }
  };
}

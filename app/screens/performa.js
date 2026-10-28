// Ringkasan performa individu (desain 10b) · satu orang, satu bulan
import { ctx, db, esc, today, fmonth, monthStart, addDays, fdate, avatar, nick, modal, field, opts, toast, unitName, isAdmin, isFin, isCeo, chip, logo, ROLE, bizOf } from '../core.js';

const monthEnd = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
const addMonths = (m, n) => { const d = new Date(m + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 8) + '01'; };
const pct = (x) => x === null || x === undefined ? '—' : Math.round(x * 100) + '%';
const BULAN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function cat(s) { return s === null ? ['Belum ada skor', 'gray'] : s >= 85 ? ['Sangat baik', 'green'] : s >= 70 ? ['Baik', 'green'] : s >= 55 ? ['Perlu perbaikan', 'yellow'] : ['Pembinaan', 'red']; }

// rumus yang sama dengan halaman Performa
export function calc(os, kkh, pf, notes) {
  const W = ctx.settings.weights || { output: 60, kkh: 25, valuer: 15 };
  const wsum = os.reduce((s, o) => s + (+o.weight), 0) || 1;
  const cap = os.length ? os.reduce((s, o) => s + o.weight * Math.min(1.2, (+o.actual) / (+o.target)), 0) / wsum : null;
  const disc = kkh.length ? kkh.filter(x => x.status === 'valid').length / kkh.length : null;
  const ns = notes.filter(n => n.score); const vs = ns.length ? ns.reduce((s, n) => s + (+n.score), 0) / ns.length : (pf && pf.valuer_score ? +pf.valuer_score : null);
  const val = vs ? (vs - 1) / 4 : null;
  const parts = [cap === null ? 0 : Math.min(1, cap) * W.output, (disc ?? 0) * W.kkh, (val ?? 0) * W.valuer];
  const score = cap === null ? null : Math.round(parts[0] + parts[1] + parts[2]);
  const fac = cap === null ? 0 : cap < .7 ? 0 : cap < .9 ? cap : cap <= 1 ? 1 : Math.min(1.2, cap);
  return { W, cap, disc, vs, val, parts, score, fac, eligible: disc !== null && disc >= .8 };
}

export async function detail(el, params, reload, pid) {
  const me = ctx.me.id; const p = ctx.byId[pid];
  if (!p) { el.innerHTML = '<div class="card"><p class="muted">Orang tidak ditemukan.</p></div>'; return; }
  const m = params.get('m') || monthStart(today()); const end = monthEnd(m); const m0 = addMonths(m, -5);
  const canSee = pid === me || isFin() || isAdmin() || p.boss_id === me || p.valuer1_id === me || p.valuer2_id === me;
  if (!canSee) { el.innerHTML = '<div class="card"><p class="muted">Anda tidak punya akses ke performa orang ini.</p></div>'; return; }
  const [outputs, perf, notes, kkh, tasks, leave, asks] = await Promise.all([
    db.get('pk_outputs', `select=*&person_id=eq.${pid}&month=gte.${m0}&month=lte.${m}&order=created_at`),
    db.get('pk_perf', `select=*&person_id=eq.${pid}&month=gte.${m0}&month=lte.${m}`),
    db.get('pk_perf_notes', `select=*&person_id=eq.${pid}&month=gte.${m0}&month=lte.${m}`),
    Promise.all([...Array(6)].map((_, i) => { const mm = addMonths(m0, i); return db.get('pk_kkh', `select=day,status&person_id=eq.${pid}&day=gte.${mm}&day=lte.${monthEnd(mm)}&limit=1000`); })).then(a => a.flat()),
    db.get('pk_tasks', `select=id,title,status,due,done_at,round,version,revise_due&pic_id=eq.${pid}&order=updated_at.desc&limit=200`),
    db.get('pk_leave', `select=kind,day,end_day,status&person_id=eq.${pid}&status=eq.disetujui&day=lte.${end}`),
    db.get('pk_feedback_asks', `select=*&person_id=eq.${pid}&order=created_at.desc&limit=10`),
  ]);
  const inMonth = (d, mm) => d && d.slice(0, 7) === mm.slice(0, 7);
  const forMonth = (mm) => calc(outputs.filter(o => o.month === mm), kkh.filter(k => inMonth(k.day, mm)), perf.find(x => x.month === mm), notes.filter(n => n.month === mm));
  const c = forMonth(m); const prev = forMonth(addMonths(m, -1));
  const os = outputs.filter(o => o.month === m); const pf = perf.find(x => x.month === m) || {}; const ns = notes.filter(n => n.month === m);
  const trend = [...Array(6)].map((_, i) => { const mm = addMonths(m0, i); return { mm, s: forMonth(mm).score }; });
  const monthKkh = kkh.filter(k => inMonth(k.day, m));
  const doneM = tasks.filter(t => t.status === 'done' && inMonth(t.done_at, m));
  const onTime = doneM.filter(t => !t.due || t.done_at.slice(0, 10) <= t.due).length;
  const avgRound = doneM.length ? doneM.reduce((s, t) => s + (+t.round || 0), 0) / doneM.length : null;
  const running = tasks.filter(t => ['todo', 'doing', 'review', 'revisi'].includes(t.status));
  const isSelf = pid === me; const canValue = !isSelf && (isAdmin() || [p.valuer1_id, p.valuer2_id, p.boss_id].includes(me));
  const canSet = !isSelf && (isFin() || isAdmin() || p.boss_id === me || p.valuer1_id === me);
  const valuers = [p.valuer1_id, p.valuer2_id].filter(Boolean);
  const L = (s) => ctx.byId[s] ? esc(nick(s)) : '—';

  // ---- alur penilaian ----
  const steps = [['Output disepakati', os.length > 0, os.length ? os.length + ' output' : 'belum'],
    ['Dinilai valuer', ns.some(n => n.score) || !!pf.valuer_score, ns.length ? ns.filter(n => n.score).map(n => nick(n.valuer_id)).join(' & ') : 'belum'],
    ['Ditanggapi', ns.some(n => n.reply), ns.some(n => n.reply) ? 'sudah' : 'belum'],
    ['Disetujui CEO', !!pf.approved_at, pf.approved_at ? fdate(pf.approved_at.slice(0, 10), false) : 'belum']];
  const cur = steps.findIndex(s => !s[1]);

  // ---- donut skor ----
  const R = 54, C = 2 * Math.PI * R; let off = 0;
  const cols = ['#1D3149', '#09BEAF', '#86DCD3'];
  const arcs = c.score === null ? '' : c.parts.map((v, i) => { const Lg = C * v / 100; const a = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${cols[i]}" stroke-width="14" stroke-dasharray="${Math.max(0, Lg - 2).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 70 70)"></circle>`; off += Lg; return a; }).join('');
  const donut = `<svg class="donut" width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Skor ${c.score ?? 'belum ada'}"><circle cx="70" cy="70" r="${R}" fill="none" stroke="#EEF0F3" stroke-width="14"></circle>${arcs}<text x="70" y="70" text-anchor="middle" font-size="34" font-weight="900" fill="#1D3149">${c.score ?? '—'}</text><text x="70" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#5B6573">dari 100</text></svg>`;

  // ---- kalender KKH ----
  const leaveDay = (d) => { const l = leave.find(x => d >= x.day && d <= (x.end_day || x.day)); return l ? l.kind : null; };
  const first = new Date(m + 'T00:00:00Z'); const lead = (first.getUTCDay() + 6) % 7; const days = +end.slice(8, 10);
  let cal = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(h => `<span class="ch">${h}</span>`).join('') + '<span></span>'.repeat(lead);
  for (let i = 1; i <= days; i++) {
    const d = m.slice(0, 8) + String(i).padStart(2, '0'); const ks = monthKkh.filter(k => k.day === d); const lv = leaveDay(d);
    let cls = 'empty', t = 'kosong';
    if (d > today()) { cls = 'future'; t = 'akan datang'; }
    else if (lv) { cls = lv === 'cuti' ? 'cuti' : 'off'; t = lv; }
    else if (ks.length) { const r = ks.filter(k => k.status === 'valid').length / ks.length; cls = r >= 1 ? 'v100' : r >= .8 ? 'v80' : 'vlow'; t = Math.round(r * 100) + '% divalidasi dari ' + ks.length + ' slot'; }
    cal += `<span class="cd ${cls}${d === today() ? ' now' : ''}" title="${i} ${fmonth(m)} · ${t}">${i}</span>`;
  }

  // ---- tren ----
  const pts = trend.map((t, i) => [24 + i * 102, t.s === null ? null : 100 - (Math.max(50, Math.min(100, t.s)) - 50) / 50 * 76, t]);
  const valid = pts.filter(x => x[1] !== null);
  const spark = `<svg class="spark" viewBox="0 0 560 130" role="img" aria-label="Tren skor 6 bulan">
    <line x1="10" x2="550" y1="${100 - 35 / 50 * 76}" y2="${100 - 35 / 50 * 76}" stroke="#A9E4DC" stroke-dasharray="4 4"></line>
    ${valid.length > 1 ? `<polyline points="${valid.map(x => x[0] + ',' + x[1].toFixed(0)).join(' ')}" fill="none" stroke="#1D3149" stroke-width="2.5"></polyline>` : ''}
    ${pts.map(([x, y, t], i) => `${y !== null ? `<circle cx="${x}" cy="${y.toFixed(0)}" r="${i === 5 ? 6 : 4}" fill="${i === 5 ? '#09BEAF' : '#fff'}" stroke="#1D3149" stroke-width="2"></circle><text x="${x}" y="${(y - 12).toFixed(0)}" text-anchor="middle" font-size="12" font-weight="800" fill="${i === 5 ? '#1D3149' : '#5B6573'}">${t.s}</text>` : `<text x="${x}" y="70" text-anchor="middle" font-size="12" fill="#A9B4C2">—</text>`}<text x="${x}" y="124" text-anchor="middle" font-size="12" font-weight="700" fill="#5B6573">${BULAN3[+t.mm.slice(5, 7) - 1]}</text>`).join('')}</svg>`;

  // ---- catatan otomatis (aturan sederhana dari data) ----
  const notesAuto = [];
  if (c.score !== null && prev.score !== null) notesAuto.push(c.score >= prev.score ? ['up', `Skor ${c.score > prev.score ? 'naik ' + (c.score - prev.score) + ' poin' : 'sama'} dibanding bulan lalu (${prev.score}).`] : ['warn', `Skor turun ${prev.score - c.score} poin dibanding bulan lalu (${prev.score}).`]);
  if (os.length) {
    const low = os.map(o => ({ o, r: (+o.actual) / (+o.target) })).sort((a, b) => a.r - b.r)[0];
    if (low.r < 1) notesAuto.push([low.r < .7 ? 'bad' : 'warn', `Output terendah: <b>${esc(low.o.name)}</b> ${(+low.o.actual).toLocaleString('id-ID')} dari ${(+low.o.target).toLocaleString('id-ID')}. Kurang ${Math.ceil((+low.o.target) - (+low.o.actual)).toLocaleString('id-ID')} lagi untuk penuh.`]);
    if (c.cap !== null && c.cap < .9) notesAuto.push(['warn', `Capaian output ${pct(c.cap)}. Target capaian minimal 90%.`]);
  } else notesAuto.push(['warn', 'Output bulan ini belum disepakati dengan atasan.']);
  if (c.disc !== null && c.disc < .8) notesAuto.push(['bad', `Disiplin KKH ${pct(c.disc)}, di bawah standar 80%.`]);
  if (isSelf && valuers.length && !ns.length) notesAuto.push(['warn', `Valuer Anda belum memberi masukan bulan ini. Minta masukan supaya tahu apa yang perlu ditingkatkan.`]);
  const lateRev = running.filter(t => t.status === 'revisi' && t.revise_due && t.revise_due < today());
  if (lateRev.length) notesAuto.push(['bad', `${lateRev.length} revisi lewat tenggat: ${esc(lateRev.slice(0, 2).map(t => t.title).join(', '))}.`]);

  const back = isSelf && !(isAdmin() || isFin() || ctx.people.some(x => x.boss_id === me)) ? '' : `<a class="back" href="#/performa?m=${m}">‹ Performa tim</a>`;
  el.innerHTML = `
  ${back}
  <header class="card pf-head">
    ${avatar(pid, 72)}
    <div class="grow"><span class="row gap6 small b muted">${logo(bizOf(p.unit_code), 18)}${esc(unitName(p.unit_code))} · ${esc(p.title || ROLE[p.role])}</span>
      <h1>${esc(p.nickname || p.name)}</h1>
      <span class="pf-meta"><span>Atasan ${p.boss_id ? avatar(p.boss_id, 18) + ' <b>' + L(p.boss_id) + '</b>' : '—'}</span><span>Valuer ${valuers.map(v => avatar(v, 18)).join('')} <b>${valuers.map(L).join(' · ') || '—'}</b></span></span></div>
    <div class="pf-month"><input type="month" class="inp" id="mpick" value="${m.slice(0, 7)}" aria-label="Pilih bulan">
      ${m === monthStart(today()) ? `<span class="chip yellow">Bulan berjalan · sampai ${fdate(today(), false)}</span>` : ''}</div>
  </header>
  <ol class="pf-steps card">${steps.map((s, i) => `<li class="${s[1] ? 'done' : i === cur ? 'now' : ''}"><b>${s[1] ? '✓' : i + 1}</b><span><strong>${s[0]}</strong><small>${esc(s[2])}</small></span></li>`).join('')}</ol>
  <div class="pf-grid">
    <div class="stack pf-col">
      <section style="order:3" class="card"><div class="row between"><h2>Skor ${fmonth(m)}</h2>${chip(cat(c.score)[0], cat(c.score)[1])}</div>
        <div class="pf-score">${donut}<div class="pf-parts">
          ${[['Output', c.cap === null ? '—' : pct(c.cap), c.W.output, c.parts[0], os.length ? os.length + ' output tertimbang' : 'belum disepakati'],
             ['Disiplin KKH', pct(c.disc), c.W.kkh, c.parts[1], monthKkh.length ? monthKkh.filter(k => k.status === 'valid').length + ' dari ' + monthKkh.length + ' slot divalidasi' : 'belum ada slot'],
             ['Nilai valuer', c.vs ? c.vs.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' / 5' : '—', c.W.valuer, c.parts[2], ns.filter(n => n.score).map(n => nick(n.valuer_id) + ' ' + (+n.score).toLocaleString('id-ID')).join(' · ') || 'belum dinilai']]
            .map(([n, v, w, pt, sub], i) => `<div class="pf-part"><span class="row gap6"><i style="background:${cols[i]}"></i><b>${n}</b><span class="muted small" style="margin-left:auto">bobot ${w}%</span></span><span class="row gap6"><b class="big">${v}</b><small class="muted">+${pt.toFixed(1)} poin</small></span><small class="muted">${esc(sub)}</small></div>`).join('')}
        </div></div>
        <p class="small muted">Skor = ${c.W.output}% capaian output + ${c.W.kkh}% disiplin KKH + ${c.W.valuer}% nilai valuer. Dihitung otomatis dari KKH, Proyek & Tugas, dan penilaian valuer.</p></section>
      <section style="order:4" class="card"><div class="row between"><h2>Output yang disepakati</h2><span class="small muted">capaian tertimbang <b>${pct(c.cap)}</b></span></div>
        ${os.length ? `<div class="list">${os.map(o => { const r = (+o.actual) / (+o.target); return `<div class="pf-out"><div class="grow"><b>${esc(o.name)}</b><span class="bar lg"><i style="width:${Math.min(100, r * 100)}%;background:${r >= .9 ? '#09BEAF' : r >= .7 ? '#F2B84B' : '#C2410C'}"></i></span>${o.source ? `<small class="muted">sumber: ${esc(o.source)}</small>` : ''}</div><span class="muted small nw">bobot ${+o.weight}%</span><b class="nw">${(+o.actual).toLocaleString('id-ID')} <span class="muted">/ ${(+o.target).toLocaleString('id-ID')}</span></b><b class="nw ${r >= .9 ? '' : r >= .7 ? 'yel-t' : 'red'}">${Math.round(r * 100)}%</b></div>`; }).join('')}</div>`
          : `<p class="muted">Belum ada output yang disepakati untuk ${fmonth(m)}.</p>`}
        ${canSet ? `<a class="btn sm" style="align-self:flex-start" href="#/performa?m=${m}&edit=${pid}">Atur output & nilai</a>` : ''}</section>
      <section style="order:6" class="card"><h2>Pekerjaan & review</h2>
        <div class="tiles pf-tiles"><div class="tile"><b>${doneM.length}</b><span>selesai bulan ini</span></div><div class="tile"><b>${doneM.length ? Math.round(onTime / doneM.length * 100) + '%' : '—'}</b><span>tepat waktu</span></div>
          <div class="tile"><b>${avgRound === null ? '—' : avgRound.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</b><span>rata-rata putaran revisi</span></div><div class="tile"><b class="${running.some(t => t.status === 'revisi') ? 'red' : ''}">${running.length}</b><span>sedang berjalan</span></div></div>
        <ul class="pf-tasks">${doneM.slice(0, 3).concat(running.slice(0, 4)).map(t => `<li><span class="grow b">${esc(t.title)}</span><small class="muted nw">${t.status === 'done' ? 'v' + t.version + (t.round ? ' · ' + t.round + ' revisi' : ' · langsung disetujui') : t.due ? 'tenggat ' + fdate(t.status === 'revisi' && t.revise_due ? t.revise_due : t.due, false) : ''}</small>${chip({ done: 'Selesai', revisi: 'Perlu revisi', review: 'Menunggu review', doing: 'Dikerjakan', todo: 'Belum mulai' }[t.status], { done: 'green', revisi: 'red', review: 'yellow', doing: 'blue', todo: 'gray' }[t.status])}</li>`).join('') || '<li class="muted">Belum ada pekerjaan.</li>'}</ul>
        <a class="small b" href="#/tugas${isSelf ? '?me=1' : ''}">Lihat di Proyek & Tugas →</a></section>
      <section style="order:8" class="card"><div class="row between"><h2>Tren 6 bulan</h2><span class="small muted">garis putus = batas Sangat baik (85)</span></div>${spark}</section>
    </div>
    <div class="stack pf-col">
      <section style="order:1" class="card pf-valuer"><div class="row between"><h2>${isSelf ? 'Valuer Anda' : 'Valuer ' + esc(p.nickname || p.name)}</h2><span class="chip green">pembimbing · ${c.W.valuer}% skor</span></div>
        ${valuers.length ? `<div class="pf-vlist">${valuers.map(v => { const vp = ctx.byId[v] || {}; const n = ns.find(x => x.valuer_id === v);
          return `<div class="pf-v">${avatar(v, 52)}<span class="grow"><b>${L(v)}</b><small class="muted">${esc(vp.title || ROLE[vp.role] || '')}</small><small class="${n ? 'green-t' : 'muted'}">${n ? '✓ sudah memberi masukan' + (n.score ? ' · nilai ' + (+n.score).toLocaleString('id-ID') : '') : 'belum memberi masukan bulan ini'}</small></span></div>`; }).join('')}</div>
          <p class="small" style="margin:0">${isSelf ? 'Valuer adalah orang yang paling memperhatikan perkembangan Anda: melihat hasil kerja, memberi nilai, dan menyarankan langkah berikutnya. Masukannya menentukan ' + c.W.valuer + '% skor Anda, dan bisa Anda tanggapi.' : 'Valuer mendampingi perkembangan ' + esc(p.nickname || p.name) + ': memberi nilai, masukan, dan arah perbaikan setiap bulan.'}</p>
          ${isSelf ? (asks.find(x => !x.answered_at) ? `<span class="chip yellow" style="align-self:flex-start">Menunggu masukan sejak ${fdate(asks.find(x => !x.answered_at).created_at.slice(0, 10), false)}</span>` : `<button class="btn pri" style="align-self:flex-start" data-a="ask">Minta masukan valuer</button>`) : ''}
          ${!isSelf && valuers.includes(me) && asks.find(x => x.valuer_id === me && !x.answered_at) ? `<p class="reject-note" style="margin:0"><b>${esc(p.nickname || p.name)} meminta masukan Anda</b>${asks.find(x => x.valuer_id === me && !x.answered_at).topic ? ': ' + esc(asks.find(x => x.valuer_id === me && !x.answered_at).topic) : ''}</p>` : ''}`
          : `<p class="muted">Belum ada valuer. Kepala Staf mengaturnya di Tim & Peran.</p>`}</section>
      <section style="order:7" class="card"><h2>Catatan otomatis</h2><ul class="pf-auto">${notesAuto.map(([t, s]) => `<li class="${t}"><i>${t === 'up' ? '↑' : '!'}</i><span>${s}</span></li>`).join('') || '<li class="up"><i>✓</i><span>Semua berjalan sesuai rencana.</span></li>'}</ul></section>
      <section style="order:5" class="card"><div class="row between"><h2>Disiplin KKH</h2><b class="big">${pct(c.disc)}</b></div>
        <div class="pf-cal">${cal}</div>
        <div class="pf-leg"><span><i class="v100"></i>100%</span><span><i class="v80"></i>80–99%</span><span><i class="vlow"></i>&lt; 80%</span><span><i class="empty"></i>kosong</span><span><i class="cuti"></i>cuti</span><span><i class="off"></i>libur</span></div></section>
      <section style="order:2" class="card"><h2>Masukan dari valuer</h2>
        ${ns.length ? ns.map(n => `<div class="pf-note">${avatar(n.valuer_id, 34)}<div class="grow"><div class="bub"><small class="muted b">${L(n.valuer_id)}${n.score ? ' · nilai ' + (+n.score).toLocaleString('id-ID') : ''}</small><span>${esc(n.note || '—')}</span></div>
          ${n.reply ? `<div class="bub rp"><small class="muted b">Tanggapan ${esc(p.nickname || p.name)}</small><span>${esc(n.reply)}</span></div>` : isSelf ? `<button class="link" data-reply="${n.id}">Tanggapi</button>` : ''}</div></div>`).join('') : `<p class="muted">Belum ada masukan valuer untuk ${fmonth(m)}.</p>`}
        ${canValue ? `<button class="btn pri" style="align-self:flex-start" data-a="nilai">${ns.some(n => n.valuer_id === me) ? 'Ubah nilai & catatan saya' : 'Beri nilai & catatan'}</button>` : ''}</section>
    </div>
  </div>`;
  el.querySelector('#mpick').onchange = (e) => { location.hash = `#/performa?p=${pid}&m=${e.target.value}-01`; };
  el.onclick = async (e) => {
    const rb = e.target.closest('[data-reply]');
    if (rb) { const n = ns.find(x => x.id === rb.dataset.reply);
      const ok = await modal('Tanggapi catatan ' + nick(n.valuer_id), `<p class="note">${esc(n.note || '')}</p>` + field('Tanggapan Anda', '<textarea name="r" class="inp" rows="3" required></textarea>'),
        { onSubmit: (f) => db.update('pk_perf_notes', 'id=eq.' + n.id, { reply: f.r.trim() }) });
      if (ok) { toast('Tanggapan terkirim'); reload(); } return; }
    if (e.target.closest('[data-a="ask"]')) {
      const ok = await modal('Minta masukan valuer', `<p class="muted small" style="margin-top:0">Pesan dikirim ke ${valuers.map(L).join(' & ')} lewat notifikasi dan email.</p>` +
        field('Hal yang ingin dibahas (opsional)', '<textarea name="t" class="inp" rows="3" placeholder="Contoh: cara saya mempresentasikan laporan mingguan sudah cukup jelas belum?"></textarea>'),
        { submit: 'Kirim permintaan', onSubmit: (f) => db.rpc('pk_ask_valuer', { p_topic: (f.t || '').trim() || null }) });
      if (ok) { toast('Permintaan masukan terkirim'); reload(); } return; }
    const a = e.target.closest('[data-a="nilai"]'); if (!a) return;
    const mine = ns.find(n => n.valuer_id === me) || {};
    const ok = await modal('Nilai ' + (p.nickname || p.name) + ' · ' + fmonth(m),
      field('Nilai (1–5)', `<select name="s" class="inp">${opts([['5', '5 · sangat baik'], ['4', '4 · baik'], ['3', '3 · cukup'], ['2', '2 · kurang'], ['1', '1 · sangat kurang']], String(mine.score || '4'))}</select>`) +
      field('Catatan untuk ' + (p.nickname || p.name), `<textarea name="n" class="inp" rows="4" placeholder="Apa yang sudah bagus, apa yang perlu ditingkatkan">${esc(mine.note || '')}</textarea>`, 'Catatan terlihat oleh orangnya, atasan, CEO, dan Keuangan.'),
      { onSubmit: async (f) => {
        const row = { person_id: pid, month: m, valuer_id: me, score: +f.s, note: f.n.trim() || null };
        if (mine.id) await db.update('pk_perf_notes', 'id=eq.' + mine.id, { score: row.score, note: row.note }); else await db.insert('pk_perf_notes', row);
      } });
    if (ok) { toast('Nilai tersimpan'); reload(); }
  };
}

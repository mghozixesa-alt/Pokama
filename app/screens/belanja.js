import { safeUrl, ctx, db, esc, today, addDays, fdate, ftime, avatar, nick, modal, field, opts, toast, unitName, unitOpts, isFin, isCeo, need, chip, logo, rp, jt, num, bizOf, waReport, shrinkImage, uploadPhoto, signedPhoto, confirmBox } from '../core.js';

const ST = { diajukan: ['Menunggu persetujuan', 'yellow', '#D99A00'], revisi: ['Diminta revisi', 'gray', '#8A94A3'], ditolak: ['Ditolak', 'gray', '#8A94A3'],
  siap_cair: ['Siap dicairkan', 'blue', '#2F6FDB'], cair: ['Dana cair · tunggu nota', 'red', '#C2410C'], lpj: ['Nota masuk · dicek Keuangan', 'blue', '#2F6FDB'], selesai: ['Selesai', 'green', '#09BEAF'], batal: ['Dibatalkan', 'gray', '#A9B4C2'] };
const KIND = { op: 'Kebutuhan operasional', mt: 'Maintenance produk/aset' };

/* ---------- Klaim penggantian: staf sudah bayar sendiri → nota → atasan langsung → Keuangan transfer ---------- */
const KST = { diajukan: ['Menunggu atasan', 'yellow'], disetujui: ['Menunggu transfer', 'blue'], dibayar: ['Sudah ditransfer', 'green'], ditolak: ['Ditolak', 'red'], batal: ['Dibatalkan', 'gray'] };
const KCAT = ['Transport & bensin', 'Makan & rapat', 'Perlengkapan kantor', 'Parkir & tol', 'Pulsa & internet', 'Lainnya'];
async function klaimForm() {
  const r = await modal('Klaim penggantian', `<p class="muted small" style="margin-top:0">Untuk uang pribadi yang sudah Anda keluarkan untuk perusahaan. Disetujui atasan langsung, lalu ditransfer Keuangan.</p>` +
    `<div class="g2">` + field('Unit', `<select name="unit" class="inp">${unitOpts(ctx.me.unit_code)}</select>`) + field('Tanggal nota', `<input type="date" name="day" class="inp" value="${today()}" max="${today()}">`) + `</div>` +
    `<div class="g2">` + field('Nominal (Rp)', '<input name="amt" class="inp" inputmode="numeric" placeholder="0">') + field('Kategori', `<select name="cat" class="inp">${KCAT.map(c => `<option>${c}</option>`).join('')}</select>`) + `</div>` +
    field('Keterangan / rincian', '<textarea name="note" class="inp" rows="4" placeholder="Contoh:\n1. Bensin jeep Rp100.000\n2. Tiket short jeep Rp35.000"></textarea>', 'Beberapa nota sekaligus boleh: tulis rinciannya, nominal di atas diisi totalnya.') +
    field('Tautan nota (Google Drive)', '<input name="link" class="inp" inputmode="url" placeholder="https://drive.google.com/…">', 'Unggah foto/scan nota ke Google Drive, atur akses "Siapa saja yang memiliki link", lalu tempel tautannya. Banyak nota boleh dalam satu folder.'),
    { submit: 'Ajukan klaim', onSubmit: async (f) => {
      const amt = +String(f.amt || '').replace(/\D/g, ''); if (!amt) throw new Error('Isi nominal'); need((f.note || '').trim(), 'Tulis keterangan');
      const link = (f.link || '').trim(); if (!/^https:\/\/(drive|docs)\.google\.com\//i.test(link)) throw new Error('Tempel tautan Google Drive nota (diawali https://drive.google.com/)');
      const args = { p_amount: amt, p_category: f.cat, p_note: f.note.trim(), p_photo: link, p_day: f.day || null, p_unit: f.unit || null };
      try { await db.rpc('pk_claim_submit', args); }
      catch (er) { if (!/DUPLIKAT/.test(er.message)) throw er; if (!await confirmBox(er.message.replace(/^.*DUPLIKAT:\s*/, ''), 'Tetap ajukan')) throw new Error('Dibatalkan'); await db.rpc('pk_claim_submit', { ...args, p_force: true }); }
    } });
  if (r) toast('Klaim diajukan ke atasan');
  return r;
}
async function klaimView(el, params, reload) {
  const me = ctx.me.id; const ks = await db.get('pk_claims', 'select=*&order=created_at.desc&limit=300');
  const mine = ks.filter(k => k.person_id === me), dec = ks.filter(k => k.status === 'diajukan' && k.approver_id === me), pay = isFin() ? ks.filter(k => k.status === 'disetujui') : [];
  const row = (k, acts) => `<div class="li row gap wrap" style="align-items:flex-start"><span style="flex:1;min-width:220px">${chip(KST[k.status][0], KST[k.status][1])} <b>${rp(k.amount)}</b> · ${esc(k.category || '')}${k.dup_of ? ' <span class="chip red">mirip klaim lain</span>' : ''}<br><span style="white-space:pre-line">${esc(k.note)}</span><br>
      <small class="muted">${k.person_id !== me ? esc(nick(k.person_id)) + ' · ' : ''}${logo(k.unit_code, 14)} ${esc(unitName(k.unit_code))} · nota ${fdate(k.day)}${k.approver_id ? ' · atasan ' + esc(nick(k.approver_id)) : ''}${k.decide_note ? ' · ' + esc(k.decide_note) : ''}</small></span>
      <button type="button" class="btn sm" data-nota="${esc(k.photo || '')}">Nota</button>${acts || ''}</div>`;
  el.innerHTML = `<header class="ph"><div><span class="muted small">Uang pribadi yang sudah keluar untuk perusahaan · nota → atasan langsung → Keuangan transfer</span><h1>Klaim penggantian</h1></div>
    <div class="row gap"><a class="btn" href="#/belanja">‹ Pengajuan Belanja</a><button class="btn pri" data-k="new">+ Klaim penggantian</button></div></header>
  <ol class="steps"><li><b>1</b><span><strong>Ajukan</strong><small>foto nota + nominal</small></span></li><li><b>2</b><span><strong>Atasan langsung</strong><small>setujui atau tolak</small></span></li><li><b class="t">3</b><span><strong>Keuangan transfer</strong><small>tercatat di buku otomatis</small></span></li></ol>
  ${dec.length ? `<section class="card"><h2>Perlu saya setujui (${dec.length})</h2><div class="list">${dec.map(k => row(k, `<button class="btn sm pri" data-ok="${k.id}">Setujui</button><button class="btn sm" data-no="${k.id}">Tolak</button>`)).join('')}</div></section>` : ''}
  ${pay.length ? `<section class="card"><h2>Perlu ditransfer Keuangan (${pay.length})</h2><div class="list">${pay.map(k => row(k, `<button class="btn sm pri" data-pay="${k.id}">Tandai sudah ditransfer</button>`)).join('')}</div></section>` : ''}
  <section class="card"><h2>Klaim saya</h2><div class="list">${mine.map(k => row(k, k.status === 'diajukan' ? `<button class="btn sm danger" data-cancel="${k.id}">Batalkan</button>` : '')).join('') || '<p class="muted">Belum ada klaim.</p>'}</div></section>`;
  el.onclick = async (e) => {
    const t = e.target.closest('[data-k],[data-ok],[data-no],[data-pay],[data-cancel],[data-nota]'); if (!t) return;
    try {
      if (t.dataset.k === 'new') { if (await klaimForm()) reload(); return; }
      if (t.dataset.nota !== undefined) { if (!t.dataset.nota) return; const w = window.open('', '_blank'); const u = /^https?:/.test(t.dataset.nota) ? t.dataset.nota : await signedPhoto('mku-bukti', t.dataset.nota); if (w) w.location = u; else location.href = u; return; }
      if (t.dataset.ok) { await db.rpc('pk_claim_decide', { p_id: t.dataset.ok, p_ok: true }); toast('Disetujui · diteruskan ke Keuangan'); return reload(); }
      if (t.dataset.no) { const r = await modal('Tolak klaim', field('Alasan (dikirim ke pengaju)', '<textarea name="n" class="inp" rows="3" required></textarea>'), { submit: 'Tolak', danger: true, onSubmit: (f) => db.rpc('pk_claim_decide', { p_id: t.dataset.no, p_ok: false, p_note: f.n }) }); if (r) { toast('Ditolak'); reload(); } return; }
      if (t.dataset.pay) { const r = await modal('Tandai sudah ditransfer', field('Dibayar lewat', '<select name="ch" class="inp"><option value="transfer">Transfer bank</option><option value="tunai">Tunai</option></select>', 'Dicatat sebagai biaya di buku Keuangan.'), { submit: 'Tandai dibayar', onSubmit: (f) => db.rpc('pk_claim_paid', { p_id: t.dataset.pay, p_channel: f.ch }) }); if (r) { toast('Ditandai sudah ditransfer'); reload(); } return; }
      if (t.dataset.cancel) { if (!await confirmBox('Batalkan klaim ini?', 'Ya, batalkan')) return; await db.rpc('pk_claim_cancel', { p_id: t.dataset.cancel }); toast('Klaim dibatalkan'); return reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };
}

export default async function belanja(el, params, reload) {
  if (params.get('tab') === 'klaim') return klaimView(el, params, reload);
  const me = ctx.me.id;
  /* semua data dimuat bersamaan (dulu berurutan → lambat) */
  const [rabs, items, log, terms, drafts, klaimRows] = await Promise.all([
    db.get('pk_rab', 'select=*&order=created_at.desc&limit=400'),
    db.get('pk_rab_items', 'select=*&active=eq.true&order=sort'),
    db.get('pk_rab_log', 'select=*&order=at.desc&limit=600'),
    db.get('pk_rab_termin', 'select=*&order=n').catch(() => []),
    db.get('pk_rab_drafts', 'select=*&order=updated_at.desc').catch(() => []),
    db.get('pk_claims', 'select=id,status,approver_id,person_id&status=in.(diajukan,disetujui)').catch(() => null),
  ]);
  const T = (id) => terms.filter(t => t.rab_id === id);
  const plan = (r) => { const ts = T(r.id); const last = ts.length; let acc = 0; return ts.map(t => { const v = t.n === last ? r.total - acc : Math.round(r.total * t.pct / 100); acc += t.n === last ? 0 : v; return { ...t, planned: v }; }); };
  const cairTot = (r) => { const ts = T(r.id); return ts.length ? ts.reduce((s, t) => s + (t.cair_amount || 0) - (t.status === 'beres' && t.refund_at ? (t.refund_amount || 0) : 0), 0) : r.total; };
  const I = (id) => items.filter(i => i.rab_id === id); const L = (id) => log.filter(l => l.rab_id === id);
  const lpjDays = +ctx.settings.lpj_days || 2;
  const nKlaim = await Promise.resolve(klaimRows).then(ks => (ks || []).filter(k => (k.status === 'diajukan' && k.approver_id === me) || (k.status === 'disetujui' && isFin())).length).catch(() => 0);
  const lateLpj = (r) => r.status === 'cair' && r.cair_at && (Date.now() - new Date(r.cair_at)) / 864e5 > lpjDays;
  const myTurn = (r) => r.status === 'diajukan' && r.chain[r.step] === me;
  const sets = {
    setujui: rabs.filter(myTurn),
    saya: rabs.filter(r => r.created_by === me),
    keuangan: rabs.filter(r => ['siap_cair', 'lpj', 'cair'].includes(r.status)),
    semua: rabs,
  };
  const tabs = [['setujui', 'Perlu saya setujui'], ['saya', 'RAB saya'], isFin() && ['keuangan', 'Keuangan'], ['semua', 'Semua']].filter(Boolean);
  const tab = params.get('tab') || (sets.setujui.length ? 'setujui' : isFin() ? 'keuangan' : 'saya');
  const scope = params.get('u') || 'ALL';
  const list = (sets[tab] || []).filter(r => scope === 'ALL' || bizOf(r.unit_code) === scope);
  const sel = params.get('r') ? rabs.find(r => r.id === params.get('r')) : list[0];
  const month = today().slice(0, 7);
  const spent = rabs.filter(r => ['cair', 'lpj', 'selesai'].includes(r.status) && (r.cair_at || '').slice(0, 7) === month).reduce((s, r) => s + (r.realisasi || r.total), 0);
  const biz = ctx.units.filter(u => u.kind !== 'lini');
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Belanja pakai uang perusahaan: ajukan RAB, belanja, lalu upload nota (LPJ)</span><h1>Pengajuan Belanja</h1></div>
    <div class="row gap"><a class="btn" href="#/belanja?tab=klaim">Klaim penggantian${nKlaim ? ` (${nKlaim})` : ''}</a><button class="btn pri" data-a="new">+ Ajukan RAB</button></div></header>
  <ol class="steps"><li><b>1</b><span><strong>Ajukan RAB</strong><small>tabel barang, bisa tempel dari Excel</small></span></li><li><b>2</b><span><strong>Valuer 1 → Valuer 2</strong><small>berapa pun nominalnya</small></span></li><li><b>3</b><span><strong>Dana cair</strong><small>Keuangan, ${esc((ctx.settings.cair_days || []).join(' & '))} ${esc(ctx.settings.cair_time || '')}</small></span></li><li><b>4</b><span><strong>Upload nota</strong><small>≤ ${lpjDays} hari setelah belanja</small></span></li><li><b class="t">5</b><span><strong>Selesai</strong><small>sisa dana kembali ke unit</small></span></li></ol>
  <div class="tiles"><div class="tile"><span>Menunggu persetujuan</span><b>${rabs.filter(r => r.status === 'diajukan').length}</b><small>${rp(rabs.filter(r => r.status === 'diajukan').reduce((s, r) => s + r.total, 0))}</small></div>
    <div class="tile"><span>Siap dicairkan</span><b>${rabs.filter(r => r.status === 'siap_cair').length}</b><small>${rp(rabs.filter(r => r.status === 'siap_cair').reduce((s, r) => s + r.total, 0))}</small></div>
    <div class="tile"><span>Nota terlambat</span><b class="red">${rabs.filter(lateLpj).length}</b><small>RAB berikutnya unit itu ditahan</small></div>
    <div class="tile"><span>Belanja bulan ini</span><b>${jt(spent)}</b></div></div>
  <div class="chips">${tabs.map(([k, l]) => `<a class="chipbtn${tab === k ? ' on' : ''}" href="#/belanja?tab=${k}&u=${scope}">${l} (${sets[k].length})</a>`).join('')}<span style="flex:1"></span>
    ${[['ALL', 'Semua unit']].concat(biz.map(u => [u.code, u.name])).map(([k, l]) => `<a class="chipbtn sm${scope === k ? ' on' : ''}" href="#/belanja?tab=${tab}&u=${k}">${k !== 'ALL' ? logo(k, 16) : ''}${esc(l)}</a>`).join('')}</div>
  <div class="split${params.get('r') ? ' picked' : ''}">
    <div class="stack">${tab === 'saya' || (!list.length && drafts.length) ? drafts.map(d => `<button type="button" class="card item" data-a="draft" data-d="${d.id}" style="text-align:left;box-shadow:inset 4px 0 0 #B9C0CC">
      <span class="row between small"><span class="b">Draft · belum dikirim</span><span class="muted">${ftime(d.updated_at)}</span></span>
      <span class="row between"><b>${esc(d.title || 'RAB tanpa judul')}</b><b>${rp(d.total || 0)}</b></span><span class="small muted">${(d.payload.rows || []).length} barang · klik untuk melanjutkan</span></button>`).join('') : ''}${list.map(r => `<a class="card item${sel && sel.id === r.id ? ' sel' : ''}" style="box-shadow:inset 4px 0 0 ${ST[r.status][2]}" href="#/belanja?tab=${tab}&u=${scope}&r=${r.id}">
      <span class="row between small"><span class="row gap6 b">${logo(r.unit_code, 18)}${esc(unitName(r.unit_code))} · ${esc(r.code)}</span><span class="muted">${ftime(r.created_at)}</span></span>
      <span class="row between"><b>${esc(r.title)}</b><b>${rp(r.total)}</b></span>
      <span class="row between small"><span class="muted">Diajukan ${esc(nick(r.created_by))}${r.via_app ? ' · dari crew' : ''}</span>${chip(r.status === 'diajukan' ? 'Menunggu ' + nick(r.chain[r.step]) : lateLpj(r) ? 'Nota terlambat' : ST[r.status][0], lateLpj(r) ? 'red' : ST[r.status][1])}</span></a>`).join('') || '<div class="card empty-state"><p class="muted">Tidak ada RAB di sini.</p></div>'}</div>
    <div>${sel ? `<a class="m-only back" href="#/belanja?tab=${tab}&u=${scope}">‹ Kembali ke daftar</a>` + detail(sel) : ''}</div>
  </div>
  <details class="card rules"><summary><h2>Aturan belanja</h2></summary><div class="kv">
    <div><span>Semua nominal</span><b>Valuer 1 → Valuer 2 → Keuangan</b></div><div><span>Tanpa valuer</span><b>Atasan langsung, lalu Keuangan</b></div><div><span>Valuer saya</span><b>${esc(myChain().join(' → ') || 'langsung ke Keuangan')}</b></div>
    <div><span>Dana cair</span><b>${esc((ctx.settings.cair_days || []).join(' & '))} ${esc(ctx.settings.cair_time || '')}</b></div><div><span>Nota</span><b>≤ ${lpjDays} hari; telat = RAB berikutnya ditahan</b></div>
    <div><span>Crew cabang</span><b>Ajukan lewat Leader / Rentalaja App</b></div><div><span>Barang ≥ Rp500 rb</span><b>Masuk daftar aset unit</b></div><div><span>Sisa dana</span><b>Dikembalikan dulu ke rekening unit sebelum termin berikutnya cair / RAB ditutup</b></div></div></details>`;

  function terminBlock(r) {
    const ts = plan(r); const last = ts.length; const run = r.status === 'cair';
    const lbl = { rencana: ['Belum cair', 'gray'], cair: ['Cair · tunggu nota', 'blue'], lpj: ['Nota dicek Keuangan', 'yellow'], sisa: ['Sisa dana belum kembali', 'red'], beres: ['Beres', 'green'] };
    const row = (t) => { const prev = ts.find(x => x.n === t.n - 1); const st = t.n === last && t.status === 'cair' ? ['Cair · nota lewat LPJ penutup', 'blue'] : lbl[t.status];
      const acts = [];
      if (run && t.status === 'rencana' && isFin() && prev && prev.status === 'beres') acts.push(`<button class="btn sm pri" data-a="tcair" data-t="${t.id}">Cairkan termin ${t.n}</button>`);
      if (run && t.status === 'rencana' && isCeo() && prev && ['cair', 'lpj'].includes(prev.status)) acts.push(`<button class="btn sm" data-a="tskip" data-t="${t.id}">Cairkan tanpa tunggu nota (CEO)</button>`);
      if (t.status === 'cair' && t.n < last && (r.created_by === me || isFin())) acts.push(`<button class="btn sm pri" data-a="tlpj" data-t="${t.id}">Upload nota termin ${t.n}</button>`);
      if (t.status === 'lpj' && isFin()) acts.push(`<button class="btn sm pri" data-a="tok" data-t="${t.id}">Nota sesuai</button><button class="btn sm" data-a="tno" data-t="${t.id}">Kembalikan</button>`);
      if (t.status === 'sisa' && (r.created_by === me || isFin())) acts.push(`<button class="btn sm ${t.refund_link ? '' : 'pri'}" data-a="tref" data-t="${t.id}">${t.refund_link ? 'Ganti bukti transfer' : 'Kirim bukti pengembalian'}</button>`);
      if (t.status === 'sisa' && isFin()) acts.push(`<button class="btn sm pri" data-a="trefok" data-t="${t.id}">Sisa sudah diterima</button>`);
      if (t.status === 'rencana' && isFin() && !['ditolak', 'batal'].includes(r.status)) acts.push(`<button class="btn sm" data-a="tdate" data-t="${t.id}">Geser jadwal</button>`);
      return `<tr><td><b>Termin ${t.n}</b> <small class="muted">${+t.pct}%</small>${t.note ? `<br><small class="muted">${esc(t.note)}</small>` : ''}</td><td data-l="Jadwal" class="nw">${t.need_date ? fdate(t.need_date) : '—'}</td>
        <td data-l="Rencana" class="r">${rp(t.planned)}</td><td data-l="Cair" class="r b">${t.cair_amount != null ? rp(t.cair_amount) : '—'}</td>
        <td data-l="Nota" class="r">${t.lpj_amount != null ? (t.lpj_link ? `<a href="${safeUrl(t.lpj_link)}" target="_blank" rel="noopener">${rp(t.lpj_amount)} ↗</a>` : rp(t.lpj_amount)) : '—'}</td>
        <td data-l="Status">${chip(st[0], st[1])}${t.skip_note ? `<br><small class="red">dicairkan CEO tanpa tunggu nota: ${esc(t.skip_note)}</small>` : ''}${t.check_note && t.status === 'cair' ? `<br><small class="red">dikembalikan: ${esc(t.check_note)}</small>` : ''}${t.refund_amount ? `<br><small class="${t.status === 'sisa' ? 'red' : 'muted'}">sisa ${rp(t.refund_amount)} ${t.status === 'sisa' ? (t.refund_link ? `· <a href="${safeUrl(t.refund_link)}" target="_blank" rel="noopener">bukti ↗</a> tunggu Keuangan` : 'wajib dikembalikan dulu') : 'sudah kembali'}</small>` : ''}${t.topup_amount ? `<br><small class="muted">termasuk kekurangan termin ${t.n - 1} ${rp(t.topup_amount)}</small>` : ''}</td>
        <td>${acts.join(' ')}</td></tr>`; };
    const cair = ts.reduce((s, t) => s + (t.cair_amount || 0), 0);
    return `<h3>Cair bertahap · ${ts.length} termin</h3>
      <div class="termin-bar" style="display:flex;gap:3px;height:10px;border-radius:6px;overflow:hidden;margin:4px 0 8px">${ts.map(t => `<span title="Termin ${t.n}" style="flex:${t.pct};background:${{ rencana: '#E3E7EE', cair: '#7FB6F0', lpj: '#F2C46D', sisa: '#E5484D', beres: '#2BB673' }[t.status]}"></span>`).join('')}</div>
      <div class="scroll-x"><table class="tbl compact"><thead><tr><th>Termin</th><th>Jadwal</th><th class="r">Rencana</th><th class="r">Cair</th><th class="r">Nota</th><th>Status</th><th></th></tr></thead><tbody>${ts.map(row).join('')}
      <tr class="tot"><td>Total</td><td></td><td class="r">${rp(r.total)}</td><td class="r">${rp(cair)}</td><td class="r">${rp(ts.reduce((s, t) => s + (t.lpj_amount || 0), 0))}</td><td colspan="2" class="small muted">Termin berikutnya cair setelah nota termin sebelumnya dicek. Sisa dana wajib dikembalikan dulu ke rekening unit; kekurangan ditambahkan di termin berikutnya.</td></tr></tbody></table></div>`;
  }
  function detail(r) {
    const its = I(r.id); const lg = L(r.id).slice().reverse();
    const grp = Object.entries(its.reduce((g, i) => { (g[i.category || 'Lain-lain'] ||= []).push(i); return g; }, {})).sort((a, b) => b[1].reduce((s, i) => s + i.qty * i.price, 0) - a[1].reduce((s, i) => s + i.qty * i.price, 0));
    const steps = [['Diajukan ' + nick(r.created_by), true, ftime(r.created_at)]].concat(r.chain.map((p, i) => ['Disetujui ' + nick(p), r.step > i || ['siap_cair', 'cair', 'lpj', 'selesai'].includes(r.status), '']))
      .concat([['Dana dicairkan Keuangan', ['cair', 'lpj', 'selesai'].includes(r.status), r.cair_at ? ftime(r.cair_at) : ''], ['Nota diupload (LPJ)', ['lpj', 'selesai'].includes(r.status), r.lpj_at ? ftime(r.lpj_at) : ''], ['Dicek Keuangan · selesai', r.status === 'selesai', r.done_at ? ftime(r.done_at) : '']]);
    const stopped = ['revisi', 'ditolak', 'batal'].includes(r.status);
    const curIdx = steps.findIndex(s => !s[1]);
    const ai = [];
    const same = rabs.filter(x => x.id !== r.id && x.unit_code === r.unit_code && x.status === 'selesai').slice(0, 1);
    if (same.length) ai.push('RAB terakhir unit ini: ' + same[0].code + ' ' + rp(same[0].total) + (same[0].realisasi ? ', realisasi ' + rp(same[0].realisasi) : '') + '.');
    if (lateLpj(r)) ai.push('Nota sudah lewat ' + lpjDays + ' hari. RAB baru unit ini ditahan sampai nota masuk.');
    return `<section class="card sticky-top">
      <span class="row gap6 small b">${logo(r.unit_code, 22)}${esc(unitName(r.unit_code))} · ${esc(r.code)} · ${KIND[r.kind]}</span>
      <div class="row between"><h2>${esc(r.title)}</h2>${chip(ST[r.status][0], ST[r.status][1])}</div>
      <span class="small muted">Disusun ${esc(nick(r.created_by))} · dibutuhkan ${fdate(r.need_date)}${r.is_emergency ? ' · dana darurat' : ''}</span>
      ${r.description ? `<p class="note"><b>Tujuan:</b> ${esc(r.description)}</p>` : ''}
      <div class="row between small"><span class="muted">${its.length} barang${grp.length > 1 ? ' · ' + grp.length + ' kategori' : ''}</span>${its.length > 8 ? `<input class="inp sm" id="rab-q" placeholder="Cari barang…" style="max-width:200px">` : ''}</div>
      <div class="scroll-x rab-items"><table class="tbl compact"><thead><tr><th>Barang</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Total</th><th class="r">Realisasi</th></tr></thead><tbody>
        ${grp.map(([cat, rows]) => (grp.length > 1 ? `<tr class="cat"><td colspan="3">${esc(cat)} <small class="muted">· ${rows.length}</small></td><td class="r">${rp(rows.reduce((s, i) => s + i.qty * i.price, 0))}</td><td></td></tr>` : '') +
          rows.map(i => `<tr data-name="${esc((i.name + ' ' + (i.vendor || '')).toLowerCase())}"><td>${esc(i.name)}${i.vendor ? `<small class="muted"> · ${esc(i.vendor)}</small>` : ''}${i.unit_code && i.unit_code !== r.unit_code ? `<small class="muted"> · untuk ${esc(unitName(i.unit_code))}</small>` : ''}${i.nota_link ? (String(i.nota_link).startsWith('pk-nota:') ? ` <button type="button" class="link small" data-a="nfoto" data-p="${esc(i.nota_link)}">📷 nota (${String(i.nota_link).slice(8).split('|').length})</button>` : ` <a href="${safeUrl(i.nota_link)}" target="_blank" rel="noopener" class="small">nota ↗</a>`) : ''}</td><td class="r nw">${(+i.qty).toLocaleString('id-ID')} ${esc(i.uom || '')}</td><td class="r">${rp(i.price)}</td><td class="r b">${rp(i.qty * i.price)}</td><td class="r ${i.real_amount != null && i.real_amount > i.qty * i.price ? 'red' : ''}">${i.real_amount != null ? rp(i.real_amount) : '—'}</td></tr>`).join('')).join('')}
        <tr class="tot"><td>Total</td><td></td><td></td><td class="r">${rp(r.total)}</td><td class="r">${r.realisasi != null ? rp(r.realisasi) : '—'}</td></tr></tbody></table></div>
      ${r.realisasi != null ? `<p class="note">${r.realisasi <= cairTot(r) ? 'Sisa dana ' + rp(cairTot(r) - r.realisasi) + (r.status === 'selesai' ? ' sudah kembali ke rekening unit.' : ' wajib dikembalikan ke rekening unit sebelum RAB ditutup.') : 'Kurang ' + rp(r.realisasi - cairTot(r)) + ', ajukan sebagai RAB tambahan.'}</p>` : ''}
      ${(() => { const by = {}; its.forEach(i => { const u = i.unit_code || r.unit_code; by[u] = (by[u] || 0) + i.qty * i.price; }); const ks = Object.keys(by);
        return ks.length > 1 || (ks[0] && ks[0] !== r.unit_code) ? `<div class="rab-cats"><b class="small">Untuk</b> ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span>${logo(k, 14)} <span class="muted">${esc(unitName(k))}</span> <b>${rp(v)}</b></span>`).join('')} <small class="muted">· dibayar dari ${esc(unitName(r.unit_code))}, biaya masuk ke unit masing-masing</small></div>` : ''; })()}
      ${T(r.id).length ? terminBlock(r) : ''}
      ${ai.length ? `<div class="note warn"><b class="small">CEK OTOMATIS</b><ul>${ai.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${r.note ? `<p class="note err">${esc(r.note)}</p>` : ''}
      <h3>Perjalanan RAB</h3><ol class="journey">${steps.map((s, i) => `<li class="${s[1] ? 'done' : stopped && i === curIdx ? 'stop' : i === curIdx ? 'cur' : ''}"><b>${s[1] ? '✓' : stopped && i === curIdx ? '×' : i + 1}</b><span>${esc(s[0])}<small>${esc(s[2])}</small></span></li>`).join('')}</ol>
      <div class="row gap wrap">
        ${myTurn(r) || (isCeo() && r.status === 'diajukan' && r.created_by !== me) ? `<button class="btn pri" data-a="approve">${myTurn(r) ? 'Setujui' : 'Setujui langsung (CEO)'}</button><button class="btn" data-a="revise">Minta revisi</button><button class="btn danger" data-a="reject">Tolak</button>` : ''}
        ${r.status === 'revisi' && r.created_by === me ? `<button class="btn pri" data-a="resubmit">Revisi & ajukan ulang</button>` : ''}
        ${r.status === 'siap_cair' && isFin() ? `<button class="btn pri" data-a="cair">${T(r.id).length ? 'Cairkan termin 1' : 'Tandai dana sudah dicairkan'}</button>` : ''}
        ${r.status === 'diajukan' && isFin() ? `<button class="btn pri" disabled title="Persetujuan belum lengkap">Cairkan (menunggu ${esc(nick(r.chain[r.step]))})</button>` : ''}
        ${['diajukan', 'revisi', 'siap_cair'].includes(r.status) && (r.created_by === me || isCeo()) ? `<button class="btn danger" data-a="cancel">Batalkan RAB</button>` : ''}
        ${r.status === 'cair' && (r.created_by === me || isFin()) && !T(r.id).some(t => ['rencana', 'lpj'].includes(t.status)) ? `<button class="btn pri" data-a="lpj">${T(r.id).length ? 'LPJ penutup (nota termin terakhir)' : 'Upload nota (LPJ)'}</button>` : ''}
        ${r.status === 'lpj' && isFin() ? `<button class="btn pri" data-a="close">Nota sesuai · selesai</button>` : ''}
        <button class="btn" data-a="wa">Bagikan ke WA</button>
      </div>
      <details><summary class="small muted">Riwayat</summary><ul class="log">${lg.map(l => `<li><b>${esc(nick(l.actor_id))}</b> ${esc(l.action)}${l.note ? ' · ' + esc(l.note) : ''} <small class="muted">${ftime(l.at)}</small></li>`).join('')}</ul></details>
    </section>`;
  }

  const rq = el.querySelector('#rab-q'); if (rq) rq.addEventListener('input', () => { const v = rq.value.toLowerCase().trim(); el.querySelectorAll('.rab-items tr[data-name]').forEach(tr => { tr.hidden = !!v && !tr.dataset.name.includes(v); }); el.querySelectorAll('.rab-items tr.cat').forEach(tr => { tr.hidden = !!v; }); });
  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return; const r = sel;
    try {
      let ok = null;
      if (a.dataset.a === 'wa') { const its = I(r.id); const byC = {}; its.forEach(i => (byC[i.category || 'Lain-lain'] ||= []).push(i));
        let t = `*${r.code}* · ${ST[r.status][0]}\n*${r.title}*\n${unitName(r.unit_code)} · diajukan ${nick(r.created_by)} · butuh ${fdate(r.need_date)}\n${r.description ? '_' + r.description + '_\n' : ''}`;
        for (const [k, rows] of Object.entries(byC)) { t += `\n*${k}*${Object.keys(byC).length > 1 ? ' · ' + rp(rows.reduce((s, i) => s + i.qty * i.price, 0)) : ''}\n`;
          rows.forEach((i, n) => { t += `${n + 1}. ${i.name} — ${(+i.qty).toLocaleString('id-ID')} ${i.uom || ''} × ${rp(i.price)} = ${rp(i.qty * i.price)}${i.vendor ? ' (' + i.vendor + ')' : ''}\n`; }); }
        t += `\n*TOTAL ${rp(r.total)}*${r.realisasi != null ? ` · realisasi ${rp(r.realisasi)}` : ''}${r.status === 'diajukan' ? `\nMenunggu persetujuan ${nick(r.chain[r.step])}` : ''}\n\napp.pokama.org/#/belanja?r=${r.id}`;
        await waReport(r.code, t); return; }
      if (a.dataset.a === 'nfoto') { const ps = String(a.dataset.p).slice(8).split('|').filter(Boolean); const urls = await Promise.all(ps.map(p => signedPhoto('pk-nota', p).catch(() => '')));
        await modal('Foto nota', urls.filter(Boolean).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Foto nota" style="width:100%;border-radius:12px;margin-bottom:8px"></a>`).join('') || '<p class="muted">Foto tidak bisa dibuka.</p>', { submit: null }); return; }
      const tt = a.dataset.t ? plan(r).find(x => x.id === a.dataset.t) : null;
      if (a.dataset.a === 'tcair' || a.dataset.a === 'tskip') { const skip = a.dataset.a === 'tskip';
        ok = await modal('Cairkan termin ' + tt.n + ' · ' + r.code, `<p>Rencana <b>${rp(tt.planned)}</b> (${+tt.pct}%) untuk ${esc(nick(r.created_by))}. Kalau nota termin sebelumnya lebih besar dari dana cair, kekurangannya otomatis ditambahkan.</p>` +
          field(skip ? 'Alasan cair tanpa menunggu nota (wajib)' : 'Catatan (mis. nomor transfer)', '<input name="n" class="inp">'),
          { submit: 'Sudah dicairkan', onSubmit: (f) => db.rpc('pk_rab_termin_cair', { p_termin: tt.id, p_skip: skip, p_note: f.n || null }) }); }
      else if (a.dataset.a === 'tlpj') ok = await modal('Nota termin ' + tt.n + ' · ' + r.code, `<p class="muted small" style="margin-top:0">Dana termin ini cair ${rp(tt.cair_amount)}. Isi total nota yang benar-benar terpakai.</p>` +
          field('Total nota termin ' + tt.n + ' (Rp)', `<input name="amt" class="inp" inputmode="numeric" value="${(tt.cair_amount || 0).toLocaleString('id-ID')}">`) + field('Tautan nota (Google Drive)', '<input name="link" class="inp" placeholder="https://drive.google.com/…">'),
          { submit: 'Kirim nota', onSubmit: (f) => db.rpc('pk_rab_termin_lpj', { p_termin: tt.id, p_amount: num(f.amt), p_link: (f.link || '').trim() }) });
      else if (a.dataset.a === 'tok') ok = await modal('Nota termin ' + tt.n + ' sesuai?', `<p>Nota ${rp(tt.lpj_amount)} dari cair ${rp(tt.cair_amount)}${(() => { const c = tt.cair_amount - (tt.topup_amount || 0); return tt.lpj_amount < c ? ' · sisa <b>' + rp(c - tt.lpj_amount) + '</b> wajib dikembalikan dulu ke rekening unit sebelum termin ' + (tt.n + 1) + ' cair' : tt.lpj_amount > c ? ' · kekurangan ' + rp(tt.lpj_amount - c) + ' ditambahkan di termin berikutnya' : ''; })()}.</p>`,
          { submit: 'Nota sesuai', onSubmit: () => db.rpc('pk_rab_termin_check', { p_termin: tt.id, p_ok: true }) });
      else if (a.dataset.a === 'tno') ok = await modal('Kembalikan nota termin ' + tt.n, field('Apa yang kurang', '<textarea name="n" class="inp" rows="3"></textarea>'), { submit: 'Kembalikan', onSubmit: (f) => db.rpc('pk_rab_termin_check', { p_termin: tt.id, p_ok: false, p_note: f.n }) });
      else if (a.dataset.a === 'tref') ok = await modal('Kembalikan sisa termin ' + tt.n, `<p>Transfer sisa <b>${rp(tt.refund_amount)}</b> ke rekening ${esc(unitName(r.unit_code))}, lalu tempel tautan foto bukti transfer.</p>` + field('Tautan bukti transfer (Google Drive)', `<input name="link" class="inp" placeholder="https://drive.google.com/…" value="${esc(tt.refund_link || '')}">`),
          { submit: 'Kirim bukti', onSubmit: (f) => db.rpc('pk_rab_termin_refund', { p_termin: tt.id, p_link: (f.link || '').trim() }) });
      else if (a.dataset.a === 'trefok') ok = await modal('Sisa termin ' + tt.n + ' sudah diterima?', `<p>Pastikan <b>${rp(tt.refund_amount)}</b> sudah masuk ke rekening ${esc(unitName(r.unit_code))}.${tt.refund_link ? ` <a href="${safeUrl(tt.refund_link)}" target="_blank" rel="noopener">Lihat bukti ↗</a>` : ''} Setelah ini termin ${tt.n + 1} bisa dicairkan.</p>`,
          { submit: 'Sudah diterima', onSubmit: () => db.rpc('pk_rab_termin_refund_ok', { p_termin: tt.id }) });
      else if (a.dataset.a === 'tdate') ok = await modal('Geser jadwal termin ' + tt.n, field('Tanggal cair', `<input type="date" name="d" class="inp" value="${tt.need_date || today()}">`), { submit: 'Simpan', onSubmit: (f) => db.rpc('pk_rab_termin_date', { p_termin: tt.id, p_date: f.d }) });
      else if (a.dataset.a === 'draft') { const d = drafts.find(x => x.id === a.dataset.d); ok = await rabForm(null, [], d); }
      else if (a.dataset.a === 'new') { let loc = null; try { loc = JSON.parse(localStorage.getItem('pokama.rabdraft.' + me) || 'null'); } catch (e2) {}
        if (loc && loc.payload && ((loc.payload.rows || []).length || loc.payload.title) && await confirmBox('Ada isian RAB yang belum terkirim' + (loc.payload.title ? ' ("' + loc.payload.title + '")' : '') + '. Lanjutkan isian itu?', 'Lanjutkan'))
          ok = await rabForm(null, [], { id: loc.id || null, payload: loc.payload });
        else { try { localStorage.removeItem('pokama.rabdraft.' + me); } catch (e2) {} ok = await rabForm(); } }
      else if (a.dataset.a === 'approve') { ok = await modal('Setujui ' + r.code, `<p>${esc(r.title)} · <b>${rp(r.total)}</b></p>`, { submit: 'Setujui', onSubmit: () => db.rpc('pk_rab_decide', { p_id: r.id, p_action: 'approve' }) }); }
      else if (a.dataset.a === 'revise' || a.dataset.a === 'reject') ok = await modal(a.dataset.a === 'revise' ? 'Minta revisi' : 'Tolak RAB', field(a.dataset.a === 'revise' ? 'Apa yang perlu direvisi' : 'Alasan penolakan', '<textarea name="n" class="inp" rows="3"></textarea>'),
        { submit: 'Kirim', onSubmit: (f) => db.rpc('pk_rab_decide', { p_id: r.id, p_action: a.dataset.a, p_note: f.n }) });
      else if (a.dataset.a === 'resubmit') ok = await rabForm(r, I(r.id));
      else if (a.dataset.a === 'cancel') ok = await modal('Batalkan ' + r.code, `<p>Batalkan RAB "<b>${esc(r.title)}</b>" ${rp(r.total)}? RAB tetap tercatat dengan status Dibatalkan.</p>` + field('Alasan (opsional)', '<input name="n" class="inp">'),
        { submit: 'Ya, batalkan', onSubmit: (f) => db.rpc('pk_rab_cancel', { p_id: r.id, p_note: f.n || null }) });
      else if (a.dataset.a === 'cair') ok = await modal('Cairkan ' + r.code, `<p>Transfer <b>${rp(T(r.id).length ? plan(r)[0].planned : r.total)}</b>${T(r.id).length ? ' (termin 1 dari ' + T(r.id).length + ')' : ''} ke ${esc(nick(r.created_by))} untuk "${esc(r.title)}".</p>` + field('Catatan (mis. nomor transfer)', '<input name="n" class="inp">'),
        { submit: 'Sudah dicairkan', onSubmit: (f) => db.rpc('pk_rab_cair', { p_id: r.id, p_note: f.n || null }) });
      else if (a.dataset.a === 'lpj') { document.addEventListener('modal:open', (ev) => { const fm = ev.detail;
          fm.querySelectorAll('[data-nf]').forEach(inp => inp.addEventListener('change', async () => { const key = inp.dataset.nf, out = fm.querySelector(`[name="${key}"]`), box = fm.querySelector(`[data-nt="${key}"]`);
            for (const fl of [...inp.files]) { try { const blob = await shrinkImage(fl); const path = `${me}/${r.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`; await uploadPhoto('pk-nota', path, blob);
              const cur = String(out.value || '').startsWith('pk-nota:') ? out.value.slice(8).split('|').filter(Boolean) : []; cur.push(path); out.value = 'pk-nota:' + cur.join('|'); out.readOnly = true;
              box.insertAdjacentHTML('beforeend', `<img src="${URL.createObjectURL(blob)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px">`); } catch (er) { toast('Foto gagal diunggah: ' + er.message, 'err'); } }
            inp.value = ''; })); }, { once: true });
        ok = await modal('Upload nota · ' + r.code, `<p class="muted small" style="margin-top:0">Realisasi terisi sesuai anggaran. Ubah hanya yang berbeda. Kalau semua nota ada di satu folder/foto, isi tautan bersama saja.</p>` +
        `<div class="row gap wrap" style="align-items:flex-end">` + field('Tautan nota bersama (folder Drive / album foto)', '<input name="all" class="inp" placeholder="https://drive.google.com/… atau pakai kamera">') + `<label class="btn pri" style="margin-bottom:12px">📷 Foto nota<input type="file" accept="image/*" capture="environment" multiple hidden data-nf="all"></label></div><div class="row gap6 wrap" data-nt="all"></div>` +
        `<div class="scroll-x"><table class="tbl compact"><thead><tr><th>Barang</th><th class="r">Anggaran</th><th class="r">Realisasi</th><th>Tautan nota khusus</th></tr></thead><tbody>` +
        I(r.id).map(i => `<tr><td>${esc(i.name)}<small class="muted"> · ${(+i.qty).toLocaleString('id-ID')} ${esc(i.uom || '')}</small></td><td data-l="Anggaran" class="r muted">${rp(i.qty * i.price)}</td><td data-l="Realisasi"><input name="r_${i.id}" class="inp r w-price" inputmode="numeric" value="${(i.qty * i.price).toLocaleString('id-ID')}"></td><td data-l="Nota khusus"><div class="row gap6" style="flex-wrap:nowrap"><input name="n_${i.id}" class="inp" placeholder="opsional"><label class="btn sm" title="Foto nota barang ini">📷<input type="file" accept="image/*" capture="environment" multiple hidden data-nf="n_${i.id}"></label></div><div class="row gap6 wrap" data-nt="n_${i.id}" style="margin-top:4px"></div></td></tr>`).join('') + `</tbody></table></div>`,
        { wide: true, submit: 'Kirim nota', onSubmit: (f) => { const all = (f.all || '').trim();
          const list = I(r.id).map(i => ({ id: i.id, real_amount: num(f['r_' + i.id]), nota_link: (f['n_' + i.id] || '').trim() || all || null }));
          if (!list.some(x => x.nota_link)) throw new Error('Foto nota atau isi tautan nota, minimal satu untuk semua barang');
          return db.rpc('pk_rab_lpj', { p_id: r.id, p_items: list }); } }); }
      else if (a.dataset.a === 'close') { const sisa = cairTot(r) - (r.realisasi || 0);
        ok = await modal('Tutup ' + r.code, `<p>Realisasi ${rp(r.realisasi)} dari dana cair ${rp(cairTot(r))}.</p>` + (sisa > 0 ? `<p class="note warn">Sisa <b>${rp(sisa)}</b> wajib dikembalikan ke rekening ${esc(unitName(r.unit_code))} dulu.</p><label class="row gap6"><input type="checkbox" name="ref" value="1"> Sisa ${rp(sisa)} sudah diterima di rekening unit</label>` : '') + field('Catatan', '<input name="n" class="inp">'),
          { submit: 'Selesai', onSubmit: (f) => { if (sisa > 0 && !f.ref) throw new Error('Centang dulu setelah sisa dana diterima'); return db.rpc('pk_rab_close', { p_id: r.id, p_note: f.n || null, p_refunded: !!f.ref }); } }); }
      if (ok) { toast('Tersimpan'); reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };

  async function rabForm(r = null, its = [], dft = null) {
    const D = dft ? dft.payload || {} : null; if (D && !its.length) its = D.rows || [];
    const isLeader = ['leader', 'kepala_staf', 'ceo'].includes(ctx.me.role);
    const mine = rabs.filter(x => x.created_by === me && (!r || x.id !== r.id)).slice(0, 30);
    const cats = [...new Set(items.map(i => i.category).filter(Boolean).concat(CATS))];
    const body = (r ? `<p class="note err">${esc(r.note || '')}</p>` : '') +
      `<div class="g2">` + field('Dibayar dari', `<select name="unit" class="inp"${r ? ' disabled' : ''}>${unitOpts(r ? r.unit_code : D && D.unit || ctx.me.unit_code)}</select>`, 'Unit yang mencairkan dana. Barang untuk cabang/unit lain dipilih per baris di kolom "Untuk".') +
      field('Jenis', `<select name="kind" class="inp"${r ? ' disabled' : ''}>${opts(Object.entries(KIND), r ? r.kind : D && D.kind || 'op')}</select>`) + `</div>` +
      field('Untuk apa', `<input name="title" class="inp" value="${esc(r ? r.title : D && D.title || '')}" placeholder="Misalnya: Restock perlengkapan trip Kebon November">`) +
      field('Tujuan & alasan (opsional)', `<textarea name="desc" class="inp" rows="2" placeholder="Kenapa perlu dibeli sekarang, dipakai untuk apa, dampaknya ke unit">${esc(r ? r.description || '' : D && D.desc || '')}</textarea>`) +
      `<div class="rab-tools row gap wrap"><b class="lab" style="flex:1">RINCIAN BARANG</b>${mine.length ? `<select class="inp sm" id="rab-copy"><option value="">Salin dari RAB lama…</option>${mine.map(x => `<option value="${x.id}">${esc(x.code)} · ${esc(x.title)}</option>`).join('')}</select>` : ''}<button type="button" class="btn sm" data-paste>Tempel dari Excel / Sheet</button></div>
      <div class="rab-paste" hidden><textarea class="inp mono" rows="5" id="rab-paste-t" placeholder="Salin baris dari Excel/Google Sheet lalu tempel di sini. Urutan kolom: Barang · Qty · Satuan · Harga · Kategori · Toko · Untuk (cabang/unit, opsional)\nBan dalam\t6\tpcs\t45000\tSparepart\tToko Jaya"></textarea><div class="row gap"><button type="button" class="btn sm pri" data-paste-go>Masukkan ke tabel</button><span class="muted small">Kolom dipisah tab (hasil copy dari spreadsheet) atau koma. Baris judul dilewati otomatis.</span></div></div>
      <datalist id="rab-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="rab-ed scroll-x"><table class="tbl compact"><thead><tr><th>#</th><th>Barang / jasa</th><th>Untuk (cabang/unit)</th><th class="r">Qty</th><th>Satuan</th><th class="r">Harga satuan</th><th class="r">Subtotal</th><th>Kategori</th><th>Toko / vendor</th><th></th></tr></thead><tbody id="rab-body"></tbody></table></div>
      <div class="row gap"><button type="button" class="btn sm" data-add="1">+ Baris</button><button type="button" class="btn sm" data-add="5">+ 5 baris</button><span class="muted small">Tab / Enter untuk pindah kolom. Baris kosong diabaikan.</span></div>
      <div class="rab-sum" id="rab-sum"></div>` +
      `<details class="termin-ed" ${(r && T(r.id).length) || (D && D.termin_on) ? 'open' : ''}><summary><b class="lab">CAIR BERTAHAP (OPSIONAL)</b> <span class="muted small">· dana dicairkan per termin, termin berikutnya cair setelah nota termin sebelumnya dicek Keuangan</span></summary>
        <label class="chk" style="margin:8px 0"><input type="checkbox" name="termin_on" ${(r && T(r.id).length) || (D && D.termin_on) ? 'checked' : ''}> Cairkan bertahap</label>
        <div class="scroll-x"><table class="tbl compact"><thead><tr><th>Termin</th><th class="r">%</th><th>Jadwal cair</th><th>Untuk apa</th></tr></thead><tbody id="termin-body">
        ${(r && T(r.id).length ? T(r.id) : D && D.terms && D.terms.length ? D.terms : [{ pct: 30 }, { pct: 40 }, { pct: 30 }]).concat([{}, {}, {}]).slice(0, 6).map((t, i) => `<tr><td class="muted">${i + 1}</td><td><input class="inp r w-qty" name="tp_${i}" inputmode="decimal" value="${t.pct != null ? +t.pct : ''}"></td><td><input type="date" class="inp" name="td_${i}" value="${t.need_date || ''}"></td><td><input class="inp" name="tn_${i}" value="${esc(t.note || '')}" placeholder="${['DP vendor', 'Material datang', 'Pelunasan', '', '', ''][i]}"></td></tr>`).join('')}
        </tbody></table></div><small class="muted" id="termin-sum">Isi 2–6 termin, total 100%. Baris kosong diabaikan.</small></details>` +
      (r ? '' : `<div class="g2">` + field('Dibutuhkan tanggal', `<input type="date" name="need" class="inp" value="${D && D.need || addDays(today(), 3)}">`) +
      `<div class="stack">${isLeader ? `<label class="chk"><input type="checkbox" name="crew"> Dari crew cabang (diteruskan Leader)</label>` : ''}${isLeader || ctx.me.role === 'keuangan' ? '<label class="chk"><input type="checkbox" name="emg"> Pakai dana darurat (mendadak)</label>' : ''}</div></div>`);
    const LK = 'pokama.rabdraft.' + me; let did = dft ? dft.id : null, sent = false, dirty = false;
    const state = (form) => { const f = Object.fromEntries(new FormData(form)); const rows = edRead(form);
      return { unit: f.unit, kind: f.kind, title: f.title || '', desc: f.desc || '', need: f.need || '', termin_on: !!f.termin_on, rows,
        terms: [0, 1, 2, 3, 4, 5].map(i => ({ pct: f['tp_' + i] ? +String(f['tp_' + i]).replace(',', '.') : null, need_date: f['td_' + i] || null, note: f['tn_' + i] || '' })).filter(t => t.pct) }; };
    const saveDraft = async (form) => { const st = state(form); const tot = st.rows.reduce((a, x) => a + x.qty * x.price, 0);
      const row = { title: st.title || 'RAB tanpa judul', payload: st, total: tot, updated_at: new Date().toISOString() };
      if (did) await db.update('pk_rab_drafts', 'id=eq.' + did, row); else { const x = await db.insert('pk_rab_drafts', row); did = (Array.isArray(x) ? x[0] : x || {}).id; }
      try { localStorage.removeItem(LK); } catch (e) {} };
    const onOpen = (ev) => { document.removeEventListener('modal:open', onOpen); const form = ev.detail; edInit(form, its.length ? its : [], (id) => I(id));
      if (!r) { let t0 = 0; form.addEventListener('input', () => { dirty = true; clearTimeout(t0); t0 = setTimeout(() => { if (sent) return; try { localStorage.setItem(LK, JSON.stringify({ at: Date.now(), id: did, payload: state(form) })); } catch (e) {} }, 400); }); } };
    document.addEventListener('modal:open', onOpen);
    const res0 = await modal(r ? 'Revisi ' + r.code : dft ? 'Lanjutkan draft' : 'Ajukan RAB baru', body,
      { wide: true, sticky: true, submit: r ? 'Ajukan ulang' : 'Kirim RAB',
        extra: r ? null : { label: 'Simpan draft', onClick: async (f, form) => { await saveDraft(form); sent = true; toast('Draft tersimpan · lanjutkan dari tab RAB saya'); return 'draft'; } },
        beforeClose: async (form) => { if (r || sent || !dirty) return true;
          if (await confirmBox('Simpan isian RAB ini sebagai draft?', 'Simpan draft')) { await saveDraft(form); sent = true; toast('Draft tersimpan'); }
          return true; },
        onSubmit: async (f, form) => {
        const list = edRead(form); need(f.title, 'Isi untuk apa belanjanya');
        const bad = list.find(x => !(x.qty > 0)); if (bad) throw new Error(`Baris "${bad.name}": isi jumlah`);
        if (!list.length) throw new Error('Isi minimal satu barang beserta jumlah dan harganya');
        const tplan = !f.termin_on ? [] : [0, 1, 2, 3, 4, 5].map(i => ({ pct: +String(f['tp_' + i] || '').replace(',', '.') || 0, need_date: f['td_' + i] || null, note: (f['tn_' + i] || '').trim() || null })).filter(t => t.pct > 0);
        if (f.termin_on) { const sp = tplan.reduce((s, t) => s + t.pct, 0); if (tplan.length < 2) throw new Error('Cair bertahap: isi minimal 2 termin'); if (Math.abs(sp - 100) > 0.001) throw new Error('Cair bertahap: jumlah persentase harus 100% (sekarang ' + sp + '%)'); }
        if (r) { await db.rpc('pk_rab_resubmit', { p_id: r.id, p_title: f.title, p_items: list });
          if (tplan.length || T(r.id).length) await db.rpc('pk_rab_termin_set', { p_id: r.id, p_plan: tplan }); if ((f.desc || '') !== (r.description || '')) await db.rpc('pk_rab_describe', { p_id: r.id, p_desc: f.desc || null }); }
        else { const res = await db.rpc('pk_rab_submit', { p_unit: f.unit, p_kind: f.kind, p_title: f.title, p_need: f.need || null, p_items: list, p_emergency: !!f.emg, p_via_app: !!f.crew, p_for: null });
          if ((f.desc || '').trim()) await db.rpc('pk_rab_describe', { p_id: res.id, p_desc: f.desc.trim() });
          if (tplan.length) await db.rpc('pk_rab_termin_set', { p_id: res.id, p_plan: tplan });
          if (list.some(x => x.unit_code && x.unit_code !== f.unit)) db.rpc('pk_rab_notify_units', { p_id: res.id }).catch(() => {});
          sent = true; try { localStorage.removeItem(LK); } catch (e) {} if (did) await db.remove('pk_rab_drafts', 'id=eq.' + did).catch(() => {}); toast(res.code + ' terkirim · ' + list.length + ' barang'); }
      } });
    return res0;
  }
}
// alur persetujuan: Valuer 1 → Valuer 2 (tanpa valuer: atasan langsung), lalu Keuangan mencairkan
function myChain() {
  const p = ctx.byId[ctx.me.id] || {}; let c = [p.valuer1_id, p.valuer2_id].filter((x, i, a) => x && x !== p.id && a.indexOf(x) === i && ctx.byId[x]);
  if (!c.length && p.role !== 'ceo') { const ks = (ctx.people.find(x => x.role === 'kepala_staf') || {}).id, ceo = (ctx.people.find(x => x.role === 'ceo') || {}).id; const f = [p.boss_id, ks, ceo].find(x => x && x !== p.id); if (f) c = [f]; }
  return c.map(nick);
}
const CATS = ['Bahan & perlengkapan', 'Sparepart & perawatan', 'Konsumsi', 'Transport & ongkir', 'Marketing & cetak', 'Jasa & tenaga', 'ATK & kantor', 'Lain-lain'];
const fmtN = (v) => v === '' || v == null || isNaN(v) ? '' : (+v).toLocaleString('id-ID');
function edRow(x = {}) {
  return `<tr><td class="muted n"></td><td data-l="Barang"><input class="inp" data-k="name" value="${esc(x.name || '')}" placeholder="Nama barang"></td>
    <td data-l="Untuk"><select class="inp w-unit" data-k="unit_code"><option value="">ikut pembayar</option>${unitOpts(x.unit_code || '')}</select></td>
    <td data-l="Qty"><input class="inp r w-qty" data-k="qty" inputmode="decimal" value="${+x.qty ? fmtN(+x.qty) : ''}"></td><td data-l="Satuan"><input class="inp w-uom" data-k="uom" value="${esc(x.uom || '')}" placeholder="pcs"></td>
    <td data-l="Harga satuan"><input class="inp r w-price" data-k="price" inputmode="numeric" value="${+x.price ? fmtN(+x.price) : ''}"></td><td data-l="Subtotal" class="r b sub">—</td>
    <td data-l="Kategori"><input class="inp w-cat" data-k="category" list="rab-cats" value="${esc(x.category || '')}" placeholder="kategori"></td><td data-l="Toko"><input class="inp w-ven" data-k="vendor" value="${esc(x.vendor || '')}" placeholder="toko"></td>
    <td class="dl"><button type="button" class="x" data-del title="Hapus baris">×</button></td></tr>`;
}
function edRead(form) {
  return [...form.querySelectorAll('#rab-body tr')].map(tr => { const g = (k) => (tr.querySelector(`[data-k="${k}"]`).value || '').trim();
    return { name: g('name'), qty: +g('qty').replace(/\./g, '').replace(',', '.') || 0, price: num(g('price')) || 0, uom: g('uom') || null, category: g('category') || null, vendor: g('vendor') || null, unit_code: g('unit_code') || null }; })
    .filter(x => x.name);
}
function edInit(form, its, itemsOf) {
  const body = form.querySelector('#rab-body');
  const add = (rows) => { body.insertAdjacentHTML('beforeend', rows.map(edRow).join('')); calc(); };
  const calc = () => {
    [...body.querySelectorAll('tr')].forEach((tr, i) => { tr.querySelector('.n').textContent = i + 1; const q = +(tr.querySelector('[data-k=qty]').value || '').replace(/\./g, '').replace(',', '.') || 0; const p = num(tr.querySelector('[data-k=price]').value) || 0; tr.querySelector('.sub').textContent = q && p ? rp(q * p) : '—'; });
    const list = edRead(form); const tot = list.reduce((s, x) => s + x.qty * x.price, 0);
    const byCat = {}; list.forEach(x => { const k = x.category || 'Tanpa kategori'; byCat[k] = (byCat[k] || 0) + x.qty * x.price; });
    const chain = myChain(); const hu = (form.querySelector('[name=unit]') || {}).value;
    const byBiz = {}, byBr = {}; list.forEach(x => { const u = x.unit_code || hu; const b = bizOf(u); byBiz[b] = (byBiz[b] || 0) + x.qty * x.price; const un = ctx.unit[u]; if (un && un.kind === 'lini') byBr[u] = (byBr[u] || 0) + x.qty * x.price; });
    form.querySelector('#rab-sum').innerHTML = list.length ? `<div class="row between"><span><b>${list.length}</b> barang · disetujui: ${esc(chain.join(' → ') || 'langsung ke Keuangan')}</span><b class="big">${rp(tot)}</b></div>
      ${Object.keys(byBiz).length > 1 || Object.keys(byBr).length ? `<div class="rab-cats"><b class="small">Per unit bisnis</b> ${Object.entries(byBiz).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span>${logo(k, 14)} <span class="muted">${esc(unitName(k))}</span> <b>${jt(v)}</b></span>`).join('')}${Object.keys(byBr).length ? ` <b class="small">· Per cabang</b> ${Object.entries(byBr).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><span class="muted">${esc(unitName(k))}</span> <b>${jt(v)}</b></span>`).join('')}` : ''}</div>` : ''}
      ${Object.keys(byCat).length > 1 ? `<div class="rab-cats">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><span class="muted">${esc(k)}</span> <b>${jt(v)}</b></span>`).join('')}</div>` : ''}` : '<span class="muted">Isi rincian, total dan jalur persetujuan dihitung otomatis.</span>';
  };
  add(its.length ? its : [{}, {}, {}]);
  form.addEventListener('input', (e) => { if (e.target.closest('#rab-body')) calc(); });
  form.addEventListener('change', (e) => { if (e.target.closest('#rab-body') || e.target.name === 'unit') calc(); });
  form.addEventListener('focusout', (e) => { const k = e.target.dataset && e.target.dataset.k; if (k === 'price' && e.target.value) e.target.value = fmtN(num(e.target.value)); });
  form.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || !e.target.closest('#rab-body')) return; e.preventDefault();
    const tr = e.target.closest('tr'); let nx = tr.nextElementSibling; if (!nx) { add([{}]); nx = tr.nextElementSibling; } nx.querySelector(`[data-k="${e.target.dataset.k}"]`).focus(); });
  form.addEventListener('click', (e) => {
    const ad = e.target.closest('[data-add]'); if (ad) { add([...Array(+ad.dataset.add)].map(() => ({}))); return; }
    const dl = e.target.closest('[data-del]'); if (dl) { dl.closest('tr').remove(); if (!body.children.length) add([{}]); calc(); return; }
    if (e.target.closest('[data-paste]')) { const p = form.querySelector('.rab-paste'); p.hidden = !p.hidden; if (!p.hidden) form.querySelector('#rab-paste-t').focus(); return; }
    if (e.target.closest('[data-paste-go]')) { const rows = parsePaste(form.querySelector('#rab-paste-t').value); if (!rows.length) return toast('Tidak ada baris yang terbaca', 'err');
      [...body.querySelectorAll('tr')].filter(tr => !tr.querySelector('[data-k=name]').value.trim()).forEach(tr => tr.remove()); add(rows);
      form.querySelector('#rab-paste-t').value = ''; form.querySelector('.rab-paste').hidden = true; toast(rows.length + ' baris dimasukkan'); }
  });
  const cp = form.querySelector('#rab-copy'); if (cp) cp.addEventListener('change', () => { if (!cp.value) return; const src = itemsOf(cp.value);
    [...body.querySelectorAll('tr')].filter(tr => !tr.querySelector('[data-k=name]').value.trim()).forEach(tr => tr.remove()); add(src.map(i => ({ name: i.name, qty: +i.qty, uom: i.uom, price: +i.price, category: i.category, vendor: i.vendor, unit_code: i.unit_code })));
    const t = form.querySelector('[name=title]'); const r0 = cp.options[cp.selectedIndex].text.split(' · ').slice(1).join(' · '); if (!t.value) t.value = r0; cp.value = ''; toast(src.length + ' barang disalin'); });
}
function unitFrom(v) { const q = String(v || '').trim().toLowerCase(); if (!q) return null;
  const u = ctx.units.find(x => x.code.toLowerCase() === q || x.name.toLowerCase() === q) || ctx.units.find(x => x.name.toLowerCase().includes(q) || q.includes(x.name.toLowerCase())); return u ? u.code : null; }
function parsePaste(t) {
  return String(t || '').split(/\r?\n/).map(l => (l.includes('\t') ? l.split('\t') : l.split(',')).map(s => s.trim())).filter(p => p[0] && p.length >= 2)
    .map(p => { const nums = p.map(x => num(x)); // Barang · Qty · Satuan · Harga · Kategori · Toko, atau Barang · Qty · Harga
      if (p.length <= 3) return { name: p[0], qty: +p[1].replace(',', '.') || 0, price: nums[2] || 0, category: p[3] || '', vendor: p[4] || '' };
      return { name: p[0], qty: +p[1].replace(',', '.') || 0, uom: p[2] || '', price: nums[3] || 0, category: p[4] || '', vendor: p[5] || '', unit_code: unitFrom(p[6]) }; })
    .filter(x => x.qty > 0 || x.price > 0);
}

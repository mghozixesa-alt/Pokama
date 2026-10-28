import { safeUrl, ctx, db, esc, today, addDays, fdate, ftime, avatar, nick, modal, field, opts, toast, unitName, unitOpts, isFin, isCeo, need, chip, logo, rp, jt, num, bizOf } from '../core.js';

const ST = { diajukan: ['Menunggu persetujuan', 'yellow', '#D99A00'], revisi: ['Diminta revisi', 'gray', '#8A94A3'], ditolak: ['Ditolak', 'gray', '#8A94A3'],
  siap_cair: ['Siap dicairkan', 'blue', '#2F6FDB'], cair: ['Dana cair · tunggu nota', 'red', '#C2410C'], lpj: ['Nota masuk · dicek Keuangan', 'blue', '#2F6FDB'], selesai: ['Selesai', 'green', '#09BEAF'], batal: ['Dibatalkan', 'gray', '#A9B4C2'] };
const KIND = { op: 'Kebutuhan operasional', mt: 'Maintenance produk/aset' };

export default async function belanja(el, params, reload) {
  const me = ctx.me.id;
  const [rabs, items, log] = await Promise.all([
    db.get('pk_rab', 'select=*&order=created_at.desc&limit=400'),
    db.get('pk_rab_items', 'select=*&active=eq.true&order=sort'),
    db.get('pk_rab_log', 'select=*&order=at.desc&limit=600'),
  ]);
  const I = (id) => items.filter(i => i.rab_id === id); const L = (id) => log.filter(l => l.rab_id === id);
  const lpjDays = +ctx.settings.lpj_days || 2;
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
  const l1 = +ctx.settings.rab_limit_atasan || 1e6, l2 = +ctx.settings.rab_limit_kepala_staf || 5e6;
  const biz = ctx.units.filter(u => u.kind !== 'lini');
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Belanja pakai uang perusahaan: ajukan RAB, belanja, lalu upload nota (LPJ)</span><h1>Pengajuan Belanja</h1></div>
    <button class="btn pri" data-a="new">+ Ajukan RAB</button></header>
  <ol class="steps"><li><b>1</b><span><strong>Ajukan RAB</strong><small>rincian barang & harga</small></span></li><li><b>2</b><span><strong>Disetujui</strong><small>berjenjang sesuai nominal</small></span></li><li><b>3</b><span><strong>Dana cair</strong><small>Keuangan, ${esc((ctx.settings.cair_days || []).join(' & '))} ${esc(ctx.settings.cair_time || '')}</small></span></li><li><b>4</b><span><strong>Upload nota</strong><small>≤ ${lpjDays} hari setelah belanja</small></span></li><li><b class="t">5</b><span><strong>Selesai</strong><small>sisa dana kembali ke unit</small></span></li></ol>
  <div class="tiles"><div class="tile"><span>Menunggu persetujuan</span><b>${rabs.filter(r => r.status === 'diajukan').length}</b><small>${rp(rabs.filter(r => r.status === 'diajukan').reduce((s, r) => s + r.total, 0))}</small></div>
    <div class="tile"><span>Siap dicairkan</span><b>${rabs.filter(r => r.status === 'siap_cair').length}</b><small>${rp(rabs.filter(r => r.status === 'siap_cair').reduce((s, r) => s + r.total, 0))}</small></div>
    <div class="tile"><span>Nota terlambat</span><b class="red">${rabs.filter(lateLpj).length}</b><small>RAB berikutnya unit itu ditahan</small></div>
    <div class="tile"><span>Belanja bulan ini</span><b>${jt(spent)}</b></div></div>
  <div class="chips">${tabs.map(([k, l]) => `<a class="chipbtn${tab === k ? ' on' : ''}" href="#/belanja?tab=${k}&u=${scope}">${l} (${sets[k].length})</a>`).join('')}<span style="flex:1"></span>
    ${[['ALL', 'Semua unit']].concat(biz.map(u => [u.code, u.name])).map(([k, l]) => `<a class="chipbtn sm${scope === k ? ' on' : ''}" href="#/belanja?tab=${tab}&u=${k}">${k !== 'ALL' ? logo(k, 16) : ''}${esc(l)}</a>`).join('')}</div>
  <div class="split${params.get('r') ? ' picked' : ''}">
    <div class="stack">${list.map(r => `<a class="card item${sel && sel.id === r.id ? ' sel' : ''}" style="box-shadow:inset 4px 0 0 ${ST[r.status][2]}" href="#/belanja?tab=${tab}&u=${scope}&r=${r.id}">
      <span class="row between small"><span class="row gap6 b">${logo(r.unit_code, 18)}${esc(unitName(r.unit_code))} · ${esc(r.code)}</span><span class="muted">${ftime(r.created_at)}</span></span>
      <span class="row between"><b>${esc(r.title)}</b><b>${rp(r.total)}</b></span>
      <span class="row between small"><span class="muted">Diajukan ${esc(nick(r.created_by))}${r.via_app ? ' · dari crew' : ''}</span>${chip(r.status === 'diajukan' ? 'Menunggu ' + nick(r.chain[r.step]) : lateLpj(r) ? 'Nota terlambat' : ST[r.status][0], lateLpj(r) ? 'red' : ST[r.status][1])}</span></a>`).join('') || '<div class="card empty-state"><p class="muted">Tidak ada RAB di sini.</p></div>'}</div>
    <div>${sel ? `<a class="m-only back" href="#/belanja?tab=${tab}&u=${scope}">‹ Kembali ke daftar</a>` + detail(sel) : ''}</div>
  </div>
  <details class="card rules"><summary><h2>Aturan belanja</h2></summary><div class="kv">
    <div><span>Sampai ${jt(l1)}</span><b>Atasan langsung</b></div><div><span>${jt(l1)}–${jt(l2)}</span><b>+ Kepala Staf</b></div><div><span>Di atas ${jt(l2)}</span><b>+ CEO</b></div>
    <div><span>RAB dari Leader</span><b>Kepala Staf (+ CEO di atas ${jt(l2)})</b></div><div><span>Dana cair</span><b>${esc((ctx.settings.cair_days || []).join(' & '))} ${esc(ctx.settings.cair_time || '')}</b></div><div><span>Nota</span><b>≤ ${lpjDays} hari; telat = RAB berikutnya ditahan</b></div>
    <div><span>Crew cabang</span><b>Ajukan lewat Leader / Rentalaja App</b></div><div><span>Barang ≥ Rp500 rb</span><b>Masuk daftar aset unit</b></div></div></details>`;

  function detail(r) {
    const its = I(r.id); const lg = L(r.id).slice().reverse();
    const steps = [['Diajukan ' + nick(r.created_by), true, ftime(r.created_at)]].concat(r.chain.map((p, i) => ['Disetujui ' + nick(p), r.step > i || ['siap_cair', 'cair', 'lpj', 'selesai'].includes(r.status), '']))
      .concat([['Dana dicairkan Keuangan', ['cair', 'lpj', 'selesai'].includes(r.status), r.cair_at ? ftime(r.cair_at) : ''], ['Nota diupload (LPJ)', ['lpj', 'selesai'].includes(r.status), r.lpj_at ? ftime(r.lpj_at) : ''], ['Dicek Keuangan · selesai', r.status === 'selesai', r.done_at ? ftime(r.done_at) : '']]);
    const stopped = ['revisi', 'ditolak', 'batal'].includes(r.status);
    const curIdx = steps.findIndex(s => !s[1]);
    const ai = [];
    if (r.total > l2) ai.push('Di atas ' + jt(l2) + ': perlu persetujuan CEO.');
    const same = rabs.filter(x => x.id !== r.id && x.unit_code === r.unit_code && x.status === 'selesai').slice(0, 1);
    if (same.length) ai.push('RAB terakhir unit ini: ' + same[0].code + ' ' + rp(same[0].total) + (same[0].realisasi ? ', realisasi ' + rp(same[0].realisasi) : '') + '.');
    if (lateLpj(r)) ai.push('Nota sudah lewat ' + lpjDays + ' hari. RAB baru unit ini ditahan sampai nota masuk.');
    return `<section class="card sticky-top">
      <span class="row gap6 small b">${logo(r.unit_code, 22)}${esc(unitName(r.unit_code))} · ${esc(r.code)} · ${KIND[r.kind]}</span>
      <div class="row between"><h2>${esc(r.title)}</h2>${chip(ST[r.status][0], ST[r.status][1])}</div>
      <span class="small muted">Disusun ${esc(nick(r.created_by))} · dibutuhkan ${fdate(r.need_date)}${r.is_emergency ? ' · dana darurat' : ''}</span>
      <div class="scroll-x"><table class="tbl compact"><thead><tr><th>Uraian</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Total</th><th class="r">Realisasi</th></tr></thead><tbody>
        ${its.map(i => `<tr><td>${esc(i.name)}${i.nota_link ? ` <a href="${safeUrl(i.nota_link)}" target="_blank" rel="noopener" class="small">nota ↗</a>` : ''}</td><td class="r">${(+i.qty).toLocaleString('id-ID')}</td><td class="r">${rp(i.price)}</td><td class="r b">${rp(i.qty * i.price)}</td><td class="r">${i.real_amount != null ? rp(i.real_amount) : '—'}</td></tr>`).join('')}
        <tr class="tot"><td>Total</td><td></td><td></td><td class="r">${rp(r.total)}</td><td class="r">${r.realisasi != null ? rp(r.realisasi) : '—'}</td></tr></tbody></table></div>
      ${r.realisasi != null ? `<p class="note">${r.realisasi <= r.total ? 'Sisa dana ' + rp(r.total - r.realisasi) + ' dikembalikan ke rekening unit.' : 'Kurang ' + rp(r.realisasi - r.total) + ', ajukan sebagai RAB tambahan.'}</p>` : ''}
      ${ai.length ? `<div class="note warn"><b class="small">CEK OTOMATIS</b><ul>${ai.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${r.note ? `<p class="note err">${esc(r.note)}</p>` : ''}
      <h3>Perjalanan RAB</h3><ol class="journey">${steps.map((s, i) => `<li class="${s[1] ? 'done' : stopped && i === curIdx ? 'stop' : i === curIdx ? 'cur' : ''}"><b>${s[1] ? '✓' : stopped && i === curIdx ? '×' : i + 1}</b><span>${esc(s[0])}<small>${esc(s[2])}</small></span></li>`).join('')}</ol>
      <div class="row gap wrap">
        ${myTurn(r) || (isCeo() && r.status === 'diajukan' && r.created_by !== me) ? `<button class="btn pri" data-a="approve">${myTurn(r) ? 'Setujui' : 'Setujui langsung (CEO)'}</button><button class="btn" data-a="revise">Minta revisi</button><button class="btn danger" data-a="reject">Tolak</button>` : ''}
        ${r.status === 'revisi' && r.created_by === me ? `<button class="btn pri" data-a="resubmit">Revisi & ajukan ulang</button>` : ''}
        ${r.status === 'siap_cair' && isFin() ? `<button class="btn pri" data-a="cair">Tandai dana sudah dicairkan</button>` : ''}
        ${['diajukan', 'revisi', 'siap_cair'].includes(r.status) && (r.created_by === me || isCeo()) ? `<button class="btn danger" data-a="cancel">Batalkan RAB</button>` : ''}
        ${r.status === 'cair' && (r.created_by === me || isFin()) ? `<button class="btn pri" data-a="lpj">Upload nota (LPJ)</button>` : ''}
        ${r.status === 'lpj' && isFin() ? `<button class="btn pri" data-a="close">Nota sesuai · selesai</button>` : ''}
      </div>
      <details><summary class="small muted">Riwayat</summary><ul class="log">${lg.map(l => `<li><b>${esc(nick(l.actor_id))}</b> ${esc(l.action)}${l.note ? ' · ' + esc(l.note) : ''} <small class="muted">${ftime(l.at)}</small></li>`).join('')}</ul></details>
    </section>`;
  }

  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return; const r = sel;
    try {
      let ok = null;
      if (a.dataset.a === 'new') ok = await rabForm();
      else if (a.dataset.a === 'approve') { ok = await modal('Setujui ' + r.code, `<p>${esc(r.title)} · <b>${rp(r.total)}</b></p>`, { submit: 'Setujui', onSubmit: () => db.rpc('pk_rab_decide', { p_id: r.id, p_action: 'approve' }) }); }
      else if (a.dataset.a === 'revise' || a.dataset.a === 'reject') ok = await modal(a.dataset.a === 'revise' ? 'Minta revisi' : 'Tolak RAB', field(a.dataset.a === 'revise' ? 'Apa yang perlu direvisi' : 'Alasan penolakan', '<textarea name="n" class="inp" rows="3"></textarea>'),
        { submit: 'Kirim', onSubmit: (f) => db.rpc('pk_rab_decide', { p_id: r.id, p_action: a.dataset.a, p_note: f.n }) });
      else if (a.dataset.a === 'resubmit') ok = await rabForm(r, I(r.id));
      else if (a.dataset.a === 'cancel') ok = await modal('Batalkan ' + r.code, `<p>Batalkan RAB "<b>${esc(r.title)}</b>" ${rp(r.total)}? RAB tetap tercatat dengan status Dibatalkan.</p>` + field('Alasan (opsional)', '<input name="n" class="inp">'),
        { submit: 'Ya, batalkan', onSubmit: (f) => db.rpc('pk_rab_cancel', { p_id: r.id, p_note: f.n || null }) });
      else if (a.dataset.a === 'cair') ok = await modal('Cairkan ' + r.code, `<p>Transfer <b>${rp(r.total)}</b> ke ${esc(nick(r.created_by))} untuk "${esc(r.title)}".</p>` + field('Catatan (mis. nomor transfer)', '<input name="n" class="inp">'),
        { submit: 'Sudah dicairkan', onSubmit: (f) => db.rpc('pk_rab_cair', { p_id: r.id, p_note: f.n || null }) });
      else if (a.dataset.a === 'lpj') ok = await modal('Upload nota · ' + r.code, `<p class="muted small">Isi realisasi per barang dan tautan foto nota (Google Drive/Foto).</p>` +
        I(r.id).map(i => `<div class="g3"><b class="small">${esc(i.name)}<br><span class="muted">anggaran ${rp(i.qty * i.price)}</span></b>${field('Realisasi', `<input name="r_${i.id}" class="inp" inputmode="numeric" value="${i.qty * i.price}">`)}${field('Tautan nota', `<input name="n_${i.id}" class="inp" placeholder="https://…">`)}</div>`).join(''),
        { wide: true, submit: 'Kirim nota', onSubmit: (f) => db.rpc('pk_rab_lpj', { p_id: r.id, p_items: I(r.id).map(i => ({ id: i.id, real_amount: num(f['r_' + i.id]), nota_link: (f['n_' + i.id] || '').trim() || null })) }) });
      else if (a.dataset.a === 'close') ok = await modal('Tutup ' + r.code, `<p>Realisasi ${rp(r.realisasi)} dari ${rp(r.total)}.</p>` + field('Catatan', '<input name="n" class="inp">'), { submit: 'Selesai', onSubmit: (f) => db.rpc('pk_rab_close', { p_id: r.id, p_note: f.n || null }) });
      if (ok) { toast('Tersimpan'); reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };

  async function rabForm(r = null, its = []) {
    const rows = its.length ? its.map(i => `${i.name}, ${+i.qty}, ${i.price}`).join('\n') : '';
    const isLeader = ['leader', 'kepala_staf', 'ceo'].includes(ctx.me.role);
    return modal(r ? 'Revisi ' + r.code : 'Ajukan RAB baru',
      (r ? `<p class="note err">${esc(r.note || '')}</p>` : '') +
      `<div class="g2">` + field('Unit', `<select name="unit" class="inp"${r ? ' disabled' : ''}>${unitOpts(r ? r.unit_code : ctx.me.unit_code)}</select>`) +
      field('Jenis', `<select name="kind" class="inp"${r ? ' disabled' : ''}>${opts(Object.entries(KIND), r ? r.kind : 'op')}</select>`) + `</div>` +
      field('Untuk apa', `<input name="title" class="inp" value="${esc(r ? r.title : '')}" placeholder="Misalnya: Ban dalam dan oli 6 motor Garut Kota">`) +
      field('Rincian · satu baris satu barang: nama, jumlah, harga', `<textarea name="rows" class="inp mono" rows="5" id="rab-rows" placeholder="Ban dalam, 6, 45000\nOli mesin, 6, 65000">${esc(rows)}</textarea>`) +
      `<p class="note" id="rab-sum">Isi rincian, total dan jalur persetujuan dihitung otomatis.</p>` +
      (r ? '' : `<div class="g2">` + field('Dibutuhkan tanggal', `<input type="date" name="need" class="inp" value="${addDays(today(), 3)}">`) +
      `<div class="stack">${isLeader ? `<label class="chk"><input type="checkbox" name="crew"> Dari crew cabang (diteruskan Leader)</label>` : ''}${isLeader || ctx.me.role === 'keuangan' ? '<label class="chk"><input type="checkbox" name="emg"> Pakai dana darurat (mendadak)</label>' : ''}</div></div>`),
      { wide: true, submit: r ? 'Ajukan ulang' : 'Kirim RAB', onSubmit: async (f) => {
        const items = parseRows(f.rows); need(f.title, 'Isi untuk apa belanjanya'); if (!items.length) throw new Error('Isi minimal satu barang: nama, jumlah, harga');
        if (r) await db.rpc('pk_rab_resubmit', { p_id: r.id, p_title: f.title, p_items: items });
        else { const res = await db.rpc('pk_rab_submit', { p_unit: f.unit, p_kind: f.kind, p_title: f.title, p_need: f.need || null, p_items: items, p_emergency: !!f.emg, p_via_app: !!f.crew, p_for: null }); toast(res.code + ' terkirim'); }
      } });
  }
}
function parseRows(t) {
  return String(t || '').split('\n').map(l => l.split(',').map(s => s.trim())).filter(p => p.length >= 3 && p[0])
    .map(p => ({ name: p.slice(0, p.length - 2).join(', '), qty: +p[p.length - 2].replace(',', '.') || 0, price: num(p[p.length - 1]) })).filter(x => x.qty > 0 && x.price >= 0);
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'rab-rows') return; const it = parseRows(e.target.value); const tot = it.reduce((s, x) => s + x.qty * x.price, 0);
  const l1 = +ctx.settings.rab_limit_atasan || 1e6, l2 = +ctx.settings.rab_limit_kepala_staf || 5e6; const role = ctx.me.role;
  const chain = role === 'ceo' ? [] : ['leader', 'keuangan'].includes(role) ? ['Kepala Staf'] : role === 'kepala_staf' ? ['CEO'] : [nick(ctx.me.boss_id)].concat(tot > l1 ? ['Kepala Staf'] : []);
  if (tot > l2 && role !== 'kepala_staf' && role !== 'ceo') chain.push('CEO');
  const s = document.getElementById('rab-sum'); if (s) s.innerHTML = it.length ? `<b>Total ${rp(tot)}</b> · ${it.length} barang · disetujui: ${esc(chain.join(' → ') || 'langsung ke Keuangan')}` : 'Isi rincian, total dan jalur persetujuan dihitung otomatis.';
});

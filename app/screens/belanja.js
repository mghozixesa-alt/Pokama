import { safeUrl, ctx, db, esc, today, addDays, fdate, ftime, avatar, nick, modal, field, opts, toast, unitName, unitOpts, isFin, isCeo, need, chip, logo, rp, jt, num, bizOf, waReport } from '../core.js';

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
  <ol class="steps"><li><b>1</b><span><strong>Ajukan RAB</strong><small>tabel barang, bisa tempel dari Excel</small></span></li><li><b>2</b><span><strong>Disetujui</strong><small>berjenjang sesuai nominal</small></span></li><li><b>3</b><span><strong>Dana cair</strong><small>Keuangan, ${esc((ctx.settings.cair_days || []).join(' & '))} ${esc(ctx.settings.cair_time || '')}</small></span></li><li><b>4</b><span><strong>Upload nota</strong><small>≤ ${lpjDays} hari setelah belanja</small></span></li><li><b class="t">5</b><span><strong>Selesai</strong><small>sisa dana kembali ke unit</small></span></li></ol>
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
    const grp = Object.entries(its.reduce((g, i) => { (g[i.category || 'Lain-lain'] ||= []).push(i); return g; }, {})).sort((a, b) => b[1].reduce((s, i) => s + i.qty * i.price, 0) - a[1].reduce((s, i) => s + i.qty * i.price, 0));
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
      ${r.description ? `<p class="note"><b>Tujuan:</b> ${esc(r.description)}</p>` : ''}
      <div class="row between small"><span class="muted">${its.length} barang${grp.length > 1 ? ' · ' + grp.length + ' kategori' : ''}</span>${its.length > 8 ? `<input class="inp sm" id="rab-q" placeholder="Cari barang…" style="max-width:200px">` : ''}</div>
      <div class="scroll-x rab-items"><table class="tbl compact"><thead><tr><th>Barang</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Total</th><th class="r">Realisasi</th></tr></thead><tbody>
        ${grp.map(([cat, rows]) => (grp.length > 1 ? `<tr class="cat"><td colspan="3">${esc(cat)} <small class="muted">· ${rows.length}</small></td><td class="r">${rp(rows.reduce((s, i) => s + i.qty * i.price, 0))}</td><td></td></tr>` : '') +
          rows.map(i => `<tr data-name="${esc((i.name + ' ' + (i.vendor || '')).toLowerCase())}"><td>${esc(i.name)}${i.vendor ? `<small class="muted"> · ${esc(i.vendor)}</small>` : ''}${i.nota_link ? ` <a href="${safeUrl(i.nota_link)}" target="_blank" rel="noopener" class="small">nota ↗</a>` : ''}</td><td class="r nw">${(+i.qty).toLocaleString('id-ID')} ${esc(i.uom || '')}</td><td class="r">${rp(i.price)}</td><td class="r b">${rp(i.qty * i.price)}</td><td class="r ${i.real_amount != null && i.real_amount > i.qty * i.price ? 'red' : ''}">${i.real_amount != null ? rp(i.real_amount) : '—'}</td></tr>`).join('')).join('')}
        <tr class="tot"><td>Total</td><td></td><td></td><td class="r">${rp(r.total)}</td><td class="r">${r.realisasi != null ? rp(r.realisasi) : '—'}</td></tr></tbody></table></div>
      ${r.realisasi != null ? `<p class="note">${r.realisasi <= r.total ? 'Sisa dana ' + rp(r.total - r.realisasi) + ' dikembalikan ke rekening unit.' : 'Kurang ' + rp(r.realisasi - r.total) + ', ajukan sebagai RAB tambahan.'}</p>` : ''}
      ${ai.length ? `<div class="note warn"><b class="small">CEK OTOMATIS</b><ul>${ai.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${r.note ? `<p class="note err">${esc(r.note)}</p>` : ''}
      <h3>Perjalanan RAB</h3><ol class="journey">${steps.map((s, i) => `<li class="${s[1] ? 'done' : stopped && i === curIdx ? 'stop' : i === curIdx ? 'cur' : ''}"><b>${s[1] ? '✓' : stopped && i === curIdx ? '×' : i + 1}</b><span>${esc(s[0])}<small>${esc(s[2])}</small></span></li>`).join('')}</ol>
      <div class="row gap wrap">
        ${myTurn(r) || (isCeo() && r.status === 'diajukan' && r.created_by !== me) ? `<button class="btn pri" data-a="approve">${myTurn(r) ? 'Setujui' : 'Setujui langsung (CEO)'}</button><button class="btn" data-a="revise">Minta revisi</button><button class="btn danger" data-a="reject">Tolak</button>` : ''}
        ${r.status === 'revisi' && r.created_by === me ? `<button class="btn pri" data-a="resubmit">Revisi & ajukan ulang</button>` : ''}
        ${r.status === 'siap_cair' && isFin() ? `<button class="btn pri" data-a="cair">Tandai dana sudah dicairkan</button>` : ''}
        ${r.status === 'diajukan' && isFin() ? `<button class="btn pri" disabled title="Persetujuan belum lengkap">Cairkan (menunggu ${esc(nick(r.chain[r.step]))})</button>` : ''}
        ${['diajukan', 'revisi', 'siap_cair'].includes(r.status) && (r.created_by === me || isCeo()) ? `<button class="btn danger" data-a="cancel">Batalkan RAB</button>` : ''}
        ${r.status === 'cair' && (r.created_by === me || isFin()) ? `<button class="btn pri" data-a="lpj">Upload nota (LPJ)</button>` : ''}
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
        t += `\n*TOTAL ${rp(r.total)}*${r.realisasi != null ? ` · realisasi ${rp(r.realisasi)}` : ''}${r.status === 'diajukan' ? `\nMenunggu persetujuan ${nick(r.chain[r.step])}` : ''}\n\npokama.org/#/belanja?r=${r.id}`;
        await waReport(r.code, t); return; }
      if (a.dataset.a === 'new') ok = await rabForm();
      else if (a.dataset.a === 'approve') { ok = await modal('Setujui ' + r.code, `<p>${esc(r.title)} · <b>${rp(r.total)}</b></p>`, { submit: 'Setujui', onSubmit: () => db.rpc('pk_rab_decide', { p_id: r.id, p_action: 'approve' }) }); }
      else if (a.dataset.a === 'revise' || a.dataset.a === 'reject') ok = await modal(a.dataset.a === 'revise' ? 'Minta revisi' : 'Tolak RAB', field(a.dataset.a === 'revise' ? 'Apa yang perlu direvisi' : 'Alasan penolakan', '<textarea name="n" class="inp" rows="3"></textarea>'),
        { submit: 'Kirim', onSubmit: (f) => db.rpc('pk_rab_decide', { p_id: r.id, p_action: a.dataset.a, p_note: f.n }) });
      else if (a.dataset.a === 'resubmit') ok = await rabForm(r, I(r.id));
      else if (a.dataset.a === 'cancel') ok = await modal('Batalkan ' + r.code, `<p>Batalkan RAB "<b>${esc(r.title)}</b>" ${rp(r.total)}? RAB tetap tercatat dengan status Dibatalkan.</p>` + field('Alasan (opsional)', '<input name="n" class="inp">'),
        { submit: 'Ya, batalkan', onSubmit: (f) => db.rpc('pk_rab_cancel', { p_id: r.id, p_note: f.n || null }) });
      else if (a.dataset.a === 'cair') ok = await modal('Cairkan ' + r.code, `<p>Transfer <b>${rp(r.total)}</b> ke ${esc(nick(r.created_by))} untuk "${esc(r.title)}".</p>` + field('Catatan (mis. nomor transfer)', '<input name="n" class="inp">'),
        { submit: 'Sudah dicairkan', onSubmit: (f) => db.rpc('pk_rab_cair', { p_id: r.id, p_note: f.n || null }) });
      else if (a.dataset.a === 'lpj') ok = await modal('Upload nota · ' + r.code, `<p class="muted small" style="margin-top:0">Realisasi terisi sesuai anggaran. Ubah hanya yang berbeda. Kalau semua nota ada di satu folder/foto, isi tautan bersama saja.</p>` +
        field('Tautan nota bersama (folder Drive / album foto)', '<input name="all" class="inp" placeholder="https://drive.google.com/…">') +
        `<div class="scroll-x"><table class="tbl compact"><thead><tr><th>Barang</th><th class="r">Anggaran</th><th class="r">Realisasi</th><th>Tautan nota khusus</th></tr></thead><tbody>` +
        I(r.id).map(i => `<tr><td>${esc(i.name)}<small class="muted"> · ${(+i.qty).toLocaleString('id-ID')} ${esc(i.uom || '')}</small></td><td data-l="Anggaran" class="r muted">${rp(i.qty * i.price)}</td><td data-l="Realisasi"><input name="r_${i.id}" class="inp r w-price" inputmode="numeric" value="${(i.qty * i.price).toLocaleString('id-ID')}"></td><td data-l="Nota khusus"><input name="n_${i.id}" class="inp" placeholder="opsional"></td></tr>`).join('') + `</tbody></table></div>`,
        { wide: true, submit: 'Kirim nota', onSubmit: (f) => { const all = (f.all || '').trim();
          const list = I(r.id).map(i => ({ id: i.id, real_amount: num(f['r_' + i.id]), nota_link: (f['n_' + i.id] || '').trim() || all || null }));
          if (!list.some(x => x.nota_link)) throw new Error('Isi tautan nota, minimal tautan bersama');
          return db.rpc('pk_rab_lpj', { p_id: r.id, p_items: list }); } });
      else if (a.dataset.a === 'close') ok = await modal('Tutup ' + r.code, `<p>Realisasi ${rp(r.realisasi)} dari ${rp(r.total)}.</p>` + field('Catatan', '<input name="n" class="inp">'), { submit: 'Selesai', onSubmit: (f) => db.rpc('pk_rab_close', { p_id: r.id, p_note: f.n || null }) });
      if (ok) { toast('Tersimpan'); reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };

  async function rabForm(r = null, its = []) {
    const isLeader = ['leader', 'kepala_staf', 'ceo'].includes(ctx.me.role);
    const mine = rabs.filter(x => x.created_by === me && (!r || x.id !== r.id)).slice(0, 30);
    const cats = [...new Set(items.map(i => i.category).filter(Boolean).concat(CATS))];
    const body = (r ? `<p class="note err">${esc(r.note || '')}</p>` : '') +
      `<div class="g2">` + field('Unit', `<select name="unit" class="inp"${r ? ' disabled' : ''}>${unitOpts(r ? r.unit_code : ctx.me.unit_code)}</select>`) +
      field('Jenis', `<select name="kind" class="inp"${r ? ' disabled' : ''}>${opts(Object.entries(KIND), r ? r.kind : 'op')}</select>`) + `</div>` +
      field('Untuk apa', `<input name="title" class="inp" value="${esc(r ? r.title : '')}" placeholder="Misalnya: Restock perlengkapan trip Kebon November">`) +
      field('Tujuan & alasan (opsional)', `<textarea name="desc" class="inp" rows="2" placeholder="Kenapa perlu dibeli sekarang, dipakai untuk apa, dampaknya ke unit">${esc(r ? r.description || '' : '')}</textarea>`) +
      `<div class="rab-tools row gap wrap"><b class="lab" style="flex:1">RINCIAN BARANG</b>${mine.length ? `<select class="inp sm" id="rab-copy"><option value="">Salin dari RAB lama…</option>${mine.map(x => `<option value="${x.id}">${esc(x.code)} · ${esc(x.title)}</option>`).join('')}</select>` : ''}<button type="button" class="btn sm" data-paste>Tempel dari Excel / Sheet</button></div>
      <div class="rab-paste" hidden><textarea class="inp mono" rows="5" id="rab-paste-t" placeholder="Salin baris dari Excel/Google Sheet lalu tempel di sini. Urutan kolom: Barang · Qty · Satuan · Harga · Kategori · Toko\nBan dalam\t6\tpcs\t45000\tSparepart\tToko Jaya"></textarea><div class="row gap"><button type="button" class="btn sm pri" data-paste-go>Masukkan ke tabel</button><span class="muted small">Kolom dipisah tab (hasil copy dari spreadsheet) atau koma. Baris judul dilewati otomatis.</span></div></div>
      <datalist id="rab-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="rab-ed scroll-x"><table class="tbl compact"><thead><tr><th>#</th><th>Barang / jasa</th><th class="r">Qty</th><th>Satuan</th><th class="r">Harga satuan</th><th class="r">Subtotal</th><th>Kategori</th><th>Toko / vendor</th><th></th></tr></thead><tbody id="rab-body"></tbody></table></div>
      <div class="row gap"><button type="button" class="btn sm" data-add="1">+ Baris</button><button type="button" class="btn sm" data-add="5">+ 5 baris</button><span class="muted small">Tab / Enter untuk pindah kolom. Baris kosong diabaikan.</span></div>
      <div class="rab-sum" id="rab-sum"></div>` +
      (r ? '' : `<div class="g2">` + field('Dibutuhkan tanggal', `<input type="date" name="need" class="inp" value="${addDays(today(), 3)}">`) +
      `<div class="stack">${isLeader ? `<label class="chk"><input type="checkbox" name="crew"> Dari crew cabang (diteruskan Leader)</label>` : ''}${isLeader || ctx.me.role === 'keuangan' ? '<label class="chk"><input type="checkbox" name="emg"> Pakai dana darurat (mendadak)</label>' : ''}</div></div>`);
    const onOpen = (ev) => { document.removeEventListener('modal:open', onOpen); edInit(ev.detail, its.length ? its : [], (id) => I(id)); };
    document.addEventListener('modal:open', onOpen);
    return modal(r ? 'Revisi ' + r.code : 'Ajukan RAB baru', body,
      { wide: true, submit: r ? 'Ajukan ulang' : 'Kirim RAB', onSubmit: async (f, form) => {
        const list = edRead(form); need(f.title, 'Isi untuk apa belanjanya');
        const bad = list.find(x => !(x.qty > 0)); if (bad) throw new Error(`Baris "${bad.name}": isi jumlah`);
        if (!list.length) throw new Error('Isi minimal satu barang beserta jumlah dan harganya');
        if (r) { await db.rpc('pk_rab_resubmit', { p_id: r.id, p_title: f.title, p_items: list }); if ((f.desc || '') !== (r.description || '')) await db.rpc('pk_rab_describe', { p_id: r.id, p_desc: f.desc || null }); }
        else { const res = await db.rpc('pk_rab_submit', { p_unit: f.unit, p_kind: f.kind, p_title: f.title, p_need: f.need || null, p_items: list, p_emergency: !!f.emg, p_via_app: !!f.crew, p_for: null });
          if ((f.desc || '').trim()) await db.rpc('pk_rab_describe', { p_id: res.id, p_desc: f.desc.trim() }); toast(res.code + ' terkirim · ' + list.length + ' barang'); }
      } });
  }
}
const CATS = ['Bahan & perlengkapan', 'Sparepart & perawatan', 'Konsumsi', 'Transport & ongkir', 'Marketing & cetak', 'Jasa & tenaga', 'ATK & kantor', 'Lain-lain'];
const fmtN = (v) => v === '' || v == null || isNaN(v) ? '' : (+v).toLocaleString('id-ID');
function edRow(x = {}) {
  return `<tr><td class="muted n"></td><td data-l="Barang"><input class="inp" data-k="name" value="${esc(x.name || '')}" placeholder="Nama barang"></td>
    <td data-l="Qty"><input class="inp r w-qty" data-k="qty" inputmode="decimal" value="${x.qty != null ? fmtN(+x.qty) : ''}"></td><td data-l="Satuan"><input class="inp w-uom" data-k="uom" value="${esc(x.uom || '')}" placeholder="pcs"></td>
    <td data-l="Harga satuan"><input class="inp r w-price" data-k="price" inputmode="numeric" value="${x.price != null && x.price !== '' ? fmtN(+x.price) : ''}"></td><td data-l="Subtotal" class="r b sub">—</td>
    <td data-l="Kategori"><input class="inp w-cat" data-k="category" list="rab-cats" value="${esc(x.category || '')}" placeholder="kategori"></td><td data-l="Toko"><input class="inp w-ven" data-k="vendor" value="${esc(x.vendor || '')}" placeholder="toko"></td>
    <td class="dl"><button type="button" class="x" data-del title="Hapus baris">×</button></td></tr>`;
}
function edRead(form) {
  return [...form.querySelectorAll('#rab-body tr')].map(tr => { const g = (k) => (tr.querySelector(`[data-k="${k}"]`).value || '').trim();
    return { name: g('name'), qty: +g('qty').replace(/\./g, '').replace(',', '.') || 0, price: num(g('price')) || 0, uom: g('uom') || null, category: g('category') || null, vendor: g('vendor') || null }; })
    .filter(x => x.name);
}
function edInit(form, its, itemsOf) {
  const body = form.querySelector('#rab-body');
  const add = (rows) => { body.insertAdjacentHTML('beforeend', rows.map(edRow).join('')); calc(); };
  const calc = () => {
    [...body.querySelectorAll('tr')].forEach((tr, i) => { tr.querySelector('.n').textContent = i + 1; const q = +(tr.querySelector('[data-k=qty]').value || '').replace(/\./g, '').replace(',', '.') || 0; const p = num(tr.querySelector('[data-k=price]').value) || 0; tr.querySelector('.sub').textContent = q && p ? rp(q * p) : '—'; });
    const list = edRead(form); const tot = list.reduce((s, x) => s + x.qty * x.price, 0);
    const byCat = {}; list.forEach(x => { const k = x.category || 'Tanpa kategori'; byCat[k] = (byCat[k] || 0) + x.qty * x.price; });
    const l1 = +ctx.settings.rab_limit_atasan || 1e6, l2 = +ctx.settings.rab_limit_kepala_staf || 5e6; const role = ctx.me.role;
    const chain = role === 'ceo' ? [] : ['leader', 'keuangan'].includes(role) ? ['Kepala Staf'] : role === 'kepala_staf' ? ['CEO'] : [nick(ctx.me.boss_id)].concat(tot > l1 ? ['Kepala Staf'] : []);
    if (tot > l2 && role !== 'kepala_staf' && role !== 'ceo') chain.push('CEO');
    form.querySelector('#rab-sum').innerHTML = list.length ? `<div class="row between"><span><b>${list.length}</b> barang · disetujui: ${esc(chain.join(' → ') || 'langsung ke Keuangan')}</span><b class="big">${rp(tot)}</b></div>
      ${Object.keys(byCat).length > 1 ? `<div class="rab-cats">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><span class="muted">${esc(k)}</span> <b>${jt(v)}</b></span>`).join('')}</div>` : ''}` : '<span class="muted">Isi rincian, total dan jalur persetujuan dihitung otomatis.</span>';
  };
  add(its.length ? its : [{}, {}, {}]);
  form.addEventListener('input', (e) => { if (e.target.closest('#rab-body')) calc(); });
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
    [...body.querySelectorAll('tr')].filter(tr => !tr.querySelector('[data-k=name]').value.trim()).forEach(tr => tr.remove()); add(src.map(i => ({ name: i.name, qty: +i.qty, uom: i.uom, price: +i.price, category: i.category, vendor: i.vendor })));
    const t = form.querySelector('[name=title]'); const r0 = cp.options[cp.selectedIndex].text.split(' · ').slice(1).join(' · '); if (!t.value) t.value = r0; cp.value = ''; toast(src.length + ' barang disalin'); });
}
function parsePaste(t) {
  return String(t || '').split(/\r?\n/).map(l => (l.includes('\t') ? l.split('\t') : l.split(',')).map(s => s.trim())).filter(p => p[0] && p.length >= 2)
    .map(p => { const nums = p.map(x => num(x)); // Barang · Qty · Satuan · Harga · Kategori · Toko, atau Barang · Qty · Harga
      if (p.length <= 3) return { name: p[0], qty: +p[1].replace(',', '.') || 0, price: nums[2] || 0, category: p[3] || '', vendor: p[4] || '' };
      return { name: p[0], qty: +p[1].replace(',', '.') || 0, uom: p[2] || '', price: nums[3] || 0, category: p[4] || '', vendor: p[5] || '' }; })
    .filter(x => x.qty > 0 || x.price > 0);
}

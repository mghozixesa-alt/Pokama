import { ctx, db, esc, today, addDays, fdate, ftime, avatar, nick, modal, field, opts, toast, unitName, unitOpts, isAdmin, chip, rp, num, shrinkImage, uploadPhoto, signedPhoto, confirmBox } from '../core.js';

/* Gudang: stok barang dengan batas minimum, permintaan antar-divisi, serah terima (foto + konfirmasi penerima, tanpa tanda tangan), stok minim → draf RAB. */
const ST = { baru: ['Menunggu', 'yellow'], disetujui: ['Siap diambil', 'blue'], diserahkan: ['Diserahkan', 'green'], ditolak: ['Ditolak', 'gray'], batal: ['Dibatalkan', 'gray'] };
const LOCS = ['Garut Kota', 'Wanaraja', 'Bandung · Hub', 'Bandung · Jackal', 'Ruma Metua', 'Kantor Pokama'];
let S = { cat: '', q: '', loc: '' };

export default async function gudang(el, params, reload) {
  const me = ctx.me.id;
  const tab = params.get('tab') || 'stok';
  const [items, reqs, keeper] = await Promise.all([
    db.get('pk_gudang_items', 'select=*&is_active=eq.true&order=name').catch(() => []),
    db.get('pk_gudang_req', 'select=*,pk_gudang_req_items(qty,price,item_id)&order=created_at.desc&limit=200').catch(() => []),
    db.rpc('pk_gudang_is_keeper').catch(() => false)
  ]);
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const low = items.filter(i => +i.stock < +i.min_stock), near = items.filter(i => +i.stock >= +i.min_stock && +i.stock <= +i.min_stock * 1.2);
  const fresh = reqs.filter(r => r.status === 'baru'), ready = reqs.filter(r => r.status === 'disetujui');
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
  const locs = [...new Set(items.map(i => i.location).concat(LOCS))];
  const q = S.q.toLowerCase();
  const shown = items.filter(i => (!S.cat || i.category === S.cat) && (!S.loc || i.location === S.loc) && (!q || (i.name + ' ' + (i.category || '')).toLowerCase().includes(q)))
    .sort((a, b) => ((+a.stock < +a.min_stock) === (+b.stock < +b.min_stock) ? 0 : (+a.stock < +a.min_stock) ? -1 : 1) || a.name.localeCompare(b.name));
  const lvl = (i) => +i.stock < +i.min_stock ? ['Buat RAB', 'red'] : +i.stock <= +i.min_stock * 1.2 ? ['Hampir habis', 'yellow'] : ['Aman', 'green'];
  const mineReq = reqs.filter(r => r.from_id === me);
  const reqList = tab === 'saya' ? mineReq : tab === 'antrean' ? reqs.filter(r => ['baru', 'disetujui'].includes(r.status)) : reqs;
  const reqCard = (r) => { const its = (r.pk_gudang_req_items || []).map(x => (byId[x.item_id] ? byId[x.item_id].name : 'Barang') + ' × ' + (+x.qty)).join(', ');
    return `<div class="card item"><span class="row between small"><span class="row gap6">${avatar(r.from_id, 20)}<b>${esc(nick(r.from_id))}</b> · ${esc(r.for_label || unitName(r.for_unit))}</span><span class="muted">${esc(r.code || '')} · ${ftime(r.created_at)}</span></span>
      <b>${esc(its || '—')}</b><span class="small muted">${esc(r.purpose || '')}${r.needed_on ? ' · dibutuhkan ' + fdate(r.needed_on) : ''} · ${esc(r.location || '')} · nilai ${rp(r.total)}</span>
      <span class="row between">${chip(ST[r.status][0], ST[r.status][1])}<span class="row gap6">
        ${keeper && r.status === 'baru' ? `<button class="btn sm" data-no="${r.id}">Tolak</button><button class="btn sm" data-ok="${r.id}">Setujui</button>` : ''}
        ${keeper && ['baru', 'disetujui'].includes(r.status) ? `<button class="btn sm pri" data-hand="${r.id}">Serahkan</button>` : ''}
        ${!keeper && r.from_id === me && ['baru', 'disetujui'].includes(r.status) ? `<button class="btn sm" data-cx="${r.id}">Batalkan</button>` : ''}
        ${r.status === 'diserahkan' && r.photos && r.photos.length ? `<button class="btn sm" data-ph="${r.id}">Lihat foto</button>` : ''}</span></span>
      ${r.note ? `<span class="small muted">Catatan: ${esc(r.note)}</span>` : ''}</div>`; };
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Gudang · ${items.length} jenis barang</span><h1>Stok &amp; permintaan</h1></div>
    <div class="row gap6"><button class="btn pri" data-a="minta">+ Minta barang</button>${keeper ? '<button class="btn" data-a="item">+ Barang</button>' : ''}</div></header>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
    <a class="card" href="#/gudang?tab=stok" style="border:1.5px solid #F3C4BE;text-decoration:none;color:inherit"><span class="small b">Di bawah minimum</span><b style="font-size:28px;color:#C0392B;display:block">${low.length}</b><span class="small muted">${low.length ? 'perlu dibelikan (RAB)' : 'semua aman'}</span></a>
    <a class="card" href="#/gudang?tab=antrean" style="border:1.5px solid #9EDFD8;text-decoration:none;color:inherit"><span class="small b">Permintaan baru</span><b style="font-size:28px;display:block">${fresh.length}</b><span class="small muted">${ready.length ? ready.length + ' siap diambil' : 'buka antrean'}</span></a>
  </div>
  <div class="chips">${[['stok', 'Stok'], ['antrean', 'Antrean (' + (fresh.length + ready.length) + ')'], ['saya', 'Permintaan saya (' + mineReq.length + ')'], ['semua', 'Riwayat']].map(([k, l]) => `<a class="chipbtn${tab === k ? ' on' : ''}" href="#/gudang?tab=${k}">${l}</a>`).join('')}</div>
  ${tab === 'stok' ? `
    ${low.length && keeper ? `<div class="note" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><span><b>${low.length} barang di bawah minimum.</b> ${esc(low.slice(0, 3).map(i => i.name).join(', '))}${low.length > 3 ? ' …' : ''}</span><button class="btn sm pri" data-a="rab">Jadikan draf RAB</button></div>` : ''}
    <div class="row gap wrap" style="margin:8px 0"><input class="inp" type="search" placeholder="Cari barang…" value="${esc(S.q)}" data-gq style="flex:1;min-width:180px">
      <select class="inp" data-gl style="max-width:200px"><option value="">Semua gudang</option>${locs.map(l => `<option${S.loc === l ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="chips"><button class="chipbtn${!S.cat ? ' on' : ''}" data-gc="">Semua</button>${cats.map(c => `<button class="chipbtn${S.cat === c ? ' on' : ''}" data-gc="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="card" style="padding:4px 16px">${shown.map(i => { const L = lvl(i); return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:nowrap;padding:12px 0;border-bottom:1px solid #EEF0F3;gap:10px">
      <span style="min-width:0"><b>${esc(i.name)}</b><br><span class="small muted">${esc(i.location)} · min ${+i.min_stock} ${esc(i.uom)}${i.category ? ' · ' + esc(i.category) : ''}${+i.price ? ' · ' + rp(i.price) : ''}</span></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none"><b style="font-size:20px;line-height:22px;color:${L[1] === 'red' ? '#C0392B' : L[1] === 'yellow' ? '#9A5B00' : '#1F2B4D'}">${+i.stock}</b><span class="row gap6">${chip(L[0], L[1])}${keeper ? `<button class="link small" data-ed="${i.id}">ubah</button>` : ''}</span></span></div>`; }).join('') || `<p class="muted" style="padding:14px 0">${items.length ? 'Tidak ada yang cocok.' : 'Belum ada barang. ' + (keeper ? 'Tambah lewat tombol "+ Barang".' : 'Kepala Gudang menambahkan daftar barang.')}</p>`}</div>
    ${near.length ? `<p class="small muted">${near.length} barang hampir habis (≤ 120% dari minimum).</p>` : ''}`
  : `<div class="stack">${reqList.map(reqCard).join('') || '<div class="card empty-state"><p class="muted">Belum ada permintaan di sini.</p></div>'}</div>`}
  <p class="small muted" style="margin-top:12px">Biaya barang dicatat ke unit peminta. Stok berkurang otomatis saat diserahkan; kalau jadi di bawah minimum, barangnya masuk daftar "Buat RAB".${keeper ? '' : ' Persetujuan & penyerahan oleh Kepala Gudang / Keuangan / Kepala Staf.'}</p>`;

  const rerender = () => gudang(el, params, reload);
  const deb = (fn) => { clearTimeout(gudang._t); gudang._t = setTimeout(fn, 300); };
  el.oninput = (e) => { if (e.target.matches('[data-gq]')) deb(() => { S.q = e.target.value; rerender().then(() => { const x = el.querySelector('[data-gq]'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }); }); };
  el.onchange = (e) => { if (e.target.matches('[data-gl]')) { S.loc = e.target.value; rerender(); } };
  el.onclick = async (e) => {
    const t = e.target.closest('button,[data-a]'); if (!t) return;
    try {
      if (t.dataset.gc !== undefined) { S.cat = t.dataset.gc; return rerender(); }
      if (t.dataset.a === 'item' || t.dataset.ed) { const i = t.dataset.ed ? byId[t.dataset.ed] : {};
        const r = await modal(i.id ? 'Ubah barang' : 'Tambah barang', field('Nama barang', `<input name="name" class="inp" value="${esc(i.name || '')}" required>`) +
          `<div class="g2">` + field('Kategori', `<input name="category" class="inp" list="gd-cats" value="${esc(i.category || '')}" placeholder="Perlengkapan / Sparepart / ATK">`) + field('Gudang', `<select name="location" class="inp">${opts(locs.map(l => [l, l]), i.location || locs[0])}</select>`) + `</div>` +
          `<div class="g2">` + field('Stok sekarang', `<input name="stock" class="inp" inputmode="numeric" value="${i.id ? +i.stock : ''}">`) + field('Batas minimum', `<input name="min_stock" class="inp" inputmode="numeric" value="${i.id ? +i.min_stock : ''}">`) + `</div>` +
          `<div class="g2">` + field('Satuan', `<input name="uom" class="inp" value="${esc(i.uom || 'pcs')}">`) + field('Harga satuan (perkiraan)', `<input name="price" class="inp" inputmode="numeric" value="${i.id ? +i.price : ''}">`) + `</div>` +
          (i.id ? field('Alasan kalau stok dikoreksi', '<input name="reason" class="inp" placeholder="mis. hasil stok opname">') : '') + `<datalist id="gd-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`,
          { submit: 'Simpan', onSubmit: (f) => db.rpc('pk_gudang_item_save', { p: { id: i.id || null, name: f.name, category: f.category, location: f.location, uom: f.uom, stock: f.stock === '' ? null : num(f.stock), min_stock: f.min_stock === '' ? null : num(f.min_stock), price: f.price === '' ? null : num(f.price), reason: f.reason || '' } }) });
        if (r) { toast('Tersimpan'); reload(); } return; }
      if (t.dataset.a === 'minta') return minta();
      if (t.dataset.a === 'rab') {
        const rows = low.map(i => ({ name: i.name, qty: Math.max(1, Math.ceil(+i.min_stock * 2 - +i.stock)), price: +i.price || 0, uom: i.uom, category: i.category || null, vendor: null, unit_code: null }));
        const tot = rows.reduce((a, x) => a + x.qty * x.price, 0);
        await db.insert('pk_rab_drafts', { title: 'Restock gudang ' + fdate(today(), false), payload: { unit: ctx.me.unit_code, kind: 'op', title: 'Restock gudang ' + fdate(today(), false), desc: 'Barang di bawah batas minimum gudang (jumlah = 2× minimum − stok).', need: addDays(today(), 3), termin_on: false, rows, terms: [] }, total: tot, updated_at: new Date().toISOString() });
        toast('Draf RAB dibuat · lanjutkan di Pengajuan Belanja'); location.hash = '#/belanja'; return; }
      if (t.dataset.ok) { await db.rpc('pk_gudang_act', { p_id: t.dataset.ok, p_action: 'setujui', p: {} }); toast('Disetujui · siap diambil'); return reload(); }
      if (t.dataset.no) { const r = await modal('Tolak permintaan', field('Alasan', '<textarea name="n" class="inp" rows="3" required></textarea>'), { submit: 'Tolak', onSubmit: (f) => db.rpc('pk_gudang_act', { p_id: t.dataset.no, p_action: 'tolak', p: { note: f.n } }) }); if (r) { toast('Ditolak'); reload(); } return; }
      if (t.dataset.cx) { if (await confirmBox('Batalkan permintaan ini?', 'Batalkan')) { await db.rpc('pk_gudang_act', { p_id: t.dataset.cx, p_action: 'batal', p: {} }); toast('Dibatalkan'); reload(); } return; }
      if (t.dataset.ph) { const r = reqs.find(x => x.id === t.dataset.ph); const urls = await Promise.all((r.photos || []).map(p => signedPhoto('pk-absen', p).catch(() => ''))); await modal('Foto serah terima ' + (r.code || ''), urls.filter(Boolean).map(u => `<img src="${esc(u)}" alt="" style="width:100%;border-radius:12px;margin-bottom:8px">`).join('') || '<p class="muted">Foto tidak bisa dibuka.</p>', { submit: null }); return; }
      if (t.dataset.hand) return serah(reqs.find(x => x.id === t.dataset.hand));
    } catch (er) { toast(er.message, 'err'); }
  };

  async function minta() {
    const avail = items.filter(i => +i.stock > 0);
    if (!avail.length) return toast('Belum ada barang dengan stok di gudang.', 'err');
    const rowsHtml = (n) => Array.from({ length: n }, (_, k) => `<div class="row gap6" style="margin-bottom:6px"><select class="inp" name="it_${k}" style="flex:1"><option value="">— pilih barang —</option>${avail.map(i => `<option value="${i.id}">${esc(i.name)} · stok ${+i.stock} · ${esc(i.location)}</option>`).join('')}</select><input class="inp" name="q_${k}" inputmode="numeric" placeholder="Jml" style="width:72px"></div>`).join('');
    const r = await modal('Minta barang', field('Untuk divisi / unit', `<select name="unit" class="inp">${unitOpts(ctx.me.unit_code)}</select>`, 'Biaya barang dicatat ke unit ini.') +
      field('Cabang / lokasi pemakaian (opsional)', '<input name="lab" class="inp" placeholder="mis. CS Bandung · Hub">') +
      `<b class="lab">BARANG</b>${rowsHtml(5)}` + field('Keperluan', '<textarea name="purpose" class="inp" rows="2" placeholder="mis. Charger rusak 3, pelanggan sering pinjam kabel" required></textarea>') +
      field('Dibutuhkan', `<input type="date" name="need" class="inp" value="${today()}">`),
      { submit: 'Kirim permintaan', onSubmit: (f) => { const its = [0, 1, 2, 3, 4].map(k => ({ item_id: f['it_' + k], qty: num(f['q_' + k]) })).filter(x => x.item_id && x.qty > 0);
        if (!its.length) throw new Error('Pilih minimal 1 barang dan isi jumlahnya.'); if (!String(f.purpose || '').trim()) throw new Error('Isi keperluan.');
        const loc = byId[its[0].item_id].location;
        return db.rpc('pk_gudang_request', { p: { for_unit: f.unit, for_label: f.lab || '', location: loc, purpose: f.purpose, needed_on: f.need, items: its } }); } });
    if (r) { toast((r.code || 'Permintaan') + ' terkirim'); location.hash = '#/gudang?tab=saya'; reload(); }
  }
  async function serah(r) {
    const its = (r.pk_gudang_req_items || []).map(x => ({ ...x, it: byId[x.item_id] || {} }));
    const after = its.map(x => ({ n: x.it.name, left: +x.it.stock - +x.qty, min: +x.it.min_stock })).filter(x => x.left < x.min);
    const paths = [];
    document.addEventListener('modal:open', (ev) => { const fm = ev.detail; const inp = fm.querySelector('#gd-file'); if (!inp) return;
      inp.addEventListener('change', async () => { const fl = inp.files[0]; if (!fl) return;
        try { const blob = await shrinkImage(fl); const path = `${me}/gudang-${r.code || r.id}-${Date.now()}.jpg`; await uploadPhoto('pk-absen', path, blob); paths.push(path);
          fm.querySelector('#gd-ph').insertAdjacentHTML('beforeend', `<img src="${URL.createObjectURL(blob)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:10px">`); inp.value = ''; }
        catch (er) { toast(er.message, 'err'); } }); }, { once: true });
    const res = await modal('Serah terima ' + (r.code || ''), `<p class="small muted" style="margin-top:0">Diminta ${esc(nick(r.from_id))} · ${ftime(r.created_at)}${r.approved_at ? ' · disetujui ' + ftime(r.approved_at) : ''}</p>
      <div>${its.map(x => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEF0F3"><span>${esc(x.it.name || 'Barang')}</span><b>${+x.qty} ${esc(x.it.uom || '')}</b></div>`).join('')}<div style="display:flex;justify-content:space-between;padding:8px 0"><span>Nilai</span><b>${rp(r.total)}</b></div></div>
      <b class="lab" style="display:block;margin-top:12px">FOTO BARANG DISERAHKAN</b><div class="row gap6" id="gd-ph"></div><label class="btn sm" style="margin-top:6px">+ Foto<input type="file" accept="image/*" capture="environment" hidden id="gd-file"></label>
      <label class="chk" style="margin-top:12px"><input type="checkbox" name="ok"> ${esc(nick(r.from_id))} sudah menerima barang dan jumlahnya sesuai</label>
      ${after.length ? `<p class="note" style="margin-top:10px">Setelah diserahkan: ${after.map(x => esc(x.n) + ' jadi ' + x.left + ' (min ' + x.min + ')').join(', ')} → otomatis masuk daftar "Buat RAB".</p>` : ''}`,
      { submit: 'Serahkan', onSubmit: (f) => { if (!f.ok) throw new Error('Centang konfirmasi penerima dulu.'); return db.rpc('pk_gudang_act', { p_id: r.id, p_action: 'serahkan', p: { received_ok: true, photos: paths } }); } });
    if (res) { toast('Diserahkan · stok berkurang'); reload(); }
  }
}

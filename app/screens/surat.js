import { ctx, db, esc, toast, modal, field, opts, fdate, bizOf, isAdmin } from '../core.js';

/* Menu Surat: surat resmi bernomor, kop PT, nama + QR verifikasi, arsip. Hak akses dicek ulang di server (pk_letter_*). */
const VERIFY = 'https://pokama.org/cek?k=';
const BIZ = [['HQ', 'Pokama (holding)'], ['RA', 'Rentalaja'], ['WG', 'TripinAja'], ['NA', 'Niagaaja']];
const STATUS = { menunggu: ['Menunggu persetujuan', '#9A5B00', '#FFF0DC'], terbit: ['Terbit', '#077A70', '#E3F7F5'], ditolak: ['Ditolak', '#C0392B', '#FDE8E6'], batal: ['Dibatalkan', '#4A5468', '#EEF0F3'] };
const DESC = { ST: 'Tugas luar kantor untuk satu atau beberapa orang', SKK: 'Keterangan masih bekerja, untuk bank, beasiswa, dll.', SPK: 'Penawaran kerja untuk pelamar dari Rekrutmen', SP: 'SP 1–3, membaca SP yang masih berlaku', SKA: 'Kepemilikan / pengelolaan unit, dari data aset' };
let S = { tab: 'buat', q: '' };
let TYPES = null, ROLE = null, CUR = null;

const loadScript = (src) => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Gagal memuat ' + src)); document.head.appendChild(s); });
const stChip = (k) => { const s = STATUS[k] || STATUS.menunggu; return `<span class="chip" style="background:${s[2]};color:${s[1]}">${s[0]}</span>`; };
const tglID = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return d.getUTCDate() + ' ' + ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const people = () => ctx.people.filter(p => p.is_active);
const byRole = (r) => people().filter(p => p.role === r);

/* ---------- isi surat ---------- */
function fill(text, d) {
  return esc(text || '')
    .replace(/\{\{\?(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, k, inner) => (d[k] != null && String(d[k]).trim() !== '' ? inner : ''))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (d[k] == null || d[k] === '' ? '…' : esc(d[k])))
    .split('\n').join('<br>');
}
function subjectTable(l) {
  const d = l.data || {};
  if (d.assets) return `<table class="lt"><thead><tr><th>Unit</th><th>Plat</th><th>No. rangka / mesin</th><th>BPKB</th><th>STNK s.d.</th><th>Keterangan</th></tr></thead><tbody>${d.assets.map(a => `<tr>
    <td><b>${esc(a.product || '')}</b><br><small>${esc(a.code || '')}${a.color ? ' · ' + esc(a.color) : ''}${a.branch ? ' · ' + esc(a.branch) : ''}</small></td><td>${esc(a.plate || '—')}</td>
    <td>${esc(a.frame_no || '—')}<br>${esc(a.engine_no || '—')}</td><td>a.n. ${esc(a.bpkb_name || '—')}<br><small>disimpan: ${esc(a.bpkb_location || '—')}</small></td>
    <td>${a.stnk_due ? tglID(a.stnk_due) : '—'}</td><td>${a.investor ? 'Dikelola Rentalaja' : 'Aset ' + esc(d.perusahaan || 'perusahaan') + ', dikelola Rentalaja'}</td></tr>`).join('')}</tbody></table>`;
  const ps = d.people || [];
  if (ps.length === 1) return `<table class="kv">${Object.entries(ps[0]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>:</td><td><b>${esc(v || '—')}</b></td></tr>`).join('')}</table>`;
  const cols = Object.keys(ps[0] || {});
  return `<table class="lt"><thead><tr><th>No</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${ps.map((p, i) => `<tr><td>${i + 1}</td>${cols.map(c => `<td>${esc(p[c] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
async function qrSvg(text) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
}
const LETTER_CSS = `
.letter{width:794px;min-height:1123px;box-sizing:border-box;padding:56px 72px 64px;background:#fff;color:#111;font:14px/1.6 'Plus Jakarta Sans',Arial,sans-serif;position:relative}
.letter .kop{display:flex;align-items:center;gap:18px;padding-bottom:14px;border-bottom:3px double #1F2B4D}
.letter .kop img{height:46px;width:auto}
.letter .kop b{display:block;font-size:18px;letter-spacing:.04em;color:#1F2B4D}
.letter .kop span{font-size:12px;color:#4A5468}
.letter h1{margin:28px 0 2px;text-align:center;font-size:17px;letter-spacing:.06em;text-decoration:underline}
.letter .no{text-align:center;margin:0 0 22px;font-size:13.5px}
.letter p{margin:0 0 12px;text-align:justify}
.letter table.kv{margin:4px 0 14px 24px;border-collapse:collapse}.letter table.kv td{padding:2px 8px 2px 0;vertical-align:top}
.letter table.lt{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:12.5px}.letter table.lt th,.letter table.lt td{border:1px solid #9AA3B2;padding:5px 7px;text-align:left;vertical-align:top}.letter table.lt th{background:#F1F3F6}
.letter .sign{display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px;gap:24px}
.letter .sign .who{min-width:250px}
.letter .sign .qr{width:96px;height:96px}.letter .sign .qr svg{width:96px;height:96px;display:block}
.letter .sign small,.letter .foot small{color:#4A5468;font-size:11px;line-height:1.4;display:block}
.letter .mark{position:absolute;top:44%;left:0;right:0;text-align:center;font-size:58px;font-weight:800;color:rgba(192,57,43,.14);transform:rotate(-18deg);pointer-events:none}
.letter .foot{position:absolute;left:72px;right:72px;bottom:28px;border-top:1px solid #E2E6EC;padding-top:6px}`;
async function letterHtml(l) {
  const d = l.data || {}, tpl = l.tpl || {};
  const issued = l.status === 'terbit' || (l.status === 'batal' && l.number);
  const qr = issued && l.verify_key ? await qrSvg(VERIFY + l.verify_key) : '';
  const mark = l.status === 'batal' ? 'DIBATALKAN' : l.status === 'terbit' ? '' : l.status === 'ditolak' ? 'DITOLAK' : 'DRAF';
  return `<div class="letter">${mark ? `<div class="mark">${mark}</div>` : ''}
    <div class="kop"><img src="/img/pokama-logo.png" alt="Pokama"><div><b>${esc((d.perusahaan || 'PT Popo Karya Investama').toUpperCase())}</b><span>Induk Rentalaja, TripinAja, dan Niagaaja · Garut, Jawa Barat · pokama.org</span></div></div>
    <h1>${fill(tpl.title, d)}</h1><div class="no">Nomor: ${esc(l.number || '(otomatis saat terbit)')}</div>
    <p>${fill(tpl.opening, d)}</p>${subjectTable(l)}<p>${fill(tpl.after, d)}</p><p>${fill(tpl.closing, d)}</p>
    <div class="sign">${l.known_name ? `<div class="who">Mengetahui,<br>${esc(l.known_title || 'Atasan langsung')}<br><br><br><b>${esc(l.known_name)}</b></div>` : '<div></div>'}
      <div class="who" style="display:flex;gap:14px;align-items:flex-end">${qr ? `<div class="qr">${qr}</div>` : ''}<div>Garut, ${tglID(l.letter_date)}<br>${esc(l.signer_title || '')}<br>${esc(d.perusahaan || 'PT Popo Karya Investama')}<br><br><b style="text-decoration:underline">${esc(l.signer_name || '')}</b>
        <small>${issued ? 'Disetujui secara elektronik melalui Sistem Kerja Pokama. Pindai QR untuk memeriksa keaslian.' : 'Belum disetujui penanda tangan.'}</small></div></div></div>
    ${l.valid_until ? `<p style="margin-top:18px;font-size:12px">Berlaku sampai ${tglID(l.valid_until)}.</p>` : ''}
    <div class="foot"><small>${l.number ? 'Nomor ' + esc(l.number) + ' · ' : ''}Periksa keaslian: pokama.org/cek${l.verify_key ? '?k=' + esc(l.verify_key) : ''}</small></div></div>`;
}
async function downloadPdf(l) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-10000px;top:0';
  box.innerHTML = `<style>${LETTER_CSS}</style>` + await letterHtml(l); document.body.appendChild(box);
  try {
    await window.html2pdf().set({ margin: 0, filename: (l.number || 'draf-surat').replace(/\//g, '-') + '.pdf', image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'px', format: [794, 1123], hotfixes: ['px_scaling'] } }).from(box.querySelector('.letter')).save();
  } finally { box.remove(); }
}
async function printLetter(l) {
  const w = window.open('', '_blank'); if (!w) return toast('Izinkan pop-up untuk mencetak', 'err');
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(l.number || 'Draf surat')}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet"><base href="${location.origin}/"><style>@page{size:A4;margin:0}body{margin:0}${LETTER_CSS}</style></head><body>${await letterHtml(l)}<script>setTimeout(function(){print()},700)<\/script></body></html>`);
  w.document.close();
}

/* ---------- layar ---------- */
export default async function surat(el) {
  if (!TYPES) TYPES = await db.get('pk_letter_types', 'select=*&is_active=eq.true&order=sort');
  ROLE = await db.rpc('pk_letter_role');
  if (!ROLE) { el.innerHTML = '<div class="card"><p class="muted">Akun Anda belum terdaftar di Data Karyawan.</p></div>'; return; }
  const list = await db.rpc('pk_letter_list', { p_q: S.q || null });
  const toSign = list.filter(l => l.mine_to_sign);
  const tabs = [['buat', 'Buat surat'], ['setuju', `Perlu saya setujui${toSign.length ? ' (' + toSign.length + ')' : ''}`], ['arsip', 'Arsip'], ...(ROLE.asset ? [['aset', 'Unit belum siap surat']] : [])];
  const hasTeam = (ROLE.team || []).length > 0;
  const can = { ST: true, SKK: true, SPK: ROLE.admin || ROLE.rec, SP: ROLE.admin || hasTeam, SKA: ROLE.asset };
  let body = '';
  if (S.tab === 'buat') {
    body = `<div class="ucards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">${TYPES.filter(t => can[t.code]).map(t => `<button type="button" class="card" data-new="${t.code}" style="text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px">
      <span class="chip gray" style="align-self:flex-start">${esc(t.code)}</span><b style="font-size:16px">${esc(t.name)}</b><span class="muted small">${esc(DESC[t.code] || '')}</span>
      <span class="small" style="color:#077A70;font-weight:700">${t.code === 'SKK' && !ROLE.admin ? 'Minta untuk diri sendiri →' : 'Buat →'}</span></button>`).join('')}</div>
      <div class="note" style="margin-top:12px">Nomor surat dibuat otomatis saat terbit (contoh <b>001/ST/RA/XI/2026</b>). Surat yang ditandatangani orang lain menunggu persetujuannya dulu. Tanpa tanda tangan basah: nama penanda tangan + QR verifikasi.</div>`;
  }
  if (S.tab === 'setuju') body = toSign.length ? rows(toSign) : '<div class="card"><p class="muted">Tidak ada surat yang menunggu persetujuan Anda.</p></div>';
  if (S.tab === 'arsip') body = `<div class="row" style="gap:8px;margin-bottom:10px"><input class="inp" id="sq" placeholder="Cari nomor, nama, plat, atau kode unit…" value="${esc(S.q)}" style="max-width:420px;height:40px"><button class="btn" id="sgo" type="button">Cari</button></div>${list.length ? rows(list) : '<div class="card"><p class="muted">Belum ada surat.</p></div>'}`;
  if (S.tab === 'aset') body = '<div id="aset"><p class="muted">Memuat data aset…</p></div>';

  el.innerHTML = `<header class="ph"><div><span class="muted small">Surat resmi PT Popo Karya Investama · bernomor, ber-QR, tersimpan di arsip</span><h1>Surat</h1></div></header>
    <div class="chips">${tabs.map(([k, l]) => `<button class="chipbtn${S.tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  const re = () => surat(el);
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; re(); });
  el.querySelectorAll('[data-new]').forEach(b => b.onclick = () => newLetter(TYPES.find(t => t.code === b.dataset.new), re));
  el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openLetter(list.find(l => l.id === b.dataset.open), re));
  const go = () => { S.q = el.querySelector('#sq').value.trim(); re(); };
  el.querySelector('#sgo')?.addEventListener('click', go); el.querySelector('#sq')?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  if (S.tab === 'aset') drawAssets(el.querySelector('#aset'));
}
function rows(list) {
  return `<div class="stack">${list.map(l => `<button type="button" class="card" data-open="${l.id}" style="text-align:left;cursor:pointer;width:100%;display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
    <span><b>${esc(l.title)}</b><span class="muted small" style="display:block">${l.number ? esc(l.number) + ' · ' : ''}${fdate(l.letter_date)} · ttd ${esc(l.signer_name || '')}${l.valid_until ? ' · berlaku s.d. ' + fdate(l.valid_until) : ''}</span></span>${stChip(l.status)}</button>`).join('')}</div>`;
}

async function drawAssets(box) {
  let A = [];
  try { A = await db.rpc('pk_letter_assets', { p_q: null, p_only_missing: false }); } catch (e) { box.innerHTML = `<p class="form-err">${esc(e.message)}</p>`; return; }
  const miss = A.filter(a => a.missing.length);
  const cnt = {}; miss.forEach(a => a.missing.forEach(m => cnt[m] = (cnt[m] || 0) + 1));
  box.innerHTML = `<div class="note">${miss.length} dari ${A.length} motor & mobil belum siap surat. Lengkapi di Rentalaja App → Aset (data unit). Ditugaskan: Fajar, Yusril, Dzikri.</div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0">${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="chip gray">${esc(k)} kosong: <b>${n}</b></span>`).join('')}</div>
    <div class="scroll-x"><table class="tbl"><thead><tr><th>Unit</th><th>Plat</th><th>Cabang</th><th>Yang kurang</th></tr></thead><tbody>${miss.map(a => `<tr><td><b>${esc(a.code)}</b><br><span class="muted small">${esc(a.product)}</span></td><td>${esc(a.plate || '—')}</td><td>${esc(a.branch || '—')}</td><td class="small">${a.missing.map(esc).join(', ')}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- buat surat ---------- */
function defaultSigner(t, subj) {
  if (t.signer === 'ceo') return (byRole('ceo')[0] || {}).id;
  if (t.signer === 'kepala_staf') return (byRole('kepala_staf')[0] || byRole('ceo')[0] || {}).id;
  const team = ROLE.team || [];
  if (subj.length && subj.every(id => id === ROLE.me || team.includes(id)) && (team.length || ROLE.admin)) return ROLE.me;
  const p = ctx.byId[subj[0] || ROLE.me]; return (p && p.boss_id) || (byRole('kepala_staf')[0] || {}).id;
}
async function newLetter(t, re) {
  const team = ROLE.team || [];
  const pool = ROLE.admin ? people() : people().filter(p => p.id === ROLE.me || team.includes(p.id));
  let subjHtml = '', cands = [], assets = [];
  if (t.subject === 'people') subjHtml = field('Karyawan yang ditugaskan', `<div class="stack" style="gap:4px;max-height:220px;overflow:auto;border:1px solid #E1E5EA;border-radius:10px;padding:8px">${pool.map(p => `<label class="chk"><input type="checkbox" name="pp_${p.id}"${p.id === ROLE.me && !ROLE.admin && !team.length ? ' checked' : ''}> ${esc(p.nickname || p.name)} <span class="muted small">· ${esc(p.title || '')}</span></label>`).join('')}</div>`);
  if (t.subject === 'person') {
    const list = t.code === 'SKK' && !ROLE.admin ? people().filter(p => p.id === ROLE.me) : t.code === 'SP' && !ROLE.admin ? people().filter(p => team.includes(p.id)) : people();
    subjHtml = field('Karyawan', `<select class="inp" name="person">${opts(list.map(p => [p.id, (p.nickname || p.name) + ' · ' + (p.title || '')]), t.code === 'SKK' && !ROLE.admin ? ROLE.me : '', list.length > 1 ? '— pilih —' : undefined)}</select>`);
  }
  if (t.subject === 'candidate') {
    const B = await db.rpc('rec_board', { p_job: null }).catch(() => ({ apps: [], jobs: [] }));
    const jobs = Object.fromEntries((B.jobs || []).map(j => [j.id, j]));
    cands = (B.apps || []).filter(a => ['wawancara', 'tawaran', 'review'].includes(a.stage));
    subjHtml = field('Pelamar', `<select class="inp" name="app">${opts(cands.map(a => [a.id, a.cand.name + ' · ' + (jobs[a.job_id]?.title || 'talent pool') + ' (' + a.stage + ')']), '', '— pilih pelamar —')}</select>`, 'Pelamar tahap review, wawancara, atau tawaran');
    t._jobs = jobs; t._cands = cands;
  }
  if (t.subject === 'assets') {
    assets = await db.rpc('pk_letter_assets', { p_q: null, p_only_missing: false });
    const ready = assets.filter(a => !a.missing.length);
    subjHtml = field(`Unit (${ready.length} siap dari ${assets.length})`, ready.length ? `<div class="stack" style="gap:4px;max-height:240px;overflow:auto;border:1px solid #E1E5EA;border-radius:10px;padding:8px">${ready.map(a => `<label class="chk"><input type="checkbox" name="as_${a.id}"> ${esc(a.code)} · ${esc(a.plate || '')} <span class="muted small">· ${esc(a.product)}${a.investor ? ' · unit investor' : ''}</span></label>`).join('')}</div>`
      : `<p class="form-err" style="display:block">Belum ada unit yang datanya lengkap. Lihat tab "Unit belum siap surat".</p>`);
  }
  const fieldsHtml = (t.fields || []).map(f => field(f.label + (f.req ? '' : ''), f.type === 'textarea' ? `<textarea class="inp" name="f_${f.k}" rows="3" placeholder="${esc(f.ph || '')}"></textarea>`
    : f.type === 'select' ? `<select class="inp" name="f_${f.k}">${opts(f.opts, '', '— pilih —')}</select>` : `<input class="inp" type="${f.type === 'date' ? 'date' : 'text'}" name="f_${f.k}" placeholder="${esc(f.ph || '')}">`)).join('');
  const signers = t.signer === 'boss' ? people().filter(p => ['ceo', 'kepala_staf', 'leader'].includes(p.role) || team.length && p.id === ROLE.me) : people().filter(p => ['ceo', 'kepala_staf'].includes(p.role));
  const pick = (f) => {
    const subj = t.subject === 'people' ? pool.filter(p => f['pp_' + p.id]).map(p => p.id) : t.subject === 'person' ? [f.person].filter(Boolean) : [];
    const fields = Object.fromEntries((t.fields || []).map(x => [x.k, (f['f_' + x.k] || '').trim()]));
    return { type: t.code, biz: f.biz, people: subj, candidate_app: f.app || null, assets: t.subject === 'assets' ? assets.filter(a => f['as_' + a.id]).map(a => a.id) : [], fields, signer_id: f.signer, letter_date: f.letter_date };
  };
  const firstBiz = () => { const p = ctx.byId[ROLE.me]; return p ? bizOf(p.unit_code) : 'HQ'; };
  const draft = await modal(t.name, `${subjHtml}${fieldsHtml}
    <div class="g2">${t.subject === 'assets' ? '<input type="hidden" name="biz" value="RA">' : field('Unit bisnis (untuk nomor surat)', `<select class="inp" name="biz">${opts(BIZ, ['HQ', 'RA', 'WG', 'NA'].includes(firstBiz()) ? firstBiz() : 'HQ')}</select>`)}
      ${field('Tanggal surat', `<input class="inp" type="date" name="letter_date" value="${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)}">`)}</div>
    ${field('Penanda tangan', `<select class="inp" name="signer" id="sg">${opts(signers.map(p => [p.id, (p.nickname || p.name) + ' · ' + (p.title || '')]), '')}</select>`, t.signer === 'boss' ? 'Sesuai tingkatan: atasan langsung yang ditugaskan' : t.signer === 'kepala_staf' ? 'Sesuai tingkatan: Kepala Staf' : 'Sesuai tingkatan: CEO')}
    <div id="sphint"></div>`, { submit: 'Pratinjau', wide: true, onSubmit: async (f) => pick(f) });
  // default penanda tangan & petunjuk SP diisi sesudah modal tampil (lihat listener di bawah)
  if (!draft) return;
  await preview(t, draft, re);
}
document.addEventListener('modal:open', (e) => {
  const form = e.detail; const sg = form.querySelector('#sg'); if (!sg || !TYPES) return;
  const title = form.closest('.modal')?.getAttribute('aria-label'); const t = TYPES.find(x => x.name === title); if (!t) return;
  const subj = () => [...form.querySelectorAll('input[type=checkbox][name^=pp_]:checked')].map(i => i.name.slice(3)).concat(form.person && form.person.value ? [form.person.value] : []);
  const setSigner = () => { const id = defaultSigner(t, subj()); if (id && [...sg.options].some(o => o.value === id)) sg.value = id; };
  setSigner(); form.addEventListener('change', async (ev) => {
    if (ev.target.name && (ev.target.name.startsWith('pp_') || ev.target.name === 'person')) setSigner();
    if (t.code === 'SP' && ev.target.name === 'person' && ev.target.value) {
      const h = await db.rpc('pk_letter_sp_hint', { p_person: ev.target.value }).catch(() => []);
      const box = form.querySelector('#sphint'); const lv = form.f_level;
      box.innerHTML = h.length ? `<div class="note">Masih punya ${h.map(x => `SP ${x.level} (${esc(x.number)}, berlaku s.d. ${fdate(x.valid_until)})`).join(', ')}. Disarankan SP ${Math.min(3, Math.max(...h.map(x => x.level)) + 1)}.</div>` : '<div class="note">Belum punya SP yang berlaku. Disarankan SP 1.</div>';
      if (lv && !lv.value) lv.value = String(h.length ? Math.min(3, Math.max(...h.map(x => x.level)) + 1) : 1);
    }
  });
});

async function preview(t, p, re) {
  // pratinjau di sisi klien memakai data yang sama dengan yang akan dipotret server
  const d = { perusahaan: 'PT Popo Karya Investama' };
  if (t.subject === 'people' || t.subject === 'person') {
    const ps = p.people.map(id => ctx.byId[id]).filter(Boolean);
    d.people = ps.map(q => ({ Nama: q.name, Jabatan: q.title || '', Unit: (ctx.unit[q.unit_code] || {}).name || '—' }));
    const q = ps[0] || {}; Object.assign(d, { nama: q.name, jabatan: q.title, unit: (ctx.unit[q.unit_code] || {}).name, tgl_masuk: q.joined_on ? tglID(q.joined_on) : '' });
  }
  if (t.subject === 'candidate') { const a = (t._cands || []).find(x => x.id === p.candidate_app); if (a) { d.people = [{ Nama: a.cand.name, Kota: a.cand.city || '—' }]; d.nama = a.cand.name; d.unit = (ctx.unit[(t._jobs[a.job_id] || {}).unit_code] || {}).name; } }
  if (t.subject === 'assets') d.assets = (await db.rpc('pk_letter_assets', { p_q: null, p_only_missing: false })).filter(a => p.assets.includes(a.id));
  Object.entries(p.fields).forEach(([k, v]) => { d[k] = (t.fields.find(f => f.k === k) || {}).type === 'date' && v ? tglID(v) : v; });
  if (t.code === 'SP' && p.fields.level) d.level_romawi = ['I', 'II', 'III'][+p.fields.level - 1];
  const sg = ctx.byId[p.signer_id] || {};
  const boss = t.code === 'SP' && p.people[0] ? ctx.byId[(ctx.byId[p.people[0]] || {}).boss_id] : null;
  const l = { status: 'menunggu', data: d, tpl: t.tpl, letter_date: p.letter_date, signer_name: sg.name, signer_title: sg.title, known_name: boss && boss.name, known_title: boss && boss.title };
  const self = p.signer_id === ROLE.me;
  const ok = await modal('Pratinjau ' + t.name, `<style>${LETTER_CSS}.pv{overflow:auto;background:#EEF0F3;border-radius:12px;padding:12px}.pv .letter{transform:scale(.62);transform-origin:top left;margin-bottom:-420px;margin-right:-300px}</style><div class="pv">${await letterHtml(l)}</div>
    <p class="small muted" style="margin-top:8px">${self ? 'Anda penanda tangan: surat langsung terbit, nomor dikunci, dan QR verifikasi aktif.' : 'Surat dikirim ke ' + esc(sg.nickname || sg.name || 'penanda tangan') + ' untuk disetujui. Nomor dibuat saat disetujui.'}</p>`,
    { wide: true, submit: self ? 'Terbitkan' : 'Kirim untuk disetujui', onSubmit: async () => await db.rpc('pk_letter_create', { p }) });
  if (ok) { toast(ok.status === 'terbit' ? 'Surat terbit' : 'Menunggu persetujuan'); S.tab = ok.status === 'terbit' ? 'arsip' : 'arsip'; re(); }
}

/* ---------- buka surat ---------- */
async function openLetter(l, re) {
  CUR = l;
  const canCancel = ['menunggu', 'terbit'].includes(l.status) && (isAdmin() || l.signer_id === ROLE.me || (l.created_by === ROLE.me && l.status === 'menunggu'));
  const wa = l.status === 'terbit' ? 'https://wa.me/?text=' + encodeURIComponent(`${l.title}\nNomor ${l.number}\nCek keaslian: ${VERIFY}${l.verify_key}`) : '';
  const res = await modal(l.number || 'Surat', `<style>${LETTER_CSS}.pv{overflow:auto;background:#EEF0F3;border-radius:12px;padding:12px}.pv .letter{transform:scale(.62);transform-origin:top left;margin-bottom:-420px;margin-right:-300px}</style>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${stChip(l.status)}<button type="button" class="btn" data-a="pdf">Unduh PDF</button><button type="button" class="btn" data-a="print">Cetak</button>${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener">Kirim via WA</a>` : ''}</div>
    ${l.cancel_reason ? `<div class="note">Dibatalkan: ${esc(l.cancel_reason)}</div>` : ''}${l.decided_note ? `<div class="note">Catatan penolakan: ${esc(l.decided_note)}</div>` : ''}
    <div class="pv">${await letterHtml(l)}</div>${l.mine_to_sign ? field('Catatan bila menolak', '<input class="inp" name="note">') : ''}${canCancel ? field('Alasan bila membatalkan', '<input class="inp" name="reason" placeholder="Mis. salah tanggal, diganti surat baru">', 'Surat yang dibatalkan tetap di arsip; QR-nya menampilkan "dibatalkan"') : ''}`,
    { wide: true, submit: l.mine_to_sign ? 'Setujui & terbitkan' : null, onSubmit: async () => { await db.rpc('pk_letter_decide', { p_id: l.id, p_ok: true, p_note: null }); return 'ok'; },
      extra: l.mine_to_sign ? { label: 'Tolak', onClick: async (f) => { await db.rpc('pk_letter_decide', { p_id: l.id, p_ok: false, p_note: f.note || null }); return 'tolak'; } } : undefined,
      danger: canCancel ? { label: 'Batalkan surat', onClick: async (f) => {
        if (!f.reason || f.reason.trim().length < 5) throw new Error('Tulis alasan pembatalan dulu');
        await db.rpc('pk_letter_cancel', { p_id: l.id, p_reason: f.reason }); return 'batal'; } } : undefined });
  if (res === 'ok') toast('Surat terbit'); if (res === 'tolak') toast('Surat ditolak'); if (res === 'batal') toast('Surat dibatalkan');
  if (res) re();
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.modal [data-a]'); if (!b) return;
  const l = CUR; if (!l) return;
  b.disabled = true; try { b.dataset.a === 'pdf' ? await downloadPdf(l) : await printLetter(l); } catch (er) { toast(er.message, 'err'); } b.disabled = false;
});
export { letterHtml, LETTER_CSS };

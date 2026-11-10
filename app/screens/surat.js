import { ctx, db, esc, toast, modal, field, opts, fdate, bizOf, isAdmin } from '../core.js';

/* Menu Surat: surat resmi bernomor, kop PT, nama + QR verifikasi, arsip. Hak akses dicek ulang di server (pk_letter_*). */
const VERIFY = 'https://pokama.org/cek?k=';
const BIZ = [['HQ', 'Pokama (holding)'], ['RA', 'Rentalaja'], ['WG', 'TripinAja'], ['NA', 'Niagaaja']];
const STATUS = { menunggu: ['Menunggu', '#9A5B00', '#FFF0DC'], terbit: ['Terbit', '#077A70', '#E3F7F5'], ditolak: ['Ditolak', '#C0392B', '#FDE8E6'], batal: ['Dibatalkan', '#4A5468', '#EEF0F3'] };
const DESC = { SJ: 'Bukti tugas runner antar/jemput unit, dari kode booking', BAK: 'Kerusakan atau kehilangan unit, dasar klaim ke penyewa', SM: 'Pindah unit / cabang', SKT: 'Dari kontrak menjadi karyawan tetap', SPJ: 'Naik jabatan', SPI: 'Laporan / pemberitahuan resmi ke investor', SPKS: 'Penawaran ke hotel, villa, mitra B2B', PKWT: 'Perjanjian kerja waktu tertentu untuk karyawan baru / perpanjangan', BAST: 'Serah terima unit antar cabang, ke/dari investor', SKU: 'Kuasa untuk urus STNK, pajak, ambil unit, dll.', STG: 'Tagihan belum lunas/denda, atau teguran unit belum kembali', ST: 'Tugas luar kantor untuk satu atau beberapa orang', SKK: 'Keterangan masih bekerja, untuk bank, beasiswa, dll.', SPK: 'Penawaran kerja untuk pelamar dari Rekrutmen', SP: 'SP 1–3, membaca SP yang masih berlaku', SKA: 'Kepemilikan / pengelolaan unit, dari data aset' };
const GROUPS = [['Karyawan & SDM', ['ST', 'SKK', 'SP', 'PKWT', 'SPK', 'SKT', 'SPJ', 'SM']], ['Operasional sewa', ['SJ', 'BAK', 'STG']], ['Aset', ['SKA', 'BAST', 'SKU']], ['Mitra & investor', ['SPKS', 'SPI']]];
const TIC = {
  ST: ['#E3F7F5', '#077A70', '<path d="M4 7h16v12H4z"/><path d="M9 7V5h6v2M4 12h16"/>'],
  SKK: ['#E6EFFD', '#1E5AA8', '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'],
  SP: ['#FDE8E6', '#C0392B', '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>'],
  PKWT: ['#EFEDFF', '#5B4BC4', '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 13h6M10 17h4"/>'],
  SPK: ['#E5F4E4', '#2E7D32', '<path d="M4 8h16v11H4z"/><path d="m4 9 8 6 8-6"/>'],
  SKA: ['#FFF0DC', '#9A5B00', '<circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M4.5 17H3v-4l3-5h7l3 5h3l2 2v2h-1.5M9.5 17h5"/>'],
  BAST: ['#E3F7F5', '#077A70', '<path d="M3 12h7l-2-2M21 12h-7l2 2"/><path d="M8 7h8M8 17h8"/>'],
  SKU: ['#EEF0F3', '#1F2B4D', '<path d="M8 11V7a4 4 0 0 1 8 0v4"/><rect x="5" y="11" width="14" height="10" rx="2"/>'],
  STG: ['#FDE8E6', '#C0392B', '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>'],
  SJ: ['#E3F7F5', '#077A70', '<path d="M3 17h2l2-6h8l2 6h4"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M12 5v6"/>'],
  BAK: ['#FFF0DC', '#9A5B00', '<path d="M9 3h6v4H9z"/><path d="M5 7h14v14H5z"/><path d="m10 12 4 4M14 12l-4 4"/>'],
  SM: ['#E6EFFD', '#1E5AA8', '<path d="M4 9h13l-3-3M20 15H7l3 3"/>'],
  SKT: ['#E5F4E4', '#2E7D32', '<circle cx="12" cy="9" r="5"/><path d="m9 13-1 8 4-2 4 2-1-8"/>'],
  SPJ: ['#EFEDFF', '#5B4BC4', '<path d="M12 20V5M6 11l6-6 6 6"/>'],
  SPI: ['#E6EFFD', '#1E5AA8', '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'],
  SPKS: ['#E5F4E4', '#2E7D32', '<path d="M7 12l3 3 7-7"/><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/>'],
};
const tic = (c, sz = 22) => { const x = TIC[c] || TIC.SKU; return `<span style="width:44px;height:44px;border-radius:13px;background:${x[0]};color:${x[1]};display:grid;place-items:center;flex:none"><svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${x[2]}</svg></span>`; };
const SCSS = `<style>.sr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:10px}
.sr-tile{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:#fff;border:1px solid #E6E9EE;border-radius:16px;padding:12px 14px;cursor:pointer;font:inherit;color:#1F2B4D;transition:border-color .15s,box-shadow .15s,transform .1s}
.sr-tile:hover{border-color:#09BEAF;box-shadow:0 4px 14px rgba(31,43,77,.08)}.sr-tile:active{transform:scale(.99)}
.sr-tile b{display:block;font-size:15px;line-height:1.3}.sr-tile small{display:block;color:#5B6577;font-size:12.5px;line-height:1.4;margin-top:2px}
.sr-tile .code{margin-left:auto;font-size:11px;font-weight:800;color:#8A93A6;letter-spacing:.04em;flex:none}
.sr-h{margin:18px 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5B6577}
.sr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:4px 0 14px}
.sr-stat{background:#fff;border:1px solid #E6E9EE;border-radius:16px;padding:12px 14px}.sr-stat span{display:block;font-size:12px;color:#5B6577;font-weight:600}.sr-stat b{font-size:22px;line-height:1.2}
.sr-stat.hot{background:#FFF8EC;border-color:#F1D9AE}.sr-stat.hot b{color:#9A5B00}
.sr-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:#fff;border:1px solid #E6E9EE;border-radius:16px;padding:12px 14px;cursor:pointer;font:inherit;color:#1F2B4D}
.sr-row:hover{border-color:#09BEAF}.sr-row .t{flex:1;min-width:0}.sr-row b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sr-row small{display:block;color:#5B6577;font-size:12px}
@media (max-width:560px){.sr-stats{gap:8px}.sr-stat{padding:10px 12px}.sr-stat b{font-size:19px}}</style>`;
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
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (d[k] == null || d[k] === '' ? '…' : (['perusahaan', 'level_romawi', 'jenis_judul', 'penanda_tangan', 'jabatan_ttd'].includes(k) ? esc(d[k]) : '<b>' + esc(d[k]) + '</b>')))
    .split('\n').join('<br>');
}
function subjectTable(l) {
  const d = l.data || {};
  if (d.booking) { const noPay = (l.tpl || {}).no_pay; const b = d.booking, rp = (n) => 'Rp' + Math.round(+n || 0).toLocaleString('id-ID'), dt = (x) => x ? tglID(String(x).slice(0, 10)) : '—';
    return `<table class="kv"><tr><td>Kode booking</td><td>:</td><td><b>${esc(b.code)}</b></td></tr><tr><td>Barang / unit</td><td>:</td><td><b>${esc(b.items || '—')}</b></td></tr><tr><td>Periode sewa</td><td>:</td><td><b>${dt(b.start)} – ${dt(b.end)}</b></td></tr><tr><td>Cabang</td><td>:</td><td><b>${esc(b.branch || '—')}</b></td></tr></table>
    ${noPay ? '' : `<table class="lt"><thead><tr><th>Total sewa</th><th>Denda keterlambatan</th><th>Biaya kerusakan</th><th>Sudah dibayar</th><th>Sisa</th></tr></thead><tbody><tr><td>${rp(b.total)}</td><td>${rp(b.late_fee)}</td><td>${rp(b.damage_fee)}</td><td>${rp(b.paid)}</td><td><b>${rp(b.sisa)}</b></td></tr></tbody></table>`}`; }
  if (d.assets) return `<table class="lt"><thead><tr><th>Unit</th><th>Plat</th><th>No. rangka / mesin</th><th>BPKB</th><th>STNK s.d.</th><th>Keterangan</th></tr></thead><tbody>${d.assets.map(a => `<tr>
    <td><b>${esc(a.product || '')}</b><br><small>${esc(a.code || '')}${a.color ? ' · ' + esc(a.color) : ''}${a.branch ? ' · ' + esc(a.branch) : ''}</small></td><td>${esc(a.plate || '—')}</td>
    <td>${esc(a.frame_no || '—')}<br>${esc(a.engine_no || '—')}</td><td>a.n. ${esc(a.bpkb_name || '—')}<br><small>disimpan: ${esc(a.bpkb_location || '—')}</small></td>
    <td>${a.stnk_due ? tglID(a.stnk_due) : '—'}</td><td>${a.investor ? 'Dikelola Rentalaja' : 'Aset ' + esc(d.perusahaan || 'perusahaan') + ', dikelola Rentalaja'}</td></tr>`).join('')}</tbody></table>`;
  const ps = d.people || [];
  if (!ps.length || ['SPI', 'SPKS'].includes(l.type)) return '';
  if (ps.length === 1) return `<table class="kv">${Object.entries(ps[0]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>:</td><td><b>${esc(v || '—')}</b></td></tr>`).join('')}</table>`;
  const cols = Object.keys(ps[0] || {});
  return `<table class="lt"><thead><tr><th>No</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${ps.map((p, i) => `<tr><td>${i + 1}</td>${cols.map((c, ci) => `<td>${ci === 0 ? '<b>' + esc(p[c] || '—') + '</b>' : esc(p[c] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
async function qrSvg(text) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
}
const LETTER_CSS = `
.letter{width:794px;height:1123px;box-sizing:border-box;background:#fff;position:relative;overflow:hidden;color:#1F2B4D;font:13.5px/1.75 'Plus Jakarta Sans',Arial,sans-serif}
.letter .in{padding:0 64px 70px}
.letter .kop{display:flex;justify-content:space-between;align-items:center;background:#1F2B4D;margin:0 -64px;padding:28px 64px;border-bottom:5px solid #09BEAF}
.letter .kop img{height:38px;width:auto;background:#fff;border-radius:10px;padding:6px 10px}
.letter .co{text-align:right;font-size:11.5px;line-height:1.55;color:#C9D1E2}.letter .co b{display:block;color:#fff;font-size:13px;letter-spacing:.06em}
.letter .eb{margin-top:26px;font-size:11px;font-weight:800;letter-spacing:.14em;color:#077A70}
.letter h1{margin:4px 0 0;font-size:26px;line-height:1.2;letter-spacing:-.01em}
.letter .meta{margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #E2E6EC;border-radius:12px;overflow:hidden}
.letter .meta div{padding:10px 14px;font-size:13.5px;font-weight:700;line-height:1.4}.letter .meta div+div{border-left:1px solid #E2E6EC}
.letter .meta span{display:block;font-size:10.5px;color:#5B6573;letter-spacing:.06em;font-weight:700}
.letter p{margin:16px 0 0;color:#2B3550;text-align:justify}
.letter table.lt{width:100%;border-collapse:separate;border-spacing:0;margin-top:12px;font-size:12.5px;line-height:1.5;border:1px solid #E2E6EC;border-radius:12px;overflow:hidden}
.letter table.lt th{background:#F4F6F9;text-align:left;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#5B6573;padding:9px 12px}
.letter table.lt td{padding:9px 12px;border-top:1px solid #E2E6EC;vertical-align:top}.letter table.lt small{color:#5B6573}
.letter table.kv{margin-top:10px;border-collapse:collapse;line-height:1.5;font-size:13.5px;color:#1F2B4D}.letter table.kv td{padding:4px 14px 4px 0;vertical-align:top}.letter table.kv td:first-child{color:#5B6573;min-width:120px}
.letter .sign{margin-top:30px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.letter .kn{font-size:13px;line-height:1.6}
.letter .sb{width:340px;font-size:13px;line-height:1.6}
.letter .ver{margin-top:12px;display:flex;gap:14px;align-items:center;border:1.5px solid #09BEAF;border-radius:14px;padding:12px;background:#F2FBFA}
.letter .ver.pending{border-style:dashed;border-color:#C9A15A;background:#FFF8EC}
.letter .qr{width:78px;height:78px;flex:none;background:#fff;border-radius:6px;padding:4px;box-sizing:border-box}.letter .qr svg{width:100%;height:100%;display:block}
.letter .ver small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.08em;color:#077A70}.letter .ver.pending small{color:#9A5B00}
.letter .ver b{display:block;font-size:15px;line-height:1.35}.letter .ver span{display:block;font-size:11px;color:#5B6573;line-height:1.4}
.letter .valid{margin-top:16px;font-size:12px;color:#5B6573}
.letter .mark{position:absolute;top:46%;left:0;right:0;text-align:center;font-size:64px;font-weight:800;color:rgba(192,57,43,.12);transform:rotate(-18deg);pointer-events:none;letter-spacing:.06em}
.letter .foot{position:absolute;left:0;right:0;bottom:0;padding:14px 64px;background:#1F2B4D;color:#C9D1E2;font-size:11px;display:flex;justify-content:space-between;align-items:center}
.letter .foot .u{display:flex;gap:14px}.letter .foot .u span{display:flex;gap:6px;align-items:center;color:#fff;font-weight:700}.letter .foot img{height:16px;width:16px;background:#fff;border-radius:4px;padding:2px;object-fit:contain}`;
const BIZNAME = { HQ: 'Pokama', RA: 'Rentalaja', WG: 'TripinAja', NA: 'Niagaaja' };
async function letterHtml(l) {
  const d = l.data || {}, tpl = l.tpl || {};
  const issued = l.status === 'terbit' || (l.status === 'batal' && l.number);
  const qr = issued && l.verify_key ? await qrSvg(VERIFY + l.verify_key) : '';
  const mark = l.status === 'batal' ? 'DIBATALKAN' : l.status === 'terbit' ? '' : l.status === 'ditolak' ? 'DITOLAK' : 'DRAF';
  const pt = d.perusahaan || 'PT Popo Karya Investama';
  const title = fill(tpl.title, d).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()).replace(/\b(Ii|Iii)\b/g, m => m.toUpperCase());
  return `<div class="letter">${mark ? `<div class="mark">${mark}</div>` : ''}<div class="in">
    <div class="kop"><img src="/img/pokama-logo.png" alt="Pokama"><div class="co"><b>${esc(pt.toUpperCase())}</b>Induk Rentalaja, TripinAja, dan Niagaaja<br>Garut, Jawa Barat · pokama.org</div></div>
    <div class="eb">SURAT RESMI</div><h1>${title}</h1>
    <div class="meta"><div><span>NOMOR</span>${esc(l.number || 'Otomatis saat terbit')}</div><div><span>TANGGAL</span>${tglID(l.letter_date)}</div><div><span>UNIT BISNIS</span>${esc(BIZNAME[l.biz] || 'Pokama')}</div></div>
    <p>${fill(tpl.opening, d)}</p>${subjectTable(l)}<p>${fill(tpl.after, d)}</p><p>${fill(tpl.closing, d)}</p>
    <div class="sign">${l.known_name ? `<div class="kn">${esc(d.known_label || 'Mengetahui,')}<br>${esc(l.known_title || 'Atasan langsung')}<br><br><br><b>${esc(l.known_name)}</b></div>` : '<div></div>'}
      <div class="sb">Garut, ${tglID(l.letter_date)}<br>${esc(l.signer_title || '')}, ${esc(pt)}
        <div class="ver${issued ? '' : ' pending'}">${qr ? `<div class="qr">${qr}</div>` : ''}<div><small>${issued ? '✓ DISETUJUI ELEKTRONIK' : 'MENUNGGU PERSETUJUAN'}</small><b>${esc(l.signer_name || '')}</b><span>${issued ? 'Pindai QR atau buka pokama.org/cek untuk memeriksa keaslian.' : 'Nomor dan QR aktif setelah disetujui.'}</span></div></div></div></div>
    ${l.valid_until ? `<div class="valid">Berlaku sampai ${tglID(l.valid_until)}.</div>` : ''}</div>
    <div class="foot"><div class="u"><span><img src="/img/ra.png" alt="">Rentalaja</span><span><img src="/img/tr.png" alt="">TripinAja</span><span><img src="/img/na.png" alt="">Niagaaja</span></div><div>${l.number ? esc(l.number) + ' · ' : ''}pokama.org/cek</div></div></div>`;
}
function fitPv() {
  requestAnimationFrame(() => document.querySelectorAll('.pv').forEach(pv => {
    const sc = pv.querySelector('.sc'), lt = pv.querySelector('.letter'); if (!sc || !lt) return;
    const k = Math.min(1, (pv.clientWidth - 24) / 794);
    sc.style.width = Math.floor(794 * k) + 'px'; sc.style.height = Math.floor(1123 * k) + 'px'; lt.style.transform = `scale(${k})`;
  }));
}
addEventListener('resize', fitPv);
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
let LIST = null, ASSETS = null;
/* data dimuat sekali per kunjungan; pindah tab / cari tidak memanggil server lagi */
async function load(force) {
  const jobs = [];
  if (!TYPES) jobs.push(db.get('pk_letter_types', 'select=*&is_active=eq.true&order=sort').then(x => TYPES = x));
  if (!ROLE || force) jobs.push(db.rpc('pk_letter_role').then(x => ROLE = x));
  if (!LIST || force) jobs.push(db.rpc('pk_letter_list', { p_q: null }).then(x => LIST = x || []));
  await Promise.all(jobs);
}
export default async function surat(el, params) {
  const tab = params && params.get && params.get('tab');
  S.tab = ['buat', 'setuju', 'arsip', 'aset'].includes(tab) ? tab : 'buat';
  if (LIST) { render(el); load(true).then(() => { if (el.isConnected && document.activeElement?.id !== 'sq' && !document.querySelector('.modal-wrap')) render(el); }).catch(() => {}); return; }  // tampil langsung dari cache, segarkan di belakang
  el.innerHTML = '<header class="ph"><div><h1>Surat</h1></div></header><div class="card"><p class="muted">Memuat…</p></div>';
  await load(false);
  render(el);
}
const matchQ = (l, q) => !q || [l.number, l.title, ...(l.data?.assets || []).flatMap(a => [a.plate, a.code])].some(x => String(x || '').toLowerCase().includes(q));
function render(el) {
  if (!ROLE) { el.innerHTML = '<div class="card"><p class="muted">Akun Anda belum terdaftar di Data Karyawan.</p></div>'; return; }
  const all = LIST || [];
  const list = all.filter(l => matchQ(l, (S.q || '').toLowerCase()));
  const toSign = all.filter(l => l.mine_to_sign);
  const tabs = [['buat', 'Buat surat'], ['setuju', `Perlu saya setujui${toSign.length ? ' (' + toSign.length + ')' : ''}`], ['arsip', 'Arsip'], ...(ROLE.asset ? [['aset', 'Unit belum siap surat']] : [])];
  const hasTeam = (ROLE.team || []).length > 0;
  const meU = (ctx.byId[ROLE.me] || {}).unit_code; const inRA = meU && bizOf(meU) === 'RA';
  const canMake = (t) => { if (ROLE.admin) return true; if (!t.makers) return null; const m = t.makers; return (m.includes('rec') && ROLE.rec) || (m.includes('asset') && ROLE.asset) || (m.includes('ra') && inRA) || (m.includes('keuangan') && ROLE.role === 'keuangan') || (m.includes('bizdev') && ['BIZ', 'MKT'].includes(meU)) || (m.includes('leader') && ROLE.role === 'leader'); };
  const can0 = { ST: true, SKK: true, SPK: ROLE.admin || ROLE.rec, SP: ROLE.admin || hasTeam, SKA: ROLE.asset, PKWT: ROLE.admin || ROLE.rec, BAST: ROLE.asset, SKU: ROLE.admin, STG: ROLE.admin || ROLE.asset || ROLE.role === 'keuangan' || inRA };
  const can = Object.fromEntries(TYPES.map(t => { const m = canMake(t); return [t.code, m === null ? !!can0[t.code] : !!m]; }));
  let body = '';
  if (S.tab === 'buat') {
    const avail = TYPES.filter(t => can[t.code]); const tmap = Object.fromEntries(avail.map(t => [t.code, t]));
    const ym = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const mine = all.filter(l => l.created_by === ROLE.me && l.status === 'menunggu').length;
    body = `<div class="sr-stats"><div class="sr-stat${toSign.length ? ' hot' : ''}"><span>Perlu saya setujui</span><b>${toSign.length}</b></div><div class="sr-stat"><span>Ajuan saya menunggu</span><b>${mine}</b></div><div class="sr-stat"><span>Terbit bulan ini</span><b>${all.filter(l => l.status === 'terbit' && (l.issued_at || '').slice(0, 7) === ym).length}</b></div></div>
      ${GROUPS.map(([g, codes]) => { const ts = codes.map(c => tmap[c]).filter(Boolean); return ts.length ? `<div class="sr-h">${g}</div><div class="sr-grid">${ts.map(t => `<button type="button" class="sr-tile" data-new="${t.code}">${tic(t.code)}<span style="min-width:0"><b>${esc(t.name)}</b><small>${esc(t.code === 'SKK' && !ROLE.admin ? 'Minta untuk diri sendiri' : DESC[t.code] || '')}</small></span><span class="code">${esc(t.code)}</span></button>`).join('')}</div>` : ''; }).join('')}
      ${all.length ? `<div class="sr-h">Terakhir</div>${rows(all.slice(0, 3))}` : ''}
      <p class="muted small" style="margin-top:14px">Nomor surat otomatis saat terbit (contoh 001/ST/RA/XI/2026). Surat yang ditandatangani orang lain menunggu persetujuannya. Tanpa tanda tangan basah: nama penanda tangan + QR verifikasi.</p>`;
  }
  if (S.tab === 'setuju') body = toSign.length ? rows(toSign) : '<div class="card"><p class="muted">Tidak ada surat yang menunggu persetujuan Anda.</p></div>';
  if (S.tab === 'arsip') body = `<div class="row" style="gap:8px;margin-bottom:10px"><input class="inp" id="sq" type="search" placeholder="Cari nomor, nama, plat, atau kode unit…" value="${esc(S.q)}" style="max-width:420px;height:40px"></div>${list.length ? rows(list) : '<div class="card"><p class="muted">Belum ada surat.</p></div>'}`;
  if (S.tab === 'aset') body = '<div id="aset"><p class="muted">Memuat data aset…</p></div>';

  el.innerHTML = SCSS + `<header class="ph"><div><span class="muted small">Surat resmi PT Popo Karya Investama · bernomor, ber-QR, tersimpan di arsip</span><h1>Surat</h1></div></header>
    <div class="chips" style="flex-wrap:wrap">${tabs.map(([k, l]) => `<button class="chipbtn${S.tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  const re = async () => { await load(true); ASSETS = null; render(el); };
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { if (S.tab === b.dataset.tab) return; location.hash = '#/surat' + (b.dataset.tab === 'buat' ? '' : '?tab=' + b.dataset.tab); });
  el.querySelectorAll('[data-new]').forEach(b => b.onclick = async () => {
    if (b.dataset.busy) return; b.dataset.busy = '1'; b.style.opacity = '.6'; b.style.pointerEvents = 'none';
    try { await newLetter(TYPES.find(t => t.code === b.dataset.new), re); } finally { delete b.dataset.busy; b.style.opacity = ''; b.style.pointerEvents = ''; } });
  el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openLetter(list.find(l => l.id === b.dataset.open), re));
  const sq = el.querySelector('#sq');
  if (sq) { let tm; sq.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { S.q = sq.value.trim(); const pos = sq.selectionStart; render(el); const n = el.querySelector('#sq'); n.focus(); n.setSelectionRange(pos, pos); }, 200); }); }
  if (S.tab === 'aset') drawAssets(el.querySelector('#aset'));
}
function rows(list) {
  return `<div class="stack" style="gap:8px">${list.map(l => `<button type="button" class="sr-row" data-open="${l.id}">${tic(l.type)}<span class="t"><b>${esc(l.title)}</b><small>${l.number ? esc(l.number) + ' · ' : ''}${fdate(l.letter_date)} · ttd ${esc(l.signer_name || '')}${l.valid_until ? ' · s.d. ' + fdate(l.valid_until) : ''}</small></span>${stChip(l.status)}</button>`).join('')}</div>`;
}

async function drawAssets(box) {
  let A = [];
  try { A = ASSETS || (ASSETS = await db.rpc('pk_letter_assets', { p_q: null, p_only_missing: false })); } catch (e) { box.innerHTML = `<p class="form-err">${esc(e.message)}</p>`; return; }
  const miss = A.filter(a => a.missing.length);
  const cnt = {}; miss.forEach(a => a.missing.forEach(m => cnt[m] = (cnt[m] || 0) + 1));
  box.innerHTML = `<div class="card" style="background:#FFF8EC;border:1px solid #F1D9AE;font-size:13.5px">${miss.length} dari ${A.length} motor & mobil belum siap surat. Lengkapi di Rentalaja App → Aset (data unit). Ditugaskan: Fajar, Yusril, Dzikri.</div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0">${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="chip gray">${esc(k)} kosong: <b>${n}</b></span>`).join('')}</div>
    <div class="stack">${miss.map(a => `<div class="card" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><b>${esc(a.code)}</b> <span class="muted small">· ${esc(a.product)}</span><div class="small">${esc(a.plate || 'Plat belum diisi')} · ${esc(a.branch || 'cabang belum diisi')}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${a.missing.map(m => `<span class="chip" style="background:#FFF0DC;color:#9A5B00">${esc(m)}</span>`).join('')}</div></div>`).join('')}</div>`;
}

/* ---------- buat surat ---------- */
function defaultSigner(t, subj) {
  if (t.signer === 'ceo') return (byRole('ceo')[0] || {}).id;
  if (t.signer === 'leader') { const me = ctx.byId[ROLE.me] || {}; if (['ceo', 'kepala_staf', 'leader'].includes(me.role)) return ROLE.me; const b = ctx.byId[me.boss_id]; return b && ['ceo', 'kepala_staf', 'leader'].includes(b.role) ? b.id : (byRole('kepala_staf')[0] || {}).id; }
  if (t.signer === 'kepala_staf') return (byRole('kepala_staf')[0] || byRole('ceo')[0] || {}).id;
  const team = ROLE.team || [];
  if ((team.length || ROLE.admin) && subj.every(id => id === ROLE.me || team.includes(id) || ROLE.admin)) return ROLE.me;
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
    assets = ASSETS || (ASSETS = await db.rpc('pk_letter_assets', { p_q: null, p_only_missing: false }));
    const ready = t.need_complete === false ? assets : assets.filter(a => !a.missing.length);
    subjHtml = field(t.need_complete === false ? `Unit (${assets.length})` : `Unit (${ready.length} siap dari ${assets.length})`, ready.length ? `<div class="stack" style="gap:4px;max-height:240px;overflow:auto;border:1px solid #E1E5EA;border-radius:10px;padding:8px">${ready.map(a => `<label class="chk"><input type="checkbox" name="as_${a.id}"> ${esc(a.code)} · ${esc(a.plate || '')} <span class="muted small">· ${esc(a.product)}${a.investor ? ' · unit investor' : ''}</span></label>`).join('')}</div>`
      : `<p class="form-err" style="display:block">Belum ada unit yang datanya lengkap. Lihat tab "Unit belum siap surat".</p>`);
  }
  if (t.subject === 'investor') { const iv = await db.rpc('pk_letter_investors').catch(() => []); t._inv = iv;
    subjHtml = field('Investor', iv.length ? `<select class="inp" name="investor">${opts(iv.map(x => [x.id, x.name + (x.city ? ' · ' + x.city : '')]), '', '— pilih investor —')}</select>` : '<p class="form-err" style="display:block">Belum ada investor terdaftar di Portal Investor.</p>'); }
  if (t.subject === 'booking') subjHtml = field('Kode booking', `<div style="display:flex;gap:8px"><input class="inp" name="booking" placeholder="RA-2611-0123" style="text-transform:uppercase"><button type="button" class="btn" data-bk>Cek</button></div><div id="bkinfo" class="small muted" style="margin-top:6px"></div>`, 'Nama penyewa dan sisa tagihan diambil otomatis dari data booking');
  const fieldsHtml = (t.fields || []).map(f => field(f.label + (f.req ? '' : ''), f.type === 'textarea' ? `<textarea class="inp" name="f_${f.k}" rows="3" placeholder="${esc(f.ph || '')}"></textarea>`
    : f.type === 'person' ? `<select class="inp" name="f_${f.k}">${opts(Object.values(ctx.byId).filter(p => p.is_active).sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name)).map(p => [p.name, (p.nickname || p.name) + (p.title ? ' · ' + p.title : '')]), '', '— pilih —')}</select>`
    : f.type === 'select' ? `<select class="inp" name="f_${f.k}">${opts(f.opts, '', '— pilih —')}</select>` : `<input class="inp" type="${f.type === 'date' ? 'date' : 'text'}" name="f_${f.k}" placeholder="${esc(f.ph || '')}">`)).join('');
  const bosses = new Set(people().map(p => p.boss_id).filter(Boolean));
  const signers = t.signer === 'boss' ? people().filter(p => ['ceo', 'kepala_staf'].includes(p.role) || bosses.has(p.id)) : t.signer === 'ceo' ? byRole('ceo') : t.signer === 'leader' ? people().filter(p => ['ceo', 'kepala_staf', 'leader'].includes(p.role)) : people().filter(p => ['ceo', 'kepala_staf'].includes(p.role));
  const pick = (f) => {
    const subj = t.subject === 'people' ? pool.filter(p => f['pp_' + p.id]).map(p => p.id) : t.subject === 'person' ? [f.person].filter(Boolean) : [];
    const fields = Object.fromEntries((t.fields || []).map(x => [x.k, (f['f_' + x.k] || '').trim()]));
    return { type: t.code, biz: f.biz, people: subj, candidate_app: f.app || null, investor: f.investor || null, booking: (f.booking || '').trim().toUpperCase() || null, assets: t.subject === 'assets' ? assets.filter(a => f['as_' + a.id]).map(a => a.id) : [], fields, signer_id: f.signer, letter_date: f.letter_date };
  };
  const firstBiz = () => { const p = ctx.byId[ROLE.me]; return p ? bizOf(p.unit_code) : 'HQ'; };
  const draft = await modal(t.name, `${subjHtml}${fieldsHtml}
    <div class="g2">${['assets', 'booking', 'investor'].includes(t.subject) ? '<input type="hidden" name="biz" value="RA">' : field('Unit bisnis (untuk nomor surat)', `<select class="inp" name="biz">${opts(BIZ, ['HQ', 'RA', 'WG', 'NA'].includes(firstBiz()) ? firstBiz() : 'HQ')}</select>`)}
      ${field('Tanggal surat', `<input class="inp" type="date" name="letter_date" value="${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)}">`)}</div>
    ${field('Penanda tangan', `<select class="inp" name="signer" id="sg">${opts(signers.map(p => [p.id, (p.nickname || p.name) + ' · ' + (p.title || '')]), '')}</select>`, t.signer === 'boss' ? 'Atasan langsung semua orang yang ditugaskan, atau CEO / Kepala Staf' : t.signer === 'leader' ? 'Leader, Kepala Staf, atau CEO' : t.signer === 'kepala_staf' ? 'Sesuai tingkatan: Kepala Staf' : 'Wajib disetujui CEO')}
    <div id="sphint"></div>`, { submit: 'Pratinjau', wide: true, onSubmit: async (f) => pick(f) });
  // default penanda tangan & petunjuk SP diisi sesudah modal tampil (lihat listener di bawah)
  if (!draft) return;
  try { await preview(t, draft, re); } catch (e) { toast(e.message, 'err'); }
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
  if (t.subject === 'assets') d.assets = (ASSETS || (ASSETS = await db.rpc('pk_letter_assets', { p_q: null, p_only_missing: false }))).filter(a => p.assets.includes(a.id));
  if (t.subject === 'booking') {
    const b = await db.rpc('pk_letter_booking', { p_code: p.booking || '' }); if (!b) throw new Error('Kode booking tidak ditemukan');
    Object.assign(d, { booking: b, penyewa: b.penyewa, sisa: 'Rp' + Math.round(+b.sisa || 0).toLocaleString('id-ID') });
  }
  Object.entries(p.fields).forEach(([k, v]) => { d[k] = (t.fields.find(f => f.k === k) || {}).type === 'date' && v ? tglID(v) : v; });
  if (t.code === 'SP' && p.fields.level) d.level_romawi = ['I', 'II', 'III'][+p.fields.level - 1];
  const sg = ctx.byId[p.signer_id] || {};
  Object.assign(d, { penanda_tangan: sg.name, jabatan_ttd: sg.title });
  if (t.code === 'BAK') d.jenis_judul = p.fields.jenis === 'kehilangan' ? 'KEHILANGAN' : 'KERUSAKAN';
  if (t.subject === 'investor') { const x = (t._inv || []).find(v => v.id === p.investor); if (!x) throw new Error('Pilih investor'); d.penerima = x.name; d.people = [{ Nama: x.name, Kota: x.city || '—' }]; }
  if (t.code === 'STG') d.jenis_judul = p.fields.jenis === 'teguran' ? 'TEGURAN' : 'TAGIHAN';
  if (t.code === 'PKWT') d.known_label = 'Pihak Kedua,';
  const boss = t.code === 'SP' && p.people[0] ? ctx.byId[(ctx.byId[p.people[0]] || {}).boss_id] : t.code === 'PKWT' && p.people[0] ? ctx.byId[p.people[0]] : null;
  const l = { status: 'menunggu', type: t.code, biz: p.biz, data: d, tpl: t.tpl, letter_date: p.letter_date, signer_name: sg.name, signer_title: sg.title, known_name: boss && boss.name, known_title: boss && boss.title };
  const self = p.signer_id === ROLE.me;
  const pr = modal('Pratinjau ' + t.name, `<style>${LETTER_CSS}.pv{background:#EEF0F3;border-radius:12px;padding:12px;overflow:hidden}.pv .sc{margin:0 auto;position:relative;overflow:hidden;box-shadow:0 4px 18px rgba(31,43,77,.14);border-radius:4px}.pv .sc .letter{position:absolute;left:0;top:0;transform-origin:top left}</style><div class="pv"><div class="sc">${await letterHtml(l)}</div></div>
    <p class="small muted" style="margin-top:8px">${self ? 'Anda penanda tangan: surat langsung terbit, nomor dikunci, dan QR verifikasi aktif.' : 'Surat dikirim ke ' + esc(sg.nickname || sg.name || 'penanda tangan') + ' untuk disetujui. Nomor dibuat saat disetujui.'}</p>`,
    { wide: true, submit: self ? 'Terbitkan' : 'Kirim untuk disetujui', onSubmit: async () => await db.rpc('pk_letter_create', { p }) });
  fitPv(); const ok = await pr;
  if (ok) { toast(ok.status === 'terbit' ? 'Surat terbit' : 'Menunggu persetujuan'); S.tab = ok.status === 'terbit' ? 'arsip' : 'arsip'; re(); }
}

/* ---------- buka surat ---------- */
async function openLetter(l, re) {
  CUR = l;
  const canCancel = ['menunggu', 'terbit'].includes(l.status) && (isAdmin() || l.signer_id === ROLE.me || (l.created_by === ROLE.me && l.status === 'menunggu'));
  const wa = l.status === 'terbit' ? 'https://wa.me/?text=' + encodeURIComponent(`${l.title}\nNomor ${l.number}\nCek keaslian: ${VERIFY}${l.verify_key}`) : '';
  const pr = modal(l.number || 'Surat', `<style>${LETTER_CSS}.pv{background:#EEF0F3;border-radius:12px;padding:12px;overflow:hidden}.pv .sc{margin:0 auto;position:relative;overflow:hidden;box-shadow:0 4px 18px rgba(31,43,77,.14);border-radius:4px}.pv .sc .letter{position:absolute;left:0;top:0;transform-origin:top left}</style>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${stChip(l.status)}<button type="button" class="btn" data-a="pdf">Unduh PDF</button><button type="button" class="btn" data-a="print">Cetak</button>${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener">Kirim via WA</a>` : ''}</div>
    ${l.cancel_reason ? `<div class="note">Dibatalkan: ${esc(l.cancel_reason)}</div>` : ''}${l.decided_note ? `<div class="note">Catatan penolakan: ${esc(l.decided_note)}</div>` : ''}
    <div class="pv"><div class="sc">${await letterHtml(l)}</div></div>${l.mine_to_sign ? field('Catatan bila menolak', '<input class="inp" name="note">') : ''}${canCancel ? field('Alasan bila membatalkan', '<input class="inp" name="reason" placeholder="Mis. salah tanggal, diganti surat baru">', 'Surat yang dibatalkan tetap di arsip; QR-nya menampilkan "dibatalkan"') : ''}`,
    { wide: true, submit: l.mine_to_sign ? 'Setujui & terbitkan' : null, onSubmit: async () => { await db.rpc('pk_letter_decide', { p_id: l.id, p_ok: true, p_note: null }); return 'ok'; },
      extra: l.mine_to_sign ? { label: 'Tolak', onClick: async (f) => { await db.rpc('pk_letter_decide', { p_id: l.id, p_ok: false, p_note: f.note || null }); return 'tolak'; } } : undefined,
      danger: canCancel ? { label: 'Batalkan surat', onClick: async (f) => {
        if (!f.reason || f.reason.trim().length < 5) throw new Error('Tulis alasan pembatalan dulu');
        await db.rpc('pk_letter_cancel', { p_id: l.id, p_reason: f.reason });
  fitPv(); const res = await pr; return 'batal'; } } : undefined });
  if (res === 'ok') toast('Surat terbit'); if (res === 'tolak') toast('Surat ditolak'); if (res === 'batal') toast('Surat dibatalkan');
  if (res) re();
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.modal [data-a]'); if (!b) return;
  const l = CUR; if (!l) return;
  b.disabled = true; try { b.dataset.a === 'pdf' ? await downloadPdf(l) : await printLetter(l); } catch (er) { toast(er.message, 'err'); } b.disabled = false;
});
export { letterHtml, LETTER_CSS };

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-bk]'); if (!b) return;
  const form = b.closest('form'); const box = form.querySelector('#bkinfo'); box.textContent = 'Mencari…';
  try { const r = await db.rpc('pk_letter_booking', { p_code: form.booking.value });
    box.innerHTML = r ? `<b>${esc(r.penyewa || '')}</b> · ${esc(r.items || '')} · sisa <b>Rp${Math.round(+r.sisa || 0).toLocaleString('id-ID')}</b>` : '<span style="color:#C0392B">Kode booking tidak ditemukan</span>'; }
  catch (er) { box.textContent = er.message; }
});

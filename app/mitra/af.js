/* Program Mitra Affiliate Pokama · pembantu bersama portal mitra & panel admin */
export const SB_URL = 'https://shrvzlltysnbmgpkhjjg.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocnZ6bGx0eXNuYm1ncGtoampnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzAzNTYsImV4cCI6MjEwODQ0NjM1Nn0.V0EDK0y3ZFIuNW5uGJjDcHZlEVxAURVC6OJVPaUYUFY';

export function makeSession(key) {
  const load = () => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } };
  const save = (s) => {
    const v = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), email: s.user?.email || s.email } : null;
    try { v ? localStorage.setItem(key, JSON.stringify(v)) : localStorage.removeItem(key); } catch (e) {}
    return v;
  };
  async function token() {
    const s = load(); if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!r.ok) { save(null); return null; }
    return save(Object.assign(await r.json(), { email: s.email })).access_token;
  }
  return { load, save, token };
}

export function api(sess) {
  async function call(path, opt = {}, anon = false) {
    const t = anon ? null : await sess.token();
    const r = await fetch(SB_URL + path, Object.assign({}, opt, { headers: Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + (t || SB_KEY), 'Content-Type': 'application/json' }, opt.headers || {}) }));
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
    if (!r.ok) { const m = (j && (j.message || j.error_description || j.msg || j.error)) || ('Gagal (' + r.status + ')'); const e = new Error(m); e.status = r.status; throw e; }
    return j;
  }
  return {
    call,
    rpc: (fn, args = {}, anon = false) => call('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args) }, anon),
    get: (path, anon = false) => call('/rest/v1/' + path, {}, anon),
    fn: (name, body) => call('/functions/v1/' + name, { method: 'POST', body: JSON.stringify(body) }, true),
    upload: async (bucket, path, file) => {
      const t = await sess.token();
      const r = await fetch(SB_URL + '/storage/v1/object/' + bucket + '/' + path, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + t, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' }, body: file });
      if (!r.ok) throw new Error('Unggah gagal: ' + (await r.text()).slice(0, 120));
      return bucket + '/' + path;
    },
    openFile: async (full) => {
      const t = await sess.token();
      const r = await fetch(SB_URL + '/storage/v1/object/authenticated/' + full, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + t } });
      if (!r.ok) throw new Error('Berkas tidak bisa dibuka');
      const u = URL.createObjectURL(await r.blob()); window.open(u, '_blank', 'noopener');
    },
  };
}

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rp = (n) => 'Rp' + Math.round(+n || 0).toLocaleString('id-ID');
export const rpk = (n) => { n = +n || 0; return n >= 1e9 ? 'Rp' + (n / 1e9).toFixed(1).replace('.', ',') + ' M' : n >= 1e6 ? 'Rp' + (n / 1e6).toFixed(1).replace('.', ',') + ' jt' : n >= 1e4 ? 'Rp' + Math.round(n / 1e3) + 'rb' : rp(n); };
export const pct = (n) => (n == null ? '—' : String(Math.round((+n) * 10) / 10).replace('.', ',') + '%');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const tgl = (s) => { if (!s) return '—'; const d = new Date(s); return d.getDate() + ' ' + MON[d.getMonth()]; };
export const bulan = (s) => { const d = new Date((s || '').length === 10 ? s + 'T00:00:00' : s); return MONL[d.getMonth()] + ' ' + d.getFullYear(); };
export const monthKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
export const KIND = { penginapan: 'Penginapan', travel: 'Travel / sopir', kantor: 'Kantor', komunitas: 'Komunitas', kampus: 'Kampus', kreator: 'Kreator' };
export const ST = {
  tertunda: ['Tertunda', '#EEF1F6', '#1F2B4D'], siap_cair: ['Siap cair', '#E3F7F5', '#077A70'], dicairkan: ['Dicairkan', '#E5EEF9', '#1E5AA8'],
  hangus: ['Hangus', '#FCEDEB', '#A12A1F'], dibekukan: ['Dibekukan', '#FFF6E0', '#7A4B00'], internal: ['Rujukan internal', '#EEF1F6', '#4A5468'], nol: ['Tanpa komisi', '#EEF1F6', '#4A5468'],
};
export const chip = (k) => { const c = ST[k] || [k, '#EEF1F6', '#1F2B4D']; return `<span class="pill" style="background:${c[1]};color:${c[2]}">${esc(c[0])}</span>`; };
export function toast(t, err) {
  let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = t; el.classList.toggle('err', !!err); clearTimeout(el._t); el._t = setTimeout(() => el.remove(), 2600);
}
export function loadScript(src) {
  return new Promise((ok, no) => { if (document.querySelector('script[src="' + src + '"]')) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Gagal memuat ' + src)); document.head.appendChild(s); });
}
export const waLink = (phone, text) => 'https://wa.me/' + (phone ? String(phone).replace(/\D/g, '') : '') + '?text=' + encodeURIComponent(text);

/* QR A6 siap cetak (PDF) */
export async function qrPdf({ code, link, org, unit, products, discount }) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const q = window.qrcode(0, 'M'); q.addData(link); q.make();
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a6' });
  const W = 105;
  doc.setFillColor(7, 122, 112); doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text((unit || 'Rentalaja').toUpperCase() + ' · MITRA', 8, 9);
  doc.setFontSize(14); doc.text(doc.splitTextToSize('Butuh motor, kamera, atau Jeep trip selama di Garut?', W - 16), 8, 17);
  const n = q.getModuleCount(), size = 52, cell = size / n, x0 = 8, y0 = 42;
  doc.setFillColor(31, 43, 77);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) doc.rect(x0 + c * cell, y0 + r * cell, cell + 0.02, cell + 0.02, 'F');
  doc.setTextColor(31, 43, 77); doc.setFontSize(11);
  ['1  Scan', '2  Pilih barang', '3  Diantar ke sini'].forEach((t, i) => doc.text(t, 66, 54 + i * 10));
  doc.setDrawColor(9, 190, 175); doc.setLineDashPattern([1.5, 1.2], 0); doc.roundedRect(8, 100, W - 16, 20, 3, 3, 'S'); doc.setLineDashPattern([], 0);
  doc.setFontSize(8); doc.setTextColor(74, 84, 104); doc.text(discount ? 'Pakai kode, hemat ' + discount + '%' : 'Kode mitra', 12, 106);
  doc.setFontSize(18); doc.setTextColor(31, 43, 77); doc.text(code, 12, 115);
  doc.setFontSize(8); doc.setTextColor(74, 84, 104); doc.text(doc.splitTextToSize('Tamu ' + (org || ''), 40), W - 12, 108, { align: 'right' });
  doc.setFontSize(8); doc.text(doc.splitTextToSize((products || []).join(' · '), W - 16), 8, 128);
  doc.setDrawColor(230, 232, 236); doc.line(8, 138, W - 8, 138);
  doc.setFontSize(8); doc.text(link.replace(/^https?:\/\//, ''), 8, 143); doc.text('Sewa saat butuh', W - 8, 143, { align: 'right' });
  doc.save('QR-' + code + '-' + (unit || 'unit') + '.pdf');
}

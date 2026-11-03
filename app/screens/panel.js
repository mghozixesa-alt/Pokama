/* Panel bergambar Sistem Kerja (tahap 1). Hanya menampilkan; ditempel di bawah judul halaman yang sudah ada.
   Kalau datanya gagal dimuat, panel tidak muncul dan halaman tetap berjalan seperti biasa. */
import { ctx, db, esc, today, toast } from '../core.js';

const N = '#1F2B4D', T = '#09BEAF', TD = '#077A70', A = '#F2A33A', R = '#C0392B', G = '#1E9E6A', M = '#6B7486', S = '#A3ACB9';
const BIZN = { RA: 'Rentalaja', WG: 'TripinAja', NA: 'Niagaaja', HQ: 'Holding' };
const MONL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const pt = (cx, cy, r, d) => { const a = (d - 90) * Math.PI / 180; return [+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)]; };
const arc = (cx, cy, r, a0, a1) => { const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1); return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const short = (n) => { n = +n || 0; const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e9 ? s + (a / 1e9).toFixed(1).replace('.', ',') + ' M' : a >= 1e6 ? s + (a / 1e6).toFixed(1).replace('.', ',') + ' jt' : a >= 1e3 ? s + Math.round(a / 1e3) + ' rb' : s + Math.round(a); };
const hhmm = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':') : null;
const nowH = () => +new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* abaikan */ } };

const CSS = `
.vpk{background:#fff;border:1px solid var(--line,#E3E6EB);border-radius:16px;padding:16px 18px;box-shadow:0 0 0 3px rgba(9,190,175,.14)}
.vpk *{box-sizing:border-box}.vpk .vh{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.vpk .vh b{font-size:16px;color:${N}}.vpk .vh small{color:${M};font-weight:600}
.vpk .vh button{margin-left:auto;background:none;border:0;font:inherit;font-weight:800;font-size:12.5px;color:${TD};cursor:pointer;padding:4px 0}
.vpk.min .vb{display:none}.vpk .vb{margin-top:12px}
.vpk svg{width:100%;height:auto;display:block;font-family:inherit}
.vpk .tl{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}
.vpk .t{border:1px solid #E3E6EB;border-radius:12px;padding:10px 12px;border-top:4px solid ${N};text-decoration:none;color:inherit;display:block}.vpk .t span{font-size:11.5px;color:${M};font-weight:700}.vpk .t b{display:block;font-size:22px;font-weight:800;color:${N}}.vpk .t small{font-size:11px;color:${M}}
.vpk .t.r{border-top-color:${R}}.vpk .t.a{border-top-color:${A}}.vpk .t.g{border-top-color:${T}}
.vpk .bar{height:6px;background:#EEF0F3;border-radius:3px;margin-top:6px;overflow:hidden}.vpk .bar i{display:block;height:100%;background:${T}}
.vpk .row{display:grid;gap:14px;align-items:start}.vpk .box{border:1px solid #E3E6EB;border-radius:12px;padding:12px 14px;min-width:0}.vpk .box h4{margin:0 0 8px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:${M}}
.vpk .li{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #EEF0F3;font-size:13px}.vpk .li:last-child{border-bottom:0}.vpk .li .k{font-size:10.5px;font-weight:800;padding:3px 7px;border-radius:6px;white-space:nowrap}
.vpk .li .g1{flex:1;min-width:0}.vpk .li .g1 b{display:block;font-size:13px;color:${N}}.vpk .li .g1 small{color:${M};font-size:11.5px}
.vpk .vbtn{height:30px;padding:0 10px;border-radius:8px;border:1px solid #D5D9E0;background:#fff;font:inherit;font-weight:800;font-size:12px;color:${N};white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}.vpk .vbtn.p{background:${T};border-color:${T};color:#fff}.vpk .vbtn.n{background:${N};border-color:${N};color:#fff}
.vpk .chips{display:flex;flex-wrap:wrap;gap:6px}.vpk .chip2{font-size:11.5px;font-weight:800;padding:5px 10px;border-radius:14px}
.vpk .ok{color:${TD};font-weight:700;font-size:13px;margin:4px 0}
.vpk .bp{display:grid;grid-template-columns:minmax(0,1fr) 120px;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(31,43,77,.12)}
.vpk .bp .m{background:#fff;border:1px solid #E6E8EC;border-right:2px dashed #C9D1E6;border-radius:14px 0 0 14px;padding:12px 14px;min-width:0}
.vpk .bp .s{background:${N};color:#fff;padding:12px;display:flex;flex-direction:column;gap:4px}
.vpk .bp .top{display:flex;justify-content:space-between;font-size:11px;color:${M};font-weight:700}
.vpk .bp .rt{display:flex;align-items:center;gap:10px;margin:8px 0}.vpk .bp .rt b{font-size:24px;color:${N}}.vpk .bp .rt small{display:block;font-size:10.5px;color:${M};font-weight:700}
.vpk .bp .ln{flex:1;border-top:2px dashed ${T};position:relative;min-width:30px}.vpk .bp .ln span{position:absolute;top:-12px;transform:translateX(-50%);font-size:16px}
.vpk .bp .kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;font-size:10.5px;color:${M}}.vpk .bp .kv b{display:block;color:${N};font-size:13px}
.vpk .bc{height:28px;margin-top:auto;background:repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 4px,#fff 4px 5px,transparent 5px 8px,#fff 8px 11px,transparent 11px 12px);opacity:.9}
.vpk .wx{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.vpk .wx div{border-radius:12px;padding:10px;text-align:center}.vpk .wx b{display:block;font-size:13px;color:${N}}.vpk .wx small{font-size:11px;color:#4A5468}.vpk .wx .i{font-size:36px;line-height:1.1}
.vpk .scrollx{overflow-x:auto}
@media (max-width:900px){.vpk .tl{grid-template-columns:repeat(2,minmax(0,1fr))}.vpk .row{grid-template-columns:1fr!important}}
@media (max-width:520px){.vpk .li{flex-wrap:wrap}.vpk .li .g1{flex:1 1 60%}.vpk .bp .kv{grid-template-columns:repeat(2,minmax(0,1fr))}.vpk{padding:14px}.vpk .bp{grid-template-columns:minmax(0,1fr) 92px}.vpk .bp .rt b{font-size:19px}.vpk .scrollx svg{min-width:560px}}`;
function css() { if (document.getElementById('vpk-css')) return; const s = document.createElement('style'); s.id = 'vpk-css'; s.textContent = CSS; document.head.appendChild(s); }
function shell(key, icon, title, sub, body) {
  const min = lsGet('vpk.' + key) === 'min';
  return `<section class="vpk${min ? ' min' : ''}" data-vpk="${key}"><div class="vh"><span style="font-size:20px">${icon}</span><b>${title}</b><small>${sub}</small><button type="button" data-vtog>${min ? 'Tampilkan ▾' : 'Sembunyikan ▴'}</button></div><div class="vb">${body}</div></section>`;
}
function place(el, html) {
  const w = document.createElement('div'); w.className = 'vpk-wrap'; w.style.cssText = 'display:flex;flex-direction:column;gap:16px;margin:4px 0 2px'; w.innerHTML = html;
  const hd = el.querySelector('header.ph'); if (hd) hd.after(w); else el.prepend(w);
  w.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vtog]'); if (b) { const s = b.closest('.vpk'), min = !s.classList.contains('min'); s.classList.toggle('min', min); b.textContent = min ? 'Tampilkan ▾' : 'Sembunyikan ▴'; lsSet('vpk.' + s.dataset.vpk, min ? 'min' : null); return; }
    const c = e.target.closest('[data-vcopy]'); if (c) { navigator.clipboard.writeText(c.dataset.vcopy).then(() => toast('Teks disalin, tinggal tempel di WA')).catch(() => toast('Gagal menyalin', 'err')); }
  });
}

/* ---------- Beranda staf: boarding pass + streak ---------- */
function boarding(P) {
  const pct = P.need ? clamp(Math.round(P.done / P.need * 100), 0, 100) : 0, left = Math.max(0, P.need - P.done);
  const masuk = P.att && P.att.at ? hhmm(P.att.at) : String(P.start).padStart(2, '0') + ':00', late = P.att && P.att.late > 0;
  const prog = clamp(P.slots / Math.max(P.need, 1), 0, 1);
  return `<div class="bp"><div class="m"><div class="top"><span>POKAMA AIR · KKH</span><span>${new Date(P.day + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span></div>
    <div class="rt"><div><b>${masuk}</b><small>${P.att && P.att.at ? (late ? 'MASUK · TELAT ' + P.att.late + ' MNT' : 'MASUK') : 'JADWAL MASUK'}</small></div><div class="ln"><span style="left:${Math.round(prog * 100)}%">✈</span></div><div style="text-align:right"><b>${String(P.end).padStart(2, '0')}:00</b><small>SLOT TERAKHIR</small></div></div>
    <div class="kv"><div>PENUMPANG<b>${esc(P.nick)}</b></div><div>GATE<b>${esc(P.unit || '—')}</b></div><div>SLOT TERISI<b>${P.slots}/${P.need}</b></div><div>TUGAS AKTIF<b>${P.tasks}${P.late_tasks ? ` <span style="color:${R}">· ${P.late_tasks} telat</span>` : ''}</b></div></div></div>
    <div class="s"><small style="font-size:10px;color:#9FB0D6;font-weight:800">${pct >= 100 ? 'LANDED' : P.slots ? 'BOARDING' : 'CHECK-IN'}</small><b style="font-size:22px">${pct}%</b><small style="font-size:10.5px">${pct >= 100 ? 'semua slot selesai' : left + ' jam belum ditandai selesai'}</small><div class="bc"></div></div></div>`;
}
function fires(team) {
  const L = team.slice(0, 6), W = 420, w = W / Math.max(L.length, 1), max = Math.max(10, ...L.map(x => x.s));
  let g = `<rect width="${W}" height="220" rx="12" fill="${N}"/>`; for (let i = 0; i < 20; i++) g += `<circle cx="${(i * 61) % W}" cy="${(i * 29) % 80 + 10}" r="1.2" fill="#fff" opacity=".6"/>`;
  L.forEach((p, i) => {
    const x = w * i + w / 2, k = clamp(p.s / max, 0, 1), h = 14 + k * 70;
    g += `<g transform="translate(${x},170)"><path d="M-20 6 L20 -2 M-20 -2 L20 6" stroke="#8B5A2B" stroke-width="6" stroke-linecap="round"/>${p.s ? `<path d="M0 ${-h} Q${12 + k * 10} ${-h * .55} ${8 + k * 6} ${-h * .2} Q${16 + k * 6} ${-h * .35} 12 ${-h * .6} Q${20 + k * 8} ${-h * .2} 10 0 L-10 0 Q${-20 - k * 8} ${-h * .25} -8 ${-h * .7} Q-6 ${-h * .4} 0 ${-h * .25} Q-4 ${-h * .6} 0 ${-h}Z" fill="${A}"/><path d="M0 ${-h * .6} Q8 ${-h * .3} 5 0 L-5 0 Q-8 ${-h * .3} 0 ${-h * .6}Z" fill="#F2C94C"/>` : `<path d="M-6 -4 Q0 -18 6 -4" fill="none" stroke="${S}" stroke-width="2"/>`}</g>
      <text x="${x}" y="198" text-anchor="middle" font-size="12" font-weight="800" fill="${p.me ? '#9FF0E6' : '#fff'}">${esc(p.nick)}${p.me ? ' (Anda)' : ''}</text><text x="${x}" y="213" text-anchor="middle" font-size="10.5" font-weight="700" fill="${p.s ? '#F2C94C' : S}">${p.s ? p.s + ' hari' : 'padam'}</text>`;
  });
  return `<svg viewBox="0 0 ${W} 220" role="img" aria-label="Streak mengisi KKH">${g}</svg>`;
}
async function beranda(el) {
  const P = await db.rpc('pk_panel_saya');
  const body = `<div class="row" style="grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)"><div><h4 style="margin:0 0 8px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:${M}">KKH saya hari ini</h4>${boarding(P)}
    <p class="small muted" style="margin:10px 0 0">Streak Anda: <b>${P.streak} hari</b> berturut-turut mengisi KKH. Hari libur & cuti yang disetujui tidak memutus streak.</p></div>
    <div><h4 style="margin:0 0 8px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:${M}">Api unggun streak tim</h4>${fires(P.team || [])}</div></div>`;
  return shell('saya', '🧭', 'Hari ini dalam gambar', '', body);
}

/* ---------- Kepala Staf: menara kontrol ---------- */
const GRP = (u, biz) => ({ MKT: 'MKT', KEU: 'KEU', BIZ: 'BIZ', AST: 'ASET', HQ: 'HQ' }[u] || (biz === 'RA' ? 'RA' : biz === 'WG' ? 'WG' : biz === 'NA' ? 'NA' : 'HQ'));
function status(p, K) {
  if (p.leave) return ['cuti', S];
  if (!p.kkh) return nowH() >= K.fill_deadline ? ['belum', R] : ['belum', S];
  if (p.overdue > 0 || p.late > 0) return ['awas', A];
  return ['ok', G];
}
function radar(K) {
  const cx = 150, cy = 150, st = K.staff, groups = [...new Set(st.map(p => GRP(p.unit, p.biz)))];
  let g = `<defs><radialGradient id="vrg"><stop offset="0" stop-color="#0E3B3A"/><stop offset="1" stop-color="#0B1A2E"/></radialGradient><linearGradient id="vsw" x1="0" x2="1"><stop offset="0" stop-color="${T}" stop-opacity="0"/><stop offset="1" stop-color="${T}" stop-opacity=".55"/></linearGradient></defs><circle cx="${cx}" cy="${cy}" r="140" fill="url(#vrg)"/>`;
  [35, 70, 105, 140].forEach(r => g += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T}" stroke-opacity=".25"/>`);
  g += `<path d="M${cx} ${cy} L${pt(cx, cy, 140, 20).join(' ')} A140 140 0 0 1 ${pt(cx, cy, 140, 60).join(' ')} Z" fill="url(#vsw)"/>`;
  const span = 360 / Math.max(groups.length, 1);
  groups.forEach((gname, gi) => {
    const a0 = gi * span, mem = st.filter(p => GRP(p.unit, p.biz) === gname), [lx, ly] = pt(cx, cy, 156, a0 + span / 2);
    if (groups.length > 1) { const [x1, y1] = pt(cx, cy, 140, a0); g += `<line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="${T}" stroke-opacity=".18"/>`; }
    g += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${N}">${gname}</text>`;
    mem.forEach((p, i) => {
      const [, col] = status(p, K), a = a0 + span * (i + 1) / (mem.length + 1), r = 48 + (i % 3) * 32, [x, y] = pt(cx, cy, r, a), ini = (p.code || p.nick.slice(0, 2)).toUpperCase();
      g += `<circle cx="${x}" cy="${y}" r="13" fill="${col}" opacity=".22"/><circle cx="${x}" cy="${y}" r="7" fill="${col}"><title>${esc(p.nick)}</title></circle><text x="${x}" y="${y - 12}" text-anchor="middle" font-size="10" font-weight="800" fill="#E3F7F5">${esc(ini)}</text>`;
    });
  });
  g += `<circle cx="${cx}" cy="${cy}" r="6" fill="${T}"/>`;
  const c = (s) => K.staff.filter(p => status(p, K)[0] === s).length;
  return `<svg viewBox="-14 -14 328 328" role="img" aria-label="Radar tim">${g}</svg><div class="chips" style="margin-top:8px;justify-content:center"><span class="chip2" style="background:#E4F2EA;color:${TD}">● lancar ${c('ok')}</span><span class="chip2" style="background:#FFF1D6;color:#8A5A00">● telat / ada tugas lewat ${c('awas')}</span><span class="chip2" style="background:#FDECEA;color:${R}">● belum isi KKH ${c('belum')}</span><span class="chip2" style="background:#EEF1F6;color:${M}">● cuti/libur ${c('cuti')}</span></div>`;
}
async function menara(el) {
  const K = await db.rpc('pk_panel_kendali'), st = K.staff, need = st.filter(p => !p.leave), inn = need.filter(p => p.kkh > 0), miss = need.filter(p => !p.kkh);
  const lv = st.filter(p => p.leave), wfa = st.filter(p => p.wfa), late = st.filter(p => p.late > 0);
  const remind = `Halo tim, pengingat isi KKH hari ini sebelum ${String(K.fill_deadline).padStart(2, '0')}.00 ya: ${miss.map(p => p.nick).join(', ')}. Terima kasih.`;
  const tl = `<div class="tl">
    <a class="t ${miss.length ? 'a' : 'g'}" href="#/kkh-tim"><span>KKH masuk</span><b>${inn.length} / ${need.length}</b><small>${miss.length ? miss.length + ' belum isi · batas ' + String(K.fill_deadline).padStart(2, '0') + '.00' : 'semua sudah isi'}</small><div class="bar"><i style="width:${need.length ? Math.round(inn.length / need.length * 100) : 0}%"></i></div></a>
    <a class="t ${K.validate ? 'a' : 'g'}" href="#/kkh-tim"><span>Slot menunggu validasi</span><b>${K.validate}</b><small>${K.validate_old ? K.validate_old + ' dari hari sebelumnya' : 'ditandai selesai'}</small></a>
    <a class="t ${K.delay.length ? 'r' : 'g'}" href="#/tugas"><span>Tugas lewat tenggat</span><b>${K.delay.length}</b><small>${K.delay.filter(x => x.days > 2).length} lewat > 2 hari</small></a>
    <a class="t" href="#/review"><span>Menunggu review</span><b>${K.review}</b><small>${K.revisi_late ? K.revisi_late + ' revisi lewat tenggat' : 'revisi aman'}</small></a>
    <a class="t ${lv.length ? 'a' : ''}" href="#/kehadiran"><span>Cuti · WFA · telat masuk</span><b>${lv.length} · ${wfa.length} · ${late.length}</b><small>${lv.length ? esc(lv.map(p => p.nick).join(', ')) : 'semua masuk'}</small></a></div>`;
  const acts = [];
  if (miss.length) acts.push(`<div class="li"><span class="k" style="background:#FDECEA;color:${R}">BELUM ISI</span><div class="g1"><b>${esc(miss.slice(0, 4).map(p => p.nick).join(', '))}${miss.length > 4 ? ' +' + (miss.length - 4) : ''} belum isi KKH</b><small>batas ${String(K.fill_deadline).padStart(2, '0')}.00</small></div><button type="button" class="vbtn" data-vcopy="${esc(remind)}">Salin pengingat WA</button></div>`);
  if (K.validate) acts.push(`<div class="li"><span class="k" style="background:#FFF1D6;color:#8A5A00">VALIDASI</span><div class="g1"><b>${K.validate} slot KKH menunggu validasi</b><small>${K.validate_old ? K.validate_old + ' dari hari sebelumnya' : 'hari ini'}</small></div><a class="vbtn p" href="#/kkh-tim">Validasi</a></div>`);
  if (K.requests_stuck) acts.push(`<div class="li"><span class="k" style="background:#E5EEF9;color:#1E5AA8">PERMINTAAN</span><div class="g1"><b>${K.requests_stuck} permintaan antar tim macet > 2 hari</b><small>belum selesai ditangani</small></div><a class="vbtn" href="#/tugas">Buka</a></div>`);
  K.delay.slice(0, 3).forEach(d => acts.push(`<div class="li"><span class="k" style="background:#FDECEA;color:${R}">TELAT ${d.days} HARI</span><div class="g1"><b>${esc(d.title)}</b><small>PIC ${esc(d.pic || '—')} · ${esc(d.unit || '')}</small></div><button type="button" class="vbtn n" data-vcopy="${esc(`Eskalasi ke CEO: tugas "${d.title}" (PIC ${d.pic || '-'}) telat ${d.days} hari. Mohon arahan.`)}">Salin eskalasi ke CEO</button></div>`));
  const board = (K.due_today || []).concat(K.delay.slice(0, 3)).slice(0, 5).map(t => { const late = t.days > 0;
    return `<div class="li"><span class="k" style="background:#0F1830;color:#F2C94C;font-family:ui-monospace,monospace">${late ? 'H+' + t.days : 'HARI INI'}</span><div class="g1"><b>${esc(String(t.title).toUpperCase())}</b><small>${esc(t.pic || '—')} · ${esc(t.unit || '')}</small></div><span class="k" style="background:${late ? '#FDECEA' : t.status === 'review' ? '#E5EEF9' : '#E3F7F5'};color:${late ? R : t.status === 'review' ? '#1E5AA8' : TD}">${late ? 'DELAY' : t.status === 'review' ? 'LANDING' : t.status === 'doing' ? 'BOARDING' : 'ON TIME'}</span></div>`; }).join('');
  const body = tl + `<div class="row" style="grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)"><div class="box"><h4>Radar tim · posisi tiap orang</h4>${radar(K)}</div>
    <div style="display:grid;gap:14px;min-width:0"><div class="box"><h4>Perlu tindakan Anda</h4>${acts.join('') || '<p class="ok">✓ Tidak ada yang perlu ditindak saat ini.</p>'}</div>
    <div class="box"><h4>Papan tugas · tenggat hari ini & delay</h4>${board || '<p class="ok">✓ Tidak ada tugas bertenggat hari ini.</p>'}</div></div></div>`;
  return shell('menara', '🗼', 'Menara kontrol hari ini', '· khusus Kepala Staf', body);
}

/* ---------- CEO: ruang kemudi ---------- */
function cockpit(dials) {
  const dial = (cx, cy, v, label, sub, zones) => {
    let g = `<circle cx="${cx}" cy="${cy}" r="62" fill="${N}"/><circle cx="${cx}" cy="${cy}" r="62" fill="none" stroke="#3A4A75" stroke-width="2"/>`;
    zones.forEach(([a, b, c]) => g += `<path d="${arc(cx, cy, 50, -120 + 240 * a, -120 + 240 * b)}" stroke="${c}" stroke-width="7" fill="none"/>`);
    for (let i = 0; i <= 10; i++) { const a = -120 + 24 * i, [x0, y0] = pt(cx, cy, 44, a), [x1, y1] = pt(cx, cy, i % 5 ? 39 : 35, a); g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#fff" stroke-width="${i % 5 ? 1 : 2}"/>`; }
    if (v != null) { const [nx, ny] = pt(cx, cy, 44, -120 + 240 * clamp(v, 0, 1)); g += `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`; }
    g += `<circle cx="${cx}" cy="${cy}" r="6" fill="#fff"/><text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">${label}</text><text x="${cx}" y="${cy + 84}" text-anchor="middle" font-size="11.5" font-weight="800" fill="${N}">${sub}</text>`;
    return g;
  };
  let g = `<rect x="0" y="0" width="460" height="190" rx="22" fill="#E9ECF1"/><path d="M20 190 Q230 150 440 190" fill="#D5D9E0"/>`;
  dials.forEach((d, i) => g += dial(80 + i * 150, 82, ...d));
  return `<svg viewBox="0 0 460 190" role="img" aria-label="Instrumen grup">${g}</svg>`;
}
async function kemudi(el) {
  const [K, inbox] = await Promise.all([db.rpc('pk_panel_kendali'), db.rpc('pk_inbox').catch(() => [])]);
  const C = K.ceo || {}, d = new Date(K.day + 'T00:00:00'), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), pace = d.getDate() / dim;
  const runway = C.burn > 0 ? C.kas / C.burn : null, margin = C.rev ? (C.rev - C.cost) / C.rev : null;
  const tT = K.targets.reduce((s, x) => s + +x.target, 0), tO = K.targets.reduce((s, x) => s + +x.omzet, 0), cp = tT ? tO / tT : null;
  const dials = [[runway == null ? null : runway / 12, runway == null ? '—' : runway.toFixed(1).replace('.', ',') + ' bln', 'Tangki kas', [[0, .25, R], [.25, .5, A], [.5, 1, T]]],
    [margin == null ? null : clamp(margin / .4, 0, 1), margin == null ? '—' : Math.round(margin * 100) + '%', 'Margin laba bulan ini', [[0, .25, R], [.25, .5, A], [.5, 1, T]]],
    [cp == null ? null : clamp(cp, 0, 1), cp == null ? '—' : Math.round(cp * 100) + '%', 'Omzet vs target grup', [[0, pace * .8, R], [pace * .8, pace * .95, A], [pace * .95, 1, T]]]];
  const units = K.targets.map(x => { const c = +x.target ? x.omzet / x.target : null, col = c == null ? S : c >= pace * .95 ? G : c >= pace * .8 ? A : R;
    return `<div class="li"><span style="width:14px;height:14px;border-radius:50%;background:${col};box-shadow:0 0 0 4px ${col}33;flex:none"></span><div class="g1"><b>${BIZN[x.biz]}</b><div style="height:10px;background:#EEF0F3;border-radius:5px;margin-top:4px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${c == null ? 0 : Math.min(100, c * 100)}%;background:${N};border-radius:5px"></i><i style="position:absolute;left:${Math.round(pace * 100)}%;top:-3px;bottom:-3px;width:2px;background:${A}"></i></div><small>Rp${short(x.omzet)}${+x.target ? ' dari Rp' + short(x.target) : ' · target belum diisi'}</small></div><b style="font-size:13px">${c == null ? '—' : Math.round(c * 100) + '%'}</b></div>`; }).join('');
  const dec = (inbox || []).slice(0, 6).map(i => `<div class="li"><span class="k" style="background:#FFF1D6;color:#8A5A00">${esc(String(i.kind || '').toUpperCase().slice(0, 18))}</span><div class="g1"><b>${esc(i.title || '')}${i.amount ? ' · Rp' + short(i.amount) : ''}</b><small>${esc(i.sub || '')}${i.since ? ' · sejak ' + new Date(i.since).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}</small></div><a class="vbtn p" href="${esc(i.href || '#/setuju')}">Buka</a></div>`).join('');
  const st = K.staff, broke = st.filter(p => !p.leave && p.streak === 0).length, over = st.filter(p => p.overdue >= 2);
  const sig = [];
  if (over.length) sig.push([`${over.length} orang punya ≥ 2 tugas telat`, R]);
  if (broke) sig.push([`${broke} orang streak KKH putus`, A]);
  if (C.asset_noprice) sig.push([`${C.asset_noprice} aset belum ada harga beli`, A]);
  if (C.hutang_telat > 0) sig.push([`Hutang vendor telat Rp${short(C.hutang_telat)}`, R]);
  if (C.fin_fail) sig.push([`${C.fin_fail} transaksi gagal dibukukan`, R]);
  if (C.kas < 0) sig.push(['Saldo kas di buku minus (saldo awal belum masuk?)', R]);
  if (!sig.length) sig.push(['Tidak ada sinyal bahaya', TD]);
  const summary = `Ringkasan pagi ${new Date(K.day + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}\n` +
    `• KKH masuk ${st.filter(p => p.kkh > 0).length}/${st.filter(p => !p.leave).length}, tugas telat ${K.delay.length}\n` +
    K.targets.map(x => `• ${BIZN[x.biz]}: omzet Rp${short(x.omzet)}${+x.target ? ' (' + Math.round(x.omzet / x.target * 100) + '% target)' : ''}`).join('\n') +
    `\n• Keputusan menunggu: ${(inbox || []).length}` + (sig.length ? '\n• Sinyal: ' + sig.map(s => s[0]).join('; ') : '');
  const body = `<div class="row" style="grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)"><div style="display:grid;gap:14px;min-width:0">
      <div class="box" style="padding:10px"><h4 style="margin:2px 4px 8px">Instrumen grup · ${MONL[d.getMonth()]}</h4>${cockpit(dials)}</div>
      <div class="box"><h4>Posisi unit bisnis menuju target</h4>${units}<small style="color:${M};font-size:11px">garis oranye = posisi seharusnya hari ini (hari ke-${d.getDate()} dari ${dim}) · omzet dari laporan Unit Bisnis</small></div></div>
    <div style="display:grid;gap:14px;min-width:0"><div class="box"><h4>Keputusan menunggu Anda · ${(inbox || []).length}</h4>${dec || '<p class="ok">✓ Tidak ada yang menunggu keputusan Anda.</p>'}${(inbox || []).length > 6 ? '<a class="vbtn" href="#/setuju" style="margin-top:8px">Lihat semua di Kotak Persetujuan</a>' : ''}</div>
      <div class="box"><h4>Sinyal yang perlu Anda tahu</h4><div class="chips">${sig.map(([t, c]) => `<span class="chip2" style="background:${c}1F;color:${c}">${esc(t)}</span>`).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button type="button" class="vbtn n" data-vcopy="${esc(summary)}">Salin ringkasan pagi (WA)</button><a class="vbtn" href="/buku/#dasbor">Buka Dasbor Keuangan</a></div></div></div></div>`;
  return shell('kemudi', '🧭', 'Ruang kemudi', '· khusus CEO · yang hanya bisa diputuskan Anda', body);
}

/* ---------- Unit Bisnis: pendakian + cuaca ---------- */
function mountain(rows, pace, label) {
  const W = 860, H = 250; let g = `<defs><linearGradient id="vsk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#FDE7C7"/><stop offset="1" stop-color="#E3F7F5"/></linearGradient></defs><rect y="-40" width="${W}" height="${H + 40}" rx="12" fill="url(#vsk)"/><circle cx="740" cy="40" r="26" fill="#F2C94C" opacity=".9"/>`;
  g += `<path d="M0 250 L180 120 L280 170 L460 30 L640 160 L760 110 L860 180 L860 250Z" fill="#7FA88B"/><path d="M0 250 L120 190 L260 230 L420 170 L600 230 L860 200 L860 250Z" fill="#4F7F63"/><path d="M430 52 L460 30 L492 56 L478 50 L466 58 L452 48Z" fill="#fff"/>`;
  const tr = [[60, 232], [160, 200], [250, 190], [330, 140], [400, 92], [460, 40]];
  g += `<polyline points="${tr.map(p => p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 6"/>`;
  ['Pos 1', 'Pos 2', 'Pos 3', 'Pos 4', 'Puncak'].forEach((p, i) => { const [x, y] = tr[i + 1]; g += `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="${N}" stroke-width="2"/><text x="${x + 10}" y="${y + 4}" font-size="11" font-weight="800" fill="${N}">${p} · ${(i + 1) * 20}%</text>`; });
  g += `<g transform="translate(460,30)"><line x1="0" y1="0" x2="0" y2="-30" stroke="${N}" stroke-width="2.5"/><path d="M0 -30 L22 -24 L0 -18Z" fill="${R}"/></g>`;
  const at = (p) => { const k = clamp(p, 0, 1) * 5, i = Math.min(4, Math.floor(k)), f = k - i, [x0, y0] = tr[i], [x1, y1] = tr[i + 1]; return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]; };
  const [px, py] = at(pace); g += `<g transform="translate(${px},${py})"><circle r="9" fill="none" stroke="${A}" stroke-width="2.5" stroke-dasharray="3 2"/></g><text x="${px + 14}" y="${py + 24}" font-size="10.5" font-weight="800" fill="#fff">◌ posisi seharusnya hari ini</text>`;
  rows.forEach((r, i) => {
    const p = r.target ? r.omzet / r.target : 0, [x, y] = at(p), c = r.color, dx = i * 18 - 18;
    g += `<g transform="translate(${x - 14 + dx},${y - 22})"><circle cx="0" cy="-8" r="6" fill="${c}"/><path d="M-6 0 Q0 -4 6 0 L5 14 L-5 14Z" fill="${c}"/><rect x="-11" y="-2" width="7" height="11" rx="2" fill="${A}"/><line x1="7" y1="2" x2="12" y2="18" stroke="#8B5A2B" stroke-width="2"/></g>
      `;
  });
  rows.forEach((r, i) => { const p = r.target ? r.omzet / r.target : null, x = 16 + i * 150; g += `<rect x="${x}" y="-28" width="140" height="26" rx="13" fill="#fff" opacity=".9"/><circle cx="${x + 14}" cy="-15" r="7" fill="${r.color}"/><text x="${x + 28}" y="-11" font-size="12.5" font-weight="800" fill="${N}">${BIZN[r.code]} ${p == null ? '—' : Math.round(p * 100) + '%'}</text>`; });
  g += `<text x="840" y="236" text-anchor="end" font-size="13" font-weight="800" fill="#fff">${esc(label)}</text>`;
  return `<svg viewBox="0 -40 ${W} ${H + 40}" role="img" aria-label="Capaian target omzet per unit bisnis">${g}</svg>`;
}
async function unitBisnis(el) {
  const t = today(), m = t.slice(0, 8) + '01', d = new Date(t + 'T00:00:00'), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), pace = d.getDate() / dim;
  const [tg, om] = await Promise.all([db.get('pk_targets', `select=unit_code,amount&month=eq.${m}`), db.get('pk_omzet', `select=unit_code,amount&day=gte.${m}&day=lte.${t}`)]);
  const bizOf = (c) => { const u = ctx.unit[c]; return !u ? c : (u.parent || u.code); };
  const COL = { RA: N, WG: T, NA: '#5B8DEF' };
  const rows = ['RA', 'WG', 'NA'].map(b => ({ code: b, color: COL[b], target: tg.filter(x => bizOf(x.unit_code) === b).reduce((s, x) => s + +x.amount, 0), omzet: om.filter(x => bizOf(x.unit_code) === b).reduce((s, x) => s + +x.amount, 0) }));
  const wx = rows.map(r => { const c = r.target ? r.omzet / r.target : null;
    const w = c == null ? ['🌫️', 'target belum diisi', '#EEF1F6'] : c >= pace * .95 ? ['☀️', 'cerah · sesuai laju', '#FFF4DB'] : c >= pace * .8 ? ['🌥️', 'berawan · awasi', '#EEF1F6'] : r.omzet > 0 ? ['🌧️', 'hujan · tertinggal', '#E5EEF9'] : ['⛈️', 'badai · belum ada omzet', '#FDECEA'];
    return `<div style="background:${w[2]}"><span class="i">${w[0]}</span><b>${BIZN[r.code]}</b><small>${w[1]}<br>Rp${short(r.omzet)}${r.target ? ' / ' + short(r.target) : ''}</small></div>`; }).join('');
  const body = `<div class="row" style="grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)"><div class="scrollx">${mountain(rows, pace, `Target omzet ${MONL[d.getMonth()]} · hari ke-${d.getDate()} dari ${dim}`)}</div>
    <div><div class="wx">${wx}</div><p class="small muted" style="margin:10px 0 0">Cerah = omzet sesuai laju hari ini · berawan = sedikit tertinggal · hujan = tertinggal jauh. Dihitung dari target dan laporan omzet di halaman ini.</p></div></div>`;
  return shell('unit', '⛰️', 'Perjalanan target bulan ini', '', body);
}

/* ---------- pemasang ---------- */
export async function mount(el, k, params) {
  try {
    const role = ctx.me && ctx.me.role; if (!role || role === 'lapangan') return;
    css();
    const parts = [];
    if (k === 'kkh' && (!params || !params.get('d') || params.get('d') === today())) {
      if (role === 'ceo') parts.push(kemudi(el));
      if (role === 'kepala_staf') parts.push(menara(el));
      parts.push(beranda(el));
    } else if (k === 'unit') parts.push(unitBisnis(el));
    if (!parts.length) return;
    const html = (await Promise.allSettled(parts)).filter(r => r.status === 'fulfilled').map(r => r.value).join('');
    if (html && el.isConnected && !el.querySelector('.vpk-wrap')) place(el, html);
  } catch (e) { /* panel bersifat tambahan; diam bila gagal */ }
}

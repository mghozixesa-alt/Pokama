/* Visual bergambar Dasbor Keuangan Pokama (tema kendaraan, perjalanan, camping). Semua fungsi mengembalikan string SVG/HTML. */
const N = '#1F2B4D', T = '#09BEAF', TD = '#077A70', A = '#F2A33A', R = '#C0392B', G = '#1E9E6A', M = '#6B7486', L = '#E6E8EC', B = '#5B8DEF', S = '#A3ACB9';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pt = (cx, cy, r, d) => { const a = (d - 90) * Math.PI / 180; return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)]; };
const arc = (cx, cy, r, a0, a1) => { const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1); return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const short = (n) => { n = +n || 0; const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e9 ? s + (a / 1e9).toFixed(1).replace('.', ',') + ' M' : a >= 1e6 ? s + (a / 1e6).toFixed(1).replace('.', ',') + ' jt' : a >= 1e3 ? s + Math.round(a / 1e3) + ' rb' : s + Math.round(a); };
const dec = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace('.', ',');
let uid = 0;

/* Tangki bensin kas: runway (bulan) */
export function tank(runway, target = 6, max = 12) {
  const id = 'tk' + (++uid), cx = 182, cy = 150, r = 82, has = runway != null && isFinite(runway), v = has ? clamp(runway / max, 0, 1) : 0, a = -70 + 140 * v;
  let g = `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2E3F6B"/><stop offset="1" stop-color="${N}"/></linearGradient></defs>
    <path d="M60 70 Q60 40 100 36 L260 36 Q300 40 304 78 L310 176 Q312 212 270 216 L96 216 Q54 212 56 176 Z" fill="url(#${id})"/><rect x="150" y="22" width="60" height="18" rx="5" fill="#8E9AB8"/><rect x="160" y="14" width="40" height="12" rx="4" fill="#C9D1E6"/>`;
  const ang = (x) => -70 + 140 * clamp(x / max, 0, 1);
  g += `<path d="${arc(cx, cy, r, -70, ang(3))}" stroke="${R}" stroke-width="10" fill="none"/><path d="${arc(cx, cy, r, ang(3), ang(target))}" stroke="${A}" stroke-width="10" fill="none"/><path d="${arc(cx, cy, r, ang(target), 70)}" stroke="${T}" stroke-width="10" fill="none"/>`;
  for (let i = 0; i <= 8; i++) { const aa = -70 + i * 140 / 8, [x0, y0] = pt(cx, cy, r - 10, aa), [x1, y1] = pt(cx, cy, r - (i % 2 ? 18 : 24), aa); g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#fff" stroke-width="${i % 2 ? 1.5 : 2.5}"/>`; }
  const [ex, ey] = pt(cx, cy, r + 16, -74), [fx, fy] = pt(cx, cy, r + 16, 74);
  g += `<text x="${ex}" y="${ey + 4}" fill="#FFB4A8" font-size="16" font-weight="800" text-anchor="middle">E</text><text x="${fx}" y="${fy + 4}" fill="#9FF0E6" font-size="16" font-weight="800" text-anchor="middle">F</text>`;
  if (has) { const [nx, ny] = pt(cx, cy, r - 14, a); g += `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${A}" stroke-width="4" stroke-linecap="round"/>`; }
  g += `<circle cx="${cx}" cy="${cy}" r="10" fill="#fff"/><path d="M84 200 v-22 h15 v22 M80 200 h23 M99 182 l8 5 v10" fill="none" stroke="#C9D1E6" stroke-width="3" stroke-linejoin="round"/>`;
  g += `<text x="${cx}" y="190" text-anchor="middle" fill="#fff" font-size="24" font-weight="800">${has ? dec(runway) + ' bln' : '—'}</text><text x="${cx}" y="206" text-anchor="middle" fill="#9FB0D6" font-size="11" font-weight="700">${has ? 'sisa bensin kas · target ≥ ' + target : 'belum cukup data pengeluaran'}</text>`;
  return `<svg class="vz" viewBox="40 6 290 216" role="img" aria-label="Runway kas ${has ? dec(runway) + ' bulan' : 'belum ada data'}">${g}</svg>`;
}

/* Gauge zona keputusan (pilihan B) */
export function zone({ value, max = 100, zones, unit = '%', label, sub, target, prev, fmt = (v) => Math.round(v), status, better = 'up' }) {
  const cx = 130, cy = 120, Rr = 98, ang = (v) => -90 + 180 * clamp((v || 0) / max, 0, 1), has = value != null && isFinite(value);
  let g = `<path d="${arc(cx, cy, Rr, -90, 90)}" stroke="${L}" stroke-width="22" fill="none"/>`;
  zones.forEach(([a, b, c]) => { g += `<path d="${arc(cx, cy, Rr, ang(a), ang(b))}" stroke="${c}" stroke-width="22" fill="none"/>`; });
  for (let i = 0; i <= 10; i++) { const a = ang(max * i / 10), [x0, y0] = pt(cx, cy, Rr - 16, a), [x1, y1] = pt(cx, cy, Rr - (i % 5 ? 22 : 28), a); g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${M}" stroke-width="${i % 5 ? 1 : 2}"/>`; }
  [0, max / 2, max].forEach(v => { if (target != null && Math.abs(ang(v) - ang(target)) < 14 && v !== 0 && v !== max) return; const [tx, ty] = pt(cx, cy, Rr + 20, ang(v)); g += `<text x="${tx}" y="${ty + 4}" text-anchor="middle" fill="${M}" font-size="11" font-weight="700">${fmt(v)}</text>`; });
  if (prev != null && isFinite(prev)) { const [px, py] = pt(cx, cy, Rr - 30, ang(prev)); g += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${N}" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>`; }
  if (target != null) { const a = ang(target), [x0, y0] = pt(cx, cy, Rr + 14, a), [x1, y1] = pt(cx, cy, Rr - 14, a), [lx, ly] = pt(cx, cy, Rr + 26, a); g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${N}" stroke-width="3" stroke-dasharray="3 2"/><text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" font-weight="800" fill="${N}">target</text>`; }
  if (has) { const a = ang(value), [nx, ny] = pt(cx, cy, Rr - 8, a), [l1x, l1y] = pt(cx, cy, 7, a - 90), [l2x, l2y] = pt(cx, cy, 7, a + 90); g += `<path d="M${l1x} ${l1y} L${nx} ${ny} L${l2x} ${l2y} Z" fill="${N}"/>`; }
  g += `<circle cx="${cx}" cy="${cy}" r="10" fill="${N}"/><circle cx="${cx}" cy="${cy}" r="4" fill="#fff"/>`;
  const d = has && prev != null && isFinite(prev) ? value - prev : null;
  return `<div class="gz"><svg class="vz" viewBox="-14 -16 288 170" role="img" aria-label="${esc(label)}">${g}</svg>
    <div class="gzv"><b>${has ? fmt(value) + unit : '—'}</b>${status ? `<span class="gzs" style="background:${status[1]}22;color:${status[1]}">${status[0]}</span>` : ''}</div>
    <div class="gzl"><b>${esc(label)}</b>${d != null && Math.round(d) !== 0 ? `<span class="${(d > 0) === (better === 'up') ? 'good' : 'bad'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${unit} vs lalu</span>` : ''}</div><small>${esc(sub)}</small></div>`;
}

/* Timbangan neraca */
export function scale(aset, kew, eku) {
  const right = kew + eku, diff = aset - right, ok = Math.abs(diff) < 1, tilt = ok ? 0 : clamp(diff / Math.max(Math.abs(aset), 1) * 40, -14, 14), ratio = eku > 0 ? kew / eku : null;
  let g = `<rect x="196" y="40" width="8" height="150" fill="${N}"/><path d="M150 200 h100 l-14 -14 h-72z" fill="${N}"/><circle cx="200" cy="40" r="10" fill="${ok ? A : R}"/>`;
  g += `<g transform="rotate(${-tilt} 200 48)"><rect x="60" y="44" width="280" height="8" rx="4" fill="${ok ? N : R}"/>
    <line x1="80" y1="52" x2="60" y2="120" stroke="${M}" stroke-width="2"/><line x1="80" y1="52" x2="100" y2="120" stroke="${M}" stroke-width="2"/><path d="M50 120 h60 q-4 18 -30 18 q-26 0 -30 -18z" fill="${T}"/>
    <line x1="320" y1="52" x2="300" y2="120" stroke="${M}" stroke-width="2"/><line x1="320" y1="52" x2="340" y2="120" stroke="${M}" stroke-width="2"/><path d="M290 120 h60 q-4 18 -30 18 q-26 0 -30 -18z" fill="${N}"/>
    <rect x="62" y="96" width="36" height="24" rx="3" fill="${TD}"/><rect x="302" y="${120 - clamp(kew / Math.max(right, 1), .15, .85) * 30}" width="16" height="${clamp(kew / Math.max(right, 1), .15, .85) * 30}" rx="2" fill="${R}"/><rect x="320" y="${120 - clamp(eku / Math.max(right, 1), .15, .85) * 30}" width="18" height="${clamp(eku / Math.max(right, 1), .15, .85) * 30}" rx="2" fill="${G}"/></g>`;
  g += `<text x="80" y="170" text-anchor="middle" font-size="12" font-weight="800" fill="${TD}">ASET</text><text x="80" y="186" text-anchor="middle" font-size="13" font-weight="800" fill="${N}">Rp${short(aset)}</text>
    <text x="320" y="170" text-anchor="middle" font-size="11" font-weight="800" fill="${N}">KEWAJIBAN + EKUITAS</text><text x="320" y="186" text-anchor="middle" font-size="12.5" font-weight="800" fill="${N}">Rp${short(kew)} + Rp${short(eku)}</text>
    <text x="200" y="222" text-anchor="middle" font-size="12" font-weight="800" fill="${ok ? G : R}">${ok ? '✓ seimbang' : '✗ selisih Rp' + short(diff)}${ratio != null ? ' · hutang/modal ' + dec(ratio, 2) + '×' : ''}</text>`;
  return `<svg class="vz" viewBox="0 0 420 230" role="img" aria-label="Neraca ${ok ? 'seimbang' : 'tidak seimbang'}">${g}</svg>`;
}

/* Balapan menuju target omzet */
const VEH = {
  motor: (x, y, c) => `<g transform="translate(${x - 34},${y - 30})"><circle cx="10" cy="26" r="9" fill="none" stroke="${c}" stroke-width="4"/><circle cx="54" cy="26" r="9" fill="none" stroke="${c}" stroke-width="4"/><path d="M10 26 L24 12 L42 12 L54 26 M24 12 L30 26 L44 26 M40 6 L48 6 L42 12" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="30" cy="2" r="5" fill="${A}"/><path d="M26 7 L34 7 L36 14 L28 16Z" fill="${A}"/></g>`,
  bus: (x, y, c) => `<g transform="translate(${x - 60},${y - 34})"><rect x="0" y="4" width="60" height="26" rx="6" fill="${c}"/><rect x="5" y="9" width="12" height="9" rx="2" fill="#fff"/><rect x="20" y="9" width="12" height="9" rx="2" fill="#fff"/><rect x="35" y="9" width="12" height="9" rx="2" fill="#fff"/><path d="M50 9 h7 v12 h-7z" fill="#E3F7F5"/><circle cx="14" cy="31" r="6" fill="${N}"/><circle cx="46" cy="31" r="6" fill="${N}"/></g>`,
  truk: (x, y, c) => `<g transform="translate(${x - 62},${y - 34})"><rect x="0" y="6" width="40" height="24" rx="3" fill="${c}"/><rect x="6" y="11" width="16" height="10" rx="2" fill="#fff" opacity=".85"/><path d="M40 12 h12 l8 9 v9 h-20z" fill="${N}"/><rect x="44" y="15" width="8" height="6" fill="#E3F7F5"/><circle cx="12" cy="31" r="6" fill="${N}"/><circle cx="50" cy="31" r="6" fill="${N}"/></g>`,
};
// rows: [{name, veh:'motor'|'bus'|'truk', color, rev, target}], pace = bagian bulan yang sudah lewat (0–1)
export function race(rows, pace) {
  const W = 860, x0 = 130, x1 = W - 70; let g = '';
  rows.forEach((r, i) => {
    const y = 20 + i * 70, p = r.target ? clamp(r.rev / r.target, 0, 1) : 0, x = x0 + 30 + (x1 - x0 - 30) * p, cp = r.target ? r.rev / r.target : null;
    const col = cp == null ? M : cp >= pace * .95 ? TD : cp >= pace * .8 ? '#8A5A00' : R;
    g += `<text x="0" y="${y + 26}" font-size="14" font-weight="800" fill="${N}">${esc(r.name)}</text><text x="0" y="${y + 42}" font-size="11" fill="${M}">Rp${short(r.rev)}${r.target ? ' / ' + short(r.target) : ''}</text>
      <rect x="${x0 - 10}" y="${y + 12}" width="${x1 - x0 + 40}" height="36" rx="6" fill="#4A5468"/>`;
    for (let d = x0; d < x1; d += 34) g += `<rect x="${d}" y="${y + 28}" width="18" height="3" fill="#fff" opacity=".7"/>`;
    const px = x0 + 30 + (x1 - x0 - 30) * clamp(pace, 0, 1); g += `<line x1="${px}" x2="${px}" y1="${y + 8}" y2="${y + 52}" stroke="${A}" stroke-width="2" stroke-dasharray="3 3"/>`;
    g += `<g transform="translate(${x1 + 6},${y - 2})"><line x1="0" y1="10" x2="0" y2="52" stroke="${N}" stroke-width="3"/>${[0, 1, 2, 3].map(rr => [0, 1, 2].map(cc => `<rect x="${cc * 7}" y="${10 + rr * 7}" width="7" height="7" fill="${(rr + cc) % 2 ? '#fff' : N}"/>`).join('')).join('')}</g>`;
    g += VEH[r.veh](x, y + 44, r.color === N ? '#fff' : r.color);
    g += `<text x="${x - 20}" y="${y + 6}" text-anchor="middle" font-size="12" font-weight="800" fill="${col}">${cp == null ? 'belum ada target' : Math.round(cp * 100) + '%'}</text>`;
  });
  return `<svg class="vz" viewBox="0 0 ${W} ${20 + rows.length * 70}" role="img" aria-label="Capaian target omzet per unit bisnis">${g}</svg>`;
}

/* Lampu lalu lintas per unit: s = 0 hijau, 1 kuning, 2 merah */
export function lights(units) {
  const W = 420; let g = '';
  units.forEach((u, i) => {
    const x = 20 + i * 134;
    g += `<rect x="${x + 38}" y="150" width="10" height="44" fill="${M}"/><rect x="${x + 18}" y="10" width="50" height="140" rx="14" fill="${N}"/>`;
    [R, A, G].forEach((c, j) => { const on = (u.s === 2 && j === 0) || (u.s === 1 && j === 1) || (u.s === 0 && j === 2); g += `${on ? `<circle cx="${x + 43}" cy="${36 + j * 44}" r="22" fill="${c}" opacity=".25"/>` : ''}<circle cx="${x + 43}" cy="${36 + j * 44}" r="16" fill="${on ? c : '#2E3F6B'}"/>`; });
    g += `<text x="${x + 43}" y="212" text-anchor="middle" font-size="13" font-weight="800" fill="${N}">${esc(u.name)}</text><text x="${x + 43}" y="228" text-anchor="middle" font-size="10" fill="${M}">${esc(u.note)}</text>`;
  });
  return `<svg class="vz" viewBox="0 0 ${W} 236" role="img" aria-label="Status unit bisnis">${g}</svg>`;
}

/* Pesawat ketinggian margin: months = [{m:'2026-06', margin: angka % atau null}] */
export function plane(months) {
  const W = 420, H = 230, ms = months.filter(m => m.margin != null && isFinite(m.margin));
  const vals = ms.map(m => m.margin), lo = Math.floor(Math.min(0, ...vals) / 5) * 5, hi = Math.max(lo + 10, Math.ceil(Math.max(10, ...vals) / 5) * 5);
  const y = v => H - 40 - (v - lo) * (H - 70) / (hi - lo), x = i => 30 + i * (W - 90) / Math.max(1, months.length - 1);
  let g = `<defs><linearGradient id="sky${++uid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#E3F7F5"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${H - 30}" fill="url(#sky${uid})" rx="10"/>`;
  [[60, 40], [250, 28], [330, 74]].forEach(([cx, cy]) => g += `<g fill="#fff"><ellipse cx="${cx}" cy="${cy}" rx="26" ry="10"/><ellipse cx="${cx + 16}" cy="${cy - 6}" rx="16" ry="10"/></g>`);
  const step = (hi - lo) / 3; for (let v = lo; v <= hi + .01; v += step) g += `<line x1="20" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="${N}" stroke-opacity=".07"/><text x="${W - 8}" y="${y(v) - 3}" text-anchor="end" font-size="10" fill="${M}">${Math.round(v)}%</text>`;
  if (lo < 0) g += `<line x1="20" x2="${W - 10}" y1="${y(0)}" y2="${y(0)}" stroke="${R}" stroke-opacity=".5" stroke-dasharray="4 3"/>`;
  const pts = months.map((m, i) => m.margin != null && isFinite(m.margin) ? [x(i), y(m.margin)] : null).filter(Boolean);
  if (pts.length > 1) g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${T}" stroke-width="3" stroke-dasharray="6 5"/>`;
  pts.forEach(p => g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${TD}"/>`);
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  if (last) {
    const up = !prev || last[1] <= prev[1], rot = prev ? clamp(Math.atan2(last[1] - prev[1], last[0] - prev[0]) * 180 / Math.PI, -35, 35) : -10, lm = ms[ms.length - 1].margin;
    g += `<g transform="translate(${last[0]},${last[1]}) rotate(${rot})"><path d="M-30 0 L28 -3 Q40 0 28 3 Z" fill="${N}"/><path d="M-6 -2 L-18 -20 L-10 -20 L8 -2Z" fill="${N}"/><path d="M-6 2 L-18 20 L-10 20 L8 2Z" fill="${N}"/><path d="M-28 -1 L-36 -11 L-30 -11 L-22 -1Z" fill="${A}"/><circle cx="20" cy="-1" r="2" fill="#fff"/><circle cx="12" cy="-1" r="2" fill="#fff"/></g>`;
    g += `<text x="${last[0] - 24}" y="${Math.max(16, last[1] - 28)}" font-size="14" font-weight="800" fill="${lm < 0 ? R : N}" text-anchor="end">margin ${dec(lm)}% ${up ? '▲' : '▼'}</text>`;
  } else g += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="${M}">Belum ada pendapatan tercatat</text>`;
  g += `<rect x="0" y="${H - 30}" width="${W}" height="30" fill="${G}" opacity=".15"/>`;
  months.forEach((m, i) => g += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="${M}">${MON[+m.m.slice(5, 7) - 1]}</text>`);
  return `<svg class="vz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Margin laba bersih 6 bulan">${g}</svg>`;
}

/* Tenda utilisasi unit sewa */
export function tent(u, target = .6) {
  const W = 420, H = 230, tot = +u.total || 0, p = tot ? u.rented / tot : 0, id = 'tc' + (++uid), yp = 190 - 150 * clamp(p, 0, 1), yt = 190 - 150 * target;
  let g = `<defs><clipPath id="${id}"><path d="M60 190 L190 40 L320 190Z"/></clipPath></defs><rect x="0" y="0" width="${W}" height="${H}" fill="${N}" rx="10"/>`;
  for (let i = 0; i < 24; i++) g += `<circle cx="${(i * 73) % W}" cy="${(i * 41) % 120 + 8}" r="${i % 3 ? 1 : 1.8}" fill="#fff" opacity=".7"/>`;
  g += `<circle cx="360" cy="40" r="16" fill="#F5E6B8"/><circle cx="366" cy="35" r="14" fill="${N}"/>`;
  g += `<path d="M60 190 L190 40 L320 190Z" fill="#33467A"/><rect x="60" y="${yp}" width="260" height="${190 - yp}" fill="${p >= target ? T : A}" clip-path="url(#${id})"/><path d="M60 190 L190 40 L320 190Z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M190 40 L190 190" stroke="#fff" stroke-opacity=".4" stroke-width="2"/><path d="M168 190 L190 140 L212 190" fill="${N}"/>`;
  g += `<line x1="40" y1="190" x2="340" y2="190" stroke="#4E5F8C" stroke-width="3"/><line x1="56" y1="${yt}" x2="330" y2="${yt}" stroke="${A}" stroke-width="2" stroke-dasharray="4 3"/><text x="334" y="${yt + 4}" font-size="10" font-weight="800" fill="${A}">target ${Math.round(target * 100)}%</text>`;
  g += `<g transform="translate(372,186)"><path d="M-14 0 L14 0" stroke="#8B5A2B" stroke-width="4"/><path d="M0 -26 Q10 -12 6 -4 Q14 -10 10 -20 Q18 -8 8 0 L-8 0 Q-16 -10 -6 -22 Q-6 -12 0 -6 Q-4 -16 0 -26Z" fill="${A}"/></g>`;
  g += `<text x="190" y="${Math.min(176, Math.max(120, yp + 34))}" text-anchor="middle" font-size="26" font-weight="800" fill="#fff">${Math.round(p * 100)}%</text><text x="190" y="214" text-anchor="middle" font-size="11.5" fill="#C9D1E6" font-weight="700">${u.rented} disewa · ${u.ready} siap · ${u.service} servis · dari ${tot} unit</text>`;
  return `<svg class="vz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Utilisasi unit ${Math.round(p * 100)} persen">${g}</svg>`;
}

/* Baterai Profit First: pos = [{name, actual %, target %, color}] */
export function batteries(pos) {
  const W = 420, n = pos.length, w = W / n; let g = '';
  pos.forEach((p, i) => {
    const x = i * w + (w - 68) / 2, h = 130, mx = Math.max(p.target * 1.5, p.actual, 1), fill = clamp(p.actual / mx, 0, 1), ok = p.actual >= p.target * .95, ty = 26 + (h - 12) * (1 - p.target / mx);
    g += `<rect x="${x + 22}" y="10" width="24" height="10" rx="3" fill="${N}"/><rect x="${x + 6}" y="20" width="56" height="${h}" rx="10" fill="#fff" stroke="${N}" stroke-width="4"/>
      <rect x="${x + 12}" y="${26 + (h - 12) * (1 - fill)}" width="44" height="${(h - 12) * fill}" rx="5" fill="${ok ? p.color : R}"/>
      <line x1="${x}" x2="${x + 68}" y1="${ty}" y2="${ty}" stroke="${A}" stroke-width="2.5" stroke-dasharray="4 3"/>${ok ? '' : `<path d="M${x + 38} 60 l-10 18 h8 l-4 16 l12 -20 h-8z" fill="${fill > .4 ? '#fff' : R}"/>`}
      <text x="${x + 34}" y="172" text-anchor="middle" font-size="15" font-weight="800" fill="${N}">${Math.round(p.actual)}%</text><text x="${x + 34}" y="188" text-anchor="middle" font-size="10.5" fill="${M}">${esc(p.name)}</text><text x="${x + 34}" y="202" text-anchor="middle" font-size="10" font-weight="700" fill="${ok ? TD : R}">target ${p.target}%</text>`;
  });
  return `<svg class="vz" viewBox="0 0 ${W} 210" role="img" aria-label="Profit First per pos">${g}</svg>`;
}

/* Odometer omzet */
export function odometer(ytd, month, yearTarget) {
  const W = 420, H = 230, k = Math.max(0, Math.round(ytd / 1000)), dig = String(k).padStart(7, '0').slice(-7);
  let g = `<rect x="10" y="20" width="${W - 20}" height="190" rx="18" fill="${N}"/><rect x="22" y="32" width="${W - 44}" height="166" rx="12" fill="#0F1830"/>
    <text x="${W / 2}" y="62" text-anchor="middle" fill="#9FB0D6" font-size="12" font-weight="800" letter-spacing="2">OMZET TAHUN BERJALAN (RIBU RP)</text>`;
  [...dig].forEach((d, i) => { const x = 46 + i * 48; g += `<rect x="${x}" y="78" width="40" height="58" rx="6" fill="${i >= 5 ? A : '#fff'}"/><rect x="${x}" y="105" width="40" height="2" fill="#0F1830" opacity=".25"/><text x="${x + 20}" y="122" text-anchor="middle" font-size="36" font-weight="800" font-family="ui-monospace,Menlo,monospace" fill="${N}">${d}</text>`; });
  g += `<text x="46" y="168" fill="#C9D1E6" font-size="12" font-weight="700">TRIP bulan ini</text><text x="46" y="188" fill="#fff" font-size="18" font-weight="800">Rp${short(month)}</text>
    <text x="${W - 46}" y="168" text-anchor="end" fill="#C9D1E6" font-size="12" font-weight="700">target tahun</text><text x="${W - 46}" y="188" text-anchor="end" fill="${T}" font-size="18" font-weight="800">${yearTarget ? 'Rp' + short(yearTarget) + ' · ' + Math.round(ytd / yearTarget * 100) + '%' : 'belum diisi'}</text>`;
  return `<svg class="vz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Omzet tahun berjalan">${g}</svg>`;
}

/* Peta perjalanan target tahunan: months = [{m, rev, target}], cur = indeks bulan berjalan */
export function roadmap(months, cur, year) {
  const W = 1290, H = 210, n = months.length; let g = `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#EFF8F1"/>`;
  for (let i = 0; i < 18; i++) g += `<g transform="translate(${(i * 157) % W},${i % 2 ? 182 : 22})"><path d="M0 0 l8 -16 l8 16z" fill="${G}" opacity=".35"/></g>`;
  const pts = months.map((m, i) => [60 + i * (W - 120) / (n - 1), i % 2 ? 128 : 84]);
  let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 1; i < n; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; d += ` C${(x0 + x1) / 2} ${y0} ${(x0 + x1) / 2} ${y1} ${x1} ${y1}`; }
  g += `<path d="${d}" fill="none" stroke="#C9B48A" stroke-width="18" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 8"/>`;
  let hit = 0, withT = 0;
  months.forEach((m, i) => {
    const [x, y] = pts[i], past = i < cur, st = i > cur ? ['berikutnya', S] : i === cur ? ['berjalan', A] : !+m.target ? ['tanpa target', S] : +m.rev >= +m.target ? ['tercapai', TD] : ['meleset', R];
    if (past && +m.target) { withT++; if (+m.rev >= +m.target) hit++; }
    g += `<g transform="translate(${x},${y - 20})"><path d="M0 18 C-14 0 -14 -16 0 -16 C14 -16 14 0 0 18Z" fill="${st[1]}"/><circle cx="0" cy="-4" r="5" fill="#fff"/></g>
      <text x="${x}" y="${y + 30}" text-anchor="middle" font-size="12" font-weight="800" fill="${N}">${MON[i]}</text><text x="${x}" y="${y + 44}" text-anchor="middle" font-size="10.5" fill="${st[1] === S ? M : st[1]}" font-weight="700">${st[0]}</text>
      ${+m.rev || +m.target ? `<text x="${x}" y="${y + 57}" text-anchor="middle" font-size="9.5" fill="${M}">${short(m.rev)}${+m.target ? ' / ' + short(m.target) : ''}</text>` : ''}`;
  });
  if (cur >= 0 && cur < n) {
    const [jx, jy] = cur > 0 ? [(pts[cur - 1][0] + pts[cur][0]) / 2 + 20, (pts[cur - 1][1] + pts[cur][1]) / 2] : [pts[0][0] + 40, pts[0][1]];
    g += `<g transform="translate(${jx},${jy - 22})"><rect x="-30" y="0" width="60" height="22" rx="5" fill="${A}"/><rect x="-18" y="-10" width="30" height="12" rx="3" fill="${A}"/><rect x="-14" y="-7" width="10" height="7" fill="#E3F7F5"/><rect x="0" y="-7" width="10" height="7" fill="#E3F7F5"/><circle cx="-16" cy="24" r="7" fill="${N}"/><circle cx="16" cy="24" r="7" fill="${N}"/><rect x="28" y="6" width="6" height="10" fill="${N}"/></g>`;
  }
  g += `<text x="${W - 20}" y="28" text-anchor="end" font-size="13" font-weight="800" fill="${N}">Rute target ${year} · ${withT ? hit + ' dari ' + withT + ' bulan bertarget tercapai' : 'target bulanan belum diisi'}</text>`;
  return `<svg class="vz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rute target omzet tahunan">${g}</svg>`;
}

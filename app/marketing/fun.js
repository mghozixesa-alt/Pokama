/* Lapisan kreatif Dashboard Marketing Pokama: ilustrasi, cerita, simulasi, gamifikasi, papan visual.
   Semua angka = data contoh yang sama dengan halaman. Dipasang ke elemen [data-island] setiap halaman selesai digambar. */
(function () {
  'use strict';
  var NAVY = '#1D3149', TEAL = '#09BEAF', MINT = '#DDF5F2', GOOD = '#067A70', BAD = '#9A3F0A', WARM = '#F2A33A';
  var UC = { Rentalaja: '#2F6FD0', TripinAja: '#0FA394', Niagaaja: '#D08A1E' };
  var UNITS = ['Rentalaja', 'TripinAja', 'Niagaaja'];
  var store = {};
  try { store = JSON.parse(sessionStorage.getItem('pk-fun') || '{}'); } catch (e) { store = {}; }
  function save() { try { sessionStorage.setItem('pk-fun', JSON.stringify(store)); } catch (e) {} }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dec(n, d) { return n.toFixed(d).replace('.', ','); }
  function num(n) { return Math.round(n).toLocaleString('id-ID'); }
  function rb(n) { return n >= 1000 ? dec(n / 1000, 1) + ' rb' : num(n); }
  function jt(n) { return 'Rp ' + dec(n / 1e6, 1) + ' jt'; }
  function rp(n) { if (n >= 1e6) return jt(n).replace(',0 jt', ' jt'); var k = n / 1000; return 'Rp ' + (Math.abs(k - Math.round(k)) < 0.05 ? num(k) : dec(k, 1)) + ' rb'; }
  function unitOf() { var c = window.dcComp; return c && c.state && c.state.unit ? c.state.unit : 'Semua'; }
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  /* ---------- Ilustrasi ---------- */
  var SKY = {
    Rentalaja: ['#CFE0FA', '#F5F8FE'], TripinAja: ['#FFD6A8', '#FFF4E6'], Niagaaja: ['#FBE3BD', '#FFF8EC'], Semua: ['#D3F1EC', '#F4FBFA']
  };
  function sceneKind(t) {
    t = (t || '').toLowerCase();
    var M = [
      [/study tour|sekolah|\bsma\b|rombongan/, 'people'], [/open trip|\btrip\b/, 'mountain'],
      [/curug|air terjun/, 'falls'], [/situ|danau|bagendit/, 'lake'], [/glamping|tenda/, 'tent'],
      [/sunrise|papandayan|cikuray|gunung|trek|kawah|kamojang|darajat|pendakian|outdoor|pecinta alam/, 'mountain'],
      [/iphone|ps\b|gamer|unboxing/, 'phone'], [/kamera|prewed|fotografer|wisuda/, 'camera'],
      [/laptop|macbook|thinkpad|dkv|servis|trade-in|stok|garansi|teknologi|tech/, 'laptop'],
      [/ruma metua|menginap|villa|akhir pekan|rumah/, 'house'], [/motor|vario|beat|rute|otomotif/, 'motor'],
      [/promo|flash|sale|early bird|hemat|gratis|diskon|bundling|lelang|harga/, 'tag'],
      [/biaya|itinerary|packing|estimasi|syarat|cara|tips|list|kuis|polling|tebak/, 'map'],
      [/tim|guide|briefing|cs|di balik|kondisi|cek/, 'team'], [/keluarga|rombongan|peserta|testimoni|pelanggan|mahasiswa|kampus|kuliner|komunitas|travel|vlogger|creator/, 'people']
    ];
    for (var i = 0; i < M.length; i++) if (M[i][0].test(t)) return M[i][1];
    return 'map';
  }
  function scene(kind, unit, seed) {
    unit = unit || 'Semua';
    var c = UC[unit] || TEAL, sky = SKY[unit] || SKY.Semua, id = 'g' + (seed || hash(kind + unit)) % 99991;
    var defs = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient></defs>';
    var bg = '<rect width="160" height="200" fill="url(#' + id + ')"/>';
    var hills = '<path d="M0 150 Q40 128 80 146 T160 140 V200 H0Z" fill="' + MINT + '"/><path d="M0 168 Q50 152 100 166 T160 162 V200 H0Z" fill="#BFE9E3"/>';
    var sun = '<circle cx="122" cy="46" r="16" fill="#FFF" opacity=".75"/>';
    var body = '';
    switch (kind) {
      case 'mountain':
        body = '<circle cx="112" cy="62" r="20" fill="#FFB46B"/><path d="M-10 160 L52 70 L84 112 L104 88 L170 160Z" fill="' + NAVY + '"/><path d="M52 70 L64 88 L56 86 L48 94 L44 82Z" fill="#fff"/><path d="M104 88 L114 102 L104 99 L97 104Z" fill="#fff"/><path d="M-10 175 L40 120 L80 160 L120 128 L170 175Z" fill="' + c + '"/>' + hills.replace('M0 150', 'M0 170').replace('V200', 'V200');
        break;
      case 'falls':
        body = sun + '<path d="M0 40 H58 V150 H0Z" fill="' + NAVY + '"/><path d="M102 30 H160 V150 H102Z" fill="' + NAVY + '"/><path d="M58 52 H102 V150 H58Z" fill="#9FE3F0"/><path d="M66 52 V150 M78 52 V150 M90 52 V150" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/><ellipse cx="80" cy="156" rx="60" ry="14" fill="#7FD3E6"/><circle cx="20" cy="44" r="16" fill="' + c + '"/><circle cx="140" cy="34" r="18" fill="' + c + '"/><circle cx="40" cy="40" r="12" fill="#13A58F"/>' + '<path d="M0 166 Q80 150 160 166 V200 H0Z" fill="#BFE9E3"/>';
        break;
      case 'lake':
        body = '<circle cx="80" cy="96" r="22" fill="#FFB46B"/><path d="M-10 120 Q40 80 80 112 Q120 84 170 120Z" fill="' + c + '"/><rect y="118" width="160" height="82" fill="#8FD6E8"/><path d="M60 124 H100 M50 136 H110 M64 148 H96" stroke="#FFD29A" stroke-width="3" stroke-linecap="round"/><path d="M14 150 l10 -6 l10 6 z" fill="' + NAVY + '"/>';
        break;
      case 'tent':
        body = '<path d="M-10 140 L48 66 L96 130 L170 140Z" fill="' + NAVY + '" opacity=".85"/><circle cx="118" cy="44" r="14" fill="#FFE7A3"/>' + hills + '<path d="M38 160 L80 96 L122 160Z" fill="#F2A33A"/><path d="M80 96 L92 160 H68Z" fill="#C2410C"/><path d="M24 110 Q80 92 136 110" stroke="#fff" stroke-dasharray="1 9" stroke-width="4" stroke-linecap="round" fill="none"/>';
        break;
      case 'phone':
        body = sun + hills + '<rect x="46" y="34" width="68" height="130" rx="14" fill="' + NAVY + '"/><rect x="52" y="44" width="56" height="106" rx="8" fill="' + c + '"/><circle cx="66" cy="54" r="5" fill="' + NAVY + '"/><circle cx="66" cy="66" r="5" fill="' + NAVY + '"/><path d="M58 128 Q80 104 102 128" stroke="#fff" stroke-width="4" fill="none" opacity=".7"/><rect x="70" y="156" width="20" height="3" rx="1.5" fill="#fff" opacity=".6"/>';
        break;
      case 'camera':
        body = sun + hills + '<rect x="30" y="76" width="100" height="66" rx="12" fill="' + NAVY + '"/><rect x="48" y="66" width="30" height="14" rx="4" fill="' + NAVY + '"/><circle cx="80" cy="110" r="24" fill="#fff"/><circle cx="80" cy="110" r="17" fill="' + c + '"/><circle cx="74" cy="104" r="5" fill="#fff" opacity=".8"/><circle cx="116" cy="88" r="4" fill="' + WARM + '"/>';
        break;
      case 'laptop':
        body = sun + '<rect y="150" width="160" height="50" fill="#E9D9C2"/><path d="M38 66 H122 V136 H38Z" fill="' + NAVY + '"/><rect x="44" y="72" width="72" height="58" rx="3" fill="' + c + '"/><path d="M52 86 H96 M52 98 H108 M52 110 H86" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/><path d="M26 136 H134 L142 150 H18Z" fill="#9AA3AF"/><rect x="128" y="120" width="12" height="16" rx="3" fill="' + WARM + '"/>';
        break;
      case 'house':
        body = '<circle cx="124" cy="44" r="14" fill="#FFE7A3"/>' + hills + '<path d="M30 100 L80 60 L130 100Z" fill="#C2410C"/><rect x="40" y="98" width="80" height="60" fill="#FFF7EC"/><rect x="72" y="120" width="18" height="38" fill="' + NAVY + '"/><rect x="48" y="110" width="16" height="14" fill="#FFD29A"/><rect x="98" y="110" width="16" height="14" fill="#FFD29A"/><circle cx="20" cy="140" r="14" fill="' + c + '"/><circle cx="142" cy="142" r="12" fill="' + c + '"/>';
        break;
      case 'motor':
        body = sun + '<rect y="150" width="160" height="50" fill="#5B6573"/><path d="M0 172 H160" stroke="#fff" stroke-dasharray="14 10" stroke-width="3"/><circle cx="48" cy="140" r="16" fill="' + NAVY + '"/><circle cx="48" cy="140" r="6" fill="#fff"/><circle cx="116" cy="140" r="16" fill="' + NAVY + '"/><circle cx="116" cy="140" r="6" fill="#fff"/><path d="M40 128 Q56 100 88 112 L108 112 Q118 112 120 126 L52 132Z" fill="' + c + '"/><path d="M100 112 L110 84 H124" stroke="' + NAVY + '" stroke-width="5" stroke-linecap="round" fill="none"/><rect x="62" y="102" width="30" height="8" rx="4" fill="' + NAVY + '"/>';
        break;
      case 'tag':
        body = '<circle cx="34" cy="40" r="6" fill="' + WARM + '"/><circle cx="132" cy="150" r="5" fill="' + TEAL + '"/><path d="M126 36 l4 8 l8 1 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6 l8 -1z" fill="#FFD29A"/><path d="M40 70 H108 L132 100 L108 130 H40 Q32 130 32 122 V78 Q32 70 40 70Z" fill="' + c + '"/><circle cx="110" cy="100" r="7" fill="#fff"/><text x="70" y="112" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="900" font-size="34" fill="#fff">%</text>';
        break;
      case 'team':
        body = sun + hills + people(c, 3);
        break;
      case 'people':
        body = '<circle cx="120" cy="44" r="14" fill="#FFE7A3"/>' + hills + people(c, 4);
        break;
      default:
        body = sun + '<path d="M28 52 L60 40 L100 52 L132 40 V150 L100 162 L60 150 L28 162Z" fill="#fff"/><path d="M60 40 V150 M100 52 V162" stroke="#E3E6EB" stroke-width="2"/><path d="M40 136 Q60 110 76 120 T112 82" stroke="' + c + '" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round" fill="none"/><path d="M112 64 a12 12 0 0 1 12 12 c0 10 -12 20 -12 20 s-12 -10 -12 -20 a12 12 0 0 1 12 -12z" fill="' + WARM + '"/><circle cx="112" cy="76" r="4" fill="#fff"/>';
    }
    return '<svg viewBox="0 0 160 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + defs + bg + body + '</svg>';
  }
  function people(c, n) {
    var cols = [c, WARM, NAVY, '#13A58F'], s = '';
    var xs = n === 3 ? [46, 80, 114] : [34, 64, 96, 126];
    xs.forEach(function (x, i) {
      var top = i % 2 ? 98 : 90;
      s += '<path d="M' + (x - 18) + ' 170 Q' + (x - 18) + ' ' + (top + 26) + ' ' + x + ' ' + (top + 26) + ' Q' + (x + 18) + ' ' + (top + 26) + ' ' + (x + 18) + ' 170Z" fill="' + cols[i % 4] + '"/><circle cx="' + x + '" cy="' + (top + 8) + '" r="13" fill="#F6C9A0"/><path d="M' + (x - 13) + ' ' + (top + 6) + ' Q' + x + ' ' + (top - 14) + ' ' + (x + 13) + ' ' + (top + 6) + '" fill="' + NAVY + '"/>';
    });
    return s;
  }
  function thumb(text, unit) { return scene(sceneKind(text), unit, hash(text)); }

  function spot(kind) {
    var s = '<svg viewBox="0 0 140 100" aria-hidden="true">';
    switch (kind) {
      case 'calendar':
        s += '<ellipse cx="70" cy="90" rx="46" ry="6" fill="#E3E6EB"/><rect x="34" y="22" width="72" height="62" rx="10" fill="#fff" stroke="' + NAVY + '" stroke-width="3"/><path d="M34 40 H106" stroke="' + NAVY + '" stroke-width="3"/><rect x="34" y="22" width="72" height="18" rx="9" fill="' + TEAL + '"/><path d="M50 16 V28 M90 16 V28" stroke="' + NAVY + '" stroke-width="4" stroke-linecap="round"/><path d="M58 60 h24 M70 48 v24" stroke="' + WARM + '" stroke-width="5" stroke-linecap="round"/>';
        break;
      case 'plug':
        s += '<path d="M6 60 Q30 60 40 50" stroke="' + NAVY + '" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="38" y="36" width="22" height="28" rx="6" fill="' + NAVY + '"/><path d="M60 44 h10 M60 56 h10" stroke="' + NAVY + '" stroke-width="4" stroke-linecap="round"/><rect x="82" y="36" width="22" height="28" rx="6" fill="' + TEAL + '"/><path d="M104 50 Q118 50 134 40" stroke="' + TEAL + '" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M76 30 l-4 8 h6 l-4 8" stroke="' + WARM + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="76" cy="74" r="3" fill="' + WARM + '"/>';
        break;
      case 'trophy':
        s += '<ellipse cx="70" cy="92" rx="34" ry="5" fill="#E3E6EB"/><path d="M48 18 H92 V40 Q92 62 70 62 Q48 62 48 40Z" fill="#FFC24B"/><path d="M48 26 H36 Q36 46 52 48 M92 26 H104 Q104 46 88 48" stroke="#FFC24B" stroke-width="5" fill="none"/><rect x="64" y="62" width="12" height="14" fill="#E0A22F"/><rect x="52" y="76" width="36" height="10" rx="3" fill="' + NAVY + '"/><path d="M62 32 l5 5 l10 -10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22" cy="24" r="3" fill="' + TEAL + '"/><circle cx="118" cy="18" r="4" fill="' + WARM + '"/><path d="M116 66 l3 6 l6 1 l-4 4 l1 6 l-6 -3 l-6 3 l1 -6 l-4 -4 l6 -1z" fill="' + TEAL + '"/>';
        break;
      case 'leak':
        s += '<ellipse cx="70" cy="92" rx="40" ry="5" fill="#E3E6EB"/><path d="M40 20 H100 L84 50 V70 H56 V50Z" fill="#fff" stroke="' + NAVY + '" stroke-width="3" stroke-linejoin="round"/><path d="M47 30 H93 L82 50 V62 H58 V50Z" fill="' + TEAL + '" opacity=".35"/><circle cx="64" cy="80" r="5" fill="' + WARM + '"/><circle cx="78" cy="88" r="3.5" fill="' + WARM + '"/><path d="M100 30 l12 -6 M104 42 l12 2" stroke="' + WARM + '" stroke-width="3" stroke-linecap="round"/><text x="22" y="40" font-family="Nunito" font-weight="900" font-size="18" fill="' + BAD + '">Rp</text>';
        break;
      case 'star':
        s += '<ellipse cx="70" cy="92" rx="40" ry="5" fill="#E3E6EB"/><rect x="22" y="18" width="96" height="58" rx="14" fill="#fff" stroke="' + NAVY + '" stroke-width="3"/><path d="M40 76 l-6 14 l18 -14" fill="#fff" stroke="' + NAVY + '" stroke-width="3" stroke-linejoin="round"/>' +
          [40, 58, 76, 94].map(function (x, i) { return '<path transform="translate(' + x + ' 46)" d="M0 -10 l3 6 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1z" fill="' + (i < 3 ? '#FFC24B' : '#E3E6EB') + '"/>'; }).join('');
        break;
      case 'rocket':
        s += '<ellipse cx="70" cy="92" rx="30" ry="5" fill="#E3E6EB"/><path d="M70 8 Q92 28 88 62 H52 Q48 28 70 8Z" fill="#fff" stroke="' + NAVY + '" stroke-width="3"/><circle cx="70" cy="36" r="8" fill="' + TEAL + '" stroke="' + NAVY + '" stroke-width="3"/><path d="M52 50 L38 66 H54 M88 50 L102 66 H86" fill="' + WARM + '" stroke="' + NAVY + '" stroke-width="3" stroke-linejoin="round"/><path d="M60 64 Q70 92 80 64" fill="#FFB46B"/>';
        break;
      case 'store':
      default:
        s += '<ellipse cx="70" cy="92" rx="46" ry="5" fill="#E3E6EB"/><rect x="30" y="40" width="80" height="48" fill="#fff" stroke="' + NAVY + '" stroke-width="3"/><path d="M26 40 L36 18 H104 L114 40Z" fill="' + TEAL + '" stroke="' + NAVY + '" stroke-width="3" stroke-linejoin="round"/><rect x="60" y="58" width="20" height="30" fill="' + NAVY + '"/><rect x="38" y="52" width="16" height="14" fill="#FFD29A"/><rect x="86" y="52" width="16" height="14" fill="#FFD29A"/>';
    }
    return s + '</svg>';
  }
  function avatar(name, unit, size) {
    var parts = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean);
    var ini = ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    var c = UC[unit] || TEAL, h = hash(name) % 3, c2 = [WARM, TEAL, '#7C8CF8'][h];
    size = size || 44;
    return '<span class="fx-av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px;background:linear-gradient(135deg,' + c + ',' + c2 + ')">' + esc(ini) + '</span>';
  }

  /* ---------- Efek ---------- */
  function confetti() {
    if (reduceMotion) return;
    var cv = document.createElement('canvas'); cv.className = 'fx-confetti';
    var W = cv.width = innerWidth, H = cv.height = innerHeight; document.body.appendChild(cv);
    var ctx = cv.getContext('2d'), cols = [TEAL, WARM, '#2F6FD0', '#FFC24B', NAVY, '#FF8FA3'];
    var P = []; for (var i = 0; i < 140; i++) P.push({ x: W / 2 + (Math.random() - 0.5) * 200, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6, c: cols[i % cols.length] });
    var t0 = performance.now();
    (function step(t) {
      ctx.clearRect(0, 0, W, H);
      P.forEach(function (p) { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(step); else cv.remove();
    })(t0);
  }
  var toastT;
  function toast(msg) {
    var el = document.querySelector('.fx-toast');
    if (!el) { el = document.createElement('div'); el.className = 'fx-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  function modal(html, cls) {
    closeModal();
    var wrap = document.createElement('div'); wrap.className = 'fx-modal ' + (cls || '');
    wrap.innerHTML = '<div class="fx-modal-card" role="dialog" aria-modal="true">' + html + '<button type="button" class="fx-x" aria-label="Tutup">×</button></div>';
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('.fx-x')) closeModal(); });
    document.body.appendChild(wrap); document.body.classList.add('fx-lock');
    var f = wrap.querySelector('.fx-x'); if (f) f.focus();
    return wrap;
  }
  function closeModal() { var m = document.querySelector('.fx-modal'); if (m) { if (m._cleanup) m._cleanup(); m.remove(); } document.body.classList.remove('fx-lock'); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  function countUp(root) {
    if (reduceMotion) return;
    root.querySelectorAll('[data-count]').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-count')), fmt = el.getAttribute('data-fmt') || 'num', t0 = performance.now();
      (function step(t) { var k = Math.min(1, (t - t0) / 900), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = fmtv(v, fmt); if (k < 1) requestAnimationFrame(step); })(t0);
    });
  }
  function fmtv(v, f) { return f === 'jt' ? jt(v) : f === 'rb' ? rb(v) : f === 'x' ? dec(v, 1) + 'x' : f === 'pct' ? dec(v, 1) + '%' : num(v); }
  function bind(root, map) { root.querySelectorAll('[data-act]').forEach(function (el) { var a = el.getAttribute('data-act'); if (map[a]) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'click', function (e) { map[a](el, e); }); }); }
  function chips(list, on, act) { return '<div class="fx-chips" role="group">' + list.map(function (x) { var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<button type="button" class="fx-chip' + (v === on ? ' on' : '') + '" aria-pressed="' + (v === on) + '" data-act="' + act + '" data-v="' + esc(v) + '">' + esc(l) + '</button>'; }).join('') + '</div>'; }
  function head(title, sub, right) { return '<div class="fx-head"><div><h2>' + title + '</h2>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>' + (right || '') + '</div>'; }

  /* ---------- Data contoh bersama ---------- */
  var D = {
    Rentalaja: { reach: 186400, reachT: 200000, fol: 410, folT: 450, chat: 268, chatT: 280, post: 15, postT: 21, rev: 16, revT: 25, close: 74, omzet: 41200000 },
    TripinAja: { reach: 168900, reachT: 180000, fol: 620, folT: 600, chat: 152, chatT: 170, post: 14, postT: 19, rev: 6, revT: 10, close: 38, omzet: 43600000 },
    Niagaaja: { reach: 57500, reachT: 70000, fol: 95, folT: 150, chat: 66, chatT: 70, post: 8, postT: 12, rev: 1, revT: 5, close: 19, omzet: 11600000 }
  };
  function agg(unit) {
    var pick = unit === 'Semua' ? UNITS : [unit], o = {};
    Object.keys(D.Rentalaja).forEach(function (k) { o[k] = pick.reduce(function (s, u) { return s + D[u][k]; }, 0); });
    return o;
  }
  var TOP = [ // dari halaman Sosial Media, minggu 22–27 Okt
    { unit: 'TripinAja', type: 'Carousel', date: '25 Okt', cap: 'Estimasi biaya liburan Garut 3 hari', reach: '7,6 rb', er: 6.2, saves: 94, pic: 'Mugni' },
    { unit: 'TripinAja', type: 'Reels', date: '27 Okt', cap: 'Curug Citiis yang masih tersembunyi', reach: '9,3 rb', er: 6.1, saves: 69, pic: 'Mugni' },
    { unit: 'Rentalaja', type: 'Reels', date: '27 Okt', cap: '3 hal dicek sebelum sewa motor', reach: '10,8 rb', er: 3.9, saves: 51, pic: 'Dita' },
    { unit: 'Rentalaja', type: 'Reels', date: '23 Okt', cap: 'Flash sale weekend: Beat Rp 85 rb', reach: '6,5 rb', er: 3.5, saves: 28, pic: 'Dita' },
    { unit: 'Niagaaja', type: 'Reels', date: '26 Okt', cap: 'Garansi toko 30 hari', reach: '2,9 rb', er: 3.2, saves: 11, pic: 'Kevin' },
    { unit: 'TripinAja', type: 'Reels', date: '22 Okt', cap: 'Early bird trip tahun baru', reach: '6,8 rb', er: 5.7, saves: 47, pic: 'Mugni' }
  ];
  var TEAM = [
    { name: 'Mugni', unit: 'TripinAja', role: 'Konten TripinAja', pts: 1240, streak: 12, ontime: 88, badges: ['Raja Carousel', 'ER tertinggi'] },
    { name: 'Dita', unit: 'Rentalaja', role: 'Konten Rentalaja', pts: 1105, streak: 6, ontime: 79, badges: ['Reach tertinggi'] },
    { name: 'Kevin', unit: 'Niagaaja', role: 'Konten Niagaaja + desain', pts: 820, streak: 3, ontime: 64, badges: ['Paling banyak brief'] }
  ];

  /* ---------- Island: Cerita minggu ini (Ringkasan) ---------- */
  var STORY = {
    Semua: { top: TOP[0], leak: ['Study tour sekolah', 'TripinAja', 'Rp 20,5 rb', 'Di atas batas Rp 15 rb. Saran halaman Ads: uji materi baru.'], voice: ['+23 ulasan Oktober', '9 belum dibalas, 3 di antaranya bintang ≤ 3 dan sudah lewat 48 jam.'], act: ['Potong ulang 6 Reels terbaik jadi TikTok', 'TikTok baru 5 dari 15 video. Reels yang sudah terbukti tinggal dipotong ulang.', 'Dita & Mugni'] },
    Rentalaja: { top: TOP[2], leak: ['Ruma Metua akhir pekan', 'Rentalaja', 'Rp 15,8 rb', 'Sedikit di atas batas. Coba materi foto kamar asli.'], voice: ['+16 ulasan Oktober', '7 belum dibalas di Garut Kota, Bandung Hub, dan Ruma Metua.'], act: ['Klaim Google Maps Wanaraja', 'Pencarian "rental iphone garut" sekarang jatuh ke kompetitor.', 'Dita'] },
    TripinAja: { top: TOP[0], leak: ['Study tour sekolah', 'TripinAja', 'Rp 20,5 rb', 'Di atas batas Rp 15 rb. Saran halaman Ads: uji materi baru.'], voice: ['+6 ulasan Oktober', '2 belum dibalas. Rating 4,7 dari 84 ulasan.'], act: ['Ganti ads ke carousel destinasi', 'ER carousel di feed 2x lipat foto tunggal. Biaya per chat ads TripinAja paling tinggi.', 'Mugni'] },
    Niagaaja: { top: TOP[4], leak: ['Trade-in laptop', 'Niagaaja', 'Rp 15 rb', 'Tepat di batas atas. Frekuensi 2,4: sebentar lagi perlu materi baru.'], voice: ['+1 ulasan Oktober', 'Semua ulasan Laptopaja sudah dibalas.'], act: ['Mulai TikTok Niagaaja', 'Belum ada video bulan ini. Mulai dari format "cek laptop bekas".', 'Kevin'] }
  };
  function islCerita(el) {
    var u = unitOf(), S = STORY[u] || STORY.Semua, t = S.top;
    el.innerHTML = '<section class="fx-card fx-story">' +
      head('Cerita minggu ini', '22–27 Oktober · disusun otomatis dari semua kanal' + (u !== 'Semua' ? ' · ' + u : ''),
        '<div class="fx-row"><a class="fx-btn ghost" href="TV.html">▣ Mode layar TV</a><button type="button" class="fx-btn" data-act="wrap">▶ Putar rekap Oktober</button></div>') +
      '<div class="fx-story-grid">' +
      '<a class="fx-tile fx-tile-top" href="Instagram.dc.html"><div class="fx-thumb">' + thumb(t.cap, t.unit) + '<span class="fx-medal">🏆 Konten juara</span></div><div class="fx-tile-b"><span class="fx-k">' + t.unit + ' · ' + t.type + ' · ' + t.date + '</span><strong>' + esc(t.cap) + '</strong><span class="fx-stats"><b>' + dec(t.er, 1) + '%</b> ER · <b>' + t.saves + '</b> disimpan · <b>' + t.reach + '</b> reach</span></div></a>' +
      '<a class="fx-tile" href="Ads.dc.html"><div class="fx-spot">' + spot('leak') + '</div><span class="fx-k">Iklan paling boros</span><strong>' + esc(S.leak[0]) + '</strong><span class="fx-big bad">' + S.leak[2] + ' <small>per chat</small></span><span class="fx-note">' + S.leak[3] + '</span></a>' +
      '<a class="fx-tile" href="Maps.dc.html"><div class="fx-spot">' + spot('star') + '</div><span class="fx-k">Suara pelanggan</span><strong>' + S.voice[0] + '</strong><span class="fx-note">' + S.voice[1] + '</span></a>' +
      '<div class="fx-tile fx-tile-act"><span class="fx-k light">Satu langkah minggu ini</span><strong>' + esc(S.act[0]) + '</strong><span class="fx-note light">' + S.act[1] + '</span><button type="button" class="fx-btn mint" data-act="kkh">＋ Jadikan tugas KKH · ' + S.act[2] + '</button></div>' +
      '</div></section>';
    bind(el, { wrap: wrapped, kkh: function (b) { b.textContent = '✓ Masuk ke KKH ' + S.act[2] + ' (contoh)'; b.disabled = true; toast('Tugas dikirim ke slot KKH ' + S.act[2] + '. Di versi asli ini tercatat di pk_tasks.'); } });
  }

  /* ---------- Rekap Oktober ala "Wrapped" ---------- */
  var WR = [
    { bg: 'linear-gradient(160deg,#1D3149,#0F6F72)', k: 'REKAP MARKETING POKAMA', t: 'Oktober 2026', b: 'Sebulan kerja tim marketing tiga unit. Ketuk untuk lanjut.', art: spot('rocket') },
    { bg: 'linear-gradient(160deg,#0FA394,#1D3149)', k: 'Orang yang melihat kita', big: 412800, fmt: 'rb', t: 'akun dijangkau', b: '▲ 18% dari September. Rata-rata ±15 rb akun baru melihat kita setiap hari.' },
    { bg: 'linear-gradient(160deg,#2F6FD0,#1D3149)', k: 'Konten yang paling banyak ditonton', t: 'Syarat sewa iPhone cuma KTP + KK', b: '11,5 rb reach · Reels Rentalaja, 8 Okt', art: thumb('Syarat sewa iPhone cuma KTP + KK', 'Rentalaja'), photo: true },
    { bg: 'linear-gradient(160deg,#D08A1E,#7A3E0A)', k: 'Paling sering disimpan', t: 'Estimasi biaya liburan Garut 3 hari', b: 'Disimpan 94 kali. Orang menyimpan konten yang membantu mereka memutuskan.', art: thumb('Estimasi biaya liburan Garut 3 hari', 'TripinAja'), photo: true },
    { bg: 'linear-gradient(160deg,#1D3149,#2F6FD0)', k: 'Dari dilihat sampai bayar', big: 486, fmt: 'num', t: 'chat WA dari marketing', b: '131 jadi closing · omzet terlacak Rp 96,4 jt · biaya Rp 7,1 jt' },
    { bg: 'linear-gradient(160deg,#067A70,#1D3149)', k: 'Kanal paling efisien', big: 17.4, fmt: 'x', t: 'ROAS Meta Ads', b: 'Kampanye "Open trip November" juara: Rp 950 rb jadi Rp 21,6 jt.' },
    { bg: 'linear-gradient(160deg,#FFB46B,#C2410C)', k: 'Juara tim bulan ini', t: 'Mugni · Konten TripinAja', b: '1.240 poin · 12 hari beruntun posting tepat waktu · ER rata-rata tertinggi', art: avatar('Mugni', 'TripinAja', 120), av: true },
    { bg: 'linear-gradient(160deg,#1D3149,#09BEAF)', k: 'PR untuk November', t: 'Tiga hal saja', list: ['TikTok dari 5 jadi 15 video', 'Klaim Maps Wanaraja', 'Balas ulasan < 24 jam'], end: true }
  ];
  function wrapped() {
    var i = 0, timer, m = modal('<div class="fx-wrap"><div class="fx-wrap-bars">' + WR.map(function () { return '<i><b></b></i>'; }).join('') + '</div><div class="fx-wrap-slide"></div><div class="fx-wrap-nav"><button type="button" class="fx-wrap-prev" aria-label="Sebelumnya"></button><button type="button" class="fx-wrap-next" aria-label="Berikutnya"></button></div></div>', 'fx-modal-wrap');
    function show(k) {
      i = Math.max(0, Math.min(WR.length - 1, k));
      var s = WR[i], box = m.querySelector('.fx-wrap'), sl = m.querySelector('.fx-wrap-slide');
      box.style.background = s.bg;
      m.querySelectorAll('.fx-wrap-bars i').forEach(function (b, j) { b.className = j < i ? 'done' : j === i ? 'now' : ''; });
      sl.innerHTML = '<span class="fx-wrap-k">' + s.k + '</span>' +
        (s.art ? '<div class="fx-wrap-art' + (s.photo ? ' photo' : '') + (s.av ? ' av' : '') + '">' + s.art + '</div>' : '') +
        (s.big != null ? '<span class="fx-wrap-big" data-count="' + s.big + '" data-fmt="' + s.fmt + '">' + fmtv(s.big, s.fmt) + '</span>' : '') +
        '<span class="fx-wrap-t">' + esc(s.t) + '</span>' + (s.b ? '<span class="fx-wrap-b">' + esc(s.b) + '</span>' : '') +
        (s.list ? '<ol class="fx-wrap-list">' + s.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '') +
        (s.end ? '<div class="fx-row"><button type="button" class="fx-btn mint" data-act="copy">Salin ringkasan untuk grup WA</button><button type="button" class="fx-btn ghost light" data-act="again">Ulangi</button></div>' : '');
      sl.classList.remove('in'); void sl.offsetWidth; sl.classList.add('in');
      countUp(sl);
      bind(sl, { copy: copyWrap, again: function () { show(0); } });
      if (s.end) confetti();
      clearTimeout(timer); if (!s.end && !reduceMotion) timer = setTimeout(function () { show(i + 1); }, 5200);
    }
    m.querySelector('.fx-wrap-next').onclick = function () { show(i + 1); };
    m.querySelector('.fx-wrap-prev').onclick = function () { show(i - 1); };
    m._cleanup = function () { clearTimeout(timer); };
    show(0);
  }
  function copyWrap() {
    var t = '*Rekap Marketing Pokama · Oktober 2026*\n• Reach 412,8 rb (▲18%)\n• Chat WA 486 → closing 131 → omzet terlacak Rp 96,4 jt\n• Biaya Rp 7,1 jt · ROAS ads 17,4x\n• Konten juara: "Syarat sewa iPhone cuma KTP + KK" (11,5 rb reach)\n• Paling disimpan: "Estimasi biaya liburan Garut 3 hari" (94)\n• Juara tim: Mugni 🏆\nPR November: TikTok 15 video · klaim Maps Wanaraja · balas ulasan < 24 jam';
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Ringkasan tersalin. Tinggal tempel di grup WA.'); }, function () { toast('Tidak bisa menyalin otomatis di browser ini.'); });
  }

  /* ---------- Island: Cincin target ---------- */
  function ring(pct, color, size) {
    size = size || 92; var r = size / 2 - 8, C = 2 * Math.PI * r, p = Math.min(1, pct / 100);
    return '<svg class="fx-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="#EEF0F3" stroke-width="10" fill="none"/><circle class="fx-ring-v" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="' + color + '" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - p)) + '" style="--c:' + C + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }
  function islRings(el) {
    var u = unitOf(), a = agg(u), left = 4;
    var R = [
      ['Reach', a.reach, a.reachT, rb], ['Followers baru', a.fol, a.folT, function (n) { return '+' + num(n); }], ['Chat WA', a.chat, a.chatT, num],
      ['Konten terbit', a.post, a.postT, num], ['Ulasan Maps baru', a.rev, a.revT, function (n) { return '+' + num(n); }]
    ].map(function (x) { var p = Math.round(x[1] / x[2] * 100), need = Math.max(0, x[2] - x[1]); return { label: x[0], pct: p, val: x[3](x[1]), tgt: x[3](x[2]), need: need ? 'Kurang ' + x[3](need).replace('+', '') + ' · ' + x[3](Math.ceil(need / left)).replace('+', '') + '/hari' : 'Tercapai!', done: p >= 100 }; });
    var done = R.filter(function (r) { return r.done; });
    el.innerHTML = '<section class="fx-card">' + head('Menuju target Oktober', 'Sisa ' + left + ' hari · ' + (u === 'Semua' ? 'semua unit' : u) + ' · cincin penuh = target tercapai') +
      '<div class="fx-rings">' + R.map(function (r) {
        var col = r.done ? '#FFC24B' : r.pct >= 90 ? TEAL : WARM;
        return '<div class="fx-ring-item' + (r.done ? ' done' : '') + '"><div class="fx-ring-wrap">' + ring(r.pct, col) + '<span class="fx-ring-p">' + (r.done ? '🏆' : r.pct + '%') + '</span></div><strong>' + r.label + '</strong><span>' + r.val + ' / ' + r.tgt + '</span><span class="fx-need ' + (r.done ? 'ok' : '') + '">' + r.need + '</span></div>';
      }).join('') +
      (done.length ? '<div class="fx-ring-win">' + spot('trophy') + '<strong>' + done.map(function (d) { return d.label; }).join(', ') + ' tercapai!</strong><span>Rayakan di grup, lalu naikkan target bulan depan.</span><button type="button" class="fx-btn" data-act="party">🎉 Rayakan lagi</button></div>' : '') +
      '</div></section>';
    bind(el, { party: confetti });
    var key = 'ring-' + u;
    if (done.length && !store[key]) { store[key] = 1; save(); setTimeout(confetti, 300); }
    if (!store['ringanim-' + u]) { store['ringanim-' + u] = 1; el.querySelectorAll('.fx-ring-v').forEach(function (c) { c.classList.add('anim'); }); }
  }

  /* ---------- Island: Simulasi budget ---------- */
  var ADS = { Rentalaja: { a: 2500000, chat: 182, close: 48, omzet: 38300000 }, TripinAja: { a: 1600000, chat: 84, close: 12, omzet: 34000000 }, Niagaaja: { a: 600000, chat: 46, close: 9, omzet: 9300000 } };
  var KOLU = { Rentalaja: { cost: 500000, close: 6, omzet: 2900000 }, TripinAja: { cost: 1300000, close: 4, omzet: 9600000 }, Niagaaja: { cost: 200000, close: 2, omzet: 2300000 } };
  function simCalc(unit, X, ch) {
    var A = ADS[unit], c0 = A.a / A.chat, conv = A.close / A.chat, aov = A.omzet / A.close;
    var chat, close, omzet, mcpl;
    if (ch === 'ads') { chat = 4 * A.a / c0 * Math.log(1 + X / (4 * A.a)); mcpl = c0 * (1 + X / (4 * A.a)); close = chat * conv; omzet = close * aov; }
    else { var K = KOLU[unit]; close = X * K.close / K.cost * 0.8; omzet = X * K.omzet / K.cost * 0.8; chat = close / conv; mcpl = chat ? X / chat : 0; }
    var sat = c0 < 15000 ? 4 * A.a * (15000 / c0 - 1) : 0;
    return { chat: chat, close: close, omzet: omzet, mcpl: mcpl, roas: X ? omzet / X : 0, c0: c0, sat: sat };
  }
  function islSim(el) {
    var u = unitOf(); var su = store.simU && UNITS.indexOf(store.simU) >= 0 ? store.simU : 'Rentalaja'; if (u !== 'Semua') su = u;
    var X = store.simX != null ? store.simX : 750000, ch = store.simCh || 'ads';
    var r = simCalc(su, X, ch), max = 5000000;
    var satPct = Math.min(100, r.sat / max * 100);
    var warn = ch === 'ads' && r.mcpl > 15000;
    var bars = [['Budget tambahan', rp(X), 100, NAVY], ['Chat WA', '+' + num(r.chat), 78, '#2F6FD0'], ['Closing', '+' + num(r.close), 52, TEAL], ['Omzet', '+' + jt(r.omzet), 34, '#FFC24B']];
    el.innerHTML = '<section class="fx-card fx-sim">' + head('Simulasi: kalau budget ditambah', 'Dihitung dari biaya per chat dan rasio closing kampanye Oktober. Makin besar budget, makin mahal tiap chat tambahan.') +
      '<div class="fx-sim-grid"><div class="fx-sim-ctl">' +
      (u === 'Semua' ? '<label class="fx-lbl">Unit</label>' + chips(UNITS, su, 'su') : '<label class="fx-lbl">Unit</label><div class="fx-pill" style="--c:' + UC[su] + '">' + su + '</div>') +
      '<label class="fx-lbl">Taruh di</label>' + chips([['ads', 'Meta Ads'], ['kol', 'KOL baru']], ch, 'ch') +
      '<label class="fx-lbl" for="fx-sim-x">Tambahan budget · <b>' + rp(X) + '</b></label>' +
      '<div class="fx-slider"><input id="fx-sim-x" type="range" min="0" max="' + max + '" step="250000" value="' + X + '" data-act="x">' + (ch === 'ads' && r.sat > 0 ? '<span class="fx-sat" style="left:' + satPct + '%" title="Titik jenuh"></span>' : '') + '</div>' +
      '<div class="fx-scale"><span>Rp 0</span><span>Rp 5 jt</span></div>' +
      (ch === 'ads' ? '<p class="fx-note">' + (r.sat > 0 ? '▼ Titik jenuh ±' + rp(r.sat) + ': setelah ini biaya per chat tambahan lewat batas Rp 15 rb.' : 'Biaya per chat sekarang sudah di atas Rp 15 rb. Perbaiki materi dulu sebelum menambah budget.') + '</p>' : '<p class="fx-note">Asumsi KOL baru 80% dari hasil rata-rata KOL Oktober. KOL tidak bisa dinaikkan bertahap seperti ads.</p>') +
      '</div><div class="fx-sim-out">' +
      '<div class="fx-funnel">' + bars.map(function (b) { return '<div class="fx-fn"><span class="fx-fn-l">' + b[0] + '</span><div class="fx-fn-bar" style="width:' + b[2] + '%;background:' + b[3] + '"><b>' + b[1] + '</b></div></div>'; }).join('') + '</div>' +
      '<div class="fx-sim-kpi"><div><span>Biaya per chat tambahan</span><strong class="' + (warn ? 'bad' : 'good') + '">' + (X ? rp(r.mcpl) : '—') + '</strong><em>sekarang ' + rp(r.c0) + '</em></div><div><span>ROAS tambahan</span><strong class="' + (r.roas >= 8 || !X ? 'good' : 'bad') + '">' + (X ? dec(r.roas, 1) + 'x' : '—') + '</strong><em>batas aman 8x</em></div></div>' +
      '<p class="fx-verdict ' + (warn || (X && r.roas < 8) ? 'bad' : 'good') + '">' + (!X ? 'Geser slider untuk melihat perkiraan.' : warn ? (r.sat >= 250000 ? 'Terlalu besar: chat tambahan jadi mahal. Turunkan ke sekitar ' + rp(Math.floor(r.sat / 250000) * 250000) + ' atau ganti materi.' : 'Biaya per chat unit ini sudah di atas batas. Perbaiki materi dulu, baru tambah budget.') : r.roas < 8 ? 'Belum layak: ROAS tambahan di bawah 8x.' : 'Layak dicoba. Tambahkan bertahap, cek lagi biaya per chat setelah 3 hari.') + '</p>' +
      '</div></div></section>';
    bind(el, {
      su: function (b) { store.simU = b.getAttribute('data-v'); save(); islSim(el); },
      ch: function (b) { store.simCh = b.getAttribute('data-v'); save(); islSim(el); },
      x: function (inp) {
        store.simX = +inp.value; save();
        var tmp = document.createElement('div'); islSim(tmp);
        ['.fx-sim-out', '.fx-sim-ctl .fx-note'].forEach(function (q) { var a = el.querySelector(q), b = tmp.querySelector(q); if (a && b) a.innerHTML = b.innerHTML; });
        var la = el.querySelectorAll('.fx-lbl'), lb = tmp.querySelectorAll('.fx-lbl'); if (la.length && lb.length) la[la.length - 1].innerHTML = lb[lb.length - 1].innerHTML;
      }
    });
  }

  /* ---------- Island: Papan juara ---------- */
  function islJuara(el) {
    var u = unitOf(), team = TEAM.filter(function (t) { return u === 'Semua' || t.unit === u; });
    var top = TOP.filter(function (t) { return u === 'Semua' || t.unit === u; }).sort(function (a, b) { return b.er - a.er; }).slice(0, 3);
    var maxP = 1400, medals = ['🥇', '🥈', '🥉'];
    el.innerHTML = '<div class="fx-two">' +
      '<section class="fx-card">' + head('Papan juara tim · Oktober', 'Poin: tayang tepat waktu +10, ER di atas median +5, lolos review tanpa revisi +5, telat −10.') +
      '<ol class="fx-lb">' + team.map(function (t, i) {
        return '<li><span class="fx-rank">' + (u === 'Semua' ? medals[i] : '⭐') + '</span>' + avatar(t.name, t.unit, 46) + '<div class="fx-lb-b"><div class="fx-lb-top"><strong>' + t.name + '</strong><span class="fx-flame" title="Hari beruntun posting tepat waktu">🔥 ' + t.streak + ' hari</span></div><span class="fx-note">' + t.role + ' · tepat waktu ' + t.ontime + '%</span><div class="fx-pbar"><i style="width:' + (t.pts / maxP * 100) + '%;background:' + UC[t.unit] + '"></i></div><div class="fx-badges">' + t.badges.map(function (b) { return '<span>' + b + '</span>'; }).join('') + '</div></div><strong class="fx-pts" data-count="' + t.pts + '">' + num(t.pts) + '</strong></li>';
      }).join('') + '</ol></section>' +
      '<section class="fx-card">' + head('Konten terbaik minggu ini', 'Urut ER · 22–27 Okt') + '<div class="fx-podium">' + top.map(function (t, i) {
        return '<a class="fx-pod" href="Instagram.dc.html"><div class="fx-thumb sm">' + thumb(t.cap, t.unit) + '<span class="fx-medal">' + medals[i] + '</span></div><strong>' + esc(t.cap) + '</strong><span class="fx-note"><b>' + dec(t.er, 1) + '%</b> ER · ' + t.saves + ' simpan · ' + t.pic + '</span></a>';
      }).join('') + '</div></section></div>';
    if (!store.lbAnim) { store.lbAnim = 1; save(); countUp(el); }
  }

  /* ---------- Instagram: feed visual ---------- */
  function decorateIg() {
    var grid = document.querySelector('.ig-grid'); if (!grid) return;
    var acc = (window.dcComp && dcComp.state.acc) || 'Rentalaja', lens = store.igLens || 'foto';
    var tiles = [].slice.call(grid.querySelectorAll('.ig-tile'));
    var get = function (t, k) { return t.getAttribute('data-' + k) || ''; };
    var pv = function (s) { return parseFloat(String(s).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')) * (/rb/.test(s) ? 1000 : 1) || 0; };
    var key = { er: 'er', reach: 'reach', saves: 'saves' }[lens];
    var vals = key ? tiles.map(function (t) { return pv(get(t, key)); }) : [];
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    grid.setAttribute('data-lens', lens);
    tiles.forEach(function (t, i) {
      var art = t.querySelector('.ig-art'); if (art && !art.firstChild) art.innerHTML = thumb(get(t, 'cap'), acc);
      var heat = t.querySelector('.ig-heat');
      if (key) { var k = mx > mn ? (vals[i] - mn) / (mx - mn) : 0.5; heat.style.background = 'rgba(' + (k > 0.5 ? '9,190,175' : '242,163,58') + ',' + (0.25 + Math.abs(k - 0.5) * 1.1).toFixed(2) + ')'; t.querySelector('.ig-heat-v').textContent = get(t, key) + (key === 'saves' ? ' simpan' : key === 'reach' ? ' reach' : ' ER'); }
      t.onclick = function () { igDetail(t, acc); };
      t.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); igDetail(t, acc); } };
    });
  }
  function igDetail(t, acc) {
    var g = function (k) { return esc(t.getAttribute('data-' + k)); };
    var good = t.getAttribute('data-good') === '1';
    modal('<div class="fx-ig-d"><div class="fx-ig-d-art">' + thumb(t.getAttribute('data-cap'), acc) + '<span class="fx-ig-type">' + g('type') + '</span></div><div class="fx-ig-d-b"><span class="fx-k">' + acc + ' · ' + g('pillar') + ' · ' + g('date') + '</span><h3>' + g('cap') + '</h3>' +
      '<span class="fx-verdict ' + (good ? 'good' : 'bad') + '">' + (good ? 'Di atas median ER akun. Layak diulang formatnya.' : 'Di bawah median ER akun. Coba hook 3 detik pertama yang lebih kuat.') + '</span>' +
      '<div class="fx-ig-stats">' + [['Reach', 'reach'], ['Views', 'views'], ['ER', 'er'], ['Suka', 'likes'], ['Komentar', 'comments'], ['Simpan', 'saves'], ['Bagikan', 'shares'], ['Kunjungan profil', 'visits'], ['Follow dari post', 'follows'], ['Rata-rata tonton', 'watch']].map(function (x) { return '<div><span>' + x[0] + '</span><strong>' + g(x[1]) + '</strong></div>'; }).join('') + '</div>' +
      '<div class="fx-row"><button type="button" class="fx-btn" data-act="redo">↻ Buat versi TikTok</button><button type="button" class="fx-btn ghost" data-act="brief">Salin jadi brief</button></div></div></div>', 'fx-modal-ig');
    var m = document.querySelector('.fx-modal');
    bind(m, { redo: function (b) { b.textContent = '✓ Masuk Papan produksi (contoh)'; toast('Ide "versi TikTok" ditambahkan ke kolom Ide di Kalender Konten.'); }, brief: function () { toast('Brief disalin: hook, pilar, format, dan angka acuan.'); } });
  }
  function islIgLens(el) {
    var lens = store.igLens || 'foto';
    el.innerHTML = '<div class="fx-lens"><span class="fx-lbl">Lensa</span>' + chips([['foto', 'Foto'], ['er', 'Panas ER'], ['reach', 'Panas reach'], ['saves', 'Panas simpan']], lens, 'lens') + '<span class="fx-note">Ketuk postingan untuk detail lengkap.</span></div>';
    bind(el, { lens: function (b) { store.igLens = b.getAttribute('data-v'); save(); islIgLens(el); decorateIg(); } });
  }

  /* ---------- KOL: kartu kreator ---------- */
  function islKol(el) {
    var v = window.dcComp ? dcComp.renderVals() : null; if (!v) return;
    var NICHE = { travel: 'mountain', otomotif: 'motor', teknologi: 'laptop', keluarga: 'house', outdoor: 'tent' };
    el.innerHTML = '<section class="fx-card">' + head('Kreator yang sedang jalan', 'Kartu per KOL: cuplikan konten, hasil, dan langkah berikutnya. Geser ke samping.') +
      '<div class="fx-hscroll">' + v.rows.map(function (k) {
        var live = k.reach !== '—', kind = NICHE[k.niche] || 'people';
        return '<article class="fx-kol" style="--c:' + k.dot + '"><div class="fx-kol-ban">' + scene(kind, k.unit, hash(k.name)) + '</div><div class="fx-kol-id">' + avatar(k.name, k.unit, 56) + '<div><strong>' + esc(k.name) + '</strong><span>' + k.fol + ' followers · ER ' + k.er + '</span></div></div>' +
          '<div class="fx-row wrap"><span class="fx-tag" style="background:' + k.stBg + ';color:' + k.stFg + '">' + k.status + '</span><span class="fx-tag soft">' + esc(k.niche) + '</span><span class="fx-tag soft">' + esc(k.unit) + '</span></div>' +
          '<div class="fx-kol-posts">' + (live ? [0, 1, 2].map(function (j) { return '<div class="fx-thumb xs">' + scene(j === 1 ? 'people' : kind, k.unit, hash(k.name) + j) + '</div>'; }).join('') : '<div class="fx-kol-empty">' + spot('calendar') + '<span>' + (k.status.indexOf('Telat') === 0 ? 'Konten belum tayang. ' + k.status + '.' : 'Belum tayang') + '</span></div>') + '</div>' +
          '<div class="fx-kol-m"><div><span>Reach</span><b>' + k.reach + '</b></div><div><span>Klik</span><b>' + k.clicks + '</b></div><div><span>Closing</span><b>' + k.closing + '</b></div><div><span>ROAS</span><b style="color:' + (live ? k.roasColor : '#5B6573') + '">' + k.roas + '</b></div></div>' +
          '<div class="fx-kol-f"><span class="fx-note">' + esc(k.deal) + '</span><span class="fx-tag" style="background:' + k.vBg + ';color:' + k.vFg + '">' + k.verdict + '</span></div></article>';
      }).join('') + '</div></section>';
  }

  /* ---------- Ads: galeri materi iklan ---------- */
  function islAds(el) {
    var v = window.dcComp ? dcComp.renderVals() : null; if (!v) return;
    var sort = store.adSort || 'roas';
    var pv = function (s) { return parseFloat(String(s).replace(/Rp|jt|rb|x|\s/g, '').replace(',', '.')) * (/jt/.test(s) ? 1e6 : /rb/.test(s) ? 1000 : 1); };
    var cs = v.camps.slice().sort(function (a, b) { return sort === 'cpl' ? pv(a.cpl) - pv(b.cpl) : pv(b.roas) - pv(a.roas); });
    el.innerHTML = '<section class="fx-card">' + head('Materi iklan yang sedang tayang', 'Materi di samping angkanya, supaya kelihatan visual mana yang bekerja.', chips([['roas', 'ROAS tertinggi'], ['cpl', 'Termurah per chat']], sort, 'sort')) +
      '<div class="fx-adgrid">' + cs.map(function (c) {
        return '<article class="fx-ad' + (c.status !== 'Aktif' ? ' paused' : '') + '"><div class="fx-ad-h">' + avatar(c.unit, c.unit, 28) + '<div><strong>' + c.unit + '</strong><span>Bersponsor · ' + c.status + '</span></div></div><div class="fx-ad-art">' + thumb(c.name, c.unit) + '<span class="fx-ad-cap">' + esc(c.name) + '</span></div><div class="fx-ad-cta"><span>WhatsApp</span><b>Kirim pesan</b></div>' +
          '<div class="fx-ad-m"><div><span>CTR</span><b>' + c.ctr + '</b></div><div><span>Per chat</span><b style="color:' + c.cplColor + '">' + c.cpl + '</b></div><div><span>ROAS</span><b>' + c.roas + '</b></div></div>' +
          '<div class="fx-ad-f"><span class="fx-tag" style="background:' + c.vBg + ';color:' + c.vFg + '">' + c.verdict + '</span>' + (parseFloat(c.freq.replace(',', '.')) > 2.5 ? '<span class="fx-note bad">Frekuensi ' + c.freq + ': audiens mulai bosan</span>' : '<span class="fx-note">' + c.chat + ' chat · ' + c.closing + ' closing</span>') + '</div></article>';
      }).join('') + '</div></section>';
    bind(el, { sort: function (b) { store.adSort = b.getAttribute('data-v'); save(); islAds(el); } });
  }

  /* ---------- Konten: papan minggu depan (seret & lepas) ---------- */
  var DAYS = [['Min', 1], ['Sen', 2], ['Sel', 3], ['Rab', 4], ['Kam', 5], ['Jum', 6], ['Sab', 7]];
  var BOARD0 = [
    ['k1', 1, 'TripinAja', 'Reels', 'Sunrise Papandayan, open trip 9 Nov', 'Terjadwal', 'Mugni'], ['k2', 2, 'Rentalaja', 'Reels', 'Motor ready awal bulan + harga', 'Terjadwal', 'Dita'],
    ['k3', 2, 'Niagaaja', 'Reels', 'Cek laptop bekas dalam 60 detik', 'Review', 'Kevin'], ['k4', 3, 'Rentalaja', 'TikTok', 'Potong ulang: syarat sewa iPhone', 'Revisi', 'Dita'],
    ['k5', 4, 'TripinAja', 'Carousel', 'Itinerary Darajat 1 hari', 'Revisi', 'Mugni'], ['k6', 5, 'Rentalaja', 'Carousel', '5 rute motor weekend di Garut', 'Review', 'Dita'],
    ['k7', 6, 'TripinAja', 'Reels', 'Guide briefing sebelum trek', 'Review', 'Mugni'], ['k8', 6, 'Niagaaja', 'Carousel', 'Stok laptop minggu ini', 'Terjadwal', 'Kevin'],
    ['k9', 7, 'Rentalaja', 'Reels', 'Unboxing iPhone 15 untuk Ciputat', 'Produksi', 'Dita'],
    ['i1', 0, 'Rentalaja', 'Reels', 'Sewa 5 menit: pilih, bayar, ambil', 'Ide', 'Dita'], ['i2', 0, 'TripinAja', 'Carousel', 'Estimasi biaya liburan keluarga', 'Ide', 'Mugni'],
    ['i3', 0, 'Niagaaja', 'Reels', 'Garansi toko 30 hari', 'Ide', 'Kevin'], ['i4', 0, 'Rentalaja', 'TikTok', 'Tebak harga sewa', 'Ide', 'Dita']
  ];
  var STG = { Ide: ['#EEF0F3', '#3B4250'], Brief: ['#E5EEF9', '#1E5AA8'], Produksi: ['#FDF3D7', '#7A5200'], Review: ['#FFF1E0', '#9A5B00'], Revisi: ['#FCEBDD', BAD], Terjadwal: [MINT, GOOD] };
  function islBoard(el) {
    var u = unitOf();
    if (!store.board) store.board = {};
    var items = BOARD0.map(function (b) { return { id: b[0], day: store.board[b[0]] != null ? store.board[b[0]] : b[1], unit: b[2], fmt: b[3], title: b[4], stage: b[5], pic: b[6] }; }).filter(function (x) { return u === 'Semua' || x.unit === u; });
    var sel = store.boardSel;
    var card = function (x) {
      var s = STG[x.stage];
      return '<div class="fx-kc' + (sel === x.id ? ' sel' : '') + '" draggable="true" data-id="' + x.id + '" tabindex="0" role="button" aria-label="' + esc(x.title) + ', ' + x.stage + '. Pilih lalu ketuk hari tujuan."><div class="fx-thumb kc">' + thumb(x.title, x.unit) + '<span class="fx-kc-fmt">' + x.fmt + '</span></div><strong>' + esc(x.title) + '</strong><div class="fx-kc-f"><span class="fx-tag" style="background:' + s[0] + ';color:' + s[1] + '">' + x.stage + '</span>' + avatar(x.pic, x.unit, 22) + '</div><i class="fx-kc-dot" style="background:' + UC[x.unit] + '"></i></div>';
    };
    var ready = items.filter(function (x) { return x.day && x.stage === 'Terjadwal'; }).length, sched = items.filter(function (x) { return x.day; }).length;
    el.innerHTML = '<section class="fx-card">' + head('Minggu depan · 1–7 November', 'Seret kartu ke hari lain. Di HP: ketuk kartu, lalu ketuk hari tujuan. ' + ready + ' dari ' + sched + ' konten sudah terjadwal.', '<button type="button" class="fx-btn ghost" data-act="reset">Kembalikan susunan</button>') +
      '<div class="fx-board">' + DAYS.map(function (d) {
        var list = items.filter(function (x) { return x.day === d[1]; });
        return '<div class="fx-day" data-day="' + d[1] + '"><div class="fx-day-h"><span>' + d[0] + '</span><b>' + d[1] + ' Nov</b>' + (list.length ? '' : '<i class="fx-dot-warn" title="Belum ada konten"></i>') + '</div>' + list.map(card).join('') +
          (list.length ? '<div class="fx-drop">＋ Taruh di sini</div>' : '<div class="fx-empty">' + spot('calendar') + '<span>Belum ada konten. Seret ide ke sini.</span></div>') + '</div>';
      }).join('') + '</div>' +
      '<div class="fx-tray" data-day="0"><div class="fx-tray-h"><strong>Antrean ide</strong><span class="fx-note">Dijadwalkan 12–21 Nov. Tarik ke minggu ini kalau ada slot kosong.</span></div><div class="fx-tray-list">' + items.filter(function (x) { return !x.day; }).map(card).join('') + '<div class="fx-drop">Seret ke sini untuk menunda</div></div></div></section>';
    var move = function (id, day) {
      var it = BOARD0.filter(function (b) { return b[0] === id; })[0]; if (!it) return;
      store.board[id] = day; store.boardSel = null; save(); islBoard(el);
      toast(day ? '"' + it[4] + '" dipindah ke ' + DAYS[day - 1][0] + ' ' + day + ' Nov (contoh, belum tersimpan)' : '"' + it[4] + '" dikembalikan ke antrean ide');
      if (day && it[5] === 'Ide') setTimeout(function () { toast('Slot terisi. Ide ini otomatis jadi brief untuk ' + it[6] + '.'); }, 2900);
    };
    el.querySelectorAll('.fx-kc').forEach(function (c) {
      c.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', c.getAttribute('data-id')); c.classList.add('drag'); });
      c.addEventListener('dragend', function () { c.classList.remove('drag'); });
      c.addEventListener('click', function (e) { e.stopPropagation(); var id = c.getAttribute('data-id'); store.boardSel = store.boardSel === id ? null : id; save(); islBoard(el); });
    });
    el.querySelectorAll('[data-day]').forEach(function (z) {
      z.addEventListener('dragover', function (e) { e.preventDefault(); z.classList.add('over'); });
      z.addEventListener('dragleave', function () { z.classList.remove('over'); });
      z.addEventListener('drop', function (e) { e.preventDefault(); z.classList.remove('over'); move(e.dataTransfer.getData('text/plain'), +z.getAttribute('data-day')); });
      z.addEventListener('click', function () { if (store.boardSel) move(store.boardSel, +z.getAttribute('data-day')); });
    });
    if (sel) el.querySelector('.fx-board').classList.add('picking');
    bind(el, { reset: function () { store.board = {}; store.boardSel = null; save(); islBoard(el); toast('Susunan dikembalikan seperti rencana awal.'); } });
  }

  /* ---------- Maps: etalase lokasi ---------- */
  function islMaps(el) {
    var v = window.dcComp ? dcComp.renderVals() : null; if (!v) return;
    el.innerHTML = '<section class="fx-card">' + head('Etalase kita di Google Maps', 'Seperti yang dilihat calon pelanggan. Lampu merah = toko belum bisa ditemukan dengan benar.') +
      '<div class="fx-hscroll">' + v.locs.map(function (l) {
        var ok = l.status === 'Terverifikasi', r = parseFloat(String(l.rating).replace(',', '.')) || 0;
        return '<article class="fx-shop' + (ok ? '' : ' off') + '"><div class="fx-shop-art">' + spot('store').replace(TEAL, l.dot) + '<span class="fx-lamp" style="background:' + (ok ? TEAL : l.status.indexOf('Proses') === 0 ? WARM : '#E5484D') + '"></span></div><strong>' + esc(l.name) + '</strong>' +
          (ok ? '<div class="fx-stars" aria-label="Rating ' + l.rating + '">' + [1, 2, 3, 4, 5].map(function (i) { return '<i style="--f:' + Math.max(0, Math.min(1, r - i + 1)) + '"></i>'; }).join('') + '<b>' + l.rating + '</b><span>(' + l.reviews + ')</span></div><span class="fx-note">' + l.fresh + ' ulasan bulan ini · ' + (l.unrep !== '0' ? '<b class="bad">' + l.unrep + ' belum dibalas</b>' : 'semua dibalas ✓') + '</span>' : '<span class="fx-tag" style="background:' + l.stBg + ';color:' + l.stFg + '">' + l.status + '</span><span class="fx-note">' + (l.status.indexOf('Belum') === 0 ? 'Orang yang cari kita di sini diarahkan ke pesaing.' : 'Tunggu kode verifikasi dari Google.') + '</span>') +
          '<div class="fx-pbar"><i style="width:' + l.comp + ';background:' + l.compColor + '"></i></div><span class="fx-note">Kelengkapan profil ' + l.comp + '</span></article>';
      }).join('') + '</div></section>';
  }

  /* ---------- WA Story: lingkaran status + pemutar ---------- */
  var STBG = { Interaktif: 'linear-gradient(160deg,#7C8CF8,#1D3149)', 'Unit ready': 'linear-gradient(160deg,#2F6FD0,#1D3149)', Milestone: 'linear-gradient(160deg,#09BEAF,#1D3149)', Lelang: 'linear-gradient(160deg,#F2A33A,#C2410C)', Testimoni: 'linear-gradient(160deg,#FF8FA3,#9A3F0A)', Promo: 'linear-gradient(160deg,#FFC24B,#C2410C)', 'Di balik layar': 'linear-gradient(160deg,#5B6573,#1D3149)' };
  function islStory(el) {
    var v = window.dcComp ? dcComp.renderVals() : null; if (!v) return;
    var acc = dcComp.state.acc, list = v.stories.slice(0, 9);
    var mx = Math.max.apply(null, list.map(function (s) { return s.replies + s.chats * 3; }));
    el.innerHTML = '<section class="fx-card">' + head('Status WA · CS ' + esc(acc), 'Ketuk lingkaran untuk memutar story seperti yang dilihat pelanggan. Cincin tebal = paling banyak memancing chat.') +
      '<div class="fx-stories">' + list.map(function (s, i) {
        var k = (s.replies + s.chats * 3) / mx;
        return '<button type="button" class="fx-st" data-i="' + i + '"><span class="fx-st-ring" style="--w:' + (2 + k * 4).toFixed(1) + 'px;--c:' + (k > 0.6 ? TEAL : k > 0.3 ? WARM : '#C9CFD8') + '"><span class="fx-st-in">' + thumb(s.text, UNITS.indexOf(acc) >= 0 ? acc : 'Rentalaja') + '</span></span><b>' + esc(s.views) + ' viewer</b><span>' + esc(s.type) + ' · ' + esc(s.when.replace(' Okt', '')) + '</span></button>';
      }).join('') + '</div></section>';
    el.querySelectorAll('.fx-st').forEach(function (b) { b.onclick = function () { storyPlay(list, +b.getAttribute('data-i'), acc); }; });
  }
  function storyPlay(list, start, acc) {
    var i = start, timer, m = modal('<div class="fx-wrap fx-sp"><div class="fx-wrap-bars">' + list.map(function () { return '<i><b></b></i>'; }).join('') + '</div><div class="fx-wrap-slide"></div><div class="fx-wrap-nav"><button type="button" class="fx-wrap-prev" aria-label="Sebelumnya"></button><button type="button" class="fx-wrap-next" aria-label="Berikutnya"></button></div></div>', 'fx-modal-wrap');
    function show(k) {
      if (k >= list.length) { closeModal(); return; }
      i = Math.max(0, k); var s = list[i], box = m.querySelector('.fx-wrap'), sl = m.querySelector('.fx-wrap-slide');
      box.style.background = STBG[s.type] || STBG.Promo;
      m.querySelectorAll('.fx-wrap-bars i').forEach(function (b, j) { b.className = j < i ? 'done' : j === i ? 'now' : ''; });
      sl.innerHTML = '<div class="fx-sp-h">' + avatar('CS ' + acc, 'Rentalaja', 32) + '<div><strong>CS ' + esc(acc) + '</strong><span>' + esc(s.when) + '</span></div></div><span class="fx-wrap-k">' + esc(s.type) + '</span><span class="fx-wrap-t">' + esc(s.text) + '</span>' +
        '<div class="fx-sp-stats"><div><b>' + s.views + '</b><span>dilihat</span></div><div><b>' + s.replies + '</b><span>balasan</span></div><div><b>' + s.chats + '</b><span>chat [STORY]</span></div><div><b>' + s.close + '</b><span>closing</span></div></div>';
      sl.classList.remove('in'); void sl.offsetWidth; sl.classList.add('in');
      clearTimeout(timer); if (!reduceMotion) timer = setTimeout(function () { show(i + 1); }, 4500);
    }
    m.querySelector('.fx-wrap-next').onclick = function () { show(i + 1); };
    m.querySelector('.fx-wrap-prev').onclick = function () { show(i - 1); };
    m._cleanup = function () { clearTimeout(timer); };
    show(i);
  }

  /* ---------- Integrasi: ilustrasi sambungan ---------- */
  function islSync(el) {
    el.innerHTML = '<section class="fx-card fx-sync"><div class="fx-sync-art">' + spot('plug') + '</div><div><span class="fx-k">2 kabel sudah nyala · 3 tinggal dicolok</span><h2>Instagram dan Meta Ads sudah mengalir sendiri. Tiga sambungan berikutnya memangkas input manual jadi 6.</h2><span class="fx-note">Berikutnya: WhatsApp Coexistence → TikTok → Google Business Profile (menunggu izin). Lihat "Urutan pemasangan" di bawah.</span></div></section>';
  }

  /* ---------- Pemasang ---------- */
  var ISL = { cerita: islCerita, rings: islRings, sim: islSim, juara: islJuara, 'ig-lens': islIgLens, kol: islKol, ads: islAds, board: islBoard, maps: islMaps, story: islStory, sync: islSync };
  function mountAll() {
    document.querySelectorAll('[data-island]').forEach(function (el) {
      var f = ISL[el.getAttribute('data-island')];
      try { if (f) f(el); } catch (err) { console.error('island', el.getAttribute('data-island'), err); }
    });
    decorateIg();
  }
  window.addEventListener('dc:render', mountAll);
  window.PKFun = { scene: scene, thumb: thumb, spot: spot, avatar: avatar, ring: ring, confetti: confetti, countUp: countUp, TOP: TOP, TEAM: TEAM, D: D, agg: agg, rb: rb, jt: jt, num: num, dec: dec, esc: esc };
})();

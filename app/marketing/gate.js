/* Gerbang login Dashboard Marketing: memakai akun dan sesi yang sama dengan Sistem Kerja (KKH). */
(function () {
  'use strict';
  var SB_URL = 'https://shrvzlltysnbmgpkhjjg.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocnZ6bGx0eXNuYm1ncGtoampnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzAzNTYsImV4cCI6MjEwODQ0NjM1Nn0.V0EDK0y3ZFIuNW5uGJjDcHZlEVxAURVC6OJVPaUYUFY';
  var SKEY = 'pokama.session';
  var root = document.documentElement;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return; // uji lokal
  root.classList.add('mk-locked');

  function load() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function save(s) {
    var v = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user } : null;
    try { v ? localStorage.setItem(SKEY, JSON.stringify(v)) : localStorage.removeItem(SKEY); } catch (e) {}
    return v;
  }
  function auth(path, body) {
    return fetch(SB_URL + '/auth/v1/' + path, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(msg(j)); return j; }); });
  }
  function msg(j) {
    var m = String(j.error_description || j.msg || j.message || j.error || '');
    if (/invalid login credentials/i.test(m)) return 'Email atau password salah.';
    if (/rate limit/i.test(m)) return 'Terlalu banyak percobaan. Tunggu sebentar.';
    return m || 'Gagal terhubung. Coba lagi.';
  }
  function me(s) {
    return fetch(SB_URL + '/rest/v1/rpc/pk_session', { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { if (r.status === 401) throw new Error('expired'); return r.json(); });
  }
  function fresh(s) {
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s);
    return auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(save);
  }
  function check(s) {
    return fresh(s).then(function (v) { return me(v).catch(function (e) { if (e.message !== 'expired') throw e; return auth('token?grant_type=refresh_token', { refresh_token: v.refresh_token }).then(save).then(me); }); });
  }
  /* Pusat Kerja: tombol pindah modul di semua modul Pokama (Marketing, Keuangan, Affiliate, Investor) */
  function hub(s) {
    if (document.getElementById('pk-hub')) return;
    var b = document.createElement('div'); b.id = 'pk-hub';
    b.innerHTML = '<a class="pk-hub-home" href="/" aria-label="Kembali ke Sistem Kerja Pokama"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Sistem Kerja</span></a><button type="button" class="pk-hub-btn" aria-expanded="false" aria-haspopup="true" aria-label="Pindah modul"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg><span>Modul</span><b class="pk-hub-n" hidden></b></button><div class="pk-hub-menu" role="menu" hidden></div>';
    document.body.appendChild(b);
    var btn = b.querySelector('button'), menu = b.querySelector('.pk-hub-menu'), here = location.pathname.replace(/\/$/, '') || '/';
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var HIC = { home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', marketing: 'M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14', keuangan: 'M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18', affiliate: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7', investor: 'M3 17l6-6 4 4 8-8M15 7h6v6', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' };
    var HCOL = { home: ['#067A70', '#DDF5F2'], marketing: ['#7A3FD1', '#F1EAFD'], keuangan: ['#0B8A5E', '#E3F6EE'], affiliate: ['#1F63D8', '#E6EFFD'], investor: ['#B7791F', '#FDF3DF'] };
    function ico(d, k) { var c = HCOL[k] || ['#1D3149', '#EEF0F3']; return '<span class="pk-hub-ic" style="color:' + c[0] + ';background:' + c[1] + '"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg></span>'; }
    function draw(ms) {
      var tot = 0;
      menu.innerHTML = '<a role="menuitem" href="/#/kkh" class="pk-hub-i">' + ico(HIC.home, 'home') + '<span><b>Sistem Kerja Pokama</b><small>KKH, tugas, review, belanja, kehadiran</small></span></a>' + ms.map(function (m) {
        var on = here.indexOf(m.href.replace(/[#?].*$/, '').replace(/\/$/, '')) === 0; tot += on ? 0 : (+m.n || 0);
        return '<a role="menuitem" href="' + esc(m.href) + '" class="pk-hub-i' + (on ? ' on' : '') + '">' + ico(HIC[m.k] || HIC.grid, m.k) + '<span><b>' + esc(m.name) + (m.n ? ' <i class="' + (m.urgent ? 'hot' : '') + '">' + m.n + '</i>' : '') + '</b><small>' + esc(m.note || '') + '</small></span></a>';
      }).join('');
      var n = b.querySelector('.pk-hub-n'); n.hidden = !tot; n.textContent = tot;
    }
    function load() {
      var t = (load_s() || s || {}).access_token; if (!t) return;
      fetch(SB_URL + '/rest/v1/rpc/pk_modules', { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: '{}' })
        .then(function (r) { return r.ok ? r.json() : []; }).then(function (ms) { draw(ms || []); }, function () {});
    }
    draw([]); load(); setInterval(function () { if (!document.hidden) load(); }, 120000);
    btn.onclick = function (e) { e.stopPropagation(); var o = menu.hidden; menu.hidden = !o; btn.setAttribute('aria-expanded', String(o)); if (o) load(); };
    document.addEventListener('click', function (e) { if (!b.contains(e.target)) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  }
  function load_s() { return load(); }
  /* penanda balik ke Sistem Kerja Pokama: di menu samping dan bar atas HP setiap modul */
  function backMark() {
    var sides = document.querySelectorAll('nav[aria-label="Menu utama"], aside.side, #side');
    sides.forEach(function (sd) {
      if (sd.querySelector('.pk-back')) return;
      var a = document.createElement('a'); a.className = 'pk-back'; a.href = '/';
      a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span><b>Sistem Kerja Pokama</b><small>Kembali ke KKH &amp; menu utama</small></span>';
      var logo = sd.querySelector(':scope > img, :scope > a.brand, :scope > div:first-child');
      if (logo && logo.nextSibling) logo.parentNode.insertBefore(a, logo.nextSibling); else sd.insertBefore(a, sd.firstChild);
    });
    document.querySelectorAll('.mbar').forEach(function (mb) {
      if (mb.querySelector('.pk-back-m')) return;
      var a = document.createElement('a'); a.className = 'pk-back-m'; a.href = '/'; a.setAttribute('aria-label', 'Kembali ke Sistem Kerja Pokama');
      a.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Sistem Kerja';
      mb.appendChild(a);
    });
    /* tautan lama "← Sistem Kerja" disembunyikan supaya tidak dobel */
    document.querySelectorAll('a[href="/"]:not(.pk-back):not(.pk-back-m):not(.pk-hub-i)').forEach(function (x) { if (/^\s*←\s*Sistem Kerja\s*$/.test(x.textContent)) x.style.display = 'none'; });
  }
  function watchBack() {
    backMark(); var t = null;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(backMark, 120); }).observe(document.body, { childList: true, subtree: true });
  }
  function open(person) {
    try { hub(load()); } catch (e) {}
    try { watchBack(); } catch (e) {}
    root.classList.remove('mk-locked');
    var g = document.getElementById('mk-gate'); if (g) g.remove();
    window.mkPerson = person;
    var name = person && (person.nickname || person.name);
    if (name) {
      var ROLE = { ceo: 'CEO', kepala_staf: 'Kepala Staf', keuangan: 'Keuangan', leader: 'Leader', staf: 'Staf' };
      var sub = (person.title || ROLE[person.role] || '') + (person.unit_code ? ' · ' + person.unit_code : '');
      var put = function () { document.querySelectorAll('nav[aria-label="Menu utama"] > div:last-child > div:last-child').forEach(function (box) { var sp = box.querySelectorAll('span'); if (sp[0] && sp[0].textContent !== name) sp[0].textContent = name; if (sp[1] && sub && sp[1].textContent !== sub) sp[1].textContent = sub; }); document.querySelectorAll('nav[aria-label="Menu utama"] > div:last-child > div[aria-hidden]').forEach(function (a) { a.textContent = name.charAt(0).toUpperCase(); }); if (!/^kevin/i.test(name)) document.querySelectorAll('nav[aria-label="Menu utama"] > div:last-child > img').forEach(function (img) { var d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); d.textContent = name.charAt(0).toUpperCase(); d.style.cssText = 'width:38px;height:38px;border-radius:19px;background:#1D3149;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:900;flex:none;'; img.replaceWith(d); }); };
      window.addEventListener('dc:render', put); setTimeout(put, 0);
    }
  }

  // kembali dari login Google
  if (location.hash.indexOf('access_token=') >= 0) {
    var p = new URLSearchParams(location.hash.slice(1));
    save({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600 });
    history.replaceState(null, '', location.pathname);
  }

  function showGate(note) {
    var g = document.getElementById('mk-gate');
    if (!g) { g = document.createElement('div'); g.id = 'mk-gate'; document.body.appendChild(g); }
    g.innerHTML = '<form class="mk-gate-card" novalidate><img src="/marketing/logo-pokama.png" alt="Pokama"><h1>' + (document.documentElement.dataset.gateTitle || 'Dashboard Marketing') + '</h1><p>Masuk dengan akun Sistem Kerja Pokama.</p>' +
      (note ? '<div class="mk-gate-err" role="alert">' + note + '</div>' : '') +
      '<label>Email<input id="mk-em" type="email" autocomplete="username" required></label><label>Password<input id="mk-pw" type="password" autocomplete="current-password" required></label>' +
      '<button type="submit" class="mk-gate-btn">Masuk</button><button type="button" class="mk-gate-g" id="mk-g">Masuk dengan Google</button><a href="/">Buka Sistem Kerja</a></form>';
    var f = g.querySelector('form');
    f.onsubmit = function (e) {
      e.preventDefault();
      var b = f.querySelector('.mk-gate-btn'); b.disabled = true; b.textContent = 'Memeriksa…';
      auth('token?grant_type=password', { email: f.querySelector('#mk-em').value.trim(), password: f.querySelector('#mk-pw').value })
        .then(save).then(mfa).then(me).then(function (person) { if (!person) { save(null); showGate('Akun ini belum terdaftar di Sistem Kerja. Minta Kepala Staf menambahkan.'); } else open(person); })
        .catch(function (err) { showGate(err.message === 'expired' ? 'Sesi habis. Silakan masuk lagi.' : err.message); });
    };
    g.querySelector('#mk-g').onclick = function () { location.href = SB_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + location.pathname); };
  }

  // verifikasi 2 langkah wajib (lihat /mfa.js); sesi tanpa 2 langkah ditolak server
  function mfa(s) {
    return import('/mfa.js').then(function (m) {
      if (m.idleExpired()) { save(null); throw new Error('expired'); }
      m.idleGuard(function () { save(null); location.reload(); });
      return m.ensureMfa().then(function (v) { if (!v) throw new Error('Keluar'); return v; });
    });
  }
  function start() {
    var s = load();
    if (!s || !s.access_token) return showGate();
    fresh(s).then(mfa).then(check).then(function (person) { if (person) open(person); else { save(null); showGate('Akun ini belum terdaftar di Sistem Kerja. Minta Kepala Staf menambahkan.'); } })
      .catch(function () { save(null); showGate('Sesi habis. Silakan masuk lagi.'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

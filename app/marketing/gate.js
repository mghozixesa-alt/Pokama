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
  function open(person) {
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
    g.innerHTML = '<form class="mk-gate-card" novalidate><img src="logo-pokama.png" alt="Pokama"><h1>Dashboard Marketing</h1><p>Masuk dengan akun Sistem Kerja Pokama.</p>' +
      (note ? '<div class="mk-gate-err" role="alert">' + note + '</div>' : '') +
      '<label>Email<input id="mk-em" type="email" autocomplete="username" required></label><label>Password<input id="mk-pw" type="password" autocomplete="current-password" required></label>' +
      '<button type="submit" class="mk-gate-btn">Masuk</button><button type="button" class="mk-gate-g" id="mk-g">Masuk dengan Google</button><a href="/">Buka Sistem Kerja</a></form>';
    var f = g.querySelector('form');
    f.onsubmit = function (e) {
      e.preventDefault();
      var b = f.querySelector('.mk-gate-btn'); b.disabled = true; b.textContent = 'Memeriksa…';
      auth('token?grant_type=password', { email: f.querySelector('#mk-em').value.trim(), password: f.querySelector('#mk-pw').value })
        .then(save).then(me).then(function (person) { if (!person) { save(null); showGate('Akun ini belum terdaftar di Sistem Kerja. Minta Kepala Staf menambahkan.'); } else open(person); })
        .catch(function (err) { showGate(err.message === 'expired' ? 'Sesi habis. Silakan masuk lagi.' : err.message); });
    };
    g.querySelector('#mk-g').onclick = function () { location.href = SB_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + location.pathname); };
  }

  function start() {
    var s = load();
    if (!s || !s.access_token) return showGate();
    check(s).then(function (person) { if (person) open(person); else { save(null); showGate('Akun ini belum terdaftar di Sistem Kerja. Minta Kepala Staf menambahkan.'); } })
      .catch(function () { save(null); showGate('Sesi habis. Silakan masuk lagi.'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* Menu dan halaman sesuai peran (uji coba: peran dibaca dari pilihan "Mencoba sebagai" di halaman kerja). */
(function () {
  var ROLE = { 'Head of Marketing': 'head', Dita: 'pic', Nayla: 'pic', Editor: 'editor', 'Admin WA': 'cs' };
  var PAGE = { 'Dashboard.dc.html': 'head', 'Ads.dc.html': 'head', 'KOL.dc.html': 'head', 'Maps.dc.html': 'head', 'Sosial.dc.html': 'head pic', 'WA.dc.html': 'head pic', 'Brand.dc.html': 'head pic editor' };
  function role() { try { var s = JSON.parse(localStorage.getItem('pokama.mk.tahap1') || '{}'); return ROLE[s.me] || 'head'; } catch (e) { return 'head'; } }
  function ok(list) { return !list || list.split(' ').indexOf(role()) >= 0; }
  function apply() {
    document.querySelectorAll('nav a[data-roles]').forEach(function (a) { a.style.display = ok(a.getAttribute('data-roles')) ? 'flex' : 'none'; });
    document.querySelectorAll('nav > div').forEach(function (g) { var as = g.querySelectorAll('a'); if (as.length) g.style.display = [].some.call(as, function (x) { return x.style.display !== 'none'; }) ? 'flex' : 'none'; });
    var page = location.pathname.split('/').pop().replace(/\.dc$/, '.dc.html');
    if (!ok(PAGE[page]) && !document.getElementById('role-block')) {
      var m = document.querySelector('main'); if (!m) return;
      var d = document.createElement('div'); d.id = 'role-block';
      d.style.cssText = 'position:fixed;inset:0;z-index:400;background:rgba(243,245,248,.96);display:flex;align-items:center;justify-content:center;font-family:Nunito,sans-serif;padding:16px';
      d.innerHTML = '<div style="background:#fff;border:1px solid #E3E6EB;border-radius:18px;padding:24px;max-width:380px;display:flex;flex-direction:column;gap:10px"><b style="font-size:18px;color:#1D3149">Halaman ini untuk Head of Marketing</b><span style="color:#5B6573;font-size:14px">Peran Anda tidak memakai halaman ini.</span><a href="kerja.html#today" style="align-self:flex-start;background:#09BEAF;color:#1D3149;font-weight:900;padding:10px 14px;border-radius:10px;text-decoration:none">Buka Tugas saya</a></div>';
      document.body.appendChild(d);
    }
  }
  window.addEventListener('dc:render', apply);
  document.addEventListener('DOMContentLoaded', function () { apply(); new MutationObserver(function () { apply(); }).observe(document.body, { childList: true, subtree: true }); });
})();

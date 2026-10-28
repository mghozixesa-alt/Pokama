/* Laci menu untuk tampilan HP. */
(function () {
  function close() { document.body.classList.remove('nav-open'); }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && t.closest('.mbar-btn')) { document.body.classList.toggle('nav-open'); return; }
    if (t.closest && (t.closest('.mscrim') || t.closest('nav[aria-label="Menu utama"] a'))) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();

/* Kerangka bersama Keuangan Pokama (bilah atas + menu samping + menu bawah HP).
   Dipakai /buku (pencatatan ala Kledo) dan /keuangan (analisis & pengaturan) supaya terasa satu aplikasi. */
const P = { b: '/buku/', k: '/keuangan/' };
const I = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  jual: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>', beli: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l3 12h11l2-8H6"/>',
  biaya: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>', bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>',
  stok: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>', aset: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  akun: '<path d="M4 6h16M4 12h16M4 18h10"/>', lap: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', plan: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ops: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
};
const svg = (k, s = 18) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const MAIN = [['b:dasbor', 'Dasbor', 'dash'], ['b:jual', 'Penjualan', 'jual'], ['b:beli', 'Pembelian', 'beli'], ['b:biaya', 'Biaya', 'biaya', 'nb'],
  ['b:kas', 'Kas & Bank', 'bank'], ['b:stok', 'Produk & Stok', 'stok'], ['b:aset', 'Aset Tetap', 'aset'], ['b:akun', 'Daftar Akun', 'akun']];
export const GROUPS = [
  ['Laporan', 'lap', [['b:labarugi', 'Laba Rugi'], ['b:neraca', 'Neraca'], ['b:aruskas', 'Arus Kas'], ['b:bukubesar', 'Buku Besar'], ['b:jurnal', 'Jurnal Umum'], ['b:pajak', 'Pajak'],
    ['k:unit', 'Kinerja unit bisnis'], ['b:pendaset', 'Pendapatan per aset'], ['k:labarugi', 'Laba rugi per lini & divisi'], ['k:pihak', 'Umur hutang & piutang'], ['k:riwayat', 'Riwayat kasir lama'], ['b:laporan', 'Semua laporan']]],
  ['Perencanaan', 'plan', [['b:anggaran', 'Anggaran & Target'], ['k:proyeksi', 'Proyeksi kas 13 minggu'], ['k:pf', 'Profit First'], ['k:kewajiban', 'Kewajiban & leasing']]],
  ['Operasional', 'ops', [['k:rab', 'Belanja RAB & LPJ'], ['b:gaji', 'Gaji & klaim petugas'], ['b:persetujuan', 'Persetujuan & antrean'], ['k:kas', 'Mutasi bank (impor & cocokkan)'], ['b:integrasi', 'Integrasi & tutup buku']]],
  ['Pengaturan', 'gear', [['k:akun', 'Akun & rekening'], ['k:saldo', 'Saldo awal'], ['k:jurnal', 'Jurnal manual']]],
];
const href = (key) => { const [p, v] = key.split(':'); return P[p] + '#' + v; };
export function shell(ME, onPage) {
  const ini = (ME && (ME.code || (ME.nickname || ME.name || '?').slice(0, 2))) || '?';
  const top = document.getElementById('top'), side = document.getElementById('side'), bottom = document.getElementById('bottom');
  if (top) top.innerHTML = `
    <button class="bk-menu" type="button" data-bkmenu aria-label="Menu">${svg('menu')}</button>
    <a class="bk-brand" href="${P.b}#dasbor"><img src="/img/pokama-logo.png" alt="Pokama"><span>Keuangan</span></a>
    <a class="bk-qa" href="${P.b}#jual/baru"><b>+</b> Jual</a><a class="bk-qa" href="${P.b}#beli/baru"><b>+</b> Beli</a><a class="bk-qa" href="${P.b}#biaya/baru"><b>+</b> Biaya</a>
    <span class="bk-sp"></span>
    <a class="bk-back" href="/">‹ Sistem Kerja</a>
    <span class="bk-co">PT Popo Karya Investama</span>
    <span class="bk-me" title="${esc(ME ? ME.name : '')}">${ME && ME.photo ? `<img src="${esc(ME.photo)}" alt="">` : esc(String(ini).toUpperCase())}</span>`;
  if (side) side.innerHTML = `<nav aria-label="Menu keuangan">
    ${MAIN.map(([k, l, ic, nb]) => `<a href="${href(k)}" data-nav="${k}">${svg(ic)}<span>${l}</span>${nb ? '<span class="bk-nb" data-nb hidden></span>' : ''}</a>`).join('')}
    ${GROUPS.map(([g, ic, items]) => `<details class="bk-grp" data-grp="${g}"><summary>${svg(ic)}${g}</summary><div class="bk-sub">${items.map(([k, l]) => `<a href="${href(k)}" data-nav="${k}">${l}</a>`).join('')}</div></details>`).join('')}
  </nav>`;
  if (bottom) bottom.innerHTML = [['b:dasbor', 'Dasbor', 'dash'], ['b:biaya', 'Biaya', 'biaya'], ['b:biaya/baru', 'Catat', 'plus', 1], ['b:kas', 'Kas', 'bank'], ['menu', 'Menu', 'menu']]
    .map(([k, l, ic, add]) => k === 'menu' ? `<a href="#" data-bkmenu>${svg(ic, 22)}${l}</a>` : `<a href="${href(k)}" data-nav="${k}"${add ? ' class="add"' : ''}>${add ? `<span class="dot">${svg(ic, 22)}</span>` : svg(ic, 22)}${l}</a>`).join('');
  if (!shell._wired) {
    shell._wired = true;
    document.addEventListener('click', (e) => { if (e.target.closest('[data-bkmenu]')) { e.preventDefault(); document.getElementById('side').classList.toggle('open'); } });
  }
}
// tandai menu aktif; key = 'b:biaya' atau 'k:proyeksi'
export function mark(key) {
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const cur = document.querySelector(`.bk-sub [data-nav="${key}"]`);
  if (cur) cur.closest('details').open = true;
  const s = document.getElementById('side'); if (s) s.classList.remove('open');
}
export function setNb(n) { document.querySelectorAll('[data-nb]').forEach(b => { b.textContent = n; b.hidden = !n; }); }

/* Buku Keuangan tahap 2 — Dasbor, Penjualan, Pembelian, Produk & Stok, Aset Tetap, Pajak, Laporan,
   Anggaran, Gaji, Persetujuan, Integrasi & tutup buku. Pembantu bersama datang dari buku.js lewat init(K). */
let K;
export function init(k) { K = k; }
const $ = (s, r = document) => r.querySelector(s);

/* ---------- grafik SVG kecil (warna Pokama) ---------- */
const C = { navy: '#1F2B4D', teal: '#09BEAF', tealD: '#077A70', amber: '#F2A33A', red: '#C0392B', grid: '#EEF0F3', mute: '#6B7486', blue: '#5B8DEF', soft: '#A3ACB9' };
const BCOL = { RA: '#1F2B4D', WG: '#09BEAF', NA: '#5B8DEF', HQ: '#A3ACB9' };
const short = (n) => { n = +n || 0; const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e9 ? s + (a / 1e9).toFixed(1).replace('.', ',') + ' M' : a >= 1e6 ? s + (a / 1e6).toFixed(1).replace('.', ',') + ' jt' : a >= 1e3 ? s + Math.round(a / 1e3) + ' rb' : s + Math.round(a); };
const rpS = (n) => 'Rp' + short(n);
function trendSvg(trend) {
  const W = 680, H = 240, L = 50, B = 26, T = 10, keys = ['RA', 'WG', 'NA', 'HQ'];
  const rows = trend.map(t => ({ m: t.m, v: keys.map(k => Math.max(0, +((t.by || {})[k] || {}).rev || 0)), net: keys.reduce((s, k) => s + (+((t.by || {})[k] || {}).net || 0), 0) }));
  const max = Math.max(1, ...rows.map(r => r.v.reduce((a, b) => a + b, 0)), ...rows.map(r => r.net)), min = Math.min(0, ...rows.map(r => r.net));
  const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min)), bw = (W - L - 10) / Math.max(1, rows.length);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; g += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`; }
  rows.forEach((r, i) => {
    let acc = 0; const x = L + i * bw + bw * .22, w = bw * .56;
    r.v.forEach((v, j) => { if (v) g += `<rect x="${x}" y="${y(acc + v)}" width="${w}" height="${Math.max(0, y(acc) - y(acc + v))}" fill="${BCOL[keys[j]]}" rx="2"><title>${K.BIZN[keys[j]]} ${K.rp(v)}</title></rect>`; acc += v; });
    const [yy, mm] = r.m.split('-'); g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${K.MON[+mm - 1]} ${yy.slice(2)}</text>`;
  });
  const pts = rows.map((r, i) => [L + i * bw + bw / 2, y(r.net)]);
  g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${C.amber}" stroke-width="2.5"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${rows[i].net < 0 ? C.red : C.amber}"><title>Laba bersih ${K.rp(rows[i].net)}</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pendapatan per unit bisnis dan laba bersih 6 bulan">${g}</svg>
    <div class="legend">${keys.map(k => `<span><i style="background:${BCOL[k]}"></i>${K.BIZN[k]}</span>`).join('')}<span><i style="background:${C.amber};border-radius:6px"></i>Laba bersih</span></div>`;
}
function dailySvg(daily) {
  const W = 680, H = 200, L = 50, B = 24, T = 8, rows = daily.slice(-30), max = Math.max(1, ...rows.map(r => Math.max(+r.in, +r.out)));
  const y = (v) => T + (H - T - B) * (1 - v / max), bw = (W - L - 6) / Math.max(1, rows.length);
  let g = ''; for (let i = 0; i <= 3; i++) { const v = max * i / 3; g += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`; }
  rows.forEach((r, i) => {
    const x = L + i * bw, w = Math.max(2, bw * .38);
    g += `<rect x="${x + bw * .1}" y="${y(+r.in)}" width="${w}" height="${y(0) - y(+r.in)}" fill="${C.teal}" rx="1.5"><title>${K.tgl(r.d)} masuk ${K.rp(r.in)}</title></rect>`;
    g += `<rect x="${x + bw * .1 + w + 1}" y="${y(+r.out)}" width="${w}" height="${y(0) - y(+r.out)}" fill="${C.amber}" rx="1.5"><title>${K.tgl(r.d)} keluar ${K.rp(r.out)}</title></rect>`;
    if (i % 5 === 0) g += `<text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle">${+r.d.slice(8)}/${+r.d.slice(5, 7)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Uang masuk dan keluar harian">${g}</svg><div class="legend"><span><i style="background:${C.teal}"></i>Masuk</span><span><i style="background:${C.amber}"></i>Keluar</span></div>`;
}
function gauge(pctv, label, sub, good = 'low') {
  const p = Math.max(0, Math.min(100, pctv == null ? 0 : pctv)), a = Math.PI * (1 - p / 100), x = 90 + 70 * Math.cos(a), y = 90 - 70 * Math.sin(a);
  const col = pctv == null ? C.soft : good === 'low' ? (p < 60 ? C.tealD : p < 85 ? C.amber : C.red) : (p > 60 ? C.tealD : p > 30 ? C.amber : C.red);
  return `<div class="gauge"><svg viewBox="0 0 180 104" role="img" aria-label="${K.esc(label)}"><path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="${C.grid}" stroke-width="14" stroke-linecap="round"/>
    ${p > 0 ? `<path d="M20 90 A70 70 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round"/>` : ''}
    <text x="90" y="84" text-anchor="middle" class="gv">${pctv == null ? '—' : Math.round(pctv) + '%'}</text></svg><b>${label}</b><small>${sub}</small></div>`;
}
const hbars = (items, max, col = C.navy) => items.length ? `<div class="hb">${items.map(i => `<div class="hbr"><span title="${K.esc(i.name)}">${K.esc(i.name)}</span><div class="hbt"><i style="width:${Math.max(2, (+i.amt / (max || 1)) * 100)}%;background:${i.col || col}"></i></div><b>${rpS(i.amt)}</b></div>`).join('')}</div>` : '<p class="mute small">Belum ada data.</p>';
const delta = (c, p, inv) => { if (!p) return ''; const d = (c - p) / Math.abs(p) * 100, up = d >= 0, good = inv ? !up : up; return `<span class="dl ${good ? 'up' : 'dn'}">${up ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}%</span>`; };

/* ---------- Dasbor ---------- */
async function vDasbor() {
  const t = K.today(), f = t.slice(0, 8) + '01';
  const [Dd, ex, sj, sb] = await Promise.all([K.A.rpc('pk_fin_dashboard', { p_from: f, p_to: t }), K.A.rpc('pk_fin_expense_list', { p_from: f, p_to: t }),
    K.A.rpc('pk_fin_doc_list', { p_kind: 'jual', p_from: f, p_to: t }), K.A.rpc('pk_fin_doc_list', { p_kind: 'beli', p_from: f, p_to: t })]);
  const U = Dd.units || [], cur = (k) => K.sum(U, u => (u.cur || {})[k]), prev = (k) => K.sum(U, u => (u.prev || {})[k]);
  const rev = cur('rev') + cur('oi'), cost = cur('hpp') + cur('opex') + cur('oe'), net = cur('net'), cash = K.sum(Dd.cash || [], c => c.book);
  const bal = (c) => +((Dd.balances || {})[c] || {}).bal || 0;
  const piutang = bal('1-10100'), hutang = bal('2-20100'), H = Dd.health || {}, X = Dd.exceptions || {};
  const telat = ex.sum.n_telat + sj.sum.n_telat + sb.sum.n_telat;
  K.setBadge(ex.sum.n_belum);
  const top = (Dd.expense_top || []).slice(0, 7), mix = (Dd.revenue_mix || []).slice(0, 6);
  const due = [...(Dd.obligations || []).map(o => ({ name: o.name, amt: o.amount, days: o.days, d: o.due, k: 'Kewajiban' }))].slice(0, 6);
  const acts = [[X.gagal, 'transaksi gagal dibukukan', '#persetujuan'], [X.peta, 'kategori belum dipetakan ke akun', '#persetujuan'], [X.mutasi, 'mutasi bank belum dikenali', '#persetujuan'],
    [ex.sum.n_telat, 'biaya lewat jatuh tempo', '#biaya', 'telat'], [sj.sum.n_telat, 'tagihan penjualan lewat jatuh tempo', '#jual'], [sb.sum.n_telat, 'tagihan pembelian lewat jatuh tempo', '#beli']].filter(a => +a[0]);
  return K.header('Dasbor', `<span class="small mute">${K.MONL[+t.slice(5, 7) - 1]} ${t.slice(0, 4)} · s.d. ${K.tgl(t)}</span><a class="btn" href="/keuangan">Panel lengkap</a>`) + `
    ${acts.length ? `<div class="todo">${acts.map(a => `<a href="${a[2]}"${a[3] ? ` data-st="${a[3]}"` : ''}><b>${a[0]}</b> ${a[1]} ›</a>`).join('')}</div>` : ''}
    <div class="grid g6">
      <a class="sum t" href="#kas"><span>Kas & bank</span><b>${rpS(cash)}</b><small>${(Dd.cash || []).length} rekening</small></a>
      <a class="sum" href="#labarugi"><span>Pendapatan</span><b>${rpS(rev)}</b><small>${delta(rev, prev('rev'))} vs periode lalu</small></a>
      <a class="sum a" href="#labarugi"><span>Beban & HPP</span><b>${rpS(cost)}</b><small>${rev ? Math.round(cost / rev * 100) + '% dari pendapatan' : '—'}</small></a>
      <a class="sum ${net < 0 ? 'r' : 't'}" href="#labarugi"><span>Laba bersih</span><b class="${net < 0 ? 'neg' : ''}">${rpS(net)}</b><small>${delta(net, prev('net'))} · margin ${rev ? Math.round(net / rev * 100) + '%' : '—'}</small></a>
      <a class="sum" href="#jual"><span>Piutang</span><b>${rpS(piutang)}</b><small>${sj.sum.n_belum} tagihan${sj.sum.n_telat ? ` · <span class="neg b">${sj.sum.n_telat} telat</span>` : ''}</small></a>
      <a class="sum r" href="#beli"><span>Hutang usaha</span><b>${rpS(hutang)}</b><small>${ex.sum.n_belum + sb.sum.n_belum} tagihan${telat ? ` · <span class="neg b">${ex.sum.n_telat + sb.sum.n_telat} telat</span>` : ''}</small></a>
    </div>
    <div class="grid dg1">
      <section class="card pad"><div class="ch"><h2>Pendapatan & laba 6 bulan</h2><a class="lnk" href="#labarugi">Laba Rugi ›</a></div>${trendSvg(Dd.trend || [])}</section>
      <section class="card pad"><h2>Kesehatan</h2><div class="gauges">
        ${gauge(rev ? cost / rev * 100 : null, 'Rasio beban', 'beban + HPP ÷ pendapatan')}
        ${gauge(H.runway == null ? null : Math.min(100, H.runway / 6 * 100), 'Runway kas', H.runway == null ? 'belum cukup data' : (+H.runway).toFixed(1).replace('.', ',') + ' bulan pada laju sekarang', 'high')}
        ${gauge(H.auto, 'Jurnal otomatis', (+H.entries || 0) + ' jurnal bulan ini', 'high')}</div></section>
    </div>
    <div class="grid dg2">
      <section class="card pad"><div class="ch"><h2>Arus kas harian</h2><a class="lnk" href="#kas">Kas & Bank ›</a></div>${dailySvg(Dd.daily || [])}</section>
      <section class="card pad"><div class="ch"><h2>Beban terbesar</h2><a class="lnk" href="#biaya">Biaya ›</a></div>${hbars(top.map(x => ({ name: x.name, amt: x.amt })), Math.max(1, ...top.map(x => +x.amt)), C.amber)}</section>
    </div>
    <div class="grid dg3">
      <section class="card pad"><div class="ch"><h2>Kinerja unit bisnis</h2><a class="lnk" href="/keuangan#unit">Rinci ›</a></div><table class="tbl"><thead><tr><th>Unit</th><th class="r">Pendapatan</th><th class="r">Laba</th><th class="r">Margin</th></tr></thead><tbody>
        ${U.map(u => { const c = u.cur || {}, r = (+c.rev || 0) + (+c.oi || 0); return `<tr><td><span class="ub">${K.LOGO[u.code] ? `<img src="${K.LOGO[u.code]}" alt="">` : ''}${K.esc(u.name)}</span></td><td class="r">${rpS(r)} ${delta(r, (u.prev || {}).rev)}</td><td class="r b${c.net < 0 ? ' neg' : ''}">${rpS(c.net)}</td><td class="r">${r ? Math.round(c.net / r * 100) + '%' : '—'}</td></tr>`; }).join('')}
      </tbody></table></section>
      <section class="card pad"><h2>Sumber pendapatan</h2>${hbars(mix.map(x => ({ name: x.name, amt: x.amt })), Math.max(1, ...mix.map(x => +x.amt)), C.teal)}</section>
      <section class="card pad"><div class="ch"><h2>Jatuh tempo 30 hari</h2><a class="lnk" href="/keuangan#kewajiban">Semua ›</a></div>${due.length ? `<table class="tbl"><tbody>${due.map(d => `<tr><td>${K.esc(d.name)}<div class="small mute">${K.tgl(d.d)} · ${d.days <= 0 ? '<span class="neg b">hari ini</span>' : d.days + ' hari lagi'}</div></td><td class="r b">${rpS(d.amt)}</td></tr>`).join('')}</tbody></table>` : '<p class="mute small">Tidak ada kewajiban rutin 30 hari ke depan.</p>'}
        <div class="mini3"><div><span>Biaya belum dibayar</span><b>${rpS(ex.sum.belum)}</b></div><div><span>Pembelian belum dibayar</span><b>${rpS(sb.sum.belum)}</b></div><div><span>Piutang belum diterima</span><b>${rpS(sj.sum.belum)}</b></div></div></section>
    </div>
    <section class="card pad" style="margin-top:14px"><div class="ch"><h2>Saldo rekening</h2><a class="lnk" href="#kas">Semua ›</a></div><div class="grid g4">${[...(Dd.cash || [])].sort((a, b) => b.book - a.book).slice(0, 8).map(a => `<a class="mini" href="#kas/${a.code}"><span>${K.esc(a.name)}</span><b class="${a.book < 0 ? 'neg' : ''}">${K.rp(a.book)}</b>${a.unmatched ? `<small class="neg">${a.unmatched} mutasi belum cocok</small>` : `<small>${K.esc(K.uname(a.unit))}</small>`}</a>`).join('')}</div></section>`;
}

/* ---------- Penjualan & Pembelian ---------- */
const DK = {
  jual: { t: 'Penjualan', one: 'Tagihan penjualan', party: 'Pelanggan', new: 'Buat tagihan', prefix: 'INV', acc: (a) => ['pendapatan', 'pendapatan_lain'].includes(a.grp), pay: 'Terima pembayaran', st: { belum: 'Belum dibayar', sebagian: 'Dibayar sebagian', telat: 'Jatuh tempo', lunas: 'Lunas', batal: 'Batal' } },
  beli: { t: 'Pembelian', one: 'Tagihan pembelian', party: 'Vendor', new: 'Buat pembelian', prefix: 'PB', acc: (a) => !a.is_cash && ['aset', 'hpp', 'beban', 'beban_lain'].includes(a.grp), pay: 'Bayar', st: { belum: 'Belum dibayar', sebagian: 'Dibayar sebagian', telat: 'Jatuh tempo', lunas: 'Lunas', batal: 'Batal' } },
};
const dpill = (k, s) => `<span class="pill p-${s === 'sebagian' ? 'info' : s}">${DK[k].st[s] || s}</span>`;
const DS = { jual: { st: '', q: '' }, beli: { st: '', q: '' } };
async function vDocList(kind) {
  const D = DK[kind], S = DS[kind], [f, t] = K.range();
  const r = await K.A.rpc('pk_fin_doc_list', { p_kind: kind, p_from: f, p_to: t, p_status: S.st || null, p_q: S.q || null }), s = r.sum, rows = r.rows;
  const tabs = [['', 'Semua'], ['belum', 'Belum dibayar', s.n_belum], ['sebagian', 'Dibayar sebagian'], ['telat', 'Jatuh tempo', s.n_telat], ['lunas', 'Lunas'], ['batal', 'Batal']];
  return K.header(D.t, K.canWrite() ? `<a class="btn pri" href="#${kind}/baru">${K.svg('plus', 16)} ${D.new}</a>` : '') + `
    <div class="grid g3">
      <div class="sum"><span>${kind === 'jual' ? 'Penjualan' : 'Pembelian'} bulan ini</span><b>${K.rp(s.bulan)}</b><small>${s.n_bulan} dokumen</small></div>
      <a class="sum a" href="#${kind}" data-dst="${kind}:belum"><span>${kind === 'jual' ? 'Belum diterima' : 'Belum dibayar'}</span><b>${K.rp(s.belum)}</b><small>${s.n_belum} tagihan</small></a>
      <a class="sum r" href="#${kind}" data-dst="${kind}:telat"><span>Lewat jatuh tempo</span><b>${K.rp(s.telat)}</b><small>${s.n_telat} tagihan</small></a>
    </div>
    <nav class="tabs" aria-label="Status">${tabs.map(([k, l, c]) => `<a href="#${kind}" data-dst="${kind}:${k}" aria-current="${S.st === k}">${l}${c ? `<span class="c">${c}</span>` : ''}</a>`).join('')}</nav>
    <div class="tools"><input class="inp search" type="search" data-dq="${kind}" placeholder="Cari nomor, ${D.party.toLowerCase()}, keterangan" value="${K.esc(S.q)}">${K.perSel()}<span class="sp"></span><span class="small mute">${rows.length} dokumen</span></div>
    <div class="tw">${rows.length ? `<table class="tbl cards"><thead><tr><th>Tanggal</th><th>Nomor</th><th>${D.party}</th><th>Jatuh tempo</th><th>Status</th><th class="r">Sisa</th><th class="r">Total</th></tr></thead><tbody>
      ${rows.map(x => `<tr class="go" data-href="#${kind}/${x.id}"><td data-m="hide">${K.tgl(x.date)}</td><td><a class="code" href="#${kind}/${x.id}">${K.esc(x.code)}</a></td><td data-m="full"><b>${K.esc(x.party)}</b>${x.memo ? `<div class="small mute">${K.esc(x.memo)}</div>` : ''}</td>
        <td data-m="hide">${K.tgl(x.due)}</td><td>${dpill(kind, x.status)}</td><td class="r" data-m="hide">${x.owe > 0 ? K.rp(x.owe) : '—'}</td><td class="r b" data-m="right">${K.rp(x.total)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="5">Jumlah</td><td class="r">${K.rp(K.sum(rows, x => x.owe))}</td><td class="r">${K.rp(K.sum(rows, x => x.status === 'batal' ? 0 : x.total))}</td></tr></tfoot></table>`
      : `<div class="empty">Belum ada ${D.one.toLowerCase()} pada periode ini.${K.canWrite() ? ` <a class="lnk" href="#${kind}/baru">${D.new}</a>` : ''}</div>`}</div>`;
}
let PRODS = null;
const products = async () => { if (!PRODS) PRODS = await K.A.rpc('pk_fin_products_list', { p_q: null }); return PRODS; };
function docLine(kind, P, AC, l = {}) {
  return `<tr><td class="acc-c" style="min-width:220px"><select class="inp" data-l="product" aria-label="Produk"><option value="">— tanpa produk —</option>${P.filter(p => p.is_active).map(p => `<option value="${p.id}" data-price="${kind === 'jual' ? p.sell_price : p.buy_price}"${p.id === l.product ? ' selected' : ''}>${K.esc(p.code)} · ${K.esc(p.name)}${p.kind === 'barang' ? ` (stok ${K.num(p.qty)})` : ''}</option>`).join('')}</select>
      <select class="inp" data-l="acc" aria-label="Akun" style="margin-top:6px">${K.accOpts(AC, l.acc, 'Akun (ikut produk)')}</select></td>
    <td class="memo-c"><input class="inp" data-l="memo" placeholder="Deskripsi" value="${K.esc(l.memo || '')}"></td>
    <td style="min-width:80px"><input class="inp num" data-l="qty" inputmode="decimal" value="${l.qty || 1}" aria-label="Kuantitas"></td>
    <td style="min-width:130px"><input class="inp num" data-l="price" inputmode="numeric" placeholder="0" value="${l.price ? K.num(l.price) : ''}" aria-label="Harga"></td>
    <td style="min-width:70px"><input class="inp num" data-l="disc" inputmode="decimal" placeholder="0" aria-label="Diskon %"></td>
    <td class="amt-c r b" data-l="amt" style="min-width:120px;vertical-align:middle">Rp0</td>
    <td class="del-c"><button class="del" type="button" data-delrow aria-label="Hapus baris">×</button></td></tr>`;
}
async function vDocNew(kind) {
  const D = DK[kind];
  if (!K.canWrite()) return K.header(D.new) + '<div class="banner">Hanya Keuangan dan CEO yang bisa membuat dokumen.</div>';
  const [P, AC, CA, L] = await Promise.all([products(), K.accounts(), K.cashAccs(), K.A.rpc('pk_fin_doc_list', { p_kind: kind, p_from: '2024-01-01', p_to: K.today() })]);
  const ac = AC.filter(D.acc), d = K.today();
  return K.header(D.new, '', `<a href="#${kind}">${D.t}</a> › Baru`) + `
    <form class="doc" id="fDoc" data-kind="${kind}" autocomplete="off">
      <div class="fg">
        <label class="w2"><span class="req">${D.party}</span><input class="inp" name="party" list="pList" maxlength="120"><datalist id="pList">${(L.parties || []).map(p => `<option value="${K.esc(p)}"></option>`).join('')}</datalist></label>
        <label><span>Kontak (HP / email)</span><input class="inp" name="contact" maxlength="120"></label>
        <label><span>No. referensi${kind === 'beli' ? ' / nota vendor' : ' / PO'}</span><input class="inp" name="ref_no" maxlength="60"></label>
        <label><span class="req">Tanggal</span><input class="inp" type="date" name="date" value="${d}" max="${d}"></label>
        <label><span>Termin</span><select class="inp" name="terms"><option value="0">Tunai / hari ini</option><option value="7">7 hari</option><option value="14" selected>14 hari</option><option value="30">30 hari</option><option value="60">60 hari</option></select></label>
        <label><span>Jatuh tempo</span><input class="inp" type="date" name="due"></label>
        <label><span class="req">Unit bisnis</span><select class="inp" name="unit">${K.unitOpts(K.ls('buku.unit') || 'GK')}</select></label>
      </div>
      <div class="lines"><div class="tw"><table class="tbl"><thead><tr><th>Produk / akun</th><th>Deskripsi</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Disk %</th><th class="r">Jumlah</th><th></th></tr></thead>
        <tbody id="lines">${docLine(kind, P, ac)}</tbody></table></div>
        <button class="lnk" type="button" data-addline style="margin-top:10px">+ Tambah baris</button> <a class="lnk" href="#stok" style="margin-left:14px">Kelola produk ›</a></div>
      <div class="grid g2" style="align-items:start">
        <div><label class="fld" style="margin-top:14px">${kind === 'jual' ? 'Catatan untuk pelanggan' : 'Keterangan'}<textarea class="inp" name="memo" rows="3" maxlength="400"></textarea></label>
          <label class="fld" style="margin-top:10px">Link lampiran<input class="inp" name="proof_url" type="url" placeholder="https://"></label>
          <label class="sw" style="margin-top:14px"><input type="checkbox" name="paynow"> ${kind === 'jual' ? 'Sudah dibayar lunas (terima sekarang)' : 'Sudah dibayar lunas'}</label>
          <label class="fld" data-paynow hidden style="margin-top:8px">${kind === 'jual' ? 'Masuk ke' : 'Dibayar dari'}<select class="inp" name="pay_acc">${K.cashOpts(CA, K.ls('buku.payacc') || '', 'Pilih kas / bank')}</select></label></div>
        <div class="totals">
          <div><span>Subtotal</span><b data-sub>Rp0</b></div>
          <div><span>Diskon (Rp)</span><input class="inp num" name="discount" inputmode="numeric" placeholder="0" style="width:150px"></div>
          <div><span>PPN</span><select class="inp" name="tax_pct" style="width:150px"><option value="0">Tanpa PPN</option><option value="11">PPN 11%</option><option value="12">PPN 12%</option></select></div>
          <div><span>Pajak</span><b data-tax>Rp0</b></div>
          <div class="grand"><span>Total</span><span data-tot>Rp0</span></div>
        </div>
      </div>
      <div class="foot"><a class="btn" href="#${kind}">Batal</a><button class="btn pri" type="submit">Simpan ${D.one.toLowerCase()}</button></div>
    </form>`;
}
function wireDocForm() {
  const f = $('#fDoc'); if (!f) return; const kind = f.dataset.kind;
  const parse = (v) => +String(v || '').replace(/\./g, '').replace(',', '.') || 0;
  const calc = () => {
    let sub = 0;
    f.querySelectorAll('#lines tr').forEach(tr => { const q = parse(tr.querySelector('[data-l=qty]').value), p = K.parseNum(tr.querySelector('[data-l=price]').value), dc = parse(tr.querySelector('[data-l=disc]').value), a = Math.round(q * p * (1 - dc / 100)); sub += a; tr.querySelector('[data-l=amt]').textContent = K.rp(a); });
    const disc = K.parseNum(f.discount.value), tax = Math.round((sub - disc) * (+f.tax_pct.value) / 100);
    $('[data-sub]', f).textContent = K.rp(sub); $('[data-tax]', f).textContent = K.rp(tax); $('[data-tot]', f).textContent = K.rp(sub - disc + tax);
  };
  const setDue = () => { const d = K.D(f.date.value || K.today()); d.setDate(d.getDate() + (+f.terms.value)); f.due.value = K.ymd(d); };
  setDue();
  f.addEventListener('input', (e) => { if (e.target.matches('[data-l=price],[name=discount]')) { const n = K.parseNum(e.target.value); e.target.value = n ? K.num(n) : ''; } calc(); });
  f.addEventListener('change', (e) => {
    if (e.target.matches('[data-l=product]')) { const o = e.target.selectedOptions[0], tr = e.target.closest('tr'); if (o && o.dataset.price) { tr.querySelector('[data-l=price]').value = K.num(o.dataset.price); if (!tr.querySelector('[data-l=memo]').value) tr.querySelector('[data-l=memo]').value = o.textContent.split(' · ')[1].replace(/ \(stok.*$/, ''); } calc(); }
    if (e.target.matches('[name=terms],[name=date]')) setDue();
    if (e.target.matches('[name=tax_pct]')) calc();
    if (e.target.matches('[name=paynow]')) $('[data-paynow]', f).hidden = !e.target.checked;
  });
  f.addEventListener('click', async (e) => {
    if (e.target.closest('[data-addline]')) { const [P, AC] = await Promise.all([products(), K.accounts()]); $('#lines', f).insertAdjacentHTML('beforeend', docLine(kind, P, AC.filter(DK[kind].acc))); }
    if (e.target.closest('[data-delrow]') && f.querySelectorAll('#lines tr').length > 1) { e.target.closest('tr').remove(); calc(); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lines = [...f.querySelectorAll('#lines tr')].map(tr => { const g = (k) => tr.querySelector(`[data-l=${k}]`).value; return { product: g('product') || null, acc: g('acc') || null, memo: g('memo'), qty: parse(g('qty')), price: K.parseNum(g('price')), disc_pct: parse(g('disc')) }; }).filter(l => l.product || l.acc || l.price);
    if (!f.party.value.trim()) return K.toast('Isi ' + DK[kind].party.toLowerCase(), true);
    if (!lines.length || lines.some(l => (!l.product && !l.acc) || !l.price || !l.qty)) return K.toast('Setiap baris perlu produk atau akun, qty, dan harga', true);
    if (f.paynow.checked && !f.pay_acc.value) return K.toast('Pilih rekening pembayaran', true);
    const p = { kind, party: f.party.value, contact: f.contact.value, ref_no: f.ref_no.value, date: f.date.value, due: f.due.value, unit: f.unit.value, memo: f.memo.value, proof_url: f.proof_url.value,
      discount: K.parseNum(f.discount.value), tax_pct: +f.tax_pct.value, pay_acc: f.paynow.checked ? f.pay_acc.value : null, lines };
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    try { const r = await K.A.rpc('pk_fin_doc_save', { p }); PRODS = null; K.ls('buku.unit', f.unit.value); K.toast(r.code + ' tersimpan dan dibukukan'); location.hash = `#${kind}/${r.id}`; }
    catch (err) { K.toast(err.message, true); b.disabled = false; }
  });
}
async function vDocDetail(kind, id) {
  const D = DK[kind], e = await K.A.rpc('pk_fin_doc_get', { p_id: id }), owe = e.status === 'batal' ? 0 : e.total - e.paid;
  const st = e.status === 'belum' && e.due_date < K.today() ? 'telat' : e.status === 'belum' && +e.paid > 0 ? 'sebagian' : e.status;
  const acts = K.canWrite() && e.status !== 'batal' ? `${owe > 0 ? `<button class="btn teal" type="button" data-dpay="${kind}">${D.pay}</button>` : ''}<button class="btn dng" type="button" data-dvoid>Batalkan</button>` : '';
  const co = (e.company || {}).name || 'PT Popo Karya Investama';
  return K.header(`${D.one} ${K.esc(e.code)} ${dpill(kind, st)}`, `${kind === 'jual' ? `<button class="btn" type="button" data-share>Salin teks WA</button>` : ''}<button class="btn" type="button" onclick="print()">${kind === 'jual' ? 'Cetak invoice' : 'Cetak'}</button>${acts}`, `<a href="#${kind}">${D.t}</a> › ${K.esc(e.code)}`) + `
    <div class="doc invoice">
      ${e.status === 'batal' ? `<div class="banner">Dibatalkan: ${K.esc(e.void_reason || '')}. Jurnal dan stok sudah dibalik.</div>` : ''}
      <div class="ivh"><div><img src="/img/pokama-logo.png" alt="Pokama" style="height:30px"><div class="small mute" style="margin-top:6px">${K.esc(co)} · ${K.esc(K.uname(e.unit_code))}</div></div>
        <div class="ivt"><b>${kind === 'jual' ? 'INVOICE' : 'TAGIHAN PEMBELIAN'}</b><span>${K.esc(e.code)}</span></div></div>
      <div class="dhead">
        <div><span>${D.party}</span><b>${K.esc(e.party)}</b>${e.contact ? `<small class="mute">${K.esc(e.contact)}</small>` : ''}</div>
        <div><span>Tanggal</span><b>${K.tgl(e.doc_date)}</b></div>
        <div><span>Jatuh tempo</span><b${st === 'telat' ? ' class="neg"' : ''}>${K.tgl(e.due_date)}</b></div>
        ${e.ref_no ? `<div><span>No. referensi</span><b>${K.esc(e.ref_no)}</b></div>` : ''}
        ${e.proof_url ? `<div><span>Lampiran</span><b><a href="${K.esc(e.proof_url)}" target="_blank" rel="noopener">Buka ›</a></b></div>` : ''}
      </div>
      <div class="tw"><table class="tbl cards"><thead><tr><th>Produk / layanan</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Disk</th><th class="r">Jumlah</th></tr></thead><tbody>
        ${e.lines.map(l => `<tr><td data-m="full"><b>${K.esc(l.product_name || l.memo || l.name)}</b>${l.product_name && l.memo && l.memo !== l.product_name ? `<div class="small mute">${K.esc(l.memo)}</div>` : ''}<div class="small mute">${K.esc(l.acc)} ${K.esc(l.name || '')}${l.asset_no ? ' · ' + K.esc(l.asset_no) : ''}</div></td>
          <td class="r">${K.num(l.qty)} ${K.esc(l.uom || '')}</td><td class="r">${K.num(l.price)}</td><td class="r" data-m="hide">${+l.disc_pct ? l.disc_pct + '%' : '—'}</td><td class="r b" data-m="right">${K.rp(l.amount)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="grid g2" style="align-items:start">
        <div>${e.memo ? `<p class="small" style="margin:14px 0 0"><b>Catatan</b><br>${K.esc(e.memo)}</p>` : ''}
          ${(e.payments || []).length ? `<p class="small b" style="margin:14px 0 4px">Pembayaran</p>${e.payments.map(p => `<div class="small">${K.tgl(p.date)} · ${K.rp(p.amount)} · ${K.esc(p.entry)}</div>`).join('')}` : ''}</div>
        <div class="totals">
          <div><span>Subtotal</span><b>${K.rp(e.subtotal)}</b></div>
          ${+e.discount ? `<div><span>Diskon</span><b>−${K.rp(e.discount)}</b></div>` : ''}
          ${+e.tax ? `<div><span>PPN ${K.num(e.tax_pct)}%</span><b>${K.rp(e.tax)}</b></div>` : ''}
          <div><span>Total</span><b>${K.rp(e.total)}</b></div>
          <div><span>Sudah dibayar</span><b>${K.rp(e.paid)}</b></div>
          <div class="grand"><span>Sisa tagihan</span><span${owe > 0 ? ' class="neg"' : ''}>${K.rp(owe)}</span></div>
        </div>
      </div>
    </div>
    <section class="card pad noprint" style="margin-top:14px"><h2>Jurnal</h2>${jr(e.journal)}</section>`;
}
const jr = (J) => (J || []).map(j => `<div class="jr"><div class="small"><b>${K.esc(j.code)}</b> · ${K.tgl(j.date)} · ${K.esc(j.memo)}</div>
  <table class="tbl"><thead><tr><th>Akun</th><th class="r">Debit</th><th class="r">Kredit</th></tr></thead><tbody>${(j.lines || []).map(l => `<tr><td>${K.esc(l.acc)} ${K.esc(l.name)}</td><td class="r">${+l.d ? K.num(l.d) : ''}</td><td class="r">${+l.c ? K.num(l.c) : ''}</td></tr>`).join('')}</tbody></table></div>`).join('') || '<p class="mute small">Belum ada jurnal.</p>';
async function docPay(kind, id) {
  const e = await K.A.rpc('pk_fin_doc_get', { p_id: id }), owe = e.total - e.paid, CA = await K.cashAccs();
  K.panel(`<div class="ph2"><h2>${DK[kind].pay} ${K.esc(e.code)}</h2><button class="x" data-close aria-label="Tutup">×</button></div><p class="mute" style="margin:0">${K.esc(e.party)} · sisa ${K.rp(owe)}</p>
    <form id="fDP" class="grid" style="gap:12px"><label class="fld"><span class="req">${kind === 'jual' ? 'Masuk ke' : 'Dibayar dari'}</span><select class="inp" name="acc">${K.cashOpts(CA, K.ls('buku.payacc') || '', 'Pilih kas / bank')}</select></label>
      <label class="fld"><span class="req">Tanggal</span><input class="inp" type="date" name="date" value="${K.today()}" max="${K.today()}"></label>
      <label class="fld"><span class="req">Jumlah</span><input class="inp num" name="amt" inputmode="numeric" value="${K.num(owe)}"></label>
      <div class="foot"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan</button></div></form>`, (p) => {
    const f = $('#fDP', p); f.amt.addEventListener('input', () => { const n = K.parseNum(f.amt.value); f.amt.value = n ? K.num(n) : ''; });
    f.addEventListener('submit', async (ev) => { ev.preventDefault(); if (!f.acc.value) return K.toast('Pilih rekening', true);
      try { await K.A.rpc('pk_fin_doc_pay', { p_id: id, p_acc: f.acc.value, p_date: f.date.value, p_amount: K.parseNum(f.amt.value) }); K.ls('buku.payacc', f.acc.value); K.close(); K.toast('Pembayaran dibukukan'); K.render(); } catch (err) { K.toast(err.message, true); } });
  });
}
function reasonPanel(title, text, btn, fn) {
  K.panel(`<div class="ph2"><h2>${title}</h2><button class="x" data-close aria-label="Tutup">×</button></div><p class="mute" style="margin:0">${text}</p>
    <form id="fR" class="grid" style="gap:12px"><label class="fld"><span class="req">Alasan</span><textarea class="inp" name="r" rows="3" required></textarea></label>
    <div class="foot"><button class="btn" type="button" data-close>Kembali</button><button class="btn pri" type="submit" style="background:var(--red);border-color:var(--red)">${btn}</button></div></form>`, (p) => {
    $('#fR', p).addEventListener('submit', async (ev) => { ev.preventDefault(); try { await fn(ev.target.r.value); K.close(); K.render(); } catch (err) { K.toast(err.message, true); } });
  });
}

/* ---------- Produk & Stok ---------- */
const PS = { q: '', tab: '' };
async function vStok() {
  const P = await K.A.rpc('pk_fin_products_list', { p_q: PS.q || null }); PRODS = null;
  const B = P.filter(p => p.kind === 'barang' && p.is_active), low = B.filter(p => +p.qty <= +p.min_qty), rows = PS.tab === 'rendah' ? low : PS.tab === 'jasa' ? P.filter(p => p.kind === 'jasa') : PS.tab === 'barang' ? B : P;
  return K.header('Produk & Stok', K.canWrite() ? `<button class="btn" type="button" data-adj>Penyesuaian stok</button><button class="btn pri" type="button" data-prod>${K.svg('plus', 16)} Produk baru</button>` : '') + `
    <div class="grid g4"><div class="sum t"><span>Nilai persediaan</span><b>${K.rp(K.sum(B, p => p.value))}</b><small>biaya rata-rata</small></div>
      <div class="sum"><span>Produk barang</span><b>${B.length}</b><small>${K.num(K.sum(B, p => Math.max(0, p.qty)))} unit di gudang</small></div>
      <a class="sum r" href="#stok" data-ptab="rendah"><span>Stok menipis</span><b>${low.length}</b><small>di bawah batas minimum</small></a>
      <div class="sum a"><span>Terpakai/terjual 30 hari</span><b>${K.num(K.sum(B, p => p.sold30))}</b><small>unit</small></div></div>
    <nav class="tabs">${[['', 'Semua'], ['barang', 'Barang'], ['jasa', 'Jasa'], ['rendah', 'Stok menipis', low.length]].map(([k, l, c]) => `<a href="#stok" data-ptab="${k}" aria-current="${PS.tab === k}">${l}${c ? `<span class="c">${c}</span>` : ''}</a>`).join('')}</nav>
    <div class="tools"><input class="inp search" type="search" data-pq placeholder="Cari kode atau nama" value="${K.esc(PS.q)}"></div>
    <div class="tw">${rows.length ? `<table class="tbl cards"><thead><tr><th>Kode</th><th>Nama</th><th>Jenis</th><th class="r">Stok</th><th class="r">Biaya rata-rata</th><th class="r">Harga jual</th><th class="r">Nilai</th></tr></thead><tbody>
      ${rows.map(p => `<tr class="go" data-href="#stok/${p.id}"><td><span class="code">${K.esc(p.code)}</span></td><td data-m="full"><b>${K.esc(p.name)}</b>${p.category ? `<div class="small mute">${K.esc(p.category)}</div>` : ''}${p.is_active ? '' : ' <span class="pill p-batal">nonaktif</span>'}</td><td data-m="hide">${p.kind === 'jasa' ? 'Jasa' : 'Barang'}</td>
        <td class="r${p.kind === 'barang' && +p.qty <= +p.min_qty ? ' neg b' : ''}">${p.kind === 'barang' ? K.num(p.qty) + ' ' + K.esc(p.uom) : '—'}</td><td class="r" data-m="hide">${p.kind === 'barang' ? K.num(p.avg_cost) : '—'}</td><td class="r" data-m="hide">${K.num(p.sell_price)}</td><td class="r b" data-m="right">${p.kind === 'barang' ? K.rp(p.value) : ''}</td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">Belum ada produk.${K.canWrite() ? ' Tambahkan part bengkel, barang dagang Niagaaja, atau jasa yang sering ditagih.' : ''}</div>`}</div>`;
}
async function vProduk(id) {
  const R = await K.A.rpc('pk_fin_product_moves', { p_id: id }), p = R.product, TY = { pembelian: 'Pembelian', penjualan: 'Penjualan', penyesuaian: 'Penyesuaian', pemakaian: 'Pemakaian servis', saldo_awal: 'Saldo awal', batal: 'Batal dokumen' };
  return K.header(K.esc(p.name), K.canWrite() ? `<button class="btn" type="button" data-prod="${p.id}">Ubah</button>${p.kind === 'barang' ? `<button class="btn pri" type="button" data-adj="${p.id}">Penyesuaian stok</button>` : ''}` : '', `<a href="#stok">Produk & Stok</a> › ${K.esc(p.code)}`) + `
    <div class="grid g4"><div class="sum t"><span>Stok</span><b>${p.kind === 'barang' ? K.num(p.qty) + ' ' + K.esc(p.uom) : 'Jasa'}</b><small>minimum ${K.num(p.min_qty)}</small></div>
      <div class="sum"><span>Biaya rata-rata</span><b>${K.rp(p.avg_cost)}</b><small>beli terakhir ${K.rp(p.buy_price)}</small></div>
      <div class="sum"><span>Harga jual</span><b>${K.rp(p.sell_price)}</b><small>${p.avg_cost > 0 && p.sell_price > 0 ? 'margin ' + Math.round((p.sell_price - p.avg_cost) / p.sell_price * 100) + '%' : ''}</small></div>
      <div class="sum a"><span>Nilai persediaan</span><b>${K.rp(Math.max(0, p.qty) * p.avg_cost)}</b><small>akun ${K.esc(p.inv_acc || '—')}</small></div></div>
    <section class="card pad" style="margin-top:14px"><h2>Mutasi stok</h2>${R.moves.length ? `<div class="tw"><table class="tbl cards"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Referensi</th><th>Keterangan</th><th class="r">Qty</th><th class="r">Biaya/unit</th></tr></thead><tbody>
      ${R.moves.map(m => `<tr><td data-m="hide">${K.tgl(m.date)}</td><td>${TY[m.type] || m.type}</td><td><span class="code">${K.esc(m.ref || '')}</span></td><td data-m="full">${K.esc(m.memo || '')}${m.asset ? ` <span class="small mute">· ${K.esc(m.asset)}</span>` : ''}</td><td class="r b ${m.qty < 0 ? 'neg' : ''}" data-m="right">${m.qty > 0 ? '+' : ''}${K.num(m.qty)}</td><td class="r" data-m="hide">${K.num(m.cost)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mute">Belum ada mutasi.</p>'}</section>`;
}
async function prodPanel(id) {
  const P = id ? (await K.A.rpc('pk_fin_products_list', { p_q: null })).find(x => x.id === id) : { kind: 'barang', uom: 'pcs' }, AC = await K.accounts();
  const pick = (g, v) => `<select class="inp" name="${g}">${K.accOpts(AC.filter(a => ({ sales_acc: ['pendapatan', 'pendapatan_lain'], cogs_acc: ['hpp', 'beban'], inv_acc: ['aset'] })[g].includes(a.grp) && !a.is_cash), v)}</select>`;
  K.panel(`<div class="ph2"><h2>${id ? 'Ubah produk' : 'Produk baru'}</h2><button class="x" data-close aria-label="Tutup">×</button></div>
    <form id="fP" class="grid" style="gap:12px" autocomplete="off">
      <div class="grid g2"><label class="fld"><span class="req">Nama</span><input class="inp" name="name" value="${K.esc(P.name || '')}" required></label><label class="fld">Kode<input class="inp" name="code" value="${K.esc(P.code || '')}" placeholder="otomatis"></label></div>
      <div class="grid g2"><label class="fld">Jenis<select class="inp" name="kind"${id ? ' disabled' : ''}><option value="barang"${P.kind === 'barang' ? ' selected' : ''}>Barang (punya stok)</option><option value="jasa"${P.kind === 'jasa' ? ' selected' : ''}>Jasa</option></select></label><label class="fld">Satuan<input class="inp" name="uom" value="${K.esc(P.uom || 'pcs')}"></label></div>
      <div class="grid g2"><label class="fld">Kategori<input class="inp" name="category" value="${K.esc(P.category || '')}" placeholder="Part motor, Laptop, ..."></label><label class="fld">Unit bisnis<select class="inp" name="unit"><option value="">Semua</option>${K.unitOpts(P.unit)}</select></label></div>
      <div class="grid g2"><label class="fld">Harga jual<input class="inp num" name="sell_price" inputmode="numeric" value="${P.sell_price ? K.num(P.sell_price) : ''}"></label><label class="fld">Stok minimum<input class="inp num" name="min_qty" inputmode="numeric" value="${P.min_qty || ''}"></label></div>
      <label class="fld">Akun penjualan${pick('sales_acc', P.sales_acc || '4-42001')}</label>
      <div data-brg class="grid g2"><label class="fld">Akun persediaan${pick('inv_acc', P.inv_acc || '1-10200')}</label><label class="fld">Akun HPP / pemakaian${pick('cogs_acc', P.cogs_acc || '5-50002')}</label></div>
      ${id ? `<label class="sw"><input type="checkbox" name="is_active"${P.is_active ? ' checked' : ''}> Aktif</label>` : ''}
      <div class="foot"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan</button></div></form>`, (pn) => {
    const f = $('#fP', pn), tog = () => { $('[data-brg]', f).hidden = f.kind.value === 'jasa'; }; tog(); f.kind.addEventListener('change', tog);
    f.addEventListener('input', (e) => { if (e.target.matches('.num')) { const n = K.parseNum(e.target.value); e.target.value = n ? K.num(n) : ''; } });
    f.addEventListener('submit', async (ev) => { ev.preventDefault();
      const q = { id: id || null, name: f.name.value, code: f.code.value, kind: f.kind.value, uom: f.uom.value, category: f.category.value, unit: f.unit.value, sell_price: K.parseNum(f.sell_price.value), min_qty: K.parseNum(f.min_qty.value), sales_acc: f.sales_acc.value, inv_acc: f.inv_acc.value, cogs_acc: f.cogs_acc.value };
      if (id) q.is_active = f.is_active.checked;
      try { await K.A.rpc('pk_fin_product_save', { p: q }); PRODS = null; K.close(); K.toast('Produk tersimpan'); K.render(); } catch (err) { K.toast(err.message, true); } });
  });
}
async function adjPanel(id) {
  const P = (await K.A.rpc('pk_fin_products_list', { p_q: null })).filter(p => p.kind === 'barang' && p.is_active);
  if (!P.length) return K.toast('Buat produk barang dulu', true);
  K.panel(`<div class="ph2"><h2>Penyesuaian stok</h2><button class="x" data-close aria-label="Tutup">×</button></div><p class="mute" style="margin:0">Opname (hitung fisik), pemakaian part untuk servis unit, atau saldo awal stok. Jurnal dibuat otomatis.</p>
    <form id="fA" class="grid" style="gap:12px" autocomplete="off">
      <label class="fld"><span class="req">Produk</span><select class="inp" name="product">${P.map(p => `<option value="${p.id}"${p.id === id ? ' selected' : ''}>${K.esc(p.code)} · ${K.esc(p.name)} (stok ${K.num(p.qty)} ${K.esc(p.uom)})</option>`).join('')}</select></label>
      <label class="fld">Jenis<select class="inp" name="kind"><option value="pemakaian">Pemakaian untuk servis unit</option><option value="opname">Stok opname (isi hasil hitung)</option><option value="saldo_awal">Saldo awal stok</option></select></label>
      <div class="grid g2"><label class="fld"><span class="req" data-ql>Jumlah dipakai</span><input class="inp num" name="qty" inputmode="decimal" required></label><label class="fld" data-cost hidden>Biaya per unit<input class="inp num" name="cost" inputmode="numeric"></label></div>
      <label class="fld" data-asset>Unit aset yang diservis<input class="inp" name="asset" list="assetList" placeholder="Ketik nomor aset / plat"><datalist id="assetList"></datalist></label>
      <div class="grid g2"><label class="fld">Tanggal<input class="inp" type="date" name="date" value="${K.today()}" max="${K.today()}"></label><label class="fld">Unit bisnis<select class="inp" name="unit">${K.unitOpts(K.ls('buku.unit') || 'GK')}</select></label></div>
      <label class="fld">Keterangan<input class="inp" name="memo"></label>
      <div class="foot"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan</button></div></form>`, (pn) => {
    const f = $('#fA', pn), tog = () => { const k = f.kind.value; $('[data-ql]', f).textContent = k === 'opname' ? 'Hasil hitung fisik' : k === 'saldo_awal' ? 'Jumlah stok awal' : 'Jumlah dipakai'; $('[data-cost]', f).hidden = k !== 'saldo_awal'; $('[data-asset]', f).hidden = k !== 'pemakaian'; };
    tog(); f.kind.addEventListener('change', tog);
    f.asset.addEventListener('input', () => K.assetSearch(f.asset.value));
    f.cost.addEventListener('input', () => { const n = K.parseNum(f.cost.value); f.cost.value = n ? K.num(n) : ''; });
    f.addEventListener('submit', async (ev) => { ev.preventDefault();
      const k = f.kind.value, n = +String(f.qty.value).replace(',', '.') || 0, asset = f.asset.value ? K.assetId(f.asset.value) : null;
      if (f.asset.value && !asset) return K.toast('Pilih unit aset dari daftar', true);
      const q = { product: f.product.value, kind: k === 'opname' ? 'penyesuaian' : k, date: f.date.value, unit: f.unit.value, memo: f.memo.value, asset };
      if (k === 'opname') q.count = n; else q.qty = n; if (k === 'saldo_awal') q.cost = K.parseNum(f.cost.value);
      try { const r = await K.A.rpc('pk_fin_stock_adjust', { p: q }); K.close(); K.toast('Stok diperbarui · ' + r.code); K.render(); } catch (err) { K.toast(err.message, true); } });
  });
}

/* ---------- Aset tetap ---------- */
const AS = { q: '', tab: 'aktif' };
async function vAset() {
  const R = await K.A.rpc('pk_fin_assets_list', { p_q: AS.q || null }), all = R.rows, m = K.today().slice(0, 7);
  const act = all.filter(a => a.status === 'aktif'), noPrice = act.filter(a => !(+a.cost)), due = act.filter(a => +a.this_month > 0 && !a.done_this_month);
  const rows = AS.tab === 'harga' ? noPrice : AS.tab === 'dilepas' ? all.filter(a => a.status === 'dilepas') : act;
  const byAcc = {}; act.forEach(a => { byAcc[a.acc_name] = byAcc[a.acc_name] || { n: 0, cost: 0, book: 0 }; byAcc[a.acc_name].n++; byAcc[a.acc_name].cost += +a.cost; byAcc[a.acc_name].book += +a.book; });
  const w = K.canWrite();
  return K.header('Aset Tetap', w ? `${R.units_unregistered ? `<button class="btn" type="button" data-aimport>Daftarkan ${R.units_unregistered} unit dari Rentalaja App</button>` : ''}<button class="btn" type="button" data-adepr ${due.length ? '' : 'disabled'}>Susutkan ${K.MONL[+m.slice(5) - 1]}</button><button class="btn pri" type="button" data-aset>${K.svg('plus', 16)} Aset baru</button>` : '') + `
    ${noPrice.length ? `<div class="banner">${noPrice.length} aset belum punya harga beli, jadi belum disusutkan. Isi dari file "Data aset perlu dilengkapi" atau klik aset untuk mengubah.</div>` : ''}
    <div class="grid g4"><div class="sum"><span>Harga perolehan</span><b>${K.rp(K.sum(act, a => a.cost))}</b><small>${act.length} aset aktif</small></div>
      <div class="sum a"><span>Akumulasi penyusutan</span><b>${K.rp(K.sum(act, a => a.accum))}</b><small>sampai bulan ini</small></div>
      <div class="sum t"><span>Nilai buku</span><b>${K.rp(K.sum(act, a => a.book))}</b><small>perolehan − akumulasi</small></div>
      <div class="sum"><span>Penyusutan per bulan</span><b>${K.rp(K.sum(act, a => a.monthly))}</b><small>${due.length ? due.length + ' aset belum disusutkan bulan ini' : 'bulan ini sudah'}</small></div></div>
    ${Object.keys(byAcc).length ? `<div class="grid g4" style="margin-top:14px">${Object.entries(byAcc).map(([k, v]) => `<div class="mini"><span>${K.esc(k)}</span><b>${K.rp(v.book)}</b><small>${v.n} aset · perolehan ${rpS(v.cost)}</small></div>`).join('')}</div>` : ''}
    <nav class="tabs">${[['aktif', 'Aktif', act.length], ['harga', 'Harga kosong', noPrice.length], ['dilepas', 'Dilepas']].map(([k, l, c]) => `<a href="#aset" data-atab="${k}" aria-current="${AS.tab === k}">${l}${c ? `<span class="c">${c}</span>` : ''}</a>`).join('')}</nav>
    <div class="tools"><input class="inp search" type="search" data-aq placeholder="Cari kode, nama, plat" value="${K.esc(AS.q)}"><span class="sp"></span>${R.runs.length ? `<span class="small mute">Penyusutan terakhir ${R.runs[0].m} · ${K.rp(R.runs[0].total)}</span>` : ''}</div>
    <div class="tw">${rows.length ? `<table class="tbl cards"><thead><tr><th>Kode</th><th>Nama</th><th>Kelompok</th><th>Tgl beli</th><th class="r">Perolehan</th><th class="r">Akumulasi</th><th class="r">Nilai buku</th><th class="r">Per bulan</th></tr></thead><tbody>
      ${rows.slice(0, 500).map(a => `<tr class="go" data-aedit="${a.id}"><td><span class="code">${K.esc(a.code)}</span></td><td data-m="full"><b>${K.esc(a.name)}</b>${a.unit_status ? ` <span class="small mute">· ${K.esc(a.unit_status)}</span>` : ''}</td><td data-m="hide">${K.esc(a.acc_name)} · ${a.life} bln</td><td data-m="hide">${K.tgl(a.acquired)}</td>
        <td class="r">${+a.cost ? K.num(a.cost) : '<span class="pill p-belum">isi harga</span>'}</td><td class="r" data-m="hide">${K.num(a.accum)}</td><td class="r b" data-m="right">${K.num(a.book)}</td><td class="r" data-m="hide">${K.num(a.monthly)}</td></tr>`).join('')}</tbody></table>${rows.length > 500 ? `<p class="small mute" style="padding:8px 12px">Menampilkan 500 dari ${rows.length}. Pakai pencarian.</p>` : ''}`
      : `<div class="empty">${AS.tab === 'aktif' ? 'Belum ada aset terdaftar. Klik "Daftarkan unit dari Rentalaja App" untuk memasukkan semua unit sewa sekaligus.' : 'Tidak ada.'}</div>`}</div>`;
}
async function asetPanel(id) {
  const R = id ? (await K.A.rpc('pk_fin_assets_list', { p_q: null })).rows.find(a => a.id === id) : {}, AC = await K.accounts(), CA = await K.cashAccs();
  const fixed = AC.filter(a => a.code >= '1-10700' && a.code < '1-10750'), accum = AC.filter(a => a.code >= '1-10750' && a.code < '1-10800');
  const locked = id && +R.months > 0;
  K.panel(`<div class="ph2"><h2>${id ? K.esc(R.code) : 'Aset baru'}</h2><button class="x" data-close aria-label="Tutup">×</button></div>
    ${id ? `<div class="grid g3"><div class="mini"><span>Akumulasi</span><b>${K.rp(R.accum)}</b><small>${R.months} bulan disusutkan</small></div><div class="mini"><span>Nilai buku</span><b>${K.rp(R.book)}</b></div><div class="mini"><span>Per bulan</span><b>${K.rp(R.monthly)}</b></div></div>` : ''}
    <form id="fAs" class="grid" style="gap:12px" autocomplete="off">
      <label class="fld"><span class="req">Nama aset</span><input class="inp" name="name" value="${K.esc(R.name || '')}" required></label>
      <div class="grid g2"><label class="fld">Kode<input class="inp" name="code" value="${K.esc(R.code || '')}" placeholder="otomatis"></label><label class="fld">Unit bisnis<select class="inp" name="unit">${K.unitOpts(R.unit || 'RA')}</select></label></div>
      <div class="grid g2"><label class="fld">Kelompok (akun aset)<select class="inp" name="asset_acc">${fixed.map(a => `<option value="${a.code}"${a.code === (R.asset_acc || '1-10704') ? ' selected' : ''}>${K.esc(a.name)}</option>`).join('')}</select></label>
        <label class="fld">Akun akumulasi<select class="inp" name="accum_acc">${accum.map(a => `<option value="${a.code}">${K.esc(a.name)}</option>`).join('')}</select></label></div>
      <div class="grid g2"><label class="fld"><span class="req">Harga perolehan</span><input class="inp num" name="cost" inputmode="numeric" value="${+R.cost ? K.num(R.cost) : ''}"${locked ? ' disabled' : ''}></label><label class="fld">Tanggal beli<input class="inp" type="date" name="acquired" value="${R.acquired || ''}"></label></div>
      <div class="grid g3"><label class="fld">Umur (bulan)<input class="inp" name="life_months" inputmode="numeric" value="${R.life || 48}"${locked ? ' disabled' : ''}></label><label class="fld">Nilai sisa<input class="inp num" name="residual" inputmode="numeric" value="${+R.residual ? K.num(R.residual) : ''}"></label><label class="fld">Mulai disusutkan<input class="inp" type="month" name="start" value="${(R.start || '').slice(0, 7)}"></label></div>
      <label class="fld">Akumulasi sebelum masuk sistem<input class="inp num" name="accum_opening" inputmode="numeric" placeholder="0 bila aset baru"></label>
      ${!id ? `<label class="fld">Dibayar dari (kosongkan bila sudah ada di saldo awal)<select class="inp" name="pay_acc">${K.cashOpts(CA, '', '— tidak membuat jurnal perolehan —')}</select></label>` : ''}
      <div class="foot">${id && R.status === 'aktif' ? '<button class="btn dng" type="button" data-adispose style="margin-right:auto">Lepas / jual aset</button>' : ''}<button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit">Simpan</button></div></form>`, (pn) => {
    const f = $('#fAs', pn);
    const cls = { '1-10701': ['1-10751', 60], '1-10702': ['1-10752', 36], '1-10703': ['1-10753', 24], '1-10704': ['1-10753', 48] };
    const setAcc = () => { const c = cls[f.asset_acc.value]; if (c) { f.accum_acc.value = c[0]; if (!id) f.life_months.value = c[1]; } }; setAcc(); f.asset_acc.addEventListener('change', setAcc);
    f.addEventListener('input', (e) => { if (e.target.matches('.num')) { const n = K.parseNum(e.target.value); e.target.value = n ? K.num(n) : ''; } });
    const dp = $('[data-adispose]', pn); if (dp) dp.addEventListener('click', () => disposePanel(R));
    f.addEventListener('submit', async (ev) => { ev.preventDefault();
      const q = { id: id || null, name: f.name.value, code: f.code.value, unit: f.unit.value, asset_acc: f.asset_acc.value, accum_acc: f.accum_acc.value, cost: locked ? R.cost : K.parseNum(f.cost.value), acquired: f.acquired.value || null,
        life_months: locked ? R.life : +f.life_months.value || 48, residual: K.parseNum(f.residual.value), start_month: f.start.value ? f.start.value + '-01' : null, pay_acc: f.pay_acc ? f.pay_acc.value : null };
      if (f.accum_opening.value) q.accum_opening = K.parseNum(f.accum_opening.value);
      try { await K.A.rpc('pk_fin_asset_save', { p: q }); K.close(); K.toast('Aset tersimpan'); K.render(); } catch (err) { K.toast(err.message, true); } });
  });
}
async function disposePanel(R) {
  const CA = await K.cashAccs();
  K.panel(`<div class="ph2"><h2>Lepas / jual ${K.esc(R.code)}</h2><button class="x" data-close aria-label="Tutup">×</button></div><p class="mute" style="margin:0">Nilai buku ${K.rp(R.book)}. Selisih dengan harga jual dicatat sebagai laba/rugi pelepasan aset.</p>
    <form id="fDs" class="grid" style="gap:12px"><div class="grid g2"><label class="fld">Tanggal<input class="inp" type="date" name="date" value="${K.today()}" max="${K.today()}"></label><label class="fld">Harga jual (0 bila hilang/rusak)<input class="inp num" name="value" inputmode="numeric" value="0"></label></div>
      <label class="fld">Uang masuk ke<select class="inp" name="acc">${K.cashOpts(CA, '', 'Pilih kas / bank')}</select></label><label class="fld"><span class="req">Keterangan</span><input class="inp" name="note" required></label>
      <div class="foot"><button class="btn" type="button" data-close>Batal</button><button class="btn pri" type="submit" style="background:var(--red);border-color:var(--red)">Lepas aset</button></div></form>`, (pn) => {
    const f = $('#fDs', pn); f.value.addEventListener('input', () => { const n = K.parseNum(f.value.value); f.value.value = K.num(n); });
    f.addEventListener('submit', async (ev) => { ev.preventDefault(); try { const r = await K.A.rpc('pk_fin_asset_dispose', { p_id: R.id, p_date: f.date.value, p_value: K.parseNum(f.value.value), p_acc: f.acc.value || null, p_note: f.note.value }); K.close(); K.toast('Aset dilepas · ' + (r.gain >= 0 ? 'laba ' : 'rugi ') + K.rp(Math.abs(r.gain))); K.render(); } catch (err) { K.toast(err.message, true); } });
  });
}

/* ---------- Pajak ---------- */
async function vPajak() {
  const [f, t] = K.range(K.S.per === 'bulan' ? 'tahun' : K.S.per), T = await K.A.rpc('pk_fin_tax_summary', { p_from: f, p_to: t }), M = T.months;
  const tot = (k) => K.sum(M, m => m[k]);
  return K.header('Pajak', `<a class="btn" href="#kas" data-cash="kirim">Catat setoran pajak</a>`) + `
    <div class="banner info">Ringkasan dari dokumen di buku: PPN keluaran (penjualan), PPN masukan (pembelian), dan PPh yang dipotong dari biaya. Setoran pajak dicatat lewat Kas & Bank → Kirim dana ke akun 2-20400 Hutang pajak. Bukan pengganti e-Faktur/SPT.</div>
    <div class="grid g4"><div class="sum"><span>PPN keluaran</span><b>${K.rp(tot('ppn_out'))}</b><small>${f.slice(0, 7)} s.d. ${t.slice(0, 7)}</small></div><div class="sum t"><span>PPN masukan</span><b>${K.rp(tot('ppn_in'))}</b><small>bisa dikreditkan</small></div>
      <div class="sum a"><span>PPh dipotong</span><b>${K.rp(tot('pph'))}</b><small>wajib disetor</small></div><div class="sum r"><span>Saldo hutang pajak</span><b>${K.rp(T.balance)}</b><small>akun 2-20400 per ${K.tgl(t)}</small></div></div>
    <div class="tools">${K.perSel()}</div>
    <div class="grid g2" style="align-items:start"><section class="card pad"><h2>Per bulan</h2><div class="tw"><table class="tbl"><thead><tr><th>Bulan</th><th class="r">PPN keluaran</th><th class="r">PPN masukan</th><th class="r">PPN kurang bayar</th><th class="r">PPh</th><th class="r">Disetor</th></tr></thead><tbody>
      ${M.map(m => `<tr><td>${K.MON[+m.m.slice(5) - 1]} ${m.m.slice(0, 4)}</td><td class="r">${K.num(m.ppn_out)}</td><td class="r">${K.num(m.ppn_in)}</td><td class="r b">${K.num(m.ppn_out - m.ppn_in)}</td><td class="r">${K.num(m.pph)}</td><td class="r">${K.num(m.paid)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card pad"><h2>Dokumen berpajak</h2>${T.docs.length ? `<div class="tw"><table class="tbl cards"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Dokumen</th><th class="r">DPP</th><th class="r">Pajak</th></tr></thead><tbody>${T.docs.map(d => `<tr><td data-m="hide">${K.tgl(d.date)}</td><td>${K.esc(d.kind)}</td><td data-m="full"><span class="code">${K.esc(d.code)}</span> · ${K.esc(d.party || '')}</td><td class="r" data-m="hide">${K.num(d.base)}</td><td class="r b" data-m="right">${K.num(d.tax)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mute small">Belum ada dokumen berpajak pada periode ini.</p>'}</section></div>`;
}

/* ---------- Laporan native ---------- */
const RS = { biz: '', cmp: true };
const bizSel = () => `<select class="inp" data-rbiz aria-label="Unit bisnis"><option value="">Semua unit bisnis</option>${['RA', 'WG', 'NA', 'HQ'].map(b => `<option value="${b}"${RS.biz === b ? ' selected' : ''}>${K.BIZN[b]}</option>`).join('')}</select>`;
function prevRange(f, t) { const a = K.D(f), b = K.D(t), days = Math.round((b - a) / 864e5) + 1; if (a.getDate() === 1) { const pf = new Date(a.getFullYear(), a.getMonth() - 1, 1), pt = new Date(a.getFullYear(), a.getMonth() - 1, Math.min(b.getDate(), new Date(a.getFullYear(), a.getMonth(), 0).getDate())); return [K.ymd(pf), K.ymd(pt)]; } const pt = new Date(a); pt.setDate(pt.getDate() - 1); const pf = new Date(pt); pf.setDate(pf.getDate() - days + 1); return [K.ymd(pf), K.ymd(pt)]; }
const repHead = (title, sub) => `<div class="rhead"><img src="/img/pokama-logo.png" alt="Pokama"><div><b>PT Popo Karya Investama</b><span>${title}</span><small>${sub}</small></div></div>`;
async function vLabaRugi() {
  const [f, t] = K.range(), [pf, pt] = prevRange(f, t);
  const [P, Q] = await Promise.all([K.A.rpc('pk_fin_pl', { p_from: f, p_to: t }), RS.cmp ? K.A.rpc('pk_fin_pl', { p_from: pf, p_to: pt }) : []]);
  const flt = (rows) => rows.filter(r => !RS.biz || r.biz === RS.biz);
  const agg = (rows) => { const by = {}; for (const r of flt(rows)) { by[r.acc] = by[r.acc] || { acc: r.acc, name: r.name, amt: 0 }; by[r.acc].amt += +r.amt; } return by; };
  const A = agg(P), B = agg(Q), accs = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const g = (p, src) => K.sum(Object.values(src).filter(x => x.acc[0] === p), x => x.amt);
  const sec = (title, p) => { const rows = accs.filter(a => a[0] === p); return `<tr class="sec"><td colspan="${RS.cmp ? 4 : 2}">${title}</td></tr>` + (rows.length ? rows.map(a => `<tr class="go" data-href="#akun/${a}"><td class="ind">${a} ${K.esc((A[a] || B[a]).name)}</td><td class="r">${K.num((A[a] || {}).amt)}</td>${RS.cmp ? `<td class="r mute">${K.num((B[a] || {}).amt)}</td><td class="r">${chg((A[a] || {}).amt, (B[a] || {}).amt)}</td>` : ''}</tr>`).join('') : `<tr><td class="ind mute" colspan="${RS.cmp ? 4 : 2}">—</td></tr>`) + `<tr class="sub"><td>Total ${title.toLowerCase()}</td><td class="r">${K.num(g(p, A))}</td>${RS.cmp ? `<td class="r mute">${K.num(g(p, B))}</td><td class="r">${chg(g(p, A), g(p, B))}</td>` : ''}</tr>`; };
  const tot = (label, fn, big) => `<tr class="${big ? 'grand' : 'tot'}"><td>${label}</td><td class="r${fn(A) < 0 ? ' neg' : ''}">${K.num(fn(A))}</td>${RS.cmp ? `<td class="r mute">${K.num(fn(B))}</td><td class="r">${chg(fn(A), fn(B))}</td>` : ''}</tr>`;
  const gp = (s) => g('4', s) - g('5', s), op = (s) => gp(s) - g('6', s), np = (s) => op(s) + g('7', s) - g('8', s);
  return K.header('Laba Rugi', `<button class="btn" type="button" data-rcsv="pl">Ekspor CSV</button><button class="btn" type="button" onclick="print()">Cetak / PDF</button>`, '<a href="#laporan">Laporan</a> › Laba Rugi') + `
    <div class="tools">${K.perSel()}${bizSel()}<label class="sw"><input type="checkbox" data-rcmp${RS.cmp ? ' checked' : ''}> Bandingkan periode lalu</label></div>
    <div class="doc rdoc">${repHead('Laporan Laba Rugi' + (RS.biz ? ' · ' + K.BIZN[RS.biz] : ''), K.tgl(f) + ' – ' + K.tgl(t))}
      <table class="tbl rpt"><thead><tr><th>Akun</th><th class="r">${K.tgl(f).replace(/ \d{4}$/, '')} – ${K.tgl(t)}</th>${RS.cmp ? `<th class="r">${K.tgl(pf).replace(/ \d{4}$/, '')} – ${K.tgl(pt)}</th><th class="r">Perubahan</th>` : ''}</tr></thead><tbody>
      ${sec('Pendapatan', '4')}${sec('Harga pokok penjualan', '5')}${tot('Laba kotor', gp)}${sec('Beban operasional', '6')}${tot('Laba operasional', op)}${sec('Pendapatan lain', '7')}${sec('Beban lain', '8')}${tot('Laba bersih', np, true)}
      </tbody></table></div>`;
}
const chg = (a, b) => { a = +a || 0; b = +b || 0; if (!b) return '<span class="mute">—</span>'; const d = (a - b) / Math.abs(b) * 100; return `<span class="${d < 0 ? 'neg' : 'pos'}">${d >= 0 ? '+' : ''}${d.toFixed(0)}%</span>`; };
async function vNeraca() {
  const t = K.range()[1], R = await K.A.rpc('pk_fin_balance_sheet', { p_to: t });
  const cur = R.filter(r => r.grp === 'aset' && r.acc < '1-10700'), fix = R.filter(r => r.grp === 'aset' && r.acc >= '1-10700'), L = R.filter(r => r.grp === 'kewajiban'), E = R.filter(r => r.grp === 'ekuitas');
  const s = (rows) => K.sum(rows, r => r.bal), rr = (rows) => rows.map(r => `<tr${r.acc && r.acc !== '3-39999' ? ` class="go" data-href="#akun/${r.acc}"` : ''}><td class="ind">${r.acc === '3-39999' ? '' : K.esc(r.acc) + ' '}${K.esc(r.name)}</td><td class="r${r.bal < 0 ? ' neg' : ''}">${K.num(r.bal)}</td></tr>`).join('');
  const A = s(cur) + s(fix), LE = s(L) + s(E), ok = Math.round(A) === Math.round(LE);
  return K.header('Neraca', `<button class="btn" type="button" onclick="print()">Cetak / PDF</button>`, '<a href="#laporan">Laporan</a> › Neraca') + `
    <div class="tools">${K.perSel()}<span class="small ${ok ? 'mute' : 'neg b'}">${ok ? '✓ Seimbang: aset = kewajiban + ekuitas' : 'Tidak seimbang: selisih ' + K.rp(A - LE)}</span></div>
    <div class="doc rdoc">${repHead('Neraca', 'per ' + K.tgl(t))}<div class="grid g2" style="align-items:start">
      <table class="tbl rpt"><tbody><tr class="sec"><td colspan="2">Aset lancar</td></tr>${rr(cur)}<tr class="sub"><td>Total aset lancar</td><td class="r">${K.num(s(cur))}</td></tr>
        <tr class="sec"><td colspan="2">Aset tetap</td></tr>${rr(fix)}<tr class="sub"><td>Total aset tetap</td><td class="r">${K.num(s(fix))}</td></tr><tr class="grand"><td>Total aset</td><td class="r">${K.num(A)}</td></tr></tbody></table>
      <table class="tbl rpt"><tbody><tr class="sec"><td colspan="2">Kewajiban</td></tr>${rr(L)}<tr class="sub"><td>Total kewajiban</td><td class="r">${K.num(s(L))}</td></tr>
        <tr class="sec"><td colspan="2">Ekuitas</td></tr>${rr(E)}<tr class="sub"><td>Total ekuitas</td><td class="r">${K.num(s(E))}</td></tr><tr class="grand"><td>Total kewajiban & ekuitas</td><td class="r">${K.num(LE)}</td></tr></tbody></table></div></div>`;
}
async function vArusKas() {
  const [f, t] = K.range(), R = await K.A.rpc('pk_fin_cashflow', { p_from: f, p_to: t });
  const rows = R.rows.filter(r => !RS.biz || r.biz === RS.biz), CAT = [['operasi', 'Aktivitas operasi'], ['investasi', 'Aktivitas investasi'], ['pendanaan', 'Aktivitas pendanaan']];
  const by = (c) => { const m = {}; rows.filter(r => r.cat === c).forEach(r => { m[r.acc] = m[r.acc] || { acc: r.acc, name: r.name, amt: 0 }; m[r.acc].amt += +r.amt; }); return Object.values(m).sort((a, b) => a.acc.localeCompare(b.acc)); };
  const other = [...new Set(rows.map(r => r.cat))].filter(c => !CAT.some(x => x[0] === c)).map(c => [c, c]);
  return K.header('Arus Kas', `<button class="btn" type="button" onclick="print()">Cetak / PDF</button>`, '<a href="#laporan">Laporan</a> › Arus Kas') + `
    <div class="tools">${K.perSel()}${bizSel()}</div>
    <div class="doc rdoc">${repHead('Laporan Arus Kas' + (RS.biz ? ' · ' + K.BIZN[RS.biz] : ''), K.tgl(f) + ' – ' + K.tgl(t) + ' · metode langsung')}
      <table class="tbl rpt"><tbody><tr class="tot"><td>Saldo kas awal</td><td class="r">${K.num(R.opening)}</td></tr>
      ${CAT.concat(other).map(([c, l]) => { const it = by(c); return `<tr class="sec"><td colspan="2">${l}</td></tr>${it.map(x => `<tr><td class="ind">${K.esc(x.name)}</td><td class="r${x.amt < 0 ? ' neg' : ''}">${K.num(x.amt)}</td></tr>`).join('') || '<tr><td class="ind mute" colspan="2">—</td></tr>'}<tr class="sub"><td>Kas bersih ${l.toLowerCase()}</td><td class="r">${K.num(K.sum(it, x => x.amt))}</td></tr>`; }).join('')}
      <tr class="tot"><td>Perubahan kas</td><td class="r">${K.num(K.sum(rows, r => r.amt))}</td></tr><tr class="grand"><td>Saldo kas akhir</td><td class="r">${K.num(R.closing)}</td></tr></tbody></table></div>`;
}
const JS = { q: '', src: '' };
async function vJurnal() {
  const [f, t] = K.range(), J = await K.A.rpc('pk_fin_journal', { p_from: f, p_to: t, p_biz: RS.biz || null, p_source: JS.src || null, p_q: JS.q || null, p_acc: null, p_limit: 300 });
  return K.header('Jurnal Umum', `<a class="btn" href="/keuangan#jurnal">Jurnal manual</a>`, '<a href="#laporan">Laporan</a> › Jurnal Umum') + `
    <div class="tools"><input class="inp search" type="search" data-jq placeholder="Cari nomor, keterangan" value="${K.esc(JS.q)}">${K.perSel()}${bizSel()}<select class="inp" data-jsrc><option value="">Semua sumber</option>${Object.entries(K.SRC).map(([k, v]) => `<option value="${k}"${JS.src === k ? ' selected' : ''}>${v}</option>`).join('')}</select><span class="sp"></span><span class="small mute">${J.length} jurnal${J.length >= 300 ? ' (300 terbaru)' : ''}</span></div>
    ${J.length ? J.map(j => `<div class="card jcard"><div class="jh"><span class="code">${K.esc(j.code)}</span><span>${K.tgl(j.date)}</span><span class="pill p-info">${K.esc(K.SRC[j.source] || j.source)}</span>${j.status !== 'posted' ? '<span class="pill p-batal">batal</span>' : ''}<span class="sp"></span><b>${K.rp(j.total)}</b></div>
      <div class="small" style="margin:4px 0 8px">${K.esc(j.memo || '')}${j.ref ? ` <span class="mute">· ${K.esc(j.ref)}</span>` : ''}</div>
      <table class="tbl"><tbody>${(j.lines || []).map(l => `<tr><td>${K.esc(l.acc)} ${K.esc(l.name || '')}<span class="small mute"> · ${K.esc(K.uname(l.unit))}</span></td><td class="r">${+l.d ? K.num(l.d) : ''}</td><td class="r">${+l.c ? K.num(l.c) : ''}</td></tr>`).join('')}</tbody></table></div>`).join('') : '<div class="empty">Belum ada jurnal pada periode ini.</div>'}`;
}

/* ---------- Anggaran (target vs realisasi) ---------- */
async function vAnggaran() {
  const m = K.today().slice(0, 7), from = m + '-01', dim = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate(), to = K.today();
  const [P, T, OM] = await Promise.all([K.A.rpc('pk_fin_pl', { p_from: from, p_to: to }), K.A.get('pk_targets?select=unit_code,month,amount,status&month=eq.' + from), K.A.get('pk_omzet?select=unit_code,amount&day=gte.' + from + '&day=lte.' + to)]);
  const el = +to.slice(8), pace = el / dim, UN = K.UNITS();
  const rev = (c) => K.sum(P.filter(r => c.includes(r.unit) && '47'.includes(r.acc[0])), r => r.amt), cost = (c) => K.sum(P.filter(r => c.includes(r.unit) && '568'.includes(r.acc[0])), r => r.amt);
  const tg = (c) => K.sum(T.filter(x => c.includes(x.unit_code)), x => x.amount), kk = (c) => K.sum(OM.filter(x => c.includes(x.unit_code)), x => x.amount);
  const R = []; for (const b of ['RA', 'WG', 'NA']) { const lines = UN.filter(u => u.parent === b).map(u => u.code); R.push({ code: b, name: K.BIZN[b], lvl: 0, c: [b, ...lines] }); lines.forEach(l => R.push({ code: l, name: K.uname(l), lvl: 1, c: [l] })); }
  const all = UN.map(u => u.code), G = { t: tg(all), a: rev(all), k: kk(all) };
  const row = (r) => { const t = tg(r.c), a = rev(r.c), k = kk(r.c), proj = pace ? a / pace : 0, cp = t ? a / t * 100 : null, st = !t ? '' : cp >= 100 ? 'lunas' : a >= t * pace * .95 ? 'lunas' : a >= t * pace * .8 ? 'belum' : 'telat';
    if (r.lvl && !t && !a && !k) return ''; return `<tr class="${r.lvl ? '' : 'sub'}"><td class="${r.lvl ? 'ind' : ''}">${K.esc(r.name)}</td><td class="r">${t ? K.num(t) : '—'}</td><td class="r b">${K.num(a)}</td><td style="min-width:140px">${t ? `<div class="hbt"><i style="width:${Math.min(100, cp)}%;background:${st === 'telat' ? C.red : st === 'belum' ? C.amber : C.teal}"></i></div><span class="small">${cp.toFixed(0)}%</span>` : ''}</td><td class="r">${K.num(proj)}</td><td class="r">${K.num(cost(r.c))}</td><td class="r">${K.num(k)}</td><td>${st ? `<span class="pill p-${st}">${st === 'lunas' ? 'Sesuai laju' : st === 'belum' ? 'Diawasi' : 'Tertinggal'}</span>` : ''}</td></tr>`; };
  return K.header('Anggaran & Target', `<a class="btn" href="/#/unit">Atur target di Unit Bisnis</a>`) + `
    <div class="grid g4"><div class="sum"><span>Target omzet ${K.MONL[+m.slice(5) - 1]}</span><b>${K.rp(G.t)}</b><small>hari ke-${el} dari ${dim}</small></div><div class="sum t"><span>Realisasi di buku</span><b>${K.rp(G.a)}</b><small>${G.t ? Math.round(G.a / G.t * 100) + '% dari target' : '—'}</small></div>
      <div class="sum a"><span>Proyeksi akhir bulan</span><b>${K.rp(pace ? G.a / pace : 0)}</b><small>laju sekarang</small></div><div class="sum"><span>Dilapor tim (KKH)</span><b>${K.rp(G.k)}</b><small>selisih ${K.rp(G.k - G.a)}</small></div></div>
    <section class="card pad" style="margin-top:14px"><h2>Per unit bisnis & lini</h2><div class="tw"><table class="tbl"><thead><tr><th>Unit / lini</th><th class="r">Target</th><th class="r">Realisasi</th><th>Capaian</th><th class="r">Proyeksi</th><th class="r">Beban</th><th class="r">Lapor KKH</th><th>Status</th></tr></thead><tbody>${R.map(row).join('')}</tbody></table></div>
      <p class="small mute" style="margin:10px 0 0">Target diusulkan Leader, dicek Keuangan, disahkan CEO di menu Unit Bisnis (Sistem Kerja). Selisih besar antara KKH dan buku berarti laporan tim atau pencatatan perlu dicek.</p></section>`;
}

/* ---------- Gaji (petugas lapangan) ---------- */
async function vGaji() {
  const G = await K.A.rpc('pk_fin_ops_payroll'), can = G.can, per = (p) => K.MONL[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4);
  const ST = { collecting: ['Disusun Operasional', 'p-info'], reviewed: ['Menunggu persetujuan', 'p-belum'], approved: ['Disetujui · belum dibayar', 'p-belum'], paid: ['Dibayar', 'p-lunas'] };
  const wait = G.pending.filter(x => x.run.status === 'reviewed'), pay = G.pending.filter(x => x.run.status === 'approved');
  return K.header('Gaji & klaim petugas', '') + `
    <div class="grid g4"><div class="sum a"><span>Menunggu persetujuan</span><b>${wait.length}</b><small>${K.rp(K.sum(wait, x => x.run.total))}</small></div><div class="sum"><span>Siap dibayar</span><b>${pay.length}</b><small>${K.rp(K.sum(pay, x => x.run.total))}</small></div>
      <div class="sum"><span>Reimburse & kasbon</span><b>${G.claims.length}</b><small>${K.rp(K.sum(G.claims, c => c.amount))}</small></div><div class="sum r"><span>Petugas tanpa gaji pokok</span><b>${G.comp.filter(c => !(+c.base || +c.daily)).length}</b><small>dari ${G.comp.length}</small></div></div>
    ${G.pending.map(P => { const r = P.run, I = P.items || []; return `<section class="card pad" style="margin-top:14px"><div class="ch"><h2>Gaji ${per(r.period)} <span class="pill ${ST[r.status][1]}">${ST[r.status][0]}</span></h2><span class="small mute">${I.length} orang · ${K.rp(r.total)}</span></div>
      <div class="tw"><table class="tbl cards"><thead><tr><th>Nama</th><th>Kehadiran</th><th class="r">Pokok</th><th class="r">Komisi</th><th class="r">Lembur</th><th class="r">Reimburse</th><th class="r">Potongan</th><th class="r">Diterima</th></tr></thead><tbody>
      ${I.map(x => `<tr><td data-m="full"><b>${K.esc(x.name)}</b></td><td class="small mute" data-m="hide">${K.esc(x.attendance || '')}</td><td class="r" data-m="hide">${K.num(x.base)}</td><td class="r" data-m="hide">${K.num(x.commission)}</td><td class="r" data-m="hide">${K.num(x.overtime)}</td><td class="r" data-m="hide">${K.num(x.reimburse)}</td><td class="r neg" data-m="hide">${K.num(-(+x.advance + +x.shortage + +x.late_fine))}</td><td class="r b" data-m="right">${K.num(x.net)}</td></tr>`).join('')}</tbody></table></div>
      ${can ? `<div class="foot" style="justify-content:flex-start">${r.status === 'reviewed' ? `<button class="btn pri" data-gx="ok" data-run="${r.id}">Setujui gaji</button><button class="btn" data-gx="back" data-run="${r.id}">Kembalikan ke Operasional</button>` : r.status === 'approved' ? `<input class="inp" type="date" id="gd-${r.id}" value="${K.today()}" style="width:160px"><button class="btn pri" data-gx="paid" data-run="${r.id}">Tandai sudah dibayar</button>` : ''}</div>` : ''}</section>`; }).join('') || '<section class="card pad" style="margin-top:14px"><p class="mute" style="margin:0">Tidak ada gaji yang menunggu.</p></section>'}
    <section class="card pad" style="margin-top:14px"><h2>Reimburse & kasbon menunggu Keuangan</h2>${G.claims.length ? `<table class="tbl"><tbody>${G.claims.map(c => `<tr><td><b>${K.esc(c.nick)} · ${c.kind === 'kasbon' ? 'Kasbon' : 'Reimburse'}</b><div class="small mute">${K.tgl(c.day)} · ${K.esc(c.category || '')} ${K.esc(c.note || '')}</div></td><td class="r b">${K.rp(c.amount)}</td><td class="r" style="white-space:nowrap">${c.photo ? `<a class="btn sm" target="_blank" rel="noopener" href="${K.esc(c.photo)}">Nota</a> ` : ''}${can ? `<button class="btn sm pri" data-gx="cok" data-cid="${c.id}">Setujui</button> <button class="btn sm" data-gx="cno" data-cid="${c.id}">Tolak</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="mute small" style="margin:0">Tidak ada.</p>'}</section>
    <section class="card pad" style="margin-top:14px"><h2>Riwayat</h2><table class="tbl"><tbody>${G.runs.map(r => `<tr><td>${per(r.period)}<div class="small mute">${r.n} orang${r.paid_at ? ' · dibayar ' + K.tgl(r.paid_at) : ''}</div></td><td class="r b">${K.rp(r.total)}</td><td class="r"><span class="pill ${ST[r.status][1]}">${ST[r.status][0]}</span></td></tr>`).join('') || '<tr><td class="mute">Belum ada.</td></tr>'}</tbody></table>
      <p class="small mute" style="margin:10px 0 0">Gaji pokok petugas diatur di <a href="/keuangan#gajiops">Panel Keuangan › Gaji & klaim petugas</a>.</p></section>`;
}

/* ---------- Persetujuan (antrean pengecualian) ---------- */
async function vPersetujuan() {
  const [E, AC] = await Promise.all([K.A.rpc('pk_fin_exceptions'), K.accounts()]), w = K.canWrite();
  const opts = (pre) => AC.filter(a => !pre || pre.includes(a.code[0])).map(a => `<option value="${a.code}">${a.code} · ${K.esc(a.name)}</option>`).join('');
  return K.header('Persetujuan & antrean', '') + `<p class="mute" style="margin:-8px 0 14px">Hanya yang butuh keputusan manusia. Sekali dipetakan, transaksi serupa berikutnya dibukukan otomatis.</p>
    <div class="grid g4"><div class="sum r"><span>Akun belum dipetakan</span><b>${E.keys.length}</b><small>${K.sum(E.keys, k => k.n)} transaksi tertahan</small></div><div class="sum a"><span>Nilai tertahan</span><b>${K.rp(K.sum(E.keys, k => k.amt))}</b><small>belum masuk laporan</small></div>
      <div class="sum a"><span>Transaksi gagal</span><b>${E.events.length}</b><small>coba ulang / abaikan</small></div><div class="sum"><span>Mutasi bank belum dikenali</span><b>${E.bank.length}</b><small>${K.rp(K.sum(E.bank, b => Math.abs(b.amount)))}</small></div></div>
    <section class="card pad" style="margin-top:14px"><h2>1 · Akun belum dipetakan</h2>${E.keys.length ? E.keys.map(k => `<div class="qrow"><div><b><code>${K.esc(k.key)}</code> · ${k.n} transaksi · ${K.rp(k.amt)}</b><div class="small mute">${K.esc(k.error)} · contoh ${K.esc(k.sample)}</div></div>${w ? `<select class="inp" data-mapacc="${K.esc(k.key)}"><option value="">Pilih akun…</option>${opts(k.key.startsWith('rev') ? '47' : k.key.startsWith('exp') || k.key.startsWith('cogs') ? '568' : '')}</select><button class="btn sm pri" data-qmap="${K.esc(k.key)}">Simpan</button>` : ''}</div>`).join('') : '<p class="ok">✓ Semua kategori sudah punya akun.</p>'}</section>
    <section class="card pad" style="margin-top:14px"><h2>2 · Transaksi gagal dibukukan</h2>${E.events.length ? `<div class="tw"><table class="tbl cards"><thead><tr><th>Tanggal</th><th>Sumber</th><th>Transaksi</th><th class="r">Nilai</th><th>Sebab</th><th></th></tr></thead><tbody>${E.events.map(e => `<tr><td data-m="hide">${K.tgl(e.date)}</td><td>${K.esc(K.SRC[e.source] || e.source)}</td><td data-m="full"><b>${K.esc(e.ext)}</b><div class="small mute">${K.esc(e.memo || e.type)} · ${K.esc(K.uname(e.unit))}</div></td><td class="r" data-m="right">${K.rp(e.amount)}</td><td class="small" data-m="full">${K.esc(e.error)}</td><td style="white-space:nowrap" data-m="full">${w ? `<button class="btn sm" data-qretry="${K.esc(e.id)}">Coba lagi</button> <button class="btn sm" data-qign="${K.esc(e.id)}">Abaikan</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ok">✓ Tidak ada transaksi gagal.</p>'}</section>
    <section class="card pad" style="margin-top:14px"><h2>3 · Mutasi bank belum dikenali</h2>${E.bank.length ? `<div class="tw"><table class="tbl cards"><thead><tr><th>Tanggal</th><th>Rekening</th><th>Keterangan</th><th class="r">Jumlah</th>${w ? '<th>Akun lawan</th><th>Kata kunci</th><th></th>' : ''}</tr></thead><tbody>${E.bank.map(b => `<tr><td data-m="hide">${K.tgl(b.date)}</td><td class="small">${K.esc(b.acc_name)}</td><td class="small" data-m="full">${K.esc(b.desc)}</td><td class="r ${b.amount < 0 ? 'neg' : ''}" data-m="right">${K.num(b.amount)}</td>
      ${w ? `<td data-m="full"><select class="inp" data-bacc="${K.esc(b.id)}"><option value="">Pilih…</option>${opts(b.amount > 0 ? '1247' : '12568')}</select></td><td data-m="full"><input class="inp" data-bpat="${K.esc(b.id)}" placeholder="opsional"></td><td style="white-space:nowrap" data-m="full"><button class="btn sm pri" data-qbok="${K.esc(b.id)}" data-unit="${K.esc(b.unit || '')}">Bukukan</button> <button class="btn sm" data-qbign="${K.esc(b.id)}">Abaikan</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="ok">✓ Semua mutasi sudah dikenali.</p>'}</section>
    <section class="card pad" style="margin-top:14px"><h2>Persetujuan belanja (RAB)</h2><p class="small mute" style="margin:0">Pengajuan belanja, LPJ, dan nota disetujui berjenjang di <a href="/#/belanja">Sistem Kerja › Pengajuan Belanja</a>. Setelah cair, jurnalnya otomatis masuk ke buku ini.</p></section>`;
}

/* ---------- Integrasi & tutup buku ---------- */
async function vIntegrasi() {
  const t = K.today(), Dd = await K.A.rpc('pk_fin_dashboard', { p_from: t.slice(0, 8) + '01', p_to: t }), w = K.canWrite(), ceo = K.ME().role === 'ceo';
  const ago = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : null;
  const ext = [['Rentalaja App', 'rentalaja', 'Booking, pembayaran, deposit, servis unit, bagi hasil mitra'], ['TripinAja', 'tripinaja', 'Paket tour & open trip lewat API'], ['Niagaaja', 'niagaaja', 'Penjualan laptop & barang lewat API'],
    ['Sistem Kerja Pokama', 'pokama', 'RAB, LPJ, gaji staf'], ['Mutasi bank', 'bank', 'Impor CSV mutasi BCA/Mandiri/BRI'], ['Buku Keuangan', 'biaya', 'Biaya, kas & bank, penjualan, pembelian, stok, aset']];
  const S = Dd.sources || [];
  return K.header('Integrasi & tutup buku', '') + `
    <div class="grid g3">${ext.map(([n, c, d]) => { const s = S.find(x => x.code === c) || (c === 'biaya' ? { active: true, kind: 'sistem' } : {}); const a = ago(s.last); const st = !s.active ? ['Belum tersambung', 'p-batal'] : a != null && a >= 2 && s.kind !== 'sistem' ? ['Diam ' + a + ' hari', 'p-belum'] : ['Tersambung', 'p-lunas'];
      return `<div class="card pad intg"><div class="h"><b>${n}</b><span class="pill ${st[1]}">${st[0]}</span></div><p class="small mute">${d}</p><div class="small">${s.n30 != null ? `${(+s.n30).toLocaleString('id-ID')} transaksi 30 hari${s.gagal ? ` · <span class="neg b">${s.gagal} gagal</span>` : ''}` : ''}</div>
        ${w && s.kind === 'website' ? `<button class="btn sm" data-qkey="${c}" style="margin-top:8px">${s.has_key ? 'Ganti kunci API' : 'Buat kunci API'}</button>` : ''}</div>`; }).join('')}</div>
    <div class="banner info" style="margin-top:14px">Rentalaja App masih mencatat di pembukuannya sendiri sampai tanggal pindah buku. Rencana lengkapnya ada di dokumen project "rencana-cutover-keuangan".</div>
    <section class="card pad" style="margin-top:14px"><h2>Tutup buku</h2><p class="small mute" style="margin:-6px 0 10px">Bulan terkunci tidak menerima jurnal baru; jurnal yang masuk otomatis pindah ke bulan terbuka berikutnya. Membuka lagi hanya oleh CEO.</p>
      <table class="tbl"><tbody>${[...(Dd.periods || [])].reverse().map((p, i) => `<tr><td><b>${K.MONL[+p.m.slice(5) - 1]} ${p.m.slice(0, 4)}</b><div class="small mute">${i === 0 ? 'bulan berjalan' : p.status === 'locked' ? 'laporan final' : 'angka masih bisa berubah'}</div></td>
        <td>${p.status === 'locked' ? '<span class="pill p-lunas">Terkunci</span>' : i === 0 ? '<span class="pill p-info">Berjalan</span>' : '<span class="pill p-belum">Terbuka</span>'}</td>
        <td class="r">${w && i > 0 ? (p.status === 'locked' ? (ceo ? `<button class="btn sm" data-qunlock="${p.m}">Buka lagi</button>` : '') : `<button class="btn sm pri" data-qlock="${p.m}">Tutup buku</button>`) : ''}</td></tr>`).join('')}</tbody></table></section>`;
}

/* ---------- Laporan (indeks) ---------- */
function vLaporan() {
  const R = [['#labarugi', 'pl', 'Laba Rugi', 'Pendapatan, HPP, beban, laba; per unit bisnis dan dibanding periode lalu.'], ['#neraca', 'bs', 'Neraca', 'Aset, kewajiban, ekuitas per tanggal.'], ['#aruskas', 'cash', 'Arus Kas', 'Uang masuk & keluar per aktivitas.'],
    ['#bukubesar', 'jurnal', 'Buku Besar', 'Transaksi satu akun dengan saldo berjalan.'], ['#jurnal', 'akun', 'Jurnal Umum', 'Semua jurnal dari semua sumber.'], ['#pajak', 'biaya', 'Pajak', 'PPN keluaran/masukan dan PPh dipotong.'],
    ['#aset', 'aset', 'Daftar Aset Tetap', 'Perolehan, akumulasi penyusutan, nilai buku.'], ['#stok', 'stok', 'Persediaan', 'Stok & nilai persediaan per produk.'], ['/keuangan#pihak', 'wallet', 'Umur Hutang & Piutang', 'Per pihak, dikelompokkan umur.'],
    ['/keuangan#unit', 'dash', 'Kinerja Unit Bisnis', 'Setelah biaya holding.'], ['/keuangan#proyeksi', 'pl', 'Proyeksi Kas 13 Minggu', 'Dari kewajiban & cicilan.'], ['/keuangan#pf', 'pl', 'Profit First', 'Pembagian kas per pos.']];
  return K.header('Laporan') + `<div class="grid g3">${R.map(([h, ic, t, d]) => `<a class="card rep" href="${h}"><span class="ic">${K.svg(ic, 20)}</span><span><b>${t}</b><small>${d}</small></span></a>`).join('')}</div>`;
}

/* ---------- daftar tampilan & aksi ---------- */
export const views = {
  dasbor: () => vDasbor(),
  jual: (a) => a === 'baru' ? vDocNew('jual') : a ? vDocDetail('jual', a) : vDocList('jual'),
  beli: (a) => a === 'baru' ? vDocNew('beli') : a ? vDocDetail('beli', a) : vDocList('beli'),
  stok: (a) => a ? vProduk(a) : vStok(), aset: () => vAset(), pajak: () => vPajak(),
  labarugi: () => vLabaRugi(), neraca: () => vNeraca(), aruskas: () => vArusKas(), jurnal: () => vJurnal(),
  anggaran: () => vAnggaran(), gaji: () => vGaji(), persetujuan: () => vPersetujuan(), integrasi: () => vIntegrasi(), laporan: () => vLaporan(),
};
export function after(v, a) { if ((v === 'jual' || v === 'beli') && a === 'baru') wireDocForm(); }
const T = {};
export function onInput(e) {
  const t = e.target, deb = (k, fn) => { clearTimeout(T[k]); T[k] = setTimeout(fn, 350); };
  if (t.matches('[data-dq]')) { deb('dq', () => { DS[t.dataset.dq].q = t.value.trim(); K.rerender('[data-dq]'); }); return true; }
  if (t.matches('[data-pq]')) { deb('pq', () => { PS.q = t.value.trim(); K.rerender('[data-pq]'); }); return true; }
  if (t.matches('[data-aq]')) { deb('aq', () => { AS.q = t.value.trim(); K.rerender('[data-aq]'); }); return true; }
  if (t.matches('[data-jq]')) { deb('jq', () => { JS.q = t.value.trim(); K.rerender('[data-jq]'); }); return true; }
  return false;
}
export function onChange(e) {
  const t = e.target;
  if (t.matches('[data-rbiz]')) { RS.biz = t.value; K.render(); return true; }
  if (t.matches('[data-rcmp]')) { RS.cmp = t.checked; K.render(); return true; }
  if (t.matches('[data-jsrc]')) { JS.src = t.value; K.render(); return true; }
  return false;
}
const act = async (fn) => { try { await fn(); } catch (err) { K.toast(err.message, true); } };
export function onClick(e) {
  const g = (s) => e.target.closest(s), r = K.route();
  let x;
  if ((x = g('[data-dst]'))) { e.preventDefault(); const [k, s] = x.dataset.dst.split(':'); DS[k].st = s; if (location.hash !== '#' + k) location.hash = '#' + k; else K.render(); return true; }
  if ((x = g('[data-ptab]'))) { e.preventDefault(); PS.tab = x.dataset.ptab; if (location.hash !== '#stok') location.hash = '#stok'; else K.render(); return true; }
  if ((x = g('[data-atab]'))) { e.preventDefault(); AS.tab = x.dataset.atab; K.render(); return true; }
  if ((x = g('[data-dpay]'))) { docPay(x.dataset.dpay, r.a); return true; }
  if (g('[data-dvoid]')) { reasonPanel('Batalkan dokumen', 'Jurnal, pembayaran, dan mutasi stok dokumen ini dibalik pada tanggal hari ini.', 'Batalkan', async (why) => { await K.A.rpc('pk_fin_doc_void', { p_id: r.a, p_reason: why }); PRODS = null; K.toast('Dokumen dibatalkan'); }); return true; }
  if (g('[data-share]')) { act(async () => { const d = await K.A.rpc('pk_fin_doc_get', { p_id: r.a }); const txt = `Halo ${d.party},\n\nBerikut tagihan ${d.code} dari ${(d.company || {}).name || 'Pokama'}:\n${d.lines.map(l => `• ${l.product_name || l.memo || l.name} × ${K.num(l.qty)} = ${K.rp(l.amount)}`).join('\n')}\n\nTotal: ${K.rp(d.total)}${+d.paid ? `\nSudah dibayar: ${K.rp(d.paid)}\nSisa: ${K.rp(d.total - d.paid)}` : ''}\nJatuh tempo: ${K.tgl(d.due_date)}\n\nTerima kasih.`; await navigator.clipboard.writeText(txt); K.toast('Teks tagihan disalin'); }); return true; }
  if ((x = g('[data-prod]'))) { prodPanel(x.dataset.prod || null); return true; }
  if ((x = g('[data-adj]'))) { adjPanel(x.dataset.adj || null); return true; }
  if (g('[data-aset]')) { asetPanel(null); return true; }
  if ((x = g('[data-aedit]'))) { asetPanel(x.dataset.aedit); return true; }
  if (g('[data-aimport]')) { act(async () => { const res = await K.A.rpc('pk_fin_asset_import_units'); K.toast(res.added + ' unit didaftarkan sebagai aset tetap'); K.render(); }); return true; }
  if (g('[data-adepr]')) { act(async () => { const res = await K.A.rpc('pk_fin_depr_run', { p_month: K.today().slice(0, 8) + '01' }); K.toast(res.n ? `Penyusutan ${res.n} aset · ${K.rp(res.total)} · ${res.entry}` : 'Tidak ada aset yang perlu disusutkan'); K.render(); }); return true; }
  if ((x = g('[data-rcsv]'))) { act(async () => { const [f, t] = K.range(), P = await K.A.rpc('pk_fin_pl', { p_from: f, p_to: t }); K.csvDl(`laba-rugi_${f}_${t}.csv`, [['Akun', 'Nama', 'Unit', 'Unit bisnis', 'Jumlah']].concat(P.filter(p => !RS.biz || p.biz === RS.biz).map(p => [p.acc, p.name, K.uname(p.unit), K.BIZN[p.biz] || p.biz, p.amt]))); }); return true; }
  if ((x = g('[data-gx]'))) { const d = x.dataset;
    if (d.gx === 'ok') act(async () => { await K.A.rpc('pk_fin_ops_payroll_decide', { p_run: d.run, p_ok: true, p_note: null }); K.toast('Gaji disetujui'); K.render(); });
    if (d.gx === 'back') reasonPanel('Kembalikan ke Operasional', 'Operasional akan memperbaiki lalu mengajukan ulang.', 'Kembalikan', async (n) => { await K.A.rpc('pk_fin_ops_payroll_decide', { p_run: d.run, p_ok: false, p_note: n }); K.toast('Dikembalikan'); });
    if (d.gx === 'paid') act(async () => { const dt = (document.getElementById('gd-' + d.run) || {}).value; await K.A.rpc('pk_fin_ops_payroll_paid', { p_run: d.run, p_date: dt || null }); K.toast('Tercatat dibayar · jurnal gaji dibuat'); K.render(); });
    if (d.gx === 'cok') act(async () => { await K.A.rpc('pk_fin_ops_claim_decide', { p_id: d.cid, p_ok: true, p_note: null }); K.toast('Disetujui'); K.render(); });
    if (d.gx === 'cno') reasonPanel('Tolak klaim', 'Petugas akan melihat alasannya.', 'Tolak', async (n) => { await K.A.rpc('pk_fin_ops_claim_decide', { p_id: d.cid, p_ok: false, p_note: n }); K.toast('Ditolak'); });
    return true; }
  if ((x = g('[data-qmap]'))) { const s = document.querySelector(`[data-mapacc="${CSS.escape(x.dataset.qmap)}"]`); if (!s.value) { K.toast('Pilih akun dulu', true); return true; } act(async () => { const res = await K.A.rpc('pk_fin_map_set', { p_key: x.dataset.qmap, p_account: s.value, p_note: null }); K.toast(res.terposting + ' transaksi dibukukan'); K.render(); }); return true; }
  if ((x = g('[data-qretry]'))) { act(async () => { const res = await K.A.rpc('pk_fin_event_retry', { p_id: x.dataset.qretry }); K.toast(res === 'terposting' ? 'Berhasil dibukukan' : 'Masih gagal: ' + res, res !== 'terposting'); K.render(); }); return true; }
  if ((x = g('[data-qign]'))) { const id = x.dataset.qign; reasonPanel('Abaikan transaksi', 'Transaksi tidak akan dibukukan.', 'Abaikan', async (n) => { await K.A.rpc('pk_fin_event_ignore', { p_id: id, p_note: n }); K.toast('Diabaikan'); }); return true; }
  if ((x = g('[data-qbok]'))) { const id = x.dataset.qbok, s = document.querySelector(`[data-bacc="${CSS.escape(id)}"]`), pt = document.querySelector(`[data-bpat="${CSS.escape(id)}"]`); if (!s.value) { K.toast('Pilih akun lawan', true); return true; } act(async () => { await K.A.rpc('pk_fin_bank_classify', { p_line: id, p_account: s.value, p_unit: x.dataset.unit || null, p_pattern: pt.value || null }); K.toast('Mutasi dibukukan'); K.render(); }); return true; }
  if ((x = g('[data-qbign]'))) { const id = x.dataset.qbign; reasonPanel('Abaikan mutasi', 'Mutasi tidak dibukukan.', 'Abaikan', async (n) => { await K.A.rpc('pk_fin_bank_ignore', { p_line: id, p_note: n }); K.toast('Diabaikan'); }); return true; }
  if ((x = g('[data-qkey]'))) { const c = x.dataset.qkey; act(async () => { const res = await K.A.rpc('pk_fin_source_key', { p_code: c }); K.panel(`<div class="ph2"><h2>Kunci API ${K.esc(c)}</h2><button class="x" data-close aria-label="Tutup">×</button></div><p>${K.esc(res.note || 'Simpan sekarang; kunci ini tidak ditampilkan lagi. Kunci lama tidak berlaku.')}</p><code style="word-break:break-all;padding:12px;background:var(--bg);border-radius:8px">${K.esc(res.key)}</code><div class="foot"><button class="btn pri" data-close>Sudah disimpan</button></div>`); }); return true; }
  if ((x = g('[data-qlock]'))) { const m = x.dataset.qlock; act(async () => { await K.A.rpc('pk_fin_period_set', { p_month: m + '-01', p_lock: true }); K.toast('Buku ' + m + ' ditutup'); K.render(); }); return true; }
  if ((x = g('[data-qunlock]'))) { const m = x.dataset.qunlock; reasonPanel('Buka lagi ' + m, 'Laporan bulan itu bisa berubah lagi.', 'Buka buku', async () => { await K.A.rpc('pk_fin_period_set', { p_month: m + '-01', p_lock: false }); K.toast('Buku dibuka lagi'); }); return true; }
  return false;
}

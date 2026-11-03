/* Data tiruan khusus uji di localhost. Tidak pernah dimuat di app.pokama.org. */
(function () {
  var ACC = [
    ['1-10001', 'Kas Garut Kota', 'aset', true, 'GK'], ['1-10002', 'Kas Wanaraja', 'aset', true, 'WN'], ['1-10003', 'Kas Bandung', 'aset', true, 'BD'],
    ['1-10011', 'Bank Operasional', 'aset', true, 'RA', 'BCA'], ['1-10012', 'Bank Profit', 'aset', true, 'RA', 'BCA'], ['1-10033', 'Kas TripinAja', 'aset', true, 'WG'],
    ['1-10051', 'Bank Operasional Holding', 'aset', true, 'HQ', 'Mandiri'], ['1-10100', 'Piutang usaha', 'aset', false], ['1-10200', 'Persediaan part', 'aset', false],
    ['2-20100', 'Hutang usaha', 'kewajiban', false], ['2-20400', 'Hutang pajak', 'kewajiban', false], ['3-30000', 'Modal disetor', 'ekuitas', false],
    ['4-40001', 'Pendapatan sewa Hub', 'pendapatan', false], ['5-50002', 'Servis dan part', 'hpp', false], ['6-60003', 'Listrik, air, dan internet', 'beban', false],
    ['6-60004', 'Iklan dan konten', 'beban', false], ['6-60005', 'Bensin dan transport', 'beban', false], ['6-60009', 'Konsumsi', 'beban', false], ['7-70005', 'Pendapatan lain-lain', 'pendapatan_lain', false],
  ].map(function (a) { return { code: a[0], name: a[1], grp: a[2], is_cash: a[3], unit_code: a[4] || null, bank: a[5] || null, pos: null }; });
  var UNITS = [['HQ', 'Holding', null], ['RA', 'Rentalaja', null], ['GK', 'Garut Kota', 'RA'], ['WN', 'Wanaraja', 'RA'], ['BD', 'Bandung', 'RA'], ['EX', 'Experience', 'RA'], ['WG', 'TripinAja', null], ['NA', 'Niagaaja', null]]
    .map(function (u, i) { return { code: u[0], name: u[1], parent: u[2], sort: i }; });
  var EX = [
    ['BY2611-00007', '2026-11-03', 'Bengkel Motor Jaya', 'Ganti ban & kampas rem MTR-0020', 'Servis dan part', 'GK', 'lunas', 385000, 0],
    ['BY2611-00006', '2026-11-02', 'PLN', 'Listrik kantor Garut', 'Listrik, air, dan internet', 'GK', 'lunas', 742500, 0],
    ['BY2611-00005', '2026-11-02', 'CV Kreasi Iklan', 'Boost Instagram November', 'Iklan dan konten', 'MKT', 'belum', 1500000, 1500000, '2026-12-02'],
    ['BY2610-00004', '2026-10-15', 'Toko Sparepart Abadi', 'Oli & filter 20 motor', 'Servis dan part', 'GK', 'telat', 2240000, 2240000, '2026-10-30'],
    ['BY2611-00003', '2026-11-01', 'SPBU Tarogong', 'Bensin antar-jemput unit', 'Bensin dan transport', 'WN', 'lunas', 210000, 0],
    ['BY2611-00002', '2026-11-01', 'Warung Bu Imas', 'Konsumsi rapat bulanan', 'Konsumsi', 'HQ', 'lunas', 450000, 0],
    ['BY2610-00001', '2026-10-28', 'Indihome', 'Internet Oktober', 'Listrik, air, dan internet', 'BD', 'batal', 385000, 0],
  ].map(function (x, i) { return { id: 'e' + i, code: x[0], date: x[1], party: x[2], memo: x[3], accs: x[4], unit: x[5], status: x[6], total: x[7], tax: 0, paid: x[7] - x[8], owe: x[8], due: x[9] || null, ref_no: null }; });
  var CS = [['1-10001', 2350000, 4200000, 2850000], ['1-10002', 820000, 950000, 410000], ['1-10003', 1640000, 2100000, 1300000], ['1-10011', 96200000, 58400000, 41200000],
    ['1-10012', 61500000, 12000000, 0], ['1-10033', 740000, 1200000, 980000], ['1-10051', 18700000, 25000000, 31300000]].map(function (c) {
      var a = ACC.find(function (x) { return x.code === c[0]; }); return { code: c[0], name: a.name, unit: a.unit_code, bank: a.bank, bal: c[1], in: c[2], out: c[3], bank_bal: c[0] === '1-10011' ? 96450000 : null, unmatched: c[0] === '1-10011' ? 4 : 0 };
    });
  function wait(v) { return new Promise(function (ok) { setTimeout(function () { ok(JSON.parse(JSON.stringify(v))); }, 60); }); }
  var R = {
    pk_fin_expense_list: function (a) {
      var t = '2026-11-04', rows = EX.filter(function (e) { return e.date >= a.p_from && e.date <= a.p_to && (!a.p_status || e.status === a.p_status || (a.p_status === 'belum' && e.status === 'telat')) && (!a.p_q || (e.code + e.party + e.memo).toLowerCase().indexOf(a.p_q.toLowerCase()) >= 0); });
      var b = EX.filter(function (e) { return e.status === 'belum' || e.status === 'telat'; }), tl = EX.filter(function (e) { return e.status === 'telat'; });
      return { rows: rows, sum: { belum: b.reduce(function (s, e) { return s + e.owe; }, 0), n_belum: b.length, telat: tl.reduce(function (s, e) { return s + e.owe; }, 0), n_telat: tl.length, lunas30: 1787500, n_lunas30: 4, bulan: 3287500 } };
    },
    pk_fin_expense_get: function (a) {
      var e = EX.find(function (x) { return x.id === a.p_id; }) || EX[0];
      return { id: e.id, code: e.code, doc_date: e.date, due_date: e.due, unit_code: e.unit, party: e.party, memo: e.memo, status: e.status === 'telat' ? 'belum' : e.status, total: e.total, tax: 0, paid: e.paid,
        pay_name: e.owe ? null : 'Kas Garut Kota', ref_no: 'NOTA-118', proof_url: 'https://drive.google.com/x', void_reason: e.status === 'batal' ? 'Salah input, dobel' : null,
        lines: [{ acc: '5-50002', name: e.accs, memo: e.memo, unit: e.unit, amount: e.total - 60000, asset_no: 'MTR-0020', asset_name: 'GRT-012 · Z 4810 DBY' }, { acc: '6-60005', name: 'Bensin dan transport', memo: 'Ongkir part', unit: e.unit, amount: 60000 }],
        journal: [{ code: 'JP2611-00018', date: e.date, memo: 'Biaya ' + e.code + ' · ' + e.party, lines: [{ acc: '5-50002', name: 'Servis dan part', d: e.total - 60000, c: 0 }, { acc: '6-60005', name: 'Bensin dan transport', d: 60000, c: 0 }, { acc: e.owe ? '2-20100' : '1-10001', name: e.owe ? 'Hutang usaha' : 'Kas Garut Kota', d: 0, c: e.total }] }] };
    },
    pk_fin_cash_summary: function () { return CS; },
    pk_fin_balances: function () { return ACC.map(function (a, i) { var c = CS.find(function (x) { return x.code === a.code; }); return { code: a.code, name: a.name, grp: a.grp, is_cash: a.is_cash, unit: a.unit_code, bal: c ? c.bal : (i * 731000 % 9000000), n: 3 }; }); },
    pk_fin_ledger: function (a) {
      var acc = ACC.find(function (x) { return x.code === a.p_acc; }) || ACC[0], run = 1500000, rows = [];
      [['2026-11-01', 'TF2611-00001', 'Isi kas dari Bank Operasional', 'kasbank', 2000000, 0], ['2026-11-01', 'BY2611-00003', 'Bensin antar-jemput unit', 'biaya', 0, 210000], ['2026-11-02', 'BY2611-00006', 'Listrik kantor Garut', 'biaya', 0, 742500], ['2026-11-03', 'BY2611-00007', 'Ganti ban & kampas rem', 'biaya', 0, 385000], ['2026-11-03', 'TD2611-00008', 'Setoran denda pelanggan', 'kasbank', 150000, 0]]
        .forEach(function (r, i) { run += r[4] - r[5]; rows.push({ id: 'j' + i, code: 'JP2611-0001' + i, date: r[0], ref: r[1], memo: r[2], source: r[3], d: r[4], c: r[5], run: run, party: null }); });
      return { acc: acc, opening: 1500000, rows: rows };
    },
    pk_fin_asset_pick: function () { return [{ id: 'u1', no: 'MTR-0020', label: 'MTR-0020 · GRT-012 · Z 4810 DBY' }, { id: 'u2', no: 'MTR-0021', label: 'MTR-0021 · GRT-013 · Z 4812 DBY' }]; },
    pk_fin_expense_save: function () { return { id: 'e0', code: 'BY2611-00008' }; },
  };
  window.__bukuMock = {
    get: function (p) { return wait(p.indexOf('pk_units') === 0 ? UNITS : ACC); },
    rpc: function (n, a) { if (!R[n]) return Promise.reject(new Error('Fungsi ' + n + ' tidak ada di data uji')); return wait(R[n](a || {})); },
  };
})();

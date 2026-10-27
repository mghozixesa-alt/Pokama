import { ctx, db, esc, today, addDays, fdate, fmonth, monthStart, weekStart, avatar, nick, modal, field, opts, toast, unitName, isFin, isAdmin, isCeo, need, chip, logo, rp, jt, num } from '../core.js';

const stOf = (p) => p >= 1 ? ['Tercapai', 'green', '#09BEAF'] : p >= .9 ? ['Aman', 'green', '#09BEAF'] : p >= .75 ? ['Diawasi', 'yellow', '#D99A00'] : ['Perlu evaluasi', 'red', '#C2410C'];
const nextMonth = (m) => { const d = new Date(m + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };

export default async function unit(el, params, reload) {
  const me = ctx.me.id; const m = params.get('m') || monthStart(today()); const nm = nextMonth(m);
  const end = addDays(nm, -1); const wk = weekStart(today());
  const bizUnits = ctx.units.filter(u => u.kind === 'bisnis' && u.in_liga);
  const lines = (code) => ctx.units.filter(u => u.parent === code);
  const [omzet, targets, liga, todayRows] = await Promise.all([
    db.get('pk_omzet', `select=unit_code,day,amount&day=gte.${m}&day=lte.${end}`),
    db.get('pk_targets', `select=*&month=in.(${m},${nm})`),
    db.get('pk_liga', `select=*&order=week_start.desc&limit=60`),
    db.get('pk_omzet', `select=*&day=eq.${today()}&order=created_at.desc`),
  ]);
  const sumOm = (codes) => omzet.filter(o => codes.includes(o.unit_code)).reduce((s, o) => s + +o.amount, 0);
  const tgt = (code, mon) => targets.find(t => t.unit_code === code && t.month === mon);
  const latestWeek = liga.length ? liga[0].week_start : null;
  const prevWeek = latestWeek ? addDays(latestWeek, -7) : null;
  const pts = (code, w) => { const r = liga.find(x => x.unit_code === code && x.week_start === w); return r ? r.kas + r.profit + r.kapasitas + r.growth : null; };
  const cards = bizUnits.map(u => {
    const codes = [u.code, ...lines(u.code).map(l => l.code)];
    const a = sumOm(codes);
    const lt = lines(u.code).map(l => tgt(l.code, m)).filter(Boolean);
    const t = tgt(u.code, m) ? +tgt(u.code, m).amount : lt.reduce((s, x) => s + +x.amount, 0);
    return { u, a, t, p: pts(u.code, latestWeek), pp: pts(u.code, prevWeek), lines: lines(u.code).map(l => ({ l, a: sumOm([l.code]), t: tgt(l.code, m) ? +tgt(l.code, m).amount : 0 })) };
  }).sort((x, y) => (y.p ?? -1) - (x.p ?? -1));
  const lead = (code) => ctx.people.find(p => p.role === 'leader' && (p.unit_code === code || (ctx.unit[p.unit_code] || {}).parent === code));
  const grpA = cards.reduce((s, c) => s + c.a, 0), grpT = cards.reduce((s, c) => s + c.t, 0);
  const reporters = ctx.units.filter(u => ['WG', 'NL', 'NJ', 'MP', 'EX', 'JP', 'GK', 'BD', 'WN', 'CP'].includes(u.code));
  const lw = ctx.settings.liga_weights || { kas: 35, profit: 30, kapasitas: 20, growth: 15 };
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">${latestWeek ? 'Poin Liga minggu ' + fdate(latestWeek, false) : 'Poin Liga belum diisi'} · omzet ${fmonth(m)}</span><h1>Unit Bisnis</h1></div>
    <div class="row gap"><input type="month" class="inp" id="mpick" value="${m.slice(0, 7)}">${isFin() || isAdmin() ? '<button class="btn" data-a="liga">Isi poin Liga</button>' : ''}<button class="btn pri" data-a="lapor">+ Lapor omzet hari ini</button></div></header>
  <div class="ucards">${cards.map((c, i) => { const p = c.t ? c.a / c.t : null; const s = p !== null ? stOf(p) : null; const L = lead(c.u.code); const tn = tgt(c.u.code, nm);
    return `<section class="card ucard${i === 0 && c.p !== null ? ' first' : ''}">
      <div class="row gap"><span class="rank">#${i + 1}</span>${logo(c.u.code, 46)}<span style="flex:1"><b class="big">${esc(c.u.name)}</b><small class="row gap6">${L ? avatar(L.id, 20) + ' Leader ' + esc(L.nickname || L.name) : 'Gabungan ' + c.lines.length + ' lini'}</small></span>
        <span class="r"><b class="lpts">${c.p ?? '—'}</b><small class="${c.pp !== null && c.p > c.pp ? 'green-t' : c.pp !== null && c.p < c.pp ? 'red' : 'muted'}">${c.p === null ? 'poin Liga' : c.pp === null ? 'poin' : c.p > c.pp ? '▲ ' + (c.p - c.pp) : c.p < c.pp ? '▼ ' + (c.pp - c.p) : '– tetap'}</small></span></div>
      <div><div class="row between"><span class="lab">OMZET ${fmonth(m).toUpperCase()}</span>${s ? chip(s[0], s[1]) : chip('Target belum ada')}</div>
        <div class="row between"><b class="big">${jt(c.a)}</b><span class="muted small">${c.t ? 'dari ' + jt(c.t) + ' · <b>' + Math.round(p * 100) + '%</b>' : 'target belum disahkan'}</span></div>
        <span class="bar lg"><i style="width:${p ? Math.min(100, p * 100) : 0}%;background:${s ? s[2] : '#C9CED6'}"></i></span></div>
      ${c.lines.length ? `<div class="mini">${c.lines.map(x => { const q = x.t ? x.a / x.t : null; const ss = q !== null ? stOf(q) : null;
        return `<div><span>${esc(x.l.name)}</span><span class="bar"><i style="width:${q ? Math.min(100, q * 100) : 0}%;background:${ss ? ss[2] : '#C9CED6'}"></i></span><b class="${q !== null && q < .75 ? 'red' : ''}">${q !== null ? Math.round(q * 100) + '%' : jt(x.a)}</b></div>`; }).join('')}</div>` : ''}
      <div><span class="lab">KPI UTAMA</span><b>${esc(c.u.kpi || '—')}</b></div>
      <div class="tbox"><div class="row between small"><span class="lab">TARGET ${fmonth(nm).toUpperCase()}</span><span class="${tn ? 'green-t' : 'red'}">${tn ? { usulan: 'Diusulkan', dicek: 'Dicek Keuangan', sah: 'Disahkan CEO' }[tn.status] : 'Belum diisi'}</span></div>
        ${tn ? `<div class="row between"><b>${rp(tn.amount)}</b>${isFin() && tn.status === 'usulan' ? `<button class="btn sm" data-ts="${tn.id}" data-s="dicek">Tandai dicek</button>` : ''}${isCeo() && tn.status !== 'sah' ? `<button class="btn sm pri" data-ts="${tn.id}" data-s="sah">Sahkan</button>` : ''}</div>` : ''}
        ${!tn || tn.status === 'usulan' ? `<div class="row gap"><span class="pre grow"><b>Rp</b><input class="inp-n" data-tin="${c.u.code}" inputmode="numeric" placeholder="${c.a ? Math.round(c.a * 1.05).toLocaleString('id-ID') + ' (usulan AI +5%)' : 'isi target'}"></span><button class="btn sm pri" data-tp="${c.u.code}">${tn ? 'Ubah' : 'Usulkan'}</button></div>` : ''}</div>
    </section>`; }).join('')}</div>
  <div class="g2w">
    <section class="card"><div class="row between"><h2>Laporan omzet hari ini</h2><span class="muted small">ditutup 21.00</span></div>
      <div class="chips">${reporters.map(u => { const r = todayRows.find(x => x.unit_code === u.code); return `<span class="chip ${r ? 'green' : 'red'}">${esc(u.name)} · ${r ? jt(r.amount) : 'belum'}</span>`; }).join('')}</div>
      <p class="small muted">Total grup ${fmonth(m)}: <b>${jt(grpA)}</b>${grpT ? ' dari target ' + jt(grpT) + ' (' + Math.round(grpA / grpT * 100) + '%)' : ''}. Target bulan depan diusulkan Leader di 3 hari kerja terakhir, dicek Keuangan, disahkan CEO.</p></section>
    <section class="card"><h2>Cara poin dihitung</h2><div class="chips">${Object.entries(lw).map(([k, v]) => `<span class="chip gray"><b>${v}</b> ${{ kas: 'Kas aman', profit: 'Laba', kapasitas: 'Rapi: KKH & aset', growth: 'Tumbuh' }[k]}</span>`).join('')}</div>
      <p class="small muted">Poin = seberapa dekat unit dengan targetnya sendiri, maksimal 100. Diisi Keuangan setiap minggu. Juara kuartal dapat faktor bonus 100%.</p></section></div>`;

  el.querySelector('#mpick').onchange = (e) => { location.hash = '#/unit?m=' + e.target.value + '-01'; };
  el.onclick = async (e) => {
    try {
      const a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'lapor') {
        const r = await modal('Lapor omzet hari ini', `<div class="g2">` + field('Unit / lini', `<select name="u" class="inp">${opts(reporters.map(u => [u.code, (u.parent ? unitName(u.parent) + ' · ' : '') + u.name]).concat(bizUnits.filter(u => !lines(u.code).length).map(u => [u.code, u.name])), '')}</select>`) +
          field('Tanggal', `<input type="date" name="d" class="inp" value="${today()}">`) + `</div>` + field('Omzet', '<span class="pre"><b>Rp</b><input name="amt" class="inp-n" inputmode="numeric" placeholder="0"></span>') + field('Catatan', '<input name="note" class="inp">') +
          '<p class="note">Cabang Rentalaja yang sudah memakai Tutup shift di Rentalaja App tidak perlu lapor di sini.</p>',
          { submit: 'Kirim', onSubmit: async (f) => { need(f.u, 'Pilih unit'); const amt = num(f.amt); if (!amt) throw new Error('Isi omzet');
            await db.upsert('pk_omzet', { unit_code: f.u, day: f.d, amount: amt, note: f.note || null, reported_by: me, source: 'manual' }, 'unit_code,day,source'); } });
        if (r) { toast('Omzet tercatat'); reload(); } return;
      }
      if (a && a.dataset.a === 'liga') {
        const w = weekStart(today());
        const r = await modal('Poin Liga minggu ' + fdate(w, false), bizUnits.map(u => { const x = liga.find(l => l.unit_code === u.code && l.week_start === w) || {};
          return `<h3 class="row gap6">${logo(u.code, 20)}${esc(u.name)}</h3><div class="g4">${['kas', 'profit', 'kapasitas', 'growth'].map(k => field(k[0].toUpperCase() + k.slice(1) + ' (maks ' + lw[k] + ')', `<input type="number" min="0" max="${lw[k]}" name="${u.code}_${k}" class="inp" value="${x[k] ?? ''}">`)).join('')}</div>`; }).join(''),
          { wide: true, onSubmit: async (f) => { for (const u of bizUnits) { const row = { unit_code: u.code, week_start: w, entered_by: me };
            for (const k of ['kas', 'profit', 'kapasitas', 'growth']) { const v = +f[u.code + '_' + k] || 0; if (v < 0 || v > lw[k]) throw new Error(`${u.name}: ${k} maksimal ${lw[k]}`); row[k] = v; }
            await db.upsert('pk_liga', row, 'unit_code,week_start'); } } });
        if (r) { toast('Poin Liga tersimpan'); reload(); } return;
      }
      const tp = e.target.closest('[data-tp]');
      if (tp) { const code = tp.dataset.tp; const inp = el.querySelector(`[data-tin="${code}"]`); let v = num(inp.value) || num(inp.placeholder); if (!v) return toast('Isi angka target', 'err');
        const ex = tgt(code, nm);
        if (ex) await db.update('pk_targets', 'id=eq.' + ex.id, { amount: v, updated_at: new Date().toISOString() });
        else await db.insert('pk_targets', { unit_code: code, month: nm, amount: v, status: 'usulan', proposed_by: me });
        toast('Target ' + fmonth(nm) + ' diusulkan'); return reload(); }
      const ts = e.target.closest('[data-ts]'); if (ts) { await db.rpc('pk_target_status', { p_id: ts.dataset.ts, p_status: ts.dataset.s }); toast('Tersimpan'); reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };
}

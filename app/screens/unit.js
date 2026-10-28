import { ctx, db, esc, today, addDays, fdate, fmonth, monthStart, weekStart, avatar, nick, modal, field, opts, toast, unitName, isFin, isAdmin, isCeo, need, chip, logo, rp, jt, num, bizOf, confirmBox, waReport } from '../core.js';

const stOf = (p) => p >= 1 ? ['Tercapai', 'green', '#09BEAF'] : p >= .9 ? ['Aman', 'green', '#09BEAF'] : p >= .75 ? ['Diawasi', 'yellow', '#D99A00'] : ['Perlu evaluasi', 'red', '#C2410C'];
const nextMonth = (m) => { const d = new Date(m + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };

export default async function unit(el, params, reload) {
  const me = ctx.me.id; const canProp = (code) => isAdmin() || isFin() || (ctx.me.role === 'leader' && bizOf(ctx.me.unit_code) === code); const m = params.get('m') || monthStart(today()); const nm = nextMonth(m);
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
  // target bulan depan: unit dengan lini = jumlah target per lini
  const ST = { usulan: 'Diusulkan', dicek: 'Dicek Keuangan', sah: 'Disahkan CEO' };
  const nextT = (code) => { const ls = lines(code).map(l => tgt(l.code, nm)).filter(Boolean);
    if (!ls.length) { const x = tgt(code, nm); return x ? { ...x, ids: [x.id], rows: [] } : null; }
    const st = ls.every(x => x.status === 'sah') ? 'sah' : ls.every(x => x.status !== 'usulan') ? 'dicek' : 'usulan';
    return { amount: ls.reduce((s, x) => s + +x.amount, 0), status: st, ids: ls.map(x => x.id), rows: ls, lined: true, proposed_by: ls[0].proposed_by }; };
  const cards = bizUnits.map(u => {
    const codes = [u.code, ...lines(u.code).map(l => l.code)];
    const a = sumOm(codes);
    const lt = lines(u.code).map(l => tgt(l.code, m)).filter(Boolean);
    const t = lt.length ? lt.reduce((s, x) => s + +x.amount, 0) : tgt(u.code, m) ? +tgt(u.code, m).amount : 0;
    return { u, a, t, p: pts(u.code, latestWeek), pp: pts(u.code, prevWeek), lines: lines(u.code).map(l => ({ l, a: sumOm([l.code]), t: tgt(l.code, m) ? +tgt(l.code, m).amount : 0 })) };
  }).sort((x, y) => (y.p ?? -1) - (x.p ?? -1));
  const lead = (code) => ctx.people.find(p => p.role === 'leader' && (p.unit_code === code || (ctx.unit[p.unit_code] || {}).parent === code));
  const grpA = cards.reduce((s, c) => s + c.a, 0), grpT = cards.reduce((s, c) => s + c.t, 0);
  const reporters = ctx.units.filter(u => ['WG', 'NL', 'NJ', 'MP', 'EX', 'JP', 'GK', 'BD', 'WN', 'CP'].includes(u.code));
  const lw = ctx.settings.liga_weights || { kas: 35, profit: 30, kapasitas: 20, growth: 15 };
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">${latestWeek ? 'Poin Liga minggu ' + fdate(latestWeek, false) : 'Poin Liga belum diisi'} · omzet ${fmonth(m)}</span><h1>Unit Bisnis</h1></div>
    <div class="row gap"><input type="month" class="inp" id="mpick" value="${m.slice(0, 7)}"><button class="btn" data-a="wa">Laporan WA</button>${isFin() || isAdmin() ? '<button class="btn" data-a="liga">Isi poin Liga</button>' : ''}<button class="btn pri" data-a="lapor">+ Lapor omzet</button></div></header>
  <div class="ucards">${cards.map((c, i) => { const p = c.t ? c.a / c.t : null; const s = p !== null ? stOf(p) : null; const L = lead(c.u.code); const tn = nextT(c.u.code);
    return `<section class="card ucard${i === 0 && c.p !== null ? ' first' : ''}">
      <div class="uhead">${c.p != null ? `<span class="rank">#${i + 1}</span>` : ''}${logo(c.u.code, 44)}<span class="uname"><b>${esc(c.u.name)}</b><small>${L ? avatar(L.id, 18) + '<span>Leader ' + esc(L.nickname || L.name) + '</span>' : '<span>Gabungan ' + c.lines.length + ' lini</span>'}</small></span>
        ${c.p != null ? `<span class="upts"><b>${c.p}</b><small class="${c.pp !== null && c.p > c.pp ? 'green-t' : c.pp !== null && c.p < c.pp ? 'red' : 'muted'}">${c.pp === null ? 'poin Liga' : c.p > c.pp ? '▲ ' + (c.p - c.pp) : c.p < c.pp ? '▼ ' + (c.pp - c.p) : '– tetap'}</small></span>` : ''}</div>
      <div><div class="row between"><span class="lab">OMZET ${fmonth(m).toUpperCase()}</span>${s ? chip(s[0], s[1]) : chip('Target belum ada')}</div>
        <div class="row between"><b class="big">${jt(c.a)}</b><span class="muted small">${c.t ? 'dari ' + jt(c.t) + ' · <b>' + Math.round(p * 100) + '%</b>' : ''}</span></div>
        <span class="bar lg"><i style="width:${p ? Math.min(100, p * 100) : 0}%;background:${s ? s[2] : '#C9CED6'}"></i></span></div>
      ${c.lines.length ? `<div class="mini">${c.lines.map(x => { const q = x.t ? x.a / x.t : null; const ss = q !== null ? stOf(q) : null;
        return `<div><span>${esc(x.l.name)}</span><span class="bar"><i style="width:${q ? Math.min(100, q * 100) : 0}%;background:${ss ? ss[2] : '#C9CED6'}"></i></span><b class="${q !== null && q < .75 ? 'red' : ''}">${jt(x.a)}<small>${x.t ? 'dari ' + jt(x.t) + ' · ' + Math.round(q * 100) + '%' : 'belum ada target'}</small></b></div>`; }).join('')}</div>` : ''}
      <div><span class="lab">KPI UTAMA</span><b>${esc(c.u.kpi || '—')}</b></div>
      <div class="tbox"><div class="row between small"><span class="lab">TARGET ${fmonth(nm).toUpperCase()}</span><span class="${tn ? 'green-t' : 'red'}">${tn ? ST[tn.status] : 'Belum diisi'}</span></div>
        ${tn ? `<div class="row between"><b>${rp(tn.amount)}</b><span class="row gap6">${isFin() && tn.status === 'usulan' ? `<button class="btn sm" data-ts="${tn.ids.join(',')}" data-s="dicek">Tandai dicek</button>` : ''}${isCeo() && tn.status !== 'sah' ? `<button class="btn sm pri" data-ts="${tn.ids.join(',')}" data-s="sah">Sahkan</button>` : ''}${!tn.lined && (isCeo() || (tn.status === 'usulan' && (tn.proposed_by === me || isFin() || isAdmin()))) ? `<button class="btn sm danger" data-tdel="${tn.id}">${tn.status === 'usulan' ? 'Hapus usulan' : 'Hapus target'}</button>` : ''}</span></div>` : ''}
        ${tn && tn.lined ? `<div class="tlines">${c.lines.map(x => { const r = tn.rows.find(y => y.unit_code === x.l.code); return `<div><span>${esc(x.l.name)}</span><b>${r ? jt(r.amount) : '—'}</b></div>`; }).join('')}</div>` : ''}
        ${canProp(c.u.code) && (c.lines.length || !tn || tn.status === 'usulan') ? (c.lines.length
          ? `<button class="btn sm pri" data-tl="${c.u.code}">Atur target tiap cabang / lini</button>`
          : `<div class="row gap"><span class="pre grow"><b>Rp</b><input class="inp-n" data-tin="${c.u.code}" inputmode="numeric" placeholder="${c.a ? Math.round(c.a * 1.05).toLocaleString('id-ID') + ' (usulan +5%)' : 'isi target'}"></span><button class="btn sm pri" data-tp="${c.u.code}">${tn ? 'Ubah' : 'Usulkan'}</button></div>`) : ''}</div>
    </section>`; }).join('')}</div>
  <div class="g2w">
    <section class="card"><div class="row between"><h2>Laporan omzet hari ini</h2><span class="muted small">ditutup 21.00</span></div>
      <div class="chips">${reporters.map(u => { const r = todayRows.find(x => x.unit_code === u.code); const canDel = r && r.source === 'manual' && (r.reported_by === me || isFin());
        return canDel ? `<button type="button" class="chip green chipdel" data-om="${r.id}" title="Klik untuk menghapus laporan yang salah">${esc(u.name)} · ${jt(r.amount)} ✕</button>` : `<span class="chip ${r ? 'green' : 'red'}">${esc(u.name)} · ${r ? jt(r.amount) : 'belum'}</span>`; }).join('')}</div>
      <p class="small muted">Salah input? Klik laporan bertanda ✕ untuk menghapusnya, lalu lapor ulang.</p>
      <p class="small muted">Total grup ${fmonth(m)}: <b>${jt(grpA)}</b>${grpT ? ' dari target ' + jt(grpT) + ' (' + Math.round(grpA / grpT * 100) + '%)' : ''}. Target bulan depan diusulkan Leader di 3 hari kerja terakhir, dicek Keuangan, disahkan CEO.</p></section>
    <section class="card"><h2>Cara poin dihitung</h2><div class="chips">${Object.entries(lw).map(([k, v]) => `<span class="chip gray"><b>${v}</b> ${{ kas: 'Kas aman', profit: 'Laba', kapasitas: 'Rapi: KKH & aset', growth: 'Tumbuh' }[k]}</span>`).join('')}</div>
      <p class="small muted">Poin = seberapa dekat unit dengan targetnya sendiri, maksimal 100. Diisi Keuangan setiap minggu.</p></section></div>`;

  el.querySelector('#mpick').onchange = (e) => { location.hash = '#/unit?m=' + e.target.value + '-01'; };
  el.onclick = async (e) => {
    try {
      const a = e.target.closest('[data-a]');
      if (a && a.dataset.a === 'lapor') {
        // semua lini dalam satu form: isi yang ada omzetnya, kosongkan sisanya
        const rows = reporters.concat(bizUnits.filter(u => !lines(u.code).length)).filter((u, i, arr) => arr.findIndex(x => x.code === u.code) === i);
        const groups = bizUnits.map(u => ({ u, rs: rows.filter(r => r.code === u.code || r.parent === u.code) })).filter(g => g.rs.length);
        const body = `<div class="row gap">${field('Tanggal', `<input type="date" name="d" class="inp" value="${today()}" max="${today()}">`)}<div class="bulk-tot"><span class="lab">TOTAL</span><b id="btot">Rp0</b></div></div>
          ${groups.map(g => `<div class="bulk-g"><div class="row gap6 lab">${logo(g.u.code, 18)}${esc(g.u.name)}</div>${g.rs.map(r => `<label class="bulk-r"><span>${esc(r.code === g.u.code ? g.u.name : r.name)}<small class="muted" data-hint="${r.code}"></small></span><span class="pre"><b>Rp</b><input name="a_${r.code}" class="inp-n" inputmode="numeric" placeholder="0"></span></label>`).join('')}</div>`).join('')}
          <p class="note">Kosongkan lini yang tidak ada omzet atau belum mau dilapor. Angka yang sudah pernah dilapor untuk tanggal itu ikut tampil dan bisa diubah. Cabang yang memakai Tutup shift di Rentalaja App tercatat otomatis.</p>`;
        let existing = [];
        const onOpen = async (ev) => { document.removeEventListener('modal:open', onOpen); const form = ev.detail;
          const fmt = (v) => v ? (+v).toLocaleString('id-ID') : '';
          const total = () => { let t = 0; form.querySelectorAll('[name^="a_"]').forEach(i => t += num(i.value) || 0); form.querySelector('#btot').textContent = rp(t); };
          const load = async () => { const d = form.querySelector('[name=d]').value; existing = await db.get('pk_omzet', `select=*&day=eq.${d}`);
            for (const r of rows) { const inp = form.querySelector(`[name="a_${r.code}"]`), hint = form.querySelector(`[data-hint="${r.code}"]`);
              const man = existing.find(x => x.unit_code === r.code && x.source === 'manual'), auto = existing.find(x => x.unit_code === r.code && x.source !== 'manual');
              inp.value = fmt(man && man.amount); hint.textContent = auto ? ' · ' + jt(auto.amount) + ' dari Rentalaja App' : man ? ' · sudah dilapor' : ''; }
            total(); };
          form.addEventListener('input', (e2) => { if (e2.target.name && e2.target.name.startsWith('a_')) total(); });
          form.querySelector('[name=d]').addEventListener('change', load); load(); };
        document.addEventListener('modal:open', onOpen);
        const r = await modal('Lapor omzet', body, { submit: 'Simpan semua', wide: true, onSubmit: async (f) => {
          if (!f.d) throw new Error('Pilih tanggal'); if (f.d > today()) throw new Error('Tanggal tidak boleh di masa depan');
          const ups = [], dels = [];
          for (const r of rows) { const v = num(f['a_' + r.code]); const man = existing.find(x => x.unit_code === r.code && x.source === 'manual');
            if (v) { if (!man || +man.amount !== v) ups.push({ unit_code: r.code, day: f.d, amount: v, reported_by: me, source: 'manual' }); }
            else if (man) dels.push(man.id); }
          if (!ups.length && !dels.length) throw new Error('Belum ada angka yang diisi atau diubah');
          const other = rows.filter(r => { const man = existing.find(x => x.unit_code === r.code && x.source === 'manual'); return man && man.reported_by !== me && !isFin() && (ups.some(u => u.unit_code === r.code) || dels.includes(man.id)); });
          if (other.length) throw new Error(other.map(r => r.name + ' (dilapor ' + nick(existing.find(x => x.unit_code === r.code && x.source === 'manual').reported_by) + ')').join(', ') + ' hanya bisa diubah pelapornya atau Keuangan. Kembalikan angkanya, lalu simpan lagi.');
          if (ups.length) await db.upsert('pk_omzet', ups, 'unit_code,day,source');
          for (const id of dels) await db.remove('pk_omzet', 'id=eq.' + id);
          return ups.length + dels.length; } });
        if (r) { toast(`Omzet tersimpan · ${r} lini`); reload(); } return;
      }
      const tl = e.target.closest('[data-tl]');
      if (tl) { const code = tl.dataset.tl; const u = ctx.unit[code]; const ls = lines(code);
        const allT = await db.get('pk_targets', `select=*&month=in.(${m},${nm})&unit_code=in.(${ls.map(l => l.code).join(',')})`);
        const body = field('Bulan', `<select name="mon" class="inp">${opts([[nm, fmonth(nm)], [m, fmonth(m)]], nm)}</select>`) +
          `<p class="muted small" style="margin-top:0">Target masing-masing cabang / lini ${esc(u.name)}. Isi satu per satu.</p>
          ${ls.map(l => { const cur = sumOm([l.code]);
            return `<label class="bulk-r"><span>${esc(l.name)}<small class="muted" data-st="${l.code}"></small><small class="muted">${cur ? ' · omzet ' + fmonth(m) + ' ' + jt(cur) : ''}</small></span><span class="pre"><b>Rp</b><input name="t_${l.code}" class="inp-n" inputmode="numeric" placeholder="${cur ? Math.round(cur * 1.05).toLocaleString('id-ID') : '0'}"></span></label>`; }).join('')}
          <div class="row between bulk-sum"><span class="lab">TOTAL ${esc(u.name.toUpperCase())}</span><b id="ttot">Rp0</b></div>
          <p class="note">Lini yang dikosongkan tidak diberi target. ${isCeo() ? 'Karena Anda CEO, target yang disimpan langsung sah. Kosongkan kolom untuk menghapus target cabang itu.' : 'Yang sudah dicek Keuangan atau disahkan CEO terkunci.'}${tgt(code, nm) ? ` Target unit ${jt(tgt(code, nm).amount)} yang lama digantikan oleh target per lini.` : ''}</p>`;
        const T0 = (lc, mon) => allT.find(t => t.unit_code === lc && t.month === mon);
        const onOpen = (ev) => { document.removeEventListener('modal:open', onOpen); const form = ev.detail;
          const total = () => { let t = 0; form.querySelectorAll('[name^="t_"]').forEach(i => t += num(i.value) || 0); form.querySelector('#ttot').textContent = rp(t); };
          const fill = () => { const mon = form.querySelector('[name=mon]').value;
            for (const l of ls) { const ex = T0(l.code, mon), inp = form.querySelector(`[name="t_${l.code}"]`);
              inp.value = ex ? (+ex.amount).toLocaleString('id-ID') : ''; inp.disabled = !!(ex && ex.status !== 'usulan' && !isCeo());
              form.querySelector(`[data-st="${l.code}"]`).textContent = ex ? ' · ' + ({ usulan: 'diusulkan', dicek: 'dicek Keuangan', sah: 'disahkan' }[ex.status]) : ''; }
            total(); };
          form.addEventListener('input', total); form.querySelector('[name=mon]').addEventListener('change', fill); fill(); };
        document.addEventListener('modal:open', onOpen);
        let monSaved = nm;
        const r = await modal('Target cabang / lini · ' + u.name, body, { submit: 'Simpan target', onSubmit: async (f) => {
          const mon = f.mon; monSaved = mon; let n = 0;
          for (const l of ls) { const ex = T0(l.code, mon); if (ex && ex.status !== 'usulan' && !isCeo()) continue; const v = num(f['t_' + l.code]);
            if (v && ex) { if (+ex.amount !== v) { await db.update('pk_targets', 'id=eq.' + ex.id, { amount: v, updated_at: new Date().toISOString() }); n++; } }
            else if (v) { await db.insert('pk_targets', { unit_code: l.code, month: mon, amount: v, status: 'usulan', proposed_by: me }); n++; }
            else if (ex && (ex.status === 'usulan' || isCeo())) { await db.remove('pk_targets', 'id=eq.' + ex.id); n++; } }
          const old = tgt(code, mon); if (old && isCeo() && ls.some(l => num(f['t_' + l.code]))) { await db.remove('pk_targets', 'id=eq.' + old.id); n++; }
          if (!n) throw new Error('Belum ada target yang diisi atau diubah');
          if (isCeo()) { const fresh = await db.get('pk_targets', `select=id,status&month=eq.${mon}&unit_code=in.(${ls.map(l => l.code).join(',')})`);
            for (const t of fresh.filter(x => x.status !== 'sah')) await db.rpc('pk_target_status', { p_id: t.id, p_status: 'sah' }); } } });
        if (r) { toast('Target ' + fmonth(monSaved) + ' tersimpan'); reload(); } return;
      }
      if (a && a.dataset.a === 'wa') {
        const day = today(); const dsum = (codes) => todayRows.filter(r => codes.includes(r.unit_code)).reduce((s, r) => s + +r.amount, 0);
        const rowsAll = reporters.concat(bizUnits.filter(u => !lines(u.code).length)).filter((u, i, arr) => arr.findIndex(x => x.code === u.code) === i);
        const late = rowsAll.filter(u => !todayRows.some(r => r.unit_code === u.code)).map(u => u.name);
        let t = `*Laporan Omzet Pokama*\n${fdate(day)}\n\n*HARI INI*\n`;
        for (const c of cards) { const codes = [c.u.code, ...c.lines.map(x => x.l.code)]; t += `*${c.u.name}*: ${rp(dsum(codes))}\n`;
          for (const x of c.lines) { const v = dsum([x.l.code]); t += `  • ${x.l.name}: ${todayRows.some(r => r.unit_code === x.l.code) ? rp(v) : '_belum lapor_'}\n`; } }
        t += `Total hari ini: *${rp(todayRows.reduce((s, r) => s + +r.amount, 0))}*\n`;
        if (late.length) t += `Belum lapor: ${late.join(', ')}\n`;
        t += `\n*${fmonth(m).toUpperCase()} (s.d. hari ini)*\n`;
        for (const c of cards) t += `${c.t && c.a / c.t >= .9 ? '🟢' : c.t && c.a / c.t >= .75 ? '🟡' : c.t ? '🔴' : '⚪'} *${c.u.name}*: ${jt(c.a)}${c.t ? ` dari ${jt(c.t)} (${Math.round(c.a / c.t * 100)}%)` : ' · target belum ada'}\n`;
        t += `\nTotal grup: *${jt(grpA)}*${grpT ? ` dari ${jt(grpT)} (${Math.round(grpA / grpT * 100)}%)` : ''}\n\npokama.org`;
        await waReport('Omzet ' + fdate(day, false), t); return;
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
      if (tp) { const code = tp.dataset.tp; if (!canProp(code)) return toast('Target diusulkan Leader unit', 'err'); const inp = el.querySelector(`[data-tin="${code}"]`); let v = num(inp.value) || num(inp.placeholder); if (!v) return toast('Isi angka target', 'err');
        const ex = tgt(code, nm);
        if (ex) await db.update('pk_targets', 'id=eq.' + ex.id, { amount: v, updated_at: new Date().toISOString() });
        else await db.insert('pk_targets', { unit_code: code, month: nm, amount: v, status: 'usulan', proposed_by: me });
        toast('Target ' + fmonth(nm) + ' diusulkan'); return reload(); }
      const td = e.target.closest('[data-tdel]');
      if (td) { if (!await confirmBox('Hapus target ini? Kartu unit kembali "Belum diisi" dan target bisa diisi ulang.', 'Ya, hapus')) return; await db.remove('pk_targets', 'id=eq.' + td.dataset.tdel); toast('Usulan target dihapus'); return reload(); }
      const om = e.target.closest('[data-om]');
      if (om) { if (!await confirmBox('Hapus laporan omzet ini? Setelah itu bisa lapor ulang dengan angka yang benar.', 'Ya, hapus')) return; await db.remove('pk_omzet', 'id=eq.' + om.dataset.om); toast('Laporan omzet dihapus'); return reload(); }
      const ts = e.target.closest('[data-ts]'); if (ts) { for (const id of ts.dataset.ts.split(',')) { const t0 = targets.find(x => x.id === id); if (t0 && t0.status === ts.dataset.s) continue; await db.rpc('pk_target_status', { p_id: id, p_status: ts.dataset.s }); } toast('Tersimpan'); reload(); }
    } catch (er) { toast(er.message, 'err'); }
  };
}

// Kotak Persetujuan · satu tempat untuk semua yang menunggu keputusan Anda:
// review tugas, RAB/LPJ, Kerja lapangan (cuti/izin/sakit, lembur, reimburse, kasbon), gaji & klaim tahap Keuangan,
// persetujuan Rentalaja (owner), mitra affiliate, dan investor. Diputuskan langsung di sini bila bisa; sisanya dibuka di modulnya.
import { ctx, db, esc, fdate, modal, field, toast, chip, nick, signedPhoto } from '../core.js';

const PAY = { claimpay: 'Tandai sudah dibayar', klaimpay: 'Tandai sudah ditransfer' };
const rp = (n) => 'Rp' + Math.round(+n || 0).toLocaleString('id-ID');
const SRC = { hold: ['Kehadiran', 'green'], klaim: ['Klaim', 'yellow'], review: ['Review', 'blue'], rab: ['Belanja', 'yellow'], ops: ['Kerja lapangan', 'green'], fin: ['Keuangan', 'yellow'], ra: ['Rentalaja', 'blue'], af: ['Mitra', 'gray'], iv: ['Investor', 'gray'] };
const ago = (t) => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 60 ? m + ' menit' : m < 1440 ? Math.round(m / 60) + ' jam' : Math.round(m / 1440) + ' hari'; };

/* cuti, izin & WFA staf holding: diputuskan berurutan sesuai rantai atasan (chain[step]) */
async function holdItems() {
  try {
    const me = ctx.me && ctx.me.id; if (!me) return [];
    const [lv, wf] = await Promise.all([db.get('pk_leave', 'select=*&status=eq.diajukan&order=day'), db.get('pk_wfa', 'select=*&status=eq.diajukan&order=day')]);
    const mine = (r) => r.person_id !== me && (r.chain || [])[r.step || 0] === me;
    const name = { cuti: 'Cuti', izin: 'Izin', libur: 'Libur', sakit: 'Sakit' };
    return lv.filter(mine).map(r => ({ src: 'hold', id: r.id, act: 'hold', t: 'leave', kind: name[r.kind] || r.kind, title: nick(r.person_id) + (r.replacement_id ? ' · pengganti ' + nick(r.replacement_id) : ''), sub: (r.end_day && r.end_day !== r.day ? 's/d ' + fdate(r.end_day) + ' · ' : '') + (r.reason || ''), day: r.day, since: r.created_at }))
      .concat(wf.filter(mine).map(w => ({ src: 'hold', id: w.id, act: 'hold', t: 'wfa', kind: 'WFA', title: nick(w.person_id), sub: w.reason || '', day: w.day, since: w.created_at })));
  } catch (e) { return []; }
}
async function inbox() { const [a, b] = await Promise.all([db.rpc('pk_inbox').catch(() => []), holdItems()]); return b.concat(a || []); }
export async function inboxCount() { try { return (await inbox()).length; } catch (e) { return 0; } }

export default async function setuju(el, params, reload) {
  const all = await inbox();
  const f = params.get('f') || 'semua';
  const groups = Object.keys(SRC).filter(k => all.some(x => x.src === k));
  const list = all.filter(x => f === 'semua' || x.src === f);
  const old = all.filter(x => x.since && Date.now() - new Date(x.since) > 2 * 864e5).length;
  const total = all.reduce((a, x) => a + (+x.amount || 0), 0);
  el.innerHTML = `
  <header class="ph"><div><span class="muted small">Semua yang menunggu keputusan Anda, dari semua modul</span><h1>Kotak Persetujuan</h1></div></header>
  <div class="tiles"><div class="tile"><span>Menunggu</span><b>${all.length}</b><small>${groups.length} modul</small></div><div class="tile"><span>Lebih dari 2 hari</span><b class="${old ? 'red' : ''}">${old}</b><small>prioritaskan</small></div><div class="tile"><span>Nilai uang</span><b>${rp(total)}</b><small>yang menunggu</small></div></div>
  ${groups.length > 1 ? `<div class="seg">${[['semua', 'Semua (' + all.length + ')']].concat(groups.map(k => [k, SRC[k][0] + ' (' + all.filter(x => x.src === k).length + ')'])).map(([k, l]) => `<a href="#/setuju?f=${k}" class="${f === k ? 'on' : ''}">${esc(l)}</a>`).join('')}</div>` : ''}
  <section class="card"><div class="list">${list.map(x => `<div class="li row gap wrap" style="align-items:flex-start">
      <span style="flex:1;min-width:240px">${chip(SRC[x.src][0], SRC[x.src][1])} <b>${esc(x.kind)}</b>${x.amount ? ` · <b>${rp(x.amount)}</b>` : ''}<br>${esc(x.title || '')}<br><small class="muted">${esc(x.sub || '')}${x.day ? ' · ' + fdate(x.day) : ''} · menunggu ${ago(x.since)}</small></span>
      ${x.photo ? `<button type="button" class="btn sm" data-nota="${esc(x.photo)}" data-b="${esc(x.bucket || 'operasional')}">Nota</button>` : ''}
      ${PAY[x.act] ? `<button class="btn sm pri" data-pay="${esc(x.id)}" data-act="${x.act}">${PAY[x.act]}</button>`
        : x.act ? `<button class="btn sm pri" data-ok="${esc(x.id)}" data-act="${x.act}" data-t="${esc(x.t || '')}">Setujui</button><button class="btn sm" data-no="${esc(x.id)}" data-act="${x.act}" data-t="${esc(x.t || '')}">Tolak</button>`
        : x.sso ? `<a class="btn sm" href="#" data-sso="${esc(x.sso)}">Buka</a>` : x.href ? `<a class="btn sm" href="${esc(x.href)}">Buka</a>` : ''}
    </div>`).join('') || '<p class="muted">Tidak ada yang menunggu keputusan Anda. 👍</p>'}</div></section>`;
  el.onclick = async (e) => {
    const nb = e.target.closest('[data-nota]');
    if (nb) { const w = window.open('', '_blank'); try { const u = /^https?:/.test(nb.dataset.nota) ? nb.dataset.nota : await signedPhoto(nb.dataset.b, nb.dataset.nota); if (w) w.location = u; else location.href = u; } catch (er) { if (w) w.close(); toast(er.message, 'err'); } return; }
    const pb = e.target.closest('[data-pay]');
    if (pb) {
      const it = all.find(x => String(x.id) === pb.dataset.pay) || {};
      const r = await modal(PAY[pb.dataset.act], `<p class="note"><b>${esc(it.title || '')}</b><br>${rp(it.amount)}</p>` + field('Dibayar lewat', '<select name="ch" class="inp"><option value="transfer">Transfer bank</option><option value="tunai">Tunai</option></select>', 'Pembayaran reimburse otomatis dicatat sebagai biaya di buku Keuangan.'),
        { submit: 'Tandai dibayar', onSubmit: (f) => db.rpc(pb.dataset.act === 'klaimpay' ? 'pk_claim_paid' : 'pk_fin_claim_paid', { p_id: pb.dataset.pay, p_channel: f.ch }) });
      if (r) { toast('Ditandai dibayar'); reload(); } return;
    }
    const b = e.target.closest('[data-ok],[data-no]'); if (!b) return;
    const ok = !!b.dataset.ok, id = b.dataset.ok || b.dataset.no, act = b.dataset.act, t = b.dataset.t;
    const call = (note) => {
      if (act === 'ops') return db.rpc(t === 'leave' ? 'ops_leave_decide' : t === 'ot' ? 'ops_ot_decide' : 'ops_claim_decide', { p_id: id, p_ok: ok, p_note: note || null });
      if (act === 'finclaim') return db.rpc('pk_fin_ops_claim_decide', { p_id: id, p_ok: ok, p_note: note || null });
      if (act === 'ra') return db.rpc('decide_approval', { p_id: id, p_approve: ok, p_note: note || null });
      if (act === 'klaim') return db.rpc('pk_claim_decide', { p_id: id, p_ok: ok, p_note: note || null });
      if (act === 'hold') return t === 'wfa' ? db.rpc('pk_wfa_decide', { p_id: id, p_approve: ok, ...(note ? { p_note: note } : {}) }) : db.rpc('pk_leave_decision', { p_id: id, p_approve: ok, ...(note ? { p_note: note } : {}) });
    };
    try {
      if (ok) { b.disabled = true; await call(null); toast('Disetujui'); reload(); }
      else if (await modal('Tolak pengajuan', field('Alasan (dikirim ke pengaju)', '<textarea name="n" class="inp" rows="3" required></textarea>'), { submit: 'Tolak', danger: true, onSubmit: (fm) => call(fm.n) })) { toast('Ditolak'); reload(); }
    } catch (er) { b.disabled = false; toast(er.message, 'err'); }
  };
}

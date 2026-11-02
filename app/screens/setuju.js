// Kotak Persetujuan · satu tempat untuk semua yang menunggu keputusan Anda:
// review tugas, RAB/LPJ, Kerja lapangan (cuti/izin/sakit, lembur, reimburse, kasbon), gaji & klaim tahap Keuangan,
// persetujuan Rentalaja (owner), mitra affiliate, dan investor. Diputuskan langsung di sini bila bisa; sisanya dibuka di modulnya.
import { db, esc, fdate, modal, field, toast, chip } from '../core.js';

const rp = (n) => 'Rp' + Math.round(+n || 0).toLocaleString('id-ID');
const SRC = { review: ['Review', 'blue'], rab: ['Belanja', 'yellow'], ops: ['Kerja lapangan', 'green'], fin: ['Keuangan', 'yellow'], ra: ['Rentalaja', 'blue'], af: ['Mitra', 'gray'], iv: ['Investor', 'gray'] };
const ago = (t) => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 60 ? m + ' menit' : m < 1440 ? Math.round(m / 60) + ' jam' : Math.round(m / 1440) + ' hari'; };

export async function inboxCount() { try { const r = await db.rpc('pk_inbox'); return (r || []).length; } catch (e) { return 0; } }

export default async function setuju(el, params, reload) {
  const all = (await db.rpc('pk_inbox')) || [];
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
      ${x.photo ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(x.photo)}">Nota</a>` : ''}
      ${x.act ? `<button class="btn sm pri" data-ok="${esc(x.id)}" data-act="${x.act}" data-t="${esc(x.t || '')}">Setujui</button><button class="btn sm" data-no="${esc(x.id)}" data-act="${x.act}" data-t="${esc(x.t || '')}">Tolak</button>`
        : x.sso ? `<a class="btn sm" href="#" data-sso="${esc(x.sso)}">Buka</a>` : x.href ? `<a class="btn sm" href="${esc(x.href)}">Buka</a>` : ''}
    </div>`).join('') || '<p class="muted">Tidak ada yang menunggu keputusan Anda. 👍</p>'}</div></section>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-ok],[data-no]'); if (!b) return;
    const ok = !!b.dataset.ok, id = b.dataset.ok || b.dataset.no, act = b.dataset.act, t = b.dataset.t;
    const call = (note) => {
      if (act === 'ops') return db.rpc(t === 'leave' ? 'ops_leave_decide' : t === 'ot' ? 'ops_ot_decide' : 'ops_claim_decide', { p_id: id, p_ok: ok, p_note: note || null });
      if (act === 'finclaim') return db.rpc('pk_fin_ops_claim_decide', { p_id: id, p_ok: ok, p_note: note || null });
      if (act === 'ra') return db.rpc('decide_approval', { p_id: id, p_approve: ok, p_note: note || null });
    };
    try {
      if (ok) { b.disabled = true; await call(null); toast('Disetujui'); reload(); }
      else if (await modal('Tolak pengajuan', field('Alasan (dikirim ke pengaju)', '<textarea name="n" class="inp" rows="3" required></textarea>'), { submit: 'Tolak', danger: true, onSubmit: (fm) => call(fm.n) })) { toast('Ditolak'); reload(); }
    } catch (er) { b.disabled = false; toast(er.message, 'err'); }
  };
}

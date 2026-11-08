import { ctx, db, esc, today, fdate, nick, avatar, ROLE, rp, unitName } from '../core.js';
import { inbox } from './setuju.js';

/* Beranda Sistem Kerja (gaya GajiHub): KKH hari ini di tengah, menu modul, keputusan yang menunggu Anda. */
const IC = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  inbox: '<path d="M4 13 7 5h10l3 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>', layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  check: '<path d="M5 12l5 5 9-10"/>', wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>', box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>', bank: '<path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18"/>',
  mega: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8"/>',
};
const T = { o: ['#FFF3DF', '#C9780A'], b: ['#E6EEFB', '#1E5AA8'], g: ['#E3F6F4', '#077A70'], p: ['#EFEAFB', '#6A4BC4'], l: ['#E4F4E9', '#1E7A3F'], r: ['#FDE8E6', '#C0392B'], s: ['#EEF0F3', '#4A5468'], y: ['#FFF0DC', '#B46A00'] };
const ico = (k, c) => `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[k] || IC.grid}</svg>`;
const SRC = { hold: 'Kehadiran', klaim: 'Klaim', review: 'Review', rab: 'Belanja', ops: 'Kerja lapangan', fin: 'Keuangan', ra: 'Rentalaja', af: 'Mitra', iv: 'Investor' };

export default async function beranda(el) {
  const me = ctx.me.id, day = today();
  const [kkh, tasks, rv, rb, inb] = await Promise.all([
    db.get('pk_kkh', `select=hour,code,note,status,task_id&person_id=eq.${me}&day=eq.${day}&order=hour`).catch(() => []),
    db.get('pk_tasks', `select=id,title,status,due&pic_id=eq.${me}&status=in.(todo,doing,revisi,review)&order=due.asc.nullslast&limit=50`).catch(() => []),
    db.get('pk_tasks', `select=id&reviewer_id=eq.${me}&status=eq.review`).catch(() => []),
    db.get('pk_rab', 'select=id,chain,step,status&status=in.(diajukan,siap_cair,lpj)').catch(() => []),
    inbox().catch(() => [])
  ]);
  const filled = kkh.filter(r => r.code), done = filled.filter(r => r.status === 'siap' || r.status === 'valid');
  const pct = filled.length ? Math.round(done.length / filled.length * 100) : 0;
  const late = tasks.filter(t => t.due && t.due < day), dueToday = tasks.filter(t => t.due === day);
  const nb = rb.filter(r => r.status === 'diajukan' && (r.chain || [])[r.step] === me).length + (ctx.me.role === 'keuangan' ? rb.filter(r => r.status !== 'diajukan').length : 0);
  const h = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  const hello = (h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam') + ', ' + (ctx.me.nickname || ctx.me.name || '');
  const ini = String(ctx.me.code || (ctx.me.nickname || ctx.me.name || '?').slice(0, 2)).toUpperCase();
  const menu = [['kkh', 'KKH Saya', 'sun', 'o'], ['kkh-tim', 'KKH Tim', 'grid', 'b'], ['setuju', 'Kotak Persetujuan', 'inbox', 'g', inb.length], ['tugas', 'Proyek & Tugas', 'layers', 'p', tasks.length],
    ['review', 'Review & Revisi', 'check', 'l', rv.length], ['belanja', 'Pengajuan Belanja', 'wallet', 'r', nb], ['gudang', 'Gudang', 'box', 'y', 0, 1], ['kehadiran', 'Kehadiran & Cuti', 'clock', 'b'],
    ['unit', 'Unit Bisnis', 'trophy', 's'], ['tim', 'Tim & Peran', 'users', 's']];
  const mods = [['/buku/', 'Keuangan', 'bank', 'l'], ['/marketing/', 'Marketing', 'mega', 'p']];
  const tile = (href, label, ic, tone, n, baru) => `<a class="mb-it" href="${href}"><span class="mb-ic" style="background:${T[tone][0]}">${ico(ic, T[tone][1])}${n ? `<b class="mb-n">${n > 99 ? '99+' : n}</b>` : ''}${baru ? '<b class="mb-baru">Baru</b>' : ''}</span>${esc(label)}</a>`;
  const ago = (t) => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 60 ? m + ' mnt' : m < 1440 ? Math.round(m / 60) + ' jam' : Math.round(m / 1440) + ' hari'; };
  const kk = filled.slice(0, 4).map(r => `<li class="${r.status === 'siap' || r.status === 'valid' ? 'dn' : ''}"><i></i><span>${String(r.hour).padStart(2, '0')}.00 · ${esc(r.note || r.code)}</span></li>`).join('');
  el.innerHTML = `<style>
  .mb-hero{background:linear-gradient(170deg,#0A9E92,#077A70);color:#fff;margin:-16px -16px 0;padding:18px 16px 70px;border-radius:0 0 22px 22px}
  .mb-hero .av{width:48px;height:48px;border-radius:24px;background:#fff;color:#077A70;font-weight:900;display:flex;align-items:center;justify-content:center;flex:none}
  .mb-card{background:#fff;border-radius:20px;box-shadow:0 10px 28px rgba(31,43,77,.12);padding:14px 16px 16px;margin-top:-56px;position:relative}
  .mb-bar{height:8px;border-radius:4px;background:#EEF0F3;overflow:hidden;margin:6px 0 10px}.mb-bar i{display:block;height:100%;background:linear-gradient(90deg,#12B5A6,#077A70)}
  .mb-kk{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-direction:column;gap:6px;font-size:13.5px}.mb-kk li{display:flex;gap:8px;align-items:center}.mb-kk i{width:8px;height:8px;border-radius:4px;background:#F2A33A;flex:none}.mb-kk li.dn{color:#8A93A3;text-decoration:line-through}.mb-kk li.dn i{background:#1E9E6A}
  .mb-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mb-btns a{height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;text-decoration:none}
  .mb-h{display:flex;justify-content:space-between;align-items:baseline;margin:18px 0 10px}.mb-h b{font-size:17px}.mb-h a{color:#077A70;font-weight:800;font-size:13px;text-decoration:none}
  .mb-grid{background:#fff;border-radius:20px;padding:16px 8px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 4px;box-shadow:0 2px 10px rgba(31,43,77,.05)}
  @media (min-width:900px){.mb-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
  .mb-it{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:#1F2B4D;font-size:12px;line-height:15px;font-weight:700;text-align:center}
  .mb-ic{width:50px;height:50px;border-radius:16px;display:flex;align-items:center;justify-content:center;position:relative}
  .mb-n{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:10px;background:#E5534B;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
  .mb-baru{position:absolute;top:-8px;left:50%;transform:translateX(-50%);height:17px;padding:0 6px;border-radius:9px;background:#077A70;color:#fff;font-size:10px;display:flex;align-items:center}
  .mb-list{background:#fff;border-radius:20px;padding:2px 16px;box-shadow:0 2px 10px rgba(31,43,77,.05)}.mb-row{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #EEF0F3;text-decoration:none;color:#1F2B4D}.mb-row:last-child{border-bottom:0}
  .mb-ban{display:flex;gap:12px;align-items:center;border-radius:20px;padding:14px 16px;margin-top:16px;color:#fff;background:linear-gradient(135deg,#1F2B4D,#2E4170);text-decoration:none}
  </style>
  <section class="mb-hero"><div class="row gap" style="align-items:center"><span class="av">${esc(ini)}</span><span><b style="font-size:19px;display:block">${esc(hello)}</b><span style="opacity:.9;font-size:13px">${esc(ctx.me.title || ROLE[ctx.me.role] || '')} · ${esc(unitName(ctx.me.unit_code))}</span></span></div></section>
  <section class="mb-card">
    <div class="row between"><b style="font-size:15px">KKH hari ini</b><span class="small muted">${fdate(day)}</span></div>
    <div class="row between small" style="margin-top:8px"><span>${filled.length ? done.length + ' dari ' + filled.length + ' jam terisi selesai' : 'Belum ada rencana hari ini'}</span><b>${pct}%</b></div>
    <div class="mb-bar"><i style="width:${pct}%"></i></div>
    ${kk ? `<ul class="mb-kk">${kk}</ul>` : ''}
    ${dueToday.length || late.length ? `<p class="small" style="margin:0 0 10px;color:${late.length ? '#C0392B' : '#9A5B00'};font-weight:700">${late.length ? late.length + ' tugas lewat tenggat' : ''}${late.length && dueToday.length ? ' · ' : ''}${dueToday.length ? dueToday.length + ' tugas tenggat hari ini' : ''}</p>` : ''}
    <div class="mb-btns"><a href="#/kkh" style="background:linear-gradient(135deg,#12B5A6,#077A70);color:#fff">Isi / update KKH</a><a href="#/kkh-tim" style="border:1.5px solid #E3E7ED;color:#1F2B4D">Lihat KKH tim</a></div>
  </section>
  <div class="mb-h"><b>Menu</b></div>
  <div class="mb-grid">${menu.map(m => tile('#/' + m[0], m[1], m[2], m[3], m[4], m[5])).join('')}${mods.map(m => tile(m[0], m[1], m[2], m[3])).join('')}</div>
  <div class="mb-h"><b>Menunggu keputusan Anda</b><a href="#/setuju">Lihat semua</a></div>
  <div class="mb-list">${inb.slice(0, 5).map(x => `<a class="mb-row" href="#/setuju"><span style="width:42px;height:42px;border-radius:21px;background:#E3F6F4;color:#077A70;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex:none">${esc((SRC[x.src] || 'X').slice(0, 2).toUpperCase())}</span>
    <span style="flex:1;min-width:0"><b style="display:block;font-size:14px">${esc(x.title || x.kind || SRC[x.src] || 'Persetujuan')}</b><span class="small muted">${esc([x.kind, x.sub].filter(Boolean).join(' · ').slice(0, 80))}</span></span>
    <span style="text-align:right;flex:none">${x.amount ? `<b class="small" style="display:block">${rp(x.amount)}</b>` : ''}<span class="chip ${x.since && Date.now() - new Date(x.since) > 2 * 864e5 ? 'red' : 'blue'}">${esc(SRC[x.src] || '')}${x.since ? ' · ' + ago(x.since) : ''}</span></span></a>`).join('') || '<p class="muted" style="padding:14px 0;margin:0">✓ Tidak ada yang menunggu keputusan Anda.</p>'}</div>
  <a class="mb-ban" href="#/tugas"><span style="width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;flex:none">${ico('layers', '#fff')}</span><span><b style="display:block;font-size:15px">Tugas saya: ${tasks.length} aktif</b><span style="font-size:12.5px;opacity:.85">${late.length ? late.length + ' lewat tenggat · ' : ''}${tasks.filter(t => t.status === 'revisi').length} perlu revisi · ${rv.length} menunggu review Anda</span></span></a>`;
}

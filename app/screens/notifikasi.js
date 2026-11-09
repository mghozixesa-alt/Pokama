import { ctx, db, esc, toast, ROLE, isAdmin, confirmBox } from '../core.js';

/* Pengaturan notifikasi (CEO / Kepala Staf): siapa dapat notifikasi apa, lewat apa. */
const LV = [['mendesak', 'Mendesak', 'Lonceng + email langsung', '#C0392B', '#FDE8E6'], ['penting', 'Penting', 'Lonceng + ringkasan pagi', '#9A5B00', '#FFF0DC'], ['info', 'Info', 'Lonceng saja, tanpa email', '#1E5AA8', '#E6EEFB'], ['mati', 'Mati', 'Tidak dikirim', '#4A5468', '#EEF0F3']];
const LVM = Object.fromEntries(LV.map(x => [x[0], x]));
const TOPICS = [
  ['KKH', [['kkh_telat', 'Pengingat KKH sendiri', '"Telat isi KKH", "KKH baru 0/8 jam", "telat N menit"', 'penting'], ['kkh_telat_tim', 'Rekap tim telat KKH (untuk atasan)', '"2 orang telat isi KKH"', 'penting'], ['kkh_tag', 'Di-tag di KKH orang lain', '"Yusril men-tag Anda di KKH"', 'info'], ['kkh_lain', 'KKH lainnya', 'validasi, catatan atasan', 'info']]],
  ['Belanja & uang', [['rab_setuju', 'RAB menunggu persetujuan saya', 'penyetuju di rantai RAB', 'mendesak'], ['rab_keuangan', 'RAB siap dicairkan / nota perlu dicek', 'untuk Keuangan', 'mendesak'], ['rab_status', 'Kabar RAB saya', 'disetujui, cair, selesai, revisi', 'info'], ['klaim', 'Klaim & penggantian', 'reimburse', 'penting'], ['keuangan', 'Transaksi keuangan perlu dicek', 'rekap harian Keuangan', 'penting']]],
  ['Kehadiran', [['cuti_setuju', 'Cuti/izin perlu saya setujui', 'untuk atasan', 'penting'], ['cuti_status', 'Kabar cuti saya', 'disetujui / ditolak', 'info'], ['ops', 'Kerja lapangan', 'cuti, izin, lembur petugas lapangan', 'penting']]],
  ['Tugas & konten', [['tugas', 'Tugas baru untuk saya', '', 'penting'], ['review', 'Review & revisi', 'cek hasil, minta revisi, selesai', 'penting'], ['marketing', 'Konten marketing', 'konten diajukan, disetujui, siap tayang', 'info']]],
];
const WA = [['staff_verif', 'Verifikasi baru masuk', 'Calon penyewa perlu dicek (CS cabang + owner)'], ['staff_verif_esc', 'Eskalasi verifikasi', 'Verifikasi belum dicek lewat batas waktu'], ['owner_booking', 'Booking baru (walk-in/manual)', 'Kabar ke owner'], ['ota_booking', 'Booking dari OTA', 'Traveloka/Tiket/Airbnb masuk'], ['report:daily_summary', 'Laporan harian', 'Ringkasan omzet harian'], ['transfer_proof', 'Bukti transfer masuk', 'Pelanggan unggah bukti transfer'], ['pokama', 'Pesan Sistem Kerja via WA', 'Notifikasi Pokama yang dikirim lewat WA'], ['ops_esc', 'Naik ke CEO (operasional)', 'Tugas manajer operasional lewat batas waktu → owner'], ['ops_report', 'Laporan operasional 10.00', 'Laporan harian manajer operasional → owner'], ['ops_reply', 'Tanggapan CEO ke manajer', 'Balasan laporan yang dicentang WA'], ['ops_risk', 'Risiko besok 18.00', 'Ke kepala cabang (atau manajer operasional)'], ['ops_idle', 'Unit nganggur ke CS', 'Saat manajer menekan Dorong ke CS']];
let S = { tab: 'kerja', open: {}, q: '' };

export default async function notifikasi(el) {
  if (!isAdmin()) { el.innerHTML = '<div class="card"><p class="muted">Halaman ini hanya untuk CEO dan Kepala Staf.</p></div>'; return; }
  const D = await db.rpc('pk_notif_admin');
  const people = D.people || [], rules = D.rules || [], cnt = D.counts || {}, cp = D.counts_person || {};
  const ruleOf = (t, pid, role) => (rules.find(r => r.topic === t && (r.person_id || null) === (pid || null) && (r.role || null) === (role || null)) || {}).level || '';
  const effective = (t, p) => ruleOf(t, p.id) || ruleOf(t, null, p.role) || ruleOf(t) || '';
  const pill = (lv, sub) => { const x = LVM[lv]; return x ? `<span class="chip" style="background:${x[4]};color:${x[3]}">${x[1]}${sub ? ' · ' + sub : ''}</span>` : '<span class="chip gray">Bawaan</span>'; };
  const sel = (attrs, cur, blank) => `<select class="inp" ${attrs} style="max-width:170px;height:38px">${blank ? `<option value="">${blank}</option>` : ''}${LV.map(x => `<option value="${x[0]}"${cur === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select>`;
  const total7 = Object.values(cnt).reduce((a, b) => a + b, 0);
  const tabs = [['kerja', 'Sistem Kerja'], ['orang', 'Per orang'], ['wa', 'WA Rentalaja']];

  let body = '';
  if (S.tab === 'kerja') {
    body = `<div class="note" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><span>${LV.map(x => `<b style="color:${x[3]}">${x[1]}</b>: ${x[2]}`).join(' · ')}</span><button class="btn sm" data-a="saran">Terapkan saran (kurangi notifikasi)</button></div>` +
      TOPICS.map(([g, list]) => `<h3 style="margin:18px 0 8px">${esc(g)}</h3><div class="stack">${list.map(([t, label, desc]) => {
        const def = ruleOf(t), exc = rules.filter(r => r.topic === t && (r.person_id || r.role));
        const open = S.open[t];
        return `<div class="card" style="gap:8px"><div class="row between wrap" style="gap:10px;align-items:center">
          <span style="min-width:0"><b>${esc(label)}</b><br><span class="small muted">${esc(desc)}${desc ? ' · ' : ''}${cnt[t] || 0} notifikasi / 7 hari</span></span>
          <span class="row gap6" style="align-items:center">${sel(`data-def="${t}"`, def, 'Bawaan sistem')}</span></div>
          <button class="link small" data-open="${t}" style="align-self:flex-start">${open ? 'Tutup' : 'Atur per orang'}${exc.length ? ' · ' + exc.length + ' pengecualian' : ''}</button>
          ${open ? `<div style="border-top:1px solid var(--line);padding-top:6px">${['ceo', 'kepala_staf', 'keuangan', 'leader', 'staf', 'lapangan'].filter(r => people.some(p => p.role === r)).map(r => `<div class="row between" style="padding:6px 0;gap:10px;align-items:center"><span class="small"><b>Semua ${esc(ROLE[r] || r)}</b></span>${sel(`data-role="${r}" data-t="${t}"`, ruleOf(t, null, r), 'Ikut di atas')}</div>`).join('')}
            ${people.map(p => `<div class="row between" style="padding:6px 0;gap:10px;align-items:center;border-top:1px dashed var(--line)"><span class="small" style="min-width:0"><b>${esc(p.name)}</b> · ${esc(ROLE[p.role] || p.role)}${cp[t + '|' + p.id] ? ` · <span class="muted">${cp[t + '|' + p.id]}/7 hari</span>` : ''}</span>${sel(`data-person="${p.id}" data-t="${t}"`, ruleOf(t, p.id), 'Ikut aturan')}</div>`).join('')}</div>` : ''}
        </div>`; }).join('')}</div>`).join('');
  } else if (S.tab === 'orang') {
    const q = S.q.toLowerCase(); const list = people.filter(p => !q || (p.name + ' ' + (p.full || '') + ' ' + (p.title || '')).toLowerCase().includes(q));
    body = `<input class="inp" type="search" placeholder="Cari nama…" value="${esc(S.q)}" data-q style="margin:4px 0 10px">` + `<div class="stack">${list.map(p => {
      const tot = Object.entries(cp).filter(([k]) => k.endsWith('|' + p.id)).reduce((a, [, n]) => a + n, 0);
      const open = S.open['p:' + p.id];
      return `<div class="card" style="gap:8px"><div class="row between wrap" style="gap:10px;align-items:center"><span><b>${esc(p.name)}</b> · <span class="small muted">${esc(p.title || ROLE[p.role] || '')} · ${tot} notifikasi / 7 hari</span></span>
        <span class="row gap6" style="align-items:center"><label class="chk small" style="margin:0"><input type="checkbox" data-email="${p.id}"${p.notify_email ? ' checked' : ''}${p.email ? '' : ' disabled'}> Email${p.email ? '' : ' (belum ada)'}</label><button class="btn sm" data-open="p:${p.id}">${open ? 'Tutup' : 'Atur'}</button></span></div>
        ${open ? TOPICS.map(([g, l]) => `<div class="small b muted" style="margin-top:6px">${esc(g)}</div>` + l.map(([t, label]) => { const own = ruleOf(t, p.id), eff = effective(t, p);
          return `<div class="row between" style="padding:5px 0;gap:10px;align-items:center"><span class="small">${esc(label)} ${own ? '' : pill(eff, cp[t + '|' + p.id] ? cp[t + '|' + p.id] + '/7h' : '')}</span>${sel(`data-person="${p.id}" data-t="${t}"`, own, 'Ikut aturan')}</div>`; }).join('')).join('') : ''}</div>`; }).join('')}</div>`;
  } else {
    const staff = D.staff || [], wr = D.wa_rules || [], wc = D.wa_counts || {};
    const off = (k, u) => wr.some(r => r.kind === k && (r.user_id || null) === (u || null) && !r.enabled);
    body = `<p class="note">WA ke staf Rentalaja (lewat Fonnte). Matikan per jenis atau per orang. WA ke pelanggan (OTP, booking, berita acara) tidak diatur di sini.</p><div class="stack">` + WA.map(([k, label, desc]) => {
      const n = Object.entries(wc).filter(([x]) => x.startsWith(k + '|')).reduce((a, [, v]) => a + v, 0); const allOff = off(k, null); const open = S.open['w:' + k];
      const rcp = staff.filter(s => wc[k + '|' + s.id] || off(k, s.id));
      return `<div class="card" style="gap:8px"><div class="row between wrap" style="gap:10px;align-items:center"><span><b>${esc(label)}</b><br><span class="small muted">${esc(desc)} · ${n} WA / 7 hari</span></span>
        <label class="chk" style="margin:0"><input type="checkbox" data-wk="${k}"${allOff ? '' : ' checked'}> ${allOff ? 'Mati' : 'Aktif'}</label></div>
        ${allOff ? '' : `<button class="link small" data-open="w:${k}" style="align-self:flex-start">${open ? 'Tutup' : 'Atur penerima'}${rcp.length ? ' · ' + rcp.length + ' penerima minggu ini' : ''}</button>`}
        ${open && !allOff ? staff.map(s => `<div class="row between" style="padding:5px 0;gap:10px;align-items:center;border-top:1px dashed var(--line)"><span class="small"><b>${esc(s.name)}</b> · ${esc(s.role)} · HP ••${esc(s.phone4)}${wc[k + '|' + s.id] ? ` · <span class="muted">${wc[k + '|' + s.id]}/7 hari</span>` : ''}</span><label class="chk small" style="margin:0"><input type="checkbox" data-wk="${k}" data-wu="${s.id}"${off(k, s.id) ? '' : ' checked'}> Terima</label></div>`).join('') : ''}</div>`; }).join('') + `</div>`;
  }
  el.innerHTML = `<header class="ph"><div><span class="muted small">Sistem · ${total7} notifikasi Sistem Kerja dalam 7 hari</span><h1>Pengaturan Notifikasi</h1></div></header>
    <div class="chips">${tabs.map(([k, l]) => `<button class="chipbtn${S.tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>${body}
    <p class="small muted" style="margin-top:14px">Aturan per orang mengalahkan aturan per peran, dan aturan per peran mengalahkan aturan umum. "Bawaan sistem" = seperti sebelumnya. Berlaku untuk notifikasi baru.</p>`;

  const re = () => notifikasi(el);
  el.onclick = async (e) => { const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.tab) { S.tab = b.dataset.tab; return re(); }
      if (b.dataset.open) { S.open[b.dataset.open] = !S.open[b.dataset.open]; return re(); }
      if (b.dataset.a === 'saran') { if (!await confirmBox('Terapkan aturan saran untuk semua orang? (KKH tag & kabar status jadi Info tanpa email, persetujuan uang tetap Mendesak)', 'Terapkan')) return;
        for (const [, l] of TOPICS) for (const [t, , , lv] of l) await db.rpc('pk_notif_rule_set', { p_topic: t, p_person: null, p_role: null, p_level: lv });
        toast('Aturan saran diterapkan'); return re(); }
    } catch (er) { toast(er.message, 'err'); } };
  el.onchange = async (e) => { const t = e.target;
    try {
      if (t.dataset.def !== undefined) { await db.rpc('pk_notif_rule_set', { p_topic: t.dataset.def, p_person: null, p_role: null, p_level: t.value || null }); toast('Tersimpan'); return re(); }
      if (t.dataset.role) { await db.rpc('pk_notif_rule_set', { p_topic: t.dataset.t, p_person: null, p_role: t.dataset.role, p_level: t.value || null }); toast('Tersimpan'); return re(); }
      if (t.dataset.person) { await db.rpc('pk_notif_rule_set', { p_topic: t.dataset.t, p_person: t.dataset.person, p_role: null, p_level: t.value || null }); toast('Tersimpan'); return re(); }
      if (t.dataset.email) { await db.rpc('pk_notif_email_set', { p_person: t.dataset.email, p_on: t.checked }); toast(t.checked ? 'Email aktif' : 'Email dimatikan'); return re(); }
      if (t.dataset.wk) { await db.rpc('ra_wa_rule_set', { p_kind: t.dataset.wk, p_user: t.dataset.wu || null, p_enabled: t.checked }); toast('Tersimpan'); return re(); }
    } catch (er) { toast(er.message, 'err'); re(); } };
  el.oninput = (e) => { if (e.target.matches('[data-q]')) { clearTimeout(notifikasi._t); const v = e.target.value; notifikasi._t = setTimeout(() => { S.q = v; re().then(() => { const x = el.querySelector('[data-q]'); if (x) { x.focus(); x.setSelectionRange(v.length, v.length); } }); }, 300); } };
}

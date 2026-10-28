// Sistem Kerja Pokama · inti aplikasi: sambungan Supabase, sesi, router, komponen dasar
export const SB_URL = 'https://shrvzlltysnbmgpkhjjg.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocnZ6bGx0eXNuYm1ncGtoampnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzAzNTYsImV4cCI6MjEwODQ0NjM1Nn0.V0EDK0y3ZFIuNW5uGJjDcHZlEVxAURVC6OJVPaUYUFY';
const SKEY = 'pokama.session';

// ---------- sesi ----------
let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { session = null; }
function saveSession(s) {
  session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user } : null;
  try { s ? localStorage.setItem(SKEY, JSON.stringify(session)) : localStorage.removeItem(SKEY); } catch (e) {}
}
export const hasSession = () => !!(session && session.access_token);

async function authFetch(path, body, method = 'POST', token) {
  const r = await fetch(SB_URL + '/auth/v1/' + path, {
    method, headers: { apikey: SB_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(authMsg(j));
  return j;
}
function authMsg(j) {
  const m = (j.error_description || j.msg || j.message || j.error || '').toString();
  if (/invalid login credentials/i.test(m)) return 'Email atau password salah.';
  if (/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Minta Kepala Staf membuat ulang akun.';
  if (/rate limit/i.test(m)) return 'Terlalu banyak percobaan. Tunggu sebentar.';
  return m || 'Gagal terhubung. Coba lagi.';
}
export async function signInPassword(email, password) {
  const s = await authFetch('token?grant_type=password', { email: email.trim(), password });
  saveSession(s); return s;
}
export function signInGoogle() {
  const back = location.origin + location.pathname;
  location.href = SB_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(back);
}
export function takeSessionFromUrl() {
  if (!location.hash.includes('access_token=')) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  saveSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600 });
  history.replaceState(null, '', location.pathname + '#/');
  return true;
}
let refreshing = null;   // satu refresh untuk semua panggilan paralel
async function token() {
  if (!session) throw new Error('Sesi habis. Silakan masuk lagi.');
  if (session.expires_at - 60 < Date.now() / 1000) {
    if (!refreshing) refreshing = authFetch('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then(s => saveSession(s))
      .catch(e => { saveSession(null); location.hash = '#/'; location.reload(); throw e; })
      .finally(() => { refreshing = null; });
    await refreshing;
  }
  return session.access_token;
}
export async function signOut() {
  try { await authFetch('logout', null, 'POST', session && session.access_token); } catch (e) {}
  saveSession(null); location.hash = '#/'; location.reload();
}
export async function changePassword(pw) { await authFetch('user', { password: pw }, 'PUT', await token()); }
export async function callFn(name, body) {
  const r = await fetch(SB_URL + '/functions/v1/' + name, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Gagal'); return j;
}

// ---------- data ----------
function dbMsg(j, status) {
  let m = (j && (j.message || j.hint || j.details)) || ('Kesalahan ' + status);
  if (/row-level security|permission denied/i.test(m)) m = 'Anda tidak punya akses untuk perubahan ini.';
  if (/duplicate key/i.test(m)) m = 'Data yang sama sudah ada.';
  if (/JWT expired/i.test(m)) m = 'Sesi habis. Muat ulang halaman.';
  return m;
}
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method, headers: { apikey: SB_KEY, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(dbMsg(j, r.status));
  return j;
}
export const db = {
  get: (t, q = '') => rest(t + (q ? '?' + q : '')),
  insert: (t, row) => rest(t, { method: 'POST', body: row, prefer: 'return=representation' }),
  upsert: (t, row, on) => rest(t + (on ? '?on_conflict=' + on : ''), { method: 'POST', body: row, prefer: 'return=representation,resolution=merge-duplicates' }),
  update: (t, q, patch) => rest(t + '?' + q, { method: 'PATCH', body: patch, prefer: 'return=representation' }),
  remove: (t, q) => rest(t + '?' + q, { method: 'DELETE' }),
  rpc: (fn, args = {}) => rest('rpc/' + fn, { method: 'POST', body: args }),
};

// ---------- konteks bersama ----------
export const ctx = { me: null, people: [], units: [], settings: {}, byId: {}, unit: {} };
export async function loadContext() {
  ctx.me = await db.rpc('pk_session');
  if (!ctx.me) return false;
  const [people, units, settings] = await Promise.all([
    db.get('pk_people', 'select=id,code,name,nickname,role,title,unit_code,boss_id,valuer1_id,valuer2_id,email,phone,user_id,photo,joined_on,leave_quota,is_active&order=created_at'),
    db.get('pk_units', 'select=*&order=sort'),
    db.get('pk_settings', 'select=key,value,note'),
  ]);
  ctx.people = orgOrder(people, units); ctx.allUnits = units; ctx.units = units.filter(u => u.is_active !== false);
  ctx.byId = Object.fromEntries(ctx.people.map(p => [p.id, p]));
  ctx.unit = Object.fromEntries(units.map(u => [u.code, u]));
  ctx.settings = Object.fromEntries(settings.map(s => [s.key, s.value]));
  ctx.notes = Object.fromEntries(settings.map(s => [s.key, s.note]));
  return true;
}
// urutan orang mengikuti struktur: CEO, Kepala Staf, Keuangan, lalu tiap Leader diikuti timnya (urut unit), lalu staf lain per atasan
export function orgOrder(people, units) {
  const rank = { ceo: 0, kepala_staf: 1, keuangan: 2, leader: 3, staf: 4 };
  const usort = Object.fromEntries((units || []).map(u => [u.code, u.sort ?? 99]));
  const uOf = (p) => { const u = (units || []).find(x => x.code === p.unit_code); return u && u.kind === 'lini' ? (usort[u.parent] ?? 99) + (u.sort ?? 0) / 1000 : (usort[p.unit_code] ?? 99); };
  const byName = (a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name);
  const top = people.filter(p => rank[p.role] <= 2).sort((a, b) => rank[a.role] - rank[b.role] || byName(a, b));
  const leaders = people.filter(p => p.role === 'leader').sort((a, b) => uOf(a) - uOf(b) || byName(a, b));
  const out = [...top]; const seen = new Set(out.map(p => p.id));
  const team = (bossId) => people.filter(p => p.boss_id === bossId && !seen.has(p.id) && p.role === 'staf').sort((a, b) => uOf(a) - uOf(b) || byName(a, b));
  for (const l of leaders) { out.push(l); seen.add(l.id); for (const s of team(l.id)) { out.push(s); seen.add(s.id); } }
  for (const t of top) for (const s of team(t.id)) { out.push(s); seen.add(s.id); }
  for (const p of people.filter(x => !seen.has(x.id)).sort(byName)) { const i = out.findIndex(x => x.id === p.boss_id); let j = i + 1; while (i >= 0 && j < out.length && out[j].boss_id === p.boss_id) j++; out.splice(i >= 0 ? j : out.length, 0, p); seen.add(p.id); }
  return out;
}
export const isAdmin = () => ['ceo', 'kepala_staf'].includes(ctx.me && ctx.me.role);
export const isFin = () => ['ceo', 'keuangan'].includes(ctx.me && ctx.me.role);
export const isCeo = () => ctx.me && ctx.me.role === 'ceo';
export const active = () => ctx.people.filter(p => p.is_active);
export const nick = (id) => { const p = ctx.byId[id]; return p ? (p.nickname || p.name) : '—'; };
export const ROLE = { ceo: 'CEO', kepala_staf: 'Kepala Staf', keuangan: 'Keuangan', leader: 'Leader', staf: 'Staf' };
export const bizOf = (code) => { const u = ctx.unit[code]; if (!u) return code; return u.kind === 'lini' ? u.parent : u.code; };
export const unitName = (code) => (ctx.unit[code] && ctx.unit[code].name) || code || '—';

// ---------- util ----------
export const safeUrl = (u) => esc(/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '#');
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rp = (n) => 'Rp' + Math.round(+n || 0).toLocaleString('id-ID');
export const jt = (n) => { n = +n || 0; return n >= 1e6 ? 'Rp' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt' : rp(n); };
export const num = (s) => +String(s || '').replace(/[^\d]/g, '') || 0;
export function today() { const d = new Date(Date.now() + 7 * 3600e3); return d.toISOString().slice(0, 10); }
export function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function monthStart(iso) { return (iso || today()).slice(0, 8) + '01'; }
export function weekStart(iso) { const d = new Date((iso || today()) + 'T00:00:00Z'); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); }
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export function fdate(iso, withDay = true) { if (!iso) return '—'; const d = new Date(iso.slice(0, 10) + 'T00:00:00Z'); return (withDay ? HARI[d.getUTCDay()] + ' ' : '') + d.getUTCDate() + ' ' + BLN[d.getUTCMonth()]; }
export function fmonth(iso) { const d = new Date(iso.slice(0, 10) + 'T00:00:00Z'); return BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
export function ftime(ts) { if (!ts) return ''; const d = new Date(new Date(ts).getTime() + 7 * 3600e3); return fdate(d.toISOString()) + ' ' + d.toISOString().slice(11, 16); }
export const dayName = (iso) => HARI[new Date(iso + 'T00:00:00Z').getUTCDay()];
export function initials(p) { if (!p) return '?'; return p.code || (p.name || '?').slice(0, 2).toUpperCase(); }
export function avatar(id, size = 32) {
  const p = ctx.byId[id] || (typeof id === 'object' ? id : null);
  if (!p) return `<span class="av" style="width:${size}px;height:${size}px">?</span>`;
  return p.photo ? `<img class="av" src="${esc(p.photo)}" alt="" style="width:${size}px;height:${size}px">`
    : `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">${esc(initials(p))}</span>`;
}
const LOGO = { HQ: 'img/pk.png', RA: 'img/ra.png', WG: 'img/tr.png', NA: 'img/na.png' };
export function logo(code, size = 22) {
  const b = bizOf(code); const src = LOGO[b];
  return src ? `<span class="lg" style="width:${size}px;height:${size}px"><img src="${src}" alt=""></span>` : '';
}
export function chip(text, tone = 'gray') { return `<span class="chip ${tone}">${esc(text)}</span>`; }
export function opts(list, sel, blank) {
  return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
    list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
}
export const peopleOpts = (sel, blank = '— pilih orang —', filter) => opts(active().filter(filter || (() => true)).map(p => [p.id, (p.nickname || p.name) + ' · ' + (p.title || ROLE[p.role])]), sel, blank);
export const unitOpts = (sel, blank, kinds = ['holding', 'bisnis', 'lini']) => opts(ctx.units.filter(u => u.is_active && kinds.includes(u.kind)).map(u => [u.code, (u.kind === 'lini' ? '  · ' : '') + u.name]), sel, blank);

// ---------- toast & modal ----------
export function toast(msg, tone = 'ok') {
  const el = document.createElement('div'); el.className = 'toast ' + tone; el.textContent = msg; el.setAttribute('role', 'status');
  document.body.appendChild(el); setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, tone === 'err' ? 5200 : 3200);
}
export function modal(title, bodyHtml, { submit = 'Simpan', onSubmit, wide = false, danger } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h"><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="Tutup">×</button></div>
      <form class="modal-b" novalidate>${bodyHtml}<p class="form-err" hidden></p>
      <div class="modal-f">${danger ? `<button type="button" class="btn danger" data-danger>${esc(danger.label)}</button>` : ''}<span style="flex:1"></span>
      <button type="button" class="btn" data-close>Batal</button>${submit ? `<button type="submit" class="btn pri">${esc(submit)}</button>` : ''}</div></form></div>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form'); const err = wrap.querySelector('.form-err');
    const close = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(null); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
    const run = async (fn) => {
      const btns = wrap.querySelectorAll('button'); btns.forEach(b => b.disabled = true); err.hidden = true;
      try { const v = await fn(Object.fromEntries(new FormData(form)), form); close(v === undefined ? true : v); }
      catch (e2) { err.textContent = e2.message; err.hidden = false; btns.forEach(b => b.disabled = false); }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); run(onSubmit || (() => true)); });
    if (danger) { const db0 = wrap.querySelector('[data-danger]'); let armed = 0;
      db0.addEventListener('click', () => {
        if (danger.confirm === false || Date.now() - armed < 5000) return run(danger.onClick);
        armed = Date.now(); db0.textContent = 'Yakin? Klik lagi untuk ' + danger.label.toLowerCase(); db0.classList.add('armed');
        setTimeout(() => { if (wrap.isConnected) { db0.textContent = danger.label; db0.classList.remove('armed'); } }, 5000);
      }); }
    wrap.dispatchEvent(new CustomEvent('modal:open', { bubbles: true, detail: form }));
    setTimeout(() => { const f = form.querySelector('input:not([type=hidden]),select,textarea'); f && f.focus(); }, 30);
  });
}
export async function confirmBox(text, label = 'Ya, lanjutkan') {
  return modal('Konfirmasi', `<p style="margin:0">${esc(text)}</p>`, { submit: label });
}
export const field = (label, inner, hint) => `<label class="fld"><span>${esc(label)}</span>${inner}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
export const need = (v, msg) => { if (v === undefined || v === null || String(v).trim() === '') throw new Error(msg); return v; };

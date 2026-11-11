/* Notifikasi langsung ke HP (Web Push) untuk semua staf Sistem Kerja. */
import { ctx, db, callFn, toast } from './core.js';

const ok = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const k64 = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function save(sub) {
  const j = sub.toJSON();
  await db.rpc('pk_push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent });
}

export async function enablePush() {
  const key = await db.rpc('pk_push_pubkey');
  if (!key) throw new Error('Server notifikasi belum siap, coba lagi 1 menit lagi.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi ditolak. Aktifkan lewat Pengaturan HP → Notifikasi.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: k64(key) });
  await save(sub);
  const r = await callFn('pk-push', { mode: 'test' });
  return r;
}

function bar(html) {
  let el = document.getElementById('pk-push-bar');
  if (!el) { el = document.createElement('div'); el.id = 'pk-push-bar'; document.body.appendChild(el); }
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:999;max-width:520px;margin:0 auto;background:#1D3149;color:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.25);font:600 14px/1.45 Nunito,system-ui,sans-serif';
  el.innerHTML = html;
  const x = el.querySelector('[data-x]'); if (x) x.onclick = () => { try { localStorage.setItem('pokama.push.later', String(Date.now())); } catch (e) {} el.remove(); };
  return el;
}

export async function initPush() {
  try {
    if (!ctx.me) return;
    if (!ok() && !ios()) return;
    // sudah diizinkan: pastikan langganan tersimpan (diam-diam)
    if (ok() && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.register('/sw.js'); const sub = await reg.pushManager.getSubscription();
      if (sub) { await save(sub); return; }
    }
    try { if (+localStorage.getItem('pokama.push.later') > Date.now() - 3 * 864e5) return; } catch (e) {}
    const close = '<button data-x style="background:none;border:0;color:#9FB0CF;font:700 13px Nunito,sans-serif;cursor:pointer;padding:6px 0">Nanti</button>';
    if (ios() && !standalone()) {
      bar(`<b style="font-size:15px">Aktifkan notifikasi di iPhone</b><div style="margin:6px 0 8px;color:#D6DEEC">Di iPhone, notifikasi hanya bisa muncul kalau Pokama dipasang ke Layar Utama:</div>
        <div style="color:#fff">1. Tekan tombol <b>Bagikan</b> (kotak dengan panah ke atas) di Safari<br>2. Pilih <b>Tambahkan ke Layar Utama</b><br>3. Buka Pokama dari ikon di Layar Utama, lalu tekan <b>Aktifkan</b></div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px">${close}</div>`);
      return;
    }
    if (!ok()) return;
    const el = bar(`<b style="font-size:15px">Aktifkan notifikasi di HP ini</b><div style="margin:4px 0 10px;color:#D6DEEC">Tugas, persetujuan, dan keluhan langsung muncul di layar HP tanpa harus buka aplikasi.</div>
      <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end">${close}<button data-on style="height:40px;padding:0 16px;border-radius:10px;border:0;background:#09BEAF;color:#fff;font:800 14px Nunito,sans-serif;cursor:pointer">Aktifkan</button></div>`);
    el.querySelector('[data-on]').onclick = async () => {
      try { const r = await enablePush(); el.remove(); toast(r && r.results && r.results[0] === 'ok' ? 'Notifikasi aktif. Cek notifikasi uji di HP Anda.' : 'Notifikasi aktif.'); }
      catch (e) { toast(e.message || 'Gagal mengaktifkan notifikasi', 'bad'); }
    };
  } catch (e) { console.warn('push', e); }
}

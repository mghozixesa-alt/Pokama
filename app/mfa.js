// Sistem Kerja Pokama · verifikasi 2 langkah (TOTP: Google Authenticator / Microsoft Authenticator) untuk semua staf.
// Dipakai oleh Sistem Kerja (app.js), Marketing (gate.js), dan panel mitra (mitra/admin.html).
// Server ikut menegakkan: pk_me() hanya mengenali staf dengan sesi aal2.
const SB_URL = 'https://shrvzlltysnbmgpkhjjg.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocnZ6bGx0eXNuYm1ncGtoampnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzAzNTYsImV4cCI6MjEwODQ0NjM1Nn0.V0EDK0y3ZFIuNW5uGJjDcHZlEVxAURVC6OJVPaUYUFY';
const SKEY = 'pokama.session';
const IDLE_HOURS = 8;

export function claims(token) { try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } }
const load = () => { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } };
const store = (s) => {
  const v = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user };
  try { localStorage.setItem(SKEY, JSON.stringify(v)); } catch (e) {}
  return v;
};
async function auth(path, method, token, body) {
  const r = await fetch(SB_URL + '/auth/v1/' + path, { method, headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = String(j.msg || j.error_description || j.message || j.error || 'Gagal (' + r.status + ')'); throw new Error(/invalid totp|invalid code|expired/i.test(m) ? 'Kode salah atau sudah lewat. Pakai kode yang sedang tampil di aplikasi.' : m); }
  return j;
}
export function deviceId() {
  let d = null; try { d = localStorage.getItem('pokama.device'); } catch (e) {}
  if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); try { localStorage.setItem('pokama.device', d); } catch (e) {} }
  return d;
}
export function touch() { try { localStorage.setItem('pokama.active', String(Date.now())); } catch (e) {} }
export function idleExpired() {
  let t = 0; try { t = +localStorage.getItem('pokama.active') || 0; } catch (e) {}
  return t && Date.now() - t > IDLE_HOURS * 3600e3;
}
// sesi kedaluwarsa otomatis: tanpa aktivitas IDLE_HOURS jam → keluar
export function idleGuard(onExpire) {
  if (idleExpired()) onExpire();
  touch(); ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && idleExpired()) onExpire(); });
  setInterval(() => { if (idleExpired()) onExpire(); }, 60000);
}

const CSS = `.mfa-wrap{position:fixed;inset:0;z-index:600;background:#F3F5F8;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Nunito,system-ui,sans-serif;color:#1F2933;overflow:auto}
.mfa-card{width:min(400px,100%);background:#fff;border:1px solid #E3E6EB;border-radius:22px;padding:26px;display:flex;flex-direction:column;gap:12px;box-shadow:0 18px 40px rgba(29,49,73,.1)}
.mfa-card h1{margin:0;font-size:21px;font-weight:900;color:#1D3149}.mfa-card p,.mfa-card li{margin:0;font-size:14px;color:#5B6573;line-height:1.45}.mfa-card ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.mfa-card img.qr{width:190px;height:190px;align-self:center;border:1px solid #E3E6EB;border-radius:12px;padding:6px;background:#fff}
.mfa-card code{font:700 13px ui-monospace,Menlo,monospace;background:#F3F5F8;border-radius:8px;padding:8px;word-break:break-all;text-align:center;display:block}
.mfa-card input{height:52px;border:1px solid #D3D7DE;border-radius:12px;text-align:center;font:900 26px ui-monospace,Menlo,monospace;letter-spacing:.35em}
.mfa-card input:focus{outline:2px solid #09BEAF;border-color:#09BEAF}
.mfa-card button{height:48px;border-radius:12px;font:800 15px Nunito,sans-serif;cursor:pointer;border:0;background:#09BEAF;color:#1D3149}.mfa-card button.l{background:#fff;border:1px solid #E3E6EB}
.mfa-err{background:#FCEBDD;color:#9A3F0A;font-size:13px;font-weight:700;padding:10px 12px;border-radius:10px}`;

// Pastikan sesi tersimpan sudah aal2. Mengembalikan sesi aal2, atau null bila pengguna memilih keluar.
export async function ensureMfa() {
  let s = load(); if (!s || !s.access_token) return null;
  if (claims(s.access_token).aal === 'aal2') return s;
  try { const x = JSON.parse(localStorage.getItem('pokama.sso') || 'null'); if (x && x.until > Date.now() && x.sid && x.sid === claims(s.access_token).session_id) return s; } catch (e) {}
  if (!document.getElementById('mfa-css')) { const st = document.createElement('style'); st.id = 'mfa-css'; st.textContent = CSS; document.head.appendChild(st); }
  const wrap = document.createElement('div'); wrap.className = 'mfa-wrap'; document.body.appendChild(wrap);
  return new Promise((resolve) => {
    const out = () => { try { localStorage.removeItem(SKEY); } catch (e) {} wrap.remove(); resolve(null); location.reload(); };
    const show = async (err) => {
      try {
        const u = await auth('user', 'GET', s.access_token);
        const fs = (u.factors || []).filter(f => f.factor_type === 'totp');
        const ver = fs.find(f => f.status === 'verified');
        let factor = ver, enroll = null;
        if (!ver) {
          for (const f of fs) { try { await auth('factors/' + f.id, 'DELETE', s.access_token); } catch (e) {} }
          enroll = await auth('factors', 'POST', s.access_token, { factor_type: 'totp', friendly_name: 'Pokama ' + new Date().toISOString().slice(0, 16) });
          factor = enroll;
        }
        wrap.innerHTML = `<form class="mfa-card" novalidate><img src="/img/pokama-logo.png" alt="Pokama" style="width:120px">
          ${enroll ? `<h1>Aktifkan verifikasi 2 langkah</h1><p>Wajib untuk semua staf Pokama. Sekali saja per akun.</p>
            <ol><li>Pasang <b>Google Authenticator</b> atau <b>Microsoft Authenticator</b> di HP.</li><li>Di aplikasi, pilih tambah akun → pindai QR ini.</li><li>Ketik 6 angka yang muncul.</li></ol>
            <img class="qr" src="${enroll.totp.qr_code}" alt="QR verifikasi 2 langkah"><p style="text-align:center">Tidak bisa pindai? Masukkan kunci ini:</p><code>${enroll.totp.secret}</code>`
          : `<h1>Verifikasi 2 langkah</h1><p>Buka aplikasi Authenticator di HP, lalu ketik 6 angka untuk <b>Pokama</b>.</p>`}
          ${err ? `<div class="mfa-err" role="alert">${String(err).replace(/[<>&]/g, '')}</div>` : ''}
          <input name="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Kode 6 angka" required>
          <button type="submit">Verifikasi</button><button type="button" class="l" data-out>Keluar</button>
          <p style="font-size:12px">HP hilang atau ganti HP? Minta CEO atau Kepala Staf mereset verifikasi Anda di menu Tim & Peran.</p></form>`;
        const f = wrap.querySelector('form'); f.c.focus();
        wrap.querySelector('[data-out]').onclick = out;
        f.onsubmit = async (e) => {
          e.preventDefault(); const code = f.c.value.replace(/\D/g, ''); if (code.length !== 6) return;
          const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Memeriksa…';
          try {
            const ch = await auth('factors/' + factor.id + '/challenge', 'POST', s.access_token, {});
            const ns = await auth('factors/' + factor.id + '/verify', 'POST', s.access_token, { challenge_id: ch.id, code });
            s = store(ns); touch();
            try {
              await fetch(SB_URL + '/rest/v1/rpc/pk_login_seen', { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ p_device: deviceId(), p_agent: navigator.userAgent.slice(0, 200) }) });
            } catch (x) {}
            wrap.remove(); resolve(s);
          } catch (er) { if (enroll) { b.disabled = false; b.textContent = 'Verifikasi'; const m = wrap.querySelector('.mfa-err') || document.createElement('div'); m.className = 'mfa-err'; m.textContent = er.message; f.insertBefore(m, f.c); } else show(er.message); }
        };
      } catch (er) {
        if (/jwt|expired|401|not authenticated/i.test(er.message)) { out(); return; }
        wrap.innerHTML = `<div class="mfa-card"><h1>Verifikasi 2 langkah</h1><div class="mfa-err">${String(er.message).replace(/[<>&]/g, '')}</div><button type="button" onclick="location.reload()">Coba lagi</button><button type="button" class="l" data-out>Keluar</button></div>`;
        wrap.querySelector('[data-out]').onclick = out;
      }
    };
    show();
  });
}

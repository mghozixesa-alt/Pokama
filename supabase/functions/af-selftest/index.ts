// Uji keamanan sementara (dihapus setelah dipakai). Dipanggil dari database lewat pg_net dengan token uji.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const URL = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const TOKEN = "st_7f3a9c1e5b2d4086a1c9e7f05b3d2a64";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmac(alg: string, key: Uint8Array, data: Uint8Array) { const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: alg }, false, ["sign"]); return new Uint8Array(await crypto.subtle.sign("HMAC", k, data)); }
function b32(s: string) { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const c of s.replace(/=+$/, "").toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, "0"); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return new Uint8Array(out); }
async function totp(secret: string) { const c = Math.floor(Date.now() / 30000); const m = new Uint8Array(8); new DataView(m.buffer).setUint32(4, c); const h = await hmac("SHA-1", b32(secret), m); const o = h[19] & 15; const v = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6; return String(v).padStart(6, "0"); }
async function signed(keyId: string, secret: string, method: string, path: string, body = "", tsOff = 0, sigOverride?: string) {
  const ts = String(Math.floor(Date.now() / 1000) + tsOff);
  const sig = sigOverride ?? hex((await hmac("SHA-256", new TextEncoder().encode(secret), new TextEncoder().encode(`${ts}.${method}.${path}.${body}`))).buffer);
  const r = await fetch(`${URL}/functions/v1/af-api${path}`, { method, headers: { "x-key-id": keyId, "x-timestamp": ts, "x-signature": sig, "content-type": "application/json" }, body: method === "POST" ? body : undefined });
  return { status: r.status, body: (await r.text()).slice(0, 300), ts, sig };
}
const rest = async (path: string, token: string, opt: RequestInit = {}) => { const r = await fetch(`${URL}/rest/v1/${path}`, { ...opt, headers: { apikey: ANON, Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opt.headers || {}) } }); return { status: r.status, body: (await r.text()).slice(0, 200) }; };

Deno.serve(async (req) => {
  const p = await req.json().catch(() => ({}));
  if (p.token !== TOKEN) return new Response("no", { status: 403 });
  const out: Record<string, unknown> = {};
  // 1. TOTP (verifikasi 2 langkah) bisa didaftarkan & diverifikasi
  const email = `selftest.${Date.now()}@contoh.id`, pw = crypto.randomUUID();
  const { data: cu } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  const uid = cu?.user?.id;
  try {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: si, error: se } = await anon.auth.signInWithPassword({ email, password: pw });
    if (se) throw se;
    const userTok = si.session!.access_token;
    const { data: en, error: ee } = await anon.auth.mfa.enroll({ factorType: "totp", friendlyName: "uji" });
    out.mfa_enroll = ee ? "GAGAL: " + ee.message : "ok";
    if (en) {
      const { data: ch } = await anon.auth.mfa.challenge({ factorId: en.id });
      const { data: vr, error: ve } = await anon.auth.mfa.verify({ factorId: en.id, challengeId: ch!.id, code: await totp(en.totp.secret) });
      out.mfa_verify = ve ? "GAGAL: " + ve.message : JSON.parse(atob(vr!.access_token.split(".")[1])).aal;
    }
    // 2. serangan sebagai pengguna login biasa (bukan staf, bukan mitra terverifikasi)
    out.user_select_partners = await rest("af_partners?select=*", userTok);
    out.user_select_bookings = await rest("af_bookings?select=*", userTok);
    out.user_update_booking = await rest("af_bookings?id=not.is.null", userTok, { method: "PATCH", body: JSON.stringify({ commission: 999999 }) });
    out.user_rpc_me = await rest("rpc/af_me", userTok, { method: "POST", body: "{}" });
    out.user_rpc_ingest = await rest("rpc/af_ingest", userTok, { method: "POST", body: JSON.stringify({ p_unit: "RA", ev: { booking_id: "X", status: "selesai", kode: "DMVILA" } }) });
    out.user_rpc_admin = await rest("rpc/af_admin_partners", userTok, { method: "POST", body: "{}" });
    out.user_rpc_payout_approve = await rest("rpc/af_payout_approve", userTok, { method: "POST", body: JSON.stringify({ p_ids: [] }) });
    out.user_register_no_google = await rest("rpc/af_register", userTok, { method: "POST", body: JSON.stringify({ p: { name: "x", wa: "081211112222", kind: "kreator", city: "Garut", agree: true } }) });
    out.user_pk_people = await rest("pk_people?select=id", userTok);
  } catch (e) { out.error = String(e); }
  finally { if (uid) await admin.auth.admin.deleteUser(uid); }
  // 3. serangan sebagai anonim
  out.anon_partners = await rest("af_partners?select=*", ANON);
  out.anon_rates_table = await rest("af_rates?select=*", ANON);
  out.anon_register = await rest("rpc/af_register", ANON, { method: "POST", body: JSON.stringify({ p: {} }) });
  out.anon_close_month = await rest("rpc/af_close_month", ANON, { method: "POST", body: "{}" });
  out.anon_public_rates = await rest("rpc/af_public_rates", ANON, { method: "POST", body: "{}" });
  out.anon_featured = await rest("rpc/af_api_featured", ANON, { method: "POST", body: JSON.stringify({ p_unit: null }) });
  // 4. API unit
  if (p.key_id && p.secret) {
    const ev = JSON.stringify([{ booking_id: "ST-" + Date.now(), kode: "DMPDKI", kategori: "motor", nilai_bersih: 100000, status: "dibayar", waktu: new Date().toISOString() }]);
    out.api_no_signature = (await fetch(`${URL}/functions/v1/af-api/events`, { method: "POST", body: ev })).status;
    out.api_wrong_secret = (await signed(p.key_id, "afs_salah", "POST", "/events", ev)).status;
    out.api_old_timestamp = (await signed(p.key_id, p.secret, "POST", "/events", ev, -900)).status;
    const ok = await signed(p.key_id, p.secret, "POST", "/events", ev);
    out.api_valid = ok;
    const r2 = await fetch(`${URL}/functions/v1/af-api/events`, { method: "POST", headers: { "x-key-id": p.key_id, "x-timestamp": ok.ts, "x-signature": ok.sig, "content-type": "application/json" }, body: ev });
    out.api_replay = r2.status;
    out.api_tampered_body = (await fetch(`${URL}/functions/v1/af-api/events`, { method: "POST", headers: { "x-key-id": p.key_id, "x-timestamp": ok.ts, "x-signature": ok.sig, "content-type": "application/json" }, body: ev.replace("100000", "99999999") })).status;
    out.api_codes = (await signed(p.key_id, p.secret, "GET", "/codes")).status;
    out.api_featured_public = (await (await fetch(`${URL}/functions/v1/af-api/featured`)).text()).slice(0, 200);
    const guesses: number[] = []; let blocked = 0;
    for (let i = 0; i < 36; i++) { const g = await signed(p.key_id, p.secret, "GET", `/code?kode=ZZ${1000 + i}`); guesses.push(g.status); if (g.body.includes("Diblokir")) blocked++; }
    const real = await signed(p.key_id, p.secret, "GET", `/code?kode=DMPDKI`);
    out.api_guess_statuses = guesses.join(","); out.api_guess_blocked_responses = blocked; out.api_after_block_real_code = real.status + " " + real.body.slice(0, 80);
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { "Content-Type": "application/json" } });
});

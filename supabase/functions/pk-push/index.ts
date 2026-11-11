// Sistem Kerja Pokama · notifikasi langsung ke HP (Web Push, tanpa layanan pihak ketiga)
// mode "queue" (cron tiap menit): kirim notifikasi baru ke HP yang sudah mengizinkan.
// mode "test"  (dari aplikasi, harus login): kirim notifikasi uji ke HP milik pemanggil.
// Kunci VAPID dibuat otomatis sekali dan disimpan di tabel pk_vapid (hanya bisa dibaca server).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
let PUB = "";
let JWK: any = null;
const SUBJ = Deno.env.get("VAPID_SUBJECT") || "mailto:notifikasi@pokama.org";
const APP = "https://app.pokama.org/";
const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const ORIGINS = ["https://app.pokama.org", "https://pokama.org", "https://demo.pokama.org"];
const te = new TextEncoder();

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ub64 = (s: string) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

let vapidKey: CryptoKey | null = null;
async function keys() {
  if (PUB) return;
  const { data } = await db.from("pk_vapid").select("public_key,private_jwk").eq("id", 1).maybeSingle();
  if (data) { PUB = data.public_key; JWK = data.private_jwk; return; }
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  JWK = await crypto.subtle.exportKey("jwk", kp.privateKey);
  PUB = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
  const { error } = await db.from("pk_vapid").insert({ id: 1, public_key: PUB, private_jwk: JWK });
  if (error) { PUB = ""; JWK = null; return keys(); }
}
async function vapidJwt(aud: string) {
  if (!vapidKey) vapidKey = await crypto.subtle.importKey("jwk", { ...JWK, ext: true, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const h = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJ })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapidKey, te.encode(h + "." + c)));
  return h + "." + c + "." + b64u(sig);
}

// RFC 8291 (aes128gcm)
async function encrypt(sub: { p256dh: string; auth: string }, payload: Uint8Array) {
  const ua = ub64(sub.p256dh), secret = ub64(sub.auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(secret, shared);
  const ikm = await hmac(prkKey, cat(te.encode("WebPush: info\0"), ua, asPub, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

async function pushOne(sub: any, msg: Record<string, unknown>, urgent: boolean) {
  const aud = new URL(sub.endpoint).origin;
  const body = await encrypt(sub, te.encode(JSON.stringify(msg)));
  const r = await fetch(sub.endpoint, { method: "POST", body, headers: {
    Authorization: `vapid t=${await vapidJwt(aud)}, k=${PUB}`, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
    TTL: "86400", Urgency: urgent ? "high" : "normal" } });
  if (r.status === 404 || r.status === 410) { await db.from("pk_push_subs").delete().eq("id", sub.id); return "gone"; }
  if (!r.ok) { await db.from("pk_push_subs").update({ fails: (sub.fails || 0) + 1 }).eq("id", sub.id); return "err " + r.status + " " + (await r.text()).slice(0, 120); }
  await db.from("pk_push_subs").update({ last_ok: new Date().toISOString(), fails: 0 }).eq("id", sub.id);
  return "ok";
}

const msgOf = (n: any) => ({ title: n.title, body: n.body || "", url: APP + (n.link || ""), tag: n.id, urgent: !!n.urgent });

async function queue() {
  const { data: rows, error } = await db.rpc("pk_push_claim", { p_limit: 200 });
  if (error) return { error: error.message };
  if (!rows?.length) return { sent: 0 };
  const ids = [...new Set(rows.map((r: any) => r.person_id))];
  const { data: subs } = await db.from("pk_push_subs").select("*").in("person_id", ids);
  const res: string[] = [];
  for (const n of rows) for (const s of (subs || []).filter((x: any) => x.person_id === n.person_id)) res.push(await pushOne(s, msgOf(n), n.urgent));
  return { notifications: rows.length, results: res };
}

Deno.serve(async (req) => {
  const o = req.headers.get("origin") || "";
  const CORS = { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    await keys();
    const body = await req.json().catch(() => ({}));
    if (body.mode === "test") {
      const tok = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
      const { data: u } = await db.auth.getUser(tok);
      if (!u?.user) return json({ error: "Belum masuk" }, 401);
      const { data: p } = await db.from("pk_people").select("id,nickname,name").eq("user_id", u.user.id).maybeSingle();
      if (!p) return json({ error: "Akun tidak terdaftar" }, 403);
      const { data: subs } = await db.from("pk_push_subs").select("*").eq("person_id", p.id);
      const res = [];
      for (const s of subs || []) res.push(await pushOne(s, { title: "Notifikasi HP sudah aktif", body: `Halo ${p.nickname || p.name}, mulai sekarang tugas, persetujuan, dan keluhan muncul langsung di HP ini.`, url: APP + "#/beranda", tag: "test" }, true));
      return json({ devices: (subs || []).length, results: res });
    }
    return json(await queue());
  } catch (e) { return json({ error: String(e) }, 500); }
});

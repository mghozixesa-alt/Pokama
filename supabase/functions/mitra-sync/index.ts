// Rentalaja ⇄ Program Mitra Pokama.
// - ambil daftar kode mitra aktif (GET /codes) tiap 15 menit → cache ra_mitra_codes (checkout tetap jalan walau Pokama gangguan)
// - ambil Mitra Unggulan (GET /featured) tiap 6 jam → ra_mitra_featured
// - kirim antrean event booking (ra_mitra_outbox) ke POST /events; yang gagal dicoba lagi otomatis (jeda bertahap)
// Kunci unit: secret POKAMA_KEY_ID + POKAMA_KEY_SECRET bila dipasang; bila tidak, dibaca langsung dari database Pokama
// (af_unit_own_key, hanya service_role) — rahasia tidak pernah disalin manual, dan ganti kunci di panel Pokama otomatis terpakai.
// Tiap panggilan ditandatangani HMAC. Dipanggil pg_cron tiap 5 menit.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const API = Deno.env.get("POKAMA_AF_API") || "https://shrvzlltysnbmgpkhjjg.supabase.co/functions/v1/af-api";
const UNIT = "RA";
let KEY_ID = Deno.env.get("POKAMA_KEY_ID") || "";
let SECRET = Deno.env.get("POKAMA_KEY_SECRET") || Deno.env.get("POKAMA_UNIT_KEY") || "";
let KEY = KEY_ID && SECRET ? "ok" : "";
const FROM_ENV = !!KEY;
const enc = new TextEncoder();
let hkey: CryptoKey | null = null;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function loadKey() {
  if (FROM_ENV) return;
  const { data } = await db.rpc("af_unit_own_key", { p_unit: UNIT });
  const kid = data?.key_id || "", sec = data?.secret || "";
  if (kid !== KEY_ID || sec !== SECRET) { KEY_ID = kid; SECRET = sec; hkey = null; }
  KEY = KEY_ID && SECRET ? "ok" : "";
}
async function sign(ts: string, method: string, path: string, body: string) {
  hkey = hkey || await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", hkey, enc.encode(ts + "." + method + "." + path + "." + body));
  return Array.from(new Uint8Array(sig)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const NO_KEY = "Kunci unit Pokama belum dibuat (Pokama → Mitra Affiliate → Pengaturan & API → Rentalaja)";

async function call(path: string, init: RequestInit = {}, signed = true) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);
  try {
    const method = (init.method || "GET").toUpperCase(); const body = typeof init.body === "string" ? init.body : "";
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (signed && KEY) { const ts = String(Math.floor(Date.now() / 1000)); h["x-key-id"] = KEY_ID; h["x-timestamp"] = ts; h["x-signature"] = await sign(ts, method, path, body); }
    const r = await fetch(API + path, { ...init, method, signal: ctl.signal, headers: h });
    const t = await r.text(); let b: any = null; try { b = JSON.parse(t); } catch { b = { raw: t.slice(0, 300) }; }
    return { ok: r.ok, status: r.status, body: b };
  } finally { clearTimeout(tm); }
}

async function syncCodes(force: boolean) {
  const { data: s } = await db.from("ra_mitra_sync").select("*").eq("id", 1).maybeSingle();
  const now = Date.now(); const out: Record<string, unknown> = {};
  if (force || !s?.codes_ok || !s?.codes_at || now - new Date(s.codes_at).getTime() > 14 * 60e3) {
    const r = await call("/codes");
    if (r.ok && Array.isArray(r.body?.codes)) {
      const rows = r.body.codes.map((c: any) => ({
        code: String(c.kode || "").toUpperCase(), name: c.nama_mitra || c.kode, kind: c.jenis || null, city: c.kota || null,
        guest_discount: !!c.potongan_tamu, guest_pct: Number(c.potongan_tamu_pct || 0) || (c.potongan_tamu ? 5 : 0),
        address: c.alamat || null, maps: c.maps || null, internal: !!c.internal, products: c.produk || null,
        demo: false, active: true, synced_at: new Date().toISOString(),
      })).filter((x: any) => x.code);
      if (rows.length) { const { error } = await db.from("ra_mitra_codes").upsert(rows, { onConflict: "code" }); if (error) throw error; }
      // kode yang tidak ada lagi di Pokama → nonaktif (kode DEMO untuk uji tidak disentuh)
      const keep = rows.map((x: any) => x.code);
      let q = db.from("ra_mitra_codes").update({ active: false }).eq("demo", false).eq("active", true);
      if (keep.length) q = q.not("code", "in", "(" + keep.map((k: string) => '"' + k.replace(/"/g, "") + '"').join(",") + ")");
      await q;
      await db.from("ra_mitra_sync").update({ codes_at: new Date().toISOString(), codes_ok: true, codes_n: rows.length, key_ok: true, last_error: null }).eq("id", 1);
      out.codes = rows.length;
    } else {
      const msg = !KEY ? NO_KEY : "GET /codes gagal (" + r.status + "): " + JSON.stringify(r.body).slice(0, 200);
      await db.from("ra_mitra_sync").update({ codes_ok: false, key_ok: r.status === 401 || !KEY ? false : s?.key_ok, last_error: msg }).eq("id", 1);
      out.codes_error = msg;
    }
  }
  if (force || !s?.featured_at || now - new Date(s.featured_at).getTime() > 6 * 3600e3) {
    const r = await call("/featured", {}, !!KEY);
    if (r.ok && Array.isArray(r.body?.mitra)) {
      await db.from("ra_mitra_featured").delete().gte("id", 0);
      const rows = r.body.mitra.map((m: any) => ({ month: r.body.bulan || null, rank: m.peringkat || null, name: m.nama, kind: m.jenis || null, city: m.kota || null, code: m.kode || null, address: m.alamat || null }));
      if (rows.length) await db.from("ra_mitra_featured").insert(rows);
      await db.from("ra_mitra_sync").update({ featured_at: new Date().toISOString() }).eq("id", 1);
      out.featured = rows.length;
    }
  }
  return out;
}

async function flush() {
  const { data: rows, error } = await db.from("ra_mitra_outbox").select("id,payload,attempts,demo").is("sent_at", null)
    .lte("next_at", new Date().toISOString()).order("id").limit(200);
  if (error) throw error;
  if (!rows?.length) return { sent: 0 };
  const backoff = (a: number) => new Date(Date.now() + Math.min(6 * 3600e3, 60e3 * Math.pow(2, Math.min(a, 9)))).toISOString();
  const fail = async (ids: number[], msg: string) => {
    for (const r of rows.filter((x) => ids.includes(x.id))) {
      await db.from("ra_mitra_outbox").update({ attempts: r.attempts + 1, last_error: msg.slice(0, 500), next_at: backoff(r.attempts + 1) }).eq("id", r.id);
    }
  };
  if (!KEY) { await fail(rows.map((r) => r.id), NO_KEY); return { sent: 0, failed: rows.length, reason: "no_key" }; }
  let r;
  try { r = await call("/events", { method: "POST", body: JSON.stringify(rows.map((x) => x.payload)) }); }
  catch (e) { await fail(rows.map((x) => x.id), "Pokama tidak terjangkau: " + String((e as any)?.message || e)); return { sent: 0, failed: rows.length }; }
  if (!r.ok || !Array.isArray(r.body?.results)) {
    await fail(rows.map((x) => x.id), "POST /events " + r.status + ": " + JSON.stringify(r.body).slice(0, 300));
    if (r.status === 401) await db.from("ra_mitra_sync").update({ key_ok: false, last_error: "Kunci unit ditolak Pokama (401)" }).eq("id", 1);
    return { sent: 0, failed: rows.length, status: r.status };
  }
  let sent = 0, failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const res = r.body.results[i] || {};
    if (res.ditolak) { failed++; await fail([rows[i].id], "Ditolak Pokama: " + (res.error || "tanpa alasan")); }
    else { sent++; await db.from("ra_mitra_outbox").update({ sent_at: new Date().toISOString(), response: res, last_error: null }).eq("id", rows[i].id); }
  }
  await db.from("ra_mitra_sync").update({ flush_at: new Date().toISOString(), key_ok: true }).eq("id", 1);
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url); const force = u.searchParams.get("force") === "1";
  // pengaman: fungsi ini publik (dipanggil cron). Panggilan lebih rapat dari 60 detik diabaikan supaya tidak bisa dipakai membanjiri Pokama.
  const { data: st } = await db.from("ra_mitra_sync").select("flush_at,codes_at").eq("id", 1).maybeSingle();
  const last = Math.max(st?.flush_at ? new Date(st.flush_at).getTime() : 0, (globalThis as any).__raLast || 0);
  if (Date.now() - last < 60e3) return json({ skipped: "terlalu rapat" }, 429);
  (globalThis as any).__raLast = Date.now();
  await db.from("ra_mitra_sync").update({ flush_at: new Date().toISOString() }).eq("id", 1);
  try { await loadKey(); } catch (_) { /* tetap jalan; dicatat sebagai kunci belum ada */ }
  const out: Record<string, unknown> = { key: !!KEY, key_source: FROM_ENV ? "secret" : "pokama-db" };
  try { out.sync = await syncCodes(force); } catch (e) { out.sync_error = String((e as any)?.message || e); }
  try { out.flush = await flush(); } catch (e) { out.flush_error = String((e as any)?.message || e); }
  return json(out);
});

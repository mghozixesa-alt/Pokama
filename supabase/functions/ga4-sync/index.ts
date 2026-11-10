// Tarik data Google Analytics 4 (rentalaja.co.id) ke tabel mk_ga4_* untuk dashboard SEO Marketing Pokama.
// Dipanggil cron mk-ga4-sync tiap 06.00 WIB. Body opsional: {"days": 3} atau {"from":"2026-10-01","to":"2026-11-09"} (maks 120 hari).
// Kunci: secret GA4_SERVICE_ACCOUNT (isi file JSON service account). Properti: pk_settings.ga4_property_id atau secret GA4_PROPERTY_ID.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

function b64url(buf: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf as ArrayBuffer);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function googleToken(sa: { client_email: string; private_key: string; token_uri?: string }) {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const unsigned = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly", aud, iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const r = await fetch(aud, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + b64url(sig) }) });
  const j = await r.json();
  if (!r.ok) throw new Error("Login Google gagal: " + (j.error_description || j.error || r.status));
  return j.access_token as string;
}

async function report(token: string, prop: string, from: string, to: string, dims: string[], mets: string[]) {
  const rows: { d: string[]; m: number[] }[] = [];
  let offset = 0;
  while (true) {
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dateRanges: [{ startDate: from, endDate: to }], dimensions: dims.map((name) => ({ name })),
        metrics: mets.map((name) => ({ name })), limit: 100000, offset, keepEmptyRows: false }) });
    const j = await r.json();
    if (!r.ok) throw new Error("GA4: " + (j.error?.message || r.status));
    for (const x of j.rows || []) rows.push({ d: x.dimensionValues.map((v: any) => v.value), m: x.metricValues.map((v: any) => Number(v.value) || 0) });
    offset += (j.rows || []).length;
    if (!j.rows || offset >= (j.rowCount || 0)) break;
  }
  return rows;
}

const ymd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const jkt = (offsetDays: number) => { const d = new Date(Date.now() + 7 * 3600e3 + offsetDays * 86400e3); return d.toISOString().slice(0, 10); };

async function upsert(table: string, rows: Record<string, unknown>[], from: string, to: string) {
  const del = await sb.from(table).delete().gte("day", from).lte("day", to);
  if (del.error) throw new Error(`${table}: ${del.error.message}`);
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + 1000));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  let body: any = {};
  try { body = await req.json(); } catch { /* kosong */ }
  let from = body.from as string | undefined, to = body.to as string | undefined;
  const days = Math.min(Math.max(Number(body.days) || 3, 1), 120);
  if (!to) to = jkt(-1);
  if (!from) from = jkt(-days);
  if ((Date.parse(to) - Date.parse(from)) / 86400e3 > 120) return json({ ok: false, error: "Rentang maks 120 hari" }, 400);

  const log = async (ok: boolean, rows_in: number | null, error: string | null) =>
    await sb.from("mk_ga4_sync_log").insert({ ok, date_from: from, date_to: to, rows_in, error });

  try {
    const st = await sb.from("pk_settings").select("value").eq("key", "ga4_property_id").maybeSingle();
    const prop = String(st.data?.value ?? "").replace(/\D/g, "") || (Deno.env.get("GA4_PROPERTY_ID") || "").replace(/\D/g, "");
    const saRaw = Deno.env.get("GA4_SERVICE_ACCOUNT");
    if (!prop) { await log(false, null, "ID properti GA4 belum diisi"); return json({ ok: false, error: "ID properti GA4 belum diisi" }, 400); }
    if (!saRaw) { await log(false, null, "Secret GA4_SERVICE_ACCOUNT belum diisi"); return json({ ok: false, error: "Secret GA4_SERVICE_ACCOUNT belum diisi" }, 400); }
    const token = await googleToken(JSON.parse(saRaw));

    const a = await report(token, prop, from, to, ["date", "sessionDefaultChannelGroup", "sessionSource", "sessionMedium"],
      ["sessions", "totalUsers", "newUsers", "engagedSessions", "screenPageViews"]);
    const p = await report(token, prop, from, to, ["date", "pagePath"], ["sessions", "screenPageViews", "totalUsers"]);
    const e = await report(token, prop, from, to, ["date", "eventName"], ["eventCount"]);

    await upsert("mk_ga4_daily", a.map((x) => ({ day: ymd(x.d[0]), channel: x.d[1] || "", source: x.d[2] || "", medium: x.d[3] || "",
      sessions: x.m[0], users: x.m[1], new_users: x.m[2], engaged: x.m[3], views: x.m[4] })), from, to);
    // halaman: gabungkan path yang sama setelah dipotong 300 karakter
    const pm = new Map<string, any>();
    for (const x of p) { const k = ymd(x.d[0]) + "|" + (x.d[1] || "/").slice(0, 300); const o = pm.get(k) || { day: ymd(x.d[0]), page: (x.d[1] || "/").slice(0, 300), sessions: 0, views: 0, users: 0 };
      o.sessions += x.m[0]; o.views += x.m[1]; o.users += x.m[2]; pm.set(k, o); }
    await upsert("mk_ga4_pages", [...pm.values()], from, to);
    await upsert("mk_ga4_events", e.map((x) => ({ day: ymd(x.d[0]), event_name: x.d[1], cnt: x.m[0] })), from, to);

    const n = a.length + pm.size + e.length;
    await log(true, n, null);
    return json({ ok: true, from, to, rows: n });
  } catch (err) {
    const msg = String((err as Error).message || err).slice(0, 500);
    await log(false, null, msg);
    return json({ ok: false, error: msg }, 500);
  }
});

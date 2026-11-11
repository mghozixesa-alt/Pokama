// Tarik data Google Search Console (rentalaja.co.id) ke tabel mk_gsc_* untuk Analitik SEO Marketing Pokama.
// Dipanggil cron mk-gsc-sync tiap 06.10 WIB. Body opsional: {"days": 7} atau {"from":"2026-08-01","to":"2026-11-09"} (maks 480 hari).
// Kunci: secret GA4_SERVICE_ACCOUNT (service account pokama-ga4, Restricted di Search Console). Properti: pk_settings.gsc_site_url.
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
    b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud, iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const r = await fetch(aud, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + b64url(sig) }) });
  const j = await r.json();
  if (!r.ok) throw new Error("Login Google gagal: " + (j.error_description || j.error || r.status));
  return j.access_token as string;
}

async function query(token: string, site: string, from: string, to: string, dims: string[]) {
  const rows: { keys: string[]; clicks: number; impressions: number; position: number }[] = [];
  let start = 0;
  while (true) {
    const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: from, endDate: to, dimensions: dims, rowLimit: 25000, startRow: start, dataState: "all" }) });
    const j = await r.json();
    if (!r.ok) throw new Error("Search Console: " + (j.error?.message || r.status));
    const got = j.rows || [];
    rows.push(...got);
    if (got.length < 25000) break;
    start += got.length;
  }
  return rows;
}

const jkt = (offsetDays: number) => { const d = new Date(Date.now() + 7 * 3600e3 + offsetDays * 86400e3); return d.toISOString().slice(0, 10); };

async function replace(table: string, rows: Record<string, unknown>[], from: string, to: string) {
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
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 480);
  if (!to) to = jkt(-1);
  if (!from) from = jkt(-days);

  const log = async (ok: boolean, rows_in: number | null, error: string | null) =>
    await sb.from("mk_gsc_sync_log").insert({ ok, date_from: from, date_to: to, rows_in, error });

  try {
    const st = await sb.from("pk_settings").select("value").eq("key", "gsc_site_url").maybeSingle();
    const site = String(st.data?.value ?? "").trim();
    const saRaw = Deno.env.get("GA4_SERVICE_ACCOUNT");
    if (!site) { await log(false, null, "Properti Search Console belum diisi"); return json({ ok: false, error: "Properti Search Console belum diisi" }, 400); }
    if (!saRaw) { await log(false, null, "Secret GA4_SERVICE_ACCOUNT belum diisi"); return json({ ok: false, error: "Secret GA4_SERVICE_ACCOUNT belum diisi" }, 400); }
    const token = await googleToken(JSON.parse(saRaw));

    // total per hari (termasuk kata kunci anonim yang tidak muncul di rincian)
    const t = await query(token, site, from, to, ["date"]);
    const r = await query(token, site, from, to, ["date", "query", "page"]);

    await replace("mk_gsc_totals", t.map((x) => ({ day: x.keys[0], clicks: x.clicks, impressions: x.impressions, position: Math.round(x.position * 10) / 10 })), from, to);
    const m = new Map<string, any>();
    for (const x of r) {
      const k = x.keys[0] + "|" + x.keys[1].slice(0, 300) + "|" + x.keys[2].slice(0, 500);
      const o = m.get(k) || { day: x.keys[0], query: x.keys[1].slice(0, 300), page: x.keys[2].slice(0, 500), clicks: 0, impressions: 0, position: 0 };
      o.position = (o.position * o.impressions + x.position * x.impressions) / Math.max(o.impressions + x.impressions, 1);
      o.clicks += x.clicks; o.impressions += x.impressions; m.set(k, o);
    }
    await replace("mk_gsc_rows", [...m.values()].map((o) => ({ ...o, position: Math.round(o.position * 10) / 10 })), from, to);

    const n = t.length + m.size;
    await log(true, n, null);
    return json({ ok: true, from, to, rows: n });
  } catch (err) {
    const msg = String((err as Error).message || err).slice(0, 500);
    await log(false, null, msg);
    return json({ ok: false, error: msg }, 500);
  }
});

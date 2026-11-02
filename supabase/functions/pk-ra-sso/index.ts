// Sistem Kerja Pokama · masuk ke Rentalaja App tanpa login & verifikasi 2 langkah kedua.
// Hanya untuk modul "Dashboard Manajemen" (ra_mgmt) dan "Aset" (ra_aset).
// Syarat: pemanggil sudah masuk Sistem Kerja dengan 2 langkah (pk_me tidak null) dan punya akun staf Rentalaja
// dengan peran yang sesuai (pk_ra_sso_target). Hasilnya sesi baru (terpisah dari sesi Sistem Kerja) yang
// dicatat di app.sso_sessions, sehingga Rentalaja App menganggapnya setara 2 langkah selama 12 jam.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RA_BASE = Deno.env.get("RA_APP_URL") || "https://demo.rentalaja.co.id";
const ORIGINS = ["https://app.pokama.org", "https://pokama.org", "https://demo.pokama.org"];
const HOURS = 12;

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function claims(jwt: string): Record<string, unknown> {
  try { const p = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4))); } catch { return {}; }
}

Deno.serve(async (req) => {
  const H = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: H });
  try {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return out(401, { error: "Belum masuk" });
    const { target } = await req.json().catch(() => ({}));
    if (target !== "ra_mgmt" && target !== "ra_aset") return out(400, { error: "Modul tidak dikenal" });

    // 1) pemanggil harus anggota Sistem Kerja dengan 2 langkah
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
    const { data: me } = await asUser.rpc("pk_me");
    if (!me) return out(403, { error: "Masuk Sistem Kerja dulu (dengan verifikasi 2 langkah)" });
    const { data: u } = await asUser.auth.getUser(jwt);
    const user = u?.user;
    if (!user?.email) return out(403, { error: "Akun tidak dikenali" });

    // 2) akun ini punya peran staf Rentalaja yang sesuai?
    const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: screen } = await db.rpc("pk_ra_sso_target", { p_user: user.id, p_target: target });
    if (!screen) return out(403, { error: "Akun Anda belum punya akses modul ini di Rentalaja. Minta owner menambahkan di Pengguna dan peran." });

    // 3) sesi baru untuk Rentalaja App (tidak berbagi refresh token dengan Sistem Kerja)
    const { data: link, error: e1 } = await db.auth.admin.generateLink({ type: "magiclink", email: user.email });
    if (e1 || !link?.properties?.hashed_token) return out(500, { error: "Gagal membuat sesi" });
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: v, error: e2 } = await anon.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
    const s = v?.session;
    if (e2 || !s) return out(500, { error: "Gagal membuat sesi" });
    const sid = String(claims(s.access_token).session_id || "");
    if (!sid) return out(500, { error: "Sesi tidak lengkap" });
    const exp = new Date(Date.now() + HOURS * 3600e3).toISOString();
    const { error: e3 } = await db.rpc("pk_ra_sso_register", { p_session: sid, p_user: user.id, p_expires: exp });
    if (e3) return out(500, { error: "Gagal mencatat sesi" });

    const frag = new URLSearchParams({
      access_token: s.access_token, refresh_token: s.refresh_token, expires_in: String(s.expires_in || 3600),
      expires_at: String(s.expires_at || ""), token_type: "bearer", sso: "pokama", next: String(screen),
    });
    return out(200, { url: RA_BASE + "/#" + frag.toString(), screen });
  } catch (e) {
    return out(500, { error: String((e as Error).message || e) });
  }
});

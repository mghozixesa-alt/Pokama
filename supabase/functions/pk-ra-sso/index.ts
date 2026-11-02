// Sistem Kerja Pokama · masuk ke Rentalaja App tanpa login & verifikasi 2 langkah kedua.
// Untuk modul Rentalaja di Sistem Kerja (ra_*): Operasional, CS, Lapangan, Cabang (Garut Kota, Wanaraja, Bandung, Maripoto), Aset, Teknisi.
// Owner membuka panel peran itu (pratinjau); modul cabang dikunci ke cabangnya (br).
// pk_ops: masuk Kerja Lapangan (ops.pokama.org) dari app.pokama.org tanpa login lagi.
// ra_kerja + assign: staf lapangan dari Sistem Kerja Operasional membuka panel penugasannya (pk_ra_ops_start).
// Syarat: pemanggil sudah masuk Sistem Kerja dengan 2 langkah (pk_me tidak null) dan punya akun staf Rentalaja
// dengan peran yang sesuai (pk_ra_sso_target). Hasilnya sesi baru (terpisah dari sesi Sistem Kerja) yang
// dicatat di app.sso_sessions, sehingga Rentalaja App menganggapnya setara 2 langkah selama 12 jam.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RA_BASE = Deno.env.get("RA_APP_URL") || "https://demo.rentalaja.co.id";
const ORIGINS = ["https://app.pokama.org", "https://ops.pokama.org", "https://pokama.org", "https://demo.pokama.org"];
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
    const { target, assign } = await req.json().catch(() => ({}));
    if (typeof target !== "string" || !/^(ra_[a-z]{2,6}|pk_ops)$/.test(target)) return out(400, { error: "Modul tidak dikenal" });
    if (target === "ra_kerja" && (typeof assign !== "string" || !/^[0-9a-f-]{36}$/i.test(assign))) return out(400, { error: "Penugasan tidak dikenal" });

    // 1) pemanggil harus anggota Sistem Kerja dengan 2 langkah
    const asUser = createClient(URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
    // petugas lapangan (tanpa Authenticator) hanya boleh membuka panel penugasannya; selain itu wajib Sistem Kerja 2 langkah
    const { data: me } = await asUser.rpc(target === "ra_kerja" ? "ops_me" : "pk_me");
    if (!me) return out(403, { error: "Masuk Sistem Kerja dulu (dengan verifikasi 2 langkah)" });
    const { data: u } = await asUser.auth.getUser(jwt);
    const user = u?.user;
    if (!user?.email) return out(403, { error: "Akun tidak dikenali" });

    // 2) akun ini punya peran staf Rentalaja yang sesuai?
    const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
    // pk_ops: pindah dari app.pokama.org ke Kerja Lapangan (ops.pokama.org) tanpa login & 2 langkah lagi
    const tgt = target === "pk_ops" ? { screen: "ops" } : (target === "ra_kerja"
      ? (await db.rpc("pk_ra_ops_start", { p_user: user.id, p_assign: assign })).data
      : (await db.rpc("pk_ra_sso_target", { p_user: user.id, p_target: target })).data);
    // ra_kerja: staf lapangan membuka panel sesuai penugasan hari ini (peran & cabang akun Rentalaja disamakan dulu)
    const screen = tgt?.screen;
    if (!screen) return out(403, { error: target === "ra_kerja" ? "Penugasan ini tidak aktif hari ini. Hubungi Operasional." : "Akun Anda belum punya akses modul ini di Rentalaja. Minta owner menambahkan di Pengguna dan peran." });

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

    if (target === "pk_ops") {
      const f2 = new URLSearchParams({ access_token: s.access_token, refresh_token: s.refresh_token, expires_in: String(s.expires_in || 3600), token_type: "bearer", sso: "pokama" });
      return out(200, { url: "https://ops.pokama.org/#" + f2.toString(), screen: "ops" });
    }
    const frag = new URLSearchParams({
      access_token: s.access_token, refresh_token: s.refresh_token, expires_in: String(s.expires_in || 3600),
      expires_at: String(s.expires_at || ""), token_type: "bearer", sso: "pokama", next: String(screen), mod: String(tgt.mod || ""), ...(tgt.as ? { as: String(tgt.as) } : {}), ...(tgt.br ? { br: String(tgt.br) } : {}), ...(target === "ra_kerja" ? { from: "ops" } : {}),
    });
    return out(200, { url: RA_BASE + "/#" + frag.toString(), screen });
  } catch (e) {
    return out(500, { error: String((e as Error).message || e) });
  }
});

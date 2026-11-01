// Program Mitra Affiliate Pokama · kirim kode masuk 6 digit ke email mitra.
// POST { email } → kode dikirim lewat Brevo/Resend (kunci sama dengan pk-notify).
// Tanpa kunci layanan email: memakai email bawaan Supabase (berisi link masuk).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const anon = createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
const BREVO = Deno.env.get("BREVO_API_KEY") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("PK_MAIL_FROM") || "notifikasi@pokama.org";
const CORS: Record<string, string> = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

function mail(code: string, name: string) {
  return `<!doctype html><html><body style="margin:0;background:#F4F6F9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1F2B4D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #E6E8EC;border-radius:16px">
<tr><td style="padding:22px 24px 4px"><span style="font-size:20px;font-weight:900;color:#1D3149">poka<span style="color:#09BEAF">ma</span></span> <span style="font-size:12px;color:#5B6573">· Program Mitra</span></td></tr>
<tr><td style="padding:10px 24px"><div style="font-size:15px">Halo ${name.replace(/[<>&"]/g, "")},</div><p style="font-size:14px;color:#4A5468">Kode masuk portal mitra Anda:</p>
<div style="font-size:34px;font-weight:900;letter-spacing:.3em;color:#077A70;padding:8px 0">${code}</div>
<p style="font-size:13px;color:#5B6573">Berlaku 1 jam. Jangan berikan kode ini kepada siapa pun, termasuk yang mengaku dari Rentalaja.</p></td></tr>
<tr><td style="padding:12px 24px 20px;border-top:1px solid #EEF0F3;font-size:12px;color:#8A94A3">Email otomatis dari pokama.org/mitra</td></tr>
</table></td></tr></table></body></html>`;
}

async function send(to: string, subject: string, html: string) {
  const r = BREVO
    ? await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: "Program Mitra Pokama", email: FROM_EMAIL }, to: [{ email: to }], subject, htmlContent: html }) })
    : await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `Program Mitra Pokama <${FROM_EMAIL}>`, to: [to], subject, html }) });
  if (!r.ok) throw new Error("Email gagal dikirim: " + (await r.text()).slice(0, 200));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Pakai POST" }, 405);
  let email = "";
  try { email = String((await req.json())?.email || "").trim().toLowerCase(); } catch { /* */ }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Email belum benar" }, 400);

  const { data: p } = await db.from("af_partners").select("id,name,status").ilike("email", email).neq("status", "ditolak").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!p) return json({ error: "Email ini belum terdaftar sebagai mitra. Daftar dulu di halaman depan." }, 404);

  // batas kirim: 1 per menit, 6 per jam per email
  const since = new Date(Date.now() - 3600e3).toISOString();
  const { data: sent } = await db.from("af_audit").select("at").eq("action", "kirim_kode").eq("target", email).gte("at", since).order("at", { ascending: false });
  if (sent && sent.length >= 6) return json({ error: "Terlalu sering meminta kode. Coba lagi 1 jam lagi." }, 429);
  if (sent && sent[0] && Date.now() - new Date(sent[0].at).getTime() < 60e3) return json({ error: "Tunggu 1 menit sebelum meminta kode lagi." }, 429);
  await db.from("af_audit").insert({ action: "kirim_kode", target: email });

  if (!BREVO && !RESEND) {
    const { error } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: "https://pokama.org/mitra/" } });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, mode: "link" });
  }
  // pastikan akun login ada, lalu buat kode tanpa mengirim email bawaan
  await db.auth.admin.createUser({ email, email_confirm: true }).catch(() => null);
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.email_otp) return json({ error: error?.message || "Gagal membuat kode" }, 500);
  try { await send(email, `Kode masuk mitra: ${data.properties.email_otp}`, mail(data.properties.email_otp, p.name)); }
  catch (e) { return json({ error: (e as Error).message }, 502); }
  return json({ ok: true, mode: "code" });
});

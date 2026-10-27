// Sistem Kerja Pokama · membuat akun email + password untuk orang management.
// Hanya CEO atau Kepala Staf. Akun CEO, Kepala Staf, dan Keuangan hanya bisa diatur CEO.
// Reset password hanya untuk akun yang sudah tertaut ke orang itu; email yang sudah dipakai akun lain ditolak.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "https://pokama.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function tempPassword() {
  const words = ["garut", "kopi", "rental", "trip", "niaga", "pokama", "cimanuk", "papandayan", "guntur", "kawah"];
  const a = new Uint32Array(3); crypto.getRandomValues(a);
  return words[a[0] % words.length] + "-" + words[a[1] % words.length] + "-" + String(1000 + (a[2] % 9000));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const asUser = createClient(URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: role, error: re } = await asUser.rpc("pk_role");
  if (re || !(role === "ceo" || role === "kepala_staf")) return json({ error: "Hanya CEO atau Kepala Staf yang bisa membuat akun" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Data tidak valid" }, 400); }
  if (body.action !== "create" && body.action !== "reset") return json({ error: "Aksi tidak dikenal" }, 400);
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { data: person } = await admin.from("pk_people").select("id,name,email,user_id,role,is_active").eq("id", body.person_id).maybeSingle();
  if (!person || !person.is_active) return json({ error: "Orang tidak ditemukan" }, 404);
  if (["ceo", "kepala_staf", "keuangan"].includes(person.role) && role !== "ceo") return json({ error: "Akun CEO, Kepala Staf, dan Keuangan hanya bisa diatur CEO" }, 403);
  const password = tempPassword();

  // Sudah punya akun: hanya buat password baru untuk akun itu.
  if (person.user_id) {
    const { data: u, error } = await admin.auth.admin.updateUserById(person.user_id, { password });
    if (error) return json({ error: "Gagal mengatur password: " + error.message }, 500);
    return json({ ok: true, email: u.user?.email || person.email, password, name: person.name });
  }

  // Belum punya akun: buat akun baru dengan email ini.
  const email = String(body.email || person.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Isi email yang benar dulu" }, 400);
  const { data: found } = await admin.rpc("find_user_by_email", { p_email: email });
  if ((found as any)?.[0]?.id) return json({ error: "Email ini sudah dipakai akun lain. Pakai email lain untuk Sistem Kerja Pokama." }, 409);
  const { data: dup } = await admin.from("pk_people").select("id").ilike("email", email).neq("id", person.id).limit(1);
  if (dup && dup.length) return json({ error: "Email ini sudah dipakai orang lain di Tim & Peran" }, 409);
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: person.name, app: "pokama" } });
  if (error) return json({ error: "Gagal membuat akun: " + error.message }, 500);
  const { error: ue } = await admin.from("pk_people").update({ email, user_id: created.user!.id }).eq("id", person.id);
  if (ue) return json({ error: "Akun dibuat tapi gagal menautkan: " + ue.message }, 500);
  return json({ ok: true, email, password, name: person.name });
});

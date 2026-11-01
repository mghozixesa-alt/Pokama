// Program Mitra Affiliate Pokama · API untuk aplikasi unit (Rentalaja, TripinAja, Niagaaja).
// Semua panggilan memakai kunci rahasia per unit di header  x-unit-key  (dibuat CEO/Keuangan di pokama.org/mitra/admin).
//   GET  /af-api/codes      daftar kode mitra aktif (panggil tiap 15 menit, simpan sebagai cache)
//   POST /af-api/events     satu event atau array event booking (idempoten)
//   GET  /af-api/featured   daftar Mitra Unggulan bulan lalu untuk website unit
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-unit-key, content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const path = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop() || "";
  const key = req.headers.get("x-unit-key") || "";
  if (!key) return json({ error: "Header x-unit-key wajib diisi" }, 401);
  const { data: unit, error: e1 } = await db.rpc("af_unit_by_key", { p_key: key });
  if (e1) return json({ error: "Gagal memeriksa kunci" }, 500);
  if (!unit) return json({ error: "Kunci unit tidak dikenal atau unit nonaktif" }, 401);

  try {
    if (req.method === "GET" && path === "codes") {
      const { data, error } = await db.rpc("af_api_codes", { p_unit: unit });
      if (error) throw error;
      return json(data);
    }
    if (req.method === "GET" && path === "featured") {
      const { data, error } = await db.rpc("af_api_featured", { p_unit: unit });
      if (error) throw error;
      return json(data);
    }
    if (req.method === "POST" && path === "events") {
      let body: unknown;
      try { body = await req.json(); } catch { return json({ error: "Body harus JSON" }, 400); }
      const events = Array.isArray(body) ? body : (body as any)?.events ?? body;
      const { data, error } = await db.rpc("af_api_events", { p_unit: unit, p_events: events });
      if (error) throw error;
      return json(data);
    }
    return json({ error: "Alamat tidak dikenal. Pakai GET /codes, POST /events, GET /featured" }, 404);
  } catch (err) {
    return json({ error: (err as any)?.message || String(err) }, 400);
  }
});

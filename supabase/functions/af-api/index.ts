// Program Mitra Affiliate Pokama · API untuk aplikasi unit (Rentalaja, TripinAja, Niagaaja).
// Setiap permintaan WAJIB ditandatangani:
//   x-key-id     : id kunci unit (dibuat Owner/Keuangan di pokama.org/mitra/admin → Pengaturan & API)
//   x-timestamp  : detik unix saat ini (selisih maks 5 menit)
//   x-signature  : hex(HMAC-SHA256(rahasia, "<x-timestamp>.<METODE>.<path>.<body mentah>"))
//                  path = bagian setelah /af-api, mis. "/events" atau "/code?kode=VKTEH"; body kosong untuk GET.
//   GET  /codes            daftar kode mitra aktif (tiap 15 menit, simpan sebagai cache di server unit)
//   GET  /code?kode=XXXX   cek satu kode di checkout (dibatasi; tebakan salah beruntun → diblokir)
//   POST /events           satu event atau array event booking (idempoten)
//   GET  /featured         daftar Mitra Unggulan (nama + kota) untuk website
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-key-id, x-timestamp, x-signature, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const i = url.pathname.indexOf("/af-api");
  const sub = (i >= 0 ? url.pathname.slice(i + 7) : url.pathname).replace(/\/+$/, "") || "/";
  const path = sub + url.search;
  const body = req.method === "POST" ? await req.text() : "";
  if (body.length > 1_000_000) return json({ error: "Body terlalu besar (maks 1 MB)" }, 413);

  // daftar Mitra Unggulan boleh tanpa tanda tangan (publik: nama + kota saja)
  if (req.method === "GET" && sub === "/featured" && !req.headers.get("x-key-id")) {
    const { data, error } = await db.rpc("af_api_featured", { p_unit: null });
    return error ? json({ error: "Gagal" }, 500) : json(data);
  }

  const { data: v, error: ve } = await db.rpc("af_api_verify", {
    p_key_id: req.headers.get("x-key-id") || "", p_ts: req.headers.get("x-timestamp") || "", p_sig: req.headers.get("x-signature") || "",
    p_method: req.method, p_path: path, p_body: body,
  });
  if (ve) return json({ error: "Gagal memeriksa tanda tangan" }, 500);
  if (!v?.unit) return json({ error: v?.error || "Tidak berwenang" }, v?.status || 401);
  const unit = v.unit as string;
  const keyId = req.headers.get("x-key-id")!;

  try {
    if (req.method === "GET" && sub === "/codes") {
      const { data, error } = await db.rpc("af_api_codes", { p_unit: unit }); if (error) throw error; return json(data);
    }
    if (req.method === "GET" && sub === "/code") {
      const { data, error } = await db.rpc("af_api_code", { p_unit: unit, p_key_id: keyId, p_code: url.searchParams.get("kode") || "" }); if (error) throw error;
      return json(data, data?.error ? 429 : 200);
    }
    if (req.method === "GET" && sub === "/featured") {
      const { data, error } = await db.rpc("af_api_featured", { p_unit: unit }); if (error) throw error; return json(data);
    }
    if (req.method === "POST" && sub === "/events") {
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { return json({ error: "Body harus JSON" }, 400); }
      const events = Array.isArray(parsed) ? parsed : (parsed as any)?.events ?? parsed;
      const { data, error } = await db.rpc("af_api_events", { p_unit: unit, p_events: events }); if (error) throw error; return json(data);
    }
    return json({ error: "Alamat tidak dikenal. Pakai GET /codes, GET /code?kode=, POST /events, GET /featured" }, 404);
  } catch (err) {
    return json({ error: (err as any)?.message || String(err) }, 400);
  }
});

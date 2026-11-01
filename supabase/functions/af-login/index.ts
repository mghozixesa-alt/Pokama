// Dinonaktifkan 1 Nov 2026: login mitra kini lewat Google + kode WhatsApp (lihat 025_af_keamanan.sql).
Deno.serve(() => new Response(JSON.stringify({ error: "Login mitra kini memakai tombol Masuk dengan Google di pokama.org/mitra" }), { status: 410, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }));

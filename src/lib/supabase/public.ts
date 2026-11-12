import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Klien tanpa cookie untuk data publik (unit tersedia, sertifikat).
 * Tidak membaca sesi, sehingga halaman bisa di-cache (ISR) dan tidak
 * menunggu round-trip auth di tiap kunjungan.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

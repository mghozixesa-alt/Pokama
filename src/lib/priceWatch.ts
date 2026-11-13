import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWa } from "./wa";
import { rupiah } from "./format";

const RANK = { A: 3, B: 2, C: 1 } as const;
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app";

type U = { id: string; public_id: string; category: string; brand: string; model: string; variant: string | null; grade: "A" | "B" | "C" | null; price_sell: number; status: string };

/**
 * Cocokkan unit yang baru tersedia dengan pantauan harga pelanggan, lalu kirim WhatsApp.
 * Aturan cocok: kategori sama (atau kosong), kata di model_query ada di "merek model varian",
 * grade unit ≥ grade minimal, harga ≤ harga maksimal (bila diisi). Satu pantauan dikabari maks 1× per 3 hari.
 */
export async function notifyPriceWatches(supabase: SupabaseClient, u: U): Promise<number> {
  if (u.status !== "tersedia") return 0;
  const { data: watches } = await supabase.from("price_watches").select("id, customer_id, category, model_query, grade, target_price, last_notified_at, profiles(phone)").or(`category.is.null,category.eq.${u.category}`);
  if (!watches?.length) return 0;
  const hay = `${u.brand} ${u.model} ${u.variant ?? ""}`.toLowerCase();
  const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
  let sent = 0;
  for (const w of watches as unknown as { id: string; model_query: string | null; grade: "A" | "B" | "C" | null; target_price: number | null; last_notified_at: string | null; profiles: { phone: string | null } | null }[]) {
    const words = (w.model_query ?? "").toLowerCase().split(/\s+/).filter((x) => x.length > 1);
    if (words.length && !words.every((x) => hay.includes(x))) continue;
    if (w.grade && u.grade && RANK[u.grade] < RANK[w.grade]) continue;
    if (w.target_price && u.price_sell > w.target_price) continue;
    if (w.last_notified_at && new Date(w.last_notified_at).getTime() > cutoff) continue;
    const ok = await sendWa(w.profiles?.phone, `Niagaaja: unit yang Anda pantau sudah masuk — ${u.brand} ${u.model}${u.variant ? ` ${u.variant}` : ""}, grade ${u.grade ?? "-"}, ${rupiah(u.price_sell)}. Lihat & booking: ${site()}/unit/${u.public_id}`);
    await supabase.from("price_watches").update({ last_notified_at: new Date().toISOString() }).eq("id", w.id);
    if (ok) sent++;
  }
  return sent;
}

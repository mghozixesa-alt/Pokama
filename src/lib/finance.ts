import { createHmac } from "crypto";

/**
 * Webhook ke modul Keuangan Pokama. Tanpa POKAMA_FINANCE_WEBHOOK_URL → hanya dicatat di log.
 * Tanda tangan: header X-Niagaaja-Signature = HMAC-SHA256(body, POKAMA_WEBHOOK_SECRET), hex.
 * Event: payment_confirmed (penjualan), trade_in_paid (pembelian stok), consignment_income (bagi hasil titipan).
 */
export type FinanceEvent =
  | { type: "payment_confirmed"; ref: string; unit: string; amount: number; method: string; customer?: string | null; margin?: number | null }
  | { type: "trade_in_paid"; ref: string; item: string; amount: number; customer?: string | null }
  | { type: "consignment_income"; ref: string; unit?: string; amount: number; period?: unknown; split: { rentalaja: number; owner: number; niagaaja: number } };

export async function postFinance(ev: FinanceEvent): Promise<boolean> {
  const url = process.env.POKAMA_FINANCE_WEBHOOK_URL;
  const body = JSON.stringify({ source: "niagaaja", sent_at: new Date().toISOString(), ...ev });
  if (!url) { console.log(`[finance:skip] ${body.slice(0, 160)}`); return false; }
  const sig = createHmac("sha256", process.env.POKAMA_WEBHOOK_SECRET ?? "").update(body).digest("hex");
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Niagaaja-Signature": sig }, body, signal: AbortSignal.timeout(8000) });
    if (!res.ok) console.error("[finance] webhook", res.status);
    return res.ok;
  } catch (e) { console.error("[finance:error]", e); return false; }
}

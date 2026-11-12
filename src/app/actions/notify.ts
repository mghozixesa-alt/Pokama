"use server";
import { createClient } from "@/lib/supabase/server";
import { sendWaAdmin, WA } from "@/lib/wa";
import { rupiah } from "@/lib/format";
import { transferAmount } from "@/lib/pricing";

/** Dipanggil klien setelah pelanggan mengunggah bukti transfer. Hanya untuk pesanan miliknya sendiri (RLS). */
export async function notifyProofReceived(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("public_id, amount, unique_code, profiles(full_name)").eq("id", orderId).maybeSingle();
  const o = data as unknown as { public_id: string; amount: number; unique_code: number; profiles: { full_name: string | null } | null } | null;
  if (!o) return;
  await sendWaAdmin(WA.proofReceived(o.public_id, o.profiles?.full_name ?? "pelanggan", rupiah(transferAmount(o.amount, o.unique_code))));
}

/** Dipanggil klien setelah tawaran dikirim. */
export async function notifyNewOffer(offerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("offers").select("amount, profiles(full_name), units(brand, model, public_id)").eq("id", offerId).maybeSingle();
  const o = data as unknown as { amount: number; profiles: { full_name: string | null } | null; units: { brand: string; model: string; public_id: string } | null } | null;
  if (!o?.units) return;
  await sendWaAdmin(WA.newOffer(`${o.units.brand} ${o.units.model} (${o.units.public_id})`, rupiah(o.amount), o.profiles?.full_name ?? "pelanggan"));
}

"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk");

  const unitId = String(formData.get("unit_id"));
  const publicId = String(formData.get("public_id"));
  const offerId = formData.get("offer_id") ? String(formData.get("offer_id")) : null;
  const fulfillment = String(formData.get("fulfillment")) === "kirim" ? "kirim" : "ambil_di_toko";
  const method = String(formData.get("method")) === "tunai" ? "tunai" : "transfer";
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("shipping_address") ?? "").trim() || null;

  await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);

  // Harga: tawaran disetujui (jika masih berlaku) atau harga jual saat ini
  const { data: unit } = await supabase.from("units").select("id, price_sell, status").eq("id", unitId).single();
  if (!unit || unit.status !== "tersedia") redirect(`/unit/${publicId}?gagal=tidak_tersedia`);
  let amount = unit.price_sell;
  if (offerId) {
    const { data: offer } = await supabase.from("offers").select("amount, counter_amount, status, expires_at").eq("id", offerId).eq("customer_id", user.id).single();
    if (offer && offer.status === "disetujui" && offer.expires_at && new Date(offer.expires_at) > new Date()) amount = offer.counter_amount ?? offer.amount;
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({ unit_id: unitId, customer_id: user.id, offer_id: offerId, amount, fulfillment, shipping_address: address, notes: `bayar: ${method}` })
    .select("id, public_id")
    .single();
  if (error || !order) redirect(`/unit/${publicId}?gagal=${encodeURIComponent(error?.message ?? "booking")}`);

  await supabase.from("payments").insert({ order_id: order.id, method, amount });
  if (offerId) await supabase.from("offers").update({ status: "dipakai" }).eq("id", offerId);

  redirect(`/pesanan/${order.public_id}`);
}

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendWa, WA } from "@/lib/wa";
import { notifyPriceWatches } from "@/lib/priceWatch";
import { rupiah, ORDER_STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

async function staff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Belum masuk");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!p?.role || !["admin", "qc", "cs"].includes(p.role)) throw new Error("Bukan staf");
  return { supabase, user };
}

const num = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").replace(/[^\d]/g, ""); return v ? Number(v) : null; };
const str = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").trim(); return v || null; };

export async function upsertUnit(formData: FormData) {
  const { supabase } = await staff();
  const id = str(formData, "id");
  const specs: Record<string, string | number> = {};
  for (const key of ["storage", "battery_health", "color", "kelengkapan", "cpu", "ram", "layar", "shutter_count", "megapixel", "lensa", "stik"]) {
    const v = str(formData, `spec_${key}`);
    if (v) specs[key] = ["battery_health", "shutter_count", "megapixel", "stik"].includes(key) ? Number(v) : v;
  }
  const photos = String(formData.get("photos") ?? "").split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  const unit = {
    category: str(formData, "category"),
    brand: str(formData, "brand"),
    model: str(formData, "model"),
    variant: str(formData, "variant"),
    specs,
    condition_note: str(formData, "condition_note"),
    price_new: num(formData, "price_new"),
    price_sell: num(formData, "price_sell") ?? 0,
    price_floor: num(formData, "price_floor"),
    source: str(formData, "source") ?? "beli_pelanggan",
    rentalaja_asset_id: str(formData, "rentalaja_asset_id"),
    status: str(formData, "status") ?? "masuk",
    branch: str(formData, "branch") ?? "garut_kota",
    photos,
    is_hot: formData.get("is_hot") === "on",
    hot_label: str(formData, "hot_label"),
  };
  let unitId = id;
  let becameAvailable = unit.status === "tersedia";
  if (id) {
    const { data: before } = await supabase.from("units").select("status").eq("id", id).maybeSingle();
    becameAvailable = unit.status === "tersedia" && before?.status !== "tersedia";
    const { error } = await supabase.from("units").update(unit).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("units").insert(unit).select("id").single();
    if (error) throw new Error(error.message);
    unitId = data.id;
  }
  // Kabari pelanggan yang memantau model ini (hanya saat unit baru jadi "tersedia")
  if (becameAvailable && unitId) {
    const { data: full } = await supabase.from("units").select("id, public_id, category, brand, model, variant, grade, price_sell, status").eq("id", unitId).single();
    if (full) { try { await notifyPriceWatches(supabase, full); } catch (e) { console.error("[pantau]", e); } }
  }
  // kepemilikan aktif
  const ownerType = str(formData, "owner_type") ?? "sendiri";
  const own = {
    unit_id: unitId!,
    owner_type: ownerType,
    owner_id: str(formData, "owner_id"),
    cost_basis: num(formData, "cost_basis") ?? 0,
    share_owner_pct: num(formData, "share_owner_pct") ?? (ownerType === "sendiri" ? 0 : 70),
    share_niagaaja_pct: num(formData, "share_niagaaja_pct") ?? (ownerType === "sendiri" ? 100 : 30),
  };
  const { data: existing } = await supabase.from("ownerships").select("id").eq("unit_id", unitId!).eq("active", true).maybeSingle();
  if (existing) await supabase.from("ownerships").update(own).eq("id", existing.id);
  else await supabase.from("ownerships").insert(own);

  revalidatePath("/admin/stok"); revalidatePath("/"); revalidatePath("/katalog");
  redirect(`/admin/stok/${unitId}`);
}

export async function createInspection(formData: FormData) {
  const { supabase, user } = await staff();
  const unitId = String(formData.get("unit_id"));
  const labels = ["Fisik & bodi", "Layar & touch", "Baterai", "Kamera & audio", "Konektivitas", "Tombol & port", "Akun & IMEI/serial", "Kelengkapan"];
  const checklist = labels.map((label, i) => ({ step: i + 1, label, status: String(formData.get(`s${i + 1}`) ?? "lolos"), note: str(formData, `n${i + 1}`) ?? undefined }));
  const grade = String(formData.get("result_grade") ?? "A");
  const { count } = await supabase.from("inspections").select("id", { count: "exact", head: true });
  const ym = new Date().toISOString().slice(2, 7).replace("-", "");
  const certificate_no = `NJC-${ym}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const { error } = await supabase.from("inspections").insert({ unit_id: unitId, checklist, result_grade: grade, inspector_id: user.id, certificate_no, disclosed_source: true });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/stok/${unitId}`); revalidatePath("/"); revalidatePath("/katalog");
  redirect(`/admin/stok/${unitId}`);
}

export async function confirmPayment(formData: FormData) {
  const { supabase, user } = await staff();
  const paymentId = String(formData.get("payment_id"));
  const orderId = String(formData.get("order_id"));
  const action = String(formData.get("action"));
  const { data: o } = await supabase.from("orders").select("public_id, profiles(phone), units(brand, model)").eq("id", orderId).single();
  const ord = o as unknown as { public_id: string; profiles: { phone: string | null } | null; units: { brand: string; model: string } | null } | null;
  if (action === "terima") {
    await supabase.from("payments").update({ confirmed_by: user.id, paid_at: new Date().toISOString(), rejected_reason: null }).eq("id", paymentId);
    await supabase.from("orders").update({ status: "dibayar" }).eq("id", orderId);
    if (ord) await sendWa(ord.profiles?.phone, WA.paymentConfirmed(ord.public_id, `${ord.units?.brand ?? ""} ${ord.units?.model ?? ""}`.trim()));
  } else {
    const reason = str(formData, "reason") ?? "Bukti tidak sesuai";
    await supabase.from("payments").update({ rejected_reason: reason }).eq("id", paymentId);
    await supabase.from("orders").update({ status: "menunggu_bayar" }).eq("id", orderId);
    if (ord) await sendWa(ord.profiles?.phone, WA.paymentRejected(ord.public_id, reason));
  }
  revalidatePath("/admin/pembayaran"); revalidatePath("/admin");
}

export async function setOrderStatus(formData: FormData) {
  const { supabase } = await staff();
  const orderId = String(formData.get("order_id"));
  const status = String(formData.get("status"));
  const { data: o } = await supabase.from("orders").select("customer_id, amount, points_earned, status, public_id, profiles(phone)").eq("id", orderId).single();
  await supabase.from("orders").update({ status }).eq("id", orderId);
  if (o) {
    const ph = (o as unknown as { profiles: { phone: string | null } | null }).profiles?.phone;
    await sendWa(ph, WA.orderStatus(o.public_id, ORDER_STATUS_LABEL[status as OrderStatus] ?? status));
  }
  if (status === "selesai" && o && o.status !== "selesai" && !o.points_earned) {
    const pts = Math.floor(o.amount / 10000);
    await supabase.from("points_ledger").insert({ customer_id: o.customer_id, delta: pts, reason: "Pembelian selesai", order_id: orderId });
    await supabase.from("orders").update({ points_earned: pts }).eq("id", orderId);
  }
  revalidatePath("/admin/pesanan"); revalidatePath("/admin");
}

export async function answerOffer(formData: FormData) {
  const { supabase } = await staff();
  const id = String(formData.get("offer_id"));
  const action = String(formData.get("action"));
  const counter = num(formData, "counter_amount");
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data: of } = await supabase.from("offers").select("amount, profiles(phone), units(public_id, brand, model)").eq("id", id).single();
  const offer = of as unknown as { amount: number; profiles: { phone: string | null } | null; units: { public_id: string; brand: string; model: string } | null } | null;
  let result = "Ditolak";
  if (action === "setuju") { await supabase.from("offers").update({ status: "disetujui", expires_at: expires }).eq("id", id); result = `Disetujui ${rupiah(offer?.amount)}`; }
  else if (action === "counter" && counter) { await supabase.from("offers").update({ status: "disetujui", counter_amount: counter, expires_at: expires }).eq("id", id); result = `Disetujui dengan harga ${rupiah(counter)}`; }
  else await supabase.from("offers").update({ status: "ditolak" }).eq("id", id);
  if (offer?.units) await sendWa(offer.profiles?.phone, WA.offerAnswered(`${offer.units.brand} ${offer.units.model}`, result, offer.units.public_id));
  revalidatePath("/admin/tawaran"); revalidatePath("/admin");
}

export async function updateTradeIn(formData: FormData) {
  const { supabase } = await staff();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const final = num(formData, "final_price");
  const { data: t } = await supabase.from("trade_ins").select("brand, model, profiles(phone)").eq("id", id).single();
  await supabase.from("trade_ins").update({ status, final_price: final, scheduled_at: status === "dijadwalkan" ? new Date().toISOString() : undefined }).eq("id", id);
  const ph = (t as unknown as { profiles: { phone: string | null } | null } | null)?.profiles?.phone;
  if (t && ph && final) await sendWa(ph, `Niagaaja: pengajuan ${t.brand} ${t.model} — status ${status}${final ? `, harga ${rupiah(final)}` : ""}. Detail: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/tukar-tambah/${id}`);
  revalidatePath("/admin/tukar-tambah");
}

export async function updateClaim(formData: FormData) {
  const { supabase } = await staff();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const note = str(formData, "admin_note");
  const { data: c } = await supabase.from("service_claims").select("public_id, status, admin_note, profiles(phone)").eq("id", id).single();
  await supabase.from("service_claims").update({ status, admin_note: note, updated_at: new Date().toISOString() }).eq("id", id);
  const ph = (c as unknown as { profiles: { phone: string | null } | null } | null)?.profiles?.phone;
  if (c && ph && (c.status !== status || c.admin_note !== note)) {
    const LABEL: Record<string, string> = { diajukan: "diajukan", dijadwalkan: "dijadwalkan untuk dicek", dicek: "sedang dicek teknisi", diperbaiki: "diperbaiki tanpa biaya", ditukar: "ditukar dengan unit lain", ditolak: "di luar cakupan garansi", selesai: "selesai" };
    await sendWa(ph, `Niagaaja: klaim servis ${c.public_id} — ${LABEL[status] ?? status}.${note ? ` Catatan teknisi: ${note}.` : ""} Detail: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/servis`);
  }
  revalidatePath("/admin/servis");
}

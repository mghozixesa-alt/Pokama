"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  if (id) {
    const { error } = await supabase.from("units").update(unit).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("units").insert(unit).select("id").single();
    if (error) throw new Error(error.message);
    unitId = data.id;
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
  if (action === "terima") {
    await supabase.from("payments").update({ confirmed_by: user.id, paid_at: new Date().toISOString(), rejected_reason: null }).eq("id", paymentId);
    await supabase.from("orders").update({ status: "dibayar" }).eq("id", orderId);
  } else {
    await supabase.from("payments").update({ rejected_reason: str(formData, "reason") ?? "Bukti tidak sesuai" }).eq("id", paymentId);
    await supabase.from("orders").update({ status: "menunggu_bayar" }).eq("id", orderId);
  }
  revalidatePath("/admin/pembayaran"); revalidatePath("/admin");
}

export async function setOrderStatus(formData: FormData) {
  const { supabase } = await staff();
  const orderId = String(formData.get("order_id"));
  const status = String(formData.get("status"));
  const { data: o } = await supabase.from("orders").select("customer_id, amount, points_earned, status").eq("id", orderId).single();
  await supabase.from("orders").update({ status }).eq("id", orderId);
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
  if (action === "setuju") await supabase.from("offers").update({ status: "disetujui", expires_at: expires }).eq("id", id);
  else if (action === "counter" && counter) await supabase.from("offers").update({ status: "disetujui", counter_amount: counter, expires_at: expires }).eq("id", id);
  else await supabase.from("offers").update({ status: "ditolak" }).eq("id", id);
  revalidatePath("/admin/tawaran"); revalidatePath("/admin");
}

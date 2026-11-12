"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendWaAdmin, WA } from "@/lib/wa";

/** Estimasi kasar dari harga baru × faktor kondisi; final tetap setelah cek fisik. */
function estimate(priceNew: number | null, cond: Record<string, string>): [number | null, number | null] {
  if (!priceNew) return [null, null];
  let f = 0.55;
  if (cond.fisik === "mulus") f += 0.08; else if (cond.fisik === "rusak") f -= 0.15;
  if (cond.fungsi === "normal") f += 0.05; else if (cond.fungsi === "ada_masalah") f -= 0.2;
  if (cond.kelengkapan === "fullset") f += 0.04;
  const mid = priceNew * Math.max(0.15, f);
  const r = (n: number) => Math.round(n / 50000) * 50000;
  return [r(mid * 0.9), r(mid * 1.05)];
}

export async function submitTradeIn(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/tukar-tambah");
  const s = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const priceNew = Number(String(formData.get("price_new") ?? "").replace(/[^\d]/g, "")) || null;
  const condition = { fisik: s("fisik") ?? "", fungsi: s("fungsi") ?? "", kelengkapan: s("kelengkapan") ?? "", catatan: s("catatan") ?? "", mode: s("mode") ?? "jual", target_unit: s("target_unit") ?? "" };
  const [lo, hi] = estimate(priceNew, condition);
  const phone = s("phone");
  if (phone) await supabase.from("profiles").update({ phone }).eq("id", user.id);
  const { data, error } = await supabase.from("trade_ins").insert({
    customer_id: user.id, category: s("category") ?? "hp", brand: s("brand"), model: s("model"), variant: s("variant"),
    condition, estimate_low: lo, estimate_high: hi,
  }).select("id").single();
  if (error || !data) redirect(`/tukar-tambah?gagal=${encodeURIComponent(error?.message ?? "simpan")}`);
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  await sendWaAdmin(WA.tradeIn(prof?.full_name ?? "pelanggan", `${s("brand") ?? ""} ${s("model") ?? ""} ${s("variant") ?? ""}`.trim()));
  redirect(`/tukar-tambah/${data.id}`);
}

export async function submitPriceWatch(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/pantau-harga");
  const s = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const target = Number(String(formData.get("target_price") ?? "").replace(/[^\d]/g, "")) || null;
  const phone = s("phone");
  if (phone) await supabase.from("profiles").update({ phone }).eq("id", user.id);
  await supabase.from("price_watches").insert({ customer_id: user.id, category: s("category"), model_query: s("model_query"), grade: s("grade"), target_price: target });
  redirect("/pantau-harga?ok=1");
}

export async function deletePriceWatch(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("price_watches").delete().eq("id", String(formData.get("id")));
  redirect("/pantau-harga");
}

"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendWaAdmin } from "@/lib/wa";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app";

export async function submitClaim(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=/servis");
  const orderId = String(formData.get("order_id") ?? "") || null;
  const issue = String(formData.get("issue") ?? "").trim();
  if (!issue) redirect("/servis?gagal=Kendala%20wajib%20diisi");
  const phone = String(formData.get("phone") ?? "").trim();
  if (phone) await supabase.from("profiles").update({ phone }).eq("id", user.id);
  const { data, error } = await supabase.from("service_claims").insert({ order_id: orderId, customer_id: user.id, issue }).select("public_id").single();
  if (error || !data) redirect(`/servis?gagal=${encodeURIComponent(error?.message ?? "simpan")}`);
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  await sendWaAdmin(`Niagaaja: klaim servis ${data.public_id} dari ${prof?.full_name ?? "pelanggan"} — "${issue.slice(0, 80)}". Tindak lanjuti di ${site()}/admin/servis`);
  redirect(`/servis?ok=${data.public_id}`);
}

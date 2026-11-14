import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site();
  const { data } = await createPublicClient().from("units").select("public_id, updated_at").eq("status", "tersedia").limit(1000);
  const statics = ["", "/katalog", "/tukar-tambah", "/sertifikat", "/jual-beli/hp-bekas-garut", "/jual-beli/laptop-bekas-garut", "/jual-beli/kamera-bekas-garut", "/jual-beli/konsol-bekas-garut"];
  return [
    ...statics.map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.8 })),
    ...(data ?? []).map((u) => ({ url: `${base}/unit/${u.public_id}`, lastModified: u.updated_at, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}

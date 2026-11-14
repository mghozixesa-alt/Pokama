import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/pesanan", "/akun", "/booking", "/tersimpan", "/servis", "/auth"] }], sitemap: `${base}/sitemap.xml` };
}

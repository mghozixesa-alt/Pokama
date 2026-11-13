import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import { rupiah } from "@/lib/format";
import type { Unit } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Unit Niagaaja";

/** Kartu preview saat tautan unit dibagikan ke WhatsApp/IG: foto, nama, harga, grade. */
export default async function OgImage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const { data } = await createPublicClient().from("units").select("*").eq("public_id", publicId).maybeSingle();
  const u = data as Unit | null;
  const title = u ? `${u.brand} ${u.model}` : "Niagaaja";
  const photo = u?.photos?.[0];
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#10365C", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ width: 560, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
          {photo ? <img src={photo} alt="" width={560} height={630} style={{ objectFit: "cover", width: 560, height: 630 }} /> : <div style={{ fontSize: 40, color: "#b3bccb" }}>Foto menyusul</div>}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "56px 56px", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#2A7DC1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="30" height="30" viewBox="0 0 100 100"><path d="M18 70 C18 36 44 36 54 52 C64 68 86 68 86 36" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" /></svg>
            </div>
            niagaaja
          </div>
          {u?.grade && <div style={{ display: "flex", alignSelf: "flex-start", padding: "8px 16px", borderRadius: 10, background: "#E8F1FB", color: "#1F5F9E", fontSize: 24, fontWeight: 700 }}>Grade {u.grade} · dicek 8 langkah</div>}
          <div style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          {u?.variant && <div style={{ fontSize: 28, opacity: 0.8 }}>{u.variant}</div>}
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 10 }}>
            <div style={{ fontSize: 60, fontWeight: 800 }}>{u ? rupiah(u.price_sell) : ""}</div>
            {u?.price_new && <div style={{ fontSize: 28, opacity: 0.6, textDecoration: "line-through" }}>{rupiah(u.price_new)}</div>}
          </div>
          <div style={{ fontSize: 24, opacity: 0.8 }}>Garansi {u?.grade === "C" ? 7 : 30} hari · bisa tawar · Garut</div>
        </div>
      </div>
    ),
    size,
  );
}

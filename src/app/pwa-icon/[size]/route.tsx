import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Ikon aplikasi (PNG) digambar dari vektor: lingkaran biru + gelombang-N putih. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: s } = await params;
  const size = Math.min(1024, Math.max(64, Number(s) || 512));
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const pad = maskable ? size * 0.12 : 0;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#2F8AD6,#1F5F9E)", borderRadius: radius }}>
        <svg width={size - pad * 2} height={size - pad * 2} viewBox="0 0 100 100">
          <path d="M18 70 C18 36 44 36 54 52 C64 68 86 68 86 36" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}

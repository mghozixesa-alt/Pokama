import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#2F8AD6,#1F5F9E)" }}>
        <svg width="180" height="180" viewBox="0 0 100 100">
          <path d="M18 70 C18 36 44 36 54 52 C64 68 86 68 86 36" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}

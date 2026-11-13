import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Niagaaja — Elektronik bekas bersertifikat", template: "%s · Niagaaja" },
  description:
    "Jual beli HP, laptop, kamera, konsol, dan elektronik bekas di Garut. Semua unit dicek 8 langkah, bergaransi, bisa ditawar.",
  icons: { icon: "/icon.svg" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app"),
  applicationName: "Niagaaja",
  appleWebApp: { capable: true, title: "Niagaaja", statusBarStyle: "default" },
  openGraph: { siteName: "Niagaaja", locale: "id_ID", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#2A7DC1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      <body className="font-sans min-h-dvh">{children}</body>
    </html>
  );
}

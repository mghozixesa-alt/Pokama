import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Niagaaja — Elektronik bekas bersertifikat",
    short_name: "Niagaaja",
    description: "Jual beli HP, laptop, kamera, konsol bekas di Garut. Dicek 8 langkah, bergaransi, bisa ditawar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f9",
    theme_color: "#2A7DC1",
    lang: "id",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

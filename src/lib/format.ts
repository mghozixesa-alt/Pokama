import type { Branch, Category, Grade, OrderStatus, UnitSource } from "./types";

export function rupiah(n: number | null | undefined): string {
  if (n == null) return "-";
  return "Rp " + n.toLocaleString("id-ID");
}

/** Rp 7,2 jt — untuk kartu produk */
export function rupiahShort(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    const s = jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(jt * 10 % 1 === 0 ? 1 : 2);
    return "Rp " + s.replace(".", ",") + " jt";
  }
  if (n >= 1_000) return "Rp " + Math.round(n / 1000) + " rb";
  return "Rp " + n;
}

export function savePct(priceNew: number | null, priceSell: number): string | null {
  if (!priceNew || priceNew <= priceSell) return null;
  return "−" + Math.round((1 - priceSell / priceNew) * 100) + "%";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  hp: "HP", laptop: "Laptop", kamera: "Kamera", tablet: "Tablet", konsol: "Konsol",
  audio: "Audio", smartwatch: "Smartwatch", drone: "Drone", aksesori: "Aksesori",
};

export const GRADE_LABEL: Record<Grade, string> = { A: "A · mulus", B: "B · lecet pakai", C: "C · ada minus" };

export const SOURCE_LABEL: Record<UnitSource, string> = {
  beli_pelanggan: "Dibeli dari pelanggan",
  tukar_tambah: "Tukar tambah pelanggan",
  investor: "Unit investor",
  titipan: "Titipan pemilik",
  eks_sewa_rentalaja: "Eks unit sewa Rentalaja",
};

export const BRANCH_LABEL: Record<Branch, string> = { garut_kota: "Garut Kota", wanaraja: "Wanaraja", bandung: "Bandung" };

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu_bayar: "Menunggu pembayaran",
  menunggu_konfirmasi: "Bukti dikirim, menunggu konfirmasi",
  dibayar: "Pembayaran diterima",
  disiapkan: "Unit disiapkan",
  dikirim: "Dalam pengiriman",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
  retur: "Retur / klaim garansi",
};

export function tanggal(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function waLink(text: string): string {
  const num = process.env.NEXT_PUBLIC_WA_NUMBER ?? "";
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

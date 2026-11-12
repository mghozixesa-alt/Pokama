/**
 * Kirim WhatsApp lewat Fonnte (https://fonnte.com). Tanpa FONNTE_TOKEN, fungsi ini
 * hanya mencatat ke log dan tidak mengirim apa pun, sehingga aman dipakai sejak awal.
 *
 * Env: FONNTE_TOKEN (token device), ADMIN_WA_NUMBER (nomor admin penerima notif, format 62…).
 */
export async function sendWa(to: string | null | undefined, message: string): Promise<boolean> {
  const token = process.env.FONNTE_TOKEN;
  const target = normalize(to);
  if (!target) return false;
  if (!token) {
    console.log(`[wa:skip] ${target}: ${message.slice(0, 80)}…`);
    return false;
  }
  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: new URLSearchParams({ target, message, countryCode: "62" }),
    });
    return res.ok;
  } catch (e) {
    console.error("[wa:error]", e);
    return false;
  }
}

export function sendWaAdmin(message: string) {
  return sendWa(process.env.ADMIN_WA_NUMBER, message);
}

/** 08xx → 628xx; buang spasi/tanda; kembalikan null jika tidak masuk akal. */
export function normalize(n: string | null | undefined): string | null {
  if (!n) return null;
  let d = n.replace(/[^\d]/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  if (d.startsWith("8")) d = "62" + d;
  return d.length >= 10 ? d : null;
}

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app";

export const WA = {
  proofReceived: (orderId: string, name: string, amount: string) =>
    `Niagaaja: bukti transfer masuk untuk pesanan ${orderId} dari ${name} (${amount}). Cek di ${site()}/admin/pembayaran`,
  paymentConfirmed: (orderId: string, item: string) =>
    `Halo! Pembayaran pesanan ${orderId} (${item}) sudah kami terima. Unit disiapkan, Anda akan dikabari saat siap diambil/dikirim. Lihat: ${site()}/pesanan/${orderId}`,
  paymentRejected: (orderId: string, reason: string) =>
    `Halo, bukti transfer pesanan ${orderId} belum bisa kami konfirmasi: ${reason}. Mohon unggah ulang di ${site()}/pesanan/${orderId}`,
  orderStatus: (orderId: string, label: string) =>
    `Update pesanan ${orderId}: ${label}. Detail: ${site()}/pesanan/${orderId}`,
  offerAnswered: (unit: string, result: string, publicId: string) =>
    `Tawaran Anda untuk ${unit}: ${result}. ${result.startsWith("Disetujui") ? `Booking dengan harga ini dalam 24 jam: ${site()}/booking/${publicId}` : `Lihat unit lain: ${site()}/katalog`}`,
  newOffer: (unit: string, amount: string, name: string) =>
    `Niagaaja: tawaran baru ${amount} untuk ${unit} dari ${name}. Jawab di ${site()}/admin/tawaran`,
  tradeIn: (name: string, item: string) =>
    `Niagaaja: pengajuan tukar tambah/jual dari ${name} — ${item}. Lihat di ${site()}/admin/tukar-tambah`,
  newOrder: (orderId: string, item: string, name: string, method: string) =>
    `Niagaaja: booking baru ${orderId} — ${item} oleh ${name} (${method}). ${site()}/admin/pesanan`,
};

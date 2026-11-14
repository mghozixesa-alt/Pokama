import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { sendWa } from "@/lib/wa";

export const dynamic = "force-dynamic";
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://niagaaja.vercel.app";

/**
 * Dipanggil Vercel Cron tiap jam (vercel.json). Vercel mengirim header Authorization: Bearer CRON_SECRET.
 * - Booking > 24 jam belum bayar → dibatalkan (unit kembali tersedia, poin dikembalikan) + WA ke pelanggan
 * - Tawaran disetujui yang lewat masa kunci → kedaluwarsa
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await createPublicClient().rpc("housekeeping", { p_secret: secret });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { cancelled: { public_id: string; phone: string | null }[]; expired_offers: number };
  let notified = 0;
  for (const c of result.cancelled ?? []) {
    const ok = await sendWa(c.phone, `Niagaaja: booking ${c.public_id} dibatalkan otomatis karena lewat 24 jam tanpa pembayaran. Unit kembali dijual bebas. Kalau masih berminat, booking ulang: ${site()}/katalog`);
    if (ok) notified++;
  }
  return NextResponse.json({ ok: true, cancelled: result.cancelled?.length ?? 0, notified, expired_offers: result.expired_offers ?? 0, at: new Date().toISOString() });
}

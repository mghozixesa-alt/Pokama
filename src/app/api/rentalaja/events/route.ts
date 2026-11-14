import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { rentalajaKey } from "../_auth";
import { postFinance } from "@/lib/finance";

export const dynamic = "force-dynamic";

type Body = { event_id: string; type: "diterima" | "keluar_disewa" | "kembali_qc" | "ditarik" | "terjual" | "pendapatan"; public_id?: string; asset_id?: string; payload?: Record<string, unknown> };

/**
 * POST /api/rentalaja/events — Rentalaja mengabari perubahan status unit titipan.
 * Body: { event_id, type, public_id | asset_id, payload? }. Idempoten per event_id.
 * type "pendapatan": payload { amount, period } → diteruskan ke Pokama Keuangan dengan pembagian 30/30/40.
 */
export async function POST(req: Request) {
  const key = rentalajaKey(req);
  if (key instanceof NextResponse) return key;
  let b: Body;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 }); }
  if (!b.event_id || !b.type || (!b.public_id && !b.asset_id)) return NextResponse.json({ error: "event_id, type, dan public_id/asset_id wajib" }, { status: 400 });

  const { data, error } = await createPublicClient().rpc("rentalaja_event", {
    p_secret: key, p_event_id: b.event_id, p_type: b.type, p_public_id: b.public_id ?? null, p_asset_id: b.asset_id ?? null, p_payload: b.payload ?? {},
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("tidak ditemukan") ? 404 : 400 });
  const res = data as { ok: boolean; duplicate?: boolean; unit_id?: string; public_id?: string };

  if (!res.duplicate && b.type === "pendapatan" && typeof b.payload?.amount === "number") {
    const amount = b.payload.amount as number;
    await postFinance({ type: "consignment_income", ref: b.event_id, unit: res.public_id, amount, period: b.payload.period, split: { rentalaja: Math.round(amount * 0.3), owner: Math.round(amount * 0.3), niagaaja: amount - 2 * Math.round(amount * 0.3) } });
  }
  return NextResponse.json(res);
}

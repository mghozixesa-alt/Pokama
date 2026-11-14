import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { rentalajaKey } from "../_auth";

export const dynamic = "force-dynamic";

/** GET /api/rentalaja/units — daftar unit Niagaaja yang dititipkan ke Rentalaja (+ bagi hasil). */
export async function GET(req: Request) {
  const key = rentalajaKey(req);
  if (key instanceof NextResponse) return key;
  const { data, error } = await createPublicClient().rpc("rentalaja_units", { p_secret: key });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ units: data ?? [], count: Array.isArray(data) ? data.length : 0 });
}

import { NextResponse } from "next/server";

/** Autentikasi server-ke-server untuk sistem Rentalaja: header x-api-key = RENTALAJA_API_KEY. */
export function rentalajaKey(req: Request): string | NextResponse {
  const key = process.env.RENTALAJA_API_KEY ?? "";
  const given = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key || given !== key) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return key;
}

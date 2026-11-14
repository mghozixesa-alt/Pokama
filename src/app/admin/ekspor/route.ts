import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const csv = (rows: (string | number | null | undefined)[][]) =>
  "﻿" + rows.map((r) => r.map((v) => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n");
const tgl = (s: string | null) => (s ? new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }) : "");

/** GET /admin/ekspor?jenis=penjualan|stok — CSV (pemisah ; agar langsung rapi di Excel/Sheets Indonesia). Hanya staf. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!p?.role || !["admin", "qc", "cs"].includes(p.role)) return NextResponse.json({ error: "staf" }, { status: 403 });

  const jenis = new URL(req.url).searchParams.get("jenis") ?? "penjualan";
  const stamp = new Date().toISOString().slice(0, 10);
  let body: string;

  if (jenis === "stok") {
    const { data } = await supabase.from("units").select("public_id, status, category, brand, model, variant, grade, price_new, price_sell, price_floor, source, branch, created_at, ownerships(owner_type, cost_basis, share_niagaaja_pct, active, owners(name))").order("created_at", { ascending: false });
    type R = { public_id: string; status: string; category: string; brand: string; model: string; variant: string | null; grade: string | null; price_new: number | null; price_sell: number; price_floor: number | null; source: string; branch: string; created_at: string; ownerships: { owner_type: string; cost_basis: number; share_niagaaja_pct: number; active: boolean; owners: { name: string } | null }[] };
    const rows: (string | number | null)[][] = [["Kode", "Status", "Kategori", "Merek", "Model", "Varian", "Grade", "Harga baru", "Harga jual", "Harga dasar", "Modal", "Pemilik", "Nama pemilik", "Bagian Niagaaja %", "Sumber", "Cabang", "Masuk"]];
    for (const u of (data ?? []) as unknown as R[]) { const o = u.ownerships?.find((x) => x.active); rows.push([u.public_id, u.status, u.category, u.brand, u.model, u.variant, u.grade, u.price_new, u.price_sell, u.price_floor, o?.cost_basis ?? null, o?.owner_type ?? null, o?.owners?.name ?? null, o?.share_niagaaja_pct ?? null, u.source, u.branch, tgl(u.created_at)]); }
    body = csv(rows);
  } else {
    const { data } = await supabase.from("orders").select("public_id, status, amount, points_used, fulfillment, created_at, updated_at, warranty_until, profiles(full_name, phone), units(public_id, brand, model, variant, grade, ownerships(owner_type, cost_basis, share_niagaaja_pct, active)), payments(method, paid_at, unique_code)").order("created_at", { ascending: false });
    type R = { public_id: string; status: string; amount: number; points_used: number; fulfillment: string; created_at: string; updated_at: string; warranty_until: string | null; profiles: { full_name: string | null; phone: string | null } | null; units: { public_id: string; brand: string; model: string; variant: string | null; grade: string | null; ownerships: { owner_type: string; cost_basis: number; share_niagaaja_pct: number; active: boolean }[] } | null; payments: { method: string; paid_at: string | null; unique_code: number }[] };
    const rows: (string | number | null)[][] = [["Kode pesanan", "Status", "Dibuat", "Dibayar", "Pelanggan", "WA", "Unit", "Merek", "Model", "Varian", "Grade", "Nominal", "Poin dipakai", "Metode", "Kode unik", "Modal", "Margin Niagaaja", "Pengambilan", "Garansi s/d"]];
    for (const o of (data ?? []) as unknown as R[]) {
      const own = o.units?.ownerships?.find((x) => x.active); const pay = o.payments?.find((x) => x.paid_at) ?? o.payments?.[0];
      const margin = own ? (own.owner_type === "sendiri" ? o.amount - own.cost_basis : Math.round((o.amount * Number(own.share_niagaaja_pct)) / 100)) : null;
      rows.push([o.public_id, o.status, tgl(o.created_at), tgl(pay?.paid_at ?? null), o.profiles?.full_name, o.profiles?.phone, o.units?.public_id, o.units?.brand, o.units?.model, o.units?.variant, o.units?.grade, o.amount, o.points_used, pay?.method, pay?.unique_code, own?.cost_basis ?? null, margin, o.fulfillment, tgl(o.warranty_until)]);
    }
    body = csv(rows);
  }
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="niagaaja-${jenis}-${stamp}.csv"` } });
}

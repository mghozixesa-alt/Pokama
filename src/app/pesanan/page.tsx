import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icons";
import { rupiah, ORDER_STATUS_LABEL, tanggal } from "@/lib/format";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pesanan" };

const TONE: Record<string, string> = {
  menunggu_bayar: "bg-[#fdf1dc] text-[#7a4a00]", menunggu_konfirmasi: "bg-brand-light text-brand-dark", dibayar: "bg-teal-light text-teal-dark",
  disiapkan: "bg-teal-light text-teal-dark", dikirim: "bg-teal-light text-teal-dark", selesai: "bg-page text-muted", dibatalkan: "bg-[#fde8e8] text-[#a12d2d]", retur: "bg-[#fde8e8] text-[#a12d2d]",
};

export default async function PesananPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: orders }, { data: offers }] = await Promise.all([
    supabase.from("orders").select("*, units(*)").eq("customer_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("offers").select("id, amount, counter_amount, status, expires_at, units(public_id, model, variant)").eq("customer_id", user!.id).in("status", ["diajukan", "counter", "disetujui"]).order("created_at", { ascending: false }),
  ]);

  return (
    <Shell active="pesanan">
      <div className="px-4 pt-5"><h1 className="text-2xl font-bold text-brand-navy">Pesanan</h1></div>

      {offers && offers.length > 0 && (
        <section className="px-4 mt-4">
          <h2 className="text-sm font-bold text-brand-navy mb-2">Tawaran aktif</h2>
          <div className="flex flex-col gap-2">
            {offers.map((o) => {
              const u = o.units as unknown as { public_id: string; model: string; variant: string | null };
              const ok = o.status === "disetujui";
              return (
                <div key={o.id} className={`card p-3 flex items-center gap-3 ${ok ? "border-brand" : ""}`}>
                  <span className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center text-brand"><Icon.Tag /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{u.model} {u.variant}</p>
                    <p className="text-[11px] text-muted">Tawaran {rupiah(o.amount)}{o.counter_amount ? ` · balasan admin ${rupiah(o.counter_amount)}` : ""} · {o.status === "diajukan" ? "menunggu jawaban" : o.status === "counter" ? "ada tawaran balik" : `disetujui, berlaku s/d ${tanggal(o.expires_at)}`}</p>
                  </div>
                  {(ok || o.status === "counter") && <Link href={`/booking/${u.public_id}`} className="btn-soft">Booking</Link>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-4 mt-4 flex flex-col gap-2.5">
        {(orders as Order[] | null)?.map((o) => (
          <Link key={o.id} href={`/pesanan/${o.public_id}`} className="card p-3 flex gap-3">
            <span className="relative w-16 h-16 rounded-xl overflow-hidden bg-white border border-page shrink-0">{o.units?.photos?.[0] && <Image src={o.units.photos[0]} alt="" fill className="object-contain p-1" />}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-muted">{o.public_id} · {tanggal(o.created_at)}</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${TONE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span></div>
              <p className="text-sm font-bold truncate mt-0.5">{o.units?.brand} {o.units?.model} {o.units?.variant}</p>
              <p className="text-base font-bold text-brand-navy">{rupiah(o.amount)}</p>
            </div>
          </Link>
        ))}
        {!orders?.length && !offers?.length && (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">Belum ada pesanan.</p>
            <Link href="/katalog" className="btn-primary mt-4">Cari unit</Link>
          </div>
        )}
      </section>
    </Shell>
  );
}

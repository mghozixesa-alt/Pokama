import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";
import { rupiah, tanggal, BRANCH_LABEL, ORDER_STATUS_LABEL } from "@/lib/format";
import type { Order, Payment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nota" };

/** Nota pesanan — ramah cetak / "Simpan sebagai PDF" dari browser. Pelanggan & admin bisa membuka. */
export default async function NotaPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const supabase = await createClient();
  const [{ data }, { data: store }] = await Promise.all([
    supabase.from("orders").select("*, units(*), payments(*), profiles(full_name, phone)").eq("public_id", publicId).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "store").maybeSingle(),
  ]);
  if (!data) notFound();
  const o = data as Order & { profiles: { full_name: string | null; phone: string | null } | null };
  const u = o.units!;
  const pay = (o.payments ?? []).filter((p: Payment) => p.paid_at).sort((a: Payment, b: Payment) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))[0] as Payment | undefined;
  const st = (store?.value ?? {}) as { name?: string; address?: string; phone?: string };
  const lunas = ["dibayar", "disiapkan", "dikirim", "selesai"].includes(o.status);
  const spec = u.specs ?? {};
  const specLine = [spec.storage, spec.ram ? `RAM ${spec.ram}` : null, spec.color, spec.kelengkapan].filter(Boolean).join(" · ");

  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } @page { size: A5; margin: 12mm } }`}</style>
      <div className="no-print max-w-[640px] mx-auto px-4 pt-4 flex items-center justify-between">
        <a href={`/pesanan/${o.public_id}`} className="text-sm font-semibold text-brand">← Kembali ke pesanan</a>
        <PrintButton />
      </div>
      <div className="max-w-[640px] mx-auto my-4 bg-white rounded-2xl print:rounded-none p-7 text-[13px] text-ink shadow-[var(--shadow)] print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Logo height={30} />
            <p className="text-[11px] text-muted mt-2 leading-4">{st.name ?? "Niagaaja — elektronik bekas bersertifikat"}<br />{st.address ?? `Cabang ${BRANCH_LABEL[u.branch]}`}<br />{st.phone ? `WA ${st.phone}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">Nota penjualan</p>
            <p className="text-[18px] font-bold text-brand-navy">{o.public_id}</p>
            <p className="text-[11px] text-muted">{tanggal(o.created_at)}</p>
            <span className={`inline-flex mt-1 px-2 h-5 items-center rounded-md text-[10px] font-bold ${lunas ? "bg-brand-light text-brand-dark" : "bg-[#fff3df] text-[#8a5a00]"}`}>{lunas ? "LUNAS" : ORDER_STATUS_LABEL[o.status]}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div><p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Pembeli</p><p className="font-semibold">{o.profiles?.full_name ?? "-"}</p><p className="text-muted">{o.profiles?.phone ?? ""}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Pengambilan</p><p className="font-semibold">{o.fulfillment === "kirim" ? "Dikirim" : "Ambil di toko"}</p><p className="text-muted">{o.fulfillment === "kirim" ? o.shipping_address : BRANCH_LABEL[u.branch]}</p></div>
        </div>

        <table className="w-full mt-6 border-t border-b border-line">
          <thead><tr className="text-[10px] uppercase tracking-wider text-muted text-left"><th className="py-2 font-semibold">Unit</th><th className="py-2 font-semibold text-right">Harga</th></tr></thead>
          <tbody>
            <tr className="border-t border-page">
              <td className="py-3 pr-3">
                <p className="font-semibold">{u.brand} {u.model}{u.variant ? ` ${u.variant}` : ""}</p>
                <p className="text-[11px] text-muted">{u.public_id} · Grade {u.grade ?? "-"}{specLine ? ` · ${specLine}` : ""}{spec.imei ? ` · IMEI/SN ${spec.imei}` : ""}</p>
              </td>
              <td className="py-3 text-right font-semibold whitespace-nowrap">{rupiah(u.price_sell)}</td>
            </tr>
            {o.amount !== u.price_sell && <tr className="border-t border-page"><td className="py-2 text-muted">Penyesuaian harga (tawaran disetujui / poin)</td><td className="py-2 text-right whitespace-nowrap">− {rupiah(u.price_sell - o.amount)}</td></tr>}
          </tbody>
          <tfoot><tr className="border-t border-line"><td className="py-3 font-bold text-brand-navy">Total</td><td className="py-3 text-right font-bold text-brand-navy text-[16px] whitespace-nowrap">{rupiah(o.amount)}</td></tr></tfoot>
        </table>

        <div className="grid grid-cols-2 gap-4 mt-5 text-[12px]">
          <div><p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Pembayaran</p><p>{pay ? `${pay.method === "tunai" ? "Tunai" : "Transfer"} · ${tanggal(pay.paid_at!)}` : "Belum dikonfirmasi"}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Garansi</p><p>{o.warranty_until ? `Sampai ${tanggal(o.warranty_until)}` : `${u.grade === "C" ? 7 : 30} hari sejak pesanan selesai`}</p></div>
        </div>

        <p className="text-[10px] text-muted mt-6 leading-4 border-t border-page pt-3">
          Garansi berlaku untuk kerusakan fungsi yang bukan akibat jatuh, air, atau pemakaian tidak wajar; klaim di niagaaja.vercel.app/servis atau WhatsApp dengan menyebut kode pesanan. Sertifikat cek 8 langkah unit ini dapat diverifikasi lewat QR pada unit. Niaga Poin: {o.points_earned ? `+${o.points_earned} poin` : "diberikan saat pesanan selesai"}.
        </p>
      </div>
    </div>
  );
}

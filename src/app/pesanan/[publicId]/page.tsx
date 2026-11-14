import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { ProofUpload } from "@/components/ProofUpload";
import { CopyButton } from "@/components/CopyButton";
import { rupiah, ORDER_STATUS_LABEL, tanggal, BRANCH_LABEL, waLink } from "@/lib/format";
import { transferAmount } from "@/lib/pricing";
import type { Order, Payment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detail pesanan" };

const STEPS: { key: Order["status"][]; label: string }[] = [
  { key: ["menunggu_bayar"], label: "Booking dibuat" },
  { key: ["menunggu_konfirmasi"], label: "Bukti bayar dikirim" },
  { key: ["dibayar"], label: "Pembayaran dikonfirmasi" },
  { key: ["disiapkan", "dikirim"], label: "Unit disiapkan / dikirim" },
  { key: ["selesai"], label: "Selesai · garansi aktif" },
];
const ORDER_FLOW: Order["status"][] = ["menunggu_bayar", "menunggu_konfirmasi", "dibayar", "disiapkan", "dikirim", "selesai"];

export default async function PesananDetail({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const supabase = await createClient();
  const [{ data }, { data: bank }] = await Promise.all([
    supabase.from("orders").select("*, units(*), payments(*)").eq("public_id", publicId).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "bank_account").maybeSingle(),
  ]);
  if (!data) notFound();
  const o = data as Order;
  const pay = (o.payments ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] as Payment | undefined;
  const acct = (bank?.value ?? {}) as { bank?: string; number?: string; holder?: string };
  const total = transferAmount(o.amount, o.unique_code);
  const stepIdx = ORDER_FLOW.indexOf(o.status);
  const cancelled = o.status === "dibatalkan" || o.status === "retur";
  const u = o.units!;

  return (
    <Shell withNav={false}>
      <TopBar title={o.public_id} back="/pesanan" />

      <div className="mx-4 card p-3 flex gap-3">
        <span className="relative w-16 h-16 rounded-xl overflow-hidden bg-white border border-page shrink-0">{u.photos?.[0] && <Image src={u.photos[0]} alt="" fill className="object-contain p-1" />}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted">{u.public_id} · {tanggal(o.created_at)}</p>
          <p className="text-sm font-bold truncate">{u.brand} {u.model} {u.variant}</p>
          <p className="text-base font-bold text-brand-navy">{rupiah(o.amount)}</p>
        </div>
      </div>

      {/* Status */}
      <div className="mx-4 mt-3 card p-4">
        <p className="text-sm font-bold text-brand-navy">{ORDER_STATUS_LABEL[o.status]}</p>
        {!cancelled && (
          <ol className="mt-3 flex flex-col gap-2">
            {STEPS.map((s, i) => {
              const reached = ORDER_FLOW.indexOf(s.key[0]) <= stepIdx;
              return (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${reached ? "bg-brand text-white" : "bg-page text-muted"}`}>{i + 1}</span>
                  <span className={reached ? "font-semibold" : "text-muted"}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        )}
        {o.status === "menunggu_bayar" && <p className="text-[11px] text-muted mt-3">Unit ditahan untuk Anda sampai <b>{new Date(o.hold_until).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b>.</p>}
        {o.warranty_until && <p className="text-[11px] text-teal-dark mt-3">Garansi berlaku sampai {tanggal(o.warranty_until)}.</p>}
      </div>

      {/* Instruksi bayar manual */}
      {o.status === "menunggu_bayar" && pay?.method === "transfer" && (
        <div className="mx-4 mt-3 card p-4">
          <h3 className="text-sm font-bold text-brand-navy">Transfer ke rekening Niagaaja</h3>
          <div className="mt-3 rounded-xl bg-page p-3">
            <p className="text-[10px] text-muted">{acct.bank ?? "Bank"} · a.n. {acct.holder ?? "Niagaaja"}</p>
            <div className="flex items-center justify-between mt-1"><span className="text-lg font-bold tracking-wider">{acct.number ?? "-"}</span><CopyButton text={acct.number ?? ""} label="Salin" /></div>
          </div>
          <div className="mt-2 rounded-xl bg-brand-light p-3">
            <p className="text-[10px] text-brand-dark">Nominal transfer (sudah termasuk kode unik 3 digit)</p>
            <div className="flex items-center justify-between mt-1"><span className="text-xl font-bold text-brand-navy">{rupiah(total)}</span><CopyButton text={String(total)} label="Salin" /></div>
            <p className="text-[10px] text-brand-dark mt-1">Transfer <b>persis</b> nominal ini supaya admin bisa mencocokkan otomatis.</p>
          </div>
          <div className="mt-4"><ProofUpload orderId={o.id} paymentId={pay.id} /></div>
        </div>
      )}
      {o.status === "menunggu_bayar" && pay?.method === "tunai" && (
        <div className="mx-4 mt-3 card p-4">
          <h3 className="text-sm font-bold text-brand-navy">Bayar tunai di toko</h3>
          <p className="text-sm mt-1">Datang ke Niagaaja {BRANCH_LABEL[u.branch]}, sebutkan kode <b>{o.public_id}</b>. Unit ditahan 24 jam.</p>
        </div>
      )}
      {o.status === "menunggu_konfirmasi" && (
        <div className="mx-4 mt-3 card p-4">
          <p className="text-sm">Bukti transfer sudah kami terima. Admin mengonfirmasi dalam jam kerja (07.30–21.00). Anda akan dikabari via WhatsApp.</p>
          {pay?.proof_url && <p className="text-[11px] text-muted mt-2">Bukti dikirim {tanggal(pay.created_at)}</p>}
        </div>
      )}
      {pay?.rejected_reason && <div className="mx-4 mt-3 card p-4 border-[#f3c1c1]"><p className="text-sm text-[#a12d2d]"><b>Bukti ditolak:</b> {pay.rejected_reason}. Silakan unggah ulang.</p></div>}

      {/* Penerima */}
      <div className="mx-4 mt-3 card p-4">
        <h3 className="text-sm font-bold text-brand-navy">Pengambilan</h3>
        <p className="text-sm mt-1">{o.fulfillment === "kirim" ? `Dikirim ke: ${o.shipping_address ?? "-"}` : `Ambil di toko ${BRANCH_LABEL[u.branch]}`}</p>
      </div>

      <div className="px-4 mt-4 flex gap-2">
        <a href={waLink(`Halo Niagaaja, saya mau tanya pesanan ${o.public_id}`)} className="btn-outline flex-1">Tanya CS</a>
        {["dibayar", "disiapkan", "dikirim", "selesai"].includes(o.status) && <Link href={`/pesanan/${o.public_id}/nota`} className="btn-primary flex-1">Lihat nota</Link>}
      </div>
    </Shell>
  );
}

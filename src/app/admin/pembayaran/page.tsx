import { createClient } from "@/lib/supabase/server";
import { confirmPayment } from "@/app/admin/actions";
import { rupiah, tanggal } from "@/lib/format";
import { transferAmount } from "@/lib/pricing";

export const metadata = { title: "Konfirmasi pembayaran" };

type Row = { id: string; public_id: string; amount: number; unique_code: number; status: string; created_at: string; profiles: { full_name: string | null; phone: string | null } | null; units: { public_id: string; brand: string; model: string; variant: string | null } | null; payments: { id: string; method: string; proof_url: string | null; sender_name: string | null; bank_name: string | null; created_at: string }[] };

export default async function PembayaranPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("id, public_id, amount, unique_code, status, created_at, profiles(full_name, phone), units(public_id, brand, model, variant), payments(id, method, proof_url, sender_name, bank_name, created_at)").in("status", ["menunggu_konfirmasi", "menunggu_bayar"]).order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const withProof = rows.filter((r) => r.status === "menunggu_konfirmasi");
  const waiting = rows.filter((r) => r.status === "menunggu_bayar");

  async function signedUrl(path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from("proofs").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  return (
    <div>
      <h1 className="text-[22px] leading-7 font-bold text-brand-navy">Konfirmasi pembayaran</h1>
      <h2 className="text-sm font-bold text-muted mt-4">Bukti masuk · {withProof.length}</h2>
      <div className="grid lg:grid-cols-2 gap-3 mt-2">
        {await Promise.all(withProof.map(async (r) => {
          const p = r.payments.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          const url = await signedUrl(p?.proof_url);
          return (
            <div key={r.id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between"><b>{r.public_id}</b><span className="text-[11px] text-muted">{tanggal(p?.created_at ?? r.created_at)}</span></div>
              <p className="text-sm">{r.units?.brand} {r.units?.model} {r.units?.variant} · <span className="font-mono text-xs">{r.units?.public_id}</span></p>
              <p className="text-sm text-muted">{r.profiles?.full_name ?? "-"} · {r.profiles?.phone ?? "-"}</p>
              <div className="rounded-xl bg-brand-light p-3 text-sm"><p className="text-[11px] text-brand-dark">Nominal yang harus masuk</p><p className="text-lg font-bold text-brand-navy">{rupiah(transferAmount(r.amount, r.unique_code))}</p><p className="text-[11px] text-muted">Pengirim: {p?.sender_name ?? "-"} · {p?.bank_name ?? "-"}</p></div>
              {url ? <a href={url} target="_blank" className="btn-soft self-start">Lihat bukti transfer</a> : <span className="text-xs text-muted">Bukti tidak ditemukan</span>}
              <form action={confirmPayment} className="flex gap-2 items-center flex-wrap mt-1">
                <input type="hidden" name="payment_id" value={p?.id} /><input type="hidden" name="order_id" value={r.id} />
                <button name="action" value="terima" className="btn-primary h-10">Terima · tandai dibayar</button>
                <input name="reason" placeholder="Alasan tolak" className="input h-10 max-w-[180px]" />
                <button name="action" value="tolak" className="btn-outline h-10">Tolak</button>
              </form>
            </div>
          );
        }))}
        {!withProof.length && <p className="text-sm text-muted">Tidak ada bukti yang menunggu.</p>}
      </div>

      <h2 className="text-sm font-bold text-muted mt-8">Menunggu pembayaran · {waiting.length}</h2>
      <div className="card mt-2 divide-y divide-page">
        {waiting.map((r) => {
          const p = r.payments[0];
          return (
            <div key={r.id} className="p-3 flex items-center gap-3 text-sm flex-wrap">
              <b className="w-24">{r.public_id}</b><span className="flex-1">{r.units?.brand} {r.units?.model} · {r.profiles?.full_name ?? "-"}</span>
              <span className="text-xs text-muted">{p?.method === "tunai" ? "tunai di toko" : `transfer ${rupiah(transferAmount(r.amount, r.unique_code))}`}</span>
              {p?.method === "tunai" && (
                <form action={confirmPayment}><input type="hidden" name="payment_id" value={p.id} /><input type="hidden" name="order_id" value={r.id} /><button name="action" value="terima" className="btn-soft">Sudah bayar tunai</button></form>
              )}
            </div>
          );
        })}
        {!waiting.length && <p className="p-3 text-sm text-muted">Kosong.</p>}
      </div>
    </div>
  );
}

import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { GradeBadge } from "@/components/GradeBadge";
import { unitTitle } from "@/components/UnitCard";
import { rupiah, BRANCH_LABEL } from "@/lib/format";
import type { Unit } from "@/lib/types";
import { createOrder } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking" };

export default async function BookingPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/masuk?next=/booking/${publicId}`);

  const [{ data: unit }, { data: profile }] = await Promise.all([
    supabase.from("units").select("*").eq("public_id", publicId).maybeSingle(),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
  ]);
  if (!unit) notFound();
  const u = unit as Unit;
  if (u.status !== "tersedia") redirect(`/unit/${publicId}`);

  // Pakai harga tawaran yang disetujui bila ada
  const { data: offer } = await supabase.from("offers").select("id, amount, counter_amount, expires_at").eq("unit_id", u.id).eq("customer_id", user.id).eq("status", "disetujui").gt("expires_at", new Date().toISOString()).maybeSingle();
  const price = offer ? (offer.counter_amount ?? offer.amount) : u.price_sell;

  return (
    <Shell withNav={false}>
      <TopBar title="Booking & bayar" back={`/unit/${publicId}`} />
      <div className="mx-4 card p-3 flex gap-3">
        <span className="relative w-16 h-16 rounded-xl overflow-hidden bg-white border border-page shrink-0">{u.photos[0] && <Image src={u.photos[0]} alt="" fill className="object-contain p-1" />}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5"><GradeBadge grade={u.grade} /><span className="text-[10px] text-muted">{u.public_id}</span></div>
          <p className="text-sm font-bold truncate">{unitTitle(u)}</p>
          <p className="text-base font-extrabold text-brand-navy">{rupiah(price)}{offer && <span className="text-[10px] font-bold text-teal-dark ml-2">harga tawaran</span>}</p>
        </div>
      </div>

      <form action={createOrder} className="px-4 mt-4 flex flex-col gap-4">
        <input type="hidden" name="unit_id" value={u.id} />
        <input type="hidden" name="public_id" value={u.public_id} />
        {offer && <input type="hidden" name="offer_id" value={offer.id} />}

        <div className="card p-4 flex flex-col gap-3">
          <h3 className="text-sm font-extrabold text-brand-navy">Data penerima</h3>
          <div><label className="label">Nama lengkap</label><input name="full_name" required defaultValue={profile?.full_name ?? ""} className="input" /></div>
          <div><label className="label">Nomor WhatsApp</label><input name="phone" required inputMode="tel" defaultValue={profile?.phone ?? ""} placeholder="08xxxxxxxxxx" className="input" /></div>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <h3 className="text-sm font-extrabold text-brand-navy">Cara terima unit</h3>
          <label className="flex items-start gap-3 p-3 rounded-xl border border-line has-[:checked]:border-brand has-[:checked]:bg-brand-light">
            <input type="radio" name="fulfillment" value="ambil_di_toko" defaultChecked className="mt-1 accent-brand" />
            <span><b className="text-sm">Ambil di toko {BRANCH_LABEL[u.branch]}</b><br /><span className="text-[11px] text-muted">Gratis · cek unit langsung sebelum bawa pulang</span></span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-xl border border-line has-[:checked]:border-brand has-[:checked]:bg-brand-light">
            <input type="radio" name="fulfillment" value="kirim" className="mt-1 accent-brand" />
            <span><b className="text-sm">Kirim ke alamat</b><br /><span className="text-[11px] text-muted">Ongkir dihitung admin per zona, dikabari via WhatsApp</span></span>
          </label>
          <div><label className="label">Alamat (jika dikirim)</label><textarea name="shipping_address" rows={2} className="input h-auto py-3" placeholder="Jalan, desa/kelurahan, kecamatan, patokan" /></div>
        </div>

        <div className="card p-4 flex flex-col gap-2">
          <h3 className="text-sm font-extrabold text-brand-navy">Cara bayar</h3>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-line has-[:checked]:border-brand has-[:checked]:bg-brand-light"><input type="radio" name="method" value="transfer" defaultChecked className="accent-brand" /><span className="text-sm"><b>Transfer bank</b> — nomor rekening tampil setelah booking</span></label>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-line has-[:checked]:border-brand has-[:checked]:bg-brand-light"><input type="radio" name="method" value="tunai" className="accent-brand" /><span className="text-sm"><b>Tunai di toko</b> — bayar saat ambil unit</span></label>
          <p className="text-[11px] text-muted">Unit ditahan 24 jam untuk Anda. Tanpa DP, tanpa biaya tambahan.</p>
        </div>

        <div className="card p-4">
          <div className="flex justify-between text-sm"><span className="text-muted">Harga unit</span><span className="font-bold">{rupiah(price)}</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-muted">Biaya layanan</span><span className="font-bold">Rp 0</span></div>
          <div className="flex justify-between text-base mt-2 pt-2 border-t border-page"><span className="font-extrabold">Total</span><span className="font-extrabold text-brand-navy">{rupiah(price)}</span></div>
        </div>

        <button className="btn-primary w-full">Booking sekarang</button>
      </form>
    </Shell>
  );
}

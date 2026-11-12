import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const supabase = await createClient();
  const [tersedia, dipesan, konfirmasi, tawaran, nilai, titipan] = await Promise.all([
    supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "tersedia"),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "dipesan"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "menunggu_konfirmasi"),
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "diajukan"),
    supabase.from("units").select("price_sell").eq("status", "tersedia"),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("status", "dititip_rentalaja"),
  ]);
  const totalNilai = (nilai.data ?? []).reduce((s, r) => s + (r.price_sell ?? 0), 0);
  const cards = [
    ["Unit tersedia", String(tersedia.count ?? 0), "/admin/stok?status=tersedia"],
    ["Nilai stok tersedia", rupiah(totalNilai), "/admin/stok"],
    ["Dipesan (tahan 24 jam)", String(dipesan.count ?? 0), "/admin/pesanan"],
    ["Bukti bayar perlu konfirmasi", String(konfirmasi.count ?? 0), "/admin/pembayaran"],
    ["Tawaran belum dijawab", String(tawaran.count ?? 0), "/admin/tawaran"],
    ["Dititip ke Rentalaja", String(titipan.count ?? 0), "/admin/stok?status=dititip_rentalaja"],
  ];
  return (
    <div>
      <h1 className="text-[22px] font-bold text-brand-navy">Ringkasan hari ini</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {cards.map(([label, val, href]) => (
          <Link key={label} href={href} className="card p-4"><p className="text-[11px] text-muted">{label}</p><p className="text-[22px] leading-7 font-bold text-brand-navy mt-1 break-words">{val}</p></Link>
        ))}
      </div>
      <div className="card p-4 mt-4 text-sm text-muted">
        <b className="text-brand-navy">Alur harian:</b> konfirmasi bukti bayar → jawab tawaran → input unit baru + sertifikat cek → ubah status pesanan (disiapkan → dikirim → selesai). Garansi otomatis aktif saat pesanan <i>selesai</i>.
      </div>
    </div>
  );
}

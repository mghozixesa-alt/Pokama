import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { tanggal, waLink } from "@/lib/format";
import { submitClaim } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Servis & garansi" };

const CLAIM_STATUS: Record<string, string> = {
  diajukan: "Diajukan, menunggu teknisi", dijadwalkan: "Dijadwalkan cek", dicek: "Sedang dicek", diperbaiki: "Diperbaiki (gratis)",
  ditukar: "Ditukar unit lain", ditolak: "Di luar garansi", selesai: "Selesai",
};
const TONE: Record<string, string> = { diajukan: "bg-[#fff3df] text-[#8a5a00]", ditolak: "bg-[#fde8e8] text-[#a12d2d]", selesai: "bg-page text-muted" };

export default async function ServisPage({ searchParams }: { searchParams: Promise<{ pesanan?: string; ok?: string; gagal?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: orders }, { data: claims }] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", user!.id).maybeSingle(),
    supabase.from("orders").select("id, public_id, warranty_until, units(brand, model, variant)").eq("customer_id", user!.id).eq("status", "selesai").order("created_at", { ascending: false }),
    supabase.from("service_claims").select("*, orders(public_id, units(brand, model))").eq("customer_id", user!.id).order("created_at", { ascending: false }),
  ]);
  const now = Date.now();

  return (
    <Shell withNav={false}>
      <TopBar title="Servis & garansi" back="/akun" />
      {sp.ok && <div className="mx-4 mb-3 card p-4 border-brand"><p className="text-sm font-semibold text-brand-navy">Klaim {sp.ok} diterima.</p><p className="text-[12px] text-muted mt-1">Teknisi menghubungi Anda lewat WhatsApp maksimal 1 hari kerja untuk jadwal cek.</p></div>}
      {sp.gagal && <p className="mx-4 mb-3 text-xs text-[#c0392b]">Gagal: {sp.gagal}</p>}

      <div className="mx-4 card p-4">
        <h2 className="text-[15px] font-bold text-brand-navy">Klaim garansi</h2>
        <p className="text-[12px] text-muted mt-1">Garansi 30 hari (grade A/B) atau 7 hari (grade C) untuk kerusakan fungsi yang bukan akibat jatuh, air, atau pemakaian tidak wajar. Unit dicek teknisi; kalau masuk garansi, diperbaiki atau ditukar tanpa biaya.</p>
        <form action={submitClaim} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="label">Pesanan</label>
            <select name="order_id" defaultValue={orders?.find((o) => o.public_id === sp.pesanan)?.id ?? ""} className="input">
              <option value="">— Pilih pesanan —</option>
              {orders?.map((o) => {
                const u = o.units as unknown as { brand: string; model: string; variant: string | null } | null;
                const active = o.warranty_until && new Date(o.warranty_until).getTime() >= now;
                return <option key={o.id} value={o.id}>{o.public_id} · {u?.brand} {u?.model} {active ? `(garansi s/d ${tanggal(o.warranty_until)})` : "(garansi habis)"}</option>;
              })}
            </select>
            {!orders?.length && <p className="text-[11px] text-muted mt-1">Belum ada pesanan selesai. Untuk servis unit yang dibeli di tempat lain, tetap bisa diajukan (berbayar).</p>}
          </div>
          <div><label className="label">Kendala yang dialami</label><textarea name="issue" required rows={3} className="input h-auto py-3" placeholder="Contoh: layar berkedip saat dinyalakan, baterai cepat habis sejak 2 hari lalu" /></div>
          <div><label className="label">Nomor WhatsApp</label><input name="phone" required inputMode="tel" defaultValue={profile?.phone ?? ""} className="input" placeholder="08xxxxxxxxxx" /></div>
          <button className="btn-primary w-full">Ajukan klaim</button>
          <a href={waLink(`Halo Niagaaja, saya mau tanya soal servis/garansi${sp.pesanan ? ` pesanan ${sp.pesanan}` : ""}.`)} className="text-center text-[12px] font-semibold text-brand">Atau tanya dulu via WhatsApp</a>
        </form>
      </div>

      {claims && claims.length > 0 && (
        <section className="px-4 mt-5">
          <h2 className="text-sm font-semibold text-brand-navy mb-2">Riwayat klaim</h2>
          <div className="flex flex-col gap-2">
            {claims.map((c) => {
              const o = c.orders as unknown as { public_id: string; units: { brand: string; model: string } | null } | null;
              return (
                <div key={c.id} className="card p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-muted">{c.public_id} · {tanggal(c.created_at)}{o ? ` · ${o.public_id}` : ""}</span><span className={`text-[10px] font-semibold px-2 h-5 inline-flex items-center rounded-md whitespace-nowrap ${TONE[c.status] ?? "bg-brand-light text-brand-dark"}`}>{CLAIM_STATUS[c.status] ?? c.status}</span></div>
                  <p className="text-sm font-semibold mt-1">{o?.units ? `${o.units.brand} ${o.units.model}` : "Unit luar"}</p>
                  <p className="text-[12px] text-muted">{c.issue}</p>
                  {c.admin_note && <p className="text-[12px] text-brand-dark mt-1">Teknisi: {c.admin_note}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Shell>
  );
}

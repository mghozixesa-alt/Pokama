import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shell, TopBar } from "@/components/Shell";
import { CATEGORY_LABEL, rupiah } from "@/lib/format";
import { submitPriceWatch, deletePriceWatch } from "@/app/tukar-tambah/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pantau harga" };

export default async function PantauHargaPage({ searchParams }: { searchParams: Promise<{ unit?: string; grade?: string; ok?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: watches }] = user
    ? await Promise.all([
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
        supabase.from("price_watches").select("*").eq("customer_id", user.id).order("created_at", { ascending: false }),
      ])
    : [{ data: null }, { data: [] }];

  return (
    <Shell withNav={false}>
      <TopBar title="Pantau harga" back="/katalog" />
      <div className="mx-4 card p-4">
        <h2 className="text-base font-extrabold text-brand-navy">Dikabari saat ada unit yang cocok</h2>
        <p className="text-sm text-muted mt-1">Isi model dan harga maksimal Anda. Begitu unit masuk dan lolos cek, kami kirim WhatsApp.</p>
        {sp.ok && <p className="text-sm text-teal-dark mt-2">Pantauan disimpan. Kami kabari begitu ada yang cocok.</p>}
        <form action={submitPriceWatch} className="mt-4 flex flex-col gap-3">
          <div><label className="label">Kategori</label><select name="category" className="input">{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">Model yang dicari</label><input name="model_query" required defaultValue={sp.unit ?? ""} className="input" placeholder="iPhone 13 128 GB" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Grade minimal</label><select name="grade" defaultValue={sp.grade ?? "B"} className="input"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></div>
            <div><label className="label">Harga maksimal</label><input name="target_price" inputMode="numeric" className="input" placeholder="7000000" /></div>
          </div>
          <div><label className="label">Nomor WhatsApp</label><input name="phone" required inputMode="tel" defaultValue={profile?.phone ?? ""} className="input" placeholder="08xxxxxxxxxx" /></div>
          {user ? <button className="btn-primary w-full">Pantau</button> : <Link href={`/masuk?next=/pantau-harga${sp.unit ? `?unit=${sp.unit}` : ""}`} className="btn-primary w-full">Masuk untuk memantau</Link>}
        </form>
      </div>

      {watches && watches.length > 0 && (
        <section className="px-4 mt-5">
          <h2 className="text-sm font-extrabold text-brand-navy mb-2">Pantauan aktif</h2>
          <div className="flex flex-col gap-2">
            {watches.map((w) => (
              <div key={w.id} className="card p-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0"><b>{w.model_query}</b><p className="text-[11px] text-muted">{w.category ? CATEGORY_LABEL[w.category as keyof typeof CATEGORY_LABEL] : "Semua"} · grade ≥ {w.grade ?? "C"}{w.target_price ? ` · maks ${rupiah(w.target_price)}` : ""}</p></div>
                <form action={deletePriceWatch}><input type="hidden" name="id" value={w.id} /><button className="text-xs font-bold text-[#a12d2d]">Hapus</button></form>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}

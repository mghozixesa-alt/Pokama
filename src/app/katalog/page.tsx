import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icons";
import { UnitCardRow } from "@/components/UnitCard";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Unit } from "@/lib/types";

export const metadata = { title: "Katalog" };
export const revalidate = 30;

type Search = { q?: string; kategori?: string; grade?: string; maks?: string; urut?: string };

const CHIPS: { label: string; params: Partial<Search> }[] = [
  { label: "Semua", params: {} },
  { label: "HP", params: { kategori: "hp" } },
  { label: "Laptop", params: { kategori: "laptop" } },
  { label: "Kamera", params: { kategori: "kamera" } },
  { label: "Konsol", params: { kategori: "konsol" } },
  { label: "Di bawah Rp 5 jt", params: { maks: "5000000" } },
  { label: "Grade A", params: { grade: "A" } },
];

function qs(p: Record<string, string | undefined>) {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v && s.set(k, v));
  const str = s.toString();
  return str ? `?${str}` : "";
}

export default async function KatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const supabase = createPublicClient();
  let q = supabase.from("units").select("*").eq("status", "tersedia");
  if (sp.kategori) q = q.eq("category", sp.kategori as Category);
  if (sp.grade) q = q.eq("grade", sp.grade);
  if (sp.maks) q = q.lte("price_sell", Number(sp.maks));
  if (sp.q) q = q.or(`model.ilike.%${sp.q}%,brand.ilike.%${sp.q}%,variant.ilike.%${sp.q}%`);
  if (sp.urut === "murah") q = q.order("price_sell", { ascending: true });
  else if (sp.urut === "mahal") q = q.order("price_sell", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  const { data } = await q.limit(40);
  const units = (data ?? []) as Unit[];

  const isActive = (p: Partial<Search>) =>
    Object.keys(p).length === 0 ? !sp.kategori && !sp.grade && !sp.maks : Object.entries(p).every(([k, v]) => sp[k as keyof Search] === v);

  const hasFilter = !!(sp.q || sp.kategori || sp.grade || sp.maks);
  const SORTS: [string, string][] = [["baru", "Terbaru"], ["murah", "Termurah"], ["mahal", "Termahal"]];
  const curSort = sp.urut ?? "baru";

  return (
    <Shell active="katalog">
      <div className="bg-brand-navy text-white px-4 pt-5 pb-4 rounded-b-[26px]">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Katalog</h1>
          {hasFilter && <Link href="/katalog" className="h-9 px-3 rounded-full bg-white/15 flex items-center text-xs font-bold">Reset</Link>}
        </div>
        <form className="mt-3">
          <div className="bg-white rounded-2xl h-12 flex items-center gap-3 px-4 text-ink">
            <Icon.Search size={18} stroke="#8a93a6" />
            <input name="q" defaultValue={sp.q} placeholder="Cari merek, model, atau spesifikasi" className="flex-1 bg-transparent text-sm outline-none min-w-0" />
            {sp.kategori && <input type="hidden" name="kategori" value={sp.kategori} />}
          </div>
        </form>
        <div className="flex gap-2 mt-3 -mx-4 px-4 overflow-x-auto no-scrollbar">
          {CHIPS.map((c) => {
            const on = isActive(c.params);
            return (
              <Link key={c.label} href={`/katalog${qs({ q: sp.q, urut: sp.urut, ...c.params })}`} className={`shrink-0 h-9 px-3.5 rounded-full text-[12px] font-bold flex items-center ${on ? "bg-white text-brand-navy" : "bg-white/15 text-white"}`}>{c.label}</Link>
            );
          })}
        </div>
      </div>

      <div className="px-4 mt-4 flex items-center justify-between text-[12px]">
        <p className="text-muted"><b className="text-brand">{units.length} unit</b> · semua dicek ✓</p>
        <div className="flex items-center gap-1.5 text-[11px]">
          {SORTS.map(([v, l]) => (
            <Link key={v} href={`/katalog${qs({ ...sp, urut: v === "baru" ? undefined : v })}`} className={`px-2 py-1 rounded-md font-bold ${curSort === v ? "bg-brand-light text-brand-dark" : "text-muted"}`}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3 flex flex-col gap-2.5">
        {units.map((u) => <UnitCardRow key={u.id} u={u} />)}
        {!units.length && (
          <div className="card p-6 text-center text-sm text-muted">
            Tidak ada unit yang cocok. <Link href="/pantau-harga" className="text-brand font-bold">Pantau harga</Link> supaya dikabari saat {sp.kategori ? CATEGORY_LABEL[sp.kategori as Category] : "unit"} masuk.
          </div>
        )}
      </div>
    </Shell>
  );
}

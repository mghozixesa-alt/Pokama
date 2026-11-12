import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icons";
import { UnitCardRow } from "@/components/UnitCard";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Unit } from "@/lib/types";

export const metadata = { title: "Katalog" };
export const dynamic = "force-dynamic";

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
  const supabase = await createClient();
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

  return (
    <Shell active="katalog">
      <div className="px-4 pt-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-navy">Katalog</h1>
        <Link href="/katalog" className="card px-3 h-10 flex items-center gap-2 text-sm font-bold">Reset</Link>
      </div>

      <form className="px-4 mt-4">
        <label className="label">Cari di katalog</label>
        <div className="card h-12 flex items-center gap-3 px-4">
          <Icon.Search size={18} stroke="#8a93a6" />
          <input name="q" defaultValue={sp.q} placeholder="Merek, model, atau spesifikasi" className="flex-1 bg-transparent text-sm outline-none" />
          {sp.kategori && <input type="hidden" name="kategori" value={sp.kategori} />}
        </div>
      </form>

      <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar">
        {CHIPS.map((c) => {
          const on = isActive(c.params);
          return (
            <Link key={c.label} href={`/katalog${qs({ q: sp.q, ...c.params })}`} className={`shrink-0 h-10 px-3.5 rounded-full text-[13px] font-bold border ${on ? "bg-brand-navy border-brand-navy text-white" : "bg-white border-line text-ink"}`}>{c.label}</Link>
          );
        })}
      </div>

      <div className="mx-4 mt-3 card px-3 py-2 flex items-center gap-2 text-[11px]">
        <span className="font-bold text-brand-navy">Grade:</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-brand inline-block" />A mulus</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#f2a93b] inline-block" />B lecet pakai</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-[#8a93a6] inline-block" />C ada minus</span>
        <Link href="/sertifikat" className="ml-auto font-bold text-brand">Info</Link>
      </div>

      <div className="px-4 mt-3 flex items-center justify-between">
        <p className="text-sm text-muted">{units.length} unit tersedia · <b className="text-brand-navy">semua dicek</b></p>
        <form className="flex items-center gap-2 text-sm">
          {Object.entries(sp).filter(([k]) => k !== "urut").map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <span className="font-bold">Urutkan</span>
          <select name="urut" defaultValue={sp.urut ?? "baru"} className="h-9 px-2 rounded-lg border border-line bg-white text-sm">
            <option value="baru">Terbaru</option>
            <option value="murah">Harga terendah</option>
            <option value="mahal">Harga tertinggi</option>
          </select>
          <button className="btn-soft">OK</button>
        </form>
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

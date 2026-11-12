import { createPublicClient } from "@/lib/supabase/public";
import { Shell } from "@/components/Shell";
import { KatalogClient, type Filters } from "./KatalogClient";
import type { Unit } from "@/lib/types";

export const metadata = { title: "Katalog" };
export const revalidate = 30;

type Search = { q?: string; kategori?: string; merek?: string; grade?: string; maks?: string; urut?: string };

export default async function KatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const supabase = createPublicClient();
  const { data } = await supabase.from("units").select("*").eq("status", "tersedia").order("created_at", { ascending: false }).limit(300);
  const units = (data ?? []) as Unit[];
  const initial = Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string" && v)) as Partial<Filters>;
  return (
    <Shell active="katalog">
      <KatalogClient units={units} initial={initial} />
    </Shell>
  );
}

import { createClient } from "@/lib/supabase/server";
import { UnitForm } from "@/components/admin/UnitForm";

export const metadata = { title: "Unit baru" };

export default async function UnitBaruPage() {
  const supabase = await createClient();
  const { data: owners } = await supabase.from("owners").select("id, name, type").order("name");
  return (
    <div>
      <h1 className="text-[20px] leading-7 font-bold text-brand-navy mb-4">Unit baru</h1>
      <UnitForm owners={owners ?? []} />
    </div>
  );
}

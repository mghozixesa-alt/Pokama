"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icons";

/** Simpan/lepas unit ke daftar tersimpan. Tanpa login → diarahkan ke /masuk. */
export function SaveButton({ unitId, publicId, initial = null, className = "" }: { unitId: string; publicId: string; initial?: boolean | null; className?: string }) {
  const [saved, setSaved] = useState<boolean | null>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (initial !== null) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setSaved(false); return; }
      const { data } = await supabase.from("saved_units").select("unit_id").eq("unit_id", unitId).eq("customer_id", user.id).maybeSingle();
      setSaved(!!data);
    });
  }, [unitId, initial]);

  function toggle() {
    start(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/masuk?next=/unit/${publicId}`); return; }
      if (saved) { await supabase.from("saved_units").delete().eq("unit_id", unitId).eq("customer_id", user.id); setSaved(false); }
      else { await supabase.from("saved_units").insert({ unit_id: unitId, customer_id: user.id }); setSaved(true); }
      router.refresh();
    });
  }

  return (
    <button onClick={toggle} disabled={pending} aria-pressed={!!saved} aria-label={saved ? "Lepas dari tersimpan" : "Simpan unit"} className={`w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center transition ${saved ? "text-[#e5636b]" : "text-brand-navy"} ${className}`}>
      <Icon.Heart size={18} filled={!!saved} />
    </button>
  );
}

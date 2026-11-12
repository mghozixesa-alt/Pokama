import { Shell } from "@/components/Shell";

export default function Loading() {
  return (
    <Shell active="katalog">
      <div className="bg-brand-navy px-4 pt-5 pb-4 rounded-b-[24px]">
        <div className="h-9 w-28 rounded-lg bg-white/15" />
        <div className="mt-3 h-12 rounded-xl bg-white/90" />
        <div className="flex gap-2 mt-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-9 w-20 rounded-full bg-white/15" />)}</div>
      </div>
      <div className="px-4 mt-4 flex flex-col gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-2.5 flex gap-3"><div className="skeleton w-[92px] h-[92px]" /><div className="flex-1 flex flex-col gap-2 py-1"><div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-40" /><div className="skeleton h-3 w-28" /><div className="skeleton h-5 w-20 mt-auto" /></div></div>
        ))}
      </div>
    </Shell>
  );
}

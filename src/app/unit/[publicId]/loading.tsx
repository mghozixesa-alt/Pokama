import { Shell } from "@/components/Shell";

export default function Loading() {
  return (
    <Shell withNav={false}>
      <div className="px-4 pt-4 flex flex-col gap-4">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="skeleton aspect-square w-full rounded-2xl" />
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-6 w-3/4" />
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-24 w-full" />
      </div>
    </Shell>
  );
}

import type { Grade } from "@/lib/types";

const STYLE: Record<Grade, string> = {
  A: "bg-teal-light text-teal-dark",
  B: "bg-[#fdf1dc] text-[#7a4a00]",
  C: "bg-[#eceef3] text-[#3f4756]",
};

export function GradeBadge({ grade, className = "" }: { grade: Grade | null; className?: string }) {
  if (!grade) return null;
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-extrabold ${STYLE[grade]} ${className}`}>
      Grade {grade}
    </span>
  );
}

export function CheckedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-navy text-white text-[10px] font-extrabold ${className}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#20B4A9" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 7" /></svg>
      DICEK
    </span>
  );
}

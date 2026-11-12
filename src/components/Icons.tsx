import type { Category } from "@/lib/types";

type P = { size?: number; className?: string; stroke?: string };

const base = (size: number, stroke: string, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export const Icon = {
  Search: ({ size = 20, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
  ),
  Heart: ({ size = 20, className, stroke = "currentColor", filled = false }: P & { filled?: boolean }) => (
    <svg {...base(size, stroke, className)} fill={filled ? stroke : "none"}>
      <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.2 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.6 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  ),
  Home: ({ size = 22, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
  ),
  Orders: ({ size = 22, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
  ),
  User: ({ size = 22, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
  ),
  Chat: ({ size = 20, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M4 20l1.5-4A8 8 0 1 1 9 19.5L4 20z" /></svg>
  ),
  Shield: ({ size = 16, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  Check: ({ size = 16, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)} strokeWidth={2.6}><path d="M5 12l4 4L19 7" /></svg>
  ),
  ChevronRight: ({ size = 18, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M9 6l6 6-6 6" /></svg>
  ),
  ChevronDown: ({ size = 18, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M6 9l6 6 6-6" /></svg>
  ),
  ArrowLeft: ({ size = 20, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
  ),
  Pin: ({ size = 16, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
  ),
  Upload: ({ size = 18, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></svg>
  ),
  Copy: ({ size = 16, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
  ),
  Tag: ({ size = 18, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M3 12l9 9 9-9-9-9H3v9z" /><circle cx="8" cy="8" r="1.5" /></svg>
  ),
  Swap: ({ size = 18, className, stroke = "currentColor" }: P) => (
    <svg {...base(size, stroke, className)}><path d="M4 7h13l-3-3M20 17H7l3 3" /></svg>
  ),
};

/** Ikon kategori gaya outline (opsi B dari desain). */
export function CategoryIcon({ category, size = 26, stroke = "#2A7DC1" }: { category: Category; size?: number; stroke?: string }) {
  const b = base(size, stroke);
  switch (category) {
    case "hp": return <svg {...b}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10.5 5.5h3" /><circle cx="12" cy="18" r="0.9" fill={stroke} /></svg>;
    case "laptop": return <svg {...b}><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></svg>;
    case "kamera": return <svg {...b}><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>;
    case "tablet": return <svg {...b}><rect x="4" y="3" width="16" height="18" rx="2.5" /><circle cx="12" cy="18" r="0.9" fill={stroke} /></svg>;
    case "konsol": return <svg {...b}><path d="M7 7h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5.3 1.9L14 14h-4l-1.7 1.9A3 3 0 0 1 3 14v-3a4 4 0 0 1 4-4z" /><path d="M8 10v3M6.5 11.5h3" /><circle cx="16" cy="11" r="0.9" fill={stroke} /><circle cx="18" cy="12.5" r="0.9" fill={stroke} /></svg>;
    case "audio": return <svg {...b}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /></svg>;
    case "smartwatch": return <svg {...b}><rect x="7" y="6" width="10" height="12" rx="3" /><path d="M9 6V3h6v3M9 18v3h6v-3" /><path d="M12 10v2.5l1.5 1" /></svg>;
    case "drone": return <svg {...b}><circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="6" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><rect x="9" y="9.5" width="6" height="5" rx="1.5" /><path d="M7 8l2 2M17 8l-2 2M7 16l2-2M17 16l-2-2" /></svg>;
    default: return <svg {...b}><path d="M6 8h12l-1.5 11h-9L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
  }
}

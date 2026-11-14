import Image from "next/image";
import {
  Search, Heart, Share2, House, ReceiptText, CircleUserRound, MessageCircle, ShieldCheck, Check, ChevronRight, ChevronDown,
  ArrowLeft, MapPin, Upload, Copy, Tag, ArrowLeftRight, Plus, type LucideProps,
} from "lucide-react";
import type { Category } from "@/lib/types";

type P = { size?: number; className?: string; stroke?: string; filled?: boolean };

/** Set ikon garis profesional (Lucide), satu ketebalan untuk seluruh aplikasi. */
const wrap = (C: React.ComponentType<LucideProps>, sw = 2) =>
  function IconC({ size = 20, className, stroke = "currentColor", filled = false }: P) {
    return <C size={size} className={className} color={stroke} strokeWidth={sw} fill={filled ? stroke : "none"} aria-hidden />;
  };

export const Icon = {
  Search: wrap(Search),
  Heart: wrap(Heart),
  Share: wrap(Share2),
  Home: wrap(House),
  Orders: wrap(ReceiptText),
  User: wrap(CircleUserRound),
  Chat: wrap(MessageCircle),
  Shield: wrap(ShieldCheck),
  Check: wrap(Check, 2.6),
  ChevronRight: wrap(ChevronRight),
  ChevronDown: wrap(ChevronDown),
  ArrowLeft: wrap(ArrowLeft),
  Pin: wrap(MapPin),
  Upload: wrap(Upload),
  Copy: wrap(Copy),
  Tag: wrap(Tag),
  Swap: wrap(ArrowLeftRight),
  Plus: wrap(Plus, 2.4),
};

/** Ikon 3D kategori (Microsoft Fluent Emoji, MIT) — dipakai di ubin kategori & placeholder foto. */
export function CategoryIcon({ category, size = 40, className = "" }: { category: Category; size?: number; className?: string; stroke?: string }) {
  return <Image src={`/3d/${category}.png`} alt="" width={size} height={size} className={`object-contain drop-shadow-[0_6px_10px_rgba(16,54,92,0.18)] ${className}`} />;
}

/** Ikon 3D umum (jaminan, ajakan jual, dsb.). */
export function Icon3D({ name, size = 40, className = "" }: { name: "shield" | "check" | "label" | "money" | "handshake" | "sparkles" | "package" | "receipt"; size?: number; className?: string }) {
  return <Image src={`/3d/${name}.png`} alt="" width={size} height={size} className={`object-contain ${className}`} />;
}

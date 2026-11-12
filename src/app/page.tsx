import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Logo } from "@/components/Logo";
import { Icon, CategoryIcon } from "@/components/Icons";
import { UnitCardGrid } from "@/components/UnitCard";
import { BannerCarousel, type Slide } from "@/components/BannerCarousel";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Unit } from "@/lib/types";

export const revalidate = 60;

const CATEGORIES: { id: Category; badge?: string }[] = [
  { id: "hp", badge: "🔥 Terlaris" }, { id: "laptop" }, { id: "kamera" }, { id: "tablet" }, { id: "konsol" },
  { id: "audio" }, { id: "smartwatch" }, { id: "drone", badge: "BARU" }, { id: "aksesori" },
];

const SLIDES: Slide[] = [
  { kicker: "Tukar tambah", title: "HP lama jadi potongan harga", sub: "Cek estimasi 1 menit, dicek fisik di toko.", cta: "Cek estimasi", href: "/tukar-tambah", img: "/seed/banner1.jpg", sticker: { big: "+Rp 3,5 jt", small: "POTONGAN MAKS", tone: "white" } },
  { kicker: "Promo bulan ini", title: "Laptop kerja grade A", sub: "Bersertifikat cek 8 langkah, garansi 30 hari.", cta: "Lihat laptop", href: "/katalog?kategori=laptop", img: "/seed/banner2.jpg", sticker: { big: "10%", small: "HEMAT", tone: "navy" } },
  { kicker: "Jual ke Niagaaja", title: "Jual elektronik tanpa ribet", sub: "Dicek gratis, dibayar hari itu juga.", cta: "Jual sekarang", href: "/tukar-tambah", img: "/seed/banner3.jpg", sticker: { big: "Rp 0", small: "BIAYA CEK", tone: "teal" } },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("status", "tersedia")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <Shell active="beranda">
      {/* Hero biru */}
      <section className="relative h-[292px] bg-gradient-to-b from-[#2F8AD6] to-[#1F5F9E] rounded-b-[32px]">
        <div className="flex items-center justify-between px-5 pt-[18px]">
          <span className="inline-flex items-center h-12 px-3.5 rounded-2xl bg-white"><Logo height={34} /></span>
          <div className="flex items-center gap-2.5">
            <Link href="/akun#tersimpan" aria-label="Tersimpan" className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-brand-navy"><Icon.Heart /></Link>
            <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER ?? ""}`} aria-label="Chat WhatsApp" className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white"><Icon.Chat /></a>
          </div>
        </div>
        <div className="px-5 mt-6 text-white">
          <p className="text-sm opacity-90">Halo, mau cari apa hari ini?</p>
          <button className="flex items-center gap-2 text-[30px] leading-9 font-extrabold tracking-tight">Garut Kota <Icon.ChevronDown size={22} /></button>
        </div>
        <form action="/katalog" className="absolute left-5 right-5 top-[172px] h-[54px] bg-white rounded-2xl shadow-[0_10px_30px_rgba(10,60,55,0.18)] flex items-center gap-3 px-[18px]">
          <Icon.Search stroke="#2A7DC1" />
          <input name="q" placeholder="Cari iPhone 13, ThinkPad, PS5…" className="flex-1 h-full bg-transparent text-sm outline-none placeholder:text-[#8a93a6]" />
        </form>
      </section>

      {/* Kategori */}
      <section className="mx-4 -mt-[50px] relative card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-brand-navy">Kategori</h2>
          <Link href="/katalog" className="text-xs font-bold text-brand">Semua</Link>
        </div>
        <div className="grid grid-cols-5 gap-x-2 gap-y-4">
          {CATEGORIES.map((c) => (
            <Link key={c.id} href={`/katalog?kategori=${c.id}`} className="relative flex flex-col items-center gap-2 text-[11px] font-semibold text-ink">
              <span className="w-14 h-14 rounded-2xl bg-white border-[1.5px] border-line flex items-center justify-center"><CategoryIcon category={c.id} /></span>
              {CATEGORY_LABEL[c.id]}
              {c.badge && <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-[#e5636b] text-white text-[8px] font-extrabold whitespace-nowrap">{c.badge}</span>}
            </Link>
          ))}
          <Link href="/katalog" className="flex flex-col items-center gap-2 text-[11px] font-semibold text-ink">
            <span className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center text-brand font-extrabold text-lg">+</span>Lainnya
          </Link>
        </div>
      </section>

      <BannerCarousel slides={SLIDES} />

      {/* Baru masuk */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold text-brand-navy">Baru masuk</h2>
          <Link href="/katalog" className="text-xs font-bold text-brand">Lihat semua</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(units as Unit[] | null)?.map((u) => <UnitCardGrid key={u.id} u={u} />)}
          {!units?.length && <p className="col-span-2 text-sm text-muted">Belum ada unit tersedia.</p>}
        </div>
      </section>

      {/* Jaminan */}
      <section className="px-4 mt-6 grid grid-cols-3 gap-2">
        {[["8 langkah", "dicek teknisi"], ["30 hari", "garansi tukar"], ["Bisa tawar", "tanpa DP"]].map(([a, b]) => (
          <div key={a} className="card p-3 text-center"><p className="text-sm font-extrabold text-brand-navy">{a}</p><p className="text-[10px] text-muted">{b}</p></div>
        ))}
      </section>
    </Shell>
  );
}

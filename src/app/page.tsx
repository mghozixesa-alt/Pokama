import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { Shell } from "@/components/Shell";
import { Logo } from "@/components/Logo";
import { Icon, CategoryIcon, Icon3D } from "@/components/Icons";
import { UnitCardGrid } from "@/components/UnitCard";
import { BannerCarousel, type Slide } from "@/components/BannerCarousel";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Unit } from "@/lib/types";

export const revalidate = 60;

/** Warna lembut per kategori: latar ubin + warna ikon. */
const CATEGORIES: { id: Category; bg: string; fg: string }[] = [
  { id: "hp", bg: "#E8F1FB", fg: "#2A7DC1" }, { id: "laptop", bg: "#FFF1E3", fg: "#D97A1F" }, { id: "kamera", bg: "#E7F5EC", fg: "#2E8B57" },
  { id: "tablet", bg: "#F1EAFB", fg: "#7A4FBF" }, { id: "konsol", bg: "#FDE9EE", fg: "#D64561" }, { id: "audio", bg: "#E6F6F8", fg: "#1A9DBB" },
  { id: "smartwatch", bg: "#FFF8DC", fg: "#B5860B" }, { id: "drone", bg: "#EAF0F5", fg: "#4E5D72" }, { id: "aksesori", bg: "#F3F5F9", fg: "#10365C" },
];

const SLIDES: Slide[] = [
  { kicker: "Tukar tambah", title: "HP lama jadi potongan harga", sub: "Cek estimasi 1 menit, dicek fisik di toko.", cta: "Cek estimasi", href: "/tukar-tambah", img: "https://images.unsplash.com/photo-1758876018661-41b3c4012df8?auto=format&fit=crop&w=900&q=80", sticker: { big: "+Rp 3,5 jt", small: "POTONGAN MAKS", tone: "white" } },
  { kicker: "Promo bulan ini", title: "Laptop kerja grade A", sub: "Bersertifikat cek 8 langkah, garansi 30 hari.", cta: "Lihat laptop", href: "/katalog?kategori=laptop", img: "https://images.unsplash.com/photo-1503945438517-f65904a52ce6?auto=format&fit=crop&w=900&q=80", sticker: { big: "10%", small: "HEMAT", tone: "navy" } },
  { kicker: "Jual ke Niagaaja", title: "Jual elektronik tanpa ribet", sub: "Dicek gratis, dibayar hari itu juga.", cta: "Jual sekarang", href: "/tukar-tambah", img: "https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&w=900&q=80", sticker: { big: "Rp 0", small: "BIAYA CEK", tone: "teal" } },
];

export default async function HomePage() {
  const supabase = createPublicClient();
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("status", "tersedia")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <Shell active="beranda">
      {/* Hero biru */}
      <section className="relative h-[300px] bg-gradient-to-b from-[#2F8AD6] to-[#1F5F9E] rounded-b-[28px] overflow-hidden">
        {/* dekorasi lembut */}
        <span aria-hidden className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10" />
        <span aria-hidden className="absolute top-24 -left-16 w-40 h-40 rounded-full bg-white/[0.07]" />
        <div className="relative flex items-center justify-between px-5 pt-[18px]">
          <span className="inline-flex items-center h-11 px-3 rounded-xl bg-white shadow-[0_4px_14px_rgba(16,54,92,0.18)]"><Logo height={30} /></span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 h-9 px-3 rounded-full bg-white/15 text-white text-[11px] font-semibold"><Icon.Pin size={13} stroke="#ffffff" />Garut Kota</span>
            <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER ?? ""}`} aria-label="Chat WhatsApp" className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white"><Icon.Chat size={18} /></a>
          </div>
        </div>
        <div className="relative px-5 mt-7 text-white">
          <h1 className="text-[26px] leading-[31px] font-bold tracking-[-0.3px]">Elektronik bekas,<br />bersertifikat.</h1>
          <p className="text-[12px] mt-1.5 text-white/85">Dicek 8 langkah · garansi 30 hari · bisa ditawar</p>
        </div>
        <form action="/katalog" className="absolute left-5 right-5 top-[196px] h-[54px] bg-white rounded-2xl shadow-[0_10px_28px_rgba(16,54,92,0.22)] flex items-center gap-3 pl-[18px] pr-2">
          <Icon.Search stroke="#8a93a6" />
          <input name="q" placeholder="Cari iPhone 13, ThinkPad, PS5…" className="flex-1 h-full bg-transparent text-sm outline-none placeholder:text-[#8a93a6] min-w-0" />
          <button className="h-10 px-4 rounded-xl bg-brand text-white text-xs font-bold">Cari</button>
        </form>
      </section>

      {/* Kategori */}
      <section className="mx-4 -mt-[38px] relative card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Kategori</h2>
          <Link href="/katalog" className="text-xs font-semibold text-brand">Semua</Link>
        </div>
        <div className="grid grid-cols-5 gap-x-2 gap-y-4">
          {CATEGORIES.map((c) => (
            <Link key={c.id} href={`/katalog?kategori=${c.id}`} className="flex flex-col items-center gap-2 text-[11px] font-medium text-ink text-center">
              <span className="w-[60px] h-[60px] rounded-2xl flex items-center justify-center transition active:scale-95" style={{ background: c.bg }}><CategoryIcon category={c.id} size={38} /></span>
              {CATEGORY_LABEL[c.id]}
            </Link>
          ))}
          <Link href="/katalog" className="flex flex-col items-center gap-2 text-[11px] font-medium text-ink">
            <span className="w-[60px] h-[60px] rounded-2xl bg-brand-light flex items-center justify-center text-brand"><Icon.Plus size={24} /></span>Lainnya
          </Link>
        </div>
      </section>

      {/* Baru masuk */}
      <section className="px-4 mt-6">
        <div className="flex items-end justify-between mb-3">
          <div><h2 className="section-title">Baru masuk</h2><p className="text-[11px] text-muted">Lolos cek, siap diambil atau dikirim</p></div>
          <Link href="/katalog" className="text-xs font-semibold text-brand">Lihat semua</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(units as Unit[] | null)?.map((u) => <UnitCardGrid key={u.id} u={u} />)}
          {!units?.length && <p className="col-span-2 text-sm text-muted">Belum ada unit tersedia.</p>}
        </div>
      </section>

      <BannerCarousel slides={SLIDES} />

      {/* Jaminan */}
      <section className="mx-4 mt-6 card p-4">
        <h2 className="section-title">Kenapa beli di Niagaaja</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([["shield", "Dicek 8 langkah", "oleh teknisi, ada sertifikat"], ["check", "Garansi 30 hari", "tukar atau perbaiki gratis"], ["label", "Bisa ditawar", "tanpa DP, jawab < 24 jam"]] as const).map(([ic, a, b]) => (
            <div key={ic} className="flex flex-col items-center text-center gap-1.5">
              <span className="w-14 h-14 rounded-2xl bg-page flex items-center justify-center"><Icon3D name={ic} size={36} /></span>
              <p className="text-[12px] font-semibold text-brand-navy leading-4">{a}</p>
              <p className="text-[10px] text-muted leading-[13px]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ajakan jual */}
      <Link href="/tukar-tambah" className="mx-4 mt-3 mb-2 block relative overflow-hidden rounded-2xl bg-brand-navy text-white p-4 pr-28">
        <span aria-hidden className="absolute -right-6 -top-8 w-32 h-32 rounded-full bg-brand/60" />
        <span aria-hidden className="absolute right-5 top-1/2 -translate-y-1/2"><Icon3D name="money" size={72} /></span>
        <p className="text-[10px] font-bold tracking-wider uppercase text-white/70">Punya gadget lama?</p>
        <p className="text-[16px] font-bold leading-5 mt-1">Jual ke Niagaaja, dibayar hari ini</p>
        <span className="inline-flex items-center h-8 px-3.5 mt-3 rounded-full bg-white text-brand-dark text-xs font-bold">Cek estimasi</span>
      </Link>

      {/* Tautan kategori (untuk pencarian Google) */}
      <nav aria-label="Kategori populer" className="px-4 mt-4 mb-2 flex flex-wrap gap-2 text-[11px]">
        {[["hp-bekas-garut", "HP bekas Garut"], ["laptop-bekas-garut", "Laptop bekas Garut"], ["kamera-bekas-garut", "Kamera bekas Garut"], ["konsol-bekas-garut", "PS5 & konsol bekas Garut"]].map(([s, l]) => (
          <Link key={s} href={`/jual-beli/${s}`} className="px-3 h-7 inline-flex items-center rounded-full bg-white border border-line text-muted font-medium">{l}</Link>
        ))}
      </nav>
    </Shell>
  );
}

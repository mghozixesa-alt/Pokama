import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { Shell, TopBar } from "@/components/Shell";
import { UnitCardGrid } from "@/components/UnitCard";
import { CategoryIcon, Icon3D } from "@/components/Icons";
import { CATEGORY_LABEL, rupiahShort } from "@/lib/format";
import type { Category, Unit } from "@/lib/types";

export const revalidate = 600;

/** Halaman landing per kategori untuk pencarian Google: "hp bekas garut", "laptop bekas garut", dst. */
const PAGES: Record<string, { category: Category; title: string; h1: string; intro: string; faq: [string, string][] }> = {
  "hp-bekas-garut": {
    category: "hp", title: "HP Bekas Garut Bersertifikat & Bergaransi", h1: "HP bekas di Garut, dicek 8 langkah",
    intro: "iPhone, Samsung, Xiaomi, dan HP bekas lain di Garut yang sudah dicek teknisi: IMEI bersih, baterai diukur, layar dan kamera diuji. Grade jelas (A/B/C), garansi 30 hari, harga bisa ditawar tanpa DP.",
    faq: [["Apakah IMEI dicek?", "Ya. IMEI/serial dicek, akun iCloud/Google dipastikan sudah keluar, dan hasilnya tercantum di sertifikat tiap unit."], ["Bagaimana kalau baterai cepat habis?", "Kesehatan baterai tertulis di spesifikasi. Kalau turun drastis dalam masa garansi, bisa diklaim."], ["Bisa cicil?", "Pembayaran manual lewat transfer atau tunai di toko. Cicilan belum tersedia."]],
  },
  "laptop-bekas-garut": {
    category: "laptop", title: "Laptop Bekas Garut Bergaransi — ThinkPad, MacBook, ASUS", h1: "Laptop bekas di Garut untuk kerja & kuliah",
    intro: "Laptop bekas pilihan untuk kerja, kuliah, dan desain: ThinkPad, MacBook, ASUS, Acer. Setiap unit dites baterai, keyboard, port, dan layar; spesifikasi lengkap tertulis; garansi 30 hari.",
    faq: [["Apakah sudah terinstal Windows/Office?", "Windows asli bawaan unit tetap aktif. Office dan aplikasi lain dipasang sesuai permintaan."], ["Baterai masih bagus?", "Siklus dan kapasitas baterai ditulis di spesifikasi; grade C berarti ada minus yang disebutkan jelas."], ["Bisa tukar tambah laptop lama?", "Bisa. Isi form tukar tambah, dapat estimasi 1 menit, cek fisik gratis di toko."]],
  },
  "kamera-bekas-garut": {
    category: "kamera", title: "Kamera Bekas Garut — Mirrorless & DSLR Bersertifikat", h1: "Kamera bekas di Garut, shutter count tercatat",
    intro: "Sony, Canon, Fujifilm, dan Nikon bekas dengan shutter count tercatat, sensor dicek dari debu/jamur, dan lensa diuji. Cocok untuk konten, dokumentasi, dan belajar fotografi.",
    faq: [["Shutter count berapa yang masih aman?", "Di bawah 50 ribu umumnya masih sangat layak; angka pastinya ada di tiap unit."], ["Lensa termasuk?", "Tertulis di kelengkapan: 'kit' berarti termasuk lensa kit, 'body only' berarti badan saja."], ["Ada garansi?", "30 hari untuk grade A/B, 7 hari untuk grade C."]],
  },
  "konsol-bekas-garut": {
    category: "konsol", title: "PS5, PS4, Nintendo Switch Bekas Garut Bergaransi", h1: "Konsol game bekas di Garut",
    intro: "PlayStation dan Nintendo Switch bekas yang dites stik, port, dan disc drive. Jumlah stik dan kelengkapan tertulis; garansi 30 hari; bisa ditawar.",
    faq: [["Akun PSN/Nintendo sudah dilepas?", "Ya, unit direset pabrik dan akun lama dikeluarkan sebelum dijual."], ["Stik drift?", "Semua stik diuji; kalau ada minus ditulis dan unit masuk grade C."], ["Bisa tukar tambah?", "Bisa — konsol lama jadi potongan harga."]],
  },
};

export function generateStaticParams() { return Object.keys(PAGES).map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const p = PAGES[slug];
  if (!p) return {};
  return { title: p.title, description: p.intro.slice(0, 155), alternates: { canonical: `/jual-beli/${slug}` }, openGraph: { title: p.title, description: p.intro.slice(0, 155) } };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const p = PAGES[slug];
  if (!p) notFound();
  const { data } = await createPublicClient().from("units").select("*").eq("status", "tersedia").eq("category", p.category).order("created_at", { ascending: false }).limit(8);
  const units = (data ?? []) as Unit[];
  const min = units.length ? Math.min(...units.map((u) => u.price_sell)) : null;
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };

  return (
    <Shell active="katalog">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <TopBar title={CATEGORY_LABEL[p.category]} back="/" />
      <section className="mx-4 card p-5 flex gap-4 items-start">
        <CategoryIcon category={p.category} size={56} />
        <div className="min-w-0">
          <h1 className="text-[18px] leading-6 font-bold text-brand-navy">{p.h1}</h1>
          <p className="text-[12px] text-muted mt-2">{p.intro}</p>
          {min && <p className="text-[12px] mt-2">Mulai <b className="text-brand-navy">{rupiahShort(min)}</b> · {units.length} unit tersedia</p>}
        </div>
      </section>

      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3"><h2 className="section-title">Tersedia sekarang</h2><Link href={`/katalog?kategori=${p.category}`} className="text-xs font-semibold text-brand">Semua {CATEGORY_LABEL[p.category].toLowerCase()}</Link></div>
        <div className="grid grid-cols-2 gap-3">{units.map((u) => <UnitCardGrid key={u.id} u={u} />)}</div>
        {!units.length && <div className="card p-5 text-sm text-muted">Stok {CATEGORY_LABEL[p.category].toLowerCase()} sedang kosong. <Link href="/pantau-harga" className="text-brand font-semibold">Pantau harga</Link> supaya dikabari saat masuk.</div>}
      </section>

      <section className="mx-4 mt-6 card p-4">
        <h2 className="section-title">Cara kami memastikan unit layak</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {([["shield", "Dicek 8 langkah"], ["check", "Garansi 30 hari"], ["label", "Bisa ditawar"]] as const).map(([ic, t]) => (
            <div key={ic} className="flex flex-col items-center gap-1.5"><Icon3D name={ic} size={36} /><p className="text-[11px] font-semibold text-brand-navy">{t}</p></div>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-3">Fisik, layar, baterai, kamera & audio, konektivitas, tombol & port, akun & IMEI/serial, kelengkapan. Hasilnya jadi sertifikat dengan QR di tiap unit. <Link href="/sertifikat" className="text-brand font-semibold">Baca selengkapnya</Link></p>
      </section>

      <section className="px-4 mt-6">
        <h2 className="section-title mb-2">Pertanyaan umum</h2>
        <div className="card divide-y divide-page">
          {p.faq.map(([q, a]) => (
            <details key={q} className="group"><summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3 text-[13px] font-semibold"><span>{q}</span><span className="text-muted transition-transform group-open:rotate-180">⌄</span></summary><p className="px-4 pb-4 text-[12px] text-muted -mt-1">{a}</p></details>
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <div className="card p-4 flex flex-wrap gap-2 text-[12px]">
          <span className="text-muted w-full">Kategori lain di Garut:</span>
          {Object.entries(PAGES).filter(([s]) => s !== slug).map(([s, v]) => <Link key={s} href={`/jual-beli/${s}`} className="px-3 h-8 inline-flex items-center rounded-full bg-page font-semibold text-brand-navy">{CATEGORY_LABEL[v.category]} bekas</Link>)}
        </div>
      </section>
    </Shell>
  );
}

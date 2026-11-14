"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { House, ShoppingCart, BadgeDollarSign, Handshake, Package, ArrowLeftRight, Wrench, FileBarChart2, BookOpen, Store, Menu, X, Printer, ChevronRight, type LucideProps } from "lucide-react";
import { Logo } from "@/components/Logo";

type Item = { href: string; label: string; Icon: React.ComponentType<LucideProps> };
// Urutan & penamaan mengikuti pola aplikasi akuntansi (Kledo): Beranda → Penjualan → Pembelian → Produk → Laporan → Pengaturan
const NAV: Item[] = [
  { href: "/admin", label: "Beranda", Icon: House },
  { href: "/admin/pesanan", label: "Penjualan", Icon: ShoppingCart },
  { href: "/admin/pembayaran", label: "Konfirmasi bayar", Icon: BadgeDollarSign },
  { href: "/admin/tawaran", label: "Penawaran", Icon: Handshake },
  { href: "/admin/tukar-tambah", label: "Pembelian", Icon: ArrowLeftRight },
  { href: "/admin/stok", label: "Produk & stok", Icon: Package },
  { href: "/admin/servis", label: "Servis & garansi", Icon: Wrench },
  { href: "/admin/laporan", label: "Laporan", Icon: FileBarChart2 },
  { href: "/admin/panduan", label: "Panduan", Icon: BookOpen },
];
const TITLE: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.href, n.label]));

export function AdminShell({ counts, user, children }: { counts: Record<string, number>; user: { name: string; role: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const current = NAV.filter((n) => active(n.href)).pop();

  const menu = (
    <nav className="flex flex-col py-3 text-[13.5px]">
      {NAV.map(({ href, label, Icon }) => {
        const on = active(href); const n = counts[href];
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)} className={`relative flex items-center gap-3 h-11 px-5 transition-colors ${on ? "bg-[#E8F1FB] text-[#1F5F9E] font-semibold" : "text-[#4A5568] hover:bg-[#F4F7FB] hover:text-[#10365C]"}`}>
            {on && <span className="absolute right-0 top-0 bottom-0 w-[3px] bg-[#2A7DC1]" />}
            <Icon size={18} strokeWidth={1.9} className={on ? "text-[#2A7DC1]" : "text-[#8A94A6]"} />
            <span className="flex-1 truncate">{label}</span>
            {n ? <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#F5A623] text-white text-[10px] font-bold inline-flex items-center justify-center">{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[#F0F2F5] text-ink admin">
      {/* Sidebar putih (desktop) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[228px] flex-col bg-white border-r border-[#E6EAF0] z-40 print:hidden">
        <div className="h-[60px] px-5 flex items-center border-b border-[#E6EAF0]"><Logo height={26} /></div>
        <div className="flex-1 overflow-y-auto">{menu}</div>
        <Link href="/" className="h-11 px-5 flex items-center gap-3 text-[13px] text-[#8A94A6] hover:text-[#10365C] border-t border-[#E6EAF0]"><Store size={17} />Lihat toko</Link>
      </aside>

      {/* Header putih */}
      <header className="sticky top-0 z-30 lg:ml-[228px] h-[60px] bg-white border-b border-[#E6EAF0] flex items-center gap-3 px-4 lg:px-6 print:hidden">
        <button aria-label="Menu" onClick={() => setOpen(!open)} className="lg:hidden w-9 h-9 rounded-lg border border-[#E6EAF0] inline-flex items-center justify-center text-[#10365C]">{open ? <X size={18} /> : <Menu size={18} />}</button>
        <span className="lg:hidden"><Logo height={22} /></span>
        <div className="hidden lg:flex items-center gap-1.5 text-[13px] text-[#8A94A6]">
          <span>Niagaaja</span><ChevronRight size={14} /><span className="text-[#10365C] font-semibold">{current ? TITLE[current.href] : "Admin"}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => window.print()} className="hidden sm:inline-flex h-9 px-3 rounded-lg border border-[#E6EAF0] text-[12.5px] font-medium text-[#4A5568] items-center gap-1.5 hover:border-[#2A7DC1] hover:text-[#2A7DC1]"><Printer size={15} />Print</button>
          <div className="flex items-center gap-2 pl-2 sm:border-l border-[#E6EAF0]">
            <span className="w-8 h-8 rounded-full bg-[#2A7DC1] text-white font-semibold text-[12px] inline-flex items-center justify-center">{user.name.slice(0, 1).toUpperCase()}</span>
            <div className="hidden md:block leading-tight"><p className="text-[12.5px] font-semibold text-[#10365C]">{user.name}</p><p className="text-[11px] text-[#8A94A6] capitalize">{user.role}</p></div>
          </div>
        </div>
      </header>

      {/* Menu mobile */}
      {open && <div className="lg:hidden fixed inset-0 top-[60px] z-30 bg-white overflow-y-auto">{menu}<Link href="/" className="h-11 px-5 flex items-center gap-3 text-[13px] text-[#8A94A6] border-t border-[#E6EAF0]"><Store size={17} />Lihat toko</Link></div>}

      <main className="lg:ml-[228px]"><div className="px-4 py-5 lg:px-6 lg:py-6 max-w-[1280px]">{children}</div></main>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Boxes, BadgeDollarSign, Handshake, ReceiptText, ArrowLeftRight, Wrench, BookOpen, Store, Menu, X, type LucideProps } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/Logo";

type Item = { href: string; label: string; Icon: React.ComponentType<LucideProps> };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Utama", items: [{ href: "/admin", label: "Dasbor", Icon: LayoutDashboard }] },
  { title: "Operasional", items: [
    { href: "/admin/pesanan", label: "Pesanan", Icon: ReceiptText },
    { href: "/admin/pembayaran", label: "Konfirmasi bayar", Icon: BadgeDollarSign },
    { href: "/admin/tawaran", label: "Tawaran", Icon: Handshake },
    { href: "/admin/servis", label: "Servis & klaim", Icon: Wrench },
  ]},
  { title: "Stok", items: [
    { href: "/admin/stok", label: "Stok & kepemilikan", Icon: Boxes },
    { href: "/admin/tukar-tambah", label: "Jual / tukar tambah", Icon: ArrowLeftRight },
  ]},
  { title: "Bantuan", items: [{ href: "/admin/panduan", label: "Panduan", Icon: BookOpen }] },
];

export function AdminSidebar({ counts, user }: { counts: Record<string, number>; user: { name: string; role: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const list = (
    <nav className="flex flex-col gap-4 px-3 py-4 text-[13px]">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{g.title}</p>
          <div className="flex flex-col gap-0.5">
            {g.items.map(({ href, label, Icon }) => {
              const on = active(href); const n = counts[href];
              return (
                <Link key={href} href={href} onClick={() => setOpen(false)} className={`relative flex items-center gap-3 h-10 px-3 rounded-lg font-medium transition-colors ${on ? "bg-white/[0.12] text-white" : "text-white/70 hover:bg-white/[0.07] hover:text-white"}`}>
                  {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#5BB0F0]" />}
                  <Icon size={18} strokeWidth={1.9} className={on ? "text-[#5BB0F0]" : ""} />
                  <span className="flex-1 truncate">{label}</span>
                  {n ? <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#e5636b] text-white text-[10px] font-bold inline-flex items-center justify-center">{n}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <Link href="/" className="flex items-center gap-3 h-10 px-3 rounded-lg text-white/60 hover:bg-white/[0.07] hover:text-white font-medium"><Store size={18} strokeWidth={1.9} /><span>Lihat toko</span></Link>
    </nav>
  );
  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[232px] flex-col bg-[#10365C] text-white z-40">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-white/10"><span className="inline-flex items-center h-9 px-2.5 rounded-lg bg-white"><Logo height={22} /></span><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Admin</span></div>
        <div className="flex-1 overflow-y-auto">{list}</div>
        <div className="px-4 py-3 border-t border-white/10 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#5BB0F0] text-[#10365C] font-bold text-[12px] inline-flex items-center justify-center">{user.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0"><p className="text-[12px] font-semibold truncate">{user.name}</p><p className="text-[10px] text-white/50 capitalize">{user.role}</p></div>
        </div>
      </aside>
      {/* Bar atas mobile */}
      <div className="lg:hidden sticky top-0 z-40 h-14 bg-[#10365C] text-white flex items-center gap-3 px-4">
        <button aria-label="Menu" onClick={() => setOpen(!open)} className="w-9 h-9 rounded-lg bg-white/10 inline-flex items-center justify-center">{open ? <X size={18} /> : <Menu size={18} />}</button>
        <span className="inline-flex items-center h-8 px-2 rounded-lg bg-white"><Logo height={20} /></span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Admin</span>
        <span className="ml-auto w-8 h-8 rounded-full bg-[#5BB0F0] text-[#10365C] font-bold text-[12px] inline-flex items-center justify-center">{user.name.slice(0, 1).toUpperCase()}</span>
      </div>
      {open && <div className="lg:hidden fixed inset-0 top-14 z-30 bg-[#10365C] text-white overflow-y-auto">{list}</div>}
    </>
  );
}

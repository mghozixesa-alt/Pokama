import Link from "next/link";
import { Icon } from "./Icons";

type Tab = "beranda" | "pesanan" | "katalog" | "akun";

/** Pembungkus layar pelanggan: lebar maks 480px di desktop, nav bawah 4 tab. */
export function Shell({ children, active, withNav = true }: { children: React.ReactNode; active?: Tab; withNav?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[480px] min-h-dvh bg-page relative">
      <div className={withNav ? "pb-28" : "pb-8"}>{children}</div>
      {withNav && <BottomNav active={active} />}
    </div>
  );
}

export function BottomNav({ active }: { active?: Tab }) {
  const item = (id: Tab, href: string, label: string, icon: React.ReactNode) => {
    const on = id === active;
    return (
      <Link key={id} href={href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center justify-end gap-1 pb-1 text-[10px] font-medium transition-colors ${on ? "text-brand" : "text-[#8a93a6]"}`}>
        <span className={`w-11 h-7 rounded-full flex items-center justify-center transition-colors ${on ? "bg-brand-light" : ""}`}>{icon}</span>
        {label}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-[74px] bg-white border-t border-line grid grid-cols-5 items-end px-1.5 pb-2.5 z-30"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))" }}
    >
      {item("beranda", "/", "Beranda", <Icon.Home />)}
      {item("katalog", "/katalog", "Cari", <Icon.Search size={22} />)}
      <Link href="/tukar-tambah" aria-label="Jual / tukar tambah" className="relative -top-[18px] flex flex-col items-center gap-1 text-[10px] font-semibold text-brand-navy">
        <span className="w-14 h-14 rounded-full bg-gradient-to-b from-[#2F8AD6] to-[#1F5F9E] border-4 border-page flex items-center justify-center shadow-[0_8px_18px_rgba(42,125,193,0.35)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        Jual
      </Link>
      {item("pesanan", "/pesanan", "Pesanan", <Icon.Orders />)}
      {item("akun", "/akun", "Akun", <Icon.User />)}
    </nav>
  );
}

export function TopBar({ title, back = "/", right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-page/95 backdrop-blur flex items-center gap-3 px-4 h-16">
      <Link href={back} aria-label="Kembali" className="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center">
        <Icon.ArrowLeft />
      </Link>
      <h1 className="text-lg font-bold text-brand-navy flex-1 truncate">{title}</h1>
      {right}
    </header>
  );
}

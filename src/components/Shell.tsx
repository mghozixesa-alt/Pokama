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
  const tabs: { id: Tab; href: string; label: string; icon: React.ReactNode }[] = [
    { id: "beranda", href: "/", label: "Beranda", icon: <Icon.Home /> },
    { id: "pesanan", href: "/pesanan", label: "Pesanan", icon: <Icon.Orders /> },
    { id: "katalog", href: "/katalog", label: "Pencarian", icon: <Icon.Search size={22} /> },
    { id: "akun", href: "/akun", label: "Akun", icon: <Icon.User /> },
  ];
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-[84px] bg-white border-t border-line grid grid-cols-4 px-3 pt-2.5 pb-[18px] z-30"
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link key={t.id} href={t.href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-1 text-xs ${on ? "text-brand-navy font-bold" : "text-[#8a93a6] font-semibold"}`}>
            <span className={`w-14 h-[34px] flex items-center justify-center rounded-full ${on ? "bg-brand-light text-brand" : ""}`}>{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TopBar({ title, back = "/", right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-page/95 backdrop-blur flex items-center gap-3 px-4 h-16">
      <Link href={back} aria-label="Kembali" className="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center">
        <Icon.ArrowLeft />
      </Link>
      <h1 className="text-lg font-extrabold text-brand-navy flex-1 truncate">{title}</h1>
      {right}
    </header>
  );
}

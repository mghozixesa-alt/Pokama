import Link from "next/link";
import { Shell } from "@/components/Shell";

export default function NotFound() {
  return (
    <Shell withNav={false}>
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl font-extrabold text-brand-navy">404</p>
        <p className="text-sm text-muted mt-2">Halaman atau unit tidak ditemukan — mungkin sudah terjual.</p>
        <Link href="/katalog" className="btn-primary mt-6">Lihat katalog</Link>
      </div>
    </Shell>
  );
}

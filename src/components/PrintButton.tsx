"use client";
export function PrintButton({ label = "Cetak / simpan PDF" }: { label?: string }) {
  return <button onClick={() => window.print()} className="btn-primary h-10 px-4 text-xs">{label}</button>;
}

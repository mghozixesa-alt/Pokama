"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icons";

/** Kompres gambar di browser ke maks 1600px, JPEG 0.85. */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

export function PhotoUploader({ initial, name = "photos" }: { initial: string[]; name?: string }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const added: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const blob = await compress(f);
        const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("units").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error) throw error;
        const { data } = supabase.storage.from("units").getPublicUrl(path);
        added.push(data.publicUrl);
      } catch (e) {
        setErr((e as Error).message);
      }
    }
    setUrls((u) => [...u, ...added]);
    setBusy(false);
  }

  const move = (i: number, d: -1 | 1) => setUrls((u) => { const n = [...u]; const j = i + d; if (j < 0 || j >= n.length) return u; [n[i], n[j]] = [n[j], n[i]]; return n; });

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={urls.join("\n")} />
      <div className="flex gap-2 flex-wrap">
        {urls.map((u, i) => (
          <div key={u} className="relative w-20 h-20 rounded-xl overflow-hidden border border-line bg-white group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="w-full h-full object-contain" />
            {i === 0 && <span className="absolute top-1 left-1 px-1 rounded bg-brand text-white text-[8px] font-extrabold">UTAMA</span>}
            <div className="absolute bottom-0 inset-x-0 flex justify-between bg-white/90 text-[10px]">
              <button type="button" onClick={() => move(i, -1)} className="px-1.5 py-0.5 font-bold" aria-label="Geser kiri">‹</button>
              <button type="button" onClick={() => setUrls((x) => x.filter((_, k) => k !== i))} className="px-1.5 py-0.5 font-bold text-[#a12d2d]" aria-label="Hapus">×</button>
              <button type="button" onClick={() => move(i, 1)} className="px-1.5 py-0.5 font-bold" aria-label="Geser kanan">›</button>
            </div>
          </div>
        ))}
        <label className="w-20 h-20 rounded-xl border-2 border-dashed border-line bg-white flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-brand cursor-pointer">
          <Icon.Upload size={18} />{busy ? "Mengunggah…" : "Tambah"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        </label>
      </div>
      <p className="text-[11px] text-muted">Foto pertama jadi foto utama. Dikompres otomatis ke 1600px. Foto latar putih/polos paling bagus untuk kartu produk.</p>
      {err && <p className="text-xs text-[#c0392b]">{err}</p>}
    </div>
  );
}

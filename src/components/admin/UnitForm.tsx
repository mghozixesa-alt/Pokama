import type { Unit } from "@/lib/types";
import { upsertUnit } from "@/app/admin/actions";
import { PhotoUploader } from "./PhotoUploader";

type Ownership = { owner_type: string; owner_id: string | null; cost_basis: number; share_owner_pct: number; share_niagaaja_pct: number } | null;
type Owner = { id: string; name: string; type: string };

const CATS = ["hp", "laptop", "kamera", "tablet", "konsol", "audio", "smartwatch", "drone", "aksesori"];
const SOURCES = ["beli_pelanggan", "tukar_tambah", "investor", "titipan", "eks_sewa_rentalaja"];
const STATUSES = ["masuk", "qc", "tersedia", "dipesan", "terjual", "dititip_rentalaja", "ditarik", "afkir"];
const SPECS: [string, string][] = [["storage", "Penyimpanan"], ["battery_health", "Baterai % (angka)"], ["color", "Warna"], ["kelengkapan", "Kelengkapan"], ["cpu", "Prosesor"], ["ram", "RAM"], ["layar", "Layar"], ["shutter_count", "Shutter count"], ["megapixel", "Megapixel"], ["lensa", "Lensa"], ["stik", "Jumlah stik"]];

export function UnitForm({ unit, ownership, owners }: { unit?: Unit; ownership?: Ownership; owners: Owner[] }) {
  const s = unit?.specs ?? {};
  return (
    <form action={upsertUnit} className="grid lg:grid-cols-2 gap-4">
      {unit && <input type="hidden" name="id" value={unit.id} />}
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-brand-navy">Identitas unit</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Kategori</label><select name="category" defaultValue={unit?.category ?? "hp"} className="input">{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label">Cabang</label><select name="branch" defaultValue={unit?.branch ?? "garut_kota"} className="input"><option value="garut_kota">Garut Kota</option><option value="wanaraja">Wanaraja</option><option value="bandung">Bandung</option></select></div>
          <div><label className="label">Merek</label><input name="brand" required defaultValue={unit?.brand} className="input" /></div>
          <div><label className="label">Model</label><input name="model" required defaultValue={unit?.model} className="input" /></div>
        </div>
        <div><label className="label">Varian (mis. 128 GB Midnight · fullset)</label><input name="variant" defaultValue={unit?.variant ?? ""} className="input" /></div>
        <div><label className="label">Catatan kondisi (tampil ke pembeli)</label><textarea name="condition_note" rows={2} defaultValue={unit?.condition_note ?? ""} className="input h-auto py-3" /></div>
        <div><label className="label">Foto unit</label><PhotoUploader initial={unit?.photos ?? []} /></div>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-brand-navy">Harga & status</h3>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Harga baru</label><input name="price_new" inputMode="numeric" defaultValue={unit?.price_new ?? ""} className="input" /></div>
          <div><label className="label">Harga jual</label><input name="price_sell" required inputMode="numeric" defaultValue={unit?.price_sell ?? ""} className="input" /></div>
          <div><label className="label">Batas bawah tawar</label><input name="price_floor" inputMode="numeric" defaultValue={unit?.price_floor ?? ""} className="input" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Sumber unit</label><select name="source" defaultValue={unit?.source ?? "beli_pelanggan"} className="input">{SOURCES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label">ID aset Rentalaja (jika eks-sewa / titip)</label><input name="rentalaja_asset_id" defaultValue={unit?.rentalaja_asset_id ?? ""} placeholder="RA-…" className="input" /></div>
          <div><label className="label">Status</label><select name="status" defaultValue={unit?.status ?? "masuk"} className="input">{STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label">Label sorotan</label><div className="flex gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_hot" defaultChecked={unit?.is_hot} className="accent-brand" />Tampil</label><input name="hot_label" defaultValue={unit?.hot_label ?? ""} placeholder="BARU / STOK 1" className="input" /></div></div>
        </div>
        <p className="text-[11px] text-muted">Grade diisi otomatis dari sertifikat cek. Status berubah ke <i>tersedia</i> saat sertifikat dibuat.</p>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-brand-navy">Kepemilikan & bagi hasil</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Jenis pemilik</label><select name="owner_type" defaultValue={ownership?.owner_type ?? "sendiri"} className="input"><option value="sendiri">Sendiri (Niagaaja)</option><option value="investor">Investor</option><option value="titipan">Titipan</option></select></div>
          <div><label className="label">Pemilik</label><select name="owner_id" defaultValue={ownership?.owner_id ?? ""} className="input"><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.type})</option>)}</select></div>
          <div><label className="label">Modal / harga minta pemilik</label><input name="cost_basis" inputMode="numeric" defaultValue={ownership?.cost_basis ?? ""} className="input" /></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label">% pemilik</label><input name="share_owner_pct" inputMode="numeric" defaultValue={ownership?.share_owner_pct ?? ""} className="input" /></div><div><label className="label">% Niagaaja</label><input name="share_niagaaja_pct" inputMode="numeric" defaultValue={ownership?.share_niagaaja_pct ?? ""} className="input" /></div></div>
        </div>
        <p className="text-[11px] text-muted">Bagi hasil dihitung atas margin (harga jual − modal). Default titipan 70/30, investor sesuai perjanjian.</p>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-brand-navy">Spesifikasi</h3>
        <div className="grid grid-cols-2 gap-3">{SPECS.map(([k, l]) => <div key={k}><label className="label">{l}</label><input name={`spec_${k}`} defaultValue={s[k] != null ? String(s[k]) : ""} className="input" /></div>)}</div>
      </section>

      <div className="lg:col-span-2"><button className="btn-primary">{unit ? "Simpan perubahan" : "Simpan unit"}</button></div>
    </form>
  );
}

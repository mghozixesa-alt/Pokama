export type Category = "hp" | "laptop" | "kamera" | "tablet" | "konsol" | "audio" | "smartwatch" | "drone" | "aksesori";
export type Grade = "A" | "B" | "C";
export type UnitSource = "beli_pelanggan" | "tukar_tambah" | "investor" | "titipan" | "eks_sewa_rentalaja";
export type UnitStatus = "masuk" | "qc" | "tersedia" | "dipesan" | "terjual" | "dititip_rentalaja" | "ditarik" | "afkir";
export type Branch = "garut_kota" | "wanaraja" | "bandung";
export type OrderStatus = "menunggu_bayar" | "menunggu_konfirmasi" | "dibayar" | "disiapkan" | "dikirim" | "selesai" | "dibatalkan" | "retur";

export interface Unit {
  id: string;
  public_id: string;
  category: Category;
  brand: string;
  model: string;
  variant: string | null;
  specs: Record<string, string | number | null>;
  condition_note: string | null;
  grade: Grade | null;
  price_new: number | null;
  price_sell: number;
  price_floor: number | null;
  source: UnitSource;
  rentalaja_asset_id: string | null;
  status: UnitStatus;
  branch: Branch;
  photos: string[];
  is_hot: boolean;
  hot_label: string | null;
  created_at: string;
}

export interface ChecklistItem {
  step: number;
  label: string;
  status: "lolos" | "minus" | "gagal";
  note?: string;
  photo?: string;
}

export interface Inspection {
  id: string;
  unit_id: string;
  checklist: ChecklistItem[];
  result_grade: Grade;
  certificate_no: string;
  qr_token: string;
  disclosed_source: boolean;
  inspected_at: string;
}

export interface Order {
  id: string;
  public_id: string;
  unit_id: string;
  customer_id: string;
  amount: number;
  unique_code: number;
  points_used: number;
  points_earned: number;
  fulfillment: "ambil_di_toko" | "kirim";
  shipping_address: string | null;
  status: OrderStatus;
  hold_until: string;
  warranty_until: string | null;
  created_at: string;
  units?: Unit;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  order_id: string;
  method: "transfer" | "tunai";
  amount: number;
  proof_url: string | null;
  bank_name: string | null;
  sender_name: string | null;
  paid_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "admin" | "qc" | "cs" | "investor" | null;
  points_balance: number;
}

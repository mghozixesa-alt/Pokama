-- Seed Fase 1: 6 unit contoh (foto placeholder dari bucket units)
insert into units (category, brand, model, variant, specs, condition_note, price_new, price_sell, price_floor, source, status, branch, photos, is_hot, hot_label) values
('hp','Apple','iPhone 13','128 GB Midnight','{"storage":"128 GB","battery_health":91,"color":"Midnight","kelengkapan":"fullset"}','Mulus, tidak ada goresan layar', 12900000, 7200000, 6500000,'beli_pelanggan','qc','garut_kota','{}', true, 'BARU'),
('konsol','Sony','PlayStation 5 Slim','1 TB Disc','{"storage":"1 TB","stik":2,"kelengkapan":"fullset"}','2 stik DualSense, dus ada', 8200000, 5900000, 5400000,'investor','qc','garut_kota','{}', true, 'STOK 1'),
('laptop','Lenovo','ThinkPad T480','i5-8350U · 8 GB · SSD 256 GB','{"cpu":"i5-8350U","ram":"8 GB","storage":"SSD 256 GB","layar":"14 inci","battery_health":84}','Bekas kantor, keyboard mulus', 9500000, 4250000, 3900000,'eks_sewa_rentalaja','qc','garut_kota','{}', false, null),
('kamera','Sony','Alpha A6000','Body + lensa kit 16-50 mm','{"shutter_count":12000,"megapixel":24,"lensa":"16-50 mm"}','Lensa bersih, sensor bebas debu', 9000000, 5400000, 4900000,'titipan','qc','garut_kota','{}', false, null),
('laptop','Lenovo','ThinkPad T480','i5-8250U · 16 GB · SSD 512 GB','{"cpu":"i5-8250U","ram":"16 GB","storage":"SSD 512 GB","layar":"14 inci","battery_health":78}','Ada bekas pakai di palm rest', 9500000, 4600000, 4200000,'beli_pelanggan','qc','bandung','{}', false, null),
('hp','Apple','iPhone 13','256 GB Blue','{"storage":"256 GB","battery_health":87,"color":"Blue","kelengkapan":"fullset"}','Ex-inter, Face ID normal', 14500000, 7900000, 7200000,'tukar_tambah','qc','wanaraja','{}', false, null);

insert into ownerships (unit_id, owner_type, cost_basis, share_owner_pct, share_niagaaja_pct)
select id, case source when 'investor' then 'investor'::owner_type when 'titipan' then 'titipan'::owner_type else 'sendiri'::owner_type end,
  (price_sell * 0.8)::int, case source when 'investor' then 60 when 'titipan' then 70 else 0 end, case source when 'investor' then 40 when 'titipan' then 30 else 100 end
from units;

-- Sertifikat cek 8 langkah: unit 1,2,3,5 grade A/B sesuai desain
insert into inspections (unit_id, checklist, result_grade, certificate_no, disclosed_source)
select u.id,
  '[{"step":1,"label":"Fisik & bodi","status":"lolos"},{"step":2,"label":"Layar & touch","status":"lolos"},{"step":3,"label":"Baterai","status":"lolos"},{"step":4,"label":"Kamera & audio","status":"lolos"},{"step":5,"label":"Konektivitas","status":"lolos"},{"step":6,"label":"Tombol & port","status":"lolos"},{"step":7,"label":"Akun & IMEI/serial","status":"lolos"},{"step":8,"label":"Kelengkapan","status":"lolos"}]'::jsonb,
  case when u.variant like '%256 GB%' or u.category = 'kamera' or u.variant like '%16 GB%' then 'B'::unit_grade else 'A'::unit_grade end,
  'NJC-' || to_char(now(), 'YYMM') || '-' || lpad(row_number() over ()::text, 4, '0'),
  true
from units u;

-- Foto contoh (Unsplash, hotlink) — ganti dengan foto unit asli di bucket `units`
update units set photos = '{https://images.unsplash.com/photo-1570642193983-c5c23fc09eba?auto=format&fit=crop&w=900&q=80}' where public_id = 'NJ-0001';
update units set photos = '{https://images.unsplash.com/photo-1570642193983-c5c23fc09eba?auto=format&fit=crop&w=900&q=80}' where public_id = 'NJ-0006';
update units set photos = '{https://images.unsplash.com/photo-1632803227975-b6a5688c9c46?auto=format&fit=crop&w=900&q=80}' where public_id = 'NJ-0002';
update units set photos = '{https://images.unsplash.com/photo-1696330743697-7f40d6839fdc?auto=format&fit=crop&w=900&q=80}' where public_id = 'NJ-0003';
update units set photos = '{https://images.unsplash.com/photo-1696330743697-7f40d6839fdc?auto=format&fit=crop&w=900&q=80}' where public_id = 'NJ-0005';
update units set photos = '{https://images.unsplash.com/photo-1614292306505-a52af90aff38?auto=format&fit=crop&w=900&q=80}' where public_id = 'NJ-0004';

-- Identitas toko untuk nota (ubah sesuai alamat asli)
insert into settings(key, value) values ('store', '{"name":"Niagaaja — PT Popo Karya Investama","address":"Garut Kota, Jawa Barat","phone":"0853-1132-4738"}'::jsonb)
on conflict (key) do nothing;

# Generator SQL bank soal rekrutmen -> 051_rekrutmen_soal.sql
import json, random
random.seed(7)

disc = [
 ("Saya cepat mengambil keputusan, walau informasinya belum lengkap.", "Saya senang mengobrol dan mudah akrab dengan orang baru.", "Saya sabar dan nyaman dengan pekerjaan yang rutin dan stabil.", "Saya teliti dan selalu memeriksa ulang sebelum menyerahkan pekerjaan."),
 ("Saya suka target yang menantang.", "Saya suka suasana kerja yang ramai dan seru.", "Saya suka suasana kerja yang tenang dan akur.", "Saya suka aturan kerja yang jelas dan tertulis."),
 ("Saya berani menegur orang yang salah.", "Saya pandai membuat orang lain semangat.", "Saya pendengar yang baik.", "Saya mengikuti prosedur dengan rapi."),
 ("Kalau ada masalah, saya langsung ambil tindakan.", "Kalau ada masalah, saya ajak orang lain berdiskusi.", "Kalau ada masalah, saya tetap tenang dan tidak terburu-buru.", "Kalau ada masalah, saya cari dulu penyebabnya dengan data."),
 ("Orang bilang saya tegas.", "Orang bilang saya ceria.", "Orang bilang saya bisa diandalkan.", "Orang bilang saya rapi."),
 ("Saya ingin hasil yang cepat.", "Saya ingin pekerjaan yang menyenangkan.", "Saya ingin pekerjaan yang aman dan pasti.", "Saya ingin pekerjaan yang benar dan tanpa kesalahan."),
 ("Saya suka memimpin kelompok.", "Saya suka tampil di depan orang banyak.", "Saya suka membantu teman yang kesulitan.", "Saya suka menyusun rencana yang detail."),
 ("Saya tidak takut mengambil risiko.", "Saya mudah meyakinkan orang lain.", "Saya setia pada tim dan atasan.", "Saya berhati-hati sebelum bertindak."),
 ("Saya lebih suka bekerja dengan cara saya sendiri.", "Saya lebih suka bekerja bersama banyak orang.", "Saya lebih suka bekerja dengan tim yang sudah saya kenal.", "Saya lebih suka bekerja dengan petunjuk yang lengkap."),
 ("Saya kesal kalau pekerjaan lambat.", "Saya kesal kalau suasana kerja kaku.", "Saya kesal kalau ada perubahan mendadak.", "Saya kesal kalau pekerjaan asal-asalan."),
 ("Saya senang bersaing untuk menjadi yang terbaik.", "Saya senang dipuji di depan orang lain.", "Saya senang kalau semua orang rukun.", "Saya senang kalau semua catatan lengkap dan cocok."),
 ("Saya bicara langsung ke inti.", "Saya bicara dengan semangat dan banyak cerita.", "Saya bicara dengan lembut dan sopan.", "Saya bicara dengan hati-hati dan tepat."),
 ("Saya mau mencoba cara baru meski belum pasti berhasil.", "Saya mudah punya ide-ide baru.", "Saya lebih suka cara yang sudah terbukti.", "Saya suka membandingkan pilihan sebelum memutuskan."),
 ("Saya mengejar target sampai tercapai.", "Saya membuat pelanggan merasa senang.", "Saya melayani pelanggan dengan sabar walau rewel.", "Saya memastikan pesanan pelanggan sesuai dan lengkap."),
 ("Saya percaya diri.", "Saya optimis.", "Saya rendah hati.", "Saya teratur."),
 ("Saya cepat bosan dengan pekerjaan yang sama.", "Saya cepat bosan kalau kerja sendirian.", "Saya betah mengerjakan hal yang sama setiap hari.", "Saya betah mengerjakan hal yang butuh ketelitian."),
 ("Saat ditekan, saya makin bersemangat menyelesaikan.", "Saat ditekan, saya mencari dukungan teman.", "Saat ditekan, saya diam dan tetap bekerja.", "Saat ditekan, saya fokus agar tidak ada yang salah."),
 ("Saya suka mengatur orang agar pekerjaan beres.", "Saya suka menghibur orang di sekitar saya.", "Saya suka menjaga perasaan orang lain.", "Saya suka menjaga kualitas pekerjaan."),
 ("Saya tidak suka basa-basi.", "Saya suka bercanda saat bekerja.", "Saya tidak suka konflik.", "Saya tidak suka ketidakjelasan."),
 ("Saya bertanggung jawab atas hasil akhir.", "Saya bertanggung jawab menjaga semangat tim.", "Saya bertanggung jawab menyelesaikan tugas sampai tuntas.", "Saya bertanggung jawab memastikan semuanya sesuai aturan."),
 ("Saya mandiri.", "Saya ramah.", "Saya tenang.", "Saya cermat."),
 ("Saya senang diberi wewenang.", "Saya senang diberi kesempatan berinteraksi dengan banyak orang.", "Saya senang diberi tugas yang jelas dan tetap.", "Saya senang diberi waktu untuk mengerjakan dengan benar."),
 ("Saya berani mengambil alih saat tim bingung.", "Saya mencairkan suasana saat tim tegang.", "Saya menengahi saat tim berselisih.", "Saya merapikan rencana saat tim berantakan."),
 ("Saya ingin dihargai karena hasil.", "Saya ingin dihargai karena keakraban.", "Saya ingin dihargai karena kesetiaan.", "Saya ingin dihargai karena ketepatan."),
]
assert len(disc) == 24

# (prompt, [opsi], indeks benar)
umum = [
 ("Pelanggan menyewa 3 hari dengan harga Rp75.000 per hari. Berapa totalnya?", ["Rp200.000", "Rp225.000", "Rp250.000", "Rp175.000"], 1),
 ("Uang yang diterima Rp100.000, total belanja Rp68.000. Berapa kembaliannya?", ["Rp32.000", "Rp42.000", "Rp38.000", "Rp22.000"], 0),
 ("Diskon 10% dari Rp250.000 adalah …", ["Rp10.000", "Rp20.000", "Rp25.000", "Rp35.000"], 2),
 ("Jam masuk 08.00. Anda tiba 08.25. Berapa menit Anda terlambat?", ["15 menit", "20 menit", "25 menit", "35 menit"], 2),
 ("Sewa mulai Senin pukul 10.00, berakhir Rabu pukul 10.00. Berapa hari sewanya?", ["1 hari", "2 hari", "3 hari", "4 hari"], 1),
 ("Lanjutkan pola: 2, 4, 8, 16, …", ["18", "24", "32", "20"], 2),
 ("Dari 40 unit motor, 25% sedang disewa. Berapa unit yang disewa?", ["8", "10", "12", "15"], 1),
 ("Atasan meminta laporan hari ini, tetapi Anda belum selesai. Yang paling tepat dilakukan adalah …", ["Diam saja dan kirim besok", "Kabari atasan lebih awal, jelaskan sisa pekerjaan dan perkiraan selesai", "Kirim laporan seadanya tanpa memberi tahu", "Minta teman mengerjakan diam-diam"], 1),
 ("Anda menemukan dompet pelanggan tertinggal di unit. Yang Anda lakukan …", ["Simpan sampai pelanggan menanyakan", "Serahkan ke atasan/admin, catat, lalu hubungi pelanggan lewat nomor resmi", "Biarkan di unit", "Buka isinya untuk mencari alamat lalu antar sendiri"], 1),
 ("Kata yang paling dekat artinya dengan \"teliti\" adalah …", ["Cepat", "Cermat", "Ceroboh", "Ramah"], 1),
 ("Jika semua runner wajib cek kondisi unit sebelum antar, dan Budi adalah runner, maka …", ["Budi boleh tidak cek unit", "Budi wajib cek kondisi unit sebelum antar", "Hanya runner baru yang wajib cek", "Tidak bisa disimpulkan"], 1),
 ("Rekan kerja mengajak Anda mencatat jam kerja lebih lama dari yang sebenarnya. Sikap Anda …", ["Ikut saja, toh semua begitu", "Menolak dan tetap mencatat jam yang sebenarnya", "Ikut sekali saja", "Pura-pura tidak dengar"], 1),
]
layanan = [
 ("Pelanggan marah karena unit datang terlambat 30 menit. Respons pertama yang paling tepat …", ["Menjelaskan panjang lebar bahwa jalan macet", "Minta maaf dengan tulus, akui keterlambatan, lalu fokus menyelesaikan", "Diam sampai pelanggan tenang sendiri", "Mengatakan itu bukan salah Anda"], 1),
 ("Pelanggan bertanya hal yang Anda tidak tahu jawabannya. Anda …", ["Menjawab kira-kira saja", "Bilang tidak tahu lalu selesai", "Bilang akan dicek dulu, tanyakan ke admin, lalu kabari secepatnya", "Mengalihkan pembicaraan"], 2),
 ("Saat serah terima unit ke pelanggan, yang wajib dilakukan adalah …", ["Langsung pergi agar cepat", "Cek kondisi bersama pelanggan, foto unit, dan pastikan dokumen ditandatangani", "Hanya menyerahkan kunci", "Meminta pelanggan mengecek sendiri nanti"], 1),
 ("Pelanggan meminta diskon di luar promo resmi. Anda …", ["Langsung memberi diskon agar pelanggan senang", "Menolak dengan sopan dan menawarkan promo resmi yang berlaku", "Memberi diskon dari uang sendiri", "Mengabaikan permintaan"], 1),
 ("Cara menyapa pelanggan lewat WhatsApp yang paling tepat …", ["\"Ya?\"", "\"Halo Kak, terima kasih sudah menghubungi kami. Ada yang bisa kami bantu?\"", "\"Mau apa?\"", "Langsung kirim daftar harga tanpa salam"], 1),
 ("Unit yang akan diantar ternyata ban bocor. Yang paling tepat …", ["Tetap antar, nanti pelanggan yang tambal", "Kabari admin segera, minta unit pengganti atau perbaikan, dan informasikan pelanggan jika ada perubahan waktu", "Batalkan pesanan tanpa kabar", "Tunggu sampai pelanggan menelepon"], 1),
 ("Pelanggan memberi tip besar dan minta Anda tidak mencatat kerusakan kecil. Anda …", ["Terima tip dan tidak mencatat", "Tetap mencatat kerusakan sesuai kondisi dengan sopan", "Mencatat sebagian saja", "Menolak tip lalu tidak mencatat"], 1),
 ("Setelah masalah pelanggan selesai, langkah yang baik adalah …", ["Tidak perlu apa-apa lagi", "Memastikan pelanggan puas dan mencatat kejadian agar tidak terulang", "Menceritakan pelanggan ke teman-teman", "Menghapus percakapan"], 1),
]
kas = [
 ("Saldo awal laci Rp500.000. Masuk tunai Rp1.250.000, refund tunai Rp100.000. Saldo akhir seharusnya …", ["Rp1.650.000", "Rp1.750.000", "Rp1.850.000", "Rp1.550.000"], 0),
 ("Saat tutup kasir, uang fisik kurang Rp20.000 dari catatan. Yang paling tepat …", ["Tambal dari uang pribadi diam-diam", "Catat selisihnya apa adanya dan laporkan ke atasan", "Ubah catatan supaya cocok", "Biarkan saja"], 1),
 ("Pelanggan membayar transfer. Kapan pesanan boleh ditandai lunas?", ["Saat pelanggan bilang sudah transfer", "Setelah dana benar-benar masuk dan terverifikasi di sistem/rekening", "Saat pelanggan kirim foto bukti", "Besok pagi"], 1),
 ("Uang muka (DP) Rp150.000 dari total Rp450.000. Sisa pelunasan …", ["Rp250.000", "Rp300.000", "Rp350.000", "Rp150.000"], 1),
 ("Pelanggan bayar Rp200.000 untuk tagihan Rp185.000. Kembalian …", ["Rp5.000", "Rp15.000", "Rp25.000", "Rp10.000"], 1),
 ("Teman kasir minta meminjam uang laci sebentar. Anda …", ["Boleh asal dikembalikan hari ini", "Menolak, uang laci hanya untuk transaksi resmi", "Boleh jika jumlahnya kecil", "Boleh jika dicatat di kertas"], 1),
 ("Pembayaran yang sama tercatat dua kali di sistem. Yang dilakukan …", ["Biarkan, nanti dicek bagian keuangan", "Laporkan segera ke atasan/keuangan dengan kode pesanannya", "Hapus salah satu sendiri tanpa memberi tahu", "Kembalikan uang tunai ke pelanggan tanpa catatan"], 1),
 ("Bukti transaksi yang baik minimal memuat …", ["Nama pelanggan saja", "Tanggal, kode pesanan, jumlah, metode bayar, dan nama petugas", "Jumlah saja", "Tanda tangan pelanggan saja"], 1),
]

def q(s): return "'" + s.replace("'", "''") + "'"
out = ["-- 051: bank soal rekrutmen (dibuat oleh 051_rekrutmen_soal.py)",
"insert into public.pk_rec_tests(code,name,kind,minutes,intro,sort) values",
"('disc','Gaya kerja (DISC)','disc',12,'Setiap soal berisi 4 pernyataan. Pilih satu yang paling mirip dan satu yang paling tidak mirip dengan Anda di tempat kerja. Tidak ada jawaban benar atau salah.',1),",
"('umum','Tes umum (hitung & logika)','mc',15,'Pilih satu jawaban yang paling tepat. Boleh memakai kalkulator di HP, tetapi jangan pindah aplikasi terlalu lama.',2),",
"('layanan','Tes pelayanan pelanggan','mc',10,'Pilih tindakan yang paling tepat menurut Anda.',3),",
"('kas','Tes kasir & administrasi','mc',10,'Pilih jawaban yang paling tepat.',4)",
"on conflict (code) do update set name=excluded.name, kind=excluded.kind, minutes=excluded.minutes, intro=excluded.intro, sort=excluded.sort;",
"insert into public.pk_rec_questions(test_code,n,prompt,options,answer) values"]
rows = []
for i, g in enumerate(disc, 1):
    opts = [{"t": t, "d": d} for t, d in zip(g, "DISC")]
    random.shuffle(opts)
    rows.append(f"('disc',{i},{q('Kelompok ' + str(i))},{q(json.dumps(opts, ensure_ascii=False))}::jsonb,null)")
for code, bank in (("umum", umum), ("layanan", layanan), ("kas", kas)):
    for i, (p, opts, a) in enumerate(bank, 1):
        idx = list(range(len(opts))); random.shuffle(idx)
        new = [opts[j] for j in idx]
        rows.append(f"('{code}',{i},{q(p)},{q(json.dumps([{'t': o} for o in new], ensure_ascii=False))}::jsonb,{idx.index(a)})")
out.append(",\n".join(rows) + "\non conflict (test_code,n) do update set prompt=excluded.prompt, options=excluded.options, answer=excluded.answer;")
open("051_rekrutmen_soal.sql", "w").write("\n".join(out) + "\n")
print(len(rows), "soal")

# Sistem Kerja Pokama

Sistem kerja internal management PT Popo Karya Investama: KKH harian, penugasan, review & revisi, permintaan antarunit, kehadiran & cuti, target & omzet, Liga 3 unit bisnis (Rentalaja, TripinAja, Niagaaja), performa & insentif, dan Library Dokumen.

## Isi repo

- `demo/` — prototipe yang bisa diklik (HTML statis, tanpa database). Dideploy ke Vercel proyek **pokama** → demo.pokama.org. Semua data contoh dan tidak tersimpan.
- `design/` — file sumber rancangan per layar (`*.dc.html`) dan `canvas.json` dari kanvas desain. Dipakai sebagai acuan saat membangun aplikasi asli.
- `tools/build_demo.py` — membangun ulang `demo/` dari `design/` (`python3 tools/build_demo.py`).

## Acuan membangun

- PRD per flow: https://claude.ai/artifact/L2idjzZzqYG7jt8KMSoJUM
- Aturan Main Sistem Kerja: https://claude.ai/artifact/FFZxUJMpCWSsGrxjQybrf4
- Kanvas desain: https://claude.ai/artifact/DLcZe37XpMrYqTjz4brsot

Aplikasi asli (database, login Google, notifikasi) dibangun terpisah di repo ini, misalnya di folder `app/`.

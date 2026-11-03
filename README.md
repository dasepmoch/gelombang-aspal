# Gelombang Aspal — 60 detik, 1080×1920, dirender di GitHub Actions

Video pendek vertikal yang menjelaskan **kenapa aspal di depan lampu merah selalu bergelombang**.
Semuanya dirender dari kode: **three.js di headless Chrome**, lalu di-encode dengan ffmpeg.
Tidak ada AI video generator, tidak ada stock footage, tidak ada After Effects.

Durasi 60 detik · 24 fps · 1440 frame · 1080×1920 · H.264 + AAC

## Kenapa repo ini ada

Satu video = satu scene yang deterministik. Ubah satu angka, render ulang, hasilnya sama
persis. Itu yang tidak bisa diberikan generator video.

Render 1440 frame di satu mesin butuh ~25 menit. Di sini pekerjaan itu **dipecah ke 20 job
paralel** (batas konkurensi repo publik di GitHub-hosted runner), jadi selesai dalam hitungan menit
dan gratis, karena Actions untuk repo publik tidak dihitung menitnya.

## Struktur

```
scene/index.html        dunia 3D + karakter 2D + naskah + kamera (satu file, deterministik)
render/render.mjs       driver Puppeteer: render --start..--end, tulis JPEG
audio/mix.json          cue voice over (10 baris) + durasi
audio/mix.mjs           campur VO dengan adelay/amix/loudnorm → audio.wav 60,000 s
audio/vo_*.mp3          voice over Bahasa Indonesia (edge-tts, id-ID-ArdiNeural)
.github/workflows/render.yml   20 shard render + 1 job assemble
```

## Jalan lokal

```bash
npm ci
npx puppeteer browsers install chrome      # atau set CHROME_PATH ke Chrome yang ada
node render/render.mjs --probe 2,20,40     # cek beberapa frame
node render/render.mjs --start 0 --end 1439 --out out/frames
node audio/mix.mjs
ffmpeg -framerate 24 -i out/frames/f_%05d.jpg -i audio.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -shortest -movflags +faststart out/video.mp4
```

Push ke `main` (atau jalankan workflow manual) → artifact `video` berisi MP4 final.

## Cara kerjanya

- **Frame sebagai fungsi waktu.** `setState(t)` menempatkan kamera, kendaraan, dan deformasi
  aspal; `renderAt(t)` mengembalikan satu JPEG. Tidak ada wall-clock, jadi 20 shard bisa
  merender rentang berbeda dan hasilnya menyambung tanpa jahitan.
- **Kamera dari angka, bukan feeling.** Setiap keyframe adalah `{t, cy, h, az, el, lz}`:
  tinggi target, tinggi frame, azimut, elevasi. Jarak dihitung `dist = (h/2)/tan(fov/2)`,
  sehingga objek tidak pernah keluar frame tanpa sengaja.
- **Deformasi aspal** adalah gelombang Gaussian yang tumbuh di depan garis berhenti, plus
  potongan melintang (dua lapisan) supaya bentuknya terbaca sebagai irisan jalan, bukan bayangan.
- **Karakter 2D** digambar di canvas (kepala kacang, outline plum) lalu ditempel sebagai billboard
  yang selalu menghadap kamera.

## Catatan

- Angka dan mekanisme di video ini adalah fisika jalan yang umum (rutting/shoving di zona
  pengereman, binder yang melunak saat panas, solusi campuran lebih kaku atau memindah titik
  henti). Tidak ada statistik yang dikarang.
- Naskah, karakter, dan suara milik repo ini sendiri. Pendekatan "2D character in a 3D world"
  terinspirasi dari skill `cartoon-3d-short`, tapi tidak ada aset atau naskah yang disalin.
- Lisensi kode: MIT.

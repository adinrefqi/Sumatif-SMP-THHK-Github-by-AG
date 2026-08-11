# Product Requirement Document (PRD)
## Aplikasi Exambrowser Android & Webview Ujian Sumatif SMP THHK

---

## 1. Pendahuluan & Ringkasan Eksekutif

Aplikasi **Exambrowser Ujian Sumatif SMP THHK** dirancang untuk memodernisasi pelaksanaan Ujian Sumatif berbasis komputer di SMP THHK dengan mengadopsi prinsip dan standar sistem **ANBK (Asesmen Nasional Berbasis Komputer)** yang diselenggarakan oleh Pusmendik Kemendikdasmen.

Sistem ini menerapkan **Metode Hibrida**:
- **Naskah Soal Ujian:** Ditampilkan secara digital berupa dokumen PDF melalui layar HP/Tablet masing-masing siswa.
- **Pengisian Jawaban:** Siswa menjawab secara fisik pada **Lembar Jawab Kertas (LJK)** yang telah disediakan sekolah.
- **Proteksi Anti-Kecurangan:** Menggunakan **Android Native Kiosk Exambrowser (Android 14+)** dengan 30 fitur penguncian perangkat ketat untuk mencegah kecurangan selama ujian.

---

## 2. Tujuan & Sasaran Utama

1. **Efisiensi Pengadaan Ujian:** Mengurangi pencetakan naskah soal fisik bertaraf besar dengan menggantikannya menggunakan penampil PDF digital yang aman.
2. **Standardisasi ANBK Pusmendik:** Mengadopsi mekanisme **Token Rilis Otomatis 15-Menit** dan pengawasan real-time khas ANBK.
3. **Keamanan Perangkat Tinggi:** Menjamin naskah soal PDF tidak dapat di-screenshot, di-record, di-download, atau dibagikan, serta siswa tidak dapat berpindah aplikasi saat ujian.
4. **Reliabilitas Sinyal (Offline Resilience):** Aplikasi tetap dapat menampilkan naskah soal yang sudah dimuat meskipun terjadi guncangan koneksi internet/WiFi di ruang ujian.

---

## 3. Profil Pengguna (User Personas)

### A. Siswa (Examinee)
- Menggunakan HP/Tablet Android pribadi/sekolah.
- Menginput Token 6-karakter untuk memuat soal PDF.
- Membaca soal di layar sentuh HP (Zoom, Bookmark Halaman Bacaan, Mode Ramah Mata).
- Menjawab pada Lembar Jawab Kertas (LJK).

### B. Proktor / Pengawas Ruangan
- Memasukkan PIN Ruang (`12345`) & Wajib Mengisi Form Berita Acara Ujian saat awal login.
- Memantau & merilis Token 15-menit (jika telah dibuka oleh Super Admin).
- Memantau presensi real-time dan melihat rekap Tanda Tangan Digital siswa.
- Melakukan *Emergency Session Reset* jika HP siswa bermasalah.

### C. Super Admin (Panitia Ujian)
- Memasukkan PIN Super Admin (`THHK2026`).
- Mengunggah file PDF naskah soal lokal atau menginput Link Google Drive PDF.
- Mengontrol Master Switch "Buka/Kunci Akses Rilis Token" untuk Proktor Ruangan.

---

## 4. Spesifikasi & Fitur Utama

### A. Fitur Keamanan Android Native Exambrowser (30 Fitur Kunci)
1. **Kiosk LockTask Mode:** Mengunci tombol fisik/navigasi HOME, RECENT, dan BACK.
2. **Hide System Bars & Status Bar:** Memblokir pembukaan panel notifikasi dan kontrol status bar.
3. **FLAG_SECURE Enforcement:** Memblokir screenshot dan perekaman layar 100%.
4. **Sirine Alarm 95% Volume:** Otomatis membunyikan suara alarm peringatan keras jika siswa berupaya meminimalkan aplikasi atau pindah aplikasi lain.
5. **Anti-Floating Apps & Overlay Detector:** Mendeteksi dan memblokir aplikasi mengambang di Android (`Settings.canDrawOverlays`).
6. **Password Exit Protection:** Memerlukan password keamanan `12345` untuk keluar dari mode ujian atau mematikan aplikasi.
7. **Anti Copy-Paste & Clipboard Lock:** Menutup akses copy-paste dan clipboard sistem.
8. **Deteksi Bluetooth & Headset:** Mendeteksi status earphone/headset audio terhubung.
9. **Indikator Baterai & Jam Realtime:** Mengirim status daya baterai dan jam tersinkronisasi ke Webview.
10. **Direct Vercel WebView:** Memuat tautan Vercel terenkripsi tanpa menampilkan address bar browser.

### B. Fitur Webview & PDF Exam Engine
1. **Pinch-to-Zoom & Fast Preset Zoom:** Dukungan gestur sentuh HP serta tombol preset A- / A / A+ (100%, 125%, 150%, Fit Width).
2. **Stimulus Bookmark System:** Menyimpan pin halaman bacaan panjang (stimulus ANBK) untuk lompat halaman 1-tap.
3. **Rotasi Token 15-Menit:** Sinkronisasi real-time via Supabase Realtime dengan *grace period* 2 menit.
4. **Offline Fallback UI:** Antarmuka peringatan koneksi terputus yang menjaga naskah PDF tetap terbuka tanpa layar blank Chrome.
5. **Daftar Hadir & Tanda Tangan Digital Siswa:** Modal canvas TTD digital yang wajib diisi siswa setelah token terverifikasi.
6. **Integrasi Google Drive PDF & Master Switch Token:** Pilihan input link GDrive untuk soal PDF dan penguncian rilis token oleh Super Admin.
7. **Gate Berita Acara Proktor:** Kewajiban proktor mengisi berita acara sebelum membuka rilis token & monitoring.
8. **Super Admin PDF Readability Inspector:** Fitur uji pratinjau tampilan naskah soal PDF di layar HP siswa untuk memastikan dokumen terbaca jelas sebelum rilis token.
9. **Batch Multi-File PDF Upload & Multi-Active Exam Selection:** Fitur unggah banyak file PDF sekaligus dengan smart filename parser, manajemen bank soal master, dan aktivasi banyak naskah soal sekaligus (*Multi-Active Exams*) yang dicocokkan otomatis per tingkat kelas siswa.

---

## 5. Kebutuhan Non-Fungsional & Lingkungan

- **Target OS:** Android 14+ (SDK 34) dengan backward compatibility hingga Android 7.0 (API 24).
- **Deployment Web:** Vercel Hosting (Auto CI/CD via GitHub Repository).
- **Cloud Infrastructure:** Supabase PostgreSQL Database & Supabase Storage (Bucket PDF Soal).
- **Package Name Android:** `id.sch.smpthhk.exambrowser`.
- **Default Exit Password:** `12345`.

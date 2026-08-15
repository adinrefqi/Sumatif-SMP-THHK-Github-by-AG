# Catatan Progres Pengembangan (Progres.md)
## Aplikasi Exambrowser Android & Webview Ujian Sumatif SMP THHK

---

## Status Progres Proyek: Fitur lengkap — pengerasan keamanan berjalan (Gelombang 1 selesai di kode)

> Audit keamanan menemukan bahwa semua gerbang (PIN, token, daftar soal, presensi)
> masih diputuskan di klien. Perbaikannya dikerjakan bertahap dalam 3 fase; lihat
> `~/.claude/plans/buatkan-plannya-karena-akan-wobbly-breeze.md`.
>
> **Audit lanjutan 15 Agustus 2026 → `AUDIT-KEAMANAN.md`** (13 temuan bernomor, #1-#13).
> Gelombang 1 (#1, #2, #3, plus #8 & #13) sudah selesai di **kode** via
> `web_app/supabase/migrations/003_wave1_fixes.sql`. Yang masih menunggu tindakan
> manual di Supabase: jalankan `003` + `002_change_pins_TEMPLATE.sql` (ganti seed PIN),
> lalu verifikasi server-side. Lihat bagian "Belum terverifikasi" di AUDIT.

| Modul | Status | Keterangan |
|---|---|---|
| Perencanaan & Dokumen PRD | ✅ Selesai | `PRD.md`, `Desain.md`, `Progres.md` lengkap. |
| React + Vite Frontend App (`web_app`) | ✅ Selesai | Mobile Touch PDF Viewer, Rotasi Token 15-Menit, Supabase Client, Offline Fallback. |
| Supabase Cloud Integration | ✅ Selesai | Realtime Token & Supabase DB Ready (tanpa storage bucket). |
| Native Android Kiosk App (`android_app`) | ✅ Dihapus | Sudah `git rm -r` (riwayat tetap di git). Lihat `AUDIT-KEAMANAN.md` #13. |
| **Flutter Kiosk App (`flutter_app`)** | ⚠️ Sebagian | Flutter InAppWebView, Kiosk Mode, Alarm Audio. **Exit Password kini verifikasi via RPC `verify_exit_pin`** (#1). **`FLAG_SECURE` BELUM ADA** (lihat `AUDIT-KEAMANAN.md` #4). |
| **GitHub Actions Auto-Build APK** | ✅ Selesai | Workflow `.github/workflows/build-apk.yml` otomatis mengkompilasi file `.apk` di Cloud GitHub. |

---

## Log Aktivitas Terbaru

- **Gelombang 4 — Bersih-bersih (15 Agustus 2026):**
  - #10 hapus `SYSTEM_ALERT_WINDOW` dari manifest Flutter.
  - #11 tambah security header (`X-Frame-Options`, `Referrer-Policy`, CSP) di `vercel.json`.
  - #12 tandai selesai (pesan error roster sudah disatukan sejak `003`).

- **Gelombang 3 — Integritas Pengawasan & Durasi (15 Agustus 2026):**
  - #7 `log_violation` RPC (identitas dari server, validasi tipe, rate-limit), cabut policy insert anon, `proctor_dashboard` tambah `violation_summary` per siswa.
  - #9 `student_sessions.expires_at` ditegakkan di `open_exam` & `heartbeat`; timer web hitung dari `expires_at` (tidak bisa reset refresh).

- **Gelombang 2 — Kerahasiaan Naskah & Kiosk (15 Agustus 2026):**
  - #4 `FLAG_SECURE` terverifikasi sudah ada (`MainActivity.kt`), audit lama ketinggalan.
  - #6 WebView: allowlist `portal-sumatifthhk.vercel.app`, blokir jendela baru & popup.
  - #5 `open_exam` tidak lagi mengembalikan `pdf_url`; PDF siswa lewat Edge Function `exam-pdf` (proxy + validasi sesi/durasi). Cabang iframe Drive di `MobilePdfViewer` dihapus; pratinjau Super Admin tetap iframe langsung.

- **Gelombang 1 — Pengerasan Keamanan (15 Agustus 2026):**
  - `web_app/supabase/migrations/003_wave1_fixes.sql`: menutup #1 (verify_exit_pin + lockout), #2 (secret_code + presensi append-only + 1 sesi aktif + attendance_audit), #3 (panel_sessions token + pin_attempts rate-limit + set_room_pin ketat), #8 (heartbeat validasi nisn).
  - Web client beralih dari PIN-ke-tiap-request menjadi token sesi panel; form siswa kini wajib kode peserta 4 karakter.
  - Flutter: `exit_password_dialog.dart` verifikasi lewat RPC `verify_exit_pin`, tanpa literal PIN; `android_app/` dihapus.
  - Dokumen (AUDIT-KEAMANAN.md, Progres.md, schema.sql) diselaraskan dengan status kode.

- **Fase 0 — Emergency Lockdown (13 Agustus 2026):**
  - `web_app/supabase/migrations/000_emergency_lockdown.sql`: mencabut policy anon yang
    membocorkan `pdf_url` dan mengizinkan hapus/ubah massal roster siswa, menghapus tabel
    `student_logs` yang tidak terpakai, dan membersihkan baris heartbeat dari bank soal.
  - Menghapus semua nilai PIN/password literal dari teks UI dan dokumen proyek.
  - Keystore rilis & `key.properties` (4 file) dikeluarkan dari repo; CI kini menyuntiknya
    dari GitHub Secrets dan gagal keras kalau secret kosong (mencegah APK debug-signed).
  - **Menunggu tindakan manual:** repo dijadikan privat, SQL dijalankan di Supabase,
    keystore dirotasi + 4 GitHub Secret diisi.

  - Menambahkan konfigurasi **Signed Release APK Android**: Keystore (`upload-keystore.jks`) & `key.properties` resmi SMP THHK Tegal.
  - Menambahkan publikasi otomatis **GitHub Release v1.0.0** untuk mengunduh `.apk` resmi yang telah ditandatangani digital (*Signed Official Release*).
  - Menambahkan **Manajemen Bank Soal Master via Link Google Drive**: upload file PDF dihapus dari kode — naskah soal hanya melalui Link Google Drive.
  - Menambahkan **Arsitektur Tepat 3 Ruang Ujian (Ruang 1, Ruang 2, Ruang 3)**: Pemilihan Ruang Ujian pada login Proktor dan form presensi Siswa.
  - Menambahkan **Monitoring Terpadu 3 Ruangan** pada Super Admin Dashboard untuk memantau status Berita Acara dan kehadiran peserta di Ruang 1, 2, dan 3.
  - Menambahkan Gate Wajib Berita Acara Ujian saat Proktor pertama kali login sebelum membuka rilis token.
  - Menambahkan modal Canvas Tanda Tangan Digital Siswa setelah verifikasi token 6-karakter.
  - Menambahkan tab Rekap Presensi & Tanda Tangan Digital Siswa di Panel Proktor.
  - Build produksi terverifikasi sukses (`vite build`).
- **Implementasi Modul Flutter Exambrowser (`flutter_app/`):**
  - Membuat `pubspec.yaml` dengan dependensi `flutter_inappwebview`, `kiosk_mode`, `audioplayers`, dan `battery_plus`. (`flutter_windowmanager` **tidak** terpasang — lihat `AUDIT-KEAMANAN.md` #4.)
  - Mengimplementasikan `main.dart` dengan Fullscreen Immersive Sticky, InAppWebView Vercel, dan PopScope interceptor. (**`FLAG_SECURE` belum diimplementasikan** — screenshot & screen record masih berfungsi, `AUDIT-KEAMANAN.md` #4.)
  - Mengimplementasikan `security_service.dart` dengan Alarm Audio Sirine 95% Volume saat `AppLifecycleState.paused`.
  - Mengimplementasikan `exit_password_dialog.dart` untuk modal PIN Password pengawas.
- **Integrasi GitHub Actions CI/CD (`.github/workflows/build-apk.yml`):**
  - Membuat otomatisasi GitHub Actions yang mengkompilasi file `app-release.apk` di cloud setiap kali kode di-push ke branch `main`.

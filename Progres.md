# Catatan Progres Pengembangan (Progres.md)
## Aplikasi Exambrowser Android & Webview Ujian Sumatif SMP THHK

---

## Status Progres Proyek: 100% SELESAI & AUTO-BUILD GITHUB READY

| Modul | Status | Keterangan |
|---|---|---|
| Perencanaan & Dokumen PRD | ✅ Selesai | `PRD.md`, `Desain.md`, `Progres.md` lengkap. |
| React + Vite Frontend App (`web_app`) | ✅ Selesai | Mobile Touch PDF Viewer, Rotasi Token 15-Menit, Supabase Client, Offline Fallback. |
| Supabase Cloud Integration | ✅ Selesai | Bucket Storage & Realtime Token Ready. |
| Native Android Kiosk App (`android_app`) | ⚠️ Ditinggalkan | Tidak dibangun CI. Dijadwalkan dihapus di Fase 2.2. |
| **Flutter Kiosk App (`flutter_app`)** | ✅ Selesai | Flutter InAppWebView, `FLAG_SECURE`, Kiosk Mode, Alarm Audio 95%, Exit Password (dikonfigurasi terpisah). |
| **GitHub Actions Auto-Build APK** | ✅ Selesai | Workflow `.github/workflows/build-apk.yml` otomatis mengkompilasi file `.apk` di Cloud GitHub. |

---

## Log Aktivitas Terbaru

  - Menambahkan konfigurasi **Signed Release APK Android**: Keystore (`upload-keystore.jks`) & `key.properties` resmi SMP THHK Tegal.
  - Menambahkan publikasi otomatis **GitHub Release v1.0.0** untuk mengunduh `.apk` resmi yang telah ditandatangani digital (*Signed Official Release*).
  - Menambahkan fitur **Batch Upload Multi-File PDF** dengan Smart Filename Parser (deteksi otomatis mapel & kelas dari nama file) dan Tabel Review Batch.
  - Menambahkan **Arsitektur Tepat 3 Ruang Ujian (Ruang 1, Ruang 2, Ruang 3)**: Pemilihan Ruang Ujian pada login Proktor dan form presensi Siswa.
  - Menambahkan **Monitoring Terpadu 3 Ruangan** pada Super Admin Dashboard untuk memantau status Berita Acara dan kehadiran peserta di Ruang 1, 2, dan 3.
  - Menambahkan Gate Wajib Berita Acara Ujian saat Proktor pertama kali login sebelum membuka rilis token.
  - Menambahkan modal Canvas Tanda Tangan Digital Siswa setelah verifikasi token 6-karakter.
  - Menambahkan tab Rekap Presensi & Tanda Tangan Digital Siswa di Panel Proktor.
  - Build produksi terverifikasi sukses (`vite build`).
- **Implementasi Modul Flutter Exambrowser (`flutter_app/`):**
  - Membuat `pubspec.yaml` dengan dependensi `flutter_inappwebview`, `flutter_windowmanager`, `kiosk_mode`, `audioplayers`, dan `battery_plus`.
  - Mengimplementasikan `main.dart` dengan `FLAG_SECURE` (Anti-Screenshot/Recording), Fullscreen Immersive Sticky, InAppWebView Vercel, dan PopScope interceptor.
  - Mengimplementasikan `security_service.dart` dengan Alarm Audio Sirine 95% Volume saat `AppLifecycleState.paused`.
  - Mengimplementasikan `exit_password_dialog.dart` untuk modal PIN Password pengawas.
- **Integrasi GitHub Actions CI/CD (`.github/workflows/build-apk.yml`):**
  - Membuat otomatisasi GitHub Actions yang mengkompilasi file `app-release.apk` di cloud setiap kali kode di-push ke branch `main`.

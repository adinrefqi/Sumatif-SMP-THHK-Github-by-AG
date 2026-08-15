# Audit Keamanan (AUDIT-KEAMANAN.md)
## Aplikasi Exambrowser Ujian Sumatif SMP THHK

**Tanggal audit:** 15 Agustus 2026
**Sudut pandang:** penyerang = siswa peserta ujian (HP sendiri, laptop di rumah, akses Google).
**Cakupan yang dibaca:** `web_app/src/**`, `web_app/supabase/**`, `flutter_app/lib/**`,
`android_app/**`, `.github/workflows/build-apk.yml`, `vercel.json`, `web_app/dist/` (bundle produksi).

> **Untuk AI agent yang membaca ini:** setiap temuan punya nomor tetap (#1..#13). Rujuk
> dengan nomornya. Jangan hapus temuan yang sudah selesai — tandai `[SELESAI]` +
> tanggal + commit, supaya audit berikutnya tahu apa yang sudah pernah diperiksa.
> Status di file ini adalah status **kode**, bukan status database Supabase (lihat
> bagian "Belum terverifikasi" di bawah).

---

## Ringkasan

Fase 1 (`001_server_authority.sql` + `001b_rls_force_and_rpc_fix.sql`) sudah menulis
struktur yang benar: RLS forced, tanpa policy anon, `pdf_url` hanya keluar lewat
`open_exam`, PIN ter-hash bcrypt. Masalahnya bukan strukturnya.

**Otoritas server tidak berarti kalau kredensial untuk melewatinya diketahui setiap
siswa di ruangan.** Token diumumkan ke seluruh ruang, NISN teman ada di absen kelas,
dan password keluar kiosk masih `12345` di dalam kode. Tiga temuan teratas bisa
dieksploitasi tanpa alat khusus dan masing-masing membatalkan keabsahan ujian.

Status: **belum layak dipakai untuk ujian sungguhan.**

---

## Prioritas kerja

| Gelombang | Temuan | Alasan |
|---|---|---|
| 1 — sebelum apa pun | #1, #2, #3 | Dieksploitasi siswa biasa tanpa alat khusus; membatalkan keabsahan ujian |
| 2 — sebelum naskah diunggah | #5, #4, #6 | Melindungi kerahasiaan naskah soal |
| 3 — sebelum ujian pertama | #7, #9, #11 | Integritas pengawasan & data |
| 4 — bersih-bersih | #8, #10, #12, #13 | Dampak terbatas |

---

## #1 KRITIS — Exit password kiosk hardcoded `12345`

**Status:** SELESAI (kode) — 15 Agustus 2026. Verifikasi kini lewat RPC `verify_exit_pin` (bcrypt di `room_pins`), plus lockout lokal 3× salah → 60 detik. Literal `12345`/`THHK2026` dihapus dari `flutter_app`; `android_app/` dihapus total (lihat #13).
**Lokasi:** `flutter_app/lib/services/exit_pin_service.dart`, `flutter_app/lib/widgets/exit_password_dialog.dart`, `web_app/supabase/migrations/003_wave1_fixes.sql`

```dart
if (entered == '12345' || entered == 'THHK2026') {
```

Commit `0e78096 "Reset PIN template to placeholders"` tidak menyentuh file ini.
`PRD.md:81` dan `Progres.md:20` mengklaim exit password "dikonfigurasi terpisah di luar
repo" — **klaim itu salah** untuk kode yang ada sekarang.

**Eksploitasi:** tombol Back → dialog muncul → `12345` → kiosk mati, `exit(0)`.
Tanpa decompile, tanpa root, ±5 detik. Seluruh 30 fitur penguncian jatuh di sini.

**Perbaikan:**
1. Hapus perbandingan literal. Verifikasi lewat RPC `verify_exit_pin(p_pin)` (bcrypt di
   `room_pins`, room `'exit'`), atau minimal `--dart-define=EXIT_PIN_HASH=...` disuntik
   CI dari GitHub Secret.
2. Jangan simpan PIN/hash sebagai string literal di Dart — terbaca dengan `strings`/`apktool`.
3. Tambah counter percobaan lokal: 3 salah → dialog terkunci 60 detik.
4. Perbaiki klaim di `PRD.md:81` dan `Progres.md:20` setelah selesai.

---

## #2 KRITIS — Presensi & TTD siswa lain bisa dipalsukan/ditimpa

**Status:** SELESAI (kode) — 15 Agustus 2026. `open_exam` kini wajib `secret_code` (4 karakter per siswa, tidak dibagikan ke ruangan), presensi `on conflict do nothing` (TTD tidak bisa ditimpa), 1 sesi aktif per NISN+exam (sesi kedua ditolak sampai proktor reset), audit append-only di `attendance_audit`.
**Lokasi:** `web_app/supabase/migrations/003_wave1_fixes.sql` (check_token, open_exam, reset_student_session, attendance_audit)

`open_exam` hanya memverifikasi **NISN + ruang + token**. Ketiganya diketahui setiap
siswa di ruangan itu (token diumumkan ke seluruh ruang; NISN teman ada di absen kelas).

```sql
insert into public.attendance(nisn, exam_id, room, signature)
values (p_nisn, p_exam_id, p_room, p_signature)
on conflict (nisn, exam_id) do update set signature = excluded.signature;
```

`do update` = **timpa**, bukan tolak.

**Eksploitasi:** panggil `open_exam` dengan NISN teman (RPC publik untuk `anon`, bisa
via DevTools atau curl dari HP lain) → teman yang tidak hadir tercatat HADIR + ada
TTD-nya. Atau timpa TTD siswa yang sudah presensi dengan coretan asal. Berita acara
kehilangan nilai hukumnya.

**Perbaikan:**
1. `on conflict (nisn, exam_id) do nothing` + `raise exception 'Presensi sudah tercatat'`.
   TTD tidak boleh bisa ditimpa dari klien.
2. Batasi `student_sessions`: 1 sesi aktif per NISN per exam; sesi kedua ditolak sampai
   proktor melakukan reset.
3. Tambah faktor yang tidak diketahui teman sekelas — paling murah: kolom
   `students.secret_code` (4 karakter acak per siswa, dicetak di kartu peserta
   masing-masing), wajib ikut di `check_token` dan `open_exam`. Token ruang tetap
   dibagikan; kode peserta tidak.
4. Tabel audit append-only: catat `nisn`, IP, waktu setiap panggilan `open_exam`.

---

## #3 KRITIS — PIN Proktor & Super Admin bisa di-brute force dari internet

**Status:** SELESAI (kode) — 15 Agustus 2026. `verify_pin` kini mengembalikan token sesi (`panel_sessions`, 8 jam); semua RPC panel menerima token itu, bukan PIN. Rate-limit global via `pin_attempts` (5 gagal per IP/ruang per 15 menit). `set_room_pin` diperketat (min 12, campur huruf-angka, blacklist). Seed PIN tetap `GANTI-INI-*` dan wajib diganti lewat `002_change_pins_TEMPLATE.sql` — status database masih menunggu tindakan manual.
**Lokasi:** `web_app/supabase/migrations/003_wave1_fixes.sql` (_auth, _auth_session, verify_pin, panel_sessions, pin_attempts, set_room_pin)

`verify_pin`, `release_token`, dan semua `admin_*` di-`grant execute ... to anon`. Anon
key ada di bundle publik — terkonfirmasi di `web_app/dist/assets/index-DwXTuX2S.js`
(project `sksdgnsqzazmwzboofch.supabase.co` + JWT anon-nya). Endpoint ini bisa dipanggil
siapa pun dari mana pun.

Pertahanan satu-satunya `perform pg_sleep(1)` — itu **per-koneksi**, bukan global.
100 request paralel = 100 percobaan/detik. Supabase tidak memberi rate limit default
pada PostgREST RPC.

Diperparah: seed PIN masih `'GANTI-INI-1'`..`'GANTI-INI-SA'`, dan `set_room_pin` hanya
mewajibkan **8 karakter** tanpa syarat kompleksitas. PIN 8 digit angka = ruang 10⁸,
±11 hari pada 100 req/s, jauh lebih cepat dengan pola tanggal (`20260815`, `08152026`).

**Dampak kalau PIN Super Admin jatuh:** `admin_list_exams` → semua `pdf_url` naskah
**sebelum** ujian; `admin_list_students` → seluruh roster NISN; `release_token`;
`admin_delete_student` → hapus roster di tengah ujian.

**Perbaikan:**
1. Berhenti mengirim PIN di setiap request. `verify_pin` mengembalikan token sesi
   (`gen_random_bytes(32)`) yang disimpan di tabel `panel_sessions` dengan `expires_at`;
   RPC lain menerima token itu, bukan PIN. Sekarang PIN dikirim ulang **tiap 10 detik**
   oleh poller dashboard (`ProctorTokenMonitor.jsx:55`) dan ikut masuk ke log request.
2. Rate limit global: tabel `pin_attempts(room, ip, at)`, tolak >5 gagal per 15 menit per
   ruang. Komentar `001:123` menolak lockout karena takut DoS proktor — solusinya bukan
   tanpa batas, tapi throttle eksponensial per-IP + jalur bypass fisik (proktor telepon
   panitia, panitia reset dari dashboard Supabase).
3. `set_room_pin`: minimal 12 karakter, campur huruf-angka, tolak daftar-hitam pendek
   (tanggal, nama sekolah, `12345678`).
4. Jangka panjang: pindahkan jalur panel ke Supabase Auth (email+password panitia),
   cabut `grant ... to anon` untuk semua `admin_*`. PIN untuk panel admin adalah model
   yang salah sejak awal.
5. Ganti sed `GANTI-INI-*` dengan PIN acak. Saat ini tidak ada apa pun yang memaksa itu
   terjadi sebelum ujian.

---

## #4 TINGGI — `FLAG_SECURE` tidak ada; anti-screenshot tidak pernah diimplementasikan

**Status:** SELESAI (kode) — 15 Agustus 2026. `MainActivity.kt` sudah memanggil `window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)` sejak commit `1e634cf`. Audit lama salah membaca kondisi; tidak ada `flutter_windowmanager` (benar, tidak dipakai).
**Lokasi:** `flutter_app/android/app/src/main/kotlin/id/sch/smpthhk/exambrowser/MainActivity.kt:9`

`PRD.md:52` menjanjikan "FLAG_SECURE Enforcement: Memblokir screenshot dan perekaman
layar 100%". `Progres.md:20` menandainya ✅ Selesai dan `Progres.md:47` mengklaim
dependensinya terpasang. **Ketiga klaim salah.** Screenshot dan screen record berfungsi normal.

**Eksploitasi:** screenshot seluruh naskah → grup WhatsApp angkatan saat ujian berjalan.
Atau rekam layar → bagikan ke sesi ujian berikutnya.

**Perbaikan** (tanpa dependensi baru, aktif sejak frame pertama):
```kotlin
// flutter_app/android/app/src/main/kotlin/.../MainActivity.kt
override fun onCreate(savedInstanceState: Bundle?) {
    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE)
    super.onCreate(savedInstanceState)
}
```
`flutter_windowmanager` sudah lama tidak dirawat — jangan pakai. Setelah selesai,
perbaiki `PRD.md:52`, `Progres.md:20`, `Progres.md:47`.

---

## #5 TINGGI — `pdf_url` adalah link Google Drive publik; bocor sekali = bocor selamanya

**Status:** SELESAI (kode) — 15 Agustus 2026. `open_exam` tidak lagi mengembalikan `pdf_url`; klien siswa hanya pegang `session_id` dan memuat PDF lewat Edge Function `smooth-api` (proxy server, validasi sesi + durasi). Cabang iframe Drive di `MobilePdfViewer` dihapus. Pratinjau Super Admin tetap pakai iframe langsung (hanya panitia, bukan siswa).
**Lokasi:** `web_app/supabase/functions/exam-pdf/index.ts`, `web_app/supabase/migrations/004_wave2_fixes.sql`, `web_app/src/lib/supabase.js`, `web_app/src/components/viewer/StudentAttendanceModal.jsx`, `web_app/src/components/viewer/MobilePdfViewer.jsx`

> **Butuh tindakan manual:** deploy Edge Function `smooth-api` + set secret `EXAM_PDF_SUPABASE_URL` & `EXAM_PDF_SERVICE_ROLE_KEY` di dashboard Supabase, lalu jalankan `004_wave2_fixes.sql`. Tanpa itu, naskah siswa tidak akan tampil (open_exam tidak lagi memberi URL Drive).

`convertGDriveUrl` menghasilkan `https://drive.google.com/file/d/<ID>/preview`. Supaya
bisa dibuka siswa, file harus di-share "anyone with the link" — artinya URL-nya sendiri
**adalah** kredensialnya. `MobilePdfViewer.jsx:257` menaruhnya di `<iframe src={pdfUrl}>`.

**Eksploitasi:** lihat DOM atau tab Network → dapat file ID → buka di browser laptop →
unduh, cetak, sebarkan. Tidak perlu menembus kiosk. Seluruh kerja Fase 1 memindahkan
`pdf_url` ke belakang `open_exam` jadi sia-sia dalam satu langkah.

**Perbaikan:**
1. Jangan kirim URL Drive ke klien. Proxy naskahnya: Supabase Edge Function yang
   mengambil PDF dengan service-account Drive dan menyalurkan byte-nya, hanya untuk
   `session_id` valid yang masih dalam durasi ujian.
2. Render dari byte hasil proxy lewat `pdf.js` — kodenya **sudah ada** di
   `MobilePdfViewer` (jalur `pdfjsLib`); yang bocor adalah cabang `isGoogleDriveUrl`.
   Buang cabang iframe itu sepenuhnya.
3. Mitigasi sementara (bukan perbaikan): rotasi link Drive setiap sesi, matikan share
   setelah ujian.

---

## #6 TINGGI — WebView tanpa allowlist URL; iframe Drive adalah jalan keluar dari kiosk

**Status:** SELESAI (kode) — 15 Agustus 2026. `shouldOverrideUrlLoading` membatasi ke host `portal-sumatifthhk.vercel.app`, `onCreateWindow` mengembalikan `false`, `javaScriptCanOpenWindowsAutomatically: false`.
**Lokasi:** `flutter_app/lib/main.dart:195-214`

`useShouldOverrideUrlLoading: true` dinyalakan tapi handler `shouldOverrideUrlLoading`
**tidak pernah didaftarkan**. Tidak ada pembatas navigasi sama sekali.

**Eksploitasi:** iframe Drive di dalam WebView adalah UI Google penuh → "Buka di Drive"
→ Drive pribadi → Google Search → kalkulator, terjemahan, chat. Kiosk mode mengunci
aplikasi lain; ia tidak mengunci bahwa satu aplikasi yang diizinkan adalah pintu ke
seluruh internet.

**Perbaikan:**
```dart
shouldOverrideUrlLoading: (controller, action) async {
  final host = action.request.url?.host ?? '';
  const allowed = {'portal-sumatifthhk.vercel.app'};
  return allowed.contains(host)
      ? NavigationActionPolicy.ALLOW
      : NavigationActionPolicy.CANCEL;
},
```
Tambah `onCreateWindow: (_, __) async => false` dan
`javaScriptCanOpenWindowsAutomatically: false`. Kalau #5 diperbaiki (proxy PDF, tanpa
iframe Drive), allowlist ini cukup satu host dan masalahnya hilang bersamaan.

---

## #7 TINGGI — Log pelanggaran bisa dipalsukan dan dibanjiri siapa pun

**Status:** SELESAI (kode) — 15 Agustus 2026. Policy `anon_insert_violation_logs` dicabut; pelanggaran kini lewat RPC `log_violation(p_session_id, p_type, p_detail)` yang mengambil `nisn` dari `student_sessions` (bukan dari klien), memvalidasi tipe enum, membatasi `detail` 200 char, dan rate-limit 20/menit/sesi. `proctor_dashboard` menambah `violation_summary` (agregat per siswa) supaya banjir terlihat sebagai anomali.
**Lokasi:** `web_app/supabase/migrations/005_wave3_fixes.sql`, `web_app/src/lib/supabase.js`, `web_app/src/components/admin/ProctorTokenMonitor.jsx`

```sql
create policy "anon_insert_violation_logs" on public.violation_logs
  for insert to anon with check (true);
```

`with check (true)` = tanpa syarat. `student_id` datang dari klien: `supabase.js:222`
mengirim `entry.studentId` yang diambil dari `localStorage` key `thhk_active_session` —
sepenuhnya di bawah kendali siswa.

**Dua eksploitasi:**
- **Menjebak teman:** sisipkan 50 pelanggaran `visibility_hidden` dengan `student_id`
  NISN teman. Proktor melihat teman itu sebagai pelanggar berat.
- **Menyembunyikan diri:** `proctor_dashboard` membatasi `limit 200`. Banjiri 500 baris
  sampah → pelanggaran nyata milik pelaku terdorong keluar dari 200 teratas. Diteruskan:
  jutaan baris = tagihan Supabase.

**Perbaikan:**
1. Cabut `anon_insert_violation_logs`. Ganti dengan RPC
   `log_violation(p_session_id uuid, p_type text, p_detail text)` yang mengambil `nisn`
   dari `student_sessions` berdasarkan `session_id` — **bukan** dari parameter klien.
2. Rate limit di dalam RPC: tolak kalau sesi itu sudah >20 pelanggaran dalam 1 menit.
3. Batasi `p_type` ke enum yang dikenal, `p_detail` maks 200 karakter.
4. Hapus `limit 200`; ganti agregat per siswa (`count(*) group by nisn`) supaya banjir
   terlihat sebagai anomali, bukan menyembunyikan.

---

## #8 SEDANG — `heartbeat` tanpa autentikasi

**Status:** SELESAI (kode) — 15 Agustus 2026. `heartbeat(p_session_id, p_nisn)` kini mencocokkan nisn dengan baris sesi.
**Lokasi:** `web_app/supabase/migrations/003_wave1_fixes.sql`

`heartbeat(p_session_id uuid)` langsung `update` tanpa memeriksa apa pun. Siapa pun yang
punya `session_id` bisa menjaga sesi orang lain tetap "ONLINE". Dampak kecil (UUID sulit
ditebak), tapi indikator ONLINE/OFFLINE di monitoring integritas tidak bisa dipercaya
sebagai bukti kehadiran.

**Perbaikan:** sertakan `nisn` dan cocokkan dengan baris sesi. Sekalian menutup #2 poin 2.

---

## #9 SEDANG — Durasi ujian tidak ditegakkan server

**Status:** SELESAI (kode) — 15 Agustus 2026. `student_sessions` kini punya `expires_at`; `open_exam` mengisinya (`now() + duration`) dan mengembalikannya ke klien; `heartbeat` menolak sesi lewat durasi. Timer web menghitung dari `expires_at`, bukan state yang bisa di-reset refresh.
**Lokasi:** `web_app/supabase/migrations/005_wave3_fixes.sql`, `web_app/src/components/viewer/ExamTimerHeader.jsx`, `web_app/src/components/viewer/StudentAttendanceModal.jsx`

Timer dihitung dari `duration_minutes` di state React. Refresh halaman → timer penuh
lagi. `student_sessions` tidak punya `expires_at`, dan `open_exam` tidak menolak sesi
yang durasinya sudah lewat.

**Eksploitasi:** terus membuka naskah setelah waktu habis, atau membuka ulang setelah
ujian ditutup selama token masih dalam 17 menit terakhirnya.

**Perbaikan:** tambah `expires_at timestamptz` (diisi `now() + duration`), tolak
`heartbeat`/`open_exam` setelah lewat, kirim `expires_at` ke klien supaya timer tidak
bisa direset dengan refresh.

---

## #10 SEDANG — Aplikasi ujian sendiri meminta izin overlay

**Status:** SELESAI (kode) — 15 Agustus 2026. `SYSTEM_ALERT_WINDOW` dihapus dari `flutter_app/android/app/src/main/AndroidManifest.xml`. Deteksi overlay `canDrawOverlays` masih belum diimplementasikan (fitur berbeda, dicatat sebagai pelanggaran bila kelak ditambahkan).
**Lokasi:** `flutter_app/android/app/src/main/AndroidManifest.xml`

`PRD.md:54` menjanjikan deteksi overlay via `Settings.canDrawOverlays`. `grep` tidak
menemukan pemeriksaan itu di mana pun. Izin overlay diminta tanpa dipakai, sementara
fitur yang mestinya memakainya tidak ada.

**Perbaikan:** hapus `SYSTEM_ALERT_WINDOW` (aplikasi ujian tidak perlu menggambar di
atas aplikasi lain), lalu implementasikan pemeriksaan yang dijanjikan. Catat sebagai
pelanggaran, jangan auto-kill — konsisten dengan strategi BYOD di `main.dart:88`.

---

## #11 SEDANG — Tidak ada security header

**Status:** SELESAI (kode) — 15 Agustus 2026. `vercel.json` kini menyertakan `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, dan CSP (termasuk `frame-ancestors 'none'` + `frame-src https://drive.google.com` untuk pratinjau Super Admin).
**Lokasi:** `vercel.json`

> Butuh redeploy Vercel agar header aktif di produksi.

Tidak ada CSP, `X-Frame-Options`, `Referrer-Policy`. Portal bisa di-iframe situs mana pun
(clickjacking terhadap panel proktor), dan tidak ada CSP yang membatasi ke mana data
boleh dikirim kalau ada XSS.

**Perbaikan** — tambahkan ke `vercel.json`:
```json
"headers": [{
  "source": "/(.*)",
  "headers": [
    {"key": "X-Frame-Options", "value": "DENY"},
    {"key": "Referrer-Policy", "value": "no-referrer"},
    {"key": "Content-Security-Policy", "value": "default-src 'self'; connect-src 'self' https://sksdgnsqzazmwzboofch.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'none'"}
  ]
}]
```
`frame-src` sengaja tidak ada: begitu iframe Drive dibuang (#5) tidak ada frame yang
perlu diizinkan. Kalau iframe masih dipakai sementara, tambahkan
`frame-src https://drive.google.com`.

---

## #12 RENDAH — Enumerasi roster lewat pesan error berbeda

**Status:** SELESAI (kode) — 15 Agustus 2026. Pesan error `check_token` & `open_exam` sudah disatukan jadi `Data peserta atau token tidak valid` (di `003_wave1_fixes.sql`).
**Lokasi:** `web_app/supabase/migrations/003_wave1_fixes.sql`

Membedakan `'NISN tidak terdaftar'` dan `'Ruang tidak sesuai dengan data terdaftar'` —
dari luar itu oracle: uji NISN mana yang ada, dan siswa itu di ruang mana. Butuh token
valid dulu, jadi dampaknya terbatas pada peserta ujian.

**Perbaikan:** satukan jadi pesan generik (`'Data peserta atau token tidak valid'`).
Detail untuk proktor tetap dicatat di tabel audit sisi server.

---

## #13 RENDAH — Sisa `android_app/` masih ada dengan lubang yang sama

**Status:** SELESAI — 15 Agustus 2026. `android_app/` sudah `git rm -r` (riwayat tetap di git).
**Lokasi:** —

Masih berisi `ExitPasswordDialog.java` dengan `12345` (#1), package name identik
`id.sch.smpthhk.exambrowser`, dan `.gradle/` lock files ikut ter-commit. `Progres.md:19`
menjadwalkannya dihapus di Fase 2.2.

Selama masih ada: biner kedua yang lebih lemah dengan package name yang sama — sumber
kebingungan saat instalasi dan pintu yang terlupakan di audit berikutnya.

**Perbaikan:** `git rm -r android_app` sekarang, bukan Fase 2.2. Riwayat tetap di git.

---

## Belum terverifikasi (tindakan manual di luar repo)

Audit ini membaca **kode**. Tiga hal berikut tidak bisa diverifikasi dari repo dan
tercatat "menunggu" di `Progres.md:34`:

1. Apakah `000_emergency_lockdown.sql`, `001_server_authority.sql`, dan
   `001b_rls_force_and_rpc_fix.sql` **benar-benar sudah dijalankan** di Supabase.
2. Apakah PIN `GANTI-INI-*` sudah diganti.
3. Apakah repo sudah dijadikan privat, dan keystore sudah dirotasi + 4 GitHub Secret terisi.

> **Kalau `001b` belum dijalankan**: tabel masih "unrestricted" dan seluruh basis data
> terbuka untuk anon key yang ada di bundle publik. Itu menjadi **temuan #0 di atas
> semua ini** — periksa lebih dulu sebelum mengerjakan apa pun.
>
> Cara cek cepat di Supabase SQL Editor:
> ```sql
> select relname, relrowsecurity, relforcerowsecurity
> from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';
> select proname from pg_proc where pronamespace = 'public'::regnamespace order by proname;
> ```

---

## Catatan tentang akurasi dokumentasi proyek

`Progres.md` dan `PRD.md` menandai beberapa fitur keamanan selesai padahal belum ada di
kode. Ini bahaya tersendiri: panitia mengambil keputusan berdasarkan dokumen itu.

| Klaim | Lokasi klaim | Kenyataan |
|---|---|---|
| `FLAG_SECURE` aktif | `PRD.md:52`, `Progres.md:20` | Tidak ada di kode (#4) |
| `flutter_windowmanager` terpasang | `Progres.md:47` | Tidak ada di `pubspec.yaml` (#4) |
| Exit password dikonfigurasi di luar repo | `PRD.md:81`, `Progres.md:20` | Hardcoded `12345` (#1) |
| Deteksi overlay `canDrawOverlays` | `PRD.md:54` | Tidak ada pemeriksaannya (#10) |

Perbaiki dokumen **bersamaan** dengan kodenya, jangan sebelum.

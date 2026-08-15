-- ============================================================
-- GANTI PIN (TEMPLATE — isi nilai sebelum dijalankan)
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Catatan penting (berubah sejak Gelombang 1):
--   File ini mengubah langsung tabel room_pins (bcrypt), TIDAK lewat
--   set_room_pin, karena set_room_pin sekarang butuh token sesi panel.
--   SQL Editor berjalan sebagai superuser, jadi update langsung aman.
--
-- Cara pakai:
--   1. Ganti setiap 'PIN_BARU_...' dengan nilai asli.
--   2. PIN baru wajib min 12 karakter, campur huruf & angka, tidak mudah ditebak.
--   3. JANGAN commit nilai PIN asli ke repo. Setelah selesai, kembalikan
--      placeholder ke file ini sebelum commit.
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Exit password kiosk
update public.room_pins
set pin_hash = crypt('PIN_BARU_EXIT', gen_salt('bf')), updated_at = now()
where room = 'exit';

-- 2. Ruang 1
update public.room_pins
set pin_hash = crypt('PIN_BARU_RUANG_1', gen_salt('bf')), updated_at = now()
where room = 'Ruang 1';

-- 3. Ruang 2
update public.room_pins
set pin_hash = crypt('PIN_BARU_RUANG_2', gen_salt('bf')), updated_at = now()
where room = 'Ruang 2';

-- 4. Ruang 3
update public.room_pins
set pin_hash = crypt('PIN_BARU_RUANG_3', gen_salt('bf')), updated_at = now()
where room = 'Ruang 3';

-- 5. Super Admin
update public.room_pins
set pin_hash = crypt('PIN_BARU_SUPER_ADMIN', gen_salt('bf')), updated_at = now()
where room = 'super_admin';

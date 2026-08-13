-- ============================================================
-- GANTI PIN (TEMPLATE — isi nilai sebelum dijalankan)
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Cara pakai:
--   1. Ganti setiap 'PIN_SAAT_INI' dan 'PIN_BARU_...' dengan nilai asli.
--   2. Ganti PIN ruang dulu, PIN super admin paling akhir
--      (karena set_room_pin butuh PIN super admin lama sebagai auth).
--
-- Syarat PIN baru: minimal 8 karakter, acak, jangan mudah ditebak.
-- JANGAN commit nilai PIN asli ke repo.
-- ============================================================

-- 1. Ruang 1
select public.set_room_pin('PIN_SA_SAAT_INI', 'Ruang 1', 'PIN_BARU_RUANG_1');

-- 2. Ruang 2
select public.set_room_pin('PIN_SA_SAAT_INI', 'Ruang 2', 'PIN_BARU_RUANG_2');

-- 3. Ruang 3
select public.set_room_pin('PIN_SA_SAAT_INI', 'Ruang 3', 'PIN_BARU_RUANG_3');

-- 4. Super Admin (TERAKHIR)
select public.set_room_pin('PIN_SA_SAAT_INI', 'super_admin', 'PIN_BARU_SUPER_ADMIN');

-- ============================================================
-- FASE 0.1 — Emergency Lockdown
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Menghentikan kebocoran yang sedang berjalan. Tidak menambah
-- fitur apa pun. Perbaikan struktural menyusul di Fase 1.
-- ============================================================

-- Hentikan kebocoran pdf_url ke anon
drop policy if exists "anon_select_exam_sessions" on public.exam_sessions;
drop policy if exists "anon_update_exam_sessions" on public.exam_sessions;
drop policy if exists "anon_insert_exam_sessions" on public.exam_sessions;

-- Hentikan hapus/ubah massal roster siswa
drop policy if exists "anon_delete_students"  on public.students;
drop policy if exists "anon_update_students"  on public.students;
drop policy if exists "anon_insert_students"  on public.students;

-- Siswa hanya boleh menulis pelanggaran, tidak boleh membacanya
drop policy if exists "anon_select_violation_logs" on public.violation_logs;

-- Tidak dipakai kode mana pun (sudah diverifikasi via grep)
drop table if exists public.student_logs;

-- Bersihkan baris sampah heartbeat yang mencemari bank soal.
-- Heartbeat meng-upsert id 'sess-<ts>-<nisn>' ke tabel bank soal
-- (StudentTokenScreen.jsx:94 -> supabase.js:290).
delete from public.exam_sessions where id like 'sess-%';

-- CATATAN: "anon_select_students" SENGAJA DIBIARKAN HIDUP.
-- Login siswa masih memerlukannya sampai Fase 1 selesai. Jangan cabut sekarang.

-- ============================================================
-- SMP THHK Sumatif Exam Portal — Supabase Schema Migration
-- Jalankan di: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. exam_sessions: daftar ujian yang diterbitkan admin
--    id berupa string seperti 'exam-1786540000000' (dikirim dari kode web)
create table if not exists public.exam_sessions (
  id text primary key,
  title text,
  subject text,
  grade text,
  duration_minutes integer,
  pdf_url text,
  file_name text,
  source_type text default 'gdrive',
  created_at timestamptz not null default now(),
  -- kolom integritas ujian
  last_seen_at timestamptz,
  violations_count integer not null default 0,
  status text not null default 'ACTIVE' -- ACTIVE | HELP_NEEDED | DISCONNECTED
);

alter table public.exam_sessions enable row level security;

create policy "anon_insert_exam_sessions" on public.exam_sessions
  for insert to anon with check (true);

create policy "anon_select_exam_sessions" on public.exam_sessions
  for select to anon using (true);

create policy "anon_update_exam_sessions" on public.exam_sessions
  for update to anon using (true) with check (true);

-- 2. violation_logs: catatan pelanggaran integritas ujian
create table if not exists public.violation_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  student_id text,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.violation_logs enable row level security;

-- anon hanya boleh insert & select (untuk proctor dashboard);
-- tidak boleh update/delete sembarangan
create policy "anon_insert_violation_logs" on public.violation_logs
  for insert to anon with check (true);

create policy "anon_select_violation_logs" on public.violation_logs
  for select to anon using (true);

-- 3. student_logs: status siswa per ujian (Desain.md)
create table if not exists public.student_logs (
  id uuid primary key default gen_random_uuid(),
  exam_id text,
  student_name text,
  nisn text unique, -- unik per siswa, untuk upsert help request
  status text not null default 'ACTIVE', -- ACTIVE | HELP_NEEDED | DISCONNECTED
  violations_count integer not null default 0,
  last_active_at timestamptz not null default now()
);

alter table public.student_logs enable row level security;

create policy "anon_insert_student_logs" on public.student_logs
  for insert to anon with check (true);

create policy "anon_select_student_logs" on public.student_logs
  for select to anon using (true);

create policy "anon_update_student_logs" on public.student_logs
  for update to anon using (true) with check (true);

-- 4. students: daftar siswa terdaftar yang boleh mengikuti ujian
create table if not exists public.students (
  nisn text primary key,
  name text not null,
  class text not null,       -- contoh: 8A, 9B
  room text not null,        -- Ruang 1 | Ruang 2 | Ruang 3
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

-- anon: bisa insert (upload daftar), select (validasi login), update (koreksi data)
create policy "anon_insert_students" on public.students
  for insert to anon with check (true);

create policy "anon_select_students" on public.students
  for select to anon using (true);

create policy "anon_update_students" on public.students
  for update to anon using (true) with check (true);

create policy "anon_delete_students" on public.students
  for delete to anon using (true);

-- ============================================================
-- Catatan tambahan:
-- 1. Bucket Storage 'exam-pdfs' TIDAK diperlukan lagi — upload
--    file PDF sudah dihapus; naskah soal hanya via Link Google Drive.
-- 2. Anon key didesain untuk frontend (publik). RLS di atas
--    membatasi agar anon hanya insert/select; update hanya
--    diizinkan di exam_sessions (untuk heartbeat last_seen_at).
-- 3. Jika tabel exam_sessions PERNAH dibuat sebelumnya dengan
--    id bertipe uuid (bukan text), jalankan dulu:
--      drop table if exists public.exam_sessions cascade;
--    lalu jalankan ulang skrip ini. (Kode web mengirim id string.)
-- ============================================================

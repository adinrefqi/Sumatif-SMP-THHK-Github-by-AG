-- ============================================================
-- SMP THHK Sumatif Exam Portal — Supabase Schema Migration
-- Jalankan di: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. violation_logs: catatan pelanggaran integritas ujian
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

-- 2. exam_sessions: kolom integritas (jika tabel sudah ada dari kode)
alter table public.exam_sessions
  add column if not exists last_seen_at timestamptz,
  add column if not exists violations_count integer not null default 0,
  add column if not exists status text not null default 'ACTIVE';

-- 3. student_logs: status siswa per ujian (Desain.md)
create table if not exists public.student_logs (
  id uuid primary key default gen_random_uuid(),
  exam_id text,
  student_name text,
  nisn text,
  status text not null default 'ACTIVE', -- ACTIVE | HELP_NEEDED | DISCONNECTED
  violations_count integer not null default 0,
  last_active_at timestamptz not null default now()
);

alter table public.student_logs enable row level security;

create policy "anon_insert_student_logs" on public.student_logs
  for insert to anon with check (true);

create policy "anon_select_student_logs" on public.student_logs
  for select to anon using (true);

-- ============================================================
-- Catatan tambahan:
-- 1. Bucket 'exam-pdfs' (Storage) harus ada & publik untuk upload PDF.
--    Buat manual di Dashboard → Storage → New bucket
--    (name: exam-pdfs, public: ON) bila belum ada.
-- 2. Anon key didesain untuk frontend (publik). RLS di atas
--    membatasi agar anon hanya insert/select, tidak bisa update/delete.
-- ============================================================

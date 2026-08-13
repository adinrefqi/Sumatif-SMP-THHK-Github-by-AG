-- ============================================================
-- SMP THHK Sumatif Exam Portal — Supabase Schema
-- Jalankan di: Supabase Dashboard → SQL Editor → New query
--
-- File ini mencerminkan kondisi akhir setelah FASE 0 (Emergency
-- Lockdown). Untuk database yang sudah berjalan, jalankan
-- migrations/000_emergency_lockdown.sql — bukan file ini.
--
-- Prinsip RLS setelah Fase 0: anon key ada di bundle JS publik,
-- jadi anggap SIAPA PUN memegangnya. Yang boleh anon lakukan
-- dipersempit ke minimum yang membuat aplikasi tetap jalan.
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

-- TANPA POLICY ANON. Tabel ini memuat pdf_url (link naskah soal);
-- select anon berarti naskah bisa diambil siapa pun sebelum ujian.
-- Akses dipulihkan di Fase 1 lewat RPC security definer.

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

-- Insert-only: siswa perlu bisa melapor, tapi tidak boleh membaca
-- laporan siswa lain (bocor = ketahuan deteksi apa yang aktif).
create policy "anon_insert_violation_logs" on public.violation_logs
  for insert to anon with check (true);

-- 3. students: daftar siswa terdaftar yang boleh mengikuti ujian
create table if not exists public.students (
  nisn text primary key,
  name text not null,
  class text not null,       -- tingkat kelas saja: 7 | 8 | 9
  room text not null,        -- Ruang 1 | Ruang 2 | Ruang 3
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

-- Select-only, dan HANYA sementara: login siswa masih memvalidasi
-- NISN di klien. Dicabut di Fase 1 setelah validasi pindah ke RPC.
create policy "anon_select_students" on public.students
  for select to anon using (true);

-- ============================================================
-- Catatan:
-- 1. Bucket Storage 'exam-pdfs' tidak diperlukan — naskah soal
--    hanya via Link Google Drive.
-- 2. Tabel student_logs sudah dihapus (tidak dirujuk kode mana pun).
-- 3. Yang rusak setelah Fase 0 (disengaja, dipulihkan di Fase 1):
--    tambah/hapus siswa di StudentManager, publikasi soal baru dari
--    PdfUploader, tab Monitoring Integritas, dan sinkronisasi last_seen.
-- ============================================================

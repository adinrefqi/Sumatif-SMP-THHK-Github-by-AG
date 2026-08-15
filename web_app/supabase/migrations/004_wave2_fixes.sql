-- ============================================================
-- GELOMBANG 2 — #5 Tutup kebocoran pdf_url dari jalur siswa
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Prasyarat: 003_wave1_fixes.sql sudah dijalankan.
--
-- Perubahan: open_exam TIDAK lagi mengembalikan pdf_url. Klien siswa
-- hanya menerima session_id; PDF diambil lewat Edge Function `exam-pdf`
-- yang memvalidasi sesi & durasi di server, lalu mem-proxy byte PDF.
-- ============================================================

create or replace function public.open_exam(p_nisn text, p_room text, p_token text, p_exam_id text, p_signature text, p_secret_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student record;
  v_token record;
  v_exam record;
  v_session_id uuid;
  v_ip text;
begin
  select * into v_student from public.students where nisn = p_nisn;
  if not found then raise exception 'Data peserta atau token tidak valid'; end if;
  if v_student.room <> p_room
     or coalesce(v_student.secret_code, '') <> upper(trim(p_secret_code)) then
    raise exception 'Data peserta atau token tidak valid';
  end if;

  select * into v_token from public.exam_tokens where room = p_room;
  if not found then raise exception 'Data peserta atau token tidak valid'; end if;
  if v_token.token <> upper(trim(p_token))
     or extract(epoch from (now() - v_token.created_at)) > 17 * 60 then
    raise exception 'Data peserta atau token tidak valid';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found or not v_exam.is_active then raise exception 'Naskah soal tidak aktif'; end if;

  -- Satu sesi aktif per NISN per exam. Sesi kedua ditolak sampai proktor reset.
  if exists (
    select 1 from public.student_sessions
    where nisn = p_nisn and exam_id = p_exam_id
      and last_seen_at > now() - interval '1 hour'
  ) then
    raise exception 'Sesi ujian sudah aktif. Hubungi proktor untuk reset sesi.';
  end if;

  insert into public.attendance(nisn, exam_id, room, signature)
  values (p_nisn, p_exam_id, p_room, p_signature)
  on conflict (nisn, exam_id) do nothing;

  insert into public.student_sessions(nisn, exam_id, room)
  values (p_nisn, p_exam_id, p_room)
  returning id into v_session_id;

  v_ip := public._client_ip();
  insert into public.attendance_audit(nisn, exam_id, room, action, ip)
  values (p_nisn, p_exam_id, p_room, 'open_exam', v_ip);

  -- TANPA pdf_url. Klien hanya dapat session_id + metadata.
  return jsonb_build_object(
    'session_id', v_session_id,
    'title', v_exam.title,
    'duration_minutes', v_exam.duration_minutes
  );
end $$;

grant execute on function public.open_exam(text, text, text, text, text, text) to anon, authenticator;

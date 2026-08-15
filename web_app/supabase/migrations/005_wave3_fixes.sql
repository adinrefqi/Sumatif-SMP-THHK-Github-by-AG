-- ============================================================
-- GELOMBANG 3 — #7 & #9
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Prasyarat: 003_wave1_fixes.sql & 004_wave2_fixes.sql sudah dijalankan.
--
-- Isi file ini:
--   #7  Log pelanggaran lewat RPC `log_violation` (identitas dari
--       student_sessions, bukan dari klien). Cabut policy insert anon.
--   #9  Durasi ujian ditegakkan server: student_sessions.expires_at,
--       open_exam & heartbeat tolak sesi lewat durasi.
-- ============================================================

-- ------------------------------------------------------------
-- 1. #9 — expires_at di student_sessions
-- ------------------------------------------------------------
alter table public.student_sessions add column if not exists expires_at timestamptz;

-- Isi expires_at untuk sesi lama (fallback 6 jam agar tidak langsung mati).
update public.student_sessions
set expires_at = coalesce(expires_at, started_at + interval '6 hours')
where expires_at is null;

-- ------------------------------------------------------------
-- 2. #7 — Cabut policy insert anon yang bisa dipalsukan
-- ------------------------------------------------------------
drop policy if exists "anon_insert_violation_logs" on public.violation_logs;

-- ------------------------------------------------------------
-- 3. #7 — RPC log_violation (identitas dari session_id di server)
-- ------------------------------------------------------------
create or replace function public.log_violation(p_session_id uuid, p_type text, p_detail text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_s record;
  v_recent int;
  v_allowed text[] := array[
    'blur', 'visibility_hidden', 'beforeunload', 'copy', 'contextmenu',
    'app_background', 'kiosk_disabled', 'unpin_attempt'
  ];
begin
  select * into v_s from public.student_sessions where id = p_session_id;
  if not found then
    raise exception 'Sesi tidak valid';
  end if;

  if v_s.expires_at is not null and now() > v_s.expires_at then
    raise exception 'Durasi ujian telah berakhir';
  end if;

  if not (p_type = any(v_allowed)) then
    raise exception 'Jenis pelanggaran tidak dikenal';
  end if;

  if char_length(p_detail) > 200 then
    raise exception 'Detail pelanggaran terlalu panjang';
  end if;

  -- Rate limit: maks 20 pelanggaran per sesi per menit.
  select count(*) into v_recent from public.violation_logs
  where session_id = p_session_id and created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception 'Terlalu banyak pelanggaran dalam waktu singkat';
  end if;

  insert into public.violation_logs(session_id, student_id, type, detail)
  values (p_session_id, v_s.nisn, p_type, p_detail);

  return jsonb_build_object('ok', true, 'student_id', v_s.nisn);
end $$;

grant execute on function public.log_violation(uuid, text, text) to anon, authenticator;

-- ------------------------------------------------------------
-- 4. #9 — open_exam isi expires_at + tolak sesi lewat durasi
-- ------------------------------------------------------------
create or replace function public.open_exam(p_nisn text, p_room text, p_token text, p_exam_id text, p_signature text, p_secret_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student record;
  v_token record;
  v_exam record;
  v_session_id uuid;
  v_expires timestamptz;
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

  v_expires := now() + (v_exam.duration_minutes * interval '1 minute');

  insert into public.attendance(nisn, exam_id, room, signature)
  values (p_nisn, p_exam_id, p_room, p_signature)
  on conflict (nisn, exam_id) do nothing;

  insert into public.student_sessions(nisn, exam_id, room, expires_at)
  values (p_nisn, p_exam_id, p_room, v_expires)
  returning id into v_session_id;

  v_ip := public._client_ip();
  insert into public.attendance_audit(nisn, exam_id, room, action, ip)
  values (p_nisn, p_exam_id, p_room, 'open_exam', v_ip);

  -- TANPA pdf_url. Klien hanya dapat session_id + metadata + expires_at.
  return jsonb_build_object(
    'session_id', v_session_id,
    'title', v_exam.title,
    'duration_minutes', v_exam.duration_minutes,
    'expires_at', v_expires
  );
end $$;

grant execute on function public.open_exam(text, text, text, text, text, text) to anon, authenticator;

-- ------------------------------------------------------------
-- 5. #9 — heartbeat tolak sesi lewat durasi
-- ------------------------------------------------------------
create or replace function public.heartbeat(p_session_id uuid, p_nisn text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_s record;
begin
  select * into v_s from public.student_sessions where id = p_session_id;
  if not found then
    raise exception 'Sesi tidak valid';
  end if;
  if v_s.nisn <> p_nisn then
    raise exception 'Sesi tidak valid';
  end if;
  if v_s.expires_at is not null and now() > v_s.expires_at then
    raise exception 'Durasi ujian telah berakhir';
  end if;

  update public.student_sessions set last_seen_at = now()
  where id = p_session_id;
end $$;

grant execute on function public.heartbeat(uuid, text) to anon, authenticator;

-- ------------------------------------------------------------
-- 6. #7 — proctor_dashboard: tambah agregat per siswa
-- ------------------------------------------------------------
create or replace function public.proctor_dashboard(p_token text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
  v_attendance jsonb;
  v_violations jsonb;
  v_violation_summary jsonb;
  v_sessions jsonb;
  v_minutes jsonb;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' and v_room <> p_room then
    raise exception 'Sesi proktor tidak cocok dengan ruang ini';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'nisn', a.nisn, 'exam_id', a.exam_id, 'room', a.room,
    'signature', a.signature, 'created_at', a.created_at,
    'name', s.name, 'class', s.class
  )), '[]'::jsonb) into v_attendance
  from public.attendance a
  left join public.students s on s.nisn = a.nisn
  where a.room = p_room;

  -- Detail pelanggaran terakhir untuk tampilan proktor.
  select coalesce((select jsonb_agg(t) from (
    select jsonb_build_object(
      'id', v.id, 'session_id', v.session_id, 'student_id', v.student_id,
      'type', v.type, 'detail', v.detail, 'created_at', v.created_at
    ) as t
    from public.violation_logs v
    where v.student_id in (select s.nisn from public.students s where s.room = p_room)
       or v.session_id in (select ss.id::text from public.student_sessions ss where ss.room = p_room)
    order by v.created_at desc limit 200
  ) sub), '[]'::jsonb) into v_violations;

  -- Agregat per siswa: banjir pelanggaran terlihat sebagai anomali (jumlah
  -- total per siswa), bukan menyembunyikan pelanggaran nyata di balik limit.
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', sub.student_id,
    'count', sub.cnt,
    'last_type', sub.last_type,
    'last_at', sub.last_at
  )), '[]'::jsonb) into v_violation_summary
  from (
    select v.student_id,
           count(*) as cnt,
           max(v.type) as last_type,
           max(v.created_at) as last_at
    from public.violation_logs v
    where v.student_id in (select s.nisn from public.students s where s.room = p_room)
       or v.session_id in (select ss.id::text from public.student_sessions ss where ss.room = p_room)
    group by v.student_id
    order by cnt desc
  ) sub;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ss.id, 'nisn', ss.nisn, 'exam_id', ss.exam_id,
    'room', ss.room, 'started_at', ss.started_at, 'last_seen_at', ss.last_seen_at,
    'expires_at', ss.expires_at
  )), '[]'::jsonb) into v_sessions
  from public.student_sessions ss
  where ss.room = p_room and ss.last_seen_at >= now() - interval '6 hours';

  select coalesce((select data::jsonb from public.official_minutes m where m.room = p_room), 'null'::jsonb)
  into v_minutes;

  return jsonb_build_object(
    'attendance', v_attendance,
    'violations', v_violations,
    'violation_summary', v_violation_summary,
    'sessions', v_sessions,
    'minutes', v_minutes
  );
end $$;

grant execute on function public.proctor_dashboard(text, text) to anon, authenticator;

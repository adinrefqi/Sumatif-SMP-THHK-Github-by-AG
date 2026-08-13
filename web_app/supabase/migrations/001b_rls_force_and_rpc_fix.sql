-- ============================================================
-- FASE 1 — PERBAIKAN: Force RLS + Buat Ulang Semua RPC
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Mengapa file ini ada:
--   001_server_authority.sql membuat tabel tapi RLS tidak aktif
--   ("unrestricted") dan RPC tidak terdaftar (404). Penyebab paling
--   mungkin: SQL Editor berhenti di tengah karena error halus.
--
-- File ini idempoten (aman dijalankan berulang kali):
--   - Force-enable RLS di semua tabel (termasuk yang baru)
--   - Cabut semua policy anon yang tersisa
--   - Buat ulang semua RPC security definer
--   - Grant execute ke anon hanya untuk RPC (bukan tabel)
-- ============================================================

-- ------------------------------------------------------------
-- 1. FORCE-ENABLE RLS di SEMUA tabel (memaksa berlaku untuk semua)
-- ------------------------------------------------------------
alter table public.exams                 force row level security;
alter table public.exam_tokens            force row level security;
alter table public.room_pins              force row level security;
alter table public.attendance             force row level security;
alter table public.student_sessions       force row level security;
alter table public.official_minutes       force row level security;
alter table public.app_settings           force row level security;
alter table public.students               force row level security;
alter table public.violation_logs         force row level security;

-- ------------------------------------------------------------
-- 2. Cabut SEMUA policy anon yang tersisa (tidak boleh ada
--    policy anon apa pun kecuali violation_logs insert-only)
-- ------------------------------------------------------------
drop policy if exists "anon_select_exam_sessions" on public.exams;
drop policy if exists "anon_update_exam_sessions" on public.exams;
drop policy if exists "anon_insert_exam_sessions" on public.exams;
drop policy if exists "anon_select_students" on public.students;
drop policy if exists "anon_delete_students" on public.students;
drop policy if exists "anon_update_students" on public.students;
drop policy if exists "anon_insert_students" on public.students;
drop policy if exists "anon_select_violation_logs" on public.violation_logs;
drop policy if exists "anon_insert_violation_logs" on public.violation_logs;

-- Satu-satunya pengecualian: siswa boleh INSERT violation (tanpa baca)
create policy "anon_insert_violation_logs" on public.violation_logs
  for insert to anon with check (true);

-- ------------------------------------------------------------
-- 3. Buat ulang SEMUA RPC security definer
-- ------------------------------------------------------------
create extension if not exists pgcrypto;

-- Helper autentikasi internal
create or replace function public._auth(p_pin text, p_room text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  select case when rp.room = 'super_admin' then 'admin' else 'proctor' end into v_role
  from public.room_pins rp
  where (rp.room = p_room or rp.room = 'super_admin')
    and rp.pin_hash = crypt(p_pin, rp.pin_hash)
  limit 1;

  if v_role is null then
    perform pg_sleep(1);
    raise exception 'PIN tidak valid';
  end if;
  return v_role;
end $$;

-- Jalur siswa
create or replace function public.check_token(p_nisn text, p_room text, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student record;
  v_token record;
  v_exams jsonb;
begin
  select * into v_student from public.students where nisn = p_nisn;
  if not found then raise exception 'NISN tidak terdaftar'; end if;
  if v_student.room <> p_room then raise exception 'Ruang tidak sesuai dengan data terdaftar'; end if;

  select * into v_token from public.exam_tokens where room = p_room;
  if not found then raise exception 'Belum ada token aktif untuk ruang ini'; end if;
  if v_token.token <> upper(trim(p_token))
     or extract(epoch from (now() - v_token.created_at)) > 17 * 60 then
    raise exception 'Token tidak valid atau telah kadaluarsa';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'subject', e.subject, 'grade', e.grade,
    'duration_minutes', e.duration_minutes
  )), '[]'::jsonb) into v_exams
  from public.exams e
  where e.is_active = true and e.grade = 'Kelas ' || v_student.class;

  return jsonb_build_object('ok', true, 'name', v_student.name, 'class', v_student.class, 'exams', v_exams);
end $$;

grant execute on function public.check_token(text, text, text) to anon;

create or replace function public.open_exam(p_nisn text, p_room text, p_token text, p_exam_id text, p_signature text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student record;
  v_token record;
  v_exam record;
  v_session_id uuid;
begin
  select * into v_student from public.students where nisn = p_nisn;
  if not found then raise exception 'NISN tidak terdaftar'; end if;
  if v_student.room <> p_room then raise exception 'Ruang tidak sesuai'; end if;

  select * into v_token from public.exam_tokens where room = p_room;
  if not found then raise exception 'Belum ada token aktif untuk ruang ini'; end if;
  if v_token.token <> upper(trim(p_token))
     or extract(epoch from (now() - v_token.created_at)) > 17 * 60 then
    raise exception 'Token tidak valid atau telah kadaluarsa';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found or not v_exam.is_active then raise exception 'Naskah soal tidak aktif'; end if;

  insert into public.attendance(nisn, exam_id, room, signature)
  values (p_nisn, p_exam_id, p_room, p_signature)
  on conflict (nisn, exam_id) do update set signature = excluded.signature;

  insert into public.student_sessions(nisn, exam_id, room)
  values (p_nisn, p_exam_id, p_room)
  returning id into v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'pdf_url', v_exam.pdf_url,
    'title', v_exam.title,
    'duration_minutes', v_exam.duration_minutes
  );
end $$;

grant execute on function public.open_exam(text, text, text, text, text) to anon;

create or replace function public.heartbeat(p_session_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.student_sessions set last_seen_at = now() where id = p_session_id;
end $$;

grant execute on function public.heartbeat(uuid) to anon;

-- Jalur panel
create or replace function public.verify_pin(p_pin text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, p_room);
  return jsonb_build_object('ok', true, 'role', v_role);
end $$;

grant execute on function public.verify_pin(text, text) to anon;

create or replace function public.release_token(p_pin text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_role text;
  v_enabled boolean;
  v_token text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i int;
begin
  v_role := public._auth(p_pin, p_room);

  select coalesce((value->>'enabled')::boolean, true) into v_enabled
  from public.app_settings where key = 'token_access_enabled';
  if v_enabled is null then v_enabled := true; end if;

  if not v_enabled and v_role <> 'admin' then
    raise exception 'Akses rilis token sedang dikunci oleh Super Admin';
  end if;

  v_token := '';
  for v_i in 1..6 loop
    v_token := v_token || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;

  insert into public.exam_tokens(room, token) values (p_room, v_token)
  on conflict (room) do update set token = excluded.token, created_at = now();

  return jsonb_build_object('token', v_token, 'created_at', now());
end $$;

grant execute on function public.release_token(text, text) to anon;

create or replace function public.current_token(p_pin text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text; v_t record;
begin
  v_role := public._auth(p_pin, p_room);
  select * into v_t from public.exam_tokens where room = p_room;
  if not found then return jsonb_build_object('token', null, 'created_at', null); end if;
  return jsonb_build_object('token', v_t.token, 'created_at', v_t.created_at);
end $$;

grant execute on function public.current_token(text, text) to anon;

create or replace function public.proctor_dashboard(p_pin text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
  v_attendance jsonb;
  v_violations jsonb;
  v_sessions jsonb;
  v_minutes jsonb;
begin
  v_role := public._auth(p_pin, p_room);

  select coalesce(jsonb_agg(jsonb_build_object(
    'nisn', a.nisn, 'exam_id', a.exam_id, 'room', a.room,
    'signature', a.signature, 'created_at', a.created_at
  )), '[]'::jsonb) into v_attendance
  from public.attendance a where a.room = p_room;

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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ss.id, 'nisn', ss.nisn, 'exam_id', ss.exam_id,
    'room', ss.room, 'started_at', ss.started_at, 'last_seen_at', ss.last_seen_at
  )), '[]'::jsonb) into v_sessions
  from public.student_sessions ss
  where ss.room = p_room and ss.last_seen_at >= now() - interval '6 hours';

  select coalesce((select data::jsonb from public.official_minutes m where m.room = p_room), 'null'::jsonb)
  into v_minutes;

  return jsonb_build_object(
    'attendance', v_attendance,
    'violations', v_violations,
    'sessions', v_sessions,
    'minutes', v_minutes
  );
end $$;

grant execute on function public.proctor_dashboard(text, text) to anon;

create or replace function public.save_minutes(p_pin text, p_room text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, p_room);
  insert into public.official_minutes(room, data) values (p_room, p_data)
  on conflict (room) do update set data = excluded.data, saved_at = now();
  return jsonb_build_object('ok', true, 'room', p_room, 'saved_at', now());
end $$;

grant execute on function public.save_minutes(text, text, jsonb) to anon;

-- Admin
create or replace function public.admin_list_exams(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'subject', e.subject, 'grade', e.grade,
    'duration_minutes', e.duration_minutes, 'pdf_url', e.pdf_url,
    'is_active', e.is_active, 'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb) from public.exams e);
end $$;

grant execute on function public.admin_list_exams(text) to anon;

create or replace function public.admin_upsert_exam(p_pin text, p_exam jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text; v_id text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;

  v_id := coalesce(p_exam->>'id', 'exam-' || floor(extract(epoch from now()) * 1000)::text);

  insert into public.exams(id, title, subject, grade, duration_minutes, pdf_url, file_name, source_type, is_active)
  values (
    v_id, p_exam->>'title', p_exam->>'subject', p_exam->>'grade',
    (p_exam->>'duration_minutes')::int, p_exam->>'pdf_url',
    coalesce(p_exam->>'file_name', 'Naskah_Google_Drive.pdf'),
    coalesce(p_exam->>'source_type', 'gdrive'),
    coalesce((p_exam->>'is_active')::boolean, false)
  )
  on conflict (id) do update set
    title = excluded.title, subject = excluded.subject, grade = excluded.grade,
    duration_minutes = excluded.duration_minutes, pdf_url = excluded.pdf_url,
    file_name = excluded.file_name, source_type = excluded.source_type,
    is_active = excluded.is_active;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

grant execute on function public.admin_upsert_exam(text, jsonb) to anon;

create or replace function public.admin_delete_exam(p_pin text, p_exam_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  delete from public.exams where id = p_exam_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_delete_exam(text, text) to anon;

create or replace function public.admin_set_active_exams(p_pin text, p_exam_ids text[])
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  update public.exams set is_active = (id = any(p_exam_ids));
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_set_active_exams(text, text[]) to anon;

create or replace function public.admin_list_students(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'nisn', s.nisn, 'name', s.name, 'class', s.class, 'room', s.room
  ) order by s.name), '[]'::jsonb) from public.students s);
end $$;

grant execute on function public.admin_list_students(text) to anon;

create or replace function public.admin_add_student(p_pin text, p_nisn text, p_name text, p_class text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  insert into public.students(nisn, name, class, room)
  values (p_nisn, p_name, p_class, p_room)
  on conflict (nisn) do update set name = excluded.name, class = excluded.class, room = excluded.room;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_add_student(text, text, text, text, text) to anon;

create or replace function public.admin_bulk_add_students(p_pin text, p_students jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text; v_s jsonb;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  for v_s in select * from jsonb_array_elements(p_students) loop
    insert into public.students(nisn, name, class, room)
    values (v_s->>'nisn', v_s->>'name', v_s->>'class', v_s->>'room')
    on conflict (nisn) do update set name = excluded.name, class = excluded.class, room = excluded.room;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_bulk_add_students(text, jsonb) to anon;

create or replace function public.admin_delete_student(p_pin text, p_nisn text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  delete from public.students where nisn = p_nisn;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_delete_student(text, text) to anon;

create or replace function public.toggle_token_access(p_pin text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  insert into public.app_settings(key, value) values ('token_access_enabled', jsonb_build_object('enabled', p_enabled))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'enabled', p_enabled);
end $$;

grant execute on function public.toggle_token_access(text, boolean) to anon;

create or replace function public.get_token_access(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text; v_value jsonb;
begin
  v_role := public._auth(p_pin, 'super_admin');
  select value into v_value from public.app_settings where key = 'token_access_enabled';
  if v_value is null then v_value := jsonb_build_object('enabled', true); end if;
  return v_value;
end $$;

grant execute on function public.get_token_access(text) to anon;

create or replace function public.set_room_pin(p_pin text, p_room text, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  if char_length(p_new_pin) < 8 then
    raise exception 'PIN minimal 8 karakter';
  end if;
  insert into public.room_pins(room, pin_hash, updated_at)
  values (p_room, crypt(p_new_pin, gen_salt('bf')), now())
  on conflict (room) do update set pin_hash = excluded.pin_hash, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.set_room_pin(text, text, text) to anon;

-- ------------------------------------------------------------
-- 4. Revoke akses anon ke tabel (jaga-jaga jika ada grant tersisa)
-- ------------------------------------------------------------
revoke all on table public.exams, public.exam_tokens, public.room_pins,
  public.attendance, public.student_sessions, public.official_minutes,
  public.app_settings, public.students, public.violation_logs
  from anon;

-- `_auth` cukup dipanggil internal oleh fungsi security definer;
-- cabut akses langsung dari anon (dilakukan di akhir agar tidak
-- menghentikan pembuatan RPC sebelumnya).
revoke all on function public._auth(text, text) from anon;

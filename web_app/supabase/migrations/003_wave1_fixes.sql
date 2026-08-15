-- ============================================================
-- GELOMBANG 1 — Pengerasan Keamanan (#1, #2, #3)
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Prasyarat: 000_emergency_lockdown.sql, 001_server_authority.sql,
--            001b_rls_force_and_rpc_fix.sql sudah dijalankan.
--
-- Isi file ini (idempoten, aman dijalankan berulang kali):
--   #2  students.secret_code  (faktor kedua selain token+NISN+ruang)
--   #2  attendance tidak bisa ditimpa; 1 sesi aktif per NISN+exam
--   #2  attendance_audit append-only (nisn, exam, room, ip, waktu)
--   #3  panel_sessions (token sesi menggantikan PIN tiap request)
--   #3  pin_attempts (rate-limit global brute-force PIN)
--   #3  set_room_pin diperketat (min 12 karakter, campur, blacklist)
--   #8  heartbeat memvalidasi nisn pemilik sesi
-- ============================================================

create extension if not exists pgcrypto;

-- Buang versi lama yang signature-nya berubah (agar tidak ada dua
-- jalur lama yang masih bisa dieksploitasi).
drop function if exists public.check_token(text, text, text);
drop function if exists public.open_exam(text, text, text, text, text);
drop function if exists public.heartbeat(uuid);

-- ------------------------------------------------------------
-- 1. Tabel baru
-- ------------------------------------------------------------

-- Faktor kedua per siswa, dicetak di kartu peserta (TIDAK dibagikan
-- ke satu ruangan). Wajib di check_token & open_exam.
alter table public.students add column if not exists secret_code text;

-- Sesi panel (proktor/admin) setelah verify_pin. RPC lain menerima
-- token ini, bukan PIN. PIN tidak lagi dikirim ulang tiap 10 detik.
create table if not exists public.panel_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  room text not null,
  role text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Catatan percobaan PIN gagal untuk rate-limit global.
create table if not exists public.pin_attempts (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  ip text,
  at timestamptz not null default now()
);

-- Audit append-only setiap panggilan open_exam.
create table if not exists public.attendance_audit (
  id uuid primary key default gen_random_uuid(),
  nisn text not null,
  exam_id text not null,
  room text not null,
  action text not null,
  ip text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. RLS ketat untuk semua tabel baru
-- ------------------------------------------------------------
alter table public.panel_sessions   enable row level security;
alter table public.panel_sessions   force row level security;
alter table public.pin_attempts     enable row level security;
alter table public.pin_attempts     force row level security;
alter table public.attendance_audit enable row level security;
alter table public.attendance_audit force row level security;

-- Tidak ada policy anon untuk tabel di atas. Hanya RPC security definer.

-- ------------------------------------------------------------
-- 3. Helper internal (tidak boleh dipanggil anon)
-- ------------------------------------------------------------

-- IP klien dari header PostgREST, dengan fallback aman.
create or replace function public._client_ip()
returns text language plpgsql stable as $$
begin
  return coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json
    ->> 'x-forwarded-for';
exception when others then
  return null;
end $$;

-- Kode peserta acak 4 karakter (tanpa huruf ambigu).
create or replace function public._new_secret_code()
returns text language plpgsql volatile as $$
declare
  v_chars constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text := '';
  v_i int;
begin
  for v_i in 1..4 loop
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  end loop;
  return v_code;
end $$;

-- Autentikasi PIN dengan rate-limit global (per-IP + per-ruang).
create or replace function public._auth(p_pin text, p_room text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_role text;
  v_ip text;
  v_ip_recent int;
  v_room_total int;
begin
  v_ip := public._client_ip();

  select count(*) into v_ip_recent from public.pin_attempts
  where room = p_room and ip = v_ip and at > now() - interval '15 minutes';

  select count(*) into v_room_total from public.pin_attempts
  where room = p_room and at > now() - interval '15 minutes';

  if v_ip_recent >= 5 or v_room_total >= 100 then
    raise exception 'Terlalu banyak percobaan PIN. Coba lagi dalam beberapa menit.';
  end if;

  select case when rp.room = 'super_admin' then 'admin' else 'proctor' end into v_role
  from public.room_pins rp
  where (rp.room = p_room or rp.room = 'super_admin')
    and rp.pin_hash = crypt(p_pin, rp.pin_hash)
  limit 1;

  if v_role is null then
    insert into public.pin_attempts(room, ip, at) values (p_room, v_ip, now());
    perform pg_sleep(1);
    raise exception 'PIN tidak valid';
  end if;

  -- Bersihkan jejak gagal IP ini setelah berhasil masuk.
  delete from public.pin_attempts
  where room = p_room and ip = v_ip and at > now() - interval '15 minutes';

  return v_role;
end $$;

-- Validasi token sesi panel.
create or replace function public._auth_session(p_token text)
returns table(o_room text, o_role text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_s record;
begin
  select * into v_s from public.panel_sessions
  where token = p_token and expires_at > now();
  if not found then
    raise exception 'Sesi panel tidak valid atau telah berakhir';
  end if;
  o_room := v_s.room;
  o_role := v_s.role;
  return next;
end $$;

revoke all on function public._client_ip()                 from public, anon, authenticated;
revoke all on function public._new_secret_code()           from public, anon, authenticated;
revoke all on function public._auth(text, text)            from public, anon, authenticated;
revoke all on function public._auth_session(text)          from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Isi secret_code untuk siswa yang sudah ada
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in select nisn from public.students where coalesce(secret_code, '') = '' loop
    update public.students set secret_code = public._new_secret_code()
    where nisn = r.nisn;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. Jalur siswa (#2)
-- ------------------------------------------------------------

create or replace function public.check_token(p_nisn text, p_room text, p_token text, p_secret_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student record;
  v_token record;
  v_exams jsonb;
begin
  select * into v_student from public.students where nisn = p_nisn;
  if not found then
    raise exception 'Data peserta atau token tidak valid';
  end if;

  if v_student.room <> p_room
     or coalesce(v_student.secret_code, '') <> upper(trim(p_secret_code)) then
    raise exception 'Data peserta atau token tidak valid';
  end if;

  select * into v_token from public.exam_tokens where room = p_room;
  if not found then
    raise exception 'Data peserta atau token tidak valid';
  end if;
  if v_token.token <> upper(trim(p_token))
     or extract(epoch from (now() - v_token.created_at)) > 17 * 60 then
    raise exception 'Data peserta atau token tidak valid';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'subject', e.subject, 'grade', e.grade,
    'duration_minutes', e.duration_minutes
  )), '[]'::jsonb) into v_exams
  from public.exams e
  where e.is_active = true and e.grade = 'Kelas ' || v_student.class;

  return jsonb_build_object('ok', true, 'name', v_student.name, 'class', v_student.class, 'exams', v_exams);
end $$;

grant execute on function public.check_token(text, text, text, text) to anon, authenticator;

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

  -- Presensi append-only: TTD tidak bisa ditimpa. Kalau baris sudah ada
  -- (mis. proktor sudah reset sesi untuk HP yang rusak), pakai TTD lama.
  -- Vektor pemalsuan ditutup oleh secret_code + cek 1 sesi aktif di atas.
  insert into public.attendance(nisn, exam_id, room, signature)
  values (p_nisn, p_exam_id, p_room, p_signature)
  on conflict (nisn, exam_id) do nothing;

  insert into public.student_sessions(nisn, exam_id, room)
  values (p_nisn, p_exam_id, p_room)
  returning id into v_session_id;

  v_ip := public._client_ip();
  insert into public.attendance_audit(nisn, exam_id, room, action, ip)
  values (p_nisn, p_exam_id, p_room, 'open_exam', v_ip);

  return jsonb_build_object(
    'session_id', v_session_id,
    'pdf_url', v_exam.pdf_url,
    'title', v_exam.title,
    'duration_minutes', v_exam.duration_minutes
  );
end $$;

grant execute on function public.open_exam(text, text, text, text, text, text) to anon, authenticator;

create or replace function public.heartbeat(p_session_id uuid, p_nisn text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.student_sessions set last_seen_at = now()
  where id = p_session_id and nisn = p_nisn;
  if not found then
    raise exception 'Sesi tidak valid';
  end if;
end $$;

grant execute on function public.heartbeat(uuid, text) to anon, authenticator;

-- ------------------------------------------------------------
-- 5b. Jalur keluar kiosk (#1) — PIN exit via bcrypt, rate-limited
-- ------------------------------------------------------------

insert into public.room_pins(room, pin_hash)
values ('exit', crypt('GANTI-INI-EXIT', gen_salt('bf')))
on conflict (room) do nothing;

create or replace function public.verify_exit_pin(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip text;
  v_recent int;
  v_ok boolean;
begin
  v_ip := public._client_ip();
  select count(*) into v_recent from public.pin_attempts
  where room = 'exit' and ip = v_ip and at > now() - interval '15 minutes';

  if v_recent >= 5 then
    raise exception 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.';
  end if;

  select exists (
    select 1 from public.room_pins
    where room = 'exit' and pin_hash = crypt(p_pin, pin_hash)
  ) into v_ok;

  if not v_ok then
    insert into public.pin_attempts(room, ip, at) values ('exit', v_ip, now());
    perform pg_sleep(1);
    raise exception 'PIN keluar tidak valid';
  end if;

  delete from public.pin_attempts
  where room = 'exit' and ip = v_ip and at > now() - interval '15 minutes';

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.verify_exit_pin(text) to anon, authenticator;

-- ------------------------------------------------------------
-- 6. Jalur panel (#3) — token sesi, bukan PIN tiap request
-- ------------------------------------------------------------

-- Buang versi lama: parameter pertama berubah nama dari p_pin menjadi
-- p_token dengan tipe argumen yang sama, sehingga create or replace
-- akan gagal 42P13 kalau tidak didrop dulu.
drop function if exists public.verify_pin(text, text);
drop function if exists public.release_token(text, text);
drop function if exists public.current_token(text, text);
drop function if exists public.proctor_dashboard(text, text);
drop function if exists public.save_minutes(text, text, jsonb);
drop function if exists public.admin_list_exams(text);
drop function if exists public.admin_upsert_exam(text, jsonb);
drop function if exists public.admin_delete_exam(text, text);
drop function if exists public.admin_set_active_exams(text, text[]);
drop function if exists public.admin_list_students(text);
drop function if exists public.admin_add_student(text, text, text, text, text);
drop function if exists public.admin_bulk_add_students(text, jsonb);
drop function if exists public.admin_delete_student(text, text);
drop function if exists public.toggle_token_access(text, boolean);
drop function if exists public.get_token_access(text);
drop function if exists public.set_room_pin(text, text, text);

create or replace function public.verify_pin(p_pin text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_role text;
  v_token text;
  v_expires timestamptz;
  v_room text;
begin
  v_role := public._auth(p_pin, p_room);
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + interval '8 hours';
  v_room := case when v_role = 'admin' then 'super_admin' else p_room end;

  insert into public.panel_sessions(token, room, role, expires_at)
  values (v_token, v_room, v_role, v_expires);

  return jsonb_build_object('ok', true, 'token', v_token, 'role', v_role, 'expires_at', v_expires);
end $$;

grant execute on function public.verify_pin(text, text) to anon, authenticator;

create or replace function public.logout_panel(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.panel_sessions where token = p_token;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.logout_panel(text) to anon, authenticator;

create or replace function public.release_token(p_token text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_room text;
  v_role text;
  v_enabled boolean;
  v_token text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i int;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);

  if v_role <> 'admin' and v_room <> p_room then
    raise exception 'Sesi proktor tidak cocok dengan ruang ini';
  end if;

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

grant execute on function public.release_token(text, text) to anon, authenticator;

create or replace function public.current_token(p_token text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text; v_t record;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' and v_room <> p_room then
    raise exception 'Sesi proktor tidak cocok dengan ruang ini';
  end if;
  select * into v_t from public.exam_tokens where room = p_room;
  if not found then return jsonb_build_object('token', null, 'created_at', null); end if;
  return jsonb_build_object('token', v_t.token, 'created_at', v_t.created_at);
end $$;

grant execute on function public.current_token(text, text) to anon, authenticator;

create or replace function public.proctor_dashboard(p_token text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
  v_attendance jsonb;
  v_violations jsonb;
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

grant execute on function public.proctor_dashboard(text, text) to anon, authenticator;

create or replace function public.save_minutes(p_token text, p_room text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' and v_room <> p_room then
    raise exception 'Sesi proktor tidak cocok dengan ruang ini';
  end if;
  insert into public.official_minutes(room, data) values (p_room, p_data)
  on conflict (room) do update set data = excluded.data, saved_at = now();
  return jsonb_build_object('ok', true, 'room', p_room, 'saved_at', now());
end $$;

grant execute on function public.save_minutes(text, text, jsonb) to anon, authenticator;

-- Admin: hanya role 'admin'
create or replace function public.admin_list_exams(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'subject', e.subject, 'grade', e.grade,
    'duration_minutes', e.duration_minutes, 'pdf_url', e.pdf_url,
    'is_active', e.is_active, 'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb) from public.exams e);
end $$;

grant execute on function public.admin_list_exams(text) to anon, authenticator;

create or replace function public.admin_upsert_exam(p_token text, p_exam jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text; v_id text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
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

grant execute on function public.admin_upsert_exam(text, jsonb) to anon, authenticator;

create or replace function public.admin_delete_exam(p_token text, p_exam_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  delete from public.exams where id = p_exam_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_delete_exam(text, text) to anon, authenticator;

create or replace function public.admin_set_active_exams(p_token text, p_exam_ids text[])
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  update public.exams set is_active = (id = any(p_exam_ids));
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_set_active_exams(text, text[]) to anon, authenticator;

create or replace function public.admin_list_students(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'nisn', s.nisn, 'name', s.name, 'class', s.class, 'room', s.room,
    'secret_code', s.secret_code
  ) order by s.name), '[]'::jsonb) from public.students s);
end $$;

grant execute on function public.admin_list_students(text) to anon, authenticator;

create or replace function public.admin_add_student(p_token text, p_nisn text, p_name text, p_class text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text; v_code text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;

  v_code := public._new_secret_code();

  insert into public.students(nisn, name, class, room, secret_code)
  values (p_nisn, p_name, p_class, p_room, v_code)
  on conflict (nisn) do update set
    name = excluded.name, class = excluded.class, room = excluded.room;

  return jsonb_build_object('ok', true, 'nisn', p_nisn, 'secret_code', v_code);
end $$;

grant execute on function public.admin_add_student(text, text, text, text, text) to anon, authenticator;

create or replace function public.admin_bulk_add_students(p_token text, p_students jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text; v_s jsonb; v_code text; v_count int := 0;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;

  for v_s in select * from jsonb_array_elements(p_students) loop
    v_code := public._new_secret_code();
    insert into public.students(nisn, name, class, room, secret_code)
    values (v_s->>'nisn', v_s->>'name', v_s->>'class', v_s->>'room', v_code)
    on conflict (nisn) do update set name = excluded.name, class = excluded.class, room = excluded.room;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'count', v_count);
end $$;

grant execute on function public.admin_bulk_add_students(text, jsonb) to anon, authenticator;

create or replace function public.admin_delete_student(p_token text, p_nisn text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  delete from public.students where nisn = p_nisn;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_delete_student(text, text) to anon, authenticator;

create or replace function public.reset_student_session(p_token text, p_nisn text, p_exam_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text; v_sroom text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);

  if v_role <> 'admin' then
    select room into v_sroom from public.students where nisn = p_nisn;
    if v_sroom is null or v_sroom <> v_room then
      raise exception 'Tidak berhak mereset sesi siswa ini';
    end if;
  end if;

  delete from public.student_sessions where nisn = p_nisn and exam_id = p_exam_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.reset_student_session(text, text, text) to anon, authenticator;

create or replace function public.toggle_token_access(p_token text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  insert into public.app_settings(key, value) values ('token_access_enabled', jsonb_build_object('enabled', p_enabled))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'enabled', p_enabled);
end $$;

grant execute on function public.toggle_token_access(text, boolean) to anon, authenticator;

create or replace function public.get_token_access(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text; v_value jsonb;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  select value into v_value from public.app_settings where key = 'token_access_enabled';
  if v_value is null then v_value := jsonb_build_object('enabled', true); end if;
  return v_value;
end $$;

grant execute on function public.get_token_access(text) to anon, authenticator;

create or replace function public.set_room_pin(p_token text, p_room text, p_new_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_room text; v_role text;
begin
  select o_room, o_role into v_room, v_role from public._auth_session(p_token);
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;

  if char_length(p_new_pin) < 12 then
    raise exception 'PIN minimal 12 karakter';
  end if;
  if p_new_pin !~ '[A-Za-z]' or p_new_pin !~ '[0-9]' then
    raise exception 'PIN harus campur huruf dan angka';
  end if;
  if p_new_pin ~* '^(20[0-9]{6}|[0-9]{8}|12345678|aadcm12345|smpthhk|thhk|ruang[0-9]+)' then
    raise exception 'PIN terlalu mudah ditebak';
  end if;

  insert into public.room_pins(room, pin_hash, updated_at)
  values (p_room, crypt(p_new_pin, gen_salt('bf')), now())
  on conflict (room) do update set pin_hash = excluded.pin_hash, updated_at = now();

  return jsonb_build_object('ok', true, 'room', p_room);
end $$;

grant execute on function public.set_room_pin(text, text, text) to anon, authenticator;

-- ------------------------------------------------------------
-- 6. Revoke akses anon ke tabel baru & lama (jaga-jaga)
-- ------------------------------------------------------------
revoke all on table public.panel_sessions, public.pin_attempts, public.attendance_audit from anon, authenticated;
revoke all on table public.exams, public.exam_tokens, public.room_pins,
  public.attendance, public.student_sessions, public.official_minutes,
  public.app_settings, public.students, public.violation_logs
  from anon;

-- ============================================================
-- FASE 1 — Server Menjadi Otoritas
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query
--
-- Semua keputusan keamanan pindah ke Postgres lewat fungsi
-- security definer. Klien menjadi "bodoh": hanya bertanya dan
-- menampilkan. Anon key yang ter-bundle di JS publik tidak lagi
-- bisa membaca apa pun yang sensitif.
--
-- Prasyarat: 000_emergency_lockdown.sql sudah dijalankan.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Skema baru
-- ------------------------------------------------------------

-- exam_sessions dipakai untuk dua hal yang berbeda (bank soal + sesi
-- siswa). Pisahkan: bank soal jadi `exams`, sesi siswa pindah ke tabel
-- sendiri. Jatuhkan kolom integritas dari bank soal.
alter table public.exam_sessions rename to exams;
alter table public.exams drop column if exists last_seen_at;
alter table public.exams drop column if exists violations_count;
alter table public.exams drop column if exists status;
alter table public.exams add column if not exists is_active boolean not null default false;

-- Token aktif per ruang (rotasi 15 menit, server yang generate)
create table if not exists public.exam_tokens (
  id uuid primary key default gen_random_uuid(),
  room text not null unique,
  token text not null,
  created_at timestamptz not null default now()
);

-- PIN per ruang + super admin, ter-hash bcrypt
create table if not exists public.room_pins (
  room text primary key, -- 'Ruang 1'..'Ruang 3', 'super_admin'
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

-- Presensi + TTD siswa
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  nisn text not null,
  exam_id text not null,
  room text not null,
  signature text not null, -- dataURL PNG
  created_at timestamptz not null default now(),
  unique (nisn, exam_id)
);

-- Sesi live siswa (pengganti heartbeat di exam_sessions)
create table if not exists public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  nisn text not null,
  exam_id text not null,
  room text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Berita acara per ruang
create table if not exists public.official_minutes (
  id uuid primary key default gen_random_uuid(),
  room text not null unique,
  data jsonb not null,
  saved_at timestamptz not null default now()
);

-- Saklar master (mis. token_access_enabled)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS aktif untuk semua; JANGAN buat policy anon apa pun.
-- Tanpa policy = anon tidak bisa apa-apa kecuali lewat RPC security definer.
alter table public.exams enable row level security;
alter table public.exam_tokens enable row level security;
alter table public.room_pins enable row level security;
alter table public.attendance enable row level security;
alter table public.student_sessions enable row level security;
alter table public.official_minutes enable row level security;
alter table public.app_settings enable row level security;

-- Satu-satunya pengecualian: violation_logs mempertahankan insert-only
-- (siswa perlu bisa melapor), tanpa hak baca.
alter table public.violation_logs enable row level security;
drop policy if exists "anon_insert_violation_logs" on public.violation_logs;
create policy "anon_insert_violation_logs" on public.violation_logs
  for insert to anon with check (true);

-- Siswa boleh di-select oleh RPC security definer saja; cabut akses anon langsung.
drop policy if exists "anon_select_students" on public.students;

-- Isi awal PIN — WAJIB diganti sebelum dipakai ujian sungguhan (min 8 karakter).
insert into public.room_pins(room, pin_hash) values
  ('Ruang 1',     crypt('GANTI-INI-1', gen_salt('bf'))),
  ('Ruang 2',     crypt('GANTI-INI-2', gen_salt('bf'))),
  ('Ruang 3',     crypt('GANTI-INI-3', gen_salt('bf'))),
  ('super_admin', crypt('GANTI-INI-SA', gen_salt('bf')))
on conflict (room) do nothing;

-- ------------------------------------------------------------
-- 2. Helper autentikasi internal
-- ------------------------------------------------------------

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
    -- throttle sederhana: ~1 percobaan/detik. Sengaja TIDAK memakai
    -- lockout (mengunci = celah DoS terhadap proktor di tengah ujian).
    perform pg_sleep(1);
    raise exception 'PIN tidak valid';
  end if;
  return v_role;
end $$;

revoke all on function public._auth(text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. RPC — jalur siswa
-- ------------------------------------------------------------

create or replace function public.check_token(p_nisn text, p_room text, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student record;
  v_token record;
  v_exams jsonb;
begin
  -- NISN ada di students
  select * into v_student from public.students where nisn = p_nisn;
  if not found then
    raise exception 'NISN tidak terdaftar';
  end if;

  -- room cocok
  if v_student.room <> p_room then
    raise exception 'Ruang tidak sesuai dengan data terdaftar';
  end if;

  -- token aktif untuk ruang itu, usia <= 17 menit (15 + grace 2)
  select * into v_token from public.exam_tokens where room = p_room;
  if not found then
    raise exception 'Belum ada token aktif untuk ruang ini';
  end if;
  if v_token.token <> upper(trim(p_token))
     or extract(epoch from (now() - v_token.created_at)) > 17 * 60 then
    raise exception 'Token tidak valid atau telah kadaluarsa';
  end if;

  -- daftar soal aktif yang cocok dengan kelas siswa, TANPA pdf_url.
  -- grade di exams disimpan 'Kelas 7'/'Kelas 8'/'Kelas 9'; class siswa '7'/'8'/'9'.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'subject', e.subject,
    'grade', e.grade,
    'duration_minutes', e.duration_minutes
  )), '[]'::jsonb) into v_exams
  from public.exams e
  where e.is_active = true
    and e.grade = 'Kelas ' || v_student.class;

  return jsonb_build_object(
    'ok', true,
    'name', v_student.name,
    'class', v_student.class,
    'exams', v_exams
  );
end $$;

grant execute on function public.check_token(text, text, text) to anon, authenticator;

create or replace function public.open_exam(p_nisn text, p_room text, p_token text, p_exam_id text, p_signature text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student record;
  v_token record;
  v_exam record;
  v_session_id uuid;
begin
  -- Revalidasi semuanya (jangan percaya check_token sudah dipanggil)
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

  -- satu transaksi: presensi + sesi
  insert into public.attendance(nisn, exam_id, room, signature)
  values (p_nisn, p_exam_id, p_room, p_signature)
  on conflict (nisn, exam_id) do update set signature = excluded.signature;

  insert into public.student_sessions(nisn, exam_id, room)
  values (p_nisn, p_exam_id, p_room)
  returning id into v_session_id;

  -- SATU-SATUNYA jalan keluar pdf_url
  return jsonb_build_object(
    'session_id', v_session_id,
    'pdf_url', v_exam.pdf_url,
    'title', v_exam.title,
    'duration_minutes', v_exam.duration_minutes
  );
end $$;

grant execute on function public.open_exam(text, text, text, text, text) to anon, authenticator;

create or replace function public.heartbeat(p_session_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.student_sessions set last_seen_at = now() where id = p_session_id;
end $$;

grant execute on function public.heartbeat(uuid) to anon, authenticator;

-- ------------------------------------------------------------
-- 4. RPC — jalur proktor & admin
-- ------------------------------------------------------------

create or replace function public.verify_pin(p_pin text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, p_room);
  return jsonb_build_object('ok', true, 'role', v_role);
end $$;

grant execute on function public.verify_pin(text, text) to anon, authenticator;

-- Generate token 6 karakter di server, alfabet sama dengan
-- tokenRotationManager.js:9 (tanpa O/0/I/1)
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
  if v_role <> 'proctor' and v_role <> 'admin' then
    raise exception 'Tidak berhak merilis token';
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

create or replace function public.current_token(p_pin text, p_room text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text; v_t record;
begin
  v_role := public._auth(p_pin, p_room);
  select * into v_t from public.exam_tokens where room = p_room;
  if not found then
    return jsonb_build_object('token', null, 'created_at', null);
  end if;
  return jsonb_build_object('token', v_t.token, 'created_at', v_t.created_at);
end $$;

grant execute on function public.current_token(text, text) to anon, authenticator;

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

grant execute on function public.proctor_dashboard(text, text) to anon, authenticator;

create or replace function public.save_minutes(p_pin text, p_room text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, p_room);
  insert into public.official_minutes(room, data) values (p_room, p_data)
  on conflict (room) do update set data = excluded.data, saved_at = now();
  return jsonb_build_object('ok', true, 'room', p_room, 'saved_at', now());
end $$;

grant execute on function public.save_minutes(text, text, jsonb) to anon, authenticator;

-- Admin: hanya role 'admin' (super_admin) yang boleh lewat
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

grant execute on function public.admin_list_exams(text) to anon, authenticator;

create or replace function public.admin_upsert_exam(p_pin text, p_exam jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text; v_id text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;

  v_id := coalesce(p_exam->>'id', 'exam-' || floor(extract(epoch from now()) * 1000)::text);

  insert into public.exams(id, title, subject, grade, duration_minutes, pdf_url, file_name, source_type, is_active)
  values (
    v_id,
    p_exam->>'title',
    p_exam->>'subject',
    p_exam->>'grade',
    (p_exam->>'duration_minutes')::int,
    p_exam->>'pdf_url',
    coalesce(p_exam->>'file_name', 'Naskah_Google_Drive.pdf'),
    coalesce(p_exam->>'source_type', 'gdrive'),
    coalesce((p_exam->>'is_active')::boolean, false)
  )
  on conflict (id) do update set
    title = excluded.title,
    subject = excluded.subject,
    grade = excluded.grade,
    duration_minutes = excluded.duration_minutes,
    pdf_url = excluded.pdf_url,
    file_name = excluded.file_name,
    source_type = excluded.source_type,
    is_active = excluded.is_active;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

grant execute on function public.admin_upsert_exam(text, jsonb) to anon, authenticator;

create or replace function public.admin_delete_exam(p_pin text, p_exam_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  delete from public.exams where id = p_exam_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_delete_exam(text, text) to anon, authenticator;

create or replace function public.admin_set_active_exams(p_pin text, p_exam_ids text[])
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  update public.exams set is_active = (id = any(p_exam_ids));
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_set_active_exams(text, text[]) to anon, authenticator;

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

grant execute on function public.admin_list_students(text) to anon, authenticator;

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

grant execute on function public.admin_add_student(text, text, text, text, text) to anon, authenticator;

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

grant execute on function public.admin_bulk_add_students(text, jsonb) to anon, authenticator;

create or replace function public.admin_delete_student(p_pin text, p_nisn text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  v_role := public._auth(p_pin, 'super_admin');
  if v_role <> 'admin' then raise exception 'Khusus Super Admin'; end if;
  delete from public.students where nisn = p_nisn;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_delete_student(text, text) to anon, authenticator;

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

grant execute on function public.toggle_token_access(text, boolean) to anon, authenticator;

create or replace function public.get_token_access(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_role text; v_value jsonb;
begin
  v_role := public._auth(p_pin, 'super_admin');
  select value into v_value from public.app_settings where key = 'token_access_enabled';
  if v_value is null then v_value := jsonb_build_object('enabled', true); end if;
  return v_value;
end $$;

grant execute on function public.get_token_access(text) to anon, authenticator;

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

grant execute on function public.set_room_pin(text, text, text) to anon, authenticator;

-- ------------------------------------------------------------
-- 5. Pembersihan
-- ------------------------------------------------------------
-- Hapus policy sisa dari skema lama pada tabel yang sudah direname.
drop policy if exists "anon_select_exam_sessions" on public.exams;
drop policy if exists "anon_update_exam_sessions" on public.exams;
drop policy if exists "anon_insert_exam_sessions" on public.exams;

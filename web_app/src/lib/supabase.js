import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Tanpa kredensial = aplikasi TIDAK jalan. Tidak ada fallback localStorage:
// fallback itulah akar kebocoran (klien memutuskan semua gerbang sendiri).
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-supabase-project'));

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum di-set. Aplikasi tidak dapat berjalan.');
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================
// JALUR SISWA (security definer di server)
// ============================================================

// Validasi NISN + ruang + token. Kembalikan { ok, name, class, exams[] }.
// exams TANPA pdf_url. pdf_url hanya keluar lewat open_exam.
export const checkToken = async ({ nisn, room, token }) => {
  const { data, error } = await supabase.rpc('check_token', {
    p_nisn: nisn,
    p_room: room,
    p_token: token,
  });
  if (error) throw error;
  return data;
};

// Buka naskah: revalidasi token, catat presensi + TTD, buat sesi.
// SATU-SATUNYA jalan keluar pdf_url.
export const openExam = async ({ nisn, room, token, examId, signature }) => {
  const { data, error } = await supabase.rpc('open_exam', {
    p_nisn: nisn,
    p_room: room,
    p_token: token,
    p_exam_id: examId,
    p_signature: signature,
  });
  if (error) throw error;
  return data; // { session_id, pdf_url, title, duration_minutes }
};

// Heartbeat sesi siswa
export const heartbeat = async (sessionId) => {
  const { error } = await supabase.rpc('heartbeat', { p_session_id: sessionId });
  if (error) throw error;
};

// ============================================================
// JALUR PROKTOR & ADMIN
// ============================================================

export const verifyPin = async ({ pin, room }) => {
  const { data, error } = await supabase.rpc('verify_pin', { p_pin: pin, p_room: room });
  if (error) throw error;
  return data; // { ok, role: 'admin' | 'proctor' }
};

export const releaseToken = async ({ pin, room }) => {
  const { data, error } = await supabase.rpc('release_token', { p_pin: pin, p_room: room });
  if (error) throw error;
  return data; // { token, created_at }
};

export const currentToken = async ({ pin, room }) => {
  const { data, error } = await supabase.rpc('current_token', { p_pin: pin, p_room: room });
  if (error) throw error;
  return data; // { token, created_at } | { token: null }
};

export const proctorDashboard = async ({ pin, room }) => {
  const { data, error } = await supabase.rpc('proctor_dashboard', { p_pin: pin, p_room: room });
  if (error) throw error;
  return data; // { attendance[], violations[], sessions[], minutes }
};

export const saveMinutes = async ({ pin, room, data }) => {
  const res = await supabase.rpc('save_minutes', { p_pin: pin, p_room: room, p_data: data });
  if (res.error) throw res.error;
  return res.data;
};

// ---- Admin (role harus 'admin') ----

export const adminListExams = async (pin) => {
  const { data, error } = await supabase.rpc('admin_list_exams', { p_pin: pin });
  if (error) throw error;
  return data;
};

export const adminUpsertExam = async (pin, exam) => {
  const { data, error } = await supabase.rpc('admin_upsert_exam', { p_pin: pin, p_exam: exam });
  if (error) throw error;
  return data;
};

export const adminDeleteExam = async (pin, examId) => {
  const { data, error } = await supabase.rpc('admin_delete_exam', { p_pin: pin, p_exam_id: examId });
  if (error) throw error;
  return data;
};

export const adminSetActiveExams = async (pin, examIds) => {
  const { data, error } = await supabase.rpc('admin_set_active_exams', { p_pin: pin, p_exam_ids: examIds });
  if (error) throw error;
  return data;
};

export const adminListStudents = async (pin) => {
  const { data, error } = await supabase.rpc('admin_list_students', { p_pin: pin });
  if (error) throw error;
  return data;
};

export const adminAddStudent = async (pin, student) => {
  const { data, error } = await supabase.rpc('admin_add_student', {
    p_pin: pin,
    p_nisn: student.nisn,
    p_name: student.name,
    p_class: student.class,
    p_room: student.room,
  });
  if (error) throw error;
  return data;
};

export const adminBulkAddStudents = async (pin, students) => {
  const { data, error } = await supabase.rpc('admin_bulk_add_students', { p_pin: pin, p_students: students });
  if (error) throw error;
  return data;
};

export const adminDeleteStudent = async (pin, nisn) => {
  const { data, error } = await supabase.rpc('admin_delete_student', { p_pin: pin, p_nisn: nisn });
  if (error) throw error;
  return data;
};

export const toggleTokenAccess = async (pin, enabled) => {
  const { data, error } = await supabase.rpc('toggle_token_access', { p_pin: pin, p_enabled: enabled });
  if (error) throw error;
  return data;
};

export const getTokenAccess = async (pin) => {
  const { data, error } = await supabase.rpc('get_token_access', { p_pin: pin });
  if (error) throw error;
  return data; // { enabled }
};

export const setRoomPin = async (pin, room, newPin) => {
  const { data, error } = await supabase.rpc('set_room_pin', { p_pin: pin, p_room: room, p_new_pin: newPin });
  if (error) throw error;
  return data;
};

// ============================================================
// Sesi aktif siswa (untuk heartbeat & violation) — state ringan
// ============================================================

const LOCAL_STORAGE_ACTIVE_SESSION_KEY = 'thhk_active_session';

export const saveActiveSession = (session) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (e) {
    console.error("Failed to save active session", e);
    return null;
  }
};

export const getActiveSession = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_ACTIVE_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const clearActiveSession = () => {
  try {
    localStorage.removeItem(LOCAL_STORAGE_ACTIVE_SESSION_KEY);
  } catch (e) {}
};

// ============================================================
// Log pelanggaran — buffer lokal + kirim ke server (insert-only)
// ============================================================

const LOCAL_STORAGE_VIOLATION_LOG_KEY = 'thhk_violation_log';

export const appendViolation = async (type, detail = '') => {
  const session = getActiveSession();
  const entry = {
    id: `viol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId: session?.sessionId || null,
    studentId: session?.studentId || session?.nisn || null,
    type,
    detail,
    at: Date.now(),
  };
  try {
    const log = getViolations();
    log.push(entry);
    localStorage.setItem(LOCAL_STORAGE_VIOLATION_LOG_KEY, JSON.stringify(log.slice(-500)));
  } catch (e) {
    console.error("Failed to append violation locally", e);
  }
  // Best-effort kirim ke server (insert-only policy anon)
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('violation_logs')
        .insert([{ session_id: entry.sessionId, student_id: entry.studentId, type, detail, created_at: new Date(entry.at).toISOString() }]);
    } catch (err) {
      console.error("Failed to sync violation to Supabase", err);
    }
  }
  return entry;
};

export const getViolations = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_VIOLATION_LOG_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

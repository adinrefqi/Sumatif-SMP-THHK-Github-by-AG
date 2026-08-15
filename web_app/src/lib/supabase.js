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

// Validasi NISN + ruang + token + kode peserta. Kembalikan { ok, name, class, exams[] }.
// exams TANPA pdf_url. pdf_url hanya keluar lewat open_exam.
export const checkToken = async ({ nisn, room, token, secretCode }) => {
  const { data, error } = await supabase.rpc('check_token', {
    p_nisn: nisn,
    p_room: room,
    p_token: token,
    p_secret_code: secretCode,
  });
  if (error) throw error;
  return data;
};

// Buka naskah: revalidasi token + kode peserta, catat presensi + TTD, buat sesi.
// TIDAK lagi mengembalikan pdf_url — PDF diambil lewat Edge Function `exam-pdf`.
export const openExam = async ({ nisn, room, token, examId, signature, secretCode }) => {
  const { data, error } = await supabase.rpc('open_exam', {
    p_nisn: nisn,
    p_room: room,
    p_token: token,
    p_exam_id: examId,
    p_signature: signature,
    p_secret_code: secretCode,
  });
  if (error) throw error;
  return data; // { session_id, title, duration_minutes, expires_at }
};

// URL proxy PDF naskah (Edge Function). Klien hanya menyimpan session_id,
// bukan link Google Drive.
export const examPdfUrl = ({ sessionId }) => {
  const params = new URLSearchParams({ session_id: sessionId });
  return `${supabaseUrl}/functions/v1/smooth-api?${params.toString()}`;
};

// Heartbeat sesi siswa — validasi nisn pemilik sesi di server.
export const heartbeat = async (sessionId, nisn) => {
  const { error } = await supabase.rpc('heartbeat', { p_session_id: sessionId, p_nisn: nisn });
  if (error) throw error;
};

// ============================================================
// JALUR PROKTOR & ADMIN — token sesi, bukan PIN tiap request
// ============================================================

// Tukar PIN sekali dengan token sesi (8 jam). PIN tidak lagi dikirim ulang.
export const verifyPin = async ({ pin, room }) => {
  const { data, error } = await supabase.rpc('verify_pin', { p_pin: pin, p_room: room });
  if (error) throw error;
  return data; // { ok, token, role: 'admin' | 'proctor', expires_at }
};

export const logoutPanel = async (token) => {
  const { error } = await supabase.rpc('logout_panel', { p_token: token });
  if (error) throw error;
};

export const releaseToken = async ({ token, room }) => {
  const { data, error } = await supabase.rpc('release_token', { p_token: token, p_room: room });
  if (error) throw error;
  return data; // { token, created_at }
};

export const currentToken = async ({ token, room }) => {
  const { data, error } = await supabase.rpc('current_token', { p_token: token, p_room: room });
  if (error) throw error;
  return data; // { token, created_at } | { token: null }
};

export const proctorDashboard = async ({ token, room }) => {
  const { data, error } = await supabase.rpc('proctor_dashboard', { p_token: token, p_room: room });
  if (error) throw error;
  return data; // { attendance[], violations[], sessions[], minutes }
};

export const saveMinutes = async ({ token, room, data }) => {
  const res = await supabase.rpc('save_minutes', { p_token: token, p_room: room, p_data: data });
  if (res.error) throw res.error;
  return res.data;
};

// ---- Admin (role harus 'admin') ----

export const adminListExams = async (token) => {
  const { data, error } = await supabase.rpc('admin_list_exams', { p_token: token });
  if (error) throw error;
  return data;
};

export const adminUpsertExam = async (token, exam) => {
  const { data, error } = await supabase.rpc('admin_upsert_exam', { p_token: token, p_exam: exam });
  if (error) throw error;
  return data;
};

export const adminDeleteExam = async (token, examId) => {
  const { data, error } = await supabase.rpc('admin_delete_exam', { p_token: token, p_exam_id: examId });
  if (error) throw error;
  return data;
};

export const adminSetActiveExams = async (token, examIds) => {
  const { data, error } = await supabase.rpc('admin_set_active_exams', { p_token: token, p_exam_ids: examIds });
  if (error) throw error;
  return data;
};

export const adminListStudents = async (token) => {
  const { data, error } = await supabase.rpc('admin_list_students', { p_token: token });
  if (error) throw error;
  return data;
};

export const adminAddStudent = async (token, student) => {
  const { data, error } = await supabase.rpc('admin_add_student', {
    p_token: token,
    p_nisn: student.nisn,
    p_name: student.name,
    p_class: student.class,
    p_room: student.room,
  });
  if (error) throw error;
  return data;
};

export const adminBulkAddStudents = async (token, students) => {
  const { data, error } = await supabase.rpc('admin_bulk_add_students', { p_token: token, p_students: students });
  if (error) throw error;
  return data;
};

export const adminDeleteStudent = async (token, nisn) => {
  const { data, error } = await supabase.rpc('admin_delete_student', { p_token: token, p_nisn: nisn });
  if (error) throw error;
  return data;
};

export const resetStudentSession = async (token, nisn, examId) => {
  const { data, error } = await supabase.rpc('reset_student_session', {
    p_token: token,
    p_nisn: nisn,
    p_exam_id: examId,
  });
  if (error) throw error;
  return data;
};

export const toggleTokenAccess = async (token, enabled) => {
  const { data, error } = await supabase.rpc('toggle_token_access', { p_token: token, p_enabled: enabled });
  if (error) throw error;
  return data;
};

export const getTokenAccess = async (token) => {
  const { data, error } = await supabase.rpc('get_token_access', { p_token: token });
  if (error) throw error;
  return data; // { enabled }
};

export const setRoomPin = async (token, room, newPin) => {
  const { data, error } = await supabase.rpc('set_room_pin', { p_token: token, p_room: room, p_new_pin: newPin });
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
  // Best-effort kirim ke server lewat RPC (identitas diambil server dari session_id).
  if (isSupabaseConfigured && entry.sessionId) {
    try {
      await supabase.rpc('log_violation', {
        p_session_id: entry.sessionId,
        p_type: type,
        p_detail: detail,
      });
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

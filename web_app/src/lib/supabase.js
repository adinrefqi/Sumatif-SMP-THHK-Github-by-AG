import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-supabase-project'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// LocalStorage Fallback Helper when Supabase credentials are not yet configured in local environment
const LOCAL_STORAGE_EXAMS_KEY = 'thhk_exams_db';
const LOCAL_STORAGE_TOKENS_KEY = 'thhk_token_active';
const LOCAL_STORAGE_PREVIOUS_TOKEN_KEY = 'thhk_token_previous';
const LOCAL_STORAGE_ATTENDANCE_KEY = 'thhk_attendance_records';
const LOCAL_STORAGE_OFFICIAL_MINUTES_KEY = 'thhk_official_minutes';
const LOCAL_STORAGE_TOKEN_ACCESS_KEY = 'thhk_token_access_enabled';
const LOCAL_STORAGE_ACTIVE_SESSION_KEY = 'thhk_active_session';
const LOCAL_STORAGE_VIOLATION_LOG_KEY = 'thhk_violation_log';
const LOCAL_STORAGE_LAST_HEARTBEAT_KEY = 'thhk_last_heartbeat';
const LOCAL_STORAGE_STUDENTS_KEY = 'thhk_students_cache';

export const localExamStore = {
  getExams: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_EXAMS_KEY);
      return data ? JSON.parse(data) : [
        {
          id: 'demo-exam-1',
          title: 'Sumatif Akhir Semester Bahasa Indonesia Kelas VIII',
          subject: 'Bahasa Indonesia',
          grade: 'Kelas 8',
          duration_minutes: 90,
          pdf_url: null, // fallback sample
          current_token: 'AB12CD',
          token_created_at: Date.now()
        }
      ];
    } catch {
      return [];
    }
  },
  saveExams: (exams) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_EXAMS_KEY, JSON.stringify(exams));
    } catch (e) {
      console.error("Failed to save to local storage", e);
    }
  },
  deleteExam: (examId) => {
    try {
      const exams = localExamStore.getExams();
      const filtered = exams.filter(e => e.id !== examId);
      localExamStore.saveExams(filtered);
      return filtered;
    } catch (e) {
      console.error("Failed to delete exam", e);
      return localExamStore.getExams();
    }
  },
  getActiveExamIds: () => {
    try {
      const data = localStorage.getItem('thhk_active_exam_ids');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    const exams = localExamStore.getExams();
    return exams.length > 0 ? [exams[0].id] : [];
  },
  setActiveExamIds: (examIds) => {
    try {
      localStorage.setItem('thhk_active_exam_ids', JSON.stringify(examIds));
      return examIds;
    } catch {
      return examIds;
    }
  },
  toggleActiveExamId: (examId) => {
    const current = localExamStore.getActiveExamIds();
    let updated;
    if (current.includes(examId)) {
      // Don't allow unchecking if it's the only one left
      if (current.length > 1) {
        updated = current.filter(id => id !== examId);
      } else {
        updated = current;
      }
    } else {
      updated = [...current, examId];
    }
    localExamStore.setActiveExamIds(updated);
    return updated;
  },
  getActiveExams: () => {
    const allExams = localExamStore.getExams();
    const activeIds = localExamStore.getActiveExamIds();
    const activeList = allExams.filter(e => activeIds.includes(e.id));
    return activeList.length > 0 ? activeList : allExams.slice(0, 1);
  },
  getActiveToken: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_TOKENS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Check 15-min expiration (900,000 ms)
        if (Date.now() - parsed.timestamp < 15 * 60 * 1000) {
          return parsed;
        }
      }
    } catch (e) { }
    // No valid token stored
    return null;
  },
  getPreviousToken: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_PREVIOUS_TOKEN_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Keep previous token available for up to 15min + 2min grace period
        if (Date.now() - parsed.timestamp < 17 * 60 * 1000) {
          return parsed;
        }
      }
    } catch (e) { }
    return null;
  },
  setActiveToken: (tokenString) => {
    const currentToken = localExamStore.getActiveToken();
    const previousToken = localExamStore.getPreviousToken();

    // Move current active token to previous before storing the new one
    if (currentToken && currentToken.token) {
      localStorage.setItem(LOCAL_STORAGE_PREVIOUS_TOKEN_KEY, JSON.stringify(currentToken));
    } else if (previousToken) {
      // If no current token but previous exists, preserve the previous one
      localStorage.setItem(LOCAL_STORAGE_PREVIOUS_TOKEN_KEY, JSON.stringify(previousToken));
    }

    const payload = { token: tokenString.toUpperCase(), timestamp: Date.now() };
    localStorage.setItem(LOCAL_STORAGE_TOKENS_KEY, JSON.stringify(payload));
    return payload;
  },
  // Student Attendance Records & Signatures
  getAttendanceRecords: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveAttendanceRecord: (record) => {
    try {
      const records = localExamStore.getAttendanceRecords();
      const newRecords = [record, ...records.filter(r => r.nisn !== record.nisn)];
      localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(newRecords));
      return newRecords;
    } catch (e) {
      console.error("Failed to save attendance record", e);
      return [];
    }
  },
  // Proctor Official Minutes (Berita Acara)
  getOfficialMinutes: (roomKey) => {
    try {
      const key = roomKey ? `thhk_official_minutes_${roomKey.replace(/\s+/g, '_').toLowerCase()}` : LOCAL_STORAGE_OFFICIAL_MINUTES_KEY;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  saveOfficialMinutes: (minutesData, roomKey) => {
    try {
      const payload = { ...minutesData, savedAt: new Date().toISOString() };
      const key = roomKey ? `thhk_official_minutes_${roomKey.replace(/\s+/g, '_').toLowerCase()}` : LOCAL_STORAGE_OFFICIAL_MINUTES_KEY;
      localStorage.setItem(key, JSON.stringify(payload));
      // also set global as fallback
      localStorage.setItem(LOCAL_STORAGE_OFFICIAL_MINUTES_KEY, JSON.stringify(payload));
      return payload;
    } catch (e) {
      console.error("Failed to save official minutes", e);
      return null;
    }
  },
  // Master Token Access Control (Controlled by Super Admin)
  isTokenAccessEnabled: () => {
    try {
      const value = localStorage.getItem(LOCAL_STORAGE_TOKEN_ACCESS_KEY);
      return value !== null ? JSON.parse(value) : true; // Default enabled
    } catch {
      return true;
    }
  },
  setTokenAccessEnabled: (isEnabled) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_TOKEN_ACCESS_KEY, JSON.stringify(Boolean(isEnabled)));
      return Boolean(isEnabled);
    } catch {
      return true;
    }
  },
  // Active Exam Session (identity for heartbeat & violation logging)
  saveActiveSession: (session) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_SESSION_KEY, JSON.stringify(session));
      return session;
    } catch (e) {
      console.error("Failed to save active session", e);
      return null;
    }
  },
  getActiveSession: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_ACTIVE_SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  clearActiveSession: () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_SESSION_KEY);
    } catch (e) {}
  },
  // Violation Log
  getViolations: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_VIOLATION_LOG_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  appendViolation: (type, detail = '') => {
    const session = localExamStore.getActiveSession();
    const entry = {
      id: `viol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId: session?.sessionId || null,
      studentId: session?.studentId || session?.nisn || null,
      type,
      detail,
      at: Date.now(),
    };
    try {
      const log = localExamStore.getViolations();
      log.push(entry);
      // Cap log size (e.g. 500 entries) to avoid unbounded growth
      localStorage.setItem(LOCAL_STORAGE_VIOLATION_LOG_KEY, JSON.stringify(log.slice(-500)));
    } catch (e) {
      console.error("Failed to append violation", e);
    }
    // Best-effort remote log when Supabase is configured
    if (isSupabaseConfigured) {
      supabase
        .from('violation_logs')
        .insert([{ session_id: entry.sessionId, student_id: entry.studentId, type, detail, created_at: new Date(entry.at).toISOString() }])
        .then(() => {})
        .catch((err) => console.error("Failed to sync violation to Supabase", err));
    }
    return entry;
  },
  clearViolations: () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_VIOLATION_LOG_KEY);
    } catch (e) {}
  },
  // Heartbeat
  touchLastHeartbeat: () => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LAST_HEARTBEAT_KEY, JSON.stringify({ at: Date.now() }));
    } catch (e) {}
  },
  getLastHeartbeat: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_LAST_HEARTBEAT_KEY);
      return data ? JSON.parse(data).at : null;
    } catch {
      return null;
    }
  },
  // Remote "last seen" sync (optional, Supabase only)
  touchLastSeenRemote: async (sessionId) => {
    if (!isSupabaseConfigured || !sessionId) return;
    try {
      await supabase
        .from('exam_sessions')
        .upsert({ id: sessionId, last_seen_at: new Date().toISOString() }, { onConflict: 'id' });
    } catch (err) {
      console.error("Failed to sync last_seen to Supabase", err);
    }
  },
  // Students cache (localStorage fallback)
  getStudentsCache: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_STUDENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  setStudentsCache: (students) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY, JSON.stringify(students));
    } catch (e) {
      console.error("Failed to cache students", e);
    }
  }
};

// ---- Remote Supabase queries (cross-device proctor monitoring) ----

// Fetch violations from the last N minutes (default 3 hours)
export const fetchViolations = async (sinceMinutes = 180) => {
  if (!isSupabaseConfigured) return [];
  try {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('violation_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Failed to fetch violations", err);
    return [];
  }
};

// Fetch active exam sessions (for online/offline status via last_seen_at)
export const fetchLiveSessions = async () => {
  if (!isSupabaseConfigured) return [];
  try {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('exam_sessions')
      .select('*')
      .gte('last_seen_at', since)
      .order('last_seen_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Failed to fetch live sessions", err);
    return [];
  }
};

// ---- Student roster (Supabase) ----

// Fetch full student roster, cache to localStorage
export const fetchStudents = async () => {
  if (!isSupabaseConfigured) return localExamStore.getStudentsCache();
  try {
    const { data, error } = await supabase
      .from('students')
      .select('nisn, name, class, room')
      .order('name', { ascending: true });
    if (error) throw error;
    const list = data || [];
    localExamStore.setStudentsCache(list);
    return list;
  } catch (err) {
    console.error("Failed to fetch students", err);
    return localExamStore.getStudentsCache();
  }
};

// Look up a single student by NISN (for login validation)
export const getStudentByNisn = async (nisn) => {
  if (!isSupabaseConfigured) {
    const cached = localExamStore.getStudentsCache();
    return cached.find(s => s.nisn === nisn) || null;
  }
  try {
    const { data, error } = await supabase
      .from('students')
      .select('nisn, name, class, room')
      .eq('nisn', nisn)
      .limit(1);
    if (error) throw error;
    return (data && data[0]) || null;
  } catch (err) {
    console.error("Failed to get student", err);
    const cached = localExamStore.getStudentsCache();
    return cached.find(s => s.nisn === nisn) || null;
  }
};

// Add a single student (upsert on nisn)
export const addStudent = async (student) => {
  if (!isSupabaseConfigured) {
    const cache = localExamStore.getStudentsCache();
    const filtered = cache.filter(s => s.nisn !== student.nisn);
    localExamStore.setStudentsCache([...filtered, student]);
    return true;
  }
  try {
    const { error } = await supabase
      .from('students')
      .upsert([student], { onConflict: 'nisn' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to add student", err);
    return false;
  }
};

// Add many students at once (CSV import), skipping duplicates
export const bulkAddStudents = async (students) => {
  if (!isSupabaseConfigured) {
    const cache = localExamStore.getStudentsCache();
    const seen = new Set(cache.map(s => s.nisn));
    const merged = [...cache];
    students.forEach(s => {
      if (!seen.has(s.nisn)) {
        merged.push(s);
        seen.add(s.nisn);
      }
    });
    localExamStore.setStudentsCache(merged);
    return { added: students.length };
  }
  try {
    // Upsert all; Supabase handles duplicates via primary key (nisn)
    const { error } = await supabase
      .from('students')
      .upsert(students, { onConflict: 'nisn' });
    if (error) throw error;
    return { added: students.length };
  } catch (err) {
    console.error("Failed to bulk add students", err);
    return { added: 0, error: err.message };
  }
};

// Delete a student by nisn
export const deleteStudent = async (nisn) => {
  if (!isSupabaseConfigured) {
    const cache = localExamStore.getStudentsCache();
    localExamStore.setStudentsCache(cache.filter(s => s.nisn !== nisn));
    return true;
  }
  try {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('nisn', nisn);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Failed to delete student", err);
    return false;
  }
};
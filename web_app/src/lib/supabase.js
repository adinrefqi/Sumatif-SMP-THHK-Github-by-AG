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
  getOfficialMinutes: () => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_OFFICIAL_MINUTES_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  saveOfficialMinutes: (minutesData) => {
    try {
      const payload = { ...minutesData, savedAt: new Date().toISOString() };
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
  }
};
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
  }
};
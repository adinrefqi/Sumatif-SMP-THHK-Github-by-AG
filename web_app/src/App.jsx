import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PdfUploader from './components/admin/PdfUploader';
import ProctorTokenMonitor from './components/admin/ProctorTokenMonitor';

import StudentTokenScreen from './components/viewer/StudentTokenScreen';
import MobilePdfViewer from './components/viewer/MobilePdfViewer';
import ExamTimerHeader from './components/viewer/ExamTimerHeader';
import OfflineFallbackModal from './components/viewer/OfflineFallbackModal';
import { localExamStore } from './lib/supabase';
import { Lock } from 'lucide-react';

export default function App() {
  const [activeMode, setActiveMode] = useState('student'); // 'student' | 'admin'
  const [activeTokenObj, setActiveTokenObj] = useState(localExamStore.getActiveToken());
  const [studentSession, setStudentSession] = useState(null); // null if not logged in
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [adminAuthPin, setAdminAuthPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [activeExam, setActiveExam] = useState(localExamStore.getExams()[0]);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      if (studentSession) setShowOfflineModal(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [studentSession]);

  // Anti-Copy & Anti-ContextMenu Security Lock inside WebView
  useEffect(() => {
    const disableCopy = (e) => e.preventDefault();
    const disableContextMenu = (e) => e.preventDefault();

    document.addEventListener('copy', disableCopy);
    document.addEventListener('contextmenu', disableContextMenu);

    return () => {
      document.removeEventListener('copy', disableCopy);
      document.removeEventListener('contextmenu', disableContextMenu);
    };
  }, []);

  const handleExitApp = () => {
    // Call Android Native Bridge (flutter_inappwebview callHandler) if available
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
      window.flutter_inappwebview.callHandler('ExambrowserBridge', 'exit');
    } else if (window.ExambrowserBridge && window.ExambrowserBridge.showExitPasswordDialog) {
      window.ExambrowserBridge.showExitPasswordDialog();
    } else {
      const pin = window.prompt('Masukkan Password Admin Keamanan untuk Keluar (Default: 12345):');
      if (pin === '12345') {
        alert('Password Benar. Keluar dari Aplikasi Exambrowser.');
        setStudentSession(null);
      } else if (pin) {
        alert('Password Salah!');
      }
    }
  };

  const handleAdminPinSubmit = (e) => {
    e.preventDefault();
    if (adminAuthPin === '12345' || adminAuthPin === 'admin' || adminAuthPin === 'THHK2026') {
      setIsAdminAuthenticated(true);
    } else {
      alert('PIN Admin Salah! (Default PIN: 12345)');
    }
  };

  return (
    <div className="min-h-screen bg-console-bg text-ink flex flex-col">
      <Navbar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        isOnline={isOnline}
        onExitApp={handleExitApp}
      />

      <main className="flex-1">
        {/* MODE SISWA */}
        {activeMode === 'student' && (
          <>
            {!studentSession ? (
              <StudentTokenScreen
                activeTokenObj={activeTokenObj}
                activeExam={activeExam}
                onTokenValidated={(session) => setStudentSession(session)}
              />
            ) : (
              <div className="flex flex-col h-[calc(100vh-56px)]">
                <ExamTimerHeader
                  studentInfo={studentSession}
                  activeExam={activeExam}
                  onRequestHelp={() => console.log('Proctor Help Requested')}
                />
                <MobilePdfViewer pdfUrl={activeExam?.pdf_url} />
              </div>
            )}
          </>
        )}

        {/* MODE PROKTOR / ADMIN */}
        {activeMode === 'admin' && (
          <div className="max-w-7xl mx-auto p-4 md:p-6">
            {!isAdminAuthenticated ? (
              <div className="min-h-[70vh] flex items-center justify-center">
                <div className="w-full max-w-sm animate-fadeUp">
                  <div className="mb-6 text-center">
                    <div className="w-12 h-12 bg-accent/10 border border-accent/25 text-accent rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="font-extrabold text-xl text-ink-strong tracking-tight">
                      Otorisasi Panel Proktor
                    </h3>
                    <p className="text-xs text-ink-muted mt-1.5">
                      Masukkan PIN keamanan untuk membuka manajemen token dan unggah soal.
                    </p>
                  </div>

                  <form
                    onSubmit={handleAdminPinSubmit}
                    className="bg-console-panel border border-console-line rounded-xl p-5 space-y-3 shadow-panel"
                  >
                    <input
                      type="password"
                      required
                      value={adminAuthPin}
                      onChange={(e) => setAdminAuthPin(e.target.value)}
                      placeholder="PIN Admin (Default: 12345)"
                      className="w-full px-4 py-2.5 bg-console-faint border border-console-line rounded-lg text-center font-mono font-bold text-lg text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg font-extrabold text-[11px] uppercase tracking-widest rounded-lg transition-colors"
                    >
                      Buka Panel Proktor
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fadeUp">
                <ProctorTokenMonitor
                  activeTokenObj={activeTokenObj}
                  onTokenUpdate={(updatedObj) => setActiveTokenObj(updatedObj)}
                />
                <PdfUploader
                  onExamCreated={(newExam) => setActiveExam(newExam)}
                />

              </div>
            )}
          </div>
        )}
      </main>

      <OfflineFallbackModal
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
      />
    </div>
  );
}

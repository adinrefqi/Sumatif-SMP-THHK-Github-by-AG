import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PdfUploader from './components/admin/PdfUploader';
import ProctorTokenMonitor from './components/admin/ProctorTokenMonitor';
import LjkPrinter from './components/admin/LjkPrinter';
import StudentTokenScreen from './components/viewer/StudentTokenScreen';
import MobilePdfViewer from './components/viewer/MobilePdfViewer';
import ExamTimerHeader from './components/viewer/ExamTimerHeader';
import OfflineFallbackModal from './components/viewer/OfflineFallbackModal';
import { localExamStore } from './lib/supabase';
import { ShieldAlert, KeyRound, CheckCircle2, Lock } from 'lucide-react';

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
    // Call Android Native Bridge if available
    if (window.ExambrowserBridge && window.ExambrowserBridge.showExitPasswordDialog) {
      window.ExambrowserBridge.showExitPasswordDialog();
    } else {
      const pin = prompt('Masukkan Password Admin Keamanan untuk Keluar (Default: 12345):');
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
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
              <div className="max-w-md mx-auto my-12 bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-center">
                <div className="w-12 h-12 bg-anbk-blue/10 text-anbk-blue rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-anbk-blue" />
                </div>
                <h3 className="font-extrabold text-lg text-gray-900 mb-1">
                  Otorisasi Panel Proktor Ujian
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Masukkan PIN Keamanan Admin untuk membuka ruang manajemen token & unggah soal.
                </p>

                <form onSubmit={handleAdminPinSubmit} className="space-y-3">
                  <input
                    type="password"
                    required
                    value={adminAuthPin}
                    onChange={(e) => setAdminAuthPin(e.target.value)}
                    placeholder="Masukkan PIN Admin (Default: 12345)"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-center font-mono font-bold text-lg focus:ring-2 focus:ring-anbk-blue outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-anbk-blue hover:bg-anbk-darkBlue text-white font-bold text-sm rounded-xl shadow transition"
                  >
                    Buka Panel Proktor
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <ProctorTokenMonitor
                  activeTokenObj={activeTokenObj}
                  onTokenUpdate={(updatedObj) => setActiveTokenObj(updatedObj)}
                />
                <PdfUploader
                  onExamCreated={(newExam) => setActiveExam(newExam)}
                />
                <LjkPrinter />
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

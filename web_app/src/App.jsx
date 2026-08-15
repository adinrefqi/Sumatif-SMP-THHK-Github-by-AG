import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PdfUploader from './components/admin/PdfUploader';
import ProctorTokenMonitor from './components/admin/ProctorTokenMonitor';
import StudentManager from './components/admin/StudentManager';

import StudentTokenScreen from './components/viewer/StudentTokenScreen';
import MobilePdfViewer from './components/viewer/MobilePdfViewer';
import ExamTimerHeader from './components/viewer/ExamTimerHeader';
import OfflineFallbackModal from './components/viewer/OfflineFallbackModal';
import { getActiveSession, appendViolation, clearActiveSession, verifyPin, logoutPanel } from './lib/supabase';
import { Lock, ShieldCheck, UserCheck } from 'lucide-react';

export default function App() {
  const [activeMode, setActiveMode] = useState('student'); // 'student' | 'admin'
  const [studentSession, setStudentSession] = useState(null); // null if not logged in
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const [adminAuthPin, setAdminAuthPin] = useState('');
  const [adminToken, setAdminToken] = useState(null); // token sesi panel (bukan PIN)
  const [proctorRoomInput, setProctorRoomInput] = useState('Ruang 1');
  const [activeProctorRoom, setActiveProctorRoom] = useState('Ruang 1');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false); // true: Super Admin, false: Proctor
  const [adminError, setAdminError] = useState('');

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
    const disableCopy = (e) => {
      e.preventDefault();
      if (getActiveSession()) {
        appendViolation('copy');
      }
    };
    const disableContextMenu = (e) => {
      e.preventDefault();
      if (getActiveSession()) {
        appendViolation('contextmenu');
      }
    };

    document.addEventListener('copy', disableCopy);
    document.addEventListener('contextmenu', disableContextMenu);

    return () => {
      document.removeEventListener('copy', disableCopy);
      document.removeEventListener('contextmenu', disableContextMenu);
    };
  }, []);

  // Violation listeners: track tab switching / window blur while exam is active
  useEffect(() => {
    if (!studentSession) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        appendViolation('visibility_hidden');
        if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
          window.flutter_inappwebview
            .callHandler('ExambrowserBridge', 'violation', { type: 'visibility_hidden' })
            .catch(() => {});
        }
      }
    };
    const onBlur = () => {
      appendViolation('blur');
      if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview
          .callHandler('ExambrowserBridge', 'violation', { type: 'blur' })
          .catch(() => {});
      }
    };
    const onBeforeUnload = () => {
      appendViolation('beforeunload');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [studentSession]);

  const handleExitApp = () => {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
      window.flutter_inappwebview.callHandler('ExambrowserBridge', 'exit');
    } else if (window.ExambrowserBridge && window.ExambrowserBridge.showExitPasswordDialog) {
      window.ExambrowserBridge.showExitPasswordDialog();
    } else {
      // Tanpa wrapper native, browser biasa: tidak ada jalur keluar khusus.
      // PIN keluar dikelola native (tidak ada nilai literal di repo).
      alert('Keluar dari aplikasi dikelola oleh aplikasi Exambrowser.');
    }
  };

  const handleAdminPinSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');
    const trimmedPin = adminAuthPin.trim();
    if (!trimmedPin) return;

    try {
      const res = await verifyPin({ pin: trimmedPin, room: proctorRoomInput });
      if (res?.ok && res?.token) {
        setIsAdminAuthenticated(true);
        setIsAdminRole(res.role === 'admin');
        // Simpan token sesi di state (bukan PIN, bukan localStorage)
        setAdminToken(res.token);
        setActiveProctorRoom(proctorRoomInput);
        setAdminAuthPin('');
      } else {
        setAdminError('PIN Salah!');
      }
    } catch (err) {
      setAdminError(`PIN Salah! ${err.message || ''}`.trim());
    }
  };

  const handleLogout = async () => {
    const token = adminToken;
    setIsAdminAuthenticated(false);
    setIsAdminRole(false);
    setAdminToken(null);
    setAdminAuthPin('');
    if (token) {
      try { await logoutPanel(token); } catch (e) {}
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
              <StudentTokenScreen onTokenValidated={(session) => setStudentSession(session)} />
            ) : (
              <div className="flex flex-col h-[calc(100vh-56px)]">
                <ExamTimerHeader studentInfo={studentSession} activeExam={studentSession?.exam} />
                <MobilePdfViewer pdfUrl={studentSession?.exam?.pdf_url} />
              </div>
            )}
          </>
        )}

        {/* MODE PROKTOR / SUPER ADMIN */}
        {activeMode === 'admin' && (
          <div className="max-w-7xl mx-auto p-4 md:p-6">
            {!isAdminAuthenticated ? (
              <div className="min-h-[70vh] flex items-center justify-center">
                <div className="w-full max-w-sm animate-fadeUp">
                  <div className="mb-6 text-center">
                    <img
                      src="/logo.png"
                      alt="Logo SMP THHK Tegal"
                      className="w-16 h-16 mx-auto mb-3 object-contain drop-shadow"
                    />
                    <h3 className="font-extrabold text-xl text-ink-strong tracking-tight">
                      Otorisasi Panel Proktor & Super Admin
                    </h3>
                    <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                      SMP THHK TEGAL • Masukkan PIN Proktor Ruangan atau PIN Super Admin
                    </p>
                  </div>

                  <form
                    onSubmit={handleAdminPinSubmit}
                    className="bg-console-panel border border-console-line rounded-xl p-5 space-y-3 shadow-panel"
                  >
                    {adminError && (
                      <div className="p-3 bg-bad/10 border border-bad/25 text-bad text-xs font-semibold rounded-lg">
                        {adminError}
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5">
                        Pilih Ruang Ujian (Khusus Proktor)
                      </label>
                      <select
                        value={proctorRoomInput}
                        onChange={(e) => setProctorRoomInput(e.target.value)}
                        className="w-full px-3.5 py-2 bg-console-faint border border-console-line rounded-lg text-xs font-extrabold text-accent outline-none mb-2"
                      >
                        <option value="Ruang 1">Ruang 1</option>
                        <option value="Ruang 2">Ruang 2</option>
                        <option value="Ruang 3">Ruang 3</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5">
                        PIN Otorisasi *
                      </label>
                      <input
                        type="password"
                        required
                        value={adminAuthPin}
                        onChange={(e) => setAdminAuthPin(e.target.value)}
                        placeholder="PIN Ruang / PIN Super Admin"
                        className="w-full px-4 py-2.5 bg-console-faint border border-console-line rounded-lg text-center font-mono font-bold text-lg text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg font-extrabold text-[11px] uppercase tracking-widest rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:outline-none"
                    >
                      Masuk Otorisasi Panel
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fadeUp">

                {/* Mode Role Header Badge */}
                <div className="flex items-center justify-between bg-console-panel border border-console-line rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isAdminRole ? (
                      <ShieldCheck className="w-5 h-5 text-accent" />
                    ) : (
                      <UserCheck className="w-5 h-5 text-ok" />
                    )}
                    <div>
                      <h4 className="font-extrabold text-xs text-ink-strong uppercase tracking-wider">
                        {isAdminRole ? 'SUPER ADMIN PANEL (MANAJEMEN UTAMA)' : `PANEL PROKTOR - ${activeProctorRoom}`}
                      </h4>
                      <p className="text-[10px] text-ink-muted">
                        {isAdminRole
                          ? 'Akses penuh input Link Google Drive & kontrol saklar token 3 ruangan'
                          : `Sesi pengawasan khusus ${activeProctorRoom} (Wajib Berita Acara)`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="text-[10px] font-bold uppercase tracking-wider text-bad border border-bad/30 hover:bg-bad/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Keluar Admin
                  </button>
                </div>

                {/* SUPER ADMIN COMPONENT */}
                {isAdminRole && adminToken && (
                  <>
                    <StudentManager adminToken={adminToken} />
                    <PdfUploader adminToken={adminToken} />
                  </>
                )}

                {/* PROCTOR & MONITOR COMPONENT */}
                {adminToken && (
                  <ProctorTokenMonitor
                    adminToken={adminToken}
                    isAdminRole={isAdminRole}
                    proctorRoom={activeProctorRoom}
                  />
                )}

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

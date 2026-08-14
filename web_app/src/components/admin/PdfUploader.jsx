import React, { useState, useEffect } from 'react';
import {
  UploadCloud, CheckCircle2, AlertCircle,
  Lock, Unlock, ShieldAlert, Eye, X, Smartphone, CheckCheck,
  Trash2, Check, FolderKanban
} from 'lucide-react';
import {
  adminUpsertExam, adminDeleteExam, adminListExams, adminSetActiveExams,
  toggleTokenAccess, getTokenAccess
} from '../../lib/supabase';
import MobilePdfViewer from '../viewer/MobilePdfViewer';

export default function PdfUploader({ adminPin }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Bahasa Indonesia');
  const [grade, setGrade] = useState('Kelas 8');
  const [duration, setDuration] = useState(90);
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);

  // Modal Preview Inspector
  const [showPdfCheckModal, setShowPdfCheckModal] = useState(false);
  const [testPdfUrl, setTestPdfUrl] = useState(null);

  // Exam List State (dari server)
  const [savedExams, setSavedExams] = useState([]);
  const [activeExamIds, setActiveExamIds] = useState([]);
  const [isTokenAccessEnabled, setIsTokenAccessEnabled] = useState(true);
  const [loadError, setLoadError] = useState('');

  const reloadExams = async () => {
    try {
      const list = await adminListExams(adminPin);
      const exams = Array.isArray(list) ? list : [];
      setSavedExams(exams);
      setActiveExamIds(exams.filter(e => e.is_active).map(e => e.id));
      return exams;
    } catch (err) {
      setLoadError(`Gagal memuat bank soal: ${err.message || 'Terjadi kesalahan'}`);
      return [];
    }
  };

  useEffect(() => {
    reloadExams();
    getTokenAccess(adminPin)
      .then((res) => {
        if (res && typeof res.enabled === 'boolean') setIsTokenAccessEnabled(res.enabled);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPin]);

  const convertGDriveUrl = (urlStr) => {
    if (!urlStr) return '';
    try {
      const fileIdMatch = urlStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || urlStr.match(/id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
      }
    } catch { }
    return urlStr;
  };

  // Single Submit (Google Drive link only) -> server
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!gdriveUrl.trim()) {
      setMessage({ type: 'error', text: 'Silakan masukkan URL/Link Google Drive Naskah Soal' });
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setLoadError('');

    try {
      const finalPdfUrl = convertGDriveUrl(gdriveUrl.trim());
      const fileName = 'Naskah_Google_Drive.pdf';

      const newExam = {
        title: title || 'Sumatif Ujian PDF',
        subject,
        grade,
        duration_minutes: Number(duration),
        pdf_url: finalPdfUrl,
        file_name: fileName,
        source_type: 'gdrive',
        is_active: true, // langsung aktif saat diterbitkan
      };

      const res = await adminUpsertExam(adminPin, newExam);
      const createdId = res?.id;

      // Aktifkan ujian ini di server (set aktif semua, termasuk yang baru)
      const current = await reloadExams();
      const ids = [...new Set([...current.map(x => x.id).filter(id => activeExamIds.includes(id)), createdId].filter(Boolean))];
      await adminSetActiveExams(adminPin, ids);
      await reloadExams();

      setMessage({ type: 'success', text: 'Naskah soal berhasil diterbitkan & disinkronkan ke sistem.' });
      setGdriveUrl('');
      setTitle('');
    } catch (err) {
      console.error('Upload Error:', err);
      setMessage({ type: 'error', text: `Gagal menerbitkan: ${err.message || 'Terjadi kesalahan'}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenPdfCheck = (urlOverride) => {
    let urlToTest = urlOverride || null;
    if (!urlToTest) {
      if (gdriveUrl.trim()) {
        urlToTest = convertGDriveUrl(gdriveUrl.trim());
      } else {
        urlToTest = savedExams[0]?.pdf_url || null;
      }
    }
    setTestPdfUrl(urlToTest);
    setShowPdfCheckModal(true);
  };

  const handleDeleteExam = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus naskah soal ini dari Bank Soal Master?')) {
      try {
        await adminDeleteExam(adminPin, id);
        await reloadExams();
      } catch (err) {
        setMessage({ type: 'error', text: `Gagal menghapus: ${err.message || 'Terjadi kesalahan'}` });
      }
    }
  };

  const handleToggleActiveExamId = async (examId) => {
    const next = activeExamIds.includes(examId)
      ? activeExamIds.filter(id => id !== examId)
      : [...activeExamIds, examId];
    try {
      await adminSetActiveExams(adminPin, next);
      setActiveExamIds(next);
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal mengubah status aktif: ${err.message || 'Terjadi kesalahan'}` });
    }
  };

  const handleToggleTokenAccess = async () => {
    try {
      const next = !isTokenAccessEnabled;
      await toggleTokenAccess(adminPin, next);
      setIsTokenAccessEnabled(next);
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal mengubah saklar token: ${err.message || 'Terjadi kesalahan'}` });
    }
  };

  const labelCls = 'block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5';
  const inputCls =
    'w-full px-3.5 py-2.5 bg-console-faint border border-console-line rounded-lg text-sm text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition';

  return (
    <div className="space-y-6">

      {/* Super Admin Control Card: Master Token Release Switch */}
      <div className="bg-console-panel border border-console-line rounded-xl p-5 shadow-panel flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            isTokenAccessEnabled
              ? 'bg-ok/10 border-ok/30 text-ok'
              : 'bg-bad/10 border-bad/30 text-bad'
          }`}>
            {isTokenAccessEnabled ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-ink-strong">
                Gerbang Rilis Token Proktor
              </h3>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-accent/10 border border-accent/25 text-accent rounded-md">
                Super Admin Master Control
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {isTokenAccessEnabled
                ? 'Status: TERBUKA — Proktor diizinkan merilis token di ruang ujian.'
                : 'Status: TERKUNCI — Tombol rilis token di panel Proktor dinonaktifkan.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleTokenAccess}
          className={`px-4 py-2.5 rounded-lg font-extrabold text-xs uppercase tracking-wider border transition-colors flex items-center gap-2 ${
            isTokenAccessEnabled
              ? 'bg-bad/15 border-bad/40 text-bad hover:bg-bad/25'
              : 'bg-ok/15 border-ok/40 text-ok hover:bg-ok/25'
          }`}
        >
          {isTokenAccessEnabled ? (
            <>
              <Lock className="w-4 h-4" />
              <span>Kunci Akses Token</span>
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" />
              <span>Buka Akses Token Proktor</span>
            </>
          )}
        </button>
      </div>

      {loadError && (
        <div className="p-3.5 bg-bad/10 border border-bad/30 rounded-xl text-bad text-xs font-semibold">
          {loadError}
        </div>
      )}

      {/* Main Upload Form Card */}
      <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-console-line pb-3 mb-5 gap-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-extrabold text-ink-strong text-sm tracking-tight">
                Manajemen & Upload Naskah Soal (Super Admin)
              </h2>
              <p className="text-[11px] text-ink-muted">
                Terbitkan naskah soal ujian via Link Google Drive
              </p>
            </div>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-xs font-semibold flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-ok/10 text-ok border-ok/25'
              : 'bg-bad/10 text-bad border-bad/25'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* MODE: GDRIVE LINK */}
        <form onSubmit={handleSingleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Judul Ujian Sumatif *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Sumatif Akhir Semester Bahasa Indonesia"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Mata Pelajaran</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputCls}
              >
                <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                <option value="Matematika">Matematika</option>
                <option value="Bahasa Inggris">Bahasa Inggris</option>
                <option value="IPA (Ilmu Pengetahuan Alam)">IPA (Ilmu Pengetahuan Alam)</option>
                <option value="IPS (Ilmu Pengetahuan Sosial)">IPS (Ilmu Pengetahuan Sosial)</option>
                <option value="Pancasila / PPKn">Pancasila / PPKn</option>
                <option value="Pendidikan Agama">Pendidikan Agama</option>
                <option value="Informatika">Informatika</option>
                <option value="Seni & Budaya">Seni & Budaya</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Tingkat Kelas</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className={inputCls}
              >
                <option value="Kelas 7">Kelas VII (7)</option>
                <option value="Kelas 8">Kelas VIII (8)</option>
                <option value="Kelas 9">Kelas IX (9)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Durasi Ujian (Menit)</label>
              <input
                type="number"
                min="15"
                max="240"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>URL / Link Share Google Drive Document *</label>
            <div className="relative">
              <input
                type="url"
                required
                value={gdriveUrl}
                onChange={(e) => setGdriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/1A2B3C.../view?usp=sharing"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-ink-faint mt-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-accent" />
              <span>Pastikan izin akses dokumen di Google Drive diatur ke: <strong>"Siapa saja yang memiliki link"</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 py-2.5 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isUploading ? (
                <span>Menerbitkan Naskah Soal...</span>
              ) : (
                <span>Terbitkan Soal & Aktifkan Sesi Ujian</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOpenPdfCheck()}
              className="px-4 py-2.5 bg-console-raised hover:bg-console-line border border-console-line text-ink font-bold rounded-lg text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4 text-accent" />
              <span>Uji Tampilan</span>
            </button>
          </div>
        </form>
      </div>

      {/* MASTER EXAM BANK SECTION (Daftar Bank Soal Master) */}
      <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-console-line pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-accent" />
            <h3 className="font-extrabold text-ink-strong text-sm tracking-tight">
              Bank Soal Master Ujian ({savedExams.length} Naskah Terbit)
            </h3>
          </div>
          <span className="text-[11px] text-ink-faint font-mono">
            Sesi Aktif ({activeExamIds.length} Soal): <strong className="text-accent">{savedExams.filter(e => e.is_active).map(e => e.subject).join(', ') || 'Belum Dipilih'}</strong>
          </span>
        </div>

        {savedExams.length === 0 ? (
          <p className="text-xs text-ink-muted italic py-4 text-center">Belum ada naskah soal terbit di Bank Soal Master.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedExams.map((ex) => {
              const isActive = activeExamIds.includes(ex.id);
              return (
                <div
                  key={ex.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    isActive
                      ? 'bg-accent/10 border-accent/50 shadow-md'
                      : 'bg-console-raised border-console-line hover:border-console-line/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="px-2 py-0.5 bg-console-bg border border-console-line text-accent font-bold text-[10px] rounded uppercase font-mono">
                        {ex.grade || 'Kelas 8'} • {ex.subject || 'Mapel'}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 bg-ok/15 border border-ok/30 text-ok font-extrabold text-[9px] rounded uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>SESI AKTIF</span>
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-xs text-ink-strong line-clamp-2 leading-snug">
                      {ex.title}
                    </h4>
                    <p className="text-[10px] text-ink-faint font-mono mt-1">
                      Durasi: {ex.duration_minutes} Menit • File: {ex.file_name || 'Dokumen.pdf'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-console-line text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleActiveExamId(ex.id)}
                      className={`px-2.5 py-1 text-[10px] uppercase font-extrabold tracking-wider rounded transition-colors flex items-center gap-1 ${
                        isActive
                          ? 'bg-ok/20 text-ok border border-ok/40 hover:bg-bad/20 hover:text-bad hover:border-bad/40'
                          : 'bg-accent hover:bg-accent-soft text-console-bg'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Nonaktifkan</span>
                        </>
                      ) : (
                        <span>Aktifkan Ujian Ini</span>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenPdfCheck(ex.pdf_url)}
                        className="p-1.5 bg-console-bg border border-console-line text-ink-muted hover:text-accent rounded transition-colors"
                        title="Uji Pratinjau Tampilan PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteExam(ex.id)}
                        className="p-1.5 bg-console-bg border border-console-line text-ink-muted hover:text-bad rounded transition-colors"
                        title="Hapus dari Bank Soal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SUPER ADMIN PDF PREVIEW & READABILITY CHECK MODAL */}
      {showPdfCheckModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fadeUp">
          <div className="bg-console-panel border border-console-line rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl">

            {/* Modal Top Header */}
            <div className="bg-console-raised px-4 py-3 border-b border-console-line flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-ink-strong tracking-tight flex items-center gap-2">
                    <span>Uji Keterbacaan Naskah Soal (Super Admin Inspector)</span>
                    <span className="px-2 py-0.5 bg-ok/10 text-ok border border-ok/25 text-[9px] uppercase font-bold rounded">
                      Mobile Preview Mode
                    </span>
                  </h3>
                  <p className="text-[11px] text-ink-muted">
                    Memastikan naskah soal terbaca jelas di layar HP/Tablet siswa.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPdfCheckModal(false)}
                className="w-8 h-8 rounded-lg bg-console-bg hover:bg-bad/20 border border-console-line hover:border-bad/40 text-ink-muted hover:text-bad flex items-center justify-center transition-colors"
                title="Tutup Pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Preview Container */}
            <div className="flex-1 bg-console-bg p-3 md:p-4 overflow-hidden flex flex-col justify-center">
              <div className="w-full h-full max-w-3xl mx-auto border border-console-line rounded-xl overflow-hidden shadow-2xl flex flex-col">
                <MobilePdfViewer pdfUrl={testPdfUrl} />
              </div>
            </div>

            {/* Modal Bottom Bar */}
            <div className="bg-console-raised px-4 py-3 border-t border-console-line flex items-center justify-between text-xs">
              <span className="text-ink-muted flex items-center gap-1.5">
                <CheckCheck className="w-4 h-4 text-ok" />
                <span>Jika dokumen terlihat jelas, Anda dapat aman merilis akses token kepada Proktor.</span>
              </span>

              <button
                onClick={() => setShowPdfCheckModal(false)}
                className="px-4 py-1.5 bg-accent hover:bg-accent-soft text-console-bg font-extrabold uppercase text-[11px] tracking-wider rounded-lg transition-colors"
              >
                Selesai Memeriksa
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

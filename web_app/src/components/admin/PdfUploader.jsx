import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Link as LinkIcon, Lock, Unlock, ShieldAlert, Eye, X, Smartphone, CheckCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured, localExamStore } from '../../lib/supabase';
import MobilePdfViewer from '../viewer/MobilePdfViewer';

export default function PdfUploader({ onExamCreated, isTokenAccessEnabled, onToggleTokenAccess }) {
  const [sourceType, setSourceType] = useState('file'); // 'file' | 'gdrive'
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Bahasa Indonesia');
  const [grade, setGrade] = useState('Kelas 8');
  const [duration, setDuration] = useState(90);
  const [pdfFile, setPdfFile] = useState(null);
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showPdfCheckModal, setShowPdfCheckModal] = useState(false);
  const [testPdfUrl, setTestPdfUrl] = useState(null);

  const convertGDriveUrl = (urlStr) => {
    if (!urlStr) return '';
    try {
      // Matches /file/d/FILE_ID or id=FILE_ID
      const fileIdMatch = urlStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || urlStr.match(/id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
      }
    } catch { }
    return urlStr;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setMessage(null);
      if (!title) {
        const cleanName = file.name.replace('.pdf', '').replace(/_/g, ' ');
        setTitle(`Sumatif ${cleanName}`);
      }
    } else {
      setMessage({ type: 'error', text: 'Format file harus berupa PDF (.pdf)' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sourceType === 'file' && !pdfFile && !title) {
      setMessage({ type: 'error', text: 'Silakan isi judul ujian dan pilih file PDF naskah soal' });
      return;
    }

    if (sourceType === 'gdrive' && !gdriveUrl.trim()) {
      setMessage({ type: 'error', text: 'Silakan masukkan URL/Link Google Drive Naskah Soal' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      let finalPdfUrl = null;
      let fileName = 'Naskah_Soal.pdf';

      if (sourceType === 'gdrive') {
        finalPdfUrl = convertGDriveUrl(gdriveUrl.trim());
        fileName = 'Naskah_Google_Drive.pdf';
      } else if (isSupabaseConfigured && pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileNameGen = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `exam_pdfs/${fileNameGen}`;

        const { error: uploadError } = await supabase.storage
          .from('exam-pdfs')
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('exam-pdfs')
          .getPublicUrl(filePath);

        finalPdfUrl = publicUrlData.publicUrl;
        fileName = pdfFile.name;
      } else if (pdfFile) {
        finalPdfUrl = URL.createObjectURL(pdfFile);
        fileName = pdfFile.name;
      }

      const newExam = {
        id: `exam-${Date.now()}`,
        title: title || 'Sumatif Ujian PDF',
        subject,
        grade,
        duration_minutes: Number(duration),
        pdf_url: finalPdfUrl,
        file_name: fileName,
        source_type: sourceType,
        created_at: new Date().toISOString()
      };

      if (isSupabaseConfigured) {
        const { error: dbError } = await supabase
          .from('exam_sessions')
          .insert([newExam]);

        if (dbError) throw dbError;
      } else {
        const existingExams = localExamStore.getExams();
        localExamStore.saveExams([newExam, ...existingExams]);
      }

      setMessage({ type: 'success', text: 'Naskah soal PDF berhasil diterbitkan & disinkronkan ke sistem.' });
      setPdfFile(null);
      setGdriveUrl('');
      setTitle('');

      if (onExamCreated) {
        onExamCreated(newExam);
      }
    } catch (err) {
      console.error('Upload Error:', err);
      setMessage({ type: 'error', text: `Gagal mengunggah: ${err.message || 'Terjadi kesalahan'}` });
    } finally {
      setIsUploading(false);
    }
  };

  const labelCls = 'block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5';
  const inputCls =
    'w-full px-3.5 py-2.5 bg-console-faint border border-console-line rounded-lg text-sm text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition';

  const handleOpenPdfCheck = () => {
    let urlToTest = null;
    if (sourceType === 'gdrive' && gdriveUrl.trim()) {
      urlToTest = convertGDriveUrl(gdriveUrl.trim());
    } else if (pdfFile) {
      urlToTest = URL.createObjectURL(pdfFile);
    } else {
      const active = localExamStore.getExams()[0];
      urlToTest = active?.pdf_url || null;
    }

    setTestPdfUrl(urlToTest);
    setShowPdfCheckModal(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Super Admin Control Card: Master Token Release Switch */}
      <div className="bg-console-raised border border-accent/30 rounded-xl p-5 shadow-panel flex items-center justify-between gap-4">
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
          onClick={() => onToggleTokenAccess(!isTokenAccessEnabled)}
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

      {/* Main Upload / GDrive Form Card */}
      <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6">
        <div className="flex items-center justify-between border-b border-console-line pb-3 mb-5">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-accent" />
            <h2 className="font-bold text-ink-strong text-sm tracking-tight">
              Manajemen Naskah Soal PDF (Super Admin)
            </h2>
          </div>

          {/* Action Buttons: Mode Switcher & Cek PDF */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenPdfCheck}
              className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              title="Uji keterbacaan tampilan naskah soal di layar HP siswa"
            >
              <Eye className="w-4 h-4" />
              <span>Cek Tampilan PDF Siswa</span>
            </button>

            {/* Mode Switcher: File vs GDrive */}
            <div className="flex bg-console-bg border border-console-line p-1 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setSourceType('file')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  sourceType === 'file' ? 'bg-accent text-console-bg' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Upload PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('gdrive')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  sourceType === 'gdrive' ? 'bg-accent text-console-bg' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Link Google Drive</span>
              </button>
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

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* SOURCE 1: Local PDF File */}
          {sourceType === 'file' ? (
            <div>
              <label className={labelCls}>Pilih File PDF Soal Ujian *</label>
              <div className="border border-dashed border-console-line hover:border-accent/50 rounded-lg p-4 text-center cursor-pointer transition-colors bg-console-faint/60 relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-2 text-accent-soft font-semibold text-sm py-2">
                    <FileText className="w-5 h-5" />
                    <span>{pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                ) : (
                  <div className="py-3">
                    <UploadCloud className="w-8 h-8 text-ink-faint mx-auto mb-1.5" />
                    <p className="text-sm font-medium text-ink">
                      Klik atau seret file PDF naskah soal ke sini
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5">Format dokumen .pdf (Maksimal 25MB)</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SOURCE 2: Google Drive Link Input */
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
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 py-2.5 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isUploading ? (
                <span>Mengunggah Naskah Soal...</span>
              ) : (
                <span>Terbitkan Soal & Aktifkan Sesi Ujian</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenPdfCheck}
              className="px-4 py-2.5 bg-console-raised hover:bg-console-line border border-console-line text-ink font-bold rounded-lg text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4 text-accent" />
              <span>Uji Tampilan</span>
            </button>
          </div>
        </form>
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
                    Format: {sourceType === 'gdrive' ? 'Google Drive Embed' : 'File PDF Direct'} • Memastikan naskah terbaca jelas oleh siswa.
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

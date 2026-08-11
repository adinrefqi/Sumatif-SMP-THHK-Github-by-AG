import React, { useState, useEffect } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Link as LinkIcon,
  Lock, Unlock, ShieldAlert, Eye, X, Smartphone, CheckCheck, Layers,
  Trash2, Star, Check, Plus, RefreshCw, FolderKanban
} from 'lucide-react';
import { supabase, isSupabaseConfigured, localExamStore } from '../../lib/supabase';
import MobilePdfViewer from '../viewer/MobilePdfViewer';

export default function PdfUploader({
  onExamCreated,
  isTokenAccessEnabled,
  onToggleTokenAccess,
  activeExamIds = [],
  onToggleActiveExamId,
  activeExams = []
}) {
  const [sourceType, setSourceType] = useState('file'); // 'file' | 'gdrive' | 'batch'
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Bahasa Indonesia');
  const [grade, setGrade] = useState('Kelas 8');
  const [duration, setDuration] = useState(90);
  const [pdfFile, setPdfFile] = useState(null);
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);

  // Batch Upload States
  const [batchItems, setBatchItems] = useState([]);

  // Modal Preview Inspector
  const [showPdfCheckModal, setShowPdfCheckModal] = useState(false);
  const [testPdfUrl, setTestPdfUrl] = useState(null);

  // Exam List State
  const [savedExams, setSavedExams] = useState(localExamStore.getExams());

  const reloadExams = () => {
    setSavedExams(localExamStore.getExams());
  };

  useEffect(() => {
    reloadExams();
  }, []);

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

  // Smart Filename Parser Helper
  const parseFilenameMetadata = (fileNameStr) => {
    const lower = fileNameStr.toLowerCase();
    
    // Subject detection
    let detectedSubject = 'Bahasa Indonesia';
    if (lower.includes('matematika') || lower.includes('mtk') || lower.includes('math')) detectedSubject = 'Matematika';
    else if (lower.includes('inggris') || lower.includes('english') || lower.includes('bing')) detectedSubject = 'Bahasa Inggris';
    else if (lower.includes('ipa') || lower.includes('sains') || lower.includes('science')) detectedSubject = 'IPA (Ilmu Pengetahuan Alam)';
    else if (lower.includes('ips') || lower.includes('sosial')) detectedSubject = 'IPS (Ilmu Pengetahuan Sosial)';
    else if (lower.includes('pancasila') || lower.includes('ppkn') || lower.includes('pkn')) detectedSubject = 'Pancasila / PPKn';
    else if (lower.includes('agama') || lower.includes('pai') || lower.includes('kristen')) detectedSubject = 'Pendidikan Agama';
    else if (lower.includes('informatika') || lower.includes('tik') || lower.includes('komputer')) detectedSubject = 'Informatika';
    else if (lower.includes('seni') || lower.includes('budaya') || lower.includes('art')) detectedSubject = 'Seni & Budaya';
    else if (lower.includes('indonesia') || lower.includes('bindo')) detectedSubject = 'Bahasa Indonesia';

    // Grade detection
    let detectedGrade = 'Kelas 8';
    if (lower.includes('kelas 7') || lower.includes('kelas vii') || lower.includes('_7_') || lower.includes('-7-') || lower.includes('_7.') || lower.includes(' 7 ')) detectedGrade = 'Kelas 7';
    else if (lower.includes('kelas 9') || lower.includes('kelas ix') || lower.includes('_9_') || lower.includes('-9-') || lower.includes('_9.') || lower.includes(' 9 ')) detectedGrade = 'Kelas 9';
    else if (lower.includes('kelas 8') || lower.includes('kelas viii') || lower.includes('_8_') || lower.includes('-8-') || lower.includes('_8.') || lower.includes(' 8 ')) detectedGrade = 'Kelas 8';

    // Title generation
    const cleanName = fileNameStr
      .replace(/\.pdf$/i, '')
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .trim();

    return {
      title: `Sumatif ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`,
      subject: detectedSubject,
      grade: detectedGrade,
      duration: 90
    };
  };

  // Single File Input Handler
  const handleSingleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setMessage(null);
      if (!title) {
        const parsed = parseFilenameMetadata(file.name);
        setTitle(parsed.title);
        setSubject(parsed.subject);
        setGrade(parsed.grade);
      }
    } else {
      setMessage({ type: 'error', text: 'Format file harus berupa PDF (.pdf)' });
    }
  };

  // Batch Multi-File Dropzone Handler
  const handleBatchFilesChange = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Format file harus berupa dokumen PDF (.pdf)' });
      return;
    }

    const items = files.map((file, idx) => {
      const parsed = parseFilenameMetadata(file.name);
      return {
        id: `batch-${Date.now()}-${idx}`,
        file,
        title: parsed.title,
        subject: parsed.subject,
        grade: parsed.grade,
        duration: 90
      };
    });

    setBatchItems(prev => [...prev, ...items]);
    setMessage({ type: 'success', text: `${files.length} file PDF berhasil dimasukkan ke daftar batch.` });
  };

  const handleUpdateBatchItem = (id, field, value) => {
    setBatchItems(prev =>
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const handleRemoveBatchItem = (id) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  // Single Submit
  const handleSingleSubmit = async (e) => {
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
      }

      const existingExams = localExamStore.getExams();
      const updatedExams = [newExam, ...existingExams];
      localExamStore.saveExams(updatedExams);
      reloadExams();

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

  // Batch Submit All Items
  const handleBatchSubmit = async () => {
    if (batchItems.length === 0) return;
    setIsUploading(true);
    setMessage(null);

    try {
      const newExamsList = [];

      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i];
        let pdfUrl = null;

        if (isSupabaseConfigured && item.file) {
          const fileExt = item.file.name.split('.').pop();
          const fileNameGen = `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `exam_pdfs/${fileNameGen}`;

          const { error: uploadError } = await supabase.storage
            .from('exam-pdfs')
            .upload(filePath, item.file);

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('exam-pdfs')
              .getPublicUrl(filePath);
            pdfUrl = publicUrlData.publicUrl;
          }
        } else if (item.file) {
          pdfUrl = URL.createObjectURL(item.file);
        }

        const newExam = {
          id: `exam-${Date.now()}-${i}`,
          title: item.title,
          subject: item.subject,
          grade: item.grade,
          duration_minutes: Number(item.duration),
          pdf_url: pdfUrl,
          file_name: item.file ? item.file.name : 'Naskah_Soal.pdf',
          source_type: 'batch_file',
          created_at: new Date().toISOString()
        };

        newExamsList.push(newExam);
      }

      if (isSupabaseConfigured && newExamsList.length > 0) {
        await supabase.from('exam_sessions').insert(newExamsList);
      }

      const existingExams = localExamStore.getExams();
      const allExams = [...newExamsList, ...existingExams];
      localExamStore.saveExams(allExams);
      reloadExams();

      setMessage({ type: 'success', text: `Berhasil menerbitkan ${newExamsList.length} naskah soal sekaligus ke Bank Soal Master!` });
      setBatchItems([]);

      if (onExamCreated && newExamsList[0]) {
        onExamCreated(newExamsList[0]);
      }
    } catch (err) {
      console.error('Batch Upload Error:', err);
      setMessage({ type: 'error', text: `Gagal mengunggah batch: ${err.message || 'Terjadi kesalahan'}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenPdfCheck = (urlOverride) => {
    let urlToTest = urlOverride || null;
    if (!urlToTest) {
      if (sourceType === 'gdrive' && gdriveUrl.trim()) {
        urlToTest = convertGDriveUrl(gdriveUrl.trim());
      } else if (pdfFile) {
        urlToTest = URL.createObjectURL(pdfFile);
      } else {
        urlToTest = activeExam?.pdf_url || savedExams[0]?.pdf_url || null;
      }
    }

    setTestPdfUrl(urlToTest);
    setShowPdfCheckModal(true);
  };

  const handleDeleteExam = (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus naskah soal ini dari Bank Soal Master?')) {
      const updated = localExamStore.deleteExam(id);
      setSavedExams(updated);
      if (activeExam?.id === id && updated[0] && onSelectActiveExam) {
        onSelectActiveExam(updated[0]);
      }
    }
  };

  const labelCls = 'block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5';
  const inputCls =
    'w-full px-3.5 py-2.5 bg-console-faint border border-console-line rounded-lg text-sm text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition';

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

      {/* Super Admin Monitoring 3 Ruang Ujian Card */}
      <div className="bg-console-panel border border-console-line rounded-xl p-5 shadow-panel">
        <div className="flex items-center justify-between border-b border-console-line pb-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-accent" />
            <h3 className="font-extrabold text-sm text-ink-strong tracking-tight">
              Status Terpadu 3 Ruang Ujian Sumatif
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded">
            Tepat 3 Ruang Ujian (Ruang 1, 2, 3)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['Ruang 1', 'Ruang 2', 'Ruang 3'].map((room) => {
            const minutes = localExamStore.getOfficialMinutes(room);
            const attendance = localExamStore.getAttendanceRecords().filter(r => r.room === room);
            return (
              <div key={room} className="bg-console-raised border border-console-line rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-xs text-ink-strong uppercase tracking-wider font-mono">
                      {room}
                    </span>
                    {minutes ? (
                      <span className="px-2 py-0.5 bg-ok/15 text-ok border border-ok/30 text-[9px] font-bold uppercase rounded">
                        Berita Acara OK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-bad/15 text-bad border border-bad/30 text-[9px] font-bold uppercase rounded">
                        Belum Berita Acara
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-ink-muted">
                    Proktor: <strong className="text-ink">{minutes?.proctorName || 'Belum Mengisi'}</strong>
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    Mata Pelajaran: <span className="text-accent font-semibold">{minutes?.subject || 'Belum Diisi'}</span>
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-console-line flex items-center justify-between text-[10px] font-mono">
                  <span className="text-ink-faint">Peserta Hadir:</span>
                  <strong className="text-ok font-extrabold">{attendance.length} Siswa</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Upload Form Card */}
      <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-console-line pb-3 mb-5 gap-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-extrabold text-ink-strong text-sm tracking-tight">
                Manajemen & Upload Naskah Soal PDF (Super Admin)
              </h2>
              <p className="text-[11px] text-ink-muted">
                Dukungan Upload Tunggal, Link Google Drive, dan **Batch Upload Banyak File**
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-console-bg border border-console-line p-1 rounded-lg text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setSourceType('file')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                sourceType === 'file' ? 'bg-accent text-console-bg' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Single PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceType('gdrive')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                sourceType === 'gdrive' ? 'bg-accent text-console-bg' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Link GDrive</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceType('batch')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                sourceType === 'batch' ? 'bg-accent text-console-bg' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Batch Upload (Banyak)</span>
            </button>
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

        {/* MODE 1 & 2: SINGLE FILE OR GDRIVE LINK */}
        {sourceType !== 'batch' ? (
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

            {sourceType === 'file' ? (
              <div>
                <label className={labelCls}>Pilih File PDF Soal Ujian *</label>
                <div className="border border-dashed border-console-line hover:border-accent/50 rounded-lg p-4 text-center cursor-pointer transition-colors bg-console-faint/60 relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleSingleFileChange}
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
                onClick={() => handleOpenPdfCheck()}
                className="px-4 py-2.5 bg-console-raised hover:bg-console-line border border-console-line text-ink font-bold rounded-lg text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4 text-accent" />
                <span>Uji Tampilan</span>
              </button>
            </div>
          </form>
        ) : (
          /* MODE 3: BATCH MULTI-FILE UPLOAD MODE */
          <div className="space-y-4 animate-fadeUp">
            
            {/* Batch Multi-File Dropzone */}
            <div className="border-2 border-dashed border-accent/40 hover:border-accent rounded-xl p-6 text-center cursor-pointer transition-colors bg-accent/5 relative">
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleBatchFilesChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="py-2">
                <Layers className="w-10 h-10 text-accent mx-auto mb-2" />
                <h4 className="text-sm font-extrabold text-ink-strong">
                  Pilih & Seret Banyak File PDF Sekaligus (Batch Dropzone)
                </h4>
                <p className="text-xs text-ink-muted mt-1">
                  Sistem otomatis mendeteksi Mata Pelajaran, Kelas, dan Judul Ujian dari nama file PDF.
                </p>
                <span className="inline-block mt-3 px-3 py-1 bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold rounded-lg uppercase tracking-wider">
                  Klik untuk Memilih Banyak PDF
                </span>
              </div>
            </div>

            {/* Batch Items Review Table */}
            {batchItems.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-ink-strong uppercase tracking-wider flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4 text-accent" />
                    <span>Daftar File Batch Siap Terbit ({batchItems.length} File)</span>
                  </h4>

                  <button
                    onClick={() => setBatchItems([])}
                    className="text-[11px] font-bold text-bad hover:underline"
                  >
                    Bersihkan Daftar
                  </button>
                </div>

                <div className="overflow-x-auto border border-console-line rounded-xl bg-console-raised">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-console-line text-[10px] uppercase font-bold text-ink-muted bg-console-panel">
                        <th className="py-2.5 px-3">Nama File</th>
                        <th className="py-2.5 px-3">Judul Naskah Soal</th>
                        <th className="py-2.5 px-3">Mata Pelajaran</th>
                        <th className="py-2.5 px-3">Tingkat Kelas</th>
                        <th className="py-2.5 px-3">Durasi</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-console-line">
                      {batchItems.map((item) => (
                        <tr key={item.id} className="hover:bg-console-faint/60">
                          <td className="py-2 px-3 font-mono text-[11px] text-ink-faint truncate max-w-[140px]">
                            {item.file.name}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleUpdateBatchItem(item.id, 'title', e.target.value)}
                              className="w-full px-2 py-1 bg-console-bg border border-console-line rounded text-xs font-semibold text-ink-strong"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={item.subject}
                              onChange={(e) => handleUpdateBatchItem(item.id, 'subject', e.target.value)}
                              className="px-2 py-1 bg-console-bg border border-console-line rounded text-xs text-ink-strong"
                            >
                              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                              <option value="Matematika">Matematika</option>
                              <option value="Bahasa Inggris">Bahasa Inggris</option>
                              <option value="IPA (Ilmu Pengetahuan Alam)">IPA</option>
                              <option value="IPS (Ilmu Pengetahuan Sosial)">IPS</option>
                              <option value="Pancasila / PPKn">Pancasila / PPKn</option>
                              <option value="Pendidikan Agama">Pendidikan Agama</option>
                              <option value="Informatika">Informatika</option>
                              <option value="Seni & Budaya">Seni & Budaya</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={item.grade}
                              onChange={(e) => handleUpdateBatchItem(item.id, 'grade', e.target.value)}
                              className="px-2 py-1 bg-console-bg border border-console-line rounded text-xs text-ink-strong"
                            >
                              <option value="Kelas 7">Kelas 7</option>
                              <option value="Kelas 8">Kelas 8</option>
                              <option value="Kelas 9">Kelas 9</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="15"
                              value={item.duration}
                              onChange={(e) => handleUpdateBatchItem(item.id, 'duration', e.target.value)}
                              className="w-16 px-2 py-1 bg-console-bg border border-console-line rounded text-xs font-mono font-bold text-accent"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleRemoveBatchItem(item.id)}
                              className="p-1 text-ink-faint hover:text-bad transition-colors"
                              title="Hapus dari batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleBatchSubmit}
                  className="w-full py-3 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg rounded-lg text-xs font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {isUploading ? (
                    <span>Menerbitkan Batch PDF...</span>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      <span>Terbitkan Semua Naskah Soal ({batchItems.length} File)</span>
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        )}
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
            Sesi Aktif ({activeExamIds.length} Soal): <strong className="text-accent">{activeExams.map(e => e.subject).join(', ') || 'Belum Dipilih'}</strong>
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
                      onClick={() => onToggleActiveExamId && onToggleActiveExamId(ex.id)}
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

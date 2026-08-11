import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured, localExamStore } from '../../lib/supabase';

export default function PdfUploader({ onExamCreated }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Bahasa Indonesia');
  const [grade, setGrade] = useState('Kelas 8');
  const [duration, setDuration] = useState(90);
  const [pdfFile, setPdfFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setMessage(null);
      if (!title) {
        // Auto-generate title from filename
        const cleanName = file.name.replace('.pdf', '').replace(/_/g, ' ');
        setTitle(`Sumatif ${cleanName}`);
      }
    } else {
      setMessage({ type: 'error', text: 'Format file harus berupa PDF (.pdf)' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pdfFile && !title) {
      setMessage({ type: 'error', text: 'Silakan isi judul ujian dan pilih file PDF naskah soal' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      let pdfUrl = null;

      // 1. Upload to Supabase Storage if configured
      if (isSupabaseConfigured && pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `exam_pdfs/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('exam-pdfs')
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('exam-pdfs')
          .getPublicUrl(filePath);

        pdfUrl = publicUrlData.publicUrl;
      } else if (pdfFile) {
        // Local Object URL fallback for browser session
        pdfUrl = URL.createObjectURL(pdfFile);
      }

      // 2. Insert record into Supabase or Local Storage
      const newExam = {
        id: `exam-${Date.now()}`,
        title: title || 'Sumatif Ujian PDF',
        subject,
        grade,
        duration_minutes: Number(duration),
        pdf_url: pdfUrl,
        file_name: pdfFile ? pdfFile.name : 'Naskah_Soal.pdf',
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

      setMessage({ type: 'success', text: 'Naskah soal PDF berhasil diunggah & diterbitkan!' });
      setPdfFile(null);
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 mb-6">
      <div className="flex items-center space-x-2 border-b border-gray-100 pb-3 mb-4">
        <UploadCloud className="w-5 h-5 text-anbk-blue" />
        <h2 className="font-bold text-gray-800 text-base md:text-lg">
          Upload Naskah Soal PDF (Ujian Sumatif)
        </h2>
      </div>

      {message && (
        <div className={`p-3.5 rounded-lg mb-4 text-sm font-medium flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Judul Ujian Sumatif *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Sumatif Akhir Semester Bahasa Indonesia"
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-anbk-blue focus:border-anbk-blue outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Mata Pelajaran
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-anbk-blue focus:border-anbk-blue outline-none transition"
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
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Tingkat Kelas
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-anbk-blue focus:border-anbk-blue outline-none transition"
            >
              <option value="Kelas 7">Kelas VII (7)</option>
              <option value="Kelas 8">Kelas VIII (8)</option>
              <option value="Kelas 9">Kelas IX (9)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Durasi Ujian (Menit)
            </label>
            <input
              type="number"
              min="15"
              max="240"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-anbk-blue focus:border-anbk-blue outline-none transition"
            />
          </div>
        </div>

        {/* PDF File Dropzone */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Pilih File PDF Soal Ujian *
          </label>
          <div className="border-2 border-dashed border-gray-300 hover:border-anbk-blue rounded-xl p-4 text-center cursor-pointer transition bg-gray-50/50 relative">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {pdfFile ? (
              <div className="flex items-center justify-center space-x-2 text-anbk-blue font-semibold text-sm py-2">
                <FileText className="w-5 h-5 text-anbk-blue" />
                <span>{pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            ) : (
              <div className="py-3">
                <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-medium text-gray-700">
                  Klik atau seret file PDF naskah soal ke sini
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Format dokumen .pdf (Maksimal 25MB)</p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="w-full py-2.5 bg-anbk-blue hover:bg-anbk-darkBlue active:bg-blue-900 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {isUploading ? (
            <span>Mengunggah Naskah Soal...</span>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Terbitkan Soal & Aktifkan Sesi Ujian</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { validateStudentToken } from '../../utils/tokenRotationManager';
import { localExamStore } from '../../lib/supabase';

import StudentAttendanceModal from './StudentAttendanceModal';

export default function StudentTokenScreen({ activeTokenObj, onTokenValidated, activeExam }) {
  const [studentName, setStudentName] = useState('');
  const [nisn, setNisn] = useState('');
  const [studentClass, setStudentClass] = useState('8A');
  const [inputToken, setInputToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [validatedInfo, setValidatedInfo] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!studentName.trim()) {
      setErrorMsg('Silakan isi Nama Lengkap Peserta');
      return;
    }

    if (!inputToken.trim() || inputToken.length !== 6) {
      setErrorMsg('Silakan masukkan 6 Karakter Token Ujian dengan benar');
      return;
    }

    const isValid = validateStudentToken(inputToken, activeTokenObj, localExamStore.getPreviousToken());
    if (isValid) {
      setValidatedInfo({
        name: studentName,
        nisn: nisn || '0080000000',
        class: studentClass,
        tokenEntered: inputToken.toUpperCase()
      });
    } else {
      setErrorMsg('Token Ujian tidak valid atau telah kadaluarsa. Mintalah token terbaru dari Proktor/Pengawas.');
    }
  };

  const handleAttendanceConfirmed = (attendanceData) => {
    // Save student attendance record locally
    localExamStore.saveAttendanceRecord(attendanceData);
    if (onTokenValidated) {
      onTokenValidated(attendanceData);
    }
  };

  const inputBase =
    'w-full px-3.5 py-2.5 bg-console-faint border border-console-line rounded-lg text-sm text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition';

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeUp">

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-label mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sesi Ujian Terproteksi</span>
          </div>
          <h2 className="font-extrabold text-2xl text-ink-strong tracking-tight">
            Masuk Sesi Ujian
          </h2>
          <p className="text-xs text-ink-muted mt-1.5">
            {activeExam?.title || 'Sumatif Ujian Sekolah SMP THHK'}
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-console-panel border border-console-line rounded-xl p-5 md:p-6 space-y-4 shadow-panel"
        >
          {errorMsg && (
            <div className="p-3 bg-bad/10 border border-bad/25 text-bad text-xs font-semibold rounded-lg flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5">
              Nama Lengkap Peserta *
            </label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Masukkan nama lengkap Anda"
              className={inputBase}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5">
                NISN / No. Ujian
              </label>
              <input
                type="text"
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                placeholder="NISN siswa"
                className={inputBase}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5">
                Rombel / Kelas
              </label>
              <select
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className={inputBase}
              >
                <option value="7A">Kelas 7A</option>
                <option value="7B">Kelas 7B</option>
                <option value="8A">Kelas 8A</option>
                <option value="8B">Kelas 8B</option>
                <option value="9A">Kelas 9A</option>
                <option value="9B">Kelas 9B</option>
              </select>
            </div>
          </div>

          {/* Token Box */}
          <div className="pt-1">
            <label className="block text-[10px] font-bold text-accent uppercase tracking-label mb-1.5 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Token Ujian (6 Karakter) *</span>
            </label>
            <input
              type="text"
              maxLength={6}
              required
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value.toUpperCase())}
              placeholder="······"
              className="w-full px-4 py-3 bg-accent/5 border border-accent/40 rounded-lg text-center font-mono text-2xl font-extrabold tracking-[0.35em] text-accent-soft placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none uppercase transition"
            />
            <p className="text-[11px] text-ink-faint text-center mt-1.5">
              Mintalah token aktif yang tertera di layar/papan Proktor
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg rounded-lg text-xs font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <span>Mulai Buka Naskah Soal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-ink-faint text-center mt-4 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-ok" />
          <span>Exambrowser Protected • Mode Pembaca Naskah Soal</span>
        </p>

      </div>

      {validatedInfo && (
        <StudentAttendanceModal
          studentInfo={validatedInfo}
          examTitle={activeExam?.title}
          onConfirm={handleAttendanceConfirmed}
        />
      )}
    </div>
  );
}
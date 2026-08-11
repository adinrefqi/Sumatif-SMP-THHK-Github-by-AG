import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, RefreshCw, Clock, Users, CheckCircle2, RotateCcw, AlertTriangle, FileSignature, ClipboardList, Lock, Edit3 } from 'lucide-react';
import { generateToken, getTimeRemainingInTokenCycle } from '../../utils/tokenRotationManager';
import { localExamStore } from '../../lib/supabase';
import OfficialMinutesForm from './OfficialMinutesForm';

export default function ProctorTokenMonitor({ activeTokenObj, onTokenUpdate, activeExam, isTokenAccessEnabled, isAdminRole }) {
  const [activeTab, setActiveTab] = useState('token'); // 'token' | 'attendance' | 'minutes'
  const [officialMinutes, setOfficialMinutes] = useState(localExamStore.getOfficialMinutes());
  const [showMinutesForm, setShowMinutesForm] = useState(!localExamStore.getOfficialMinutes() && !isAdminRole);
  const [attendanceList, setAttendanceList] = useState(localExamStore.getAttendanceRecords());

  const [timeInfo, setTimeInfo] = useState(getTimeRemainingInTokenCycle(activeTokenObj?.timestamp));
  const hasExpiredRef = useRef(false);

  // Poll for attendance list updates
  useEffect(() => {
    const interval = setInterval(() => {
      setAttendanceList(localExamStore.getAttendanceRecords());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Interval timer for 15-min countdown
  useEffect(() => {
    if (!activeTokenObj?.timestamp) {
      setTimeInfo({ minutes: 15, seconds: 0, percentage: 100, isExpired: false });
      hasExpiredRef.current = false;
      return undefined;
    }

    const timer = setInterval(() => {
      const remaining = getTimeRemainingInTokenCycle(activeTokenObj?.timestamp);
      setTimeInfo(remaining);

      if (remaining.isExpired && !hasExpiredRef.current && isTokenAccessEnabled) {
        hasExpiredRef.current = true;
        handleManualRefresh();
      }
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTokenObj, isTokenAccessEnabled]);

  const handleManualRefresh = () => {
    if (!isTokenAccessEnabled && !isAdminRole) return;
    const newTokenStr = generateToken();
    const updatedObj = localExamStore.setActiveToken(newTokenStr);
    hasExpiredRef.current = false;
    if (onTokenUpdate) {
      onTokenUpdate(updatedObj);
    }
  };

  const handleMinutesSubmitted = (minutesData) => {
    setOfficialMinutes(minutesData);
    setShowMinutesForm(false);
  };

  // IF PROCTOR HAS NOT FILLED BERITA ACARA YET: SHOW MANDATORY GATE
  if (showMinutesForm && !isAdminRole) {
    return (
      <OfficialMinutesForm
        activeExam={activeExam}
        onSubmitted={handleMinutesSubmitted}
      />
    );
  }

  return (
    <div className="space-y-4">

      {/* Navigation Sub-Header Tabs */}
      <div className="flex items-center justify-between bg-console-panel border border-console-line rounded-xl p-2 shadow-panel">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('token')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'token'
                ? 'bg-accent text-console-bg'
                : 'text-ink-muted hover:text-ink hover:bg-console-faint'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Rilis Token Ujian</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-accent text-console-bg'
                : 'text-ink-muted hover:text-ink hover:bg-console-faint'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            <span>Daftar Hadir & TTD Siswa ({attendanceList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('minutes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'minutes'
                ? 'bg-accent text-console-bg'
                : 'text-ink-muted hover:text-ink hover:bg-console-faint'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Berita Acara Ujian</span>
          </button>
        </div>

        {!isAdminRole && (
          <button
            onClick={() => setShowMinutesForm(true)}
            className="text-[11px] font-semibold text-accent-soft hover:underline flex items-center gap-1 px-2"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Berita Acara</span>
          </button>
        )}
      </div>

      {/* TAB 1: TOKEN & LIVE SESSION MONITOR */}
      {activeTab === 'token' && (
        <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6">
          
          {/* Token Access Locked Banner */}
          {!isTokenAccessEnabled && (
            <div className="mb-5 p-3.5 bg-bad/10 border border-bad/30 rounded-xl text-bad text-xs font-semibold flex items-center gap-3">
              <Lock className="w-5 h-5 shrink-0" />
              <div>
                <strong className="font-extrabold uppercase tracking-wider block">Akses Rilis Token Terkunci oleh Super Admin</strong>
                <span>Rilis token ujian saat ini belum dibuka oleh Super Admin. Hubungi panitia ujian untuk membuka gerbang rilis token.</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Token Box */}
            <div className="lg:col-span-1 bg-console-raised border border-console-line rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-accent/70" />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-label text-ink-muted">
                    <KeyRound className="w-3.5 h-3.5 text-accent" />
                    <span>Token Rilis ANBK</span>
                  </span>
                  <span className="px-2 py-0.5 bg-accent/10 border border-accent/25 text-accent rounded-md text-[9px] font-bold uppercase tracking-wider">
                    Rotasi 15 Menit
                  </span>
                </div>

                {/* Token Display */}
                <div className="text-center py-5 bg-console-bg rounded-lg border border-console-line">
                  <span className="font-mono text-4xl md:text-5xl font-extrabold tracking-[0.2em] text-accent-soft select-all tabular-nums">
                    {activeTokenObj?.token || 'THHK26'}
                  </span>
                  <p className="text-[10px] text-ink-faint mt-2 font-semibold uppercase tracking-wider">
                    Umumkan token ini ke peserta ruang ujian
                  </p>
                </div>
              </div>

              {/* Countdown */}
              <div className="mt-4 pt-4 border-t border-console-line">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Rotasi Berikutnya</span>
                  </span>
                  <span className="font-mono font-extrabold text-accent-soft tabular-nums">
                    {String(timeInfo.minutes).padStart(2, '0')}:{String(timeInfo.seconds).padStart(2, '0')}
                  </span>
                </div>

                <div className="w-full bg-console-bg h-1.5 rounded-full overflow-hidden border border-console-line">
                  <div
                    className="bg-accent h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${timeInfo.percentage}%` }}
                  />
                </div>

                <button
                  onClick={handleManualRefresh}
                  disabled={!isTokenAccessEnabled}
                  className="w-full mt-4 py-2.5 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rilis Token Baru</span>
                </button>
              </div>
            </div>

            {/* Right: Live Attendance Summary */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-console-line pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-ink-strong text-sm tracking-tight">
                    Peserta Presensi Real-Time ({attendanceList.length})
                  </h3>
                </div>
                <span className="text-[10px] text-ok font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-ok live-dot" />
                  <span>Sesi Berjalan</span>
                </span>
              </div>

              {attendanceList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-console-line rounded-xl bg-console-bg/50">
                  <Users className="w-8 h-8 text-ink-faint mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-ink-muted">Belum ada siswa yang masuk dengan token</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">Daftar presensi akan otomatis terisi saat siswa login</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-console-line text-[10px] uppercase font-bold text-ink-muted">
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">NISN</th>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-console-line font-mono">
                      {attendanceList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-console-faint/50">
                          <td className="py-2 px-3 text-ink-faint">{item.timeFormatted || '08:00'}</td>
                          <td className="py-2 px-3 font-bold text-ink-strong">{item.name}</td>
                          <td className="py-2 px-3 text-ink-muted">{item.nisn}</td>
                          <td className="py-2 px-3 text-accent font-bold">{item.class}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 bg-ok/10 text-ok border border-ok/25 rounded-md text-[10px] font-bold">
                              HADIR & TTD
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: DAFTAR HADIR & TANDA TANGAN DIGITAL SISWA */}
      {activeTab === 'attendance' && (
        <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6 animate-fadeUp">
          <div className="flex items-center justify-between border-b border-console-line pb-3 mb-4">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-ink-strong text-sm tracking-tight">
                Rekap Presensi & Tanda Tangan Digital Siswa
              </h3>
            </div>
            <span className="text-xs font-bold text-accent">Total: {attendanceList.length} Siswa</span>
          </div>

          {attendanceList.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-console-line rounded-xl bg-console-bg/50">
              <FileSignature className="w-8 h-8 text-ink-faint mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-ink-muted">Belum ada data tanda tangan digital siswa</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {attendanceList.map((item, idx) => (
                <div key={idx} className="bg-console-raised border border-console-line rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-ink-strong truncate max-w-[130px]">{item.name}</span>
                      <span className="px-1.5 py-0.5 bg-accent/10 text-accent font-mono font-bold text-[10px] rounded">
                        {item.class}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-faint font-mono">NISN: {item.nisn}</p>
                    <p className="text-[10px] text-ink-faint font-mono mb-2">Masuk: {item.timeFormatted || '-'}</p>
                  </div>

                  {/* Signature Thumbnail Preview */}
                  <div className="bg-console-bg border border-console-line rounded-lg h-24 p-1 flex items-center justify-center relative overflow-hidden">
                    {item.signatureUrl ? (
                      <img src={item.signatureUrl} alt={`TTD ${item.name}`} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-ink-faint italic">Tidak ada TTD</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BERITA ACARA UJIAN */}
      {activeTab === 'minutes' && (
        <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6 animate-fadeUp">
          <div className="flex items-center justify-between border-b border-console-line pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-ink-strong text-sm tracking-tight">
                Berita Acara Pelaksanaan Ujian Sumatif
              </h3>
            </div>
            <button
              onClick={() => setShowMinutesForm(true)}
              className="px-3 py-1 bg-accent hover:bg-accent-soft text-console-bg rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Ubah Data
            </button>
          </div>

          {officialMinutes ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-console-raised p-4 rounded-xl border border-console-line">
                <div>
                  <span className="text-[10px] text-ink-faint font-bold uppercase">Proktor / Pengawas</span>
                  <p className="font-bold text-ink-strong text-sm mt-0.5">{officialMinutes.proctorName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-ink-faint font-bold uppercase">Ruang Ujian</span>
                  <p className="font-bold text-accent text-sm mt-0.5">{officialMinutes.roomNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] text-ink-faint font-bold uppercase">Mata Pelajaran</span>
                  <p className="font-bold text-ink-strong text-sm mt-0.5">{officialMinutes.subject}</p>
                </div>
                <div>
                  <span className="text-[10px] text-ink-faint font-bold uppercase">Tanggal Pelaksanaan</span>
                  <p className="font-bold text-ink-strong text-sm mt-0.5">{officialMinutes.date || 'Hari Ini'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-console-bg border border-console-line rounded-lg">
                  <span className="text-[10px] text-ink-faint uppercase font-bold">Terdaftar</span>
                  <p className="font-mono text-xl font-extrabold text-ink-strong mt-0.5">{officialMinutes.totalRegistered}</p>
                </div>
                <div className="p-3 bg-ok/10 border border-ok/25 rounded-lg text-ok">
                  <span className="text-[10px] uppercase font-bold">Hadir</span>
                  <p className="font-mono text-xl font-extrabold mt-0.5">{officialMinutes.totalPresent}</p>
                </div>
                <div className="p-3 bg-bad/10 border border-bad/25 rounded-lg text-bad">
                  <span className="text-[10px] uppercase font-bold">Tidak Hadir</span>
                  <p className="font-mono text-xl font-extrabold mt-0.5">{officialMinutes.totalAbsent}</p>
                </div>
              </div>

              {officialMinutes.absentNotes && (
                <div className="p-3 bg-console-raised rounded-lg border border-console-line">
                  <span className="font-bold text-ink-muted text-[10px] uppercase block mb-1">Catatan Peserta Tidak Hadir:</span>
                  <p className="text-ink">{officialMinutes.absentNotes}</p>
                </div>
              )}

              <div className="p-3 bg-console-raised rounded-lg border border-console-line">
                <span className="font-bold text-ink-muted text-[10px] uppercase block mb-1">Catatan Kejadian Ujian:</span>
                <p className="text-ink">{officialMinutes.generalNotes}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted italic text-center py-4">Belum ada data Berita Acara yang disubmit.</p>
          )}
        </div>
      )}

    </div>
  );
}

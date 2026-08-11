import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, RefreshCw, Clock, Users, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { generateToken, getTimeRemainingInTokenCycle } from '../../utils/tokenRotationManager';
import { localExamStore } from '../../lib/supabase';

export default function ProctorTokenMonitor({ activeTokenObj, onTokenUpdate }) {
  const [timeInfo, setTimeInfo] = useState(getTimeRemainingInTokenCycle(activeTokenObj?.timestamp));
  const hasExpiredRef = useRef(false);
  const [hasExpired, setHasExpired] = useState(false);

  // Reset expiry flag whenever a new token arrives (fixes stale-closure loop)
  useEffect(() => {
    hasExpiredRef.current = false;
    setHasExpired(false);
  }, [activeTokenObj?.token]);
  const [mockStudents, setMockStudents] = useState([
    { id: 1, name: 'Ahmad Fauzi', nisn: '0081234567', class: '8A', status: 'ACTIVE', violations: 0, timeEntered: '08:00' },
    { id: 2, name: 'Budi Santoso', nisn: '0081234568', class: '8A', status: 'ACTIVE', violations: 0, timeEntered: '08:02' },
    { id: 3, name: 'Citra Dewi', nisn: '0081234569', class: '8B', status: 'HELP_NEEDED', violations: 1, timeEntered: '08:05' },
    { id: 4, name: 'Deni Kurniawan', nisn: '0081234570', class: '8C', status: 'ACTIVE', violations: 0, timeEntered: '08:01' }
  ]);

  // Interval timer for 15-min countdown
  useEffect(() => {
    if (!activeTokenObj?.timestamp) {
      // No valid timestamp: keep countdown frozen, do not auto-refresh endlessly
      setTimeInfo({ minutes: 15, seconds: 0, percentage: 100, isExpired: false });
      hasExpiredRef.current = false;
      setHasExpired(false);
      return undefined;
    }

    const timer = setInterval(() => {
      const remaining = getTimeRemainingInTokenCycle(activeTokenObj?.timestamp);
      setTimeInfo(remaining);

      // Auto-refresh token once when expired (use ref to avoid stale closure)
      if (remaining.isExpired && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        setHasExpired(true);
        handleManualRefresh();
      }
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTokenObj]);

  const handleManualRefresh = () => {
    const newTokenStr = generateToken();
    const updatedObj = localExamStore.setActiveToken(newTokenStr);
    hasExpiredRef.current = false;
    setHasExpired(false);
    if (onTokenUpdate) {
      onTokenUpdate(updatedObj);
    }
  };

  const handleResetStudent = (studentId) => {
    setMockStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, status: 'RESET', violations: 0 } : s)
    );
    alert(`Sesi siswa telah di-reset oleh Proktor. Siswa dapat memasukkan token kembali.`);
  };

  return (
    <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6">
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

            {/* Token Big Display */}
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
              className="w-full mt-4 py-2.5 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rilis Token Baru</span>
            </button>
          </div>
        </div>

        {/* Right: Student Session Monitor */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-console-line pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-ink-strong text-sm tracking-tight">
                Monitoring Sesi Peserta Real-Time
              </h3>
            </div>
            <span className="text-[10px] bg-ok/10 border border-ok/25 text-ok font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok live-dot" />
              {mockStudents.filter(s => s.status === 'ACTIVE').length} Aktif
            </span>
          </div>

          {/* Student Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-ink-faint text-[9px] font-bold uppercase tracking-label border-b border-console-line">
                  <th className="p-2.5">Siswa</th>
                  <th className="p-2.5">Kelas</th>
                  <th className="p-2.5">Jam Masuk</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Pelanggaran</th>
                  <th className="p-2.5 text-right">Aksi Emergency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-console-faint">
                {mockStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-console-faint/60 transition-colors">
                    <td className="p-2.5 font-semibold text-ink-strong">
                      <div>{s.name}</div>
                      <div className="text-[10px] text-ink-faint font-mono font-medium">NISN {s.nisn}</div>
                    </td>
                    <td className="p-2.5 text-ink-muted font-medium">{s.class}</td>
                    <td className="p-2.5 font-mono text-ink-muted tabular-nums">{s.timeEntered}</td>
                    <td className="p-2.5">
                      {s.status === 'ACTIVE' && (
                        <span className="px-2 py-0.5 bg-ok/10 border border-ok/25 text-ok rounded-md text-[10px] font-bold flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Mengerjakan</span>
                        </span>
                      )}
                      {s.status === 'HELP_NEEDED' && (
                        <span className="px-2 py-0.5 bg-accent/10 border border-accent/30 text-accent rounded-md text-[10px] font-bold flex items-center gap-1 w-max animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Minta Bantuan</span>
                        </span>
                      )}
                      {s.status === 'RESET' && (
                        <span className="px-2 py-0.5 bg-console-raised border border-console-line text-ink-muted rounded-md text-[10px] font-bold w-max">
                          Di-Reset
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      {s.violations > 0 ? (
                        <span className="px-2 py-0.5 bg-bad/10 border border-bad/25 text-bad font-bold rounded-md text-[10px]">
                          {s.violations}x Pindah Apps
                        </span>
                      ) : (
                        <span className="text-ink-faint font-mono">0</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => handleResetStudent(s.id)}
                        className="px-2 py-1 bg-console-raised hover:bg-bad/10 hover:text-bad hover:border-bad/30 border border-console-line text-ink-muted rounded-md text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                        title="Reset sesi jika HP siswa mati/restart"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Sesi</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { KeyRound, RefreshCw, Clock, Users, ShieldAlert, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { generateToken, getTimeRemainingInTokenCycle } from '../../utils/tokenRotationManager';
import { localExamStore } from '../../lib/supabase';

export default function ProctorTokenMonitor({ activeTokenObj, onTokenUpdate }) {
  const [timeInfo, setTimeInfo] = useState(getTimeRemainingInTokenCycle(activeTokenObj?.timestamp));
  const [mockStudents, setMockStudents] = useState([
    { id: 1, name: 'Ahmad Fauzi', nisn: '0081234567', class: '8A', status: 'ACTIVE', violations: 0, timeEntered: '08:00' },
    { id: 2, name: 'Budi Santoso', nisn: '0081234568', class: '8A', status: 'ACTIVE', violations: 0, timeEntered: '08:02' },
    { id: 3, name: 'Citra Dewi', nisn: '0081234569', class: '8B', status: 'HELP_NEEDED', violations: 1, timeEntered: '08:05' },
    { id: 4, name: 'Deni Kurniawan', nisn: '0081234570', class: '8C', status: 'ACTIVE', violations: 0, timeEntered: '08:01' }
  ]);

  // Interval timer for 15-min countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getTimeRemainingInTokenCycle(activeTokenObj?.timestamp);
      setTimeInfo(remaining);

      // Auto-refresh token when expired
      if (remaining.isExpired) {
        handleManualRefresh();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTokenObj]);

  const handleManualRefresh = () => {
    const newTokenStr = generateToken();
    const updatedObj = localExamStore.setActiveToken(newTokenStr);
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 1 Col: ANBK Token Box */}
        <div className="lg:col-span-1 bg-gradient-to-br from-anbk-blue to-blue-900 text-white rounded-xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="flex items-center space-x-1.5">
                <KeyRound className="w-4 h-4 text-yellow-300" />
                <span>TOKEN RILIS ANBK</span>
              </span>
              <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded font-mono">
                ROTASI 15 MENIT
              </span>
            </div>

            {/* Token Big Display */}
            <div className="text-center py-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10 my-2">
              <span className="font-mono text-4xl md:text-5xl font-extrabold tracking-widest text-yellow-300 drop-shadow-sm select-all">
                {activeTokenObj?.token || 'THHK26'}
              </span>
              <p className="text-xs text-blue-100 mt-1">Beritahukan token ini kepada peserta di ruang ujian</p>
            </div>
          </div>

          {/* Countdown Progress Bar */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-blue-100 font-medium mb-1.5">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Rotasi Berikutnya:</span>
              </span>
              <span className="font-mono font-bold text-yellow-300">
                {String(timeInfo.minutes).padStart(2, '0')}:{String(timeInfo.seconds).padStart(2, '0')}
              </span>
            </div>

            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-yellow-400 h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${timeInfo.percentage}%` }}
              />
            </div>

            <button
              onClick={handleManualRefresh}
              className="w-full mt-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-gray-900 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rilis Token Baru Sekarang</span>
            </button>
          </div>
        </div>

        {/* Right 2 Cols: Real-time Student Session Monitor */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-anbk-blue" />
              <h3 className="font-bold text-gray-800 text-base">
                Monitoring Sesi Peserta Real-Time
              </h3>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full">
              {mockStudents.filter(s => s.status === 'ACTIVE').length} Aktif
            </span>
          </div>

          {/* Student Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-semibold uppercase border-b border-gray-200">
                  <th className="p-2.5">Siswa</th>
                  <th className="p-2.5">Kelas</th>
                  <th className="p-2.5">Jam Masuk</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Pelanggaran</th>
                  <th className="p-2.5 text-right">Aksi Emergency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-2.5 font-medium text-gray-900">
                      <div>{s.name}</div>
                      <div className="text-[10px] text-gray-400">NISN: {s.nisn}</div>
                    </td>
                    <td className="p-2.5 text-gray-600">{s.class}</td>
                    <td className="p-2.5 font-mono text-gray-600">{s.timeEntered}</td>
                    <td className="p-2.5">
                      {s.status === 'ACTIVE' && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold flex items-center space-x-1 w-max">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Mengerjakan</span>
                        </span>
                      )}
                      {s.status === 'HELP_NEEDED' && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded font-semibold flex items-center space-x-1 w-max animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-yellow-600" />
                          <span>Minta Bantuan</span>
                        </span>
                      )}
                      {s.status === 'RESET' && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold w-max">
                          Di-Reset
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      {s.violations > 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded">
                          {s.violations}x Pindah Apps
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => handleResetStudent(s.id)}
                        className="px-2 py-1 bg-gray-100 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100 text-gray-700 rounded font-semibold transition flex items-center space-x-1 ml-auto text-[11px]"
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

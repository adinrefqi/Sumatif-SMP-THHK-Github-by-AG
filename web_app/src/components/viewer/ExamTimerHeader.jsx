import React, { useState, useEffect } from 'react';
import { Clock, Battery, BatteryCharging, AlertTriangle, Bell, User } from 'lucide-react';

export default function ExamTimerHeader({ studentInfo, activeExam, onRequestHelp }) {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState((activeExam?.duration_minutes || 90) * 60);
  const [realtimeClock, setRealtimeClock] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [isCharging, setIsCharging] = useState(false);
  const [helpRequested, setHelpRequested] = useState(false);

  // Sync with Android Native Bridge if available
  useEffect(() => {
    if (window.ExambrowserBridge && window.ExambrowserBridge.getBatteryLevel) {
      try {
        const level = window.ExambrowserBridge.getBatteryLevel();
        setBatteryLevel(level);
      } catch (e) {}
    }
  }, []);

  // Countdown Exam Timer & Realtime Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds(prev => (prev > 0 ? prev - 1 : 0));
      
      const now = new Date();
      setRealtimeClock(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleHelpClick = () => {
    setHelpRequested(true);
    if (onRequestHelp) onRequestHelp();
    alert('Sinyal Bantuan telah dikirim ke Dashboard Proktor/Pengawas Ruang.');
  };

  const isLowTime = timeLeftSeconds < 300; // less than 5 mins

  return (
    <div className="bg-gradient-to-r from-anbk-blue to-blue-900 text-white px-3 py-2 flex items-center justify-between shadow-md sticky top-0 z-40">
      
      {/* Left: Student Info */}
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
          <User className="w-4 h-4 text-yellow-300" />
        </div>
        <div className="leading-tight">
          <div className="font-bold text-xs md:text-sm truncate max-w-[140px] sm:max-w-[220px]">
            {studentInfo?.name || 'Siswa SMP THHK'}
          </div>
          <div className="text-[10px] text-blue-200 font-medium">
            Kelas {studentInfo?.class || '8A'} • LJK Kertas
          </div>
        </div>
      </div>

      {/* Center: Countdown Exam Timer */}
      <div className={`px-3 py-1 rounded-xl flex items-center space-x-1.5 border ${
        isLowTime ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-white/10 border-white/20 text-yellow-300'
      }`}>
        <Clock className="w-4 h-4" />
        <span className="font-mono font-extrabold text-sm md:text-base tracking-wider">
          {formatTimer(timeLeftSeconds)}
        </span>
      </div>

      {/* Right: Clock, Battery & Proctor Help */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Realtime Clock & Battery */}
        <div className="hidden xs:flex flex-col items-end text-[10px] text-blue-100 font-mono leading-tight">
          <span className="font-bold">{realtimeClock}</span>
          <span className="flex items-center space-x-1 text-emerald-300">
            <Battery className="w-3 h-3" />
            <span>{batteryLevel}%</span>
          </span>
        </div>

        {/* Proctor Call Button */}
        <button
          onClick={handleHelpClick}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm ${
            helpRequested
              ? 'bg-yellow-400 text-gray-900 font-extrabold'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
          }`}
          title="Minta Bantuan Pengawas Ruang"
        >
          <Bell className="w-3.5 h-3.5 text-yellow-300" />
          <span className="hidden sm:inline">{helpRequested ? 'Bantuan Dikirim' : 'Panggil Pengawas'}</span>
        </button>
      </div>

    </div>
  );
}

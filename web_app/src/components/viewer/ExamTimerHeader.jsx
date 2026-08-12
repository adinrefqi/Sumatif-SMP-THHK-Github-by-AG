import React, { useState, useEffect, useRef } from 'react';
import { Clock, Battery, User } from 'lucide-react';
import { localExamStore } from '../../lib/supabase';

export default function ExamTimerHeader({ studentInfo, activeExam }) {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState((activeExam?.duration_minutes || 90) * 60);
  const [realtimeClock, setRealtimeClock] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(85);
  const lastHeartbeatRef = useRef(0);

  // Sync with Android Native Bridge if available
  useEffect(() => {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
      window.flutter_inappwebview
        .callHandler('ExambrowserBridge', 'getBattery')
        .then((level) => {
          if (typeof level === 'number') setBatteryLevel(level);
        })
        .catch(() => {});
    } else if (window.ExambrowserBridge && window.ExambrowserBridge.getBatteryLevel) {
      try {
        const level = window.ExambrowserBridge.getBatteryLevel();
        if (typeof level === 'number') setBatteryLevel(level);
      } catch (e) {}
    }
  }, []);

  // Countdown Exam Timer & Realtime Clock + Heartbeat
  useEffect(() => {
    const HEARTBEAT_INTERVAL_MS = 30000; // local heartbeat every 30s (battery friendly)
    const REMOTE_SYNC_INTERVAL_MS = 60000; // remote last-seen sync every 60s (only if Supabase)

    const sendHeartbeat = () => {
      const session = localExamStore.getActiveSession();
      const now = Date.now();
      localExamStore.touchLastHeartbeat();
      if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
        window.flutter_inappwebview
          .callHandler('ExambrowserBridge', 'heartbeat', {
            sessionId: session?.sessionId || null,
            studentId: session?.studentId || null,
            ts: now,
          })
          .catch(() => {});
      }
    };

    const syncRemoteLastSeen = () => {
      const session = localExamStore.getActiveSession();
      // Optional remote "last seen" sync (Supabase only, no-op otherwise)
      if (session?.sessionId) {
        localExamStore.touchLastSeenRemote(session.sessionId);
      }
    };

    const timer = setInterval(() => {
      setTimeLeftSeconds(prev => (prev > 0 ? prev - 1 : 0));

      const now = new Date();
      setRealtimeClock(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      const elapsed = now.getTime() - lastHeartbeatRef.current;
      // Local heartbeat every 30s
      if (elapsed >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = now.getTime();
        sendHeartbeat();
      }
      // Remote sync every 60s (throttled separately to save battery/bandwidth)
      if (elapsed >= REMOTE_SYNC_INTERVAL_MS) {
        syncRemoteLastSeen();
      }
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

  const isLowTime = timeLeftSeconds < 300; // less than 5 mins

  return (
    <div className="bg-console-panel border-b border-console-line px-3 h-12 flex items-center justify-between gap-2 sticky top-0 z-40">

      {/* Left: Student Info */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 shrink-0 bg-console-raised border border-console-line rounded-md flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-bold text-xs text-ink-strong truncate max-w-[130px] sm:max-w-[220px]">
            {studentInfo?.name || 'Siswa SMP THHK'}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-ink-faint font-semibold">
            Kelas {studentInfo?.class || '8A'} • Exambrowser
          </div>
        </div>
      </div>

      {/* Center: Countdown Exam Timer */}
      <div className={`h-8 px-3 rounded-md flex items-center gap-1.5 border font-mono ${
        isLowTime
          ? 'bg-bad/15 text-bad border-bad/40 animate-pulse'
          : 'bg-console-raised text-accent-soft border-console-line'
      }`}>
        <Clock className="w-3.5 h-3.5" />
        <span className="font-extrabold text-sm md:text-base tracking-widest tabular-nums">
          {formatTimer(timeLeftSeconds)}
        </span>
      </div>

      {/* Right: Clock & Battery */}
      <div className="flex items-center gap-2">
        <div className="hidden xs:flex flex-col items-end text-[9px] text-ink-faint font-mono leading-tight">
          <span className="font-bold text-ink-muted tabular-nums">{realtimeClock}</span>
          <span className="flex items-center gap-1 text-ok">
            <Battery className="w-3 h-3" />
            <span className="tabular-nums">{batteryLevel}%</span>
          </span>
        </div>
      </div>

    </div>
  );
}

import React from 'react';
import { KeyRound, Monitor, BookOpen, Wifi, WifiOff } from 'lucide-react';

export default function Navbar({ activeMode, setActiveMode, isOnline, onExitApp }) {
  return (
    <header className="bg-console-panel border-b border-console-line sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo.png" alt="Logo SMP THHK Tegal" className="w-8 h-8 shrink-0 object-contain drop-shadow" />
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm text-ink-strong leading-tight truncate">
              SMP THHK TEGAL
            </h1>
            <p className="text-[11px] uppercase tracking-label text-accent font-bold hidden sm:block">
              Ujian Sumatif • Exambrowser ANBK
            </p>
          </div>
        </div>

        {/* Right: Status & Controls */}
        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <div
            role="status"
            aria-live="polite"
            className={`h-10 px-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
            isOnline
              ? 'bg-ok/10 text-ok border-ok/25'
              : 'bg-bad/10 text-bad border-bad/25'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full live-dot ${isOnline ? 'bg-ok' : 'bg-bad'}`} />
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Mode Switcher */}
          <button
            onClick={() => setActiveMode(activeMode === 'student' ? 'admin' : 'student')}
            aria-label={activeMode === 'student' ? 'Buka Panel Proktor' : 'Buka Modul Siswa'}
            className="h-10 px-3 bg-console-raised hover:bg-console-line border border-console-line rounded-md text-[11px] font-bold text-ink flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
          >
            {activeMode === 'student' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-accent" />
                <span>Panel Proktor</span>
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5 text-ok" />
                <span>Modul Siswa</span>
              </>
            )}
          </button>

          {/* Exit */}
          <button
            onClick={onExitApp}
            aria-label="Keluar Aplikasi (Password Diperlukan)"
            className="h-10 px-2.5 bg-bad/10 hover:bg-bad/20 border border-bad/25 text-bad rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-bad/50 focus-visible:outline-none"
            title="Keluar Aplikasi (Password Diperlukan)"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}

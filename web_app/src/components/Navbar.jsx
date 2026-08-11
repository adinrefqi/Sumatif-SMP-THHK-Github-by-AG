import React from 'react';
import { ShieldAlert, RefreshCw, KeyRound, Monitor, BookOpen, Wifi } from 'lucide-react';

export default function Navbar({ activeMode, setActiveMode, isOnline, onExitApp }) {
  return (
    <header className="bg-anbk-blue text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Left: School Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-white text-anbk-blue rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">
            THHK
          </div>
          <div>
            <h1 className="font-bold text-base md:text-lg leading-tight tracking-wide">
              SMP THHK - UJIAN SUMATIF
            </h1>
            <p className="text-xs text-blue-100 font-medium hidden sm:block">
              Exambrowser WebView • Standard Pusmendik ANBK
            </p>
          </div>
        </div>

        {/* Right: Mode Switcher & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Connection Status */}
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 ${
            isOnline ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
          }`}>
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* Mode Switcher */}
          <button
            onClick={() => setActiveMode(activeMode === 'student' ? 'admin' : 'student')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-white/20"
          >
            {activeMode === 'student' ? (
              <>
                <Monitor className="w-4 h-4 text-yellow-300" />
                <span>Panel Proktor</span>
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 text-emerald-300" />
                <span>Modul Siswa</span>
              </>
            )}
          </button>

          {/* Exit App / Android Password Trigger */}
          <button
            onClick={onExitApp}
            className="px-2.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
            title="Keluar Aplikasi (Password Required)"
          >
            <KeyRound className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}

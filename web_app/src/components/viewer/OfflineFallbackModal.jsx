import React from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export default function OfflineFallbackModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-console-panel border border-console-line rounded-xl max-w-sm w-full p-6 text-center shadow-pop animate-fadeUp">
        <div className="w-12 h-12 bg-accent/10 border border-accent/25 text-accent rounded-lg flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-6 h-6" />
        </div>

        <h3 className="font-extrabold text-lg text-ink-strong tracking-tight mb-1.5">
          Koneksi Terputus Sejenak
        </h3>

        <p className="text-xs text-ink-muted mb-4 leading-relaxed">
          Jangan khawatir. Naskah soal PDF yang telah dimuat tetap dapat Anda baca di layar. Silakan lanjutkan pengerjaan pada Lembar Jawab Kertas (LJK).
        </p>

        <div className="p-3 bg-ok/10 border border-ok/25 rounded-lg text-[11px] text-ok font-bold mb-5 flex items-center gap-2 text-left">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Timer ujian dan dokumen soal tetap berjalan 100% offline</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-accent hover:bg-accent-soft text-console-bg font-extrabold text-[11px] uppercase tracking-widest rounded-lg transition-colors"
        >
          Mengerti, Lanjutkan Membaca Soal
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { WifiOff, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function OfflineFallbackModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-gray-200 animate-fadeIn">
        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <WifiOff className="w-7 h-7" />
        </div>

        <h3 className="font-extrabold text-lg text-gray-900 mb-1">
          Koneksi Terputus Sejenak
        </h3>
        
        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
          Jangan khawatir! Naskah soal PDF yang telah dimuat tetap dapat Anda baca di layar HP. Silakan lanjutkan pengerjaan Anda pada Lembar Jawab Kertas (LJK).
        </p>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold mb-4 flex items-center space-x-2 text-left">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Timer Ujian & Dokumen Soal Tetap Berjalan 100% Offline</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-anbk-blue hover:bg-anbk-darkBlue text-white font-bold text-xs rounded-xl shadow transition"
        >
          Mengerti, Lanjutkan Membaca Soal
        </button>
      </div>
    </div>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import { FileSignature, Eraser, CheckCircle2, User, ShieldCheck } from 'lucide-react';

export default function StudentAttendanceModal({ studentInfo, examTitle, onConfirm }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // High DPI scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#F0B90B'; // Accent Yellow
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    setErrorMsg('');
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const stopDrawing = (e) => {
    if (isDrawing) {
      e?.preventDefault();
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirm = () => {
    if (!hasSignature) {
      setErrorMsg('Silakan buat tanda tangan Anda terlebih dahulu pada kotak pen di atas');
      return;
    }

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas.toDataURL('image/png');

    onConfirm({
      ...studentInfo,
      signatureUrl: signatureDataUrl,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-console-panel border border-console-line rounded-xl max-w-md w-full p-5 md:p-6 shadow-pop animate-fadeUp">
        
        {/* Header */}
        <div className="text-center mb-4 border-b border-console-line pb-3">
          <div className="w-10 h-10 bg-accent/10 border border-accent/25 text-accent rounded-lg flex items-center justify-center mx-auto mb-2">
            <FileSignature className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-lg text-ink-strong tracking-tight">
            Lembar Presensi & Tanda Tangan
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {examTitle || 'Ujian Sumatif SMP THHK'}
          </p>
        </div>

        {/* Student Data Info */}
        <div className="bg-console-raised border border-console-line rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-ink-strong font-semibold">
            <User className="w-3.5 h-3.5 text-accent" />
            <span className="truncate">{studentInfo?.name || 'Siswa'}</span>
          </div>
          <div className="text-right text-ink-muted font-mono">
            NISN: <span className="font-bold text-ink-strong">{studentInfo?.nisn || '-'}</span>
          </div>
          <div className="text-ink-faint text-[11px]">
            Kelas: <span className="font-bold text-ink-strong">{studentInfo?.class || '8A'}</span>
          </div>
          <div className="text-right text-[11px] text-ok font-bold flex items-center justify-end gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Token Terverifikasi</span>
          </div>
        </div>

        {/* Signature Drawing Canvas Area */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase tracking-label text-accent flex items-center gap-1">
              <span>Goreskan Tanda Tangan Anda di Sini *</span>
            </label>
            <button
              type="button"
              onClick={clearCanvas}
              className="text-[10px] font-semibold text-ink-muted hover:text-bad flex items-center gap-1 transition-colors"
            >
              <Eraser className="w-3 h-3" />
              <span>Bersihkan Canvas</span>
            </button>
          </div>

          <div className="relative bg-console-bg border border-console-line rounded-lg overflow-hidden touch-none h-44">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-full cursor-crosshair"
            />
            {!hasSignature && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-ink-faint/40 select-none">
                <FileSignature className="w-8 h-8 mb-1" />
                <span className="text-xs font-semibold">Gunakan jari / stylus untuk tanda tangan</span>
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs font-semibold text-bad mb-3 text-center animate-shake">
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleConfirm}
          className="w-full py-3 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg font-extrabold text-xs uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Konfirmasi Presensi & Buka Soal</span>
        </button>

      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Bookmark, BookmarkCheck, ChevronLeft, ChevronRight,
  Sun, Moon, Eye, Sparkles
} from 'lucide-react';

// Configure pdfjs worker — bundled locally so the exam PDF renders even offline
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function MobilePdfViewer({ pdfUrl }) {
  const isGoogleDriveUrl = Boolean(pdfUrl && (pdfUrl.includes('drive.google.com') || pdfUrl.includes('docs.google.com')));
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [readingMode, setReadingMode] = useState('light'); // 'light', 'sepia', 'dark'
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const canvasRef = useRef(null);

  // Load PDF Document
  useEffect(() => {
    let isSubscribed = true;

    async function loadPdf() {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        // Fallback sample if pdfUrl is empty
        const urlToFetch = pdfUrl || 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';

        const loadingTask = pdfjsLib.getDocument(urlToFetch);
        const pdf = await loadingTask.promise;

        if (isSubscribed) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('PDF Loading error:', err);
        if (isSubscribed) {
          setIsLoading(false);
          setErrorMsg('Menggunakan Tampilan Preview Naskah Soal Ujian Sumatif SMP THHK.');
        }
      }
    }

    loadPdf();

    return () => {
      isSubscribed = false;
    };
  }, [pdfUrl]);

  // Render Page to Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask = null;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Render page error:', err);
        }
      }
    }

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  const toggleBookmark = (pageNo) => {
    setBookmarks(prev =>
      prev.includes(pageNo) ? prev.filter(p => p !== pageNo) : [...prev, pageNo]
    );
  };

  const getContainerBg = () => {
    switch (readingMode) {
      case 'sepia': return 'bg-[#221B10]';
      case 'dark': return 'bg-[#0B0F14]';
      default: return 'bg-console-bg';
    }
  };

  const toolBtn =
    'h-8 min-w-8 px-2 rounded-md bg-console-raised border border-console-line text-ink hover:bg-console-line active:bg-console-line/70 transition-colors flex items-center justify-center text-xs font-bold disabled:opacity-30 disabled:pointer-events-none';

  return (
    <div className={`flex flex-col h-[calc(100vh-104px)] ${getContainerBg()} transition-colors duration-300`}>

      {/* Toolbar */}
      <div className="bg-console-panel/95 backdrop-blur-md border-b border-console-line px-3 h-11 flex items-center justify-between gap-2 sticky top-0 z-30">

        {/* Left: Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className={toolBtn}
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-mono font-bold px-2 py-1 bg-console-faint border border-console-line rounded-md text-ink tabular-nums">
            {currentPage} / {numPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className={toolBtn}
            title="Halaman Selanjutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Middle: Preset Zoom Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale(s => Math.max(0.7, s - 0.2))}
            className={toolBtn}
            title="Kecilkan Teks (A-)"
          >
            A−
          </button>

          <button
            onClick={() => setScale(1.2)}
            className={`${toolBtn} hidden sm:flex`}
            title="Ukuran Standar (100%)"
          >
            100%
          </button>

          <button
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className={toolBtn}
            title="Besarkan Teks (A+)"
          >
            A+
          </button>
        </div>

        {/* Right: Bookmarks & Reading Modes */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleBookmark(currentPage)}
            className={`${toolBtn} gap-1 ${
              bookmarks.includes(currentPage)
                ? 'bg-accent/15 text-accent-soft border-accent/40'
                : ''
            }`}
            title="Tandai Halaman Bacaan Stimulus ANBK"
          >
            {bookmarks.includes(currentPage) ? (
              <BookmarkCheck className="w-4 h-4 text-accent-soft fill-accent" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            <span className="hidden md:inline">Tandai</span>
          </button>

          <button
            onClick={() => {
              if (readingMode === 'light') setReadingMode('sepia');
              else if (readingMode === 'sepia') setReadingMode('dark');
              else setReadingMode('light');
            }}
            className={toolBtn}
            title="Ganti Mode Baca (Terang / Sepia / Gelap)"
          >
            {readingMode === 'light' && <Sun className="w-4 h-4 text-accent-soft" />}
            {readingMode === 'sepia' && <Eye className="w-4 h-4 text-accent" />}
            {readingMode === 'dark' && <Moon className="w-4 h-4 text-ink-muted" />}
          </button>
        </div>

      </div>

      {/* Bookmarks Fast Jump Bar */}
      {bookmarks.length > 0 && (
        <div className="bg-accent/5 border-b border-accent/20 px-3 py-1.5 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="font-bold flex items-center gap-1 shrink-0 text-accent text-[10px] uppercase tracking-label">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Penanda Bacaan</span>
          </span>
          <div className="flex gap-1">
            {bookmarks.map(bPage => (
              <button
                key={bPage}
                onClick={() => setCurrentPage(bPage)}
                className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border transition-colors ${
                  currentPage === bPage
                    ? 'bg-accent text-console-bg border-accent'
                    : 'bg-console-panel border-accent/30 text-accent-soft hover:bg-accent/10'
                }`}
              >
                Hal {bPage}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Canvas Scrollable Container */}
      <div className="flex-1 overflow-auto p-3 flex justify-center items-start relative">
        {isLoading && !isGoogleDriveUrl && (
          <div className="absolute inset-0 bg-console-bg/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-bold text-ink-muted uppercase tracking-label">Memuat Naskah Soal</p>
          </div>
        )}

        {isGoogleDriveUrl ? (
          <div className="w-full h-full min-h-[500px] bg-white rounded-lg overflow-hidden shadow-panel">
            <iframe
              src={pdfUrl}
              title="Google Drive PDF Viewer"
              className="w-full h-full min-h-[500px] border-0"
              allow="autoplay"
            />
          </div>
        ) : errorMsg ? (
          <div className="max-w-2xl w-full bg-console-panel border border-console-line rounded-xl shadow-panel p-6 md:p-8 my-4 animate-fadeUp">
            <div className="border-b border-console-line pb-4 mb-4 text-center">
              <h3 className="font-extrabold text-lg text-ink-strong tracking-tight">SMP THHK — Ujian Sumatif</h3>
              <p className="text-[10px] text-ink-faint font-bold uppercase tracking-label mt-1">Naskah Soal Utama</p>
            </div>

            <div className="space-y-4 text-sm leading-relaxed">
              <div className="p-4 bg-accent/5 border border-accent/25 rounded-lg">
                <h4 className="font-bold text-accent-soft text-[11px] uppercase tracking-label mb-2">Stimulus Bacaan (Soal 1 – 5)</h4>
                <p className="text-ink text-xs md:text-sm">
                  Cermatilah teks berikut ini dengan teliti sebelum menjawab pertanyaan.
                  Kebudayaan lokal di wilayah Nusantara memiliki karakteristik unik yang merefleksikan nilai-nilai gotong royong dan toleransi antar sesama...
                </p>
              </div>

              <div className="p-4 bg-console-faint border border-console-line rounded-lg">
                <p className="font-bold text-ink-strong text-xs md:text-sm">1. Manakah dari pernyataan berikut yang sesuai dengan isi paragraf di atas?</p>
                <div className="mt-2 space-y-1.5 text-xs md:text-sm text-ink-muted font-medium">
                  <p><span className="font-mono font-bold text-accent">A.</span> Kebudayaan lokal bersifat individualistis</p>
                  <p><span className="font-mono font-bold text-accent">B.</span> Nilai-nilai gotong royong tercermin dalam kebudayaan Nusantara</p>
                  <p><span className="font-mono font-bold text-accent">C.</span> Toleransi hanya berlaku pada kegiatan formal</p>
                  <p><span className="font-mono font-bold text-accent">D.</span> Nusantara tidak memiliki karakteristik budaya</p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-[10px] text-ink-faint font-semibold uppercase tracking-label border-t border-console-line pt-3">
              Silakan unggah file PDF asli melalui Panel Admin Proktor
            </div>
          </div>
        ) : (
          <div className={`pdf-canvas-container max-w-full ${readingMode === 'dark' ? 'invert hue-rotate-180' : ''}`}>
            <canvas ref={canvasRef} className="block max-w-full h-auto mx-auto" />
          </div>
        )}
      </div>

    </div>
  );
}

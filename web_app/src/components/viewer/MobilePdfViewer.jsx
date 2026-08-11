import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ZoomIn, ZoomOut, Maximize2, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, 
  Sun, Moon, Eye, FileText, AlertCircle, Sparkles, Move
} from 'lucide-react';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function MobilePdfViewer({ pdfUrl }) {
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
      case 'sepia': return 'bg-[#FBF0D9] text-[#5F4B32]';
      case 'dark': return 'bg-[#121826] text-[#E5E7EB]';
      default: return 'bg-gray-100 text-gray-900';
    }
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-64px)] ${getContainerBg()} transition-colors duration-300`}>
      
      {/* Floating Toolbar Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-3 py-2 flex items-center justify-between shadow-sm sticky top-0 z-30 text-gray-800">
        
        {/* Left: Page Navigation */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 active:bg-gray-200 transition"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-xs font-mono font-bold px-2 py-1 bg-gray-100 rounded-md">
            Halaman {currentPage} / {numPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 active:bg-gray-200 transition"
            title="Halaman Selanjutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Middle: Preset Zoom Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setScale(s => Math.max(0.7, s - 0.2))}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold transition"
            title="Kecilkan Teks (A-)"
          >
            A-
          </button>

          <button
            onClick={() => setScale(1.2)}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold transition hidden sm:inline"
            title="Ukuran Standar (100%)"
          >
            100%
          </button>

          <button
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold transition"
            title="Besarkan Teks (A+)"
          >
            A+
          </button>
        </div>

        {/* Right: Bookmarks & Reading Modes */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Bookmark Stimulus Button */}
          <button
            onClick={() => toggleBookmark(currentPage)}
            className={`p-1.5 rounded-lg transition flex items-center space-x-1 text-xs font-semibold ${
              bookmarks.includes(currentPage)
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Tandai Halaman Bacaan Stimulus ANBK"
          >
            {bookmarks.includes(currentPage) ? (
              <BookmarkCheck className="w-4 h-4 text-yellow-600 fill-yellow-500" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            <span className="hidden md:inline">Tandai Bacaan</span>
          </button>

          {/* Reading Theme Toggle */}
          <button
            onClick={() => {
              if (readingMode === 'light') setReadingMode('sepia');
              else if (readingMode === 'sepia') setReadingMode('dark');
              else setReadingMode('light');
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-700 transition"
            title="Ganti Mode Baca (Terang / Sepia / Dark)"
          >
            {readingMode === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
            {readingMode === 'sepia' && <Eye className="w-4 h-4 text-amber-700" />}
            {readingMode === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>

      </div>

      {/* Bookmarks Fast Jump Drawer Bar if any */}
      {bookmarks.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center space-x-2 overflow-x-auto text-xs text-amber-900 font-medium shrink-0">
          <span className="font-bold flex items-center space-x-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Penanda Bacaan:</span>
          </span>
          <div className="flex space-x-1">
            {bookmarks.map(bPage => (
              <button
                key={bPage}
                onClick={() => setCurrentPage(bPage)}
                className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                  currentPage === bPage ? 'bg-amber-600 text-white' : 'bg-white border border-amber-300 text-amber-900'
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
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-20">
            <div className="w-10 h-10 border-4 border-anbk-blue border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-semibold text-gray-700">Memuat Naskah Soal PDF...</p>
          </div>
        )}

        {/* Fallback Mock Document if rendering canvas unavailable */}
        {errorMsg ? (
          <div className="max-w-2xl w-full bg-white p-6 md:p-8 rounded-xl shadow-md border border-gray-200 my-4 text-gray-800">
            <div className="border-b pb-4 mb-4 text-center">
              <h3 className="font-extrabold text-lg text-anbk-blue">SMP THHK - UJIAN SUMATIF</h3>
              <p className="text-xs text-gray-500 font-medium">NASKAH SOAL UTAMA • PETUNJUK PENGERJAAN PADA LJK KERTAS</p>
            </div>

            <div className="space-y-4 text-sm leading-relaxed">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-bold text-blue-900 mb-1">STIMULUS BACAAN (SOAL 1 - 5)</h4>
                <p className="text-gray-700 text-xs md:text-sm">
                  Cermatilah teks berikut ini dengan teliti sebelum mengisi lembar jawab kertas Anda! 
                  Kebudayaan lokal di wilayah Nusantara memiliki karakteristik unik yang merefleksikan nilai-nilai gotong royong dan toleransi antar sesama...
                </p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="font-bold text-gray-900">1. Manakah dari pernyataan berikut yang sesuai dengan isi paragraf di atas?</p>
                <div className="mt-2 space-y-1 text-xs md:text-sm text-gray-700 font-medium">
                  <p>A. Kebudayaan lokal bersifat individualistis</p>
                  <p>B. Nilai-nilai gotong royong tercermin dalam kebudayaan Nusantara</p>
                  <p>C. Toleransi hanya berlaku pada kegiatan formal</p>
                  <p>D. Nusantara tidak memiliki karakteristik budaya</p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-400 font-medium border-t pt-3">
              [ Silakan unggah file PDF asli melalui Panel Admin Proktor ]
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

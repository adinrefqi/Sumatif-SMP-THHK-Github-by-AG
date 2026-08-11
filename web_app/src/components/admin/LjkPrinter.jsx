import React, { useState } from 'react';
import { Printer, FileSpreadsheet, CheckSquare } from 'lucide-react';

export default function LjkPrinter() {
  const [paperSize, setPaperSize] = useState('A4');
  const [totalQuestions, setTotalQuestions] = useState(40);
  const [subjectName, setSubjectName] = useState('Bahasa Indonesia');
  const [gradeText, setGradeText] = useState('Kelas VIII (8)');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Printer className="w-5 h-5 text-anbk-blue" />
          <h2 className="font-bold text-gray-800 text-base md:text-lg">
            Generator & Cetak Lembar Jawab Kertas (LJK Fisik)
          </h2>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-anbk-blue hover:bg-anbk-darkBlue active:bg-blue-900 text-white font-bold text-xs md:text-sm rounded-lg shadow transition flex items-center space-x-2"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak LJK Sekarang</span>
        </button>
      </div>

      {/* Control settings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs font-medium">
        <div>
          <label className="block text-gray-700 font-semibold mb-1">Mata Pelajaran</label>
          <input
            type="text"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-anbk-blue"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-1">Tingkat Kelas</label>
          <input
            type="text"
            value={gradeText}
            onChange={(e) => setGradeText(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-anbk-blue"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-1">Jumlah Soal LJK</label>
          <select
            value={totalQuestions}
            onChange={(e) => setTotalQuestions(Number(e.target.value))}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-anbk-blue"
          >
            <option value="20">20 Soal</option>
            <option value="30">30 Soal</option>
            <option value="40">40 Soal</option>
            <option value="50">50 Soal</option>
          </select>
        </div>
      </div>

      {/* Printable Sheet View Container */}
      <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-inner printable-ljk font-sans">
        
        {/* Header LJK */}
        <div className="border-b-2 border-black pb-3 mb-4 text-center">
          <h2 className="font-extrabold text-lg uppercase tracking-wide text-black">
            YAYASAN PENDIDIKAN THHK - SMP THHK
          </h2>
          <h3 className="font-bold text-base text-black uppercase">
            LEMBAR JAWAB UJIAN SUMATIF (LJK)
          </h3>
          <p className="text-xs text-black italic">
            Tahun Ajaran 2025/2026 • Petunjuk: Silang (X) atau Lingkari jawaban dengan pulpen/pensil hitam
          </p>
        </div>

        {/* Student Identity Grid */}
        <div className="grid grid-cols-2 gap-4 border border-black p-3 rounded mb-4 text-xs font-bold text-black">
          <div className="space-y-1">
            <p>Nama Peserta : _________________________________</p>
            <p>NISN / No. Ujian : _________________________________</p>
            <p>Kelas / Ruang : {gradeText} / __________</p>
          </div>
          <div className="space-y-1">
            <p>Mata Pelajaran : {subjectName}</p>
            <p>Tanggal Ujian : _____ / _____ / 2026</p>
            <p>Tanda Tangan Siswa : _______________________</p>
          </div>
        </div>

        {/* Answer Bubbles Grid */}
        <div className="mb-4">
          <h4 className="font-bold text-xs text-black uppercase mb-2">
            BAGIAN A: PILIHAN GANDA (1 - {totalQuestions})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-black">
            {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((qNum) => (
              <div key={qNum} className="flex items-center justify-between border border-gray-400 px-2 py-1 rounded bg-white">
                <span className="w-6 text-gray-900">{qNum}.</span>
                <div className="flex space-x-1.5 text-[11px]">
                  <span className="w-5 h-5 border border-black rounded-full flex items-center justify-center">A</span>
                  <span className="w-5 h-5 border border-black rounded-full flex items-center justify-center">B</span>
                  <span className="w-5 h-5 border border-black rounded-full flex items-center justify-center">C</span>
                  <span className="w-5 h-5 border border-black rounded-full flex items-center justify-center">D</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section B: Essay Box */}
        <div>
          <h4 className="font-bold text-xs text-black uppercase mb-1">
            BAGIAN B: URAN / ESSAY
          </h4>
          <div className="border border-black min-h-[140px] p-2 rounded text-xs text-gray-500 italic">
            (Tuliskan jawaban uraian Anda di kolom ini dengan jelas)
          </div>
        </div>

        {/* Footer Signature */}
        <div className="mt-4 flex justify-between items-end text-xs font-bold text-black pt-2 border-t border-gray-300">
          <div>
            Nilai Uraian: _______
          </div>
          <div className="text-center">
            <p>Paraf Pengawas Ruang</p>
            <div className="h-10"></div>
            <p>( _______________________ )</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Users, UploadCloud, Plus, Trash2, Search, Download,
  CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import { adminListStudents, adminAddStudent, adminBulkAddStudents, adminDeleteStudent } from '../../lib/supabase';

const ROOMS = ['Ruang 1', 'Ruang 2', 'Ruang 3'];
const CLASSES = ['7', '8', '9'];

export default function StudentManager({ adminPin }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState('semua');

  // Manual form state
  const [nisn, setNisn] = useState('');
  const [name, setName] = useState('');
  const [classVal, setClassVal] = useState('8');
  const [roomVal, setRoomVal] = useState('Ruang 1');

  const fileInputRef = useRef(null);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const list = await adminListStudents(adminPin);
      setStudents(Array.isArray(list) ? list : []);
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal memuat daftar siswa: ${err.message || 'Terjadi kesalahan'}` });
      setStudents([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPin]);

  // ---- CSV parsing ----
  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length >= 3 && cols[0] && cols[1]) {
        // skip header if first row looks like a header
        if (i === 0 && /nisn/i.test(cols[0]) && /nama|name/i.test(cols[1])) continue;
        rows.push({
          nisn: cols[0],
          name: cols[1],
          class: cols[2] || '8',
          room: cols[3] || 'Ruang 1',
        });
      }
    }
    return rows;
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setMessage({ type: 'error', text: 'CSV kosong atau format salah. Gunakan kolom: nisn, name, class, room' });
        return;
      }
      await adminBulkAddStudents(adminPin, rows);
      setMessage({
        type: 'success',
        text: `Berhasil mengimpor ${rows.length} siswa dari CSV.`
      });
      await loadStudents();
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal membaca CSV: ${err.message}` });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const header = 'nisn,name,class,room\n0080000001,Budi Santoso,8,Ruang 1\n0080000002,Siti Aminah,9,Ruang 2\n';
    const blob = new Blob([header], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_daftar_siswa.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!nisn.trim() || !name.trim()) {
      setMessage({ type: 'error', text: 'NISN dan Nama wajib diisi' });
      return;
    }
    try {
      await adminAddStudent(adminPin, { nisn: nisn.trim(), name: name.trim(), class: classVal, room: roomVal });
      setMessage({ type: 'success', text: `Siswa ${name.trim()} berhasil ditambahkan.` });
      setNisn('');
      setName('');
      await loadStudents();
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal menambahkan siswa: ${err.message || 'Terjadi kesalahan'}` });
    }
  };

  const handleDelete = async (nisnToDelete, studentName) => {
    if (!window.confirm(`Hapus siswa ${studentName} (NISN ${nisnToDelete})?`)) return;
    try {
      await adminDeleteStudent(adminPin, nisnToDelete);
      setMessage({ type: 'success', text: `Siswa ${studentName} dihapus.` });
      await loadStudents();
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal menghapus siswa: ${err.message || 'Terjadi kesalahan'}` });
    }
  };

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.nisn?.includes(search);
    const matchRoom = roomFilter === 'semua' || s.room === roomFilter;
    return matchSearch && matchRoom;
  });

  const inputCls =
    'w-full px-3.5 py-2.5 bg-console-faint border border-console-line rounded-lg text-sm text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition';
  const labelCls = 'block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5';

  return (
    <div className="bg-console-panel border border-console-line rounded-xl shadow-panel p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-console-line pb-3 mb-5 gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-accent" />
          <div>
            <h2 className="font-extrabold text-ink-strong text-sm tracking-tight">
              Daftar Siswa Peserta Ujian ({students.length} Siswa)
            </h2>
            <p className="text-[11px] text-ink-muted">
              Hanya siswa terdaftar yang bisa masuk sesi ujian
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg mb-4 text-xs font-semibold flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-ok/10 text-ok border-ok/25' : 'bg-bad/10 text-bad border-bad/25'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Import & Manual Add */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* CSV Import */}
        <div className="bg-console-raised border border-console-line rounded-xl p-4">
          <h4 className="font-extrabold text-xs text-ink-strong uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-accent" />
            <span>Import Massal dari CSV</span>
          </h4>
          <div className="border-2 border-dashed border-accent/40 hover:border-accent rounded-lg p-4 text-center cursor-pointer transition-colors bg-accent/5 relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileText className="w-7 h-7 text-accent mx-auto mb-1" />
            <p className="text-xs font-bold text-ink-strong">Klik untuk pilih file CSV</p>
            <p className="text-[10px] text-ink-faint mt-0.5">Format kolom: nisn, name, class, room</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="mt-2.5 w-full py-2 bg-console-bg border border-console-line rounded-lg text-[11px] font-bold text-accent hover:border-accent/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Template CSV</span>
          </button>
        </div>

        {/* Manual Add */}
        <div className="bg-console-raised border border-console-line rounded-xl p-4">
          <h4 className="font-extrabold text-xs text-ink-strong uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-accent" />
            <span>Tambah Siswa Manual</span>
          </h4>
          <form onSubmit={handleManualAdd} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>NISN *</label>
                <input
                  type="text"
                  required
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="0080000001"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama Siswa"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Kelas</label>
                <select value={classVal} onChange={(e) => setClassVal(e.target.value)} className={inputCls}>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ruang</label>
                <select value={roomVal} onChange={(e) => setRoomVal(e.target.value)} className={inputCls}>
                  {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Siswa</span>
            </button>
          </form>
        </div>
      </div>

      {/* List with search & filter */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / NISN..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className={`${inputCls} sm:w-44`}
        >
          <option value="semua">Semua Ruang</option>
          {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-ink-muted italic py-6 text-center">Memuat daftar siswa...</p>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-console-line rounded-xl bg-console-bg/50">
          <Users className="w-8 h-8 text-ink-faint mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold text-ink-muted">Belum ada siswa terdaftar</p>
          <p className="text-[11px] text-ink-faint mt-0.5">Import CSV atau tambahkan manual di atas</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-console-line rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-console-line text-[10px] uppercase font-bold text-ink-muted bg-console-panel">
                <th className="py-2.5 px-3">NISN</th>
                <th className="py-2.5 px-3">Nama</th>
                <th className="py-2.5 px-3">Kelas</th>
                <th className="py-2.5 px-3">Ruang</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-console-line">
              {filtered.map((s) => (
                <tr key={s.nisn} className="hover:bg-console-faint/50">
                  <td className="py-2 px-3 font-mono text-ink-muted">{s.nisn}</td>
                  <td className="py-2 px-3 font-bold text-ink-strong">{s.name}</td>
                  <td className="py-2 px-3 text-accent font-bold">{s.class}</td>
                  <td className="py-2 px-3 text-ink-muted">{s.room}</td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => handleDelete(s.nisn, s.name)}
                      className="p-1.5 text-ink-faint hover:text-bad rounded transition-colors"
                      title="Hapus siswa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { saveMinutes } from '../../lib/supabase';

export default function OfficialMinutesForm({ proctorRoom, adminPin, onSubmitted }) {
  const roomInitial = proctorRoom || 'Ruang 1';

  const [proctorName, setProctorName] = useState('');
  const [roomNumber, setRoomNumber] = useState(roomInitial);
  const [subject, setSubject] = useState('Bahasa Indonesia');
  const [totalRegistered, setTotalRegistered] = useState(30);
  const [totalPresent, setTotalPresent] = useState(30);
  const [totalAbsent, setTotalAbsent] = useState(0);
  const [absentNotes, setAbsentNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('Pelaksanaan ujian berjalan aman, tertib, dan lancar.');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');

    const payload = {
      proctorName,
      roomNumber,
      subject,
      totalRegistered: Number(totalRegistered),
      totalPresent: Number(totalPresent),
      totalAbsent: Number(totalAbsent),
      absentNotes,
      generalNotes,
      date: new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      submittedAt: new Date().toISOString()
    };

    try {
      const res = await saveMinutes({ pin: adminPin, room: roomNumber, data: payload });
      if (onSubmitted) {
        onSubmitted(payload);
      }
    } catch (err) {
      setErrorMsg(`Gagal menyimpan Berita Acara: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 bg-console-faint border border-console-line rounded-lg text-sm text-ink-strong placeholder:text-ink-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/40 outline-none transition';
  const labelCls = 'block text-[10px] font-bold text-ink-muted uppercase tracking-label mb-1.5';

  return (
    <div className="bg-console-panel border border-console-line rounded-xl p-5 md:p-6 shadow-panel animate-fadeUp">
      <div className="flex items-center gap-2 border-b border-console-line pb-3 mb-5">
        <ClipboardList className="w-5 h-5 text-accent" />
        <div>
          <h3 className="font-extrabold text-ink-strong text-base tracking-tight">
            Berita Acara Pelaksanaan Ujian Sumatif
          </h3>
          <p className="text-xs text-ink-muted">
            Setiap Proktor/Pengawas wajib mengonfirmasi Berita Acara Ujian saat awal sesi.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-bad/10 border border-bad/25 text-bad text-xs font-semibold rounded-lg mb-4">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nama Proktor / Pengawas Ruangan *</label>
            <div className="relative">
              <input
                type="text"
                required
                value={proctorName}
                onChange={(e) => setProctorName(e.target.value)}
                placeholder="Contoh: Drs. H. Ahmad Wijaya"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Ruang Ujian *</label>
            <select
              value={roomNumber}
              disabled={Boolean(proctorRoom)}
              onChange={(e) => setRoomNumber(e.target.value)}
              className={inputCls}
            >
              <option value="Ruang 1">Ruang 1</option>
              <option value="Ruang 2">Ruang 2</option>
              <option value="Ruang 3">Ruang 3</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Mata Pelajaran Ujian</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Jumlah Peserta Terdaftar *</label>
            <input
              type="number"
              min="1"
              required
              value={totalRegistered}
              onChange={(e) => setTotalRegistered(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Jumlah Peserta Hadir *</label>
            <input
              type="number"
              min="0"
              required
              value={totalPresent}
              onChange={(e) => setTotalPresent(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Jumlah Peserta Tidak Hadir</label>
            <input
              type="number"
              min="0"
              value={totalAbsent}
              onChange={(e) => setTotalAbsent(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Nama Peserta Tidak Hadir & Alasan (Opsional)</label>
          <input
            type="text"
            value={absentNotes}
            onChange={(e) => setAbsentNotes(e.target.value)}
            placeholder="Contoh: Budi (Sakit), Siska (Izin)"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Catatan Pelaksanaan / Kejadian Khusus Ujian</label>
          <textarea
            rows={2}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Catatan kondisi kendala/ruangan..."
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 bg-accent hover:bg-accent-soft active:bg-accent-deep text-console-bg font-extrabold text-xs uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:pointer-events-none"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isSaving ? 'Menyimpan...' : 'Konfirmasi Berita Acara & Buka Rilis Token'}</span>
        </button>
      </form>
    </div>
  );
}

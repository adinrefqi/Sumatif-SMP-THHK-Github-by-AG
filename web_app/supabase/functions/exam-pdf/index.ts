// ============================================================
// Supabase Edge Function: smooth-api (dulu dinamai exam-pdf)
//
// Proxy PDF naskah ujian. Klien (siswa) TIDAK pernah menerima URL
// Google Drive. Mereka hanya menerima endpoint ini dengan session_id;
// function memvalidasi sesi & durasi, lalu mengambil PDF dari Drive
// di sisi server dan menyalurkan byte-nya.
//
// Deploy: Supabase Dashboard -> Edge Functions -> New Function
//   - Nama function di dashboard: smooth-api
//   - Secret yang wajib diisi (awalan SUPABASE_ dilarang oleh dashboard):
//       EXAM_PDF_SUPABASE_URL      = https://sksdgnsqzazmwzboofch.supabase.co
//       EXAM_PDF_SERVICE_ROLE_KEY  = (dari Project Settings -> API -> service_role)
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Normalisasi link Drive yang sudah tersimpan (bisa /file/d/<id>/preview
// atau /view). Edge function butuh link yang mengembalikan byte PDF.
function toDirectDownload(url: string): string {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m && m[1]) {
    return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }
  return url;
}

async function postgrest(url: string, serviceKey: string, path: string) {
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });
  return resp;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  const url = Deno.env.get("EXAM_PDF_SUPABASE_URL");
  const serviceKey = Deno.env.get("EXAM_PDF_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return json(500, { message: "Server belum dikonfigurasi (secret kosong)." });
  }

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId || !/^[0-9a-fA-F-]{36}$/.test(sessionId)) {
    return json(400, { message: "session_id tidak valid" });
  }

  // 1. Cari sesi siswa (service role bypass RLS).
  const sessionResp = await postgrest(
    url,
    serviceKey,
    `student_sessions?id=eq.${encodeURIComponent(sessionId)}&select=exam_id,started_at`,
  );
  if (!sessionResp.ok) {
    return json(502, { message: "Gagal membaca sesi" });
  }
  const sessions = await sessionResp.json();
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return json(404, { message: "Sesi tidak ditemukan" });
  }

  const session = sessions[0];
  const examId = session.exam_id;

  // 2. Ambil durasi & pdf_url naskah.
  const examResp = await postgrest(
    url,
    serviceKey,
    `exams?id=eq.${encodeURIComponent(examId)}&select=pdf_url,duration_minutes`,
  );
  if (!examResp.ok) {
    return json(502, { message: "Gagal membaca naskah" });
  }
  const exams = await examResp.json();
  if (!Array.isArray(exams) || exams.length === 0) {
    return json(404, { message: "Naskah tidak ditemukan" });
  }

  const exam = exams[0];
  if (!exam.pdf_url) {
    return json(404, { message: "Naskah belum terisi" });
  }

  // 3. Enforce durasi ujian (started_at + duration + grace 2 menit).
  const startedAt = Date.parse(session.started_at);
  const durationMs = (Number(exam.duration_minutes) || 90) * 60 * 1000;
  const graceMs = 2 * 60 * 1000;
  if (!Number.isFinite(startedAt) || Date.now() > startedAt + durationMs + graceMs) {
    return json(403, { message: "Durasi ujian telah berakhir" });
  }

  // 4. Ambil PDF dari Drive di sisi server.
  const driveResp = await fetch(toDirectDownload(exam.pdf_url), {
    redirect: "follow",
  });
  if (!driveResp.ok) {
    return json(502, { message: "Gagal mengambil naskah dari sumber" });
  }

  const contentType = driveResp.headers.get("content-type") || "application/pdf";
  return new Response(driveResp.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
});

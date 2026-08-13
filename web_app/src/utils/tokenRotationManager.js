/**
 * ANBK-style Token Rotation Utility (15-Minute Cycle)
 * generateToken & validateStudentToken dipindah ke server (SQL, Fase 1).
 * Yang tersisa hanya perhitungan tampilan countdown.
 */

export const TOKEN_INTERVAL_MS = 15 * 60 * 1000; // 15 Minutes
export const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 Minutes Grace Period for previous token

export function getTimeRemainingInTokenCycle(timestamp) {
  if (!timestamp) return { minutes: 0, seconds: 0, percentage: 0, isExpired: true };

  const elapsed = Date.now() - timestamp;
  const remainingMs = TOKEN_INTERVAL_MS - elapsed;

  if (remainingMs <= 0) {
    return { minutes: 0, seconds: 0, percentage: 0, isExpired: true };
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const percentage = Math.max(0, Math.min(100, (remainingMs / TOKEN_INTERVAL_MS) * 100));

  return { minutes, seconds, percentage, isExpired: false };
}

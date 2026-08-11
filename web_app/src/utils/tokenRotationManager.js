/**
 * ANBK-style Token Rotation Utility (15-Minute Cycle)
 */

export const TOKEN_INTERVAL_MS = 15 * 60 * 1000; // 15 Minutes
export const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 Minutes Grace Period for previous token

export function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars O, 0, I, 1
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function getTimeRemainingInTokenCycle(timestamp) {
  if (!timestamp) return { minutes: 15, seconds: 0, percentage: 100, isExpired: true };
  
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

export function validateStudentToken(inputToken, activeTokenObj, previousTokenObj = null) {
  if (!inputToken || !activeTokenObj) return false;
  
  const cleanInput = inputToken.trim().toUpperCase();
  
  // Check active token
  if (cleanInput === activeTokenObj.token.toUpperCase()) {
    const elapsed = Date.now() - activeTokenObj.timestamp;
    // Valid if within 15 minutes + grace period
    if (elapsed <= TOKEN_INTERVAL_MS + GRACE_PERIOD_MS) {
      return true;
    }
  }
  
  // Check previous token (within grace period)
  if (previousTokenObj && cleanInput === previousTokenObj.token.toUpperCase()) {
    const elapsed = Date.now() - previousTokenObj.timestamp;
    if (elapsed <= TOKEN_INTERVAL_MS + GRACE_PERIOD_MS) {
      return true;
    }
  }
  
  return false;
}

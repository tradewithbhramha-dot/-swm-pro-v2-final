/**
 * PIN Service - Secure PIN Storage and Verification
 * Handles PIN hashing, verification, and lockout mechanisms
 */

import crypto from "crypto";

const PIN_HASH_ALGORITHM = "sha256";
const PIN_SALT_LENGTH = 16;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 30;

/**
 * Hash PIN with salt for secure storage
 */
export function hashPIN(pin: string): string {
  const salt = crypto.randomBytes(PIN_SALT_LENGTH).toString("hex");
  const hash = crypto
    .createHash(PIN_HASH_ALGORITHM)
    .update(salt + pin)
    .digest("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify PIN against stored hash
 */
export function verifyPIN(pin: string, hashedPin: string): boolean {
  try {
    const [salt, hash] = hashedPin.split(":");
    if (!salt || !hash) return false;

    const computedHash = crypto
      .createHash(PIN_HASH_ALGORITHM)
      .update(salt + pin)
      .digest("hex");

    return computedHash === hash;
  } catch (error) {
    console.error("[PIN Verification] Error:", error);
    return false;
  }
}

/**
 * Validate PIN format (4 digits)
 */
export function isValidPINFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Check if PIN is locked due to too many attempts
 */
export function isPINLocked(
  pinAttempts: number,
  pinLockedUntil: Date | null
): boolean {
  if (pinAttempts >= MAX_PIN_ATTEMPTS) {
    if (pinLockedUntil && new Date() < pinLockedUntil) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate PIN lockout expiry time
 */
export function getPINLockoutExpiry(): Date {
  const now = new Date();
  return new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60 * 1000);
}

/**
 * Get remaining PIN lockout time in seconds
 */
export function getPINLockoutRemainingTime(pinLockedUntil: Date | null): number {
  if (!pinLockedUntil) return 0;

  const remaining = Math.floor(
    (pinLockedUntil.getTime() - Date.now()) / 1000
  );
  return Math.max(0, remaining);
}

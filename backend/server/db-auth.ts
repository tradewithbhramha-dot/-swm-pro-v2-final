/**
 * Database functions for OTP and PIN authentication
 * Extends server/db.ts with security-related operations
 */

import { eq, and } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Update user PIN (hashed)
 */
export async function updateUserPIN(userId: number, hashedPin: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      pin: hashedPin,
      pinAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Increment PIN attempt counter
 */
export async function incrementPINAttempts(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await getDb()
    .then((db) => db?.select().from(users).where(eq(users.id, userId)).limit(1))
    .then((result) => (result && result.length > 0 ? result[0] : null));

  if (!user) throw new Error("User not found");

  const newAttempts = (user.pinAttempts || 0) + 1;

  await db
    .update(users)
    .set({
      pinAttempts: newAttempts,
      pinLockedUntil: newAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Reset PIN attempts after successful verification
 */
export async function resetPINAttempts(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      pinAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Get user PIN and lockout status
 */
export async function getUserPINStatus(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      pin: users.pin,
      pinAttempts: users.pinAttempts,
      pinLockedUntil: users.pinLockedUntil,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Update user phone number for OTP
 */
export async function updateUserPhone(userId: number, phone: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({
      phone,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Get user by phone number
 */
export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Check if phone number is already registered
 */
export async function isPhoneRegistered(phone: string, excludeUserId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  let query = db.select().from(users).where(eq(users.phone, phone));

  if (excludeUserId) {
    query = query.where(eq(users.id, excludeUserId));
  }

  const result = await query.limit(1);
  return result.length > 0;
}

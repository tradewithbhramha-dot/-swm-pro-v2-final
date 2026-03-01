/**
 * Authentication Router with Real Twilio SMS OTP Integration
 * Handles OTP request, verification, and PIN setup with production-grade security
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import * as db from "./db";
import * as dbAuth from "./db-auth";
import { sendOTPViaSMS, verifyOTP, clearOTPRecord, isOTPVerified, getOTPRemainingTime } from "./services/sms-service";
import { hashPIN, verifyPIN as verifyPINHash, isPINLocked, getPINLockoutRemainingTime, isValidPINFormat } from "./services/pin-service";

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  /**
   * Request OTP via Twilio SMS
   * Validates phone number and sends 6-digit OTP
   */
  requestOtp: publicProcedure
    .input(z.object({
      phone: z.string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
        .describe("Phone number in E.164 format or 10+ digits"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Normalize phone number to E.164 format if needed
        let phone = input.phone;
        if (!phone.startsWith("+")) {
          // Assume India (+91) if no country code
          if (phone.length === 10) {
            phone = "+91" + phone;
          } else if (phone.length === 12 && phone.startsWith("91")) {
            phone = "+" + phone;
          }
        }

        // Check if phone is already registered (optional - for worker registration)
        const existingUser = await dbAuth.getUserByPhone(phone);
        if (existingUser) {
          // Allow OTP for existing users (for PIN reset/update)
          console.log(`[OTP] Resending OTP for existing user: ${phone}`);
        }

        // Send OTP via Twilio
        const result = await sendOTPViaSMS(phone);

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.message,
          });
        }

        return {
          success: true,
          message: "OTP sent successfully. Valid for 10 minutes.",
          phone,
          expiresIn: 600, // 10 minutes in seconds
        };
      } catch (error) {
        console.error("[Auth] OTP request error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to send OTP",
        });
      }
    }),

  /**
   * Verify OTP received via SMS
   * Checks OTP validity, expiry, and attempt limits
   */
  verifyOtp: publicProcedure
    .input(z.object({
      phone: z.string().min(10),
      otp: z.string().length(6).regex(/^\d+$/, "OTP must be 6 digits"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Normalize phone
        let phone = input.phone;
        if (!phone.startsWith("+")) {
          if (phone.length === 10) {
            phone = "+91" + phone;
          } else if (phone.length === 12 && phone.startsWith("91")) {
            phone = "+" + phone;
          }
        }

        // Verify OTP
        const result = await verifyOTP(phone, input.otp);

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.message,
          });
        }

        return {
          success: true,
          message: "OTP verified successfully",
          verified: result.verified,
          phone,
        };
      } catch (error) {
        console.error("[Auth] OTP verification error:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "OTP verification failed",
        });
      }
    }),

  /**
   * Set or update user PIN after OTP verification
   * Only available to authenticated users
   */
  setPIN: protectedProcedure
    .input(z.object({
      pin: z.string()
        .length(4)
        .regex(/^\d+$/, "PIN must be 4 digits")
        .describe("4-digit numeric PIN"),
      confirmPin: z.string()
        .length(4)
        .regex(/^\d+$/, "Confirm PIN must be 4 digits"),
    }).refine((data) => data.pin === data.confirmPin, {
      message: "PINs do not match",
      path: ["confirmPin"],
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user.phone) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Phone number not set for user. Please update your profile.",
          });
        }

        // Verify OTP was completed for this phone
        if (!isOTPVerified(ctx.user.phone)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "OTP verification required before setting PIN",
          });
        }

        // Validate PIN format
        if (!isValidPINFormat(input.pin)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "PIN must be 4 digits",
          });
        }

        // Hash and store PIN
        const hashedPin = hashPIN(input.pin);
        await dbAuth.updateUserPIN(ctx.user.id, hashedPin);

        // Clear OTP record after successful PIN setup
        clearOTPRecord(ctx.user.phone);

        console.log(`[Auth] PIN set successfully for user ${ctx.user.id}`);

        return {
          success: true,
          message: "PIN set successfully. You can now use PIN for authentication.",
        };
      } catch (error) {
        console.error("[Auth] PIN setup error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to set PIN",
        });
      }
    }),

  /**
   * Verify PIN for worker authentication
   * Implements lockout after 5 failed attempts
   */
  verifyPIN: publicProcedure
    .input(z.object({
      userId: z.number().positive(),
      pin: z.string()
        .length(4)
        .regex(/^\d+$/, "PIN must be 4 digits"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Get user and PIN status
        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        if (!user.pin) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "PIN not set for this user",
          });
        }

        // Check if PIN is locked
        if (isPINLocked(user.pinAttempts || 0, user.pinLockedUntil)) {
          const remainingTime = getPINLockoutRemainingTime(user.pinLockedUntil);
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `PIN is locked. Try again in ${remainingTime} seconds.`,
          });
        }

        // Verify PIN hash
        if (!verifyPINHash(input.pin, user.pin)) {
          // Increment failed attempts
          await dbAuth.incrementPINAttempts(input.userId);
          const updatedUser = await db.getUserById(input.userId);
          const remainingAttempts = 5 - (updatedUser?.pinAttempts || 0);

          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: `Invalid PIN. ${remainingAttempts} attempts remaining.`,
          });
        }

        // Reset attempts on successful verification
        await dbAuth.resetPINAttempts(input.userId);

        console.log(`[Auth] PIN verified successfully for user ${input.userId}`);

        return {
          success: true,
          message: "PIN verified successfully",
          userId: input.userId,
        };
      } catch (error) {
        console.error("[Auth] PIN verification error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "PIN verification failed",
        });
      }
    }),

  /**
   * Update user phone number and trigger OTP
   * Used during worker registration or phone update
   */
  updatePhoneAndRequestOTP: protectedProcedure
    .input(z.object({
      phone: z.string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Normalize phone
        let phone = input.phone;
        if (!phone.startsWith("+")) {
          if (phone.length === 10) {
            phone = "+91" + phone;
          } else if (phone.length === 12 && phone.startsWith("91")) {
            phone = "+" + phone;
          }
        }

        // Check if phone is already registered to another user
        const existingUser = await dbAuth.getUserByPhone(phone);
        if (existingUser && existingUser.id !== ctx.user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This phone number is already registered",
          });
        }

        // Update phone in database
        await dbAuth.updateUserPhone(ctx.user.id, phone);

        // Send OTP
        const result = await sendOTPViaSMS(phone);

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.message,
          });
        }

        return {
          success: true,
          message: "Phone updated and OTP sent",
          phone,
          expiresIn: 600,
        };
      } catch (error) {
        console.error("[Auth] Phone update error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update phone",
        });
      }
    }),

  /**
   * Get OTP status (remaining time)
   */
  getOTPStatus: publicProcedure
    .input(z.object({
      phone: z.string().min(10),
    }))
    .query(({ input }) => {
      try {
        let phone = input.phone;
        if (!phone.startsWith("+")) {
          if (phone.length === 10) {
            phone = "+91" + phone;
          } else if (phone.length === 12 && phone.startsWith("91")) {
            phone = "+" + phone;
          }
        }

        const remainingTime = getOTPRemainingTime(phone);
        const isVerified = isOTPVerified(phone);

        return {
          success: true,
          remainingTime,
          isVerified,
          phone,
        };
      } catch (error) {
        console.error("[Auth] OTP status error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get OTP status",
        });
      }
    }),
});

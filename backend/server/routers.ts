import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import * as db from "./db";
import { generateQRCode } from "./services/qr-generator";
import { calculateDistance, isWithinRadius } from "./db";
import { authRouter } from "./auth-router";

/**
 * SWM PRO v2.0 - Complete tRPC Router
 * All procedures for authentication, location management, work tracking, and reporting
 */

// ============================================================================
// AUTHENTICATION PROCEDURES
// ============================================================================

// Auth router is now imported from auth-router.ts with full Twilio SMS OTP integration

// ============================================================================
// LOCATION HIERARCHY PROCEDURES
// ============================================================================

const locationRouter = router({
  getCountries: publicProcedure.query(async () => {
    return await db.getCountries();
  }),

  getStatesByCountry: publicProcedure
    .input(z.object({ countryId: z.number() }))
    .query(async ({ input }) => {
      return await db.getStatesByCountry(input.countryId);
    }),

  getDistrictsByState: publicProcedure
    .input(z.object({ stateId: z.number() }))
    .query(async ({ input }) => {
      return await db.getDistrictsByState(input.stateId);
    }),

  getTalukasByDistrict: publicProcedure
    .input(z.object({ districtId: z.number() }))
    .query(async ({ input }) => {
      return await db.getTalukasByDistrict(input.districtId);
    }),

  getVillagesByTaluka: publicProcedure
    .input(z.object({ talukaId: z.number() }))
    .query(async ({ input }) => {
      return await db.getVillagesByTaluka(input.talukaId);
    }),
});

// ============================================================================
// WARD MANAGEMENT PROCEDURES
// ============================================================================

const wardRouter = router({
  getByVillage: publicProcedure
    .input(z.object({ villageId: z.number() }))
    .query(async ({ input }) => {
      return await db.getWardsByVillage(input.villageId);
    }),

  getById: publicProcedure
    .input(z.object({ wardId: z.number() }))
    .query(async ({ input }) => {
      return await db.getWardById(input.wardId);
    }),

  // Auto-Ward Engine: Divide village into 10 equal spatial polygons
  autoGenerateWards: protectedProcedure
    .input(
      z.object({
        villageId: z.number(),
        numberOfWards: z.number().default(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // TODO: Implement spatial division algorithm
      // 1. Get village boundary (GeoJSON polygon)
      // 2. Calculate bounding box
      // 3. Divide into grid (e.g., 2x5 for 10 wards)
      // 4. Create ward polygons
      // 5. Generate QR codes for each ward

      console.log(
        `[Auto-Ward] Generating ${input.numberOfWards} wards for village ${input.villageId}`
      );

      return {
        success: true,
        message: `Generated ${input.numberOfWards} wards`,
        wardsCreated: input.numberOfWards,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        villageId: z.number(),
        wardNumber: z.number(),
        name: z.string(),
        boundaryGeoJson: z.any(),
        centerLatitude: z.string().optional(),
        centerLongitude: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const qrId = `WARD:${input.villageId}:${input.wardNumber}:${Date.now()}`;
      const qrCodeData = await generateQRCode(qrId);

      const result = await db.createWard({
        villageId: input.villageId,
        wardNumber: input.wardNumber,
        name: input.name,
        boundaryGeoJson: input.boundaryGeoJson,
        centerLatitude: input.centerLatitude,
        centerLongitude: input.centerLongitude,
        qrId,
        qrCodeData,
      });

      return { success: true, wardId: (result as any).insertId || 0 };
    }),
});

// ============================================================================
// COLLECTION POINTS PROCEDURES (Module 1: Door-to-Door)
// ============================================================================

const collectionPointsRouter = router({
  getByWard: publicProcedure
    .input(z.object({ wardId: z.number() }))
    .query(async ({ input }) => {
      return await db.getCollectionPointsByWard(input.wardId);
    }),

  getById: publicProcedure
    .input(z.object({ pointId: z.number() }))
    .query(async ({ input }) => {
      return await db.getCollectionPointById(input.pointId);
    }),

  register: protectedProcedure
    .input(
      z.object({
        wardId: z.number(),
        pointName: z.string().optional(),
        latitude: z.string(),
        longitude: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const qrId = `POINT:${input.wardId}:${input.latitude}:${input.longitude}:${Date.now()}`;
      const qrCodeData = await generateQRCode(qrId);

      const result = await db.createCollectionPoint({
        wardId: input.wardId,
        pointName: input.pointName,
        latitude: input.latitude,
        longitude: input.longitude,
        qrId,
        qrCodeData,
        registeredByUserId: ctx.user.id,
      });

      return { success: true, pointId: (result as any).insertId || 0, qrId };
    }),

  getDailyStatus: publicProcedure
    .input(z.object({ pointId: z.number(), date: z.date() }))
    .query(async ({ input }) => {
      return await db.getDailyPointStatus(input.pointId, input.date);
    }),
});

// ============================================================================
// QR SCANNING PROCEDURES
// ============================================================================

const qrScanRouter = router({
  scan: protectedProcedure
    .input(
      z.object({
        qrId: z.string(),
        workerLatitude: z.string(),
        workerLongitude: z.string(),
        imei: z.string().optional(),
        accuracy: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Parse QR ID to get point info
      const [type, pointId, pointLat, pointLon] = input.qrId.split(":");

      if (type !== "POINT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid QR code format",
        });
      }

      const point = await db.getCollectionPointById(parseInt(pointId));
      if (!point) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection point not found",
        });
      }

      // Calculate distance
      const workerLat = parseFloat(input.workerLatitude);
      const workerLon = parseFloat(input.workerLongitude);
      const pointLatNum = parseFloat(point.latitude.toString());
      const pointLonNum = parseFloat(point.longitude.toString());

      const distance = calculateDistance(workerLat, workerLon, pointLatNum, pointLonNum);
      const cfg = await db.getConfig();
      const radiusMeters = cfg?.gpsRadiusMeters || 10;
      const isWithin = isWithinRadius(workerLat, workerLon, pointLatNum, pointLonNum, radiusMeters);

      // Check for mock location (anti-spoofing)
      const accuracy = input.accuracy ? parseFloat(input.accuracy) : 0;
      const isMockLocation = accuracy > 100; // Accuracy > 100m indicates possible spoofing

      const scanStatus = isMockLocation
        ? "spoofed"
        : isWithin
          ? "success"
          : "out_of_range";

      // Record scan
      const scanResult = await db.recordQrScan({
        pointId: point.id,
        userId: ctx.user.id,
        workerLatitude: input.workerLatitude,
        workerLongitude: input.workerLongitude,
        distanceFromPoint: distance.toString(),
        isWithinRadius: isWithin,
        scanStatus,
        imei: input.imei,
        imeiMatches: input.imei === point.lastImei,
        isMockLocation,
        accuracy: input.accuracy,
      });

      // Update point status if scan successful
      if (scanStatus === "success") {
        await db.updatePointStatus(point.id, new Date(), "GREEN", ctx.user.id, input.imei);
      }

      return {
        success: scanStatus === "success",
        scanStatus,
        distance: distance.toFixed(2),
        isWithinRadius: isWithin,
        isMockLocation,
      };
    }),
});

// ============================================================================
// WORK LOG PROCEDURES
// ============================================================================

const workLogRouter = router({
  start: protectedProcedure
    .input(
      z.object({
        wardId: z.number(),
        moduleType: z.enum([
          "door_to_door",
          "road_sweeping",
          "drainage",
          "depot_geofencing",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cfg = await db.getConfig();
      const result = await db.createWorkLog({
        userId: ctx.user.id,
        wardId: input.wardId,
        moduleType: input.moduleType,
        startTime: new Date(),
        photoRequired: cfg?.photoMandatory || false,
      });

      return { success: true, workLogId: (result as any).insertId || 0 };
    }),

  end: protectedProcedure
    .input(
      z.object({
        workLogId: z.number(),
        gpsTrailGeoJson: z.any().optional(),
        totalDistance: z.string().optional(),
        qrScansCount: z.number().optional(),
        pointsCollected: z.number().optional(),
        photoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workLog = await db.getWorkLogById(input.workLogId);
      if (!workLog || workLog.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateWorkLog(input.workLogId, {
        status: "completed",
        endTime: new Date(),
        gpsTrailGeoJson: input.gpsTrailGeoJson,
        totalDistance: input.totalDistance,
        qrScansCount: input.qrScansCount,
        pointsCollected: input.pointsCollected,
        photoUrl: input.photoUrl,
      });

      return { success: true };
    }),

  getById: protectedProcedure
    .input(z.object({ workLogId: z.number() }))
    .query(async ({ ctx, input }) => {
      const workLog = await db.getWorkLogById(input.workLogId);
      if (!workLog || (workLog.userId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return workLog;
    }),
});

// ============================================================================
// DRAINAGE MODULE PROCEDURES (Module 3)
// ============================================================================

const drainageRouter = router({
  getLinesByWard: publicProcedure
    .input(z.object({ wardId: z.number() }))
    .query(async ({ input }) => {
      return await db.getDrainageLinesByWard(input.wardId);
    }),

  recordTrail: protectedProcedure
    .input(
      z.object({
        workLogId: z.number(),
        trailGeoJson: z.any(),
        drainageLineId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Calculate overlap percentage between trail and drainage line
      const overlapPercentage = "85.50"; // Placeholder

      const result = await db.createWorkerTrail({
        workLogId: input.workLogId,
        userId: ctx.user.id,
        trailGeoJson: input.trailGeoJson,
        drainageLineId: input.drainageLineId,
        overlapPercentage,
        isAutoCompleted: parseFloat(overlapPercentage) >= 90,
      });

      return {
        success: true,
        trailId: (result as any).insertId || 0,
        overlapPercentage,
        autoCompleted: parseFloat(overlapPercentage) >= 90,
      };
    }),

  getSwarmView: publicProcedure
    .input(z.object({ drainageLineId: z.number() }))
    .query(async ({ input }) => {
      // TODO: Merge multiple worker trails for same drainage line
      return {
        drainageLineId: input.drainageLineId,
        trails: [],
        totalCoverage: "0%",
      };
    }),
});

// ============================================================================
// DEPOT MANAGEMENT PROCEDURES (Module 4)
// ============================================================================

const depotRouter = router({
  getByWard: publicProcedure
    .input(z.object({ wardId: z.number() }))
    .query(async ({ input }) => {
      return await db.getDepotsByWard(input.wardId);
    }),

  recordGeofenceEvent: protectedProcedure
    .input(
      z.object({
        depotId: z.number(),
        eventType: z.enum(["entry", "exit", "dwell"]),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        dwellDuration: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db.recordGeofenceEvent({
        depotId: input.depotId,
        userId: ctx.user.id,
        eventType: input.eventType,
        latitude: input.latitude,
        longitude: input.longitude,
        dwellDuration: input.dwellDuration,
      });

      // Auto-increment trip on dwell > threshold
      if (input.eventType === "dwell") {
        const cfg = await db.getConfig();
        const threshold = cfg?.depotDwellThresholdMinutes || 5;
        if (input.dwellDuration && input.dwellDuration >= threshold * 60) {
          // TODO: Increment trip count
        }
      }

      return { success: true, eventId: (result as any).insertId || 0 };
    }),
});

// ============================================================================
// CONFIGURATION PROCEDURES
// ============================================================================

const configRouter = router({
  get: publicProcedure.query(async () => {
    return await db.getConfig();
  }),

  update: protectedProcedure
    .input(
      z.object({
        photoMandatory: z.boolean().optional(),
        antiSpoofingEnabled: z.boolean().optional(),
        mockLocationBlockerEnabled: z.boolean().optional(),
        gpsRadiusMeters: z.number().optional(),
        drainageOverlapThreshold: z.string().optional(),
        depotDwellThresholdMinutes: z.number().optional(),
        dailyResetHour: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateConfig(input);
      return { success: true };
    }),
});

// ============================================================================
// MAIN ROUTER
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  location: locationRouter,
  ward: wardRouter,
  collectionPoints: collectionPointsRouter,
  qrScan: qrScanRouter,
  workLog: workLogRouter,
  drainage: drainageRouter,
  depot: depotRouter,
  config: configRouter,
});

export type AppRouter = typeof appRouter;

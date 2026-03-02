import { eq, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  locations,
  wards,
  collectionPoints,
  dailyPointStatus,
  qrScans,
  workLogs,
  drainageLines,
  workerTrails,
  depots,
  geofenceEvents,
  config,
  countries,
  states,
  districts,
  talukas,
  villages,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazily create the drizzle instance so local tooling can run without a DB.
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// LOCATION HIERARCHY
// ============================================================================

export async function getCountries() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(countries);
}

export async function getStatesByCountry(countryId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(states)
    .where(eq(states.countryId, countryId));
}

export async function getDistrictsByState(stateId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(districts)
    .where(eq(districts.stateId, stateId));
}

export async function getTalukasByDistrict(districtId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(talukas)
    .where(eq(talukas.districtId, districtId));
}

export async function getVillagesByTaluka(talukaId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(villages)
    .where(eq(villages.talukaId, talukaId));
}

// ============================================================================
// WARD MANAGEMENT
// ============================================================================

export async function getWardsByVillage(villageId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(wards).where(eq(wards.villageId, villageId));
}

export async function getWardById(wardId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(wards).where(eq(wards.id, wardId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createWard(wardData: {
  villageId: number;
  wardNumber: number;
  name: string;
  boundaryGeoJson: any;
  centerLatitude?: string;
  centerLongitude?: string;
  qrId?: string;
  qrCodeData?: string;
  isAutoGenerated?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(wards).values({
    villageId: wardData.villageId,
    wardNumber: wardData.wardNumber,
    name: wardData.name,
    boundaryGeoJson: wardData.boundaryGeoJson,
    centerLatitude: wardData.centerLatitude as any,
    centerLongitude: wardData.centerLongitude as any,
    qrId: wardData.qrId,
    qrCodeData: wardData.qrCodeData,
    isAutoGenerated: wardData.isAutoGenerated || false,
    generatedAt: wardData.isAutoGenerated ? new Date() : undefined,
  });

  return result;
}

// ============================================================================
// COLLECTION POINTS
// ============================================================================

export async function getCollectionPointsByWard(wardId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(collectionPoints)
    .where(eq(collectionPoints.wardId, wardId));
}

export async function getCollectionPointById(pointId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(collectionPoints)
    .where(eq(collectionPoints.id, pointId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCollectionPoint(pointData: {
  wardId: number;
  pointName?: string;
  latitude: string;
  longitude: string;
  qrId: string;
  qrCodeData?: string;
  registeredByUserId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(collectionPoints).values({
    wardId: pointData.wardId,
    pointName: pointData.pointName,
    latitude: pointData.latitude as any,
    longitude: pointData.longitude as any,
    qrId: pointData.qrId,
    qrCodeData: pointData.qrCodeData,
    registeredByUserId: pointData.registeredByUserId,
  });

  return result;
}

// ============================================================================
// DAILY POINT STATUS
// ============================================================================

export async function getDailyPointStatus(pointId: number, date: Date) {
  const db = await getDb();
  if (!db) return undefined;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select()
    .from(dailyPointStatus)
    .where(
      and(
        eq(dailyPointStatus.pointId, pointId),
        gte(dailyPointStatus.statusDate, startOfDay),
        lte(dailyPointStatus.statusDate, endOfDay)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updatePointStatus(
  pointId: number,
  date: Date,
  status: "RED" | "GREEN",
  userId?: number,
  imei?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingStatus = await getDailyPointStatus(pointId, date);

  if (existingStatus) {
    await db
      .update(dailyPointStatus)
      .set({
        status,
        collectedByUserId: userId || existingStatus.collectedByUserId,
        collectedAt: status === "GREEN" ? new Date() : existingStatus.collectedAt,
        imei: imei || existingStatus.imei,
        imeiVerified: imei ? true : existingStatus.imeiVerified,
      })
      .where(eq(dailyPointStatus.id, existingStatus.id));
  } else {
    await db.insert(dailyPointStatus).values({
      pointId,
      statusDate: new Date(date),
      status,
      collectedByUserId: userId,
      collectedAt: status === "GREEN" ? new Date() : undefined,
      imei,
      imeiVerified: imei ? true : false,
    });
  }
}

// ============================================================================
// QR SCANS
// ============================================================================

export async function recordQrScan(scanData: {
  pointId: number;
  userId: number;
  workerLatitude: string;
  workerLongitude: string;
  distanceFromPoint: string;
  isWithinRadius: boolean;
  scanStatus: "success" | "failed" | "out_of_range" | "spoofed";
  imei?: string;
  imeiMatches?: boolean;
  isMockLocation?: boolean;
  accuracy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(qrScans).values({
    pointId: scanData.pointId,
    userId: scanData.userId,
    scannedAt: new Date(),
    workerLatitude: scanData.workerLatitude as any,
    workerLongitude: scanData.workerLongitude as any,
    distanceFromPoint: scanData.distanceFromPoint as any,
    isWithinRadius: scanData.isWithinRadius,
    scanStatus: scanData.scanStatus,
    imei: scanData.imei,
    imeiMatches: scanData.imeiMatches || false,
    isMockLocation: scanData.isMockLocation || false,
    accuracy: scanData.accuracy as any,
  });

  return result;
}

// ============================================================================
// WORK LOGS
// ============================================================================

export async function createWorkLog(logData: {
  userId: number;
  wardId: number;
  moduleType: "door_to_door" | "road_sweeping" | "drainage" | "depot_geofencing";
  startTime: Date;
  photoRequired?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(workLogs).values({
    userId: logData.userId,
    wardId: logData.wardId,
    moduleType: logData.moduleType,
    startTime: logData.startTime,
    status: "in_progress",
    photoRequired: logData.photoRequired || false,
  });

  return result;
}

export async function getWorkLogById(logId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workLogs).where(eq(workLogs.id, logId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWorkLog(
  logId: number,
  updates: {
    status?: "pending" | "in_progress" | "completed" | "rejected";
    endTime?: Date;
    gpsTrailGeoJson?: any;
    totalDistance?: string;
    qrScansCount?: number;
    pointsCollected?: number;
    photoUrl?: string;
    moduleData?: any;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.endTime) updateData.endTime = updates.endTime;
  if (updates.gpsTrailGeoJson) updateData.gpsTrailGeoJson = updates.gpsTrailGeoJson;
  if (updates.totalDistance) updateData.totalDistance = updates.totalDistance;
  if (updates.qrScansCount !== undefined) updateData.qrScansCount = updates.qrScansCount;
  if (updates.pointsCollected !== undefined) updateData.pointsCollected = updates.pointsCollected;
  if (updates.photoUrl) updateData.photoUrl = updates.photoUrl;
  if (updates.moduleData) updateData.moduleData = updates.moduleData;

  await db.update(workLogs).set(updateData).where(eq(workLogs.id, logId));
}

// ============================================================================
// DRAINAGE LINES
// ============================================================================

export async function getDrainageLinesByWard(wardId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(drainageLines)
    .where(eq(drainageLines.wardId, wardId));
}

export async function getDrainageLineById(lineId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(drainageLines)
    .where(eq(drainageLines.id, lineId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// WORKER TRAILS
// ============================================================================

export async function createWorkerTrail(trailData: {
  workLogId: number;
  userId: number;
  trailGeoJson: any;
  drainageLineId?: number;
  overlapPercentage?: string;
  isAutoCompleted?: boolean;
  swarmGroupId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(workerTrails).values({
    workLogId: trailData.workLogId,
    userId: trailData.userId,
    trailGeoJson: trailData.trailGeoJson,
    drainageLineId: trailData.drainageLineId,
    overlapPercentage: trailData.overlapPercentage as any,
    isAutoCompleted: trailData.isAutoCompleted || false,
    swarmGroupId: trailData.swarmGroupId,
  });

  return result;
}

// ============================================================================
// DEPOTS
// ============================================================================

export async function getDepotsByWard(wardId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(depots).where(eq(depots.wardId, wardId));
}

export async function getDepotById(depotId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(depots).where(eq(depots.id, depotId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// GEOFENCE EVENTS
// ============================================================================

export async function recordGeofenceEvent(eventData: {
  depotId: number;
  userId: number;
  eventType: "entry" | "exit" | "dwell";
  latitude?: string;
  longitude?: string;
  dwellDuration?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(geofenceEvents).values({
    depotId: eventData.depotId,
    userId: eventData.userId,
    eventType: eventData.eventType,
    eventTime: new Date(),
    latitude: eventData.latitude as any,
    longitude: eventData.longitude as any,
    dwellDuration: eventData.dwellDuration,
  });

  return result;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export async function getConfig() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(config).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateConfig(updates: {
  photoMandatory?: boolean;
  antiSpoofingEnabled?: boolean;
  mockLocationBlockerEnabled?: boolean;
  gpsRadiusMeters?: number;
  drainageOverlapThreshold?: string;
  depotDwellThresholdMinutes?: number;
  dailyResetHour?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cfg = await getConfig();
  if (cfg) {
    await db.update(config).set(updates).where(eq(config.id, cfg.id));
  } else {
    await db.insert(config).values(updates as any);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Check if point is within radius
 */
export function isWithinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= radiusMeters;
}

/**
 * Convert GeoJSON to readable format
 */
export function geoJsonToString(geoJson: any): string {
  if (!geoJson) return "";
  try {
    return JSON.stringify(geoJson);
  } catch {
    return "";
  }
}

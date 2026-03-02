import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

/**
 * SWM PRO v2.0 - Comprehensive Database Schema
 * Includes spatial hierarchy, GPS tracking, and all modules
 */

// ============================================================================
// AUTHENTICATION & USERS
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  phone: varchar("phone", { length: 20 }).unique(),
  role: mysqlEnum("role", ["admin", "worker", "supervisor"]).default("worker").notNull(),
  
  // OTP + PIN Security
  otpSecret: varchar("otpSecret", { length: 255 }),
  pin: varchar("pin", { length: 4 }), // 4-digit PIN (hashed)
  pinAttempts: int("pinAttempts").default(0),
  pinLockedUntil: timestamp("pinLockedUntil"),
  
  // Worker Assignment
  locationId: int("locationId"),
  wardId: int("wardId"),
  depotId: int("depotId"),
  
  // Status
  isActive: boolean("isActive").default(true),
  lastLocationUpdate: timestamp("lastLocationUpdate"),
  lastLatitude: decimal("lastLatitude", { precision: 10, scale: 8 }),
  lastLongitude: decimal("lastLongitude", { precision: 11, scale: 8 }),
  
  // Timestamps
  loginMethod: varchar("loginMethod", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email),
  phoneIdx: index("idx_users_phone").on(table.phone),
  roleIdx: index("idx_users_role").on(table.role),
  wardIdx: index("idx_users_ward").on(table.wardId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// LOCATION HIERARCHY
// ============================================================================

export const countries = mysqlTable("countries", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 3 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const states = mysqlTable("states", {
  id: int("id").autoincrement().primaryKey(),
  countryId: int("countryId").notNull().references(() => countries.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 3 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  countryIdx: index("idx_states_country").on(table.countryId),
  nameIdx: uniqueIndex("idx_states_name_country").on(table.countryId, table.name),
}));

export const districts = mysqlTable("districts", {
  id: int("id").autoincrement().primaryKey(),
  stateId: int("stateId").notNull().references(() => states.id),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  stateIdx: index("idx_districts_state").on(table.stateId),
}));

export const talukas = mysqlTable("talukas", {
  id: int("id").autoincrement().primaryKey(),
  districtId: int("districtId").notNull().references(() => districts.id),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  districtIdx: index("idx_talukas_district").on(table.districtId),
}));

export const villages = mysqlTable("villages", {
  id: int("id").autoincrement().primaryKey(),
  talukaId: int("talukaId").notNull().references(() => talukas.id),
  name: varchar("name", { length: 100 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  boundaryGeoJson: json("boundaryGeoJson"), // GeoJSON polygon for village boundary
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  talukaIdx: index("idx_villages_taluka").on(table.talukaId),
}));

// Alias for locations compatibility
export const locations = villages;

// ============================================================================
// WARDS & SPATIAL DIVISIONS
// ============================================================================

export const wards = mysqlTable("wards", {
  id: int("id").autoincrement().primaryKey(),
  villageId: int("villageId").notNull().references(() => villages.id),
  wardNumber: int("wardNumber").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  
  // Spatial data (stored as GeoJSON for MySQL compatibility)
  boundaryGeoJson: json("boundaryGeoJson").notNull(), // GeoJSON polygon
  centerLatitude: decimal("centerLatitude", { precision: 10, scale: 8 }),
  centerLongitude: decimal("centerLongitude", { precision: 11, scale: 8 }),
  
  // Auto-ward engine metadata
  isAutoGenerated: boolean("isAutoGenerated").default(false),
  generatedAt: timestamp("generatedAt"),
  
  // QR Code
  qrId: varchar("qrId", { length: 100 }).unique(),
  qrCodeData: text("qrCodeData"), // Base64 encoded QR
  
  // Status
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  villageIdx: index("idx_wards_village").on(table.villageId),
  wardNumberIdx: uniqueIndex("idx_wards_number_village").on(table.villageId, table.wardNumber),
  qrIdx: index("idx_wards_qr").on(table.qrId),
}));

export type Ward = typeof wards.$inferSelect;
export type InsertWard = typeof wards.$inferInsert;

// ============================================================================
// COLLECTION POINTS (Door-to-Door Module)
// ============================================================================

export const collectionPoints = mysqlTable("collection_points", {
  id: int("id").autoincrement().primaryKey(),
  wardId: int("wardId").notNull().references(() => wards.id),
  pointName: varchar("pointName", { length: 255 }),
  
  // GPS Coordinates
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  
  // QR Code
  qrId: varchar("qrId", { length: 100 }).notNull().unique(),
  qrCodeData: text("qrCodeData"), // Base64 encoded QR
  
  // Registration
  registeredByUserId: int("registeredByUserId").references(() => users.id),
  isPermanent: boolean("isPermanent").default(true),
  
  // IMEI Tracking for D2D
  lastImei: varchar("lastImei", { length: 50 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  wardIdx: index("idx_collection_points_ward").on(table.wardId),
  qrIdx: index("idx_collection_points_qr").on(table.qrId),
  coordinatesIdx: index("idx_collection_points_coords").on(table.latitude, table.longitude),
}));

export type CollectionPoint = typeof collectionPoints.$inferSelect;
export type InsertCollectionPoint = typeof collectionPoints.$inferInsert;

// ============================================================================
// DAILY POINT STATUS (Door-to-Door Module)
// ============================================================================

export const dailyPointStatus = mysqlTable("daily_point_status", {
  id: int("id").autoincrement().primaryKey(),
  pointId: int("pointId").notNull().references(() => collectionPoints.id),
  statusDate: timestamp("statusDate").notNull(),
  
  // Status: RED (pending) or GREEN (collected)
  status: mysqlEnum("status", ["RED", "GREEN"]).default("RED").notNull(),
  
  // Collection Details
  collectedByUserId: int("collectedByUserId").references(() => users.id),
  collectedAt: timestamp("collectedAt"),
  scannedAt: timestamp("scannedAt"),
  
  // Photo (if mandatory)
  photoUrl: text("photoUrl"),
  
  // IMEI Verification
  imei: varchar("imei", { length: 50 }),
  imeiVerified: boolean("imeiVerified").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  pointDateIdx: uniqueIndex("idx_daily_status_point_date").on(table.pointId, table.statusDate),
  dateIdx: index("idx_daily_status_date").on(table.statusDate),
  userIdx: index("idx_daily_status_user").on(table.collectedByUserId),
}));

export type DailyPointStatus = typeof dailyPointStatus.$inferSelect;
export type InsertDailyPointStatus = typeof dailyPointStatus.$inferInsert;

// ============================================================================
// QR SCANS HISTORY
// ============================================================================

export const qrScans = mysqlTable("qr_scans", {
  id: int("id").autoincrement().primaryKey(),
  pointId: int("pointId").notNull().references(() => collectionPoints.id),
  userId: int("userId").notNull().references(() => users.id),
  
  // Scan Details
  scannedAt: timestamp("scannedAt").notNull(),
  scanStatus: mysqlEnum("scanStatus", ["success", "failed", "out_of_range", "spoofed"]).notNull(),
  
  // Worker Location
  workerLatitude: decimal("workerLatitude", { precision: 10, scale: 8 }).notNull(),
  workerLongitude: decimal("workerLongitude", { precision: 11, scale: 8 }).notNull(),
  
  // Distance Calculation
  distanceFromPoint: decimal("distanceFromPoint", { precision: 10, scale: 2 }),
  isWithinRadius: boolean("isWithinRadius").notNull(),
  
  // IMEI Verification
  imei: varchar("imei", { length: 50 }),
  imeiMatches: boolean("imeiMatches").default(false),
  
  // Anti-Spoofing
  isMockLocation: boolean("isMockLocation").default(false),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  pointIdx: index("idx_qr_scans_point").on(table.pointId),
  userIdx: index("idx_qr_scans_user").on(table.userId),
  timestampIdx: index("idx_qr_scans_timestamp").on(table.scannedAt),
}));

export type QrScan = typeof qrScans.$inferSelect;
export type InsertQrScan = typeof qrScans.$inferInsert;

// ============================================================================
// WORK LOGS (All Modules)
// ============================================================================

export const workLogs = mysqlTable("work_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  wardId: int("wardId").notNull().references(() => wards.id),
  
  // Module Type
  moduleType: mysqlEnum("moduleType", [
    "door_to_door",
    "road_sweeping",
    "drainage",
    "depot_geofencing"
  ]).notNull(),
  
  // Status
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "rejected"]).default("pending").notNull(),
  
  // Timing
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  
  // GPS Trail (stored as GeoJSON LineString)
  gpsTrailGeoJson: json("gpsTrailGeoJson"),
  totalDistance: decimal("totalDistance", { precision: 12, scale: 2 }),
  
  // Metrics
  qrScansCount: int("qrScansCount").default(0),
  pointsCollected: int("pointsCollected").default(0),
  
  // Module-specific data
  moduleData: json("moduleData"), // Flexible JSON for module-specific fields
  
  // Photo
  photoUrl: text("photoUrl"),
  photoRequired: boolean("photoRequired").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("idx_work_logs_user").on(table.userId),
  wardIdx: index("idx_work_logs_ward").on(table.wardId),
  moduleIdx: index("idx_work_logs_module").on(table.moduleType),
  dateIdx: index("idx_work_logs_date").on(table.createdAt),
}));

export type WorkLog = typeof workLogs.$inferSelect;
export type InsertWorkLog = typeof workLogs.$inferInsert;

// ============================================================================
// DRAINAGE LINES (Module 3)
// ============================================================================

export const drainageLines = mysqlTable("drainage_lines", {
  id: int("id").autoincrement().primaryKey(),
  wardId: int("wardId").notNull().references(() => wards.id),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Spatial data (GeoJSON LineString)
  lineGeoJson: json("lineGeoJson").notNull(),
  
  // Metadata
  length: decimal("length", { precision: 12, scale: 2 }),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  wardIdx: index("idx_drainage_lines_ward").on(table.wardId),
}));

export type DrainageLine = typeof drainageLines.$inferSelect;
export type InsertDrainageLine = typeof drainageLines.$inferInsert;

// ============================================================================
// WORKER TRAILS (Module 2 & 3)
// ============================================================================

export const workerTrails = mysqlTable("worker_trails", {
  id: int("id").autoincrement().primaryKey(),
  workLogId: int("workLogId").notNull().references(() => workLogs.id),
  userId: int("userId").notNull().references(() => users.id),
  
  // Trail data (GeoJSON LineString)
  trailGeoJson: json("trailGeoJson").notNull(),
  
  // For Drainage Module: overlap calculation
  drainageLineId: int("drainageLineId").references(() => drainageLines.id),
  overlapPercentage: decimal("overlapPercentage", { precision: 5, scale: 2 }),
  isAutoCompleted: boolean("isAutoCompleted").default(false),
  
  // Swarm View: merge multiple trails
  swarmGroupId: varchar("swarmGroupId", { length: 100 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  workLogIdx: index("idx_worker_trails_worklog").on(table.workLogId),
  userIdx: index("idx_worker_trails_user").on(table.userId),
  drainageIdx: index("idx_worker_trails_drainage").on(table.drainageLineId),
  swarmIdx: index("idx_worker_trails_swarm").on(table.swarmGroupId),
}));

export type WorkerTrail = typeof workerTrails.$inferSelect;
export type InsertWorkerTrail = typeof workerTrails.$inferInsert;

// ============================================================================
// DEPOTS (Module 4)
// ============================================================================

export const depots = mysqlTable("depots", {
  id: int("id").autoincrement().primaryKey(),
  wardId: int("wardId").notNull().references(() => wards.id),
  name: varchar("name", { length: 100 }).notNull(),
  
  // Location
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  
  // Geofence
  radiusMeters: int("radiusMeters").default(50),
  
  // Trip Counting
  tripCount: int("tripCount").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  wardIdx: index("idx_depots_ward").on(table.wardId),
}));

export type Depot = typeof depots.$inferSelect;
export type InsertDepot = typeof depots.$inferInsert;

// ============================================================================
// GEOFENCE EVENTS (Module 4)
// ============================================================================

export const geofenceEvents = mysqlTable("geofence_events", {
  id: int("id").autoincrement().primaryKey(),
  depotId: int("depotId").notNull().references(() => depots.id),
  userId: int("userId").notNull().references(() => users.id),
  
  // Event Type
  eventType: mysqlEnum("eventType", ["entry", "exit", "dwell"]).notNull(),
  
  // Timing
  eventTime: timestamp("eventTime").notNull(),
  dwellDuration: int("dwellDuration"), // In seconds
  
  // Location
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Trip Increment
  tripIncremented: boolean("tripIncremented").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  depotIdx: index("idx_geofence_events_depot").on(table.depotId),
  userIdx: index("idx_geofence_events_user").on(table.userId),
  timeIdx: index("idx_geofence_events_time").on(table.eventTime),
}));

export type GeofenceEvent = typeof geofenceEvents.$inferSelect;
export type InsertGeofenceEvent = typeof geofenceEvents.$inferInsert;

// ============================================================================
// GLOBAL CONFIGURATION
// ============================================================================

export const config = mysqlTable("config", {
  id: int("id").autoincrement().primaryKey(),
  
  // Photo Toggle
  photoMandatory: boolean("photoMandatory").default(false),
  
  // Anti-Spoofing
  antiSpoofingEnabled: boolean("antiSpoofingEnabled").default(true),
  mockLocationBlockerEnabled: boolean("mockLocationBlockerEnabled").default(true),
  
  // GPS Verification
  gpsRadiusMeters: int("gpsRadiusMeters").default(10),
  
  // Drainage Overlap
  drainageOverlapThreshold: decimal("drainageOverlapThreshold", { precision: 5, scale: 2 }).default("90.00"),
  
  // Depot Dwell
  depotDwellThresholdMinutes: int("depotDwellThresholdMinutes").default(5),
  
  // Daily Reset
  dailyResetHour: int("dailyResetHour").default(17), // 5 PM
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Config = typeof config.$inferSelect;
export type InsertConfig = typeof config.$inferInsert;

// ============================================================================
// RESET LOGS
// ============================================================================

export const resetLogs = mysqlTable("reset_logs", {
  id: int("id").autoincrement().primaryKey(),
  resetDate: timestamp("resetDate").notNull().unique(),
  resetTime: timestamp("resetTime").notNull(),
  
  pointsResetCount: int("pointsResetCount"),
  status: mysqlEnum("status", ["success", "failed", "pending"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  dateIdx: index("idx_reset_logs_date").on(table.resetDate),
}));

export type ResetLog = typeof resetLogs.$inferSelect;
export type InsertResetLog = typeof resetLogs.$inferInsert;

// ============================================================================
// REPORTS
// ============================================================================

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  generatedByUserId: int("generatedByUserId").notNull().references(() => users.id),
  
  // Report Type
  reportType: mysqlEnum("reportType", [
    "daily_collection",
    "weekly_performance",
    "monthly_summary",
    "worker_performance",
    "drainage_coverage",
    "depot_trips"
  ]).notNull(),
  
  // Date Range
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  
  // Files
  pdfUrl: text("pdfUrl"),
  excelUrl: text("excelUrl"),
  
  // Status
  status: mysqlEnum("status", ["pending", "generated", "failed"]).default("pending").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("idx_reports_user").on(table.generatedByUserId),
  typeIdx: index("idx_reports_type").on(table.reportType),
}));

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const auditLogs = mysqlTable("audit_logs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  
  // Action
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 100 }).notNull(),
  entityId: int("entityId"),
  
  // Changes
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  
  // IP & User Agent
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_audit_logs_user").on(table.userId),
  entityIdx: index("idx_audit_logs_entity").on(table.entity, table.entityId),
  dateIdx: index("idx_audit_logs_date").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

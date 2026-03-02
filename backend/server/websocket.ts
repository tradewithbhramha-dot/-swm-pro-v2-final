import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { workLogs, users, depots, geofenceEvents } from "../drizzle/schema";

interface WorkerLocation {
  userId: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

interface ActiveWorker {
  userId: number;
  userName: string;
  location: WorkerLocation;
  status: "online" | "offline" | "idle";
  lastUpdate: number;
  distanceTraveled: number;
  taskId?: number;
}

// Store active workers in memory
const activeWorkers = new Map<number, ActiveWorker>();
const workerSockets = new Map<number, Socket>();

/**
 * Initialize WebSocket server for real-time location tracking
 */
export function initializeWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" ? undefined : "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth.userId;
      const token = socket.handshake.auth.token;

      if (!userId || !token) {
        return next(new Error("Authentication error"));
      }

      // Verify user exists
      const db = await getDb();
      if (!db) {
        return next(new Error("Database unavailable"));
      }

      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return next(new Error("User not found"));
      }

      socket.data.userId = userId;
      socket.data.user = user[0];
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`[WebSocket] Worker ${userId} connected: ${socket.id}`);

    // Store socket reference
    workerSockets.set(userId, socket);

    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join("workers"); // Broadcast room for all workers

    // Notify admin dashboard of worker online
    io.to("admin").emit("worker:online", { userId, socketId: socket.id });

    // Handle location updates
    socket.on("location:update", async (data: WorkerLocation) => {
      try {
        const db = await getDb();
        if (!db) return;

        // Update active worker
        const existingWorker = activeWorkers.get(userId);
        const distanceTraveled = existingWorker
          ? calculateDistance(
              existingWorker.location.latitude,
              existingWorker.location.longitude,
              data.latitude,
              data.longitude
            )
          : 0;

        const activeWorker: ActiveWorker = {
          userId,
          userName: socket.data.user?.name || `Worker ${userId}`,
          location: data,
          status: "online",
          lastUpdate: Date.now(),
          distanceTraveled: (existingWorker?.distanceTraveled || 0) + distanceTraveled,
        };

        activeWorkers.set(userId, activeWorker);

        // Save location to database (update user's last location)
        await db
          .update(users)
          .set({
            lastLatitude: data.latitude.toString(),
            lastLongitude: data.longitude.toString(),
            lastLocationUpdate: new Date(data.timestamp),
          })
          .where(eq(users.id, userId));

        // Broadcast to admin dashboard
        io.to("admin").emit("location:update", activeWorker);

        // Check geofence intersections
        await checkGeofenceIntersections(db, userId, data.latitude, data.longitude);
      } catch (error) {
        console.error("[WebSocket] Location update error:", error);
      }
    });

    // Handle task start
    socket.on("task:start", async (data: { taskId: number; moduleType: string }) => {
      try {
        const worker = activeWorkers.get(userId);
        if (worker) {
          worker.taskId = data.taskId;
          activeWorkers.set(userId, worker);
          io.to("admin").emit("task:started", { userId, ...data });
        }
      } catch (error) {
        console.error("[WebSocket] Task start error:", error);
      }
    });

    // Handle task completion
    socket.on("task:complete", async (data: { taskId: number; duration: number; distance: number }) => {
      try {
        const worker = activeWorkers.get(userId);
        if (worker) {
          worker.taskId = undefined;
          activeWorkers.set(userId, worker);
          io.to("admin").emit("task:completed", { userId, ...data });
        }
      } catch (error) {
        console.error("[WebSocket] Task complete error:", error);
      }
    });

    // Handle worker status change
    socket.on("worker:status", (status: "online" | "offline" | "idle") => {
      const worker = activeWorkers.get(userId);
      if (worker) {
        worker.status = status;
        activeWorkers.set(userId, worker);
        io.to("admin").emit("worker:status", { userId, status });
      }
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      console.log(`[WebSocket] Worker ${userId} disconnected`);
      workerSockets.delete(userId);

      const worker = activeWorkers.get(userId);
      if (worker) {
        worker.status = "offline";
        activeWorkers.set(userId, worker);
      }

      io.to("admin").emit("worker:offline", { userId });
    });

    // Error handler
    socket.on("error", (error) => {
      console.error(`[WebSocket] Socket error for user ${userId}:`, error);
    });
  });

  return io;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

/**
 * Check if worker is entering/exiting geofences
 */
async function checkGeofenceIntersections(db: any, userId: number, latitude: number, longitude: number) {
  try {
    // Get all active geofences (depots, collection points, etc.)
    const geofences = await db.query.depots.findMany();

    for (const geofence of geofences) {
      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(geofence.latitude.toString()),
        parseFloat(geofence.longitude.toString())
      );

      const radiusMeters = geofence.radiusMeters || 50;
      const isInside = distance <= radiusMeters;

      // Get previous location from work logs
      const previousLocations = await db
        .select()
        .from(workLogs)
        .where(eq(workLogs.userId, userId))
        .orderBy((t: any) => t.startTime)
        .limit(1);

      if (previousLocations.length >= 2) {
        const prevLocation = previousLocations[0];
        const prevDistance = calculateDistance(
          parseFloat(prevLocation.latitude),
          parseFloat(prevLocation.longitude),
          parseFloat(geofence.latitude.toString()),
          parseFloat(geofence.longitude.toString())
        );

        const wasOutside = prevDistance > radiusMeters;

        // Entry event
        if (isInside && wasOutside) {
          await db.insert(geofenceEvents).values({
            userId,
            geofenceId: geofence.id,
            eventType: "entry",
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            timestamp: new Date(),
          });

          // Notify admin
          const io = (global as any).io;
          if (io) {
            io.to("admin").emit("geofence:entry", {
              userId,
              geofenceId: geofence.id,
              geofenceName: geofence.name,
              timestamp: new Date(),
            });
          }
        }

        // Exit event
        if (!isInside && !wasOutside) {
          await db.insert(geofenceEvents).values({
            userId,
            geofenceId: geofence.id,
            eventType: "exit",
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            timestamp: new Date(),
          });

          // Notify admin
          const io = (global as any).io;
          if (io) {
            io.to("admin").emit("geofence:exit", {
              userId,
              geofenceId: geofence.id,
              geofenceName: geofence.name,
              timestamp: new Date(),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("[WebSocket] Geofence check error:", error);
  }
}

/**
 * Get all active workers for admin dashboard
 */
export function getActiveWorkers(): ActiveWorker[] {
  return Array.from(activeWorkers.values());
}

/**
 * Broadcast message to admin dashboard
 */
export function broadcastToAdmin(event: string, data: any) {
  const io = (global as any).io;
  if (io) {
    io.to("admin").emit(event, data);
  }
}

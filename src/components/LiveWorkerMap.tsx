import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MapPin, Zap, Clock } from "lucide-react";
import { toast } from "sonner";

interface WorkerLocation {
  userId: number;
  userName: string;
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

interface GeofenceAlert {
  userId: number;
  geofenceId: number;
  geofenceName: string;
  eventType: "entry" | "exit";
  timestamp: Date;
}

/**
 * LiveWorkerMap Component
 * Real-time worker location tracking with geofence alerts
 */

export default function LiveWorkerMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const [activeWorkers, setActiveWorkers] = useState<Map<number, ActiveWorker>>(new Map());
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    if (!map.current) {
      map.current = L.map(mapContainer.current).setView([28.6139, 77.209], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current);
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const userId = localStorage.getItem("user_id");

    if (!token || !userId) {
      setConnectionStatus("disconnected");
      return;
    }

    // Connect to WebSocket server
    socketRef.current = io(window.location.origin, {
      auth: {
        userId: parseInt(userId),
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    socketRef.current.on("connect", () => {
      console.log("[WebSocket] Connected to server");
      setConnectionStatus("connected");
      toast.success("Connected to live tracking");

      // Join admin room
      socketRef.current?.emit("join:admin");
    });

    socketRef.current.on("disconnect", () => {
      console.log("[WebSocket] Disconnected from server");
      setConnectionStatus("disconnected");
      toast.error("Disconnected from live tracking");
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("[WebSocket] Connection error:", error);
      setConnectionStatus("disconnected");
    });

    // Location update events
    socketRef.current.on("location:update", (worker: ActiveWorker) => {
      updateWorkerMarker(worker);
      setActiveWorkers((prev) => new Map(prev).set(worker.userId, worker));
    });

    // Worker online/offline events
    socketRef.current.on("worker:online", (data: { userId: number }) => {
      console.log(`Worker ${data.userId} is online`);
    });

    socketRef.current.on("worker:offline", (data: { userId: number }) => {
      console.log(`Worker ${data.userId} is offline`);
      removeWorkerMarker(data.userId);
    });

    socketRef.current.on("worker:status", (data: { userId: number; status: string }) => {
      setActiveWorkers((prev) => {
        const updated = new Map(prev);
        const worker = updated.get(data.userId);
        if (worker) {
          worker.status = data.status as "online" | "offline" | "idle";
          updated.set(data.userId, worker);
        }
        return updated;
      });
    });

    // Task events
    socketRef.current.on("task:started", (data: { userId: number; taskId: number; moduleType: string }) => {
      toast.info(`Worker ${data.userId} started ${data.moduleType} task`);
    });

    socketRef.current.on("task:completed", (data: { userId: number; taskId: number; duration: number; distance: number }) => {
      toast.success(`Worker ${data.userId} completed task (${(data.distance / 1000).toFixed(2)}km)`);
    });

    // Geofence events
    socketRef.current.on("geofence:entry", (data: { userId: number; geofenceId: number; geofenceName: string }) => {
      const alert: GeofenceAlert = {
        userId: data.userId,
        geofenceId: data.geofenceId,
        geofenceName: data.geofenceName,
        eventType: "entry",
        timestamp: new Date(),
      };
      setAlerts((prev) => [alert, ...prev.slice(0, 9)]);
      toast.info(`📍 Worker entered ${data.geofenceName}`);
    });

    socketRef.current.on("geofence:exit", (data: { userId: number; geofenceId: number; geofenceName: string }) => {
      const alert: GeofenceAlert = {
        userId: data.userId,
        geofenceId: data.geofenceId,
        geofenceName: data.geofenceName,
        eventType: "exit",
        timestamp: new Date(),
      };
      setAlerts((prev) => [alert, ...prev.slice(0, 9)]);
      toast.info(`📍 Worker exited ${data.geofenceName}`);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Update worker marker on map
  const updateWorkerMarker = (worker: ActiveWorker) => {
    if (!map.current) return;

    const { userId, location, status } = worker;
    const latlng: L.LatLngTuple = [location.latitude, location.longitude];

    // Remove existing marker
    const existingMarker = markersRef.current.get(userId);
    if (existingMarker) {
      existingMarker.remove();
    }

    // Create new marker with status color
    const markerColor = status === "online" ? "green" : status === "idle" ? "yellow" : "gray";
    const iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;

    const marker = L.marker(latlng, {
      icon: L.icon({
        iconUrl,
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    }).addTo(map.current);

    // Create popup with worker info
    const popupContent = `
      <div style="font-size: 12px;">
        <strong>${worker.userName}</strong><br/>
        Status: <span style="color: ${status === "online" ? "green" : "red"}">${status}</span><br/>
        Distance: ${(worker.distanceTraveled / 1000).toFixed(2)}km<br/>
        Speed: ${(location.speed || 0).toFixed(1)} m/s<br/>
        Accuracy: ±${location.accuracy.toFixed(0)}m<br/>
        Last Update: ${new Date(location.timestamp).toLocaleTimeString()}
      </div>
    `;

    marker.bindPopup(popupContent);
    markersRef.current.set(userId, marker);
  };

  // Remove worker marker
  const removeWorkerMarker = (userId: number) => {
    const marker = markersRef.current.get(userId);
    if (marker) {
      marker.remove();
      markersRef.current.delete(userId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500 animate-pulse"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
          />
          <span className="text-sm font-semibold text-foreground capitalize">{connectionStatus}</span>
        </div>
        <span className="text-sm text-muted-foreground">{activeWorkers.size} workers online</span>
      </div>

      {/* Live Map */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Live Worker Tracking
          </CardTitle>
          <CardDescription>Real-time GPS locations and geofence alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={mapContainer}
            style={{ width: "100%", height: "500px", borderRadius: "20px", border: "1px solid #E5E7EB" }}
          />
        </CardContent>
      </Card>

      {/* Active Workers List */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Active Workers ({activeWorkers.size})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activeWorkers.size === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active workers</p>
            ) : (
              Array.from(activeWorkers.values()).map((worker) => (
                <div
                  key={worker.userId}
                  className="flex items-center justify-between p-3 bg-white/50 rounded-[20px] border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        worker.status === "online"
                          ? "bg-green-500"
                          : worker.status === "idle"
                            ? "bg-yellow-500"
                            : "bg-gray-500"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{worker.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {(worker.distanceTraveled / 1000).toFixed(2)}km • {(worker.location.speed || 0).toFixed(1)} m/s
                      </p>
                    </div>
                  </div>
                  <Badge className={worker.status === "online" ? "badge-success" : "badge-secondary"}>
                    {worker.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Geofence Alerts */}
      {alerts.length > 0 && (
        <Card className="card-hover bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-5 h-5" />
              Geofence Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-white/50 rounded-[20px] border border-amber-200 text-sm"
                >
                  <div>
                    <p className="font-semibold text-amber-900">
                      {alert.eventType === "entry" ? "📍 Entry" : "📍 Exit"}: {alert.geofenceName}
                    </p>
                    <p className="text-xs text-amber-800">Worker {alert.userId}</p>
                  </div>
                  <span className="text-xs text-amber-700">{alert.timestamp.toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Info */}
      <Card className="card-hover bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Real-time Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          <p>✓ Live worker location updates via WebSocket</p>
          <p>✓ Automatic geofence entry/exit detection</p>
          <p>✓ Distance and speed tracking</p>
          <p>✓ Worker status monitoring (online/offline/idle)</p>
          <p>✓ Real-time alerts and notifications</p>
        </CardContent>
      </Card>
    </div>
  );
}

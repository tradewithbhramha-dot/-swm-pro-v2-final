import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, MapPin, Play, Square, TrendingUp, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Module 4: Depot Management
 * 50m geofence detection, 5-minute dwell auto-increment, trip counting
 */

export default function Module4Depot() {
  const { user } = useAuth();
  const [trackingActive, setTrackingActive] = useState(false);
  const [selectedDepotId, setSelectedDepotId] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [insideGeofence, setInsideGeofence] = useState(false);
  const [tripCount, setTripCount] = useState(0);
  const [dwellTime, setDwellTime] = useState(0);
  const [geofenceEvents, setGeofenceEvents] = useState<any[]>([]);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);

  // Fetch depots for selected ward
  const { data: depots } = trpc.depot.getByWard.useQuery(
    { wardId: user?.wardId || 0 },
    { enabled: !!user?.wardId }
  );

  // Record geofence event mutation
  const recordEventMutation = trpc.depot.recordGeofenceEvent.useMutation({
    onSuccess: () => {
      toast.success("Geofence event recorded");
    },
    onError: () => {
      toast.error("Failed to record geofence event");
    },
  });

  // Start tracking
  const startTracking = () => {
    if (selectedDepotId) {
      setTrackingActive(true);
      startGeofenceTracking();
      toast.success("Depot tracking started");
    }
  };

  // Stop tracking
  const stopTracking = () => {
    setTrackingActive(false);
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
    }
    toast.success("Depot tracking stopped");
  };

  // Start geofence tracking
  const startGeofenceTracking = () => {
    if (navigator.geolocation && selectedDepotId) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };

          setCurrentLocation(newLocation);

          // Find selected depot
          const depot = depots?.find((d) => d.id === selectedDepotId);
          if (depot) {
            // Calculate distance to depot
            const distance = calculateDistance(
              newLocation.lat,
              newLocation.lon,
              parseFloat(depot.latitude.toString()),
              parseFloat(depot.longitude.toString())
            );

            const radiusMeters = depot.radiusMeters || 50;
            const isInside = distance <= radiusMeters;

            // Handle geofence entry/exit
            if (isInside && !insideGeofence) {
              // Entry
              setInsideGeofence(true);
              recordEventMutation.mutate({
                depotId: selectedDepotId,
                eventType: "entry",
                latitude: newLocation.lat.toString(),
                longitude: newLocation.lon.toString(),
              });
              setGeofenceEvents([
                ...geofenceEvents,
                { type: "entry", time: new Date(), distance },
              ]);
              toast.success("📍 Entered depot geofence");
            } else if (!isInside && insideGeofence) {
              // Exit
              setInsideGeofence(false);
              recordEventMutation.mutate({
                depotId: selectedDepotId,
                eventType: "exit",
                latitude: newLocation.lat.toString(),
                longitude: newLocation.lon.toString(),
              });
              setGeofenceEvents([
                ...geofenceEvents,
                { type: "exit", time: new Date(), distance },
              ]);
              toast.info("📍 Exited depot geofence");

              // Auto-increment trip if dwell > 5 minutes
              if (dwellTime >= 300) {
                setTripCount((prev) => prev + 1);
                recordEventMutation.mutate({
                  depotId: selectedDepotId,
                  eventType: "dwell",
                  latitude: newLocation.lat.toString(),
                  longitude: newLocation.lon.toString(),
                  dwellDuration: dwellTime,
                });
                toast.success(`✓ Trip #${tripCount + 1} recorded (dwell: ${(dwellTime / 60).toFixed(1)}m)`);
              }

              setDwellTime(0);
            }
          }
        },
        (error) => {
          toast.error("Failed to track location");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );

      setGpsWatchId(watchId);
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
  };

  // Dwell time timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (trackingActive && insideGeofence) {
      interval = setInterval(() => {
        setDwellTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [trackingActive, insideGeofence]);

  // Format time
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Depot Management</h1>
            <p className="text-muted-foreground mt-2">50m geofence tracking with automatic trip counting</p>
          </div>
          <Badge className={trackingActive ? "badge-success" : "badge-secondary"}>
            {trackingActive ? "Tracking Active" : "Idle"}
          </Badge>
        </div>

        {/* Depot Selection & Tracking Controls */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Geofence Tracking</CardTitle>
            <CardDescription>Monitor vehicle entry/exit and automatic trip counting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Depot Selection */}
            {!trackingActive && (
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Select Depot</label>
                <Select value={selectedDepotId?.toString() || ""} onValueChange={(v) => setSelectedDepotId(parseInt(v))}>
                  <SelectTrigger className="input-glass">
                    <SelectValue placeholder="Select a depot" />
                  </SelectTrigger>
                  <SelectContent>
                    {depots?.map((depot) => (
                      <SelectItem key={depot.id} value={depot.id.toString()}>
                        {depot.name} (50m geofence)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tracking Buttons */}
            <div className="flex gap-2">
              {!trackingActive ? (
                <Button
                  className="btn-glass-primary flex-1"
                  onClick={startTracking}
                  disabled={!selectedDepotId}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Tracking
                </Button>
              ) : (
                <Button className="btn-glass-primary flex-1" onClick={stopTracking}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Tracking
                </Button>
              )}
            </div>

            {/* Current Location */}
            {trackingActive && currentLocation && (
              <div className="p-3 bg-blue-50 rounded-[20px] border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-1">Current Location</p>
                <p className="text-sm text-blue-700 font-mono">
                  {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Geofence Status */}
        {trackingActive && (
          <Card className={insideGeofence ? "card-hover bg-green-50 border-green-200" : "card-hover bg-gray-50 border-gray-200"}>
            <CardHeader>
              <CardTitle className={insideGeofence ? "text-green-900" : "text-gray-900"}>Geofence Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {insideGeofence ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-gray-400" />
                  )}
                  <div>
                    <p className="font-semibold text-foreground">
                      {insideGeofence ? "Inside Geofence" : "Outside Geofence"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {insideGeofence ? "Vehicle is within 50m radius" : "Vehicle is outside geofence"}
                    </p>
                  </div>
                </div>
              </div>

              {insideGeofence && (
                <div className="p-3 bg-white/50 rounded-[20px] border border-green-200">
                  <p className="text-xs font-semibold text-green-900 mb-1">Dwell Time</p>
                  <p className="text-lg font-bold text-green-600">{formatTime(dwellTime)}</p>
                  {dwellTime >= 300 && (
                    <p className="text-xs text-green-700 mt-1">✓ 5-minute threshold reached - trip will auto-increment on exit</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trip Counter */}
        {trackingActive && (
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Trip Counter
              </CardTitle>
              <CardDescription>Automatic increment on 5-minute dwell</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600 text-center py-4">
                {tripCount}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Trips recorded today
              </p>
            </CardContent>
          </Card>
        )}

        {/* Geofence Events Log */}
        {trackingActive && geofenceEvents.length > 0 && (
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Event Log</CardTitle>
              <CardDescription>Geofence entry/exit events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {geofenceEvents.map((event, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white/50 rounded-[20px] border border-gray-200 text-sm">
                    <div className="flex items-center gap-2">
                      {event.type === "entry" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-semibold capitalize text-foreground">{event.type}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {event.time.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Geofence Logic Info */}
        <Card className="card-hover bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Geofence Logic</CardTitle>
            <CardDescription className="text-blue-800">How automatic trip counting works</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-900">
            <p>📍 <strong>50m Geofence Radius</strong> - Defined around each depot</p>
            <p>⏱️ <strong>5-Minute Dwell Detection</strong> - Vehicle must stay inside for 5 minutes</p>
            <p>📊 <strong>Auto-Increment</strong> - Trip counter increases when vehicle exits after 5-minute dwell</p>
            <p>📝 <strong>Event Logging</strong> - All entry/exit events are recorded for analytics</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

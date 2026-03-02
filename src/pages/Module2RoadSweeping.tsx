import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, MapPin, Play, Square, Navigation, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Module 2: Road Sweeping
 * GPS breadcrumb trail tracking, start/end QR scan, route visualization
 */

export default function Module2RoadSweeping() {
  const { user } = useAuth();
  const [workStarted, setWorkStarted] = useState(false);
  const [workLogId, setWorkLogId] = useState<number | null>(null);
  const [gpsTrail, setGpsTrail] = useState<Array<{ lat: number; lon: number; timestamp: number }>>([]);
  const [startLocation, setStartLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [endLocation, setEndLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startQRScanned, setStartQRScanned] = useState(false);
  const [endQRScanned, setEndQRScanned] = useState(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);

  // Start work session
  const startWorkMutation = trpc.workLog.start.useMutation({
    onSuccess: (data) => {
      setWorkLogId(data.workLogId);
      setWorkStarted(true);
      setElapsedTime(0);
      toast.success("Road sweeping session started");
      startGPSTracking();
    },
    onError: () => {
      toast.error("Failed to start work session");
    },
  });

  // End work session
  const endWorkMutation = trpc.workLog.end.useMutation({
    onSuccess: () => {
      setWorkStarted(false);
      setWorkLogId(null);
      setGpsTrail([]);
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
      }
      toast.success("Road sweeping session completed");
    },
    onError: () => {
      toast.error("Failed to end work session");
    },
  });

  // Start GPS tracking
  const startGPSTracking = () => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: Date.now(),
          };

          if (!startLocation) {
            setStartLocation(newLocation);
            setStartQRScanned(false);
          }

          setGpsTrail((prev) => [...prev, newLocation]);
          setEndLocation(newLocation);

          // Calculate distance
          if (gpsTrail.length > 0) {
            const lastPoint = gpsTrail[gpsTrail.length - 1];
            const distance = calculateDistance(lastPoint.lat, lastPoint.lon, newLocation.lat, newLocation.lon);
            setTotalDistance((prev) => prev + distance);
          }
        },
        (error) => {
          toast.error("Failed to track GPS location");
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

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (workStarted) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [workStarted]);

  // Format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle work start
  const handleStartWork = () => {
    if (user?.wardId) {
      startWorkMutation.mutate({
        wardId: user.wardId,
        moduleType: "road_sweeping",
      });
    }
  };

  // Handle work end
  const handleEndWork = () => {
    if (workLogId && startQRScanned && endQRScanned) {
      const gpsTrailGeoJson = {
        type: "LineString",
        coordinates: gpsTrail.map((p) => [p.lon, p.lat]),
      };

      endWorkMutation.mutate({
        workLogId,
        gpsTrailGeoJson,
        totalDistance: totalDistance.toFixed(2),
      });
    } else {
      toast.error("Please scan both start and end QR codes before ending work");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Road Sweeping</h1>
            <p className="text-muted-foreground mt-2">GPS breadcrumb trail tracking with start/end QR verification</p>
          </div>
          <Badge className={workStarted ? "badge-success" : "badge-secondary"}>
            {workStarted ? "Work In Progress" : "Idle"}
          </Badge>
        </div>

        {/* Work Session Controls */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Work Session</CardTitle>
            <CardDescription>Track your road sweeping route with GPS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Work Session Buttons */}
            <div className="flex gap-2">
              {!workStarted ? (
                <Button className="btn-glass-primary flex-1" onClick={handleStartWork} disabled={startWorkMutation.isPending}>
                  <Play className="w-4 h-4 mr-2" />
                  {startWorkMutation.isPending ? "Starting..." : "Start Work"}
                </Button>
              ) : (
                <Button
                  className="btn-glass-primary flex-1"
                  onClick={handleEndWork}
                  disabled={endWorkMutation.isPending || !startQRScanned || !endQRScanned}
                >
                  <Square className="w-4 h-4 mr-2" />
                  {endWorkMutation.isPending ? "Ending..." : "End Work"}
                </Button>
              )}
            </div>

            {!workStarted && (
              <div className="p-3 bg-blue-50 rounded-[20px] border border-blue-200">
                <p className="text-sm text-blue-700">
                  ℹ️ You must scan the start QR code when beginning work and the end QR code when finishing.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Verification Section */}
        {workStarted && (
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>QR Code Verification</CardTitle>
              <CardDescription>Scan start and end points to verify work route</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/50 rounded-[20px] border border-gray-200">
                <div className="flex items-center gap-3">
                  {startQRScanned ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <div>
                    <p className="font-semibold text-foreground">Start Point</p>
                    <p className="text-sm text-muted-foreground">
                      {startLocation
                        ? `${startLocation.lat.toFixed(6)}, ${startLocation.lon.toFixed(6)}`
                        : "Waiting for GPS..."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className={startQRScanned ? "badge-success" : "btn-glass"}
                  onClick={() => setStartQRScanned(!startQRScanned)}
                >
                  {startQRScanned ? "✓ Scanned" : "Scan"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/50 rounded-[20px] border border-gray-200">
                <div className="flex items-center gap-3">
                  {endQRScanned ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <div>
                    <p className="font-semibold text-foreground">End Point</p>
                    <p className="text-sm text-muted-foreground">
                      {endLocation
                        ? `${endLocation.lat.toFixed(6)}, ${endLocation.lon.toFixed(6)}`
                        : "Waiting for GPS..."}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className={endQRScanned ? "badge-success" : "btn-glass"}
                  onClick={() => setEndQRScanned(!endQRScanned)}
                >
                  {endQRScanned ? "✓ Scanned" : "Scan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        {workStarted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  Distance Covered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(totalDistance / 1000).toFixed(2)} km</div>
                <p className="text-xs text-muted-foreground mt-1">{gpsTrail.length} GPS points</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  Elapsed Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatTime(elapsedTime)}</div>
                <p className="text-xs text-muted-foreground mt-1">Work duration</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Avg Speed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {elapsedTime > 0 ? ((totalDistance / elapsedTime) * 3.6).toFixed(1) : "0"} km/h
                </div>
                <p className="text-xs text-muted-foreground mt-1">Average speed</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Route Visualization Info */}
        {workStarted && gpsTrail.length > 0 && (
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Route Visualization</CardTitle>
              <CardDescription>Your GPS breadcrumb trail</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-[20px] p-8 text-center border border-blue-200">
                <MapPin className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Map Visualization</p>
                <p className="text-xs text-muted-foreground">Leaflet.js map will display your route here</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {gpsTrail.length} GPS points recorded • {(totalDistance / 1000).toFixed(2)} km covered
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

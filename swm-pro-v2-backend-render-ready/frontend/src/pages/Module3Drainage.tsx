import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, MapPin, Play, Square, Zap, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Module 3: Drainage Cleaning
 * 90% spatial overlap calculation, auto-complete logic, swarm view for multiple workers
 */

export default function Module3Drainage() {
  const { user } = useAuth();
  const [workStarted, setWorkStarted] = useState(false);
  const [workLogId, setWorkLogId] = useState<number | null>(null);
  const [selectedDrainageLineId, setSelectedDrainageLineId] = useState<number | null>(null);
  const [gpsTrail, setGpsTrail] = useState<Array<{ lat: number; lon: number; timestamp: number }>>([]);
  const [overlapPercentage, setOverlapPercentage] = useState(0);
  const [autoCompleted, setAutoCompleted] = useState(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch drainage lines for selected ward
  const { data: drainageLines } = trpc.drainage.getLinesByWard.useQuery(
    { wardId: user?.wardId || 0 },
    { enabled: !!user?.wardId }
  );

  // Start work session
  const startWorkMutation = trpc.workLog.start.useMutation({
    onSuccess: (data) => {
      setWorkLogId(data.workLogId);
      setWorkStarted(true);
      toast.success("Drainage cleaning session started");
      startGPSTracking();
    },
    onError: () => {
      toast.error("Failed to start work session");
    },
  });

  // Record trail mutation
  const recordTrailMutation = trpc.drainage.recordTrail.useMutation({
    onSuccess: (data) => {
      setOverlapPercentage(parseFloat(data.overlapPercentage));
      setAutoCompleted(data.autoCompleted);

      if (data.autoCompleted) {
        toast.success("🎉 Work auto-completed! 90% overlap achieved!");
      } else {
        toast.info(`Overlap: ${data.overlapPercentage}%`);
      }
    },
    onError: () => {
      toast.error("Failed to record trail");
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
      toast.success("Drainage cleaning session completed");
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

          setGpsTrail((prev) => [...prev, newLocation]);
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
        moduleType: "drainage",
      });
    }
  };

  // Handle record trail
  const handleRecordTrail = () => {
    if (workLogId && selectedDrainageLineId && gpsTrail.length > 0) {
      const gpsTrailGeoJson = {
        type: "LineString",
        coordinates: gpsTrail.map((p) => [p.lon, p.lat]),
      };

      recordTrailMutation.mutate({
        workLogId,
        trailGeoJson: gpsTrailGeoJson,
        drainageLineId: selectedDrainageLineId,
      });
    } else {
      toast.error("Please select a drainage line and ensure GPS is tracking");
    }
  };

  // Handle work end
  const handleEndWork = () => {
    if (workLogId) {
      endWorkMutation.mutate({
        workLogId,
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Drainage Cleaning</h1>
            <p className="text-muted-foreground mt-2">90% spatial overlap detection with auto-complete and swarm view</p>
          </div>
          <Badge className={workStarted ? "badge-success" : "badge-secondary"}>
            {workStarted ? "Work In Progress" : "Idle"}
          </Badge>
        </div>

        {/* Work Session Controls */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Work Session</CardTitle>
            <CardDescription>Track drainage cleaning with GPS and auto-complete on 90% overlap</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drainage Line Selection */}
            {!workStarted && (
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Select Drainage Line</label>
                <Select value={selectedDrainageLineId?.toString() || ""} onValueChange={(v) => setSelectedDrainageLineId(parseInt(v))}>
                  <SelectTrigger className="input-glass">
                    <SelectValue placeholder="Select a drainage line" />
                  </SelectTrigger>
                  <SelectContent>
                    {drainageLines?.map((line) => (
                      <SelectItem key={line.id} value={line.id.toString()}>
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Work Session Buttons */}
            <div className="flex gap-2">
              {!workStarted ? (
                <Button
                  className="btn-glass-primary flex-1"
                  onClick={handleStartWork}
                  disabled={startWorkMutation.isPending || !selectedDrainageLineId}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {startWorkMutation.isPending ? "Starting..." : "Start Work"}
                </Button>
              ) : (
                <Button className="btn-glass-primary flex-1" onClick={handleEndWork} disabled={endWorkMutation.isPending}>
                  <Square className="w-4 h-4 mr-2" />
                  {endWorkMutation.isPending ? "Ending..." : "End Work"}
                </Button>
              )}
            </div>

            {autoCompleted && (
              <div className="p-3 bg-green-50 rounded-[20px] border border-green-200 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-700">✓ Work auto-completed! 90% overlap achieved!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overlap Monitoring */}
        {workStarted && (
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Overlap Calculation</CardTitle>
              <CardDescription>Real-time spatial overlap with drainage line</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overlap Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Overlap Coverage</p>
                  <p className="text-sm font-bold text-blue-600">{overlapPercentage.toFixed(1)}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(overlapPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {overlapPercentage >= 90 ? "✓ Target reached!" : `${(90 - overlapPercentage).toFixed(1)}% more to auto-complete`}
                </p>
              </div>

              {/* Record Trail Button */}
              <Button
                className="btn-glass-primary w-full"
                onClick={handleRecordTrail}
                disabled={recordTrailMutation.isPending || gpsTrail.length === 0}
              >
                <Zap className="w-4 h-4 mr-2" />
                {recordTrailMutation.isPending ? "Recording..." : "Record & Calculate Overlap"}
              </Button>

              {gpsTrail.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {gpsTrail.length} GPS points recorded
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        {workStarted && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  GPS Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gpsTrail.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Recorded points</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Elapsed Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatTime(elapsedTime)}</div>
                <p className="text-xs text-muted-foreground mt-1">Work duration</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Swarm View Section */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Swarm View</CardTitle>
            <CardDescription>Multiple workers on same drainage line</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-[20px] p-8 text-center border border-blue-200">
              <Users className="w-12 h-12 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Worker Trails Merge View</p>
              <p className="text-xs text-muted-foreground">
                When multiple workers clean the same drainage line, their trails are merged to show combined coverage
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Complete Logic Info */}
        <Card className="card-hover bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-900">Auto-Complete Logic</CardTitle>
            <CardDescription className="text-green-800">How the system determines task completion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-green-900">
            <p>✓ When your GPS trail overlaps 90% with the pre-defined drainage line:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>System automatically marks task as completed</li>
              <li>No manual end QR scan required</li>
              <li>Work log is finalized with full trail data</li>
              <li>Overlap percentage is recorded for analytics</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

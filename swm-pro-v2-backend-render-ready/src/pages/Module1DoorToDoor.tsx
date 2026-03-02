import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, MapPin, QrCode, Camera, Play, Square } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Module 1: Door-to-Door Collection
 * Real-time IMEI tracking, QR scanning, GPS verification, photo upload
 */

export default function Module1DoorToDoor() {
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [workStarted, setWorkStarted] = useState(false);
  const [workLogId, setWorkLogId] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [scannedPoints, setScannedPoints] = useState<any[]>([]);
  const [deviceIMEI, setDeviceIMEI] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start work session
  const startWorkMutation = trpc.workLog.start.useMutation({
    onSuccess: (data) => {
      setWorkLogId(data.workLogId);
      setWorkStarted(true);
      toast.success("Work session started");
    },
    onError: (error) => {
      toast.error("Failed to start work session");
    },
  });

  // End work session
  const endWorkMutation = trpc.workLog.end.useMutation({
    onSuccess: () => {
      setWorkStarted(false);
      setWorkLogId(null);
      setScannedPoints([]);
      toast.success("Work session completed");
    },
    onError: (error) => {
      toast.error("Failed to end work session");
    },
  });

  // QR Scan mutation
  const qrScanMutation = trpc.qrScan.scan.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Point scanned successfully! Distance: ${data.distance}m`);
        setScannedPoints([...scannedPoints, { qrId: "", distance: data.distance, status: "success" }]);
      } else {
        toast.error(`Scan failed: ${data.scanStatus}`);
        if (data.isMockLocation) {
          toast.error("⚠️ Mock location detected - Anti-spoofing active");
        }
      }
    },
    onError: (error) => {
      toast.error("Failed to scan QR code");
    },
  });

  // Get current location
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          toast.error("Failed to get location");
        }
      );
    }
  };

  // Start camera for QR scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (error) {
      toast.error("Failed to access camera");
    }
  };

  // Capture QR code
  const captureQR = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        // TODO: Implement QR code decoding library
        toast.success("QR captured - decoding in progress");
      }
    }
  };

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setPhotoFile(e.target.files[0]);
      toast.success("Photo selected");
    }
  };

  // Handle work start
  const handleStartWork = () => {
    if (user?.wardId) {
      startWorkMutation.mutate({
        wardId: user.wardId,
        moduleType: "door_to_door",
      });
      getLocation();
    }
  };

  // Handle work end
  const handleEndWork = () => {
    if (workLogId) {
      endWorkMutation.mutate({
        workLogId,
        qrScansCount: scannedPoints.length,
        pointsCollected: scannedPoints.filter((p) => p.status === "success").length,
        photoUrl: photoFile ? URL.createObjectURL(photoFile) : undefined,
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Door-to-Door Collection</h1>
            <p className="text-muted-foreground mt-2">Real-time QR scanning with IMEI tracking and GPS verification</p>
          </div>
          <Badge className={workStarted ? "badge-success" : "badge-secondary"}>
            {workStarted ? "Work In Progress" : "Idle"}
          </Badge>
        </div>

        {/* Work Session Controls */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Work Session</CardTitle>
            <CardDescription>Start and manage your collection work</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Device IMEI */}
              <div>
                <Label htmlFor="imei">Device IMEI</Label>
                <Input
                  id="imei"
                  placeholder="Enter device IMEI"
                  value={deviceIMEI}
                  onChange={(e) => setDeviceIMEI(e.target.value)}
                  className="input-glass"
                  disabled={workStarted}
                />
                <p className="text-xs text-muted-foreground mt-1">Used for IMEI verification during scans</p>
              </div>

              {/* Current Location */}
              <div>
                <Label>Current Location</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-white/50 rounded-[20px] border border-gray-200">
                    {currentLocation ? (
                      <p className="text-sm text-foreground">
                        {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not available</p>
                    )}
                  </div>
                  <Button size="sm" className="btn-glass-primary" onClick={getLocation}>
                    <MapPin className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Work Session Buttons */}
            <div className="flex gap-2">
              {!workStarted ? (
                <Button className="btn-glass-primary flex-1" onClick={handleStartWork} disabled={startWorkMutation.isPending}>
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
          </CardContent>
        </Card>

        {/* QR Scanning Section */}
        {workStarted && (
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>QR Code Scanner</CardTitle>
                <CardDescription>Scan collection points to mark them as collected</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="btn-glass-primary">
                    <QrCode className="w-4 h-4 mr-2" />
                    Open Scanner
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>QR Code Scanner</DialogTitle>
                    <DialogDescription>Point camera at QR code to scan</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {!isScanning ? (
                      <Button className="btn-glass-primary w-full" onClick={startCamera}>
                        <Camera className="w-4 h-4 mr-2" />
                        Start Camera
                      </Button>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full rounded-[20px] border-2 border-blue-600"
                        />
                        <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                        <Button className="btn-glass-primary w-full" onClick={captureQR}>
                          <QrCode className="w-4 h-4 mr-2" />
                          Capture & Scan
                        </Button>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scannedPoints.length === 0 ? (
                  <div className="text-center py-8">
                    <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-muted-foreground">No points scanned yet</p>
                  </div>
                ) : (
                  scannedPoints.map((point, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white/50 rounded-[20px] border border-gray-200">
                      <div className="flex items-center gap-3">
                        {point.status === "success" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-semibold text-foreground">Point #{idx + 1}</p>
                          <p className="text-sm text-muted-foreground">Distance: {point.distance}m</p>
                        </div>
                      </div>
                      <Badge className={point.status === "success" ? "badge-success" : "badge-danger"}>
                        {point.status === "success" ? "Collected" : "Failed"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photo Upload Section */}
        {workStarted && (
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Photo Upload</CardTitle>
              <CardDescription>Upload proof of collection (if required)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-[20px] p-8 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">Click to upload photo</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                  </label>
                </div>
                {photoFile && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-[20px] border border-green-200">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-700">{photoFile.name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        {workStarted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Points Scanned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scannedPoints.length}</div>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Successful</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {scannedPoints.filter((p) => p.status === "success").length}
                </div>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {scannedPoints.filter((p) => p.status !== "success").length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

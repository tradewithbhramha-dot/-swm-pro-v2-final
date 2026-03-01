import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Camera, Lock, FileText, Shield, Smartphone, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { PINVerificationDialog } from "@/components/PINVerificationDialog";

/**
 * Settings Page - Master Features
 * Photo Toggle, Security (OTP+PIN), Reports, Anti-Spoofing Configuration
 */

export default function Settings() {
  const { user } = useAuth();
  const [photoMandatory, setPhotoMandatory] = useState(false);
  const [antiSpoofingEnabled, setAntiSpoofingEnabled] = useState(true);
  const [depotDwellThreshold, setDepotDwellThreshold] = useState(5);
  const [otpCode, setOtpCode] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [showPINDialog, setShowPINDialog] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimeRemaining, setOtpTimeRemaining] = useState(0);

  const [, setLocation] = useLocation();

  // Get config
  const { data: config } = trpc.config.get.useQuery();

  // Update config mutation
  const updateConfigMutation = trpc.config.update.useMutation({
    onSuccess: () => {
      toast.success("Settings updated successfully");
    },
    onError: () => {
      toast.error("Failed to update settings");
    },
  });

  const userPhone = user?.phone || user?.email || "Unknown";

  // tRPC mutations for OTP/PIN
  const requestOtpMutation = trpc.auth.requestOtp.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
  const setPINMutation = trpc.auth.setPIN.useMutation();
  const getOtpStatusQuery = trpc.auth.getOTPStatus.useQuery(
    { phone: user?.phone || "" },
    { enabled: !!user?.phone && otpSent, refetchInterval: 1000 }
  );

  // OTP countdown timer
  useEffect(() => {
    if (otpSent && getOtpStatusQuery.data?.remainingTime) {
      setOtpTimeRemaining(getOtpStatusQuery.data.remainingTime);
      const timer = setInterval(() => {
        setOtpTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpSent, getOtpStatusQuery.data?.remainingTime]);

  // Handle config update
  const handleUpdateConfig = () => {
    updateConfigMutation.mutate({
      photoMandatory,
      antiSpoofingEnabled,
      depotDwellThresholdMinutes: depotDwellThreshold,
    });
  };

  // Handle OTP generation
  const handleGenerateOTP = async () => {
    if (!user?.phone) {
      toast.error("User phone number not available.");
      return;
    }
    try {
      const result = await requestOtpMutation.mutateAsync({ phone: user.phone });
      if (result.success) {
        toast.success("OTP sent to your phone");
        setOtpSent(true);
        setShowOTPDialog(true);
        setOtpTimeRemaining(result.expiresIn || 600);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send OTP");
    }
  };

  // Handle OTP verification and PIN setting
  const handleVerifyOTPAndSetPIN = async () => {
    if (!user?.phone || otpCode.length !== 6 || pinCode.length !== 4) {
      toast.error("Please fill in all fields correctly.");
      return;
    }

    try {
      // Verify OTP
      const otpResult = await verifyOtpMutation.mutateAsync({ phone: user.phone, otp: otpCode });
      if (!otpResult.verified) {
        toast.error(otpResult.message);
        return;
      }

      // Set PIN
      const pinResult = await setPINMutation.mutateAsync({ pin: pinCode, confirmPin: pinCode });
      if (pinResult.success) {
        toast.success("PIN set successfully!");
        setShowOTPDialog(false);
        setOtpCode("");
        setPinCode("");
        setOtpSent(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "OTP verification or PIN setup failed");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only administrators can access settings.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
          <p className="text-muted-foreground mt-2">Configure global system features and security settings</p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="features" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white/50 backdrop-blur-sm rounded-[20px] p-1">
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="anti-spoofing">Anti-Spoofing</TabsTrigger>
          </TabsList>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  Photo Upload Requirement
                </CardTitle>
                <CardDescription>Make photo uploads mandatory for all work completion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/50 rounded-[20px] border border-gray-200">
                  <div>
                    <p className="font-semibold text-foreground">Mandatory Photo Upload</p>
                    <p className="text-sm text-muted-foreground">
                      {photoMandatory
                        ? "Workers must upload a photo to complete tasks"
                        : "Photo upload is optional"}
                    </p>
                  </div>
                  <Switch checked={photoMandatory} onCheckedChange={setPhotoMandatory} />
                </div>

                <div className="p-3 bg-blue-50 rounded-[20px] border border-blue-200">
                  <p className="text-sm text-blue-700">
                    ℹ️ When enabled, workers cannot mark tasks as complete without uploading proof photo.
                  </p>
                </div>

                <Button className="btn-glass-primary w-full" onClick={handleUpdateConfig} disabled={updateConfigMutation.isPending}>
                  {updateConfigMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </CardContent>
            </Card>

            {/* Depot Configuration */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle>Depot Configuration</CardTitle>
                <CardDescription>Adjust depot geofence parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="dwell-threshold">Dwell Time Threshold (minutes)</Label>
                  <Input
                    id="dwell-threshold"
                    type="number"
                    value={depotDwellThreshold}
                    onChange={(e) => setDepotDwellThreshold(parseInt(e.target.value))}
                    className="input-glass mt-2"
                    min="1"
                    max="60"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Vehicle must stay in geofence for this duration to auto-increment trip
                  </p>
                </div>

                <Button className="btn-glass-primary w-full" onClick={handleUpdateConfig} disabled={updateConfigMutation.isPending}>
                  {updateConfigMutation.isPending ? "Saving..." : "Update Depot Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  Mobile OTP + 4-Digit PIN
                </CardTitle>
                <CardDescription>Multi-factor authentication for worker access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-white/50 rounded-[20px] border border-gray-200">
                  <p className="font-semibold text-foreground mb-2">Current Security Status</p>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>Phone: {userPhone}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600" />
                      <span>PIN: {user?.pin ? "✓ Set" : "Not configured"}</span>
                    </p>
                  </div>
                </div>

                  <Button className="btn-glass-primary w-full" onClick={handleGenerateOTP} disabled={requestOtpMutation.isPending || otpSent}>
                    {requestOtpMutation.isPending ? "Sending OTP..." : "Set/Update PIN"}
                  </Button>

                  {/* OTP Verification Dialog */}
                  <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Verify OTP & Set PIN</DialogTitle>
                        <DialogDescription>Enter the OTP sent to {userPhone} and create a 4-digit PIN</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="otp">OTP Code</Label>
                          <Input
                            id="otp"
                            placeholder="Enter 6-digit OTP"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            className="input-glass mt-2"
                            maxLength={6}
                          />
                        </div>

                        {otpSent && otpTimeRemaining > 0 && (
                          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex items-center justify-between">
                            <p className="text-sm text-yellow-700">OTP expires in:</p>
                            <p className="text-lg font-semibold text-yellow-900">
                              {formatTime(otpTimeRemaining)}
                            </p>
                          </div>
                        )}

                        <div>
                          <Label htmlFor="pin">4-Digit PIN</Label>
                          <Input
                            id="pin"
                            placeholder="Enter 4-digit PIN"
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value.slice(0, 4))}
                            className="input-glass mt-2"
                            maxLength={4}
                            type="password"
                          />
                        </div>

                        <Button
                          className="btn-glass-primary w-full"
                          onClick={handleVerifyOTPAndSetPIN}
                          disabled={verifyOtpMutation.isPending || setPINMutation.isPending || otpCode.length !== 6 || pinCode.length !== 4}
                        >
                          {verifyOtpMutation.isPending || setPINMutation.isPending ? "Processing..." : "Verify & Set PIN"}
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleGenerateOTP}
                          disabled={requestOtpMutation.isPending || otpTimeRemaining > 300}
                        >
                          Resend OTP
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* PIN Verification Dialog (for other actions if needed) */}
                  {user?.id && (
                    <PINVerificationDialog
                      open={showPINDialog}
                      onOpenChange={setShowPINDialog}
                      userId={user.id}
                      onSuccess={() => toast.success("PIN verified for action!")}
                    />
                  )}

                <div className="p-3 bg-green-50 rounded-[20px] border border-green-200">
                  <p className="text-sm text-green-700">
                    ✓ OTP + PIN provides two-factor authentication for worker access to the system.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Export Reports
                </CardTitle>
                <CardDescription>Generate and download system reports in PDF and Excel formats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="btn-glass-primary w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Daily Collection Report (PDF)
                </Button>
                <Button className="btn-glass-primary w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Daily Collection Report (Excel)
                </Button>
                <Button className="btn-glass-primary w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Weekly Performance Report (PDF)
                </Button>
                <Button className="btn-glass-primary w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Worker Analytics (Excel)
                </Button>
                <Button className="btn-glass-primary w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Coverage Map Report (PDF)
                </Button>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Report Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-blue-900">
                <p>📊 All reports include map snapshots with ward boundaries and coverage areas</p>
                <p>📈 Performance metrics: completion rates, worker productivity, distance covered</p>
                <p>🗺️ Geographic analysis: coverage heatmaps, collection density, route optimization</p>
                <p>📋 Detailed logs: QR scans, GPS trails, photo uploads, timestamps</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anti-Spoofing Tab */}
          <TabsContent value="anti-spoofing" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Anti-GPS Spoofing
                </CardTitle>
                <CardDescription>Prevent mock location attacks and ensure genuine GPS data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/50 rounded-[20px] border border-gray-200">
                  <div>
                    <p className="font-semibold text-foreground">Enable Anti-Spoofing</p>
                    <p className="text-sm text-muted-foreground">
                      {antiSpoofingEnabled
                        ? "Mock location detection is active"
                        : "Mock location detection is disabled"}
                    </p>
                  </div>
                  <Switch checked={antiSpoofingEnabled} onCheckedChange={setAntiSpoofingEnabled} />
                </div>

                <div className="p-3 bg-yellow-50 rounded-[20px] border border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    ⚠️ When enabled, the system will detect and reject QR scans from devices using mock/fake GPS locations.
                  </p>
                </div>

                <Button className="btn-glass-primary w-full" onClick={handleUpdateConfig} disabled={updateConfigMutation.isPending}>
                  {updateConfigMutation.isPending ? "Saving..." : "Update Anti-Spoofing Settings"}
                </Button>

                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-[20px] border border-blue-200 space-y-2">
                  <p className="font-semibold text-blue-900">Detection Methods:</p>
                  <ul className="text-sm text-blue-900 space-y-1">
                    <li>✓ Device location provider check</li>
                    <li>✓ GPS accuracy validation</li>
                    <li>✓ Location consistency analysis</li>
                    <li>✓ Impossible travel detection</li>
                    <li>✓ Timestamp verification</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

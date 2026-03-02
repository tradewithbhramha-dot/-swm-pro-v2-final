import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AlertCircle, CheckCircle2, Loader2, Phone, Lock, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

/**
 * OTP Authentication Page - Worker Mobile App
 * Multi-step authentication: Phone → OTP → PIN
 * Integrates with Twilio SMS gateway for real OTP delivery
 */

type AuthStep = "phone" | "otp" | "pin" | "success";

export default function OTPAuth() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpTimeRemaining, setOtpTimeRemaining] = useState(0);
  const [userId, setUserId] = useState<number | null>(null);

  // tRPC mutations
  const requestOtpMutation = trpc.auth.requestOtp.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
  const setPINMutation = trpc.auth.setPIN.useMutation();
  const getOtpStatusQuery = trpc.auth.getOTPStatus.useQuery(
    { phone: phone || "" },
    { enabled: step === "otp" && phone.length > 0, refetchInterval: 1000 }
  );

  // OTP countdown timer
  useEffect(() => {
    if (step === "otp" && getOtpStatusQuery.data?.remainingTime) {
      setOtpTimeRemaining(getOtpStatusQuery.data.remainingTime);
      const timer = setInterval(() => {
        setOtpTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, getOtpStatusQuery.data?.remainingTime]);

  /**
   * Step 1: Request OTP via SMS
   */
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const result = await requestOtpMutation.mutateAsync({ phone });
      if (result.success) {
        toast.success("OTP sent to your phone");
        setStep("otp");
        setOtpTimeRemaining(result.expiresIn || 600);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 2: Verify OTP
   */
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOtpMutation.mutateAsync({ phone, otp });
      if (result.verified) {
        toast.success("OTP verified successfully");
        setStep("pin");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP");
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 3: Set PIN
   */
  const handleSetPIN = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length !== 4) {
      toast.error("PIN must be 4 digits");
      return;
    }

    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await setPINMutation.mutateAsync({ pin, confirmPin });
      if (result.success) {
        toast.success("PIN set successfully!");
        setStep("success");
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          setLocation("/");
        }, 2000);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set PIN");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resend OTP
   */
  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const result = await requestOtpMutation.mutateAsync({ phone });
      if (result.success) {
        toast.success("OTP resent to your phone");
        setOtp("");
        setOtpTimeRemaining(result.expiresIn || 600);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SWM Pro</h1>
          <p className="text-gray-600 mt-2">Worker Mobile Authentication</p>
        </div>

        {/* Step 1: Phone Number */}
        {step === "phone" && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600" />
                Enter Phone Number
              </CardTitle>
              <CardDescription>We'll send you a verification code via SMS</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter 10-digit number or with country code (+91)
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading || phone.length < 10}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send OTP"
                  )}
                </Button>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    ℹ️ Your phone number will be verified via SMS. Standard SMS rates may apply.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: OTP Verification */}
        {step === "otp" && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Enter OTP
              </CardTitle>
              <CardDescription>
                Check your SMS for the 6-digit code sent to {phone}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <Label htmlFor="otp">6-Digit OTP Code</Label>
                  <div className="mt-2">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup className="flex justify-center gap-2">
                        <InputOTPSlot index={0} className="w-12 h-12 text-lg" />
                        <InputOTPSlot index={1} className="w-12 h-12 text-lg" />
                        <InputOTPSlot index={2} className="w-12 h-12 text-lg" />
                        <InputOTPSlot index={3} className="w-12 h-12 text-lg" />
                        <InputOTPSlot index={4} className="w-12 h-12 text-lg" />
                        <InputOTPSlot index={5} className="w-12 h-12 text-lg" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                {/* OTP Timer */}
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex items-center justify-between">
                  <p className="text-sm text-yellow-700">OTP expires in:</p>
                  <p className="text-lg font-semibold text-yellow-900">
                    {formatTime(otpTimeRemaining)}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendOTP}
                  disabled={loading || otpTimeRemaining > 300}
                >
                  Resend OTP
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setPhone("");
                  }}
                >
                  Back
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Set PIN */}
        {step === "pin" && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                Create 4-Digit PIN
              </CardTitle>
              <CardDescription>
                Set a secure PIN for quick future logins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetPIN} className="space-y-4">
                <div>
                  <Label htmlFor="pin">PIN (4 digits)</Label>
                  <Input
                    id="pin"
                    type="password"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.slice(0, 4))}
                    maxLength={4}
                    className="mt-2 text-center text-2xl tracking-widest"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPin">Confirm PIN</Label>
                  <Input
                    id="confirmPin"
                    type="password"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.slice(0, 4))}
                    maxLength={4}
                    className="mt-2 text-center text-2xl tracking-widest"
                    disabled={loading}
                  />
                </div>

                {pin && confirmPin && pin !== confirmPin && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-700">PINs do not match</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading || pin.length !== 4 || confirmPin.length !== 4 || pin !== confirmPin}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting PIN...
                    </>
                  ) : (
                    "Set PIN"
                  )}
                </Button>

                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    ✓ Your PIN will be used for secure authentication on this device.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <Card className="shadow-lg border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                Authentication Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">
                  You're all set!
                </p>
                <p className="text-gray-600 mt-2">
                  Your phone has been verified and PIN is set.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-green-200">
                <p className="text-sm text-gray-700">
                  <strong>Phone:</strong> {phone}
                </p>
              </div>

              <p className="text-sm text-gray-600 text-center">
                Redirecting to dashboard...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Security Info */}
        <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            🔒 Your data is encrypted and secure. Twilio SMS gateway ensures safe OTP delivery.
          </p>
        </div>
      </div>
    </div>
  );
}

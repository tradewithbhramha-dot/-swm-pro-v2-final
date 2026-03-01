/**
 * PIN Verification Dialog Component
 * Reusable component for PIN verification in worker mobile app
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, Loader2 } from "lucide-react";
import { usePINAuth } from "@/hooks/usePINAuth";

interface PINVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export function PINVerificationDialog({
  open,
  onOpenChange,
  userId,
  onSuccess,
  title = "Verify PIN",
  description = "Enter your 4-digit PIN to continue",
}: PINVerificationDialogProps) {
  const { pin, setPin, isVerifying, isLocked, lockoutRemaining, verifyPIN, resetPIN } = usePINAuth();
  const [lockoutTimer, setLockoutTimer] = useState(lockoutRemaining);

  // Handle lockout countdown
  useEffect(() => {
    if (isLocked && lockoutRemaining > 0) {
      setLockoutTimer(lockoutRemaining);
      const interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            // Reset lockout after countdown
            resetPIN();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isLocked, lockoutRemaining]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await verifyPIN(userId);
    if (success) {
      onSuccess?.();
      onOpenChange(false);
      resetPIN();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetPIN();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isLocked ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">PIN Locked</p>
                <p className="text-sm text-red-700 mt-1">
                  Too many failed attempts. Try again in {lockoutTimer} seconds.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4 py-4">
            <div>
              <Label htmlFor="pin">4-Digit PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.slice(0, 4))}
                maxLength={4}
                className="mt-2 text-center text-2xl tracking-widest font-semibold"
                disabled={isVerifying}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">Enter your 4-digit PIN</p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={isVerifying || pin.length !== 4}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Your PIN is stored securely on your device.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

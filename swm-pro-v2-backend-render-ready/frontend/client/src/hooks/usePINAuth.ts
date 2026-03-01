/**
 * PIN Authentication Hook
 * Manages PIN verification flow for worker authentication
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function usePINAuth() {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const verifyPINMutation = trpc.auth.verifyPIN.useMutation();

  const verifyPIN = async (userId: number): Promise<boolean> => {
    if (pin.length !== 4) {
      toast.error("PIN must be 4 digits");
      return false;
    }

    setIsVerifying(true);
    try {
      const result = await verifyPINMutation.mutateAsync({
        userId,
        pin,
      });

      if (result.success) {
        toast.success("PIN verified successfully");
        setPin("");
        return true;
      }

      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "PIN verification failed";

      // Check if it's a lockout error
      if (message.includes("locked")) {
        setIsLocked(true);
        // Extract remaining time if available
        const timeMatch = message.match(/(\d+)\s*seconds/);
        if (timeMatch) {
          setLockoutRemaining(parseInt(timeMatch[1]));
        }
      }

      toast.error(message);
      setPin("");
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const resetPIN = () => {
    setPin("");
    setIsLocked(false);
    setLockoutRemaining(0);
  };

  return {
    pin,
    setPin,
    isVerifying,
    isLocked,
    lockoutRemaining,
    verifyPIN,
    resetPIN,
  };
}

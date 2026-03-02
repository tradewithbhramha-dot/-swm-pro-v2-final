import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);

// In-memory store for OTP verification status
const otpVerificationStore = new Map<string, { verified: boolean, timestamp: number }>();

/**
 * Sends an OTP via SMS using Twilio Verify Service
 */
export async function sendOTPViaSMS(phoneNumber: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!accountSid || !authToken || !verifyServiceSid) {
      return { success: false, message: 'Twilio is not properly configured on the server' };
    }
    
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: phoneNumber, channel: 'sms' });
    
    otpVerificationStore.delete(phoneNumber);
    
    return { 
      success: verification.status === 'pending',
      message: verification.status === 'pending' ? 'OTP sent successfully' : 'Failed to send OTP'
    };
  } catch (error) {
    console.error('Error sending OTP via SMS:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to send OTP' 
    };
  }
}

/**
 * Verifies an OTP code for a phone number
 */
export async function verifyOTP(phoneNumber: string, code: string): Promise<{ success: boolean; verified: boolean; message: string }> {
  try {
    if (!accountSid || !authToken || !verifyServiceSid) {
      return { success: false, verified: false, message: 'Twilio is not properly configured' };
    }

    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phoneNumber, code });
    
    const isApproved = verificationCheck.status === 'approved';
    
    if (isApproved) {
      otpVerificationStore.set(phoneNumber, { verified: true, timestamp: Date.now() });
    }

    return { 
      success: true, 
      verified: isApproved,
      message: isApproved ? 'OTP verified successfully' : 'Invalid OTP code'
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { 
      success: false, 
      verified: false, 
      message: error instanceof Error ? error.message : 'OTP verification failed' 
    };
  }
}

/**
 * Checks if a phone number has a recently verified OTP
 */
export function isOTPVerified(phoneNumber: string): boolean {
  const record = otpVerificationStore.get(phoneNumber);
  if (!record) return false;
  
  const isExpired = Date.now() - record.timestamp > 15 * 60 * 1000;
  if (isExpired) {
    otpVerificationStore.delete(phoneNumber);
    return false;
  }
  
  return record.verified;
}

/**
 * Clears the OTP verification record for a phone number
 */
export function clearOTPRecord(phoneNumber: string): void {
  otpVerificationStore.delete(phoneNumber);
}

/**
 * Gets remaining time for OTP validity
 */
export function getOTPRemainingTime(phoneNumber: string): number {
  return 600; 
}

/**
 * Sends a custom SMS message (non-OTP)
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      throw new Error('Twilio credentials or phone number not configured');
    }

    const response = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    return !!response.sid;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

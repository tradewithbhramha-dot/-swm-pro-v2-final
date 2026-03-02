# SWM Pro v2.0 - Real SMS OTP Gateway Integration

This document outlines the integration of a real SMS OTP (One-Time Password) gateway using Twilio into the SWM Pro v2.0 project. This integration enhances the security of the Worker Mobile App by implementing a robust multi-factor authentication flow involving phone number verification via SMS and a 4-digit PIN.

## Table of Contents
1.  [Overview](#overview)
2.  [Twilio Integration Details](#twilio-integration-details)
3.  [Authentication Flow](#authentication-flow)
4.  [Environment Setup](#environment-setup)
5.  [Running the Application](#running-the-application)
6.  [Security Considerations](#security-considerations)

## 1. Overview

The SWM Pro v2.0 project now includes a secure authentication mechanism for its Worker Mobile App. This system leverages Twilio as an SMS provider to send OTPs for phone number verification, followed by a user-defined 4-digit PIN for subsequent logins. This multi-factor approach significantly improves the security posture of the application before its first deployment.

## 2. Twilio Integration Details

Twilio is used to send real SMS messages containing the OTP to the user's registered phone number. The integration involves:

-   **Twilio Account SID**: Your unique Twilio account identifier.
-   **Twilio Auth Token**: Your secret token for authenticating with the Twilio API.
-   **Twilio Phone Number**: The Twilio phone number used to send OTP messages.

These credentials are securely managed via environment variables.

## 3. Authentication Flow

The worker authentication process in the mobile app now follows these steps:

1.  **Phone Number Entry**: The worker enters their phone number in the mobile application.
2.  **OTP Request**: The application sends a request to the backend to generate and send an OTP to the provided phone number via Twilio.
3.  **OTP Verification**: The worker receives a 6-digit OTP via SMS and enters it into the application. The backend verifies this OTP against the stored one (in-memory for this implementation, but should be a persistent store like Redis in production).
4.  **PIN Creation/Update**: Upon successful OTP verification, the worker is prompted to create a 4-digit PIN. This PIN is hashed and stored in the database.
5.  **Subsequent Logins**: For future logins, workers can use their registered phone number and the 4-digit PIN for quick and secure access.

### Backend Logic

-   **`server/services/sms-service.ts`**: This new module handles OTP generation, storage (in-memory `otpStore`), and sending SMS via the Twilio API. It includes functions for `generateOTP`, `sendOTPViaSMS`, `verifyOTP`, `isOTPVerified`, `clearOTPRecord`, and `getOTPRemainingTime`.
-   **`server/services/pin-service.ts`**: This new module manages PIN hashing, verification, and lockout mechanisms. It provides `hashPIN`, `verifyPIN`, `isValidPINFormat`, `isPINLocked`, and `getPINLockoutExpiry`.
-   **`server/db-auth.ts`**: This new module extends `server/db.ts` with specific database operations for user authentication, including `updateUserPIN`, `incrementPINAttempts`, `resetPINAttempts`, `getUserPINStatus`, `updateUserPhone`, `getUserByPhone`, and `isPhoneRegistered`.
-   **`server/auth-router.ts`**: This new tRPC router integrates the `sms-service` and `pin-service` to provide robust API endpoints for `requestOtp`, `verifyOtp`, `setPIN`, `verifyPIN`, `updatePhoneAndRequestOTP`, and `getOTPStatus`.
-   **`server/routers.ts`**: The main router now imports and uses `authRouter` for all authentication-related procedures.
-   **`server/_core/env.ts`**: Updated to include `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`.

### Mobile App (Client) Logic

-   **`client/src/pages/OTPAuth.tsx`**: A new page component that guides the user through the phone number, OTP verification, and PIN setup steps. It utilizes the new tRPC procedures for authentication.
-   **`client/src/App.tsx`**: The main application router has been updated to include the `/auth/otp` route for the `OTPAuth` component.
-   **`client/src/hooks/usePINAuth.ts`**: A new React hook to manage PIN verification state and logic within the client-side application.
-   **`client/src/components/PINVerificationDialog.tsx`**: A reusable dialog component for entering and verifying PINs, including lockout handling.

## 4. Environment Setup

To run the application with the Twilio SMS OTP gateway, you need to configure the following environment variables. Create a `.env` file in the root directory of the project and populate it with your credentials:

```dotenv
# Application ID (used for OAuth)
VITE_APP_ID=your_app_id

# JWT Secret for session cookies
JWT_SECRET=your_jwt_secret_32_chars_long

# Database connection URL (MySQL/TiDB)
DATABASE_URL=mysql://user:password@host:port/database

# Manus OAuth Server URL
OAUTH_SERVER_URL=https://oauth.manus.im

# OpenID of the admin user (for initial admin setup)
OWNER_OPEN_ID=your_admin_openid

# Built-in Forge API for storage and other services
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your_forge_api_key

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACfdaaea6a75c163913959812636477e34
TWILIO_AUTH_TOKEN=50b56af2970a7f329ec7ae96c9c6b3bd
TWILIO_PHONE_NUMBER=+17744602228 # Your Twilio phone number (E.164 format)
```

**Note**: Replace the placeholder values with your actual credentials. The `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` are crucial for the SMS OTP functionality.

## 5. Running the Application

1.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
2.  **Database Migration**:
    ```bash
    pnpm run db:push
    ```
3.  **Start Development Server**:
    ```bash
    pnpm run dev
    ```

Access the application in your browser, and navigate to `/auth/otp` to test the new authentication flow.

## 6. Security Considerations

-   **Environment Variables**: Ensure all sensitive credentials (Twilio tokens, JWT secret, database URL) are stored as environment variables and not hardcoded in the codebase. Use a secure method for managing these in production environments.
-   **OTP Storage**: The current implementation uses in-memory storage for OTPs. For production, it is highly recommended to use a persistent and fast store like Redis to prevent OTP loss on server restarts and to support distributed deployments.
-   **PIN Hashing**: PINs are hashed using SHA256 with a unique salt for each user, preventing rainbow table attacks. However, consider stronger, adaptive hashing algorithms like bcrypt or Argon2 for even greater security in production.
-   **Rate Limiting**: Implement rate limiting on OTP request and verification endpoints to prevent abuse and brute-force attacks.
-   **Phone Number Validation**: The phone number validation uses a basic regex. For production, consider using a dedicated phone number validation library (e.g., `libphonenumber-js`) to handle various international formats and ensure deliverability.
-   **Error Handling**: Generic error messages are returned to the client to avoid leaking sensitive information about the authentication process.

This integration provides a solid foundation for secure worker authentication. Further enhancements can be made based on specific security requirements and production scaling needs.

# SWM Pro v2.0 - Frontend Setup Guide

This guide provides complete instructions for setting up and deploying the SWM Pro v2.0 Worker Mobile App with OTP authentication.

## Table of Contents

1.  [Prerequisites](#prerequisites)
2.  [Environment Configuration](#environment-configuration)
3.  [Installation](#installation)
4.  [Running Locally](#running-locally)
5.  [Building for Production](#building-for-production)
6.  [Deployment](#deployment)
7.  [Authentication Flow](#authentication-flow)
8.  [Components & Pages](#components--pages)
9.  [Troubleshooting](#troubleshooting)

## Prerequisites

-   **Node.js**: Version 22.12.0 or higher
-   **npm/pnpm**: Package manager (pnpm recommended)
-   **Backend Server**: Running SWM Pro v2.0 backend
-   **Modern Browser**: Chrome, Firefox, Safari, or Edge

## Environment Configuration

The frontend communicates with the backend via tRPC. Ensure your backend is running before starting the frontend.

### Backend Connection

The frontend automatically connects to the backend at:
-   **Development**: `http://localhost:5000`
-   **Production**: Configure via environment variables or backend URL

No additional `.env` configuration is required for the frontend in most cases.

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/tradewithbhramha-dot/swm-pro-frontend.git
cd swm-pro-frontend
```

### Step 2: Install Dependencies

```bash
npm install --legacy-peer-deps
# or
pnpm install
```

### Step 3: Verify Backend Connection

Ensure the backend is running on `http://localhost:5000` before starting the frontend.

## Running Locally

### Development Mode

```bash
npm run dev
# or
pnpm dev
```

The frontend will start on `http://localhost:5173` (or next available port).

**Features in Development:**
-   Hot reload on file changes
-   Live OTP/PIN authentication testing
-   Detailed error messages and console logs
-   React DevTools support

### Access the Application

1.  Open `http://localhost:5173` in your browser
2.  Navigate to `/auth/otp` to test the authentication flow
3.  Enter a phone number to request an OTP

## Building for Production

### Production Build

```bash
npm run build
# or
pnpm build
```

This command:
-   Bundles React and dependencies
-   Optimizes assets and code splitting
-   Outputs to `dist/` folder
-   Generates source maps for debugging

### Preview Production Build

```bash
npm run preview
# or
pnpm preview
```

This will serve the production build locally for testing.

## Deployment

### Deployment on Vercel

1.  **Connect Repository**: Link your GitHub repository to Vercel
2.  **Configure Build Settings**:
    -   Build Command: `npm run build`
    -   Output Directory: `dist`
3.  **Set Environment Variables** (if needed):
    -   `VITE_API_URL`: Backend API URL
4.  **Deploy**: Vercel will automatically build and deploy

### Deployment on Netlify

1.  **Connect Repository**: Link your GitHub repository to Netlify
2.  **Configure Build Settings**:
    -   Build Command: `npm run build`
    -   Publish Directory: `dist`
3.  **Deploy**: Netlify will automatically build and deploy

### Deployment on AWS S3 + CloudFront

1.  **Build the Application**:
    ```bash
    npm run build
    ```
2.  **Upload to S3**:
    ```bash
    aws s3 sync dist/ s3://your-bucket-name/
    ```
3.  **Configure CloudFront** for caching and HTTPS
4.  **Set Backend URL** in your deployment environment

### Security Checklist for Production

-   ✅ Backend API URL is correctly configured
-   ✅ HTTPS is enforced
-   ✅ CORS is properly configured on backend
-   ✅ Session cookies are secure (HttpOnly, Secure, SameSite)
-   ✅ Rate limiting is enabled on backend
-   ✅ Content Security Policy (CSP) headers are set

## Authentication Flow

### OTP Authentication Process

The Worker Mobile App implements a secure multi-step authentication:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Phone Number Entry                                  │
│ User enters phone number (10 digits or with country code)   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: OTP Request                                         │
│ Backend generates 6-digit OTP                               │
│ Twilio sends SMS to user's phone                            │
│ OTP valid for 10 minutes                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: OTP Verification                                    │
│ User enters 6-digit OTP from SMS                            │
│ Backend validates OTP and checks expiry                     │
│ Max 3 verification attempts                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: PIN Setup                                           │
│ User creates 4-digit PIN                                    │
│ PIN is hashed with SHA256 and unique salt                   │
│ Stored securely in database                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Authentication Complete                             │
│ User is logged in and redirected to dashboard               │
│ Future logins use phone + PIN                               │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App
├── Router
│   ├── OTPAuth (New Page)
│   │   ├── Phone Entry Step
│   │   ├── OTP Verification Step
│   │   ├── PIN Setup Step
│   │   └── Success Step
│   ├── Home (Dashboard)
│   ├── Module1DoorToDoor
│   ├── Module2RoadSweeping
│   ├── Module3Drainage
│   ├── Module4Depot
│   ├── Settings
│   │   └── PINVerificationDialog (Reusable)
│   └── AdminDashboard
```

## Components & Pages

### New Components

#### 1. OTPAuth Page (`client/src/pages/OTPAuth.tsx`)

The main authentication page with a 4-step process:

-   **Step 1 - Phone Entry**: User enters phone number
-   **Step 2 - OTP Verification**: User enters 6-digit OTP
-   **Step 3 - PIN Setup**: User creates 4-digit PIN
-   **Step 4 - Success**: Authentication complete

**Usage**:
```typescript
import OTPAuth from "@/pages/OTPAuth";

// Route: /auth/otp
<Route path={"/auth/otp"} component={OTPAuth} />
```

#### 2. PINVerificationDialog (`client/src/components/PINVerificationDialog.tsx`)

A reusable dialog component for PIN verification in any part of the app.

**Usage**:
```typescript
import { PINVerificationDialog } from "@/components/PINVerificationDialog";
import { useState } from "react";

export function MyComponent() {
  const [showPINDialog, setShowPINDialog] = useState(false);

  return (
    <>
      <button onClick={() => setShowPINDialog(true)}>
        Verify PIN
      </button>

      <PINVerificationDialog
        open={showPINDialog}
        onOpenChange={setShowPINDialog}
        userId={user.id}
        onSuccess={() => console.log("PIN verified!")}
      />
    </>
  );
}
```

### New Hooks

#### usePINAuth (`client/src/hooks/usePINAuth.ts`)

Manages PIN verification state and logic.

**Usage**:
```typescript
import { usePINAuth } from "@/hooks/usePINAuth";

export function MyComponent() {
  const { pin, setPin, isVerifying, isLocked, verifyPIN } = usePINAuth();

  return (
    <input
      value={pin}
      onChange={(e) => setPin(e.target.value)}
      placeholder="Enter 4-digit PIN"
    />
  );
}
```

### Updated Components

#### Settings Page (`client/src/pages/Settings.tsx`)

Now includes OTP/PIN management:

-   Request OTP button
-   OTP verification dialog
-   PIN setup form
-   OTP countdown timer
-   Resend OTP functionality

#### useAuth Hook (`client/src/_core/hooks/useAuth.ts`)

Updated to redirect unauthenticated users to `/auth/otp`:

```typescript
// If user is authenticated but doesn't have a phone, redirect to OTP setup
if (!state.user.phone) {
  window.location.href = "/auth/otp";
}
```

## File Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── OTPAuth.tsx (NEW)
│   │   ├── Home.tsx
│   │   ├── Settings.tsx (UPDATED)
│   │   ├── Module1DoorToDoor.tsx
│   │   ├── Module2RoadSweeping.tsx
│   │   ├── Module3Drainage.tsx
│   │   ├── Module4Depot.tsx
│   │   ├── AdminDashboard.tsx
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── PINVerificationDialog.tsx (NEW)
│   │   ├── DashboardLayout.tsx
│   │   ├── SpatialMap.tsx
│   │   ├── LiveWorkerMap.tsx
│   │   └── ui/
│   ├── hooks/
│   │   ├── usePINAuth.ts (NEW)
│   │   ├── useLocationTracking.ts
│   │   ├── useFileUpload.ts
│   │   └── useComposition.ts
│   ├── _core/
│   │   └── hooks/
│   │       └── useAuth.ts (UPDATED)
│   ├── lib/
│   │   ├── trpc.ts
│   │   └── utils.ts
│   ├── contexts/
│   │   └── ThemeContext.tsx
│   ├── App.tsx (UPDATED)
│   ├── main.tsx
│   └── index.css
├── public/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

## Troubleshooting

### Backend Connection Error

**Error**: `Failed to connect to backend at http://localhost:5000`

**Solution**:
1.  Ensure backend is running: `npm run dev` in backend folder
2.  Check backend port: Default is 5000
3.  Verify CORS is enabled on backend
4.  Check browser console for detailed error

### OTP Not Received

**Error**: `OTP sent successfully` but no SMS received

**Solution**:
1.  Verify phone number format: `+91` prefix for India
2.  Check Twilio account has sufficient credits
3.  Verify phone number is not in restricted region
4.  Check backend logs for Twilio API errors

### PIN Verification Fails

**Error**: `Invalid PIN` or `PIN is locked`

**Solution**:
1.  Ensure PIN is 4 digits
2.  Check for lockout: Wait 30 minutes after 5 failed attempts
3.  Verify PIN was set correctly in previous step
4.  Check database for PIN hash

### Build Errors

**Error**: `Cannot find module '@/components/...'`

**Solution**:
1.  Verify path aliases in `vite.config.ts`
2.  Check file exists at the specified path
3.  Ensure imports use correct case (case-sensitive)
4.  Run `npm install` again

### Port Already in Use

**Error**: `Port 5173 is already in use`

**Solution**:
```bash
# Use a different port
npm run dev -- --port 3000

# Or kill the process using the port
lsof -i :5173
kill -9 <PID>
```

## Performance Optimization

### Code Splitting

The app uses React lazy loading for better performance:

```typescript
const OTPAuth = lazy(() => import("@/pages/OTPAuth"));
```

### Image Optimization

-   Use WebP format for images
-   Optimize images before deployment
-   Use CDN for static assets

### Bundle Size

Current bundle size: ~500KB (gzipped)

To analyze:
```bash
npm run build -- --analyze
```

## Next Steps

1.  **Backend Integration**: Ensure backend is running and configured
2.  **Testing**: Test OTP flow with real Twilio credentials
3.  **Customization**: Customize UI/UX as needed
4.  **Deployment**: Deploy to production platform
5.  **Monitoring**: Set up error tracking and analytics

## Support

For issues or questions:
1.  Check the [README.md](./README.md) for general integration details
2.  Review React documentation: https://react.dev
3.  Check Vite documentation: https://vitejs.dev
4.  Review tRPC client documentation: https://trpc.io/docs/client

---

**Last Updated**: February 27, 2026
**Version**: 1.0.0

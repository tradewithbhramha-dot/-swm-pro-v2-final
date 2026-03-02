# SWM Pro v2.0 - Backend Setup Guide

This guide provides complete instructions for setting up and deploying the SWM Pro v2.0 backend with Twilio SMS OTP integration.

## Table of Contents

1.  [Prerequisites](#prerequisites)
2.  [Environment Configuration](#environment-configuration)
3.  [Installation](#installation)
4.  [Database Setup](#database-setup)
5.  [Running Locally](#running-locally)
6.  [Production Deployment](#production-deployment)
7.  [Twilio SMS Integration](#twilio-sms-integration)
8.  [API Endpoints](#api-endpoints)
9.  [Troubleshooting](#troubleshooting)

## Prerequisites

-   **Node.js**: Version 22.12.0 or higher
-   **npm/pnpm**: Package manager (pnpm recommended)
-   **MySQL/TiDB**: Database server
-   **Twilio Account**: For SMS OTP delivery

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```dotenv
# Application Configuration
VITE_APP_ID=your_app_id
NODE_ENV=production

# JWT & Session Management
JWT_SECRET=your_jwt_secret_min_32_chars

# Database Connection
DATABASE_URL=mysql://user:password@host:port/database

# OAuth Server
OAUTH_SERVER_URL=https://oauth.manus.im
OWNER_OPEN_ID=your_admin_openid

# Forge API (Storage & Services)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your_forge_api_key

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACfdaaea6a75c163913959812636477e34
TWILIO_AUTH_TOKEN=50b56af2970a7f329ec7ae96c9c6b3bd
TWILIO_PHONE_NUMBER=+17744602228
```

### Environment Variable Details

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_APP_ID` | Unique application identifier | `swm-pro-v2` |
| `JWT_SECRET` | Secret for session token signing (min 32 chars) | `your_super_secret_key_min_32_characters` |
| `DATABASE_URL` | MySQL/TiDB connection string | `mysql://root:password@localhost:3306/swm_pro` |
| `OAUTH_SERVER_URL` | OAuth server endpoint | `https://oauth.manus.im` |
| `OWNER_OPEN_ID` | Initial admin user's OpenID | `admin@example.com` |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier | `ACfdaaea6a75c163913959812636477e34` |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token | `50b56af2970a7f329ec7ae96c9c6b3bd` |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (E.164 format) | `+17744602228` |

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/tradewithbhramha-dot/swm-pro-backend.git
cd swm-pro-backend
```

### Step 2: Install Dependencies

```bash
npm install --legacy-peer-deps
# or
pnpm install
```

### Step 3: Verify Environment Setup

```bash
# Check that .env file is properly configured
cat .env
```

## Database Setup

### Step 1: Create Database

```bash
mysql -u root -p
CREATE DATABASE swm_pro;
EXIT;
```

### Step 2: Run Migrations

```bash
npm run db:push
# or
pnpm db:push
```

This command will:
-   Generate migration files from the Drizzle schema
-   Apply all pending migrations to the database
-   Create tables for users, locations, work records, and OTP/PIN data

### Step 3: Verify Database

```bash
mysql -u root -p swm_pro
SHOW TABLES;
DESCRIBE users;
EXIT;
```

## Running Locally

### Development Mode

```bash
npm run dev
# or
pnpm dev
```

The server will start on `http://localhost:5000` (or configured port).

**Features in Development:**
-   Hot reload on file changes
-   Vite middleware for frontend development
-   Detailed error logging

### Production Build

```bash
npm run build
# or
pnpm build
```

This command:
-   Bundles the backend using esbuild
-   Outputs to `dist/index.js`
-   Optimizes for production deployment

### Starting Production Server

```bash
npm start
# or
pnpm start
```

## Production Deployment

### Deployment on Render.com

1.  **Connect Repository**: Link your GitHub repository to Render
2.  **Configure Build Command**:
    ```
    npm install --legacy-peer-deps && npm run build
    ```
3.  **Configure Start Command**:
    ```
    npm start
    ```
4.  **Set Environment Variables**: Add all `.env` variables in Render dashboard
5.  **Deploy**: Render will automatically build and deploy

### Deployment on Other Platforms (Heroku, AWS, etc.)

1.  **Build the Application**:
    ```bash
    npm run build
    ```
2.  **Upload `dist/` folder** to your hosting platform
3.  **Set Environment Variables** in your hosting dashboard
4.  **Start the Server**:
    ```bash
    npm start
    ```

### Security Checklist for Production

-   ✅ All environment variables are set securely
-   ✅ `JWT_SECRET` is strong and unique (min 32 characters)
-   ✅ Database credentials are not hardcoded
-   ✅ Twilio credentials are stored as environment variables
-   ✅ HTTPS is enforced
-   ✅ CORS is properly configured
-   ✅ Rate limiting is enabled
-   ✅ Database backups are configured

## Twilio SMS Integration

### How OTP Works

1.  **Request OTP**: Worker requests OTP via `/auth/requestOtp` endpoint
2.  **Generate OTP**: Backend generates 6-digit code and stores it (10-minute expiry)
3.  **Send SMS**: Twilio API sends OTP to worker's phone number
4.  **Verify OTP**: Worker enters OTP, backend validates it
5.  **Set PIN**: After verification, worker creates 4-digit PIN (hashed and stored)

### OTP Service Details

**Location**: `server/services/sms-service.ts`

**Key Functions**:
-   `generateOTP()`: Creates random 6-digit code
-   `sendOTPViaSMS(phone)`: Sends OTP via Twilio
-   `verifyOTP(phone, otp)`: Validates OTP and checks expiry
-   `isOTPVerified(phone)`: Checks if OTP is verified
-   `clearOTPRecord(phone)`: Removes OTP after PIN setup

### PIN Service Details

**Location**: `server/services/pin-service.ts`

**Key Functions**:
-   `hashPIN(pin)`: Hashes PIN with SHA256 and unique salt
-   `verifyPIN(pin, hashedPin)`: Validates PIN against hash
-   `isPINLocked(attempts, lockedUntil)`: Checks lockout status
-   `getPINLockoutExpiry()`: Calculates 30-minute lockout time

### Lockout Mechanism

-   **Max Attempts**: 5 failed PIN attempts
-   **Lockout Duration**: 30 minutes
-   **Reset**: Automatic reset after lockout expires or successful verification

## API Endpoints

### Authentication Endpoints

#### Request OTP

```http
POST /trpc/auth.requestOtp
Content-Type: application/json

{
  "phone": "+919876543210"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP sent successfully. Valid for 10 minutes.",
  "phone": "+919876543210",
  "expiresIn": 600
}
```

#### Verify OTP

```http
POST /trpc/auth.verifyOtp
Content-Type: application/json

{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "verified": true,
  "phone": "+919876543210"
}
```

#### Set PIN

```http
POST /trpc/auth.setPIN
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "pin": "1234",
  "confirmPin": "1234"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PIN set successfully. You can now use PIN for authentication."
}
```

#### Verify PIN

```http
POST /trpc/auth.verifyPIN
Content-Type: application/json

{
  "userId": 1,
  "pin": "1234"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PIN verified successfully",
  "userId": 1
}
```

## Troubleshooting

### Build Error: "Could not resolve vite.config"

**Solution**: This error occurs when building the backend independently. The fix is already applied in the updated code:

```bash
# Use the backend-specific build
NODE_ENV=production esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

### Database Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Solution**:
1.  Verify MySQL is running: `mysql -u root -p`
2.  Check `DATABASE_URL` in `.env` file
3.  Ensure database exists: `CREATE DATABASE swm_pro;`

### Twilio SMS Not Sending

**Error**: `Failed to send OTP: Invalid credentials`

**Solution**:
1.  Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`
2.  Check `TWILIO_PHONE_NUMBER` is in E.164 format (+1234567890)
3.  Ensure Twilio account has sufficient credits
4.  Check phone number is valid and not in a restricted region

### Port Already in Use

**Error**: `Error: listen EADDRINUSE :::5000`

**Solution**:
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3000 npm start
```

### High Memory Usage

**Solution**:
-   Check for memory leaks in OTP storage (in-memory map)
-   Consider migrating OTP storage to Redis for production
-   Monitor database connection pool

## Next Steps

1.  **Frontend Setup**: Follow the frontend repository setup guide
2.  **Integration Testing**: Test OTP flow end-to-end
3.  **Load Testing**: Verify performance under load
4.  **Security Audit**: Review and harden security settings
5.  **Monitoring**: Set up logging and monitoring for production

## Support

For issues or questions:
1.  Check the [README.md](./README.md) for general integration details
2.  Review Twilio documentation: https://www.twilio.com/docs
3.  Check Drizzle ORM documentation: https://orm.drizzle.team
4.  Review tRPC documentation: https://trpc.io

---

**Last Updated**: February 27, 2026
**Version**: 1.0.0

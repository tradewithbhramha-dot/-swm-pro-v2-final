/**
 * Vite Configuration for Backend-Only Builds
 * Used when building the backend independently without the frontend
 */

import { defineConfig } from "vite";

export default defineConfig({
  // Minimal config for backend-only builds
  // This prevents import errors when vite.config.ts is not available
});

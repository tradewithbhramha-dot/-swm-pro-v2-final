import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import vite config with fallback for production builds
let viteConfig: any = {};
if (process.env.NODE_ENV === "development") {
  try {
    // @ts-ignore - vite might not be available in production build environment
    const { createServer: createViteServer } = await import("vite");
    viteConfig = (await import("../../vite.config")).default || {};
  } catch (e) {
    console.warn("[Vite] Could not load vite.config.ts or vite module, using defaults");
  }
}

export async function setupVite(app: Express, server: Server) {
  // Skip Vite setup in production
  if (process.env.NODE_ENV === "production") {
    console.log("[Vite] Skipping Vite setup in production mode");
    return;
  }

  try {
    const { createServer: createViteServer } = await import("vite");
    const serverOptions = {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    };

    const vite = await createViteServer({
      ...viteConfig,
      configFile: false,
      server: serverOptions,
      appType: "custom",
    });

    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          __dirname,
          "../..",
          "client",
          "index.html"
        );

        if (!fs.existsSync(clientTemplate)) {
          return res.status(404).send("Client index.html not found. Please build the client.");
        }

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`
        );
        const page = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } catch (e) {
    console.error("[Vite] Failed to setup Vite:", e);
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  
  if (!fs.existsSync(distPath)) {
    console.warn(
      `[Static] Could not find the build directory: ${distPath}. Backend will only serve API routes.`
    );
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Not Found");
    }
  });
}

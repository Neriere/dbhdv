import express from "express";
import compression from "compression";
import { initDB } from "./localDataStore";
import { startHourlyDofocusSync } from "./dofocusBackgroundSync";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";

import healthRouter from "./routes/health";
import tokensRouter from "./routes/tokens";
import snifferRouter from "./routes/sniffer";
import marketRouter from "./routes/market";
import localDbRouter from "./routes/localDb";
import dofusbookRouter from "./routes/dofusbook";
import dofusdbProxyRouter from "./routes/dofusdbProxy";
import dofocusRouter from "./routes/dofocus";

const app = express();

// Initialize Database Schemas and Background Sync
initDB()
  .then(() => {
    console.log("[Database] Turso schemas initialized.");
    startHourlyDofocusSync();
  })
  .catch((e) =>
    console.error("[Database Error] Failed to initialize Turso:", e),
  );

// Core Middlewares
app.use(compression() as unknown as express.RequestHandler);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(requestLogger);

// API Route Handlers
app.use("/api", healthRouter);
app.use("/api", tokensRouter);
app.use("/api", snifferRouter);
app.use("/api", marketRouter);
app.use("/api", localDbRouter);
app.use("/api", dofusbookRouter);
app.use("/api", dofusdbProxyRouter);
app.use("/api", dofocusRouter);

// Centralized Error Handler
app.use(errorHandler);

export { app };

export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}

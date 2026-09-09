import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { app } from "./src/server/expressApp";







async function startServer() {
  const PORT = 3000;
  const HOST = "0.0.0.0";

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[DofusDB Server] Running on http://${HOST}:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[DofusDB Server] Port ${PORT} already in use. Waiting to retry...`);
    } else {
      console.error(`[DofusDB Server] Server runtime error:`, err);
    }
  });

  const shutdown = () => {
    console.log("[DofusDB Server] Gracefully shutting down HTTP server...");
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("[DofusDB Server] Failed to start server:", err);
  process.exit(1);
});

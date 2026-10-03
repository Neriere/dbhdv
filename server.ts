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
    // Intercept Content-Type header: whenever Vite (or any handler) sets
    // "text/html" without a charset, automatically append "; charset=utf-8".
    // This runs per-request, wrapping res.setHeader so the patch fires even
    // after this middleware has called next().
    app.use((_req, res, next) => {
      const origSetHeader = res.setHeader.bind(res);
      (res as any).setHeader = function (name: string, value: string | number | readonly string[]) {
        if (
          typeof name === 'string' &&
          name.toLowerCase() === 'content-type' &&
          typeof value === 'string' &&
          value.startsWith('text/html') &&
          !value.includes('charset')
        ) {
          return origSetHeader(name, value + '; charset=utf-8');
        }
        return origSetHeader(name, value as any);
      };
      next();
    });
    app.use(vite.middlewares);

  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { setHeaders: (res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); } }));
    app.get("*", (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
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

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import app from "./api/app.js";

async function startServer() {
  const PORT = Number(process.env.PORT || process.env.APP_PORT || 3000);
  const HOST = process.env.APP_HOST || "0.0.0.0";

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

  app.listen(PORT, HOST, () => {
    console.log(`[DofusDB Server] Running on http://${HOST}:${PORT}`);
  });
}

startServer();

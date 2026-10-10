import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "DofusDB API Proxy & Explorer Server" });
});

export default router;

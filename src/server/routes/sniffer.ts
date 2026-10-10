import { Router } from "express";
import snifferScriptHandler from "../../../api/market/sniffer-script";
import suiteScriptHandler from "../../../api/market/suite-script";
import calibratorScriptHandler from "../../../api/market/calibrator-script";
import downloadBatHandler from "../../../api/market/download-bat";

const router = Router();

router.get("/market/sniffer-script", (req, res) => {
  return snifferScriptHandler(req, res);
});

router.get("/market/calibrator-script", (req, res) => {
  return calibratorScriptHandler(req, res);
});

router.get("/market/suite-script", (req, res) => {
  return suiteScriptHandler(req, res);
});

router.get("/market/download-py", (req, res) => {
  res.redirect("/api/market/suite-script");
});

router.get("/market/download-bat", (req, res) => {
  return downloadBatHandler(req, res);
});

export default router;

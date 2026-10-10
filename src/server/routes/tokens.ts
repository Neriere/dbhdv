import { Router } from "express";
import tokensHandler from "../../../api/tokens";

const router = Router();

router.all("/tokens", (req, res) => {
  return tokensHandler(req, res);
});

export default router;

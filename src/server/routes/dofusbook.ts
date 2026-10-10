import { Router } from "express";
import { analyzeDofusbookBuild } from "../localDataStore";

const router = Router();

router.post("/dofusbook/analyze", async (req, res) => {
  try {
    const {
      url,
      excludeDofus = true,
      excludeTrophies = false,
      profileId,
    } = req.body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return res
        .status(400)
        .json({
          error: "Debes ingresar un enlace o código de Dofusbook válido.",
        });
    }

    const analysis = await analyzeDofusbookBuild(url.trim(), {
      excludeDofus: Boolean(excludeDofus),
      excludeTrophies: Boolean(excludeTrophies),
      profileId: profileId ? Number(profileId) : undefined,
    });

    res.json(analysis);
  } catch (err: any) {
    console.error("[Dofusbook Analyze Error]:", err);
    res
      .status(500)
      .json({
        error: err.message || "Error analizando el build de Dofusbook.",
      });
  }
});

router.get("/dofusbook/analyze", async (req, res) => {
  try {
    const url = req.query.url as string;
    const excludeDofus = req.query.excludeDofus !== "false";
    const excludeTrophies = req.query.excludeTrophies === "true";
    const profileId = req.query.profileId
      ? Number(req.query.profileId)
      : undefined;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: "Parámetro url es requerido." });
    }

    const analysis = await analyzeDofusbookBuild(url.trim(), {
      excludeDofus,
      excludeTrophies,
      profileId,
    });

    res.json(analysis);
  } catch (err: any) {
    console.error("[Dofusbook Analyze Error]:", err);
    res
      .status(500)
      .json({
        error: err.message || "Error analizando el build de Dofusbook.",
      });
  }
});

export default router;

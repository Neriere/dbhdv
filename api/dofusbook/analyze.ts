import { analyzeDofusbookBuild } from "../../src/server/localDataStore";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let url = "";
    let excludeDofus = true;
    let excludeTrophies = false;
    let profileId: number | undefined;

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      url = body.url;
      if (body.excludeDofus !== undefined) {
        excludeDofus = Boolean(body.excludeDofus);
      }
      if (body.excludeTrophies !== undefined) {
        excludeTrophies = Boolean(body.excludeTrophies);
      }
      if (body.profileId) {
        profileId = Number(body.profileId);
      }
    } else if (req.method === "GET") {
      url = req.query?.url as string;
      if (req.query?.excludeDofus !== undefined) {
        excludeDofus = req.query.excludeDofus !== "false";
      }
      if (req.query?.excludeTrophies !== undefined) {
        excludeTrophies = req.query.excludeTrophies === "true";
      }
      if (req.query?.profileId) {
        profileId = Number(req.query.profileId);
      }
    } else {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        error: "Debes ingresar un enlace o código de Dofusbook válido.",
      });
    }

    const analysis = await analyzeDofusbookBuild(url.trim(), {
      excludeDofus,
      excludeTrophies,
      profileId,
    });

    return res.status(200).json(analysis);
  } catch (err: any) {
    console.error("[Dofusbook Analyze API Error]:", err);
    return res.status(500).json({
      error: err.message || "Error analizando el build de Dofusbook.",
    });
  }
}

const DOFOCUS_BASE_URL = "https://dofocus.fr/api";
const DOFOCUS_HEADERS = {
  "X-Dofocus-Client": "web",
  Referer: "https://dofocus.fr/",
  Origin: "https://dofocus.fr",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

const FALLBACK_SERVERS = [
  { _id: "draconiros", name: "Draconiros" },
  { _id: "kourial", name: "Kourial" },
  { _id: "mikhal", name: "Mikhal" },
  { _id: "dakal", name: "Dakal" },
  { _id: "brial", name: "Brial" },
  { _id: "rafal", name: "Rafal" },
  { _id: "salar", name: "Salar" },
  { _id: "talkasha", name: "TalKasha" },
  { _id: "hellmina", name: "HellMina" },
  { _id: "imagiro", name: "Imagiro" },
  { _id: "orukam", name: "Orukam" },
  { _id: "tylezia", name: "Tylezia" },
  { _id: "ombre", name: "Ombre" },
];

const DOFOCUS_SERVER_NAME_MAP: Record<string, string> = {
  draconiros: "Draconiros",
  kourial: "Kourial",
  mikhal: "Mikhal",
  dakal: "Dakal",
  brial: "Brial",
  rafal: "Rafal",
  salar: "Salar",
  "tal-kasha": "TalKasha",
  talkasha: "TalKasha",
  "tal kasha": "TalKasha",
  hellmina: "HellMina",
  "hell-mina": "HellMina",
  "hell mina": "HellMina",
  imagiro: "Imagiro",
  oruka: "Orukam",
  orukam: "Orukam",
  tylezia: "Tylezia",
  ombre: "Ombre",
  sombra: "Ombre",
  shadow: "Ombre",
};

function normalizeDofocusServer(input: string): string {
  if (!input) return "Draconiros";
  const clean = input.trim().toLowerCase();
  if (DOFOCUS_SERVER_NAME_MAP[clean]) return DOFOCUS_SERVER_NAME_MAP[clean];

  if (clean.startsWith("draconiros")) return "Draconiros";
  if (clean.startsWith("dakal")) return "Dakal";
  if (clean.startsWith("mikhal")) return "Mikhal";
  if (clean.startsWith("brial")) return "Brial";
  if (clean.startsWith("rafal")) return "Rafal";
  if (clean.startsWith("kourial")) return "Kourial";
  if (clean.startsWith("salar")) return "Salar";
  if (clean.startsWith("tal")) return "TalKasha";
  if (clean.startsWith("hell")) return "HellMina";
  if (clean.startsWith("imagiro")) return "Imagiro";
  if (clean.startsWith("oruk")) return "Orukam";
  if (clean.startsWith("tyle")) return "Tylezia";
  if (clean.startsWith("ombr") || clean.startsWith("sombr") || clean.startsWith("shadow")) return "Ombre";

  return input;
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const rawPath = req.query?.path;
  const pathSegments = Array.isArray(rawPath)
    ? rawPath
    : typeof rawPath === "string"
    ? rawPath.split("/").filter(Boolean)
    : [];

  const route0 = pathSegments[0] || "";
  const route1 = pathSegments[1] || "";

  try {
    // 1. SERVERS: GET /api/dofocus/servers
    if (route0 === "servers") {
      res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
      try {
        const response = await fetch(`${DOFOCUS_BASE_URL}/servers`, { headers: DOFOCUS_HEADERS });
        if (!response.ok) return res.status(200).json(FALLBACK_SERVERS);
        const data = await response.json();
        return res.status(200).json(Array.isArray(data) && data.length > 0 ? data : FALLBACK_SERVERS);
      } catch {
        return res.status(200).json(FALLBACK_SERVERS);
      }
    }

    // 2. COEFFICIENTS BY SERVER: GET /api/dofocus/coefficients/:serverName
    if (route0 === "coefficients") {
      res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
      const serverParam = route1 || req.query?.serverName || req.query?.server || "Draconiros";
      const serverName = normalizeDofocusServer(serverParam);
      const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
      const response = await fetch(targetUrl, { headers: DOFOCUS_HEADERS });
      if (!response.ok) {
        return res.status(response.status).json({ error: `DoFocus status ${response.status}` });
      }
      const data = await response.json();
      return res.status(200).json({
        server: serverName,
        total: Array.isArray(data) ? data.length : 0,
        coefficients: Array.isArray(data) ? data : [],
        timestamp: Date.now(),
      });
    }

    // 3. SINGLE ITEM: GET /api/dofocus/item/:itemId
    if (route0 === "item") {
      res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
      const itemId = Number(route1 || req.query?.itemId);
      if (!itemId) return res.status(400).json({ error: "Item ID inválido" });

      const rawServer = (req.query?.server as string) || "Draconiros";
      const serverName = normalizeDofocusServer(rawServer);
      const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
      const response = await fetch(targetUrl, { headers: DOFOCUS_HEADERS });
      if (!response.ok) {
        return res.status(response.status).json({ error: `DoFocus status ${response.status}` });
      }
      const data = (await response.json()) as Array<{ itemId: number; coefficient: number; dateUpdated?: string }>;
      const match = Array.isArray(data) ? data.find((c) => c.itemId === itemId) : null;
      if (match) {
        return res.status(200).json({
          itemId,
          server: serverName,
          coefficient: match.coefficient,
          dateUpdated: match.dateUpdated || null,
          source: "dofocus",
        });
      }
      return res.status(404).json({ error: "Coeficiente no encontrado", itemId, server: serverName });
    }

    return res.status(404).json({ error: "Ruta no encontrada" });
  } catch (err: any) {
    console.error("[DoFocus Router Error]:", err);
    return res.status(500).json({ error: err.message || "Error en API DoFocus" });
  }
}

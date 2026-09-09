const DOFOCUS_BASE_URL = "https://dofocus.fr/api";
const DOFOCUS_HEADERS = {
  "X-Dofocus-Client": "web",
  Referer: "https://dofocus.fr/",
  Origin: "https://dofocus.fr",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

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
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");

  try {
    const pathSegments = (req.url || "").split("?")[0].split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    const rawItemId = req.query?.itemId || (lastSegment && lastSegment !== "item" ? lastSegment : "");
    const itemId = Number(rawItemId);

    if (!itemId) {
      return res.status(400).json({ error: "Item ID inválido" });
    }

    const rawServer = (req.query?.server as string) || "Draconiros";
    const serverName = normalizeDofocusServer(rawServer);

    const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
    const response = await fetch(targetUrl, {
      headers: DOFOCUS_HEADERS,
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `DoFocus respondió con status ${response.status}`,
      });
    }

    const data = (await response.json()) as Array<{
      itemId: number;
      coefficient: number;
      dateUpdated?: string;
    }>;

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

    return res.status(404).json({
      error: `Coeficiente no encontrado para el ítem ${itemId} en ${serverName}`,
      itemId,
      server: serverName,
    });
  } catch (err: any) {
    console.error("[DoFocus Item API Error]:", err);
    return res.status(500).json({
      error: err.message || "Error al consultar coeficiente de ítem",
    });
  }
}

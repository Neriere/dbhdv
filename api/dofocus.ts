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

function extractPathSegments(req: any, basePath: string): string[] {
  const candidates = [
    req.query?.["...path"],
    req.query?.path,
    req.query?.["[...path]"],
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const segs = candidate
        .map((s) => decodeURIComponent(String(s)).trim())
        .filter(Boolean);
      if (segs[0] === basePath) return segs.slice(1);
      return segs;
    }
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const segs = decodeURIComponent(candidate)
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs[0] === basePath) return segs.slice(1);
      return segs;
    }
  }

  if (req.url && typeof req.url === "string") {
    const pathname = decodeURIComponent(req.url.split("?")[0] || "");
    const segments = pathname.split("/").filter(Boolean);
    const idx = segments.indexOf(basePath);
    if (idx !== -1) {
      return segments.slice(idx + 1);
    }
    if (segments[0] === "api") {
      return segments.slice(1);
    }
    return segments;
  }

  return [];
}


export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Dofocus-Cookie"
    );
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const pathSegments = extractPathSegments(req, "dofocus");
  const route0 = pathSegments[0] || "";
  const route1 = pathSegments[1] || "";

  // Helper to extract session cookies (user-provided or server env)
  const sessionCookie =
    req.headers?.["x-dofocus-cookie"] ||
    req.headers?.cookie ||
    process.env.DOFOCUS_COOKIE;
  const requestHeaders: Record<string, string> = {
    ...DOFOCUS_HEADERS,
    ...(sessionCookie ? { Cookie: String(sessionCookie) } : {}),
  };

  try {
    // 1. SERVERS: GET /api/dofocus/servers
    if (route0 === "servers") {
      res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
      try {
        const response = await fetch(`${DOFOCUS_BASE_URL}/servers`, {
          headers: requestHeaders,
        });
        if (!response.ok) return res.status(200).json(FALLBACK_SERVERS);
        const data = await response.json();
        return res
          .status(200)
          .json(Array.isArray(data) && data.length > 0 ? data : FALLBACK_SERVERS);
      } catch {
        return res.status(200).json(FALLBACK_SERVERS);
      }
    }

    // 2. GLOBAL SYNC STATUS: GET /api/dofocus/sync-all-status
    if (route0 === "sync-all-status") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(200).json({
        isSyncRunning: false,
        lastSyncTimestamp: null,
        nextSyncTimestamp: null,
        serverStatuses: {},
      });
    }

    // 3. TRIGGER SYNC ALL: POST /api/dofocus/sync-all
    if (route0 === "sync-all") {
      return res.status(200).json({
        status: "started",
        message: "Sincronización procesada en la nube",
      });
    }

    // 4. SYNC SINGLE SERVER: POST /api/dofocus/sync-server
    if (route0 === "sync-server") {
      const serverParam =
        req.body?.server ||
        req.body?.serverName ||
        req.query?.server ||
        req.query?.serverName ||
        "Draconiros";
      const serverName = normalizeDofocusServer(String(serverParam));
      const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;

      try {
        const response = await fetch(targetUrl, { headers: requestHeaders });
        if (!response.ok) {
          if (response.status === 403) {
            const errBody = await response.json().catch(() => ({}));
            return res.status(403).json({
              success: false,
              code: "ACCESS_REQUIRED",
              server: serverName,
              error:
                "DoFocus requiere verificación humana o autorización de sesión (Cloudflare Turnstile).",
              automationPolicy: errBody?.automationPolicy,
            });
          }
          return res.status(response.status).json({
            success: false,
            server: serverName,
            error: `DoFocus respondió con status ${response.status}`,
          });
        }

        const data = await response.json();
        const entries = Array.isArray(data) ? data : [];
        return res.status(200).json({
          success: true,
          server: serverName,
          totalFetched: entries.length,
          coefficients: entries,
          timestamp: Date.now(),
        });
      } catch (syncErr: any) {
        return res.status(500).json({
          success: false,
          server: serverName,
          error: syncErr.message || "Error al sincronizar con DoFocus",
        });
      }
    }

    // 5. COEFFICIENTS BY SERVER: GET /api/dofocus/coefficients/:serverName
    if (route0 === "coefficients") {
      res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
      const serverParam =
        route1 || req.query?.serverName || req.query?.server || "Draconiros";
      const serverName = normalizeDofocusServer(serverParam);
      const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
      const response = await fetch(targetUrl, { headers: requestHeaders });

      if (!response.ok) {
        if (response.status === 403) {
          const errBody = await response.json().catch(() => ({}));
          return res.status(403).json({
            code: "ACCESS_REQUIRED",
            error:
              "DoFocus requiere verificación humana o autorización de sesión (Cloudflare Turnstile).",
            server: serverName,
            total: 0,
            coefficients: [],
            automationPolicy: errBody?.automationPolicy,
          });
        }
        return res
          .status(response.status)
          .json({ error: `DoFocus status ${response.status}` });
      }

      const data = await response.json();
      return res.status(200).json({
        server: serverName,
        total: Array.isArray(data) ? data.length : 0,
        coefficients: Array.isArray(data) ? data : [],
        timestamp: Date.now(),
      });
    }

    // 6. SINGLE ITEM: GET /api/dofocus/item/:itemId
    if (route0 === "item") {
      res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
      const itemId = Number(route1 || req.query?.itemId);
      if (!itemId) return res.status(400).json({ error: "Item ID inválido" });

      const rawServer = (req.query?.server as string) || "Draconiros";
      const serverName = normalizeDofocusServer(rawServer);
      const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
      const response = await fetch(targetUrl, { headers: requestHeaders });

      if (!response.ok) {
        if (response.status === 403) {
          return res.status(403).json({
            code: "ACCESS_REQUIRED",
            error:
              "DoFocus requiere verificación humana o autorización de sesión (Cloudflare Turnstile).",
            itemId,
            server: serverName,
          });
        }
        return res
          .status(response.status)
          .json({ error: `DoFocus status ${response.status}` });
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
      return res
        .status(404)
        .json({ error: "Coeficiente no encontrado", itemId, server: serverName });
    }

    return res.status(404).json({ error: "Ruta no encontrada" });
  } catch (err: any) {
    console.error("[DoFocus Router Error]:", err);
    return res.status(500).json({ error: err.message || "Error en API DoFocus" });
  }
}


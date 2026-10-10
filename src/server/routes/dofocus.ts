import { Router } from "express";
import {
  getDofocusGlobalSyncState,
  syncAllServersFromDofocus,
  syncSingleServerFromDofocus,
} from "../dofocusBackgroundSync";

const router = Router();

const DOFOCUS_BASE_URL = "https://dofocus.fr/api";
const DOFOCUS_HEADERS = {
  "X-Dofocus-Client": "web",
  Referer: "https://dofocus.fr/",
  Origin: "https://dofocus.fr",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

let cachedServers: { data: any[]; timestamp: number } | null = null;
const cachedCoefficientsByServer = new Map<
  string,
  { data: any[]; timestamp: number }
>();

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

router.get("/dofocus/sync-all-status", (_req, res) => {
  res.json(getDofocusGlobalSyncState());
});

router.post("/dofocus/sync-all", async (_req, res) => {
  void syncAllServersFromDofocus(true);
  res.json({
    status: "started",
    message: "Sincronización de todos los servidores iniciada en segundo plano",
  });
});

router.post("/dofocus/sync-server", async (req, res) => {
  try {
    const serverName = String(req.body?.server || req.body?.serverName || "Draconiros");
    const cookie = (req.headers["x-dofocus-cookie"] as string) || req.headers.cookie;
    const result = await syncSingleServerFromDofocus(serverName, cookie);
    if (!result.success) {
      return res.status(500).json({ error: result.error || "Error al sincronizar con DoFocus" });
    }
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync server coefficients";
    res.status(500).json({ error: message });
  }
});

router.get("/dofocus/servers", async (_req, res) => {
  try {
    const now = Date.now();
    if (cachedServers && now - cachedServers.timestamp < 10 * 60 * 1000) {
      return res.json(cachedServers.data);
    }

    const response = await fetch(`${DOFOCUS_BASE_URL}/servers`, {
      headers: DOFOCUS_HEADERS,
    });

    if (!response.ok) {
      const fallbackServers = [
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
      return res.json(fallbackServers);
    }

    const data = await response.json();
    cachedServers = { data, timestamp: now };
    res.json(data);
  } catch (err: any) {
    console.error("[DoFocus Servers Error]:", err);
    res.status(500).json({
      error: err.message || "Error al consultar servidores de DoFocus",
    });
  }
});

router.get("/dofocus/coefficients/:serverName", async (req, res) => {
  try {
    const rawServerName = req.params.serverName || "Draconiros";
    const serverName = normalizeDofocusServer(rawServerName);
    const forceRefresh = req.query.refresh === "true";
    const now = Date.now();

    const cached = cachedCoefficientsByServer.get(serverName.toLowerCase());
    if (!forceRefresh && cached && now - cached.timestamp < 3 * 60 * 1000) {
      return res.json({
        server: serverName,
        total: cached.data.length,
        coefficients: cached.data,
        cached: true,
        timestamp: cached.timestamp,
      });
    }

    const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
    const cookie =
      (req.headers["x-dofocus-cookie"] as string) ||
      req.headers.cookie ||
      process.env.DOFOCUS_COOKIE;
    const reqHeaders = {
      ...DOFOCUS_HEADERS,
      "X-Dofocus-Client": "web",
      ...(cookie ? { Cookie: String(cookie) } : {}),
    };
    const response = await fetch(targetUrl, {
      headers: reqHeaders,
    });

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
      throw new Error(
        `DoFocus respondió con status ${response.status}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Array<{
      itemId: number;
      coefficient: number;
      dateUpdated?: string;
    }>;
    cachedCoefficientsByServer.set(serverName.toLowerCase(), {
      data,
      timestamp: now,
    });

    res.json({
      server: serverName,
      total: data.length,
      coefficients: data,
      cached: false,
      timestamp: now,
    });
  } catch (err: any) {
    console.error(
      `[DoFocus Coefficients Error for ${req.params.serverName}]:`,
      err,
    );
    res.status(500).json({
      error: err.message || "Error al sincronizar coeficientes de DoFocus",
    });
  }
});

router.get("/dofocus/item/:itemId", async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const rawServer = (req.query.server as string) || "Draconiros";
    const serverName = normalizeDofocusServer(rawServer);

    if (!itemId) {
      return res.status(400).json({ error: "Item ID inválido" });
    }

    const cached = cachedCoefficientsByServer.get(serverName.toLowerCase());
    if (cached) {
      const match = cached.data.find((c) => c.itemId === itemId);
      if (match) {
        return res.json({
          itemId,
          server: serverName,
          coefficient: match.coefficient,
          dateUpdated: match.dateUpdated,
          source: "server_cache",
        });
      }
    }

    const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(serverName)}`;
    const response = await fetch(targetUrl, {
      headers: DOFOCUS_HEADERS,
    });

    if (response.ok) {
      const list = (await response.json()) as Array<{
        itemId: number;
        coefficient: number;
        dateUpdated?: string;
      }>;
      cachedCoefficientsByServer.set(serverName.toLowerCase(), {
        data: list,
        timestamp: Date.now(),
      });
      const match = list.find((c) => c.itemId === itemId);
      if (match) {
        return res.json({
          itemId,
          server: serverName,
          coefficient: match.coefficient,
          dateUpdated: match.dateUpdated,
          source: "dofocus_live",
        });
      }
    }

    res.json({
      itemId,
      server: serverName,
      coefficient: 100,
      dateUpdated: null,
      source: "default",
    });
  } catch (err: any) {
    console.error(`[DoFocus Item Error]:`, err);
    res.status(500).json({
      error: err.message || "Error al consultar coeficiente en DoFocus",
    });
  }
});

export default router;

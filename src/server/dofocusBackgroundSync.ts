import {
  bulkSaveProfileCoefficients,
  getProfileIdByServerNameOrSlug,
} from "./localDataStore";

export const DOFUS_SERVERS_TO_SYNC = [
  "Draconiros",
  "Dakal",
  "Mikhal",
  "Kourial",
  "Brial",
  "Rafal",
  "Salar",
  "TalKasha",
  "HellMina",
  "Imagiro",
  "Orukam",
  "Tylezia",
  "Ombre",
];

const DOFOCUS_BASE_URL = "https://dofocus.fr/api";
const DOFOCUS_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://dofocus.fr/",
  Origin: "https://dofocus.fr",
};

export interface ServerSyncStatus {
  server: string;
  serverSlug?: string;
  profileId?: number;
  totalFetched: number;
  updatedCount?: number;
  skippedCount?: number;
  timestamp: number;
  success: boolean;
  error?: string;
  coefficients?: Record<number, number>;
  coefficientUpdatedAt?: Record<number, number>;
  manualEdits?: Record<number, number>;
}

export interface DofocusGlobalSyncState {
  isSyncRunning: boolean;
  lastSyncTimestamp: number | null;
  nextSyncTimestamp: number | null;
  serverStatuses: Record<string, ServerSyncStatus>;
}

const globalSyncState: DofocusGlobalSyncState = {
  isSyncRunning: false,
  lastSyncTimestamp: null,
  nextSyncTimestamp: null,
  serverStatuses: {},
};

export function getDofocusGlobalSyncState(): DofocusGlobalSyncState {
  return { ...globalSyncState };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncSingleServerFromDofocus(serverName: string): Promise<ServerSyncStatus> {
  const cleanName = serverName.trim();
  const profileInfo = await getProfileIdByServerNameOrSlug(cleanName);
  const targetUrl = `${DOFOCUS_BASE_URL}/coefficients/by-server/${encodeURIComponent(cleanName)}`;

  try {
    const response = await fetch(targetUrl, {
      headers: DOFOCUS_HEADERS,
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Array<{
      itemId: number;
      coefficient: number;
      dateUpdated?: string;
    }>;

    if (!Array.isArray(data)) {
      throw new Error("Invalid response format from DoFocus");
    }

    const entries = data
      .filter((item) => item && item.itemId)
      .map((item) => {
        let dofocusTs = 0;
        if (item.dateUpdated) {
          const parsed = new Date(item.dateUpdated).getTime();
          if (!isNaN(parsed) && parsed > 0) dofocusTs = parsed;
        }
        return {
          itemId: Number(item.itemId),
          coefficient: Number(item.coefficient) || 100,
          updatedAt: dofocusTs,
          isManual: false,
        };
      });

    let updatedCount = 0;
    let skippedCount = 0;
    let coefficientsResult: Record<number, number> = {};
    let timestampsResult: Record<number, number> = {};
    let manualEditsResult: Record<number, number> = {};

    if (entries.length > 0) {
      const saveRes = await bulkSaveProfileCoefficients(entries, profileInfo.profileId, false);
      updatedCount = saveRes.updatedCount;
      skippedCount = saveRes.skippedCount;
      coefficientsResult = saveRes.coefficients;
      timestampsResult = saveRes.coefficientUpdatedAt;
      manualEditsResult = saveRes.manualEdits;
    }

    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const status: ServerSyncStatus = {
      server: cleanName,
      serverSlug: slug,
      profileId: profileInfo.profileId,
      totalFetched: entries.length,
      updatedCount,
      skippedCount,
      timestamp: Date.now(),
      success: true,
      coefficients: coefficientsResult,
      coefficientUpdatedAt: timestampsResult,
      manualEdits: manualEditsResult,
    };
    globalSyncState.serverStatuses[cleanName.toLowerCase()] = status;
    return status;
  } catch (err: any) {
    console.warn(`[DoFocus Background Sync] Error syncing ${cleanName}:`, err.message || err);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const status: ServerSyncStatus = {
      server: cleanName,
      serverSlug: slug,
      profileId: profileInfo.profileId,
      totalFetched: 0,
      updatedCount: 0,
      skippedCount: 0,
      timestamp: Date.now(),
      success: false,
      error: err.message || "Unknown error",
    };
    globalSyncState.serverStatuses[cleanName.toLowerCase()] = status;
    return status;
  }
}

export async function syncAllServersFromDofocus(forced = false): Promise<DofocusGlobalSyncState> {
  if (globalSyncState.isSyncRunning && !forced) {
    return globalSyncState;
  }

  globalSyncState.isSyncRunning = true;
  console.log(
    `[DoFocus Background Sync] Starting automated sync for all ${DOFUS_SERVERS_TO_SYNC.length} servers...`
  );

  try {
    for (const server of DOFUS_SERVERS_TO_SYNC) {
      await syncSingleServerFromDofocus(server);
      // Brief pause between servers to be respectful to DoFocus API
      await sleep(1500);
    }
    globalSyncState.lastSyncTimestamp = Date.now();
    globalSyncState.nextSyncTimestamp = Date.now() + 60 * 60 * 1000;
    console.log(
      `[DoFocus Background Sync] Completed automated sync for all servers. Next sync in 1 hour.`
    );
  } catch (err) {
    console.error("[DoFocus Background Sync] Global sync encountered an error:", err);
  } finally {
    globalSyncState.isSyncRunning = false;
  }

  return globalSyncState;
}

let timerInitialized = false;

export function startHourlyDofocusSync(): void {
  if (timerInitialized) return;
  timerInitialized = true;

  // Initial sync 25 seconds after server startup
  setTimeout(() => {
    void syncAllServersFromDofocus();
  }, 25000);

  // Periodic hourly sync (every 60 minutes)
  setInterval(() => {
    void syncAllServersFromDofocus();
  }, 60 * 60 * 1000);

  globalSyncState.nextSyncTimestamp = Date.now() + 25000;
  console.log(
    "[DoFocus Background Sync] Hourly background timer scheduled (interval: 60 minutes)."
  );
}

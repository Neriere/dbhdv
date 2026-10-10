import { DofusTheme } from "../../types";

export const CACHE_KEY = "dofus_database_cache_v7";
export const CACHE_TIMESTAMP_KEY = "dofus_database_cache_timestamp_v7";

const IDB_NAME = "DofusDB_ClientCache";
const IDB_STORE = "keyval";
const THEME_STORAGE_KEY = "dofus_active_theme_v1";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = window.indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getIdbVal<T>(key: string): Promise<T | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setIdbVal(key: string, value: unknown): Promise<void> {
  try {
    const db = await openIdb();
    new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB write errors
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[Storage] localStorage quota reached or write failed for key "${key}". Persisting to IndexedDB:`, err);
  }
  // Always mirror in IndexedDB for resilience
  void setIdbVal(`ls_backup_${key}`, value);
}

export function getStoredTheme(): DofusTheme {
  if (typeof window === "undefined") return "bonta";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as DofusTheme;
    if (saved === "brakmar" || saved === "pandala" || saved === "bonta" || saved === "calm") {
      return saved;
    }
    if ((saved as any) === "amakna") {
      return "pandala";
    }
    return "bonta";
  } catch {
    return "bonta";
  }
}

export function setStoredTheme(theme: DofusTheme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    window.dispatchEvent(new CustomEvent("dofus_theme_updated", { detail: theme }));
  } catch {
    // Ignore storage write error
  }
}

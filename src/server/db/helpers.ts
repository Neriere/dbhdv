import type { DofusEffect } from "../../types";

export function parseJsonValue<T>(rawValue: string): T {
  return JSON.parse(rawValue) as T;
}

export function getLocalizedText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value && typeof value === "object") {
    const localized = value as Record<string, unknown>;
    const es = typeof localized.es === "string" ? localized.es.trim() : "";
    const fr = typeof localized.fr === "string" ? localized.fr.trim() : "";
    const en = typeof localized.en === "string" ? localized.en.trim() : "";
    if (es.length > 0) return es;
    if (fr.length > 0) return fr;
    if (en.length > 0) return en;
  }
  return fallback;
}

export function cleanEffects(effectsList: unknown): DofusEffect[] | undefined {
  if (!Array.isArray(effectsList) || effectsList.length === 0) return undefined;
  const cleaned: DofusEffect[] = [];
  for (const eff of effectsList) {
    if (!eff || typeof eff !== "object") continue;
    const o = eff as Record<string, unknown>;
    const charId = Number(o.characteristic ?? o.characteristicId ?? 0);
    const effId = Number(o.effectId ?? o.id ?? 0);
    const fromVal = typeof o.from === "number" ? o.from : typeof o.min === "number" ? o.min : undefined;
    const toVal = typeof o.to === "number" ? o.to : typeof o.max === "number" ? o.max : undefined;
    const fmt = typeof o.formatted === "string" ? o.formatted : typeof o.formatted_text === "string" ? o.formatted_text : undefined;
    if (charId || effId || fromVal !== undefined || toVal !== undefined || fmt) {
      cleaned.push({
        ...(charId ? { characteristic: charId } : {}),
        ...(effId ? { effectId: effId } : {}),
        ...(fromVal !== undefined ? { from: fromVal } : {}),
        ...(toVal !== undefined ? { to: toVal } : {}),
        ...(fmt ? { formatted: fmt } : {}),
      });
    }
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

export async function fetchJson<T>(url: string, retries = 3, backoffMs = 500): Promise<T> {
  let lastError: any = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "DofusDB-HD local importer/1.0",
        },
      });
      if (r.ok) {
        return (await r.json()) as Promise<T>;
      }
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, (attempt + 1) * 1200));
        continue;
      }
      throw new Error(`Request failed (${r.status})`);
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((res) => setTimeout(res, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error(`Failed to fetch ${url}`);
}

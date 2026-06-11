import type { MenuItem } from "./booth-types";

const PREFIX = "boothapp_menu_items_cache:";

type CacheEntry = { items: MenuItem[]; cachedAt: number };

export function readMenuCache(eventId: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + eventId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMenuCache(eventId: string, items: MenuItem[]) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { items, cachedAt: Date.now() };
    localStorage.setItem(PREFIX + eventId, JSON.stringify(entry));
  } catch {
    // quota or serialization error — non-fatal
  }
}

export function sweepMenuCaches(keepEventId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      if (keepEventId && k === PREFIX + keepEventId) continue;
      toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function menuListsEqual(a: MenuItem[], b: MenuItem[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

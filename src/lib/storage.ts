/** Keeps the last run settings between sends. Best effort: if the browser blocks storage,
 *  we just fall back to the defaults. */

const KEY = "ptc.auto-app-push.settings";

export interface SavedSettings {
  loginIds: string[];
  distributeNow: boolean;
  /** Order push's excluded login IDs — a tester's session data, not tied to any one type. */
  excludedIds: string[];
}

export function loadSettings(): SavedSettings | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSettings>;
    const loginIds = Array.isArray(parsed.loginIds)
      ? parsed.loginIds.map(String).filter(Boolean)
      : [];
    if (!loginIds.length) return null;
    const excludedIds = Array.isArray(parsed.excludedIds)
      ? parsed.excludedIds.map(String).filter(Boolean)
      : [];
    return {
      loginIds,
      distributeNow: parsed.distributeNow === true,
      excludedIds,
    };
  } catch {
    return null;
  }
}

export function saveSettings(settings: SavedSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage is full or blocked. The run itself still works.
  }
}

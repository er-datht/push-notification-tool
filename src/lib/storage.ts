/** Keeps the last run settings between sends. Best effort: if the browser blocks storage,
 *  we just fall back to the defaults. */

/** v2: the default lists became the guideline's. A new key lets those defaults reach everyone once. */
const KEY = "ptc.settings.v2";

export interface SavedSettings {
  /** Empty when nothing usable was saved — the page then keeps its default list. */
  loginIds: string[];
  distributeNow: boolean;
  /** Order push's excluded login IDs — a tester's session data, not tied to any one type. */
  excludedIds: string[];
}

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

export function loadSettings(): SavedSettings | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSettings>;
    return {
      loginIds: ids(parsed.loginIds),
      distributeNow: parsed.distributeNow === true,
      excludedIds: ids(parsed.excludedIds),
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

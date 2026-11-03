// Per-device UI preferences, in localStorage. SSR-safe (returns the default
// when there's no window). These are client conveniences (text size, EpiSplit
// default tax) - not synced across devices and not read by the server; real
// shared state lives in SQLite. Wrapped in try/catch because storage can be
// blocked/absent (private windows, etc.).

const KEY = "epicentre.prefs";

type Prefs = Record<string, string>;

function read(): Prefs {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Prefs;
  } catch {
    return {};
  }
}

export function getPref(name: string, fallback: string): string {
  const v = read()[name];
  return v === undefined ? fallback : v;
}

export function setPref(name: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    const p = read();
    p[name] = value;
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable - preference just won't persist this session.
  }
}

// Text size scales the root font, so rem-based text (most of the UI) grows or
// shrinks. Applied pre-paint by an inline script in app/layout.tsx too, to
// avoid a flash; this keeps it in sync when changed in Settings.
export const TEXT_SIZES: Record<string, string> = {
  small: "15px",
  normal: "16px",
  large: "18px",
};

export function applyTextSize(size: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = TEXT_SIZES[size] ?? TEXT_SIZES.normal;
}

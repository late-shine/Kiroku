// Phase 16d — the Atmosphere settings that belong to THIS device: whether the scene cycles and how dark the
// reading-contrast layer is. Pure (the storage is passed in), so it can be checked from a plain script
// (handoffs/phase-16d-atmosphere-check.ts). Device-only, like the voice choice: never synced, never in a backup.
// (The chosen scene and the motion speed are different: they live in `progress` and do sync.)

export type AtmospherePrefs = { cycle: boolean; darkness: number };

export const DEFAULT_ATMOSPHERE: AtmospherePrefs = { cycle: false, darkness: 0.34 };

/** The reading-contrast slider's range. A stored value outside it is pulled back in, so a bad value can't black out the scene. */
export const DARKNESS_MIN = 0.15;
export const DARKNESS_MAX = 0.7;

/** The key the cycle switch used before this phase. Read once as a fallback, never written, never deleted. */
export const LEGACY_CYCLE_KEY = "kiroku_cycle_themes_v1";

type Reader = { getItem(key: string): string | null };
type Writer = { setItem(key: string, value: string): void };

const clampDarkness = (n: number): number => Math.min(DARKNESS_MAX, Math.max(DARKNESS_MIN, n));

/** The stored text as prefs, or null when it is absent or not a JSON object. A bad field falls back to its default. */
export function parseAtmosphere(raw: string | null): AtmospherePrefs | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const cycle = record["cycle"];
  const darkness = record["darkness"];
  return {
    cycle: typeof cycle === "boolean" ? cycle : DEFAULT_ATMOSPHERE.cycle,
    darkness:
      typeof darkness === "number" && Number.isFinite(darkness)
        ? clampDarkness(darkness)
        : DEFAULT_ATMOSPHERE.darkness,
  };
}

/**
 * This device's prefs. Order: the new key; else the old cycle key (only its "true" means anything); else the
 * defaults. Reading the old key does not touch it, so an older build still finds its value.
 */
export function loadAtmosphere(storage: Reader, key: string): AtmospherePrefs {
  try {
    const stored = parseAtmosphere(storage.getItem(key));
    if (stored) return stored;
    if (storage.getItem(LEGACY_CYCLE_KEY) === "true") return { ...DEFAULT_ATMOSPHERE, cycle: true };
  } catch {
    /* storage blocked: start from the defaults */
  }
  return { ...DEFAULT_ATMOSPHERE };
}

export function saveAtmosphere(storage: Writer, key: string, prefs: AtmospherePrefs): void {
  try {
    storage.setItem(
      key,
      JSON.stringify({ cycle: prefs.cycle, darkness: clampDarkness(prefs.darkness) }),
    );
  } catch {
    /* storage blocked or full: the choice just won't persist past this page */
  }
}

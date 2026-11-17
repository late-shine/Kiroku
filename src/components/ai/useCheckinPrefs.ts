import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage";

type Prefs = { enabled: boolean; snoozedUntil: number };
const defaults: Prefs = { enabled: true, snoozedUntil: 0 };
export function useCheckinPrefs() {
  const [prefs, setPrefs] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.checkinPrefs) ?? "null");
      if (
        raw &&
        typeof raw === "object" &&
        "enabled" in raw &&
        typeof raw.enabled === "boolean" &&
        "snoozedUntil" in raw &&
        typeof raw.snoozedUntil === "number" &&
        Number.isFinite(raw.snoozedUntil)
      )
        setPrefs({ enabled: raw.enabled, snoozedUntil: raw.snoozedUntil });
    } catch {
      /* A blocked browser store leaves the device defaults in place. */
    }
    setLoaded(true);
  }, []);
  const update = (next: Prefs) => {
    try {
      localStorage.setItem(STORAGE_KEYS.checkinPrefs, JSON.stringify(next));
      setPrefs(next);
      setError("");
    } catch {
      setError("Your browser could not save this preference. Check its storage settings.");
    }
  };
  return {
    prefs,
    loaded,
    error,
    setEnabled: (enabled: boolean) => update({ enabled, snoozedUntil: 0 }),
    snooze: () => update({ ...prefs, snoozedUntil: Date.now() + 7 * 86400000 }),
    reset: () => {
      setPrefs(defaults);
      setError("");
      try {
        localStorage.removeItem(STORAGE_KEYS.checkinPrefs);
      } catch {
        /* Already blocked. */
      }
    },
  };
}
export type CheckinPrefsController = ReturnType<typeof useCheckinPrefs>;

import { STORAGE_KEYS, migrateLegacyStorage } from "@/lib/storage";

export function readGeminiKey(): string {
  if (typeof window === "undefined") return "";
  migrateLegacyStorage();
  try {
    return localStorage.getItem(STORAGE_KEYS.geminiKey) ?? "";
  } catch {
    return "";
  }
}

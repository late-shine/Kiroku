/**
 * Kiroku's text-to-speech: which browser voice reads Japanese aloud (Phase 8).
 *
 * The voice comes from the browser's own `speechSynthesis`, so the list differs per browser and per
 * device. Only the chosen voice's `voiceURI` is saved (empty string = "Automatic", let the browser pick),
 * in `localStorage[STORAGE_KEYS.voice]`. It is deliberately NOT part of `progress` or the backup file:
 * a voice that exists on one device usually doesn't exist on another.
 *
 * `speak()` reads the saved choice on every call, so the picker and every "Listen" button stay in sync
 * without any shared React state. If the saved voice isn't available in this browser, it quietly falls
 * back to the default Japanese voice; the saved value is kept in case the voice comes back.
 */
import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage";

export const VOICE_SAMPLE_TEXT = "こんにちは。今日も一緒に勉強しましょう。";
const SPEAK_RATE = 0.88;
/** Chrome fills the voice list in late, and a device with no Japanese voice never does. */
const VOICES_SETTLE_MS = 1500;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

export function isSpeechSupported(): boolean {
  return synth() !== null;
}

/** Android Chrome reports "ja_JP", desktop browsers "ja-JP" — accept both. */
function normalizeLang(lang: string): string {
  return lang.replace("_", "-");
}

function isJapanese(voice: SpeechSynthesisVoice): boolean {
  return normalizeLang(voice.lang).toLowerCase().startsWith("ja");
}

export function listJapaneseVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return [];
  return s
    .getVoices()
    .filter(isJapanese)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The saved voiceURI, or "" for Automatic. */
export function loadVoicePref(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEYS.voice) ?? "";
  } catch {
    return "";
  }
}

export function saveVoicePref(voiceURI: string): void {
  if (typeof window === "undefined") return;
  try {
    if (voiceURI === "") localStorage.removeItem(STORAGE_KEYS.voice);
    else localStorage.setItem(STORAGE_KEYS.voice, voiceURI);
  } catch {
    /* storage blocked or full — the choice just won't persist past this page */
  }
}

export function speak(text: string): void {
  const s = synth();
  if (!s) return;
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const savedUri = loadVoicePref();
  const voice =
    savedUri === "" ? undefined : listJapaneseVoices().find((v) => v.voiceURI === savedUri);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = normalizeLang(voice.lang);
  } else {
    utterance.lang = "ja-JP";
  }
  utterance.rate = SPEAK_RATE;
  s.speak(utterance);
}

/**
 * The Japanese voices this browser offers. `settled` turns true once voices have appeared or
 * VOICES_SETTLE_MS has passed, so the UI can tell "still loading" from "there are none".
 */
export function useJapaneseVoices(): { voices: SpeechSynthesisVoice[]; settled: boolean } {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const s = synth();
    if (!s) return;
    const update = () => {
      const found = listJapaneseVoices();
      setVoices(found);
      if (found.length > 0) setSettled(true);
    };
    update();
    s.addEventListener("voiceschanged", update);
    const timer = window.setTimeout(() => setSettled(true), VOICES_SETTLE_MS);
    return () => {
      s.removeEventListener("voiceschanged", update);
      window.clearTimeout(timer);
    };
  }, []);
  return { voices, settled };
}

// Writing quests, Phase Q2 — this device's quest prefs as React state. Called ONCE, in the shell (`JapaneseDesk`), so
// the header pill, the Profile switch and the Write page all see the same value.
//
// Hydration safe: the first render (server and client) is `{}` with `loaded = false`; the stored value is read in an
// effect after mount. Nothing is written back until it has been read (so the defaults never overwrite what is stored),
// and an empty value removes the key instead of storing a shell.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readQuestPrefs,
  writeQuestPrefs,
  type QuestPrefs,
  type WritingDraft,
} from "@/lib/quest-prefs";
import { STORAGE_KEYS } from "@/lib/storage";

export interface QuestPrefsApi {
  prefs: QuestPrefs;
  /** False until the stored value has been read (the first render, and the server render). */
  loaded: boolean;
  /** An explicit choice for the Writing practice switch. */
  setOn: (on: boolean) => void;
  /** Replaces the page being written (null clears it). Accepts an updater so quick taps never lose a mark. */
  setDraft: (
    next: WritingDraft | null | ((previous: WritingDraft | undefined) => WritingDraft | null),
  ) => void;
  /** Forgets everything (used by "Reset everything"): the stored key is removed too. */
  reset: () => void;
}

export function useQuestPrefs(): QuestPrefsApi {
  const [prefs, setPrefs] = useState<QuestPrefs>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(readQuestPrefs(localStorage, STORAGE_KEYS.quests));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    writeQuestPrefs(localStorage, STORAGE_KEYS.quests, prefs);
  }, [prefs, loaded]);

  const setOn = useCallback((on: boolean) => setPrefs((p) => ({ ...p, on })), []);

  const setDraft = useCallback<QuestPrefsApi["setDraft"]>((next) => {
    setPrefs((p) => {
      const draft = typeof next === "function" ? next(p.draft) : next;
      const { draft: _previous, ...rest } = p;
      return draft === null ? rest : { ...rest, draft };
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs({});
    writeQuestPrefs(localStorage, STORAGE_KEYS.quests, {});
  }, []);

  return useMemo(
    () => ({ prefs, loaded, setOn, setDraft, reset }),
    [prefs, loaded, setOn, setDraft, reset],
  );
}

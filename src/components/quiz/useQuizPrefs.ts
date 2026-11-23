// Hydration-safe React hook for device-only quiz pacing preferences (dailyGoal, dueFocus, today's done count).
// Subscribes to QUIZ_PREFS_EVENT and storage events so the Header badge, Profile summary, and QuizView stay in sync.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_QUIZ_PREFS,
  loadQuizPrefs,
  resetQuizPrefs,
  saveQuizPrefs,
  subscribeQuizPrefs,
  type QuizPrefs,
} from "@/lib/quiz-prefs";

export interface QuizPrefsApi {
  prefs: QuizPrefs;
  loaded: boolean;
  update: (change: (previous: QuizPrefs) => QuizPrefs) => void;
  reset: () => void;
}

export function useQuizPrefs(): QuizPrefsApi {
  const [prefs, setPrefs] = useState<QuizPrefs>(DEFAULT_QUIZ_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(loadQuizPrefs());
    setLoaded(true);
    return subscribeQuizPrefs(() => setPrefs(loadQuizPrefs()));
  }, []);

  const update = useCallback((change: (previous: QuizPrefs) => QuizPrefs) => {
    const next = change(loadQuizPrefs());
    setPrefs(next);
    saveQuizPrefs(next);
  }, []);

  const reset = useCallback(() => {
    setPrefs(DEFAULT_QUIZ_PREFS);
    resetQuizPrefs();
  }, []);

  return useMemo(() => ({ prefs, loaded, update, reset }), [prefs, loaded, update, reset]);
}

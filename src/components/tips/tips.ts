/**
 * Phase 11b — first-run tips: which cards exist, their approved wording, and the tiny read/dismiss
 * helpers over `localStorage["kiroku_tips_v1"]` (value: `{ "dismissed": ["studio", ...] }`).
 *
 * The helpers are pure (they take and return plain values) so they can be tested without a browser.
 * Reading never throws: anything unreadable counts as "nothing dismissed".
 */

export const TIP_IDS = ["studio", "quiz", "progress", "atmosphere"] as const;
export type TipId = (typeof TIP_IDS)[number];

const isTipId = (value: unknown): value is TipId =>
  typeof value === "string" && (TIP_IDS as readonly string[]).includes(value);

/** Turns the stored string into a list of dismissed tip ids. Corrupt, missing or odd data → `[]`. */
export function parseDismissed(raw: string | null): TipId[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
    const list = (parsed as Record<string, unknown>)["dismissed"];
    if (!Array.isArray(list)) return [];
    return TIP_IDS.filter((id) => list.includes(id));
  } catch {
    return [];
  }
}

export const serializeDismissed = (dismissed: readonly TipId[]): string =>
  JSON.stringify({ dismissed });

/** Adds one id without duplicating it. */
export const withDismissed = (dismissed: readonly TipId[], id: TipId): TipId[] =>
  dismissed.includes(id) ? [...dismissed] : [...dismissed, id];

/** The approved wording (agreed with the user in PLAN.md). Change copy here, nowhere else. */
export const TIP_COPY: Record<TipId, { title: string; body: string }> = {
  studio: {
    title: "Three steps",
    body: 'Configure, copy the prompt into your AI, then paste its reply back. Learn + Save is the easy one: you learn first, and the save block comes at the end. Use Save only when you already learned a day elsewhere. AIs sometimes skip parts of a prompt: if you get only the data block and no lesson, send the same prompt again. Turning on thinking (reasoning) mode, if your AI has one, often helps. The "?" button in the header explains it all again.',
  },
  quiz: {
    title: "Choose what to practise",
    body: "Use This day, All days or Day range at the top. Due today asks only the words you've added to review. Questions come only from lessons you've saved in Kiroku.",
  },
  progress: {
    title: "Back up now and then",
    body: "Everything is stored in this browser only. Export saves a backup file; Restore replaces your lessons and progress with one (you'll be asked first). Export before you clear your browser data or reset.",
  },
  atmosphere: {
    title: "Pick a reading voice",
    body: "Tap a voice at the bottom to hear a sample and keep it for reading Japanese aloud. The list can take a second to appear.",
  },
};

/**
 * Phase Q8 (the user-triggered key task) — the Gemini key, in Profile.
 *
 * Until now the only place to add the learner's own Gemini key was inside the AI Lesson Studio's "Save only" mode, two
 * steps down the Copy prompt page. This is the same key (same storage key, same relay behaviour) in the place people
 * look for settings. It is the body of a Profile card; the card heading comes from `ProfilePage`'s `Section`.
 *
 * The key stays in this browser: never in a backup, never synced (see `src/lib/gemini-key.ts`, which holds the storage
 * rules and the change signal the Studio listens to). The field is a password input, the saved key is never shown back
 * (only its last four characters, to tell two keys apart), and nothing here makes a network request.
 * Every control is a real button or input; saved / removed is announced through a polite status region.
 */
import { useEffect, useState } from "react";
import {
  keyTail,
  readGeminiKey,
  removeGeminiKey,
  saveGeminiKey,
  subscribeGeminiKey,
} from "@/lib/gemini-key";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Google AI Studio's home. Its key page has moved between a few paths, so the link goes to the site, not a deep path. */
export const AI_STUDIO_URL = "https://aistudio.google.com/";

export function GeminiKeyControls() {
  // null until the stored key has been read after mount (the server render and the first client render agree).
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const read = () => setKey(readGeminiKey());
    read();
    return subscribeGeminiKey(read);
  }, []);

  const hasKey = key !== null && key.trim() !== "";
  const tail = key === null ? "" : keyTail(key);

  const save = () => {
    if (saveGeminiKey(draft)) {
      setDraft("");
      setFailed(false);
      setNote("Gemini key saved on this device.");
    } else if (draft.trim() !== "") {
      setFailed(true);
      setNote("");
    }
  };

  return (
    <div className="mt-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Optional. Add your own Google Gemini key to turn on three helpers: converting a lesson you
        already have (AI Lesson Studio → Save only), fixing a lesson that won&apos;t import, and
        checking a photo of your writing page. Everything else works without it.
      </p>

      {key === null ? null : hasKey ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            Key saved on this device
            {tail !== "" && <span className="text-muted-foreground"> · ends in {tail}</span>}
          </p>
          <button
            type="button"
            onClick={() => {
              removeGeminiKey();
              setFailed(false);
              setNote("Gemini key removed.");
            }}
            className={`hit-area rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-destructive motion-reduce:transition-none ${focusRing}`}
          >
            Remove key
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <label htmlFor="profile-gemini-key" className="text-xs text-muted-foreground">
            Gemini API key
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="profile-gemini-key"
              type="password"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setFailed(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your key here"
              className={`min-w-0 flex-1 rounded-lg border border-border/60 bg-glass/60 px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:font-body placeholder:text-muted-foreground/60 focus:border-primary motion-reduce:transition-none ${focusRing}`}
            />
            <button
              type="button"
              onClick={save}
              disabled={draft.trim() === ""}
              className={`hit-area shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
            >
              Save key
            </button>
          </div>
          {failed && (
            <p role="alert" className="mt-2 text-[11px] text-destructive">
              Couldn&apos;t save the key in this browser (is storage blocked?). Try again.
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Stored only in this browser, never in a backup or sync, and sent to Google through
        Kiroku&apos;s relay with each request. It is never kept on a server. Each device keeps its
        own key.{" "}
        <a
          href={AI_STUDIO_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-primary"
        >
          Get a key in Google AI Studio
          <span className="sr-only"> (opens in a new tab)</span>
          <span aria-hidden> ↗</span>
        </a>
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {note}
      </p>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { readGeminiKey } from "@/lib/gemini-key";
import { relayGeminiVision, type RelayGeminiVisionResult } from "@/lib/gemini-relay";
import {
  VISION_DAILY_CAP,
  acknowledgeVision,
  recordVisionCall,
  visionCallsToday,
} from "@/lib/gemini-vision";
import { prepareVisionImage } from "@/lib/quest-image";
import type { QuestPrefs } from "@/lib/quest-prefs";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const primaryButton = `hit-area rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors motion-reduce:transition-none hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const quietButton = `hit-area rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-accent hover:text-foreground ${focusRing}`;

type VisionSuccess = Extract<RelayGeminiVisionResult, { ok: true }>;
type Selection = {
  previewUrl: string;
  image: { mime: "image/jpeg"; base64: string } | null;
};

export function PhotoCheck({
  count,
  today,
  prefs,
  update,
  onOpenProfile,
  onHandMark,
  onReply,
}: {
  count: number;
  today: string;
  prefs: QuestPrefs;
  update: (change: (previous: QuestPrefs) => QuestPrefs) => void;
  /** Phase Q8: the key is added in Profile now (it used to be the Studio's Save only mode). */
  onOpenProfile: () => void;
  onHandMark: () => void;
  onReply: (result: VisionSuccess) => void;
}) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [selection, setSelectionState] = useState<Selection | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const setSelection = useCallback((next: Selection | null) => {
    selectionRef.current = next;
    setSelectionState(next);
  }, []);

  const clearPhoto = useCallback(() => {
    const current = selectionRef.current;
    if (current !== null) URL.revokeObjectURL(current.previewUrl);
    setSelection(null);
  }, [setSelection]);

  useEffect(() => {
    setApiKey(readGeminiKey());
    return () => {
      runId.current += 1;
      busyRef.current = false;
      const current = selectionRef.current;
      if (current !== null) URL.revokeObjectURL(current.previewUrl);
      selectionRef.current = null;
    };
  }, []);

  const used = visionCallsToday(prefs, today);
  const capped = used >= VISION_DAILY_CAP;
  const hasKey = apiKey !== null && apiKey.trim() !== "";

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined || busyRef.current) return;
    const run = ++runId.current;
    clearPhoto();
    setError(null);
    setPreparing(true);
    const previewUrl = URL.createObjectURL(file);
    setSelection({ previewUrl, image: null });
    void prepareVisionImage(file)
      .then((image) => {
        if (run !== runId.current || selectionRef.current?.previewUrl !== previewUrl) return;
        setSelection({ previewUrl, image });
      })
      .catch((cause: unknown) => {
        if (run !== runId.current) return;
        clearPhoto();
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't prepare that photo. Try a different one.",
        );
      })
      .finally(() => {
        if (run === runId.current) setPreparing(false);
      });
  };

  const checkPhoto = async () => {
    const image = selectionRef.current?.image;
    const key = apiKey?.trim() ?? "";
    if (
      busyRef.current ||
      image === null ||
      image === undefined ||
      key === "" ||
      capped ||
      prefs.ack !== true
    ) {
      return;
    }
    const run = ++runId.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    update((previous) => recordVisionCall(previous, today));
    try {
      const result = await relayGeminiVision({
        data: { apiKey: key, count: count as 1 | 2 | 3 | 4 | 5, image },
      });
      if (run !== runId.current) return;
      clearPhoto();
      if (!result.ok) {
        setError(`${result.message} Mark by hand.`);
        return;
      }
      onReply(result);
    } catch {
      if (run !== runId.current) return;
      clearPhoto();
      setError(
        "Couldn't reach Kiroku's Gemini relay. Check your connection and try again. Mark by hand.",
      );
    } finally {
      if (run === runId.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const cancel = () => {
    runId.current += 1;
    busyRef.current = false;
    setBusy(false);
    setPreparing(false);
    setError(null);
    clearPhoto();
  };

  return (
    <div className="mt-4">
      {apiKey === null ? (
        <p className="text-sm text-muted-foreground">Looking for your Gemini key…</p>
      ) : !hasKey ? (
        <div className="rounded-lg border border-border/60 bg-glass/40 p-3">
          <p className="text-sm text-muted-foreground">
            Photo checks need your own Gemini key (add it in Profile, under Gemini key). You can
            always check yourself.
          </p>
          <button type="button" onClick={onOpenProfile} className={`mt-3 ${quietButton}`}>
            Open Profile
          </button>
        </div>
      ) : (
        <>
          {prefs.ack !== true && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
              <p className="text-xs leading-relaxed text-foreground">
                Your photo goes to Google through Kiroku&apos;s relay for this check, and Kiroku
                never keeps it. If the first model is busy, the same photo may be sent to up to two
                other Gemini models. On a free Gemini key, Google may use it to improve its products
                and a person may read it, so write only kanji on the page. In the EEA, Switzerland
                and the UK, Google applies its paid-service data terms instead. Adding billing to
                your Google project also changes that.
              </p>
              <button
                type="button"
                onClick={() => update(acknowledgeVision)}
                className={`mt-3 ${quietButton}`}
              >
                I understand
              </button>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={choosePhoto}
            disabled={busy || preparing || capped || prefs.ack !== true}
            className={`mt-4 block w-full cursor-pointer rounded-lg border border-border/60 bg-glass/40 p-2 text-xs text-muted-foreground file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:text-sm file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          />

          {selection !== null && (
            <img
              src={selection.previewUrl}
              alt="Your numbered writing page"
              className="mx-auto mt-4 max-h-60 max-w-full rounded-lg border border-border/60 object-contain"
            />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void checkPhoto()}
              disabled={
                busy || preparing || selection?.image == null || capped || prefs.ack !== true
              }
              className={primaryButton}
            >
              Check my photo
            </button>
            {busy && (
              <button type="button" onClick={cancel} className={quietButton}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      <div aria-live="polite" className="mt-3 text-xs text-muted-foreground">
        {preparing && <p>Preparing your photo…</p>}
        {busy && <p>Checking your photo… each model gets up to 45 s.</p>}
        {error !== null && <p role="alert">{error}</p>}
        {capped && hasKey && (
          <p>
            Photo checks used today: {used} of {VISION_DAILY_CAP}. You can still mark by hand.
          </p>
        )}
      </div>

      <p id="photo-check-limit" className="mt-3 text-xs text-muted-foreground">
        Gemini can&apos;t see stroke order or stroke count. It only compares shapes, and it can be
        wrong.
      </p>
      <button type="button" onClick={onHandMark} className={`mt-4 ${quietButton}`}>
        Mark by hand
      </button>
    </div>
  );
}

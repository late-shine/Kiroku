import { useEffect, useRef, useState } from "react";
import type { EffectId } from "@/lib/friend-decorations";
import {
  cardEffectRun,
  CARD_EFFECT_DURATION,
  type CardEffectRun,
  type CardEffectPhase,
} from "@/lib/card-motion";
import { useMotionPreference } from "./use-motion-preference";

/** Finite runs stop permanently on hide/exit; scroll and ordinary renders cannot rearm them. */
export function useCardEffect(
  effect: EffectId,
  requestedRun: CardEffectRun | null | undefined,
  active: boolean,
) {
  const root = useRef<HTMLElement>(null);
  const [entryRun] = useState(() => cardEffectRun(effect));
  const run = requestedRun === undefined ? entryRun : requestedRun;
  const preference = useMotionPreference();
  const [playback, setPlayback] = useState<{
    run: CardEffectRun;
    effect: EffectId;
    phase: CardEffectPhase;
  } | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !run || preference === null) return;
    if (!active) {
      setPlayback({ run, effect, phase: "settled" });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: IntersectionObserver | undefined;
    let disposed = false;
    let visible = false;
    let started = false;
    const settle = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", consider);
      if (!disposed) setPlayback({ run, effect, phase: "settled" });
    };
    const consider = () => {
      if (disposed) return;
      if (!active || document.visibilityState !== "visible" || !visible) {
        if (started) settle();
        return;
      }
      if (started || run.wasPlayed()) return;
      if (!run.claim()) {
        settle();
        return;
      }
      if (!preference || effect === "none" || effect !== run.effect) {
        settle();
        return;
      }
      started = true;
      setPlayback({ run, effect, phase: "running" });
      timer = setTimeout(settle, CARD_EFFECT_DURATION[effect]);
    };
    if (run.wasPlayed() || !preference || effect !== run.effect || effect === "none") {
      run.claim();
      settle();
    } else {
      try {
        observer = new IntersectionObserver(
          ([entry]) => {
            visible = Boolean(entry?.isIntersecting && entry.intersectionRatio > 0);
            consider();
          },
          { threshold: [0, 0.01] },
        );
        observer.observe(element);
        document.addEventListener("visibilitychange", consider);
      } catch {
        // Missing visibility support is a static fallback, never an unbounded animation.
        run.claim();
        settle();
      }
    }
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", consider);
    };
  }, [effect, run, active, preference]);
  const phase: CardEffectPhase =
    active &&
    preference === true &&
    playback !== null &&
    playback.run === run &&
    playback.effect === effect
      ? playback.phase
      : "static";
  return { root, phase, token: run?.token ?? 0 };
}

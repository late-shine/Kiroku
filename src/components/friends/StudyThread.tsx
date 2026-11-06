import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import type { StudyThreadRun } from "@/lib/comparison-motion";

/** Follows F3h's static-first, visible-once convention; it does not animate the cards. */
export function StudyThread({
  run,
  active,
  ownAvatar,
  friendAvatar,
}: {
  run: StudyThreadRun;
  active: boolean;
  ownAvatar: ReactNode;
  friendAvatar: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const motionAllowed = useMotionPreference();
  const [playback, setPlayback] = useState<{ run: StudyThreadRun; running: boolean } | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || motionAllowed === null) return;
    let observer: IntersectionObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    let started = false;
    let disposed = false;
    const settle = () => {
      if (timer) clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", consider);
      if (!disposed) setPlayback({ run, running: false });
    };
    const consider = () => {
      if (disposed) return;
      if (document.visibilityState !== "visible" || !visible) {
        if (started) settle();
        return;
      }
      if (started || run.wasPlayed()) return;
      if (!run.claim()) {
        settle();
        return;
      }
      started = true;
      setPlayback({ run, running: true });
      timer = setTimeout(settle, 600);
    };
    if (!active) {
      settle();
    } else if (!motionAllowed || run.wasPlayed()) {
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
  }, [active, motionAllowed, run]);
  const running =
    active &&
    motionAllowed === true &&
    playback !== null &&
    playback.run === run &&
    playback.running;
  return (
    <div ref={root} className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-4" aria-hidden="true">
        {ownAvatar}
        <span
          data-thread-phase={running ? "running" : "settled"}
          className={`friends-thread h-px flex-1 ${active ? "friends-thread-shared bg-primary" : "bg-border"}`}
        />
        {friendAvatar}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {active ? "You both studied today, as of the shared update." : "Two notebooks, one week."}
      </p>
    </div>
  );
}

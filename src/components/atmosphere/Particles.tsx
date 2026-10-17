// Phase 21: one quiet particle effect per scene — fireflies over the night flowers, a few falling leaves
// at the autumn château, large blurred mist wisps in the fog, rising pollen around the misty companions.
// (The PLAN.md Phase 21 table. Deliberately different from Astra-chan's snow, sakura, sparkles, rain and
// runes: quiet, natural, one per scene.)
//
// Technique, as the plan prescribes: plain DOM nodes + CSS keyframes (transform and opacity only — the
// keyframes and their utilities live next to `equalize` in styles.css), no canvas and no animation loop,
// so colours stay tokens and the compositor does the work. All parameters (positions, sizes, durations,
// per-particle --* variables) are generated AFTER MOUNT, so server render, first client render and
// hydration all agree on an empty layer and there is no mismatch.
//
// Two rules from the plan:
// - Under `prefers-reduced-motion` this renders NOTHING. The global CSS rule only shortens animations,
//   which would leave the dots frozen in view — this is the one place that rule is not enough.
// - On a scene change the layer fades out (~1.2 s), swaps effect, and fades back in (~1.4 s), staying
//   inside the 2.8 s image crossfade.
import { memo, useEffect, useState, type CSSProperties } from "react";
import type { ParticleDensity } from "@/lib/atmosphere-prefs";

type Effect = "fireflies" | "leaves" | "mist" | "pollen";

// The scene name decides the effect (one per scene). A scene this table does not know simply has none.
const EFFECT_BY_SCENE: Record<string, Effect> = {
  "Night flowers": "fireflies",
  "Autumn château": "leaves",
  "Castle in fog": "mist",
  "Misty companions": "pollen",
};

// The plan's counts (Subtle about 10 phone / 16 desktop, Lively 18 / 28) are for the small-particle
// effects. Leaves are bigger and sparser; mist wisps are huge, so only a few drift at once. Glass panels
// re-blur whatever moves beneath them, which is why the counts stay small.
const BASE_COUNTS: Record<Exclude<ParticleDensity, "off">, { phone: number; desktop: number }> = {
  subtle: { phone: 10, desktop: 16 },
  lively: { phone: 18, desktop: 28 },
};
const EFFECT_SCALE: Record<Effect, number> = { fireflies: 1, pollen: 1, leaves: 0.7, mist: 0.25 };
const EFFECT_MIN: Record<Effect, number> = { fireflies: 5, pollen: 5, leaves: 4, mist: 3 };

const EFFECT_CLASS: Record<Effect, string> = {
  fireflies: "particle-firefly rounded-full bg-primary",
  leaves: "particle-leaf leaf-tone",
  mist: "particle-mist rounded-full bg-foreground/5",
  pollen: "particle-pollen rounded-full bg-primary/50",
};

// Scene-change pacing: fade the old effect out, swap, fade the new one in — inside the 2.8 s image fade.
const FADE_OUT_MS = 1200;
const FADE_IN_MS = 1400;

type Dot = {
  left: string;
  top: string;
  width: string;
  height: string;
  /** The per-particle CSS variables (plus a static box-shadow / filter where the effect wants one). */
  vars: Record<string, string | number>;
};

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const pct = (min: number, max: number): string => `${rand(min, max).toFixed(1)}%`;

// The two variables every effect shares. The delay is NEGATIVE, so each particle starts mid-loop and the
// field is alive on the first paint instead of charging up in lockstep.
const baseVars = (duration: number, peak: number): Record<string, string | number> => ({
  "--particle-duration": `${duration.toFixed(1)}s`,
  "--particle-delay": `${(-rand(0, duration)).toFixed(1)}s`,
  "--particle-peak": peak.toFixed(2),
});

function makeDots(effect: Effect, count: number): Dot[] {
  const dots: Dot[] = [];
  for (let i = 0; i < count; i += 1) {
    switch (effect) {
      case "fireflies": {
        const size = rand(2.5, 4).toFixed(1);
        dots.push({
          left: pct(5, 95),
          top: pct(15, 85),
          width: `${size}px`,
          height: `${size}px`,
          vars: {
            ...baseVars(rand(7, 13), rand(0.6, 0.95)),
            "--wx": `${rand(-28, 28).toFixed(0)}px`,
            "--wy": `${rand(-30, 12).toFixed(0)}px`,
            // The plan's glow: a soft halo from the --glow token.
            boxShadow: "0 0 9px 2px var(--glow)",
          },
        });
        break;
      }
      case "leaves": {
        const duration = rand(15, 24);
        dots.push({
          left: pct(2, 98),
          top: "0%",
          width: `${rand(8, 12).toFixed(1)}px`,
          height: `${rand(6, 9).toFixed(1)}px`,
          vars: {
            ...baseVars(duration, rand(0.5, 0.8)),
            "--sway": `${(rand(18, 36) * (Math.random() < 0.5 ? -1 : 1)).toFixed(0)}px`,
            borderRadius: "70% 30% 60% 40%",
          },
        });
        break;
      }
      case "mist": {
        const duration = rand(55, 85);
        dots.push({
          left: pct(15, 65),
          top: pct(30, 75),
          width: `${rand(38, 58).toFixed(0)}vmin`,
          height: `${rand(22, 36).toFixed(0)}vmin`,
          vars: {
            ...baseVars(duration, rand(0.5, 0.8)),
            // Half the wisps drift left, half right; all of them rise a little.
            "--dir": Math.random() < 0.5 ? "-1" : "1",
            "--rise": `${rand(-6, -2).toFixed(1)}lvh`,
            filter: "blur(36px)",
          },
        });
        break;
      }
      case "pollen": {
        const size = rand(2, 3.5).toFixed(1);
        dots.push({
          left: pct(5, 95),
          top: pct(55, 95),
          width: `${size}px`,
          height: `${size}px`,
          vars: {
            ...baseVars(rand(16, 28), rand(0.4, 0.7)),
            "--drift": `${(rand(8, 24) * (Math.random() < 0.5 ? -1 : 1)).toFixed(0)}px`,
          },
        });
        break;
      }
    }
  }
  return dots;
}

export const Particles = memo(function Particles({
  sceneName,
  density,
}: {
  sceneName: string;
  density: ParticleDensity;
}) {
  const effect = EFFECT_BY_SCENE[sceneName];

  // The OS reduced-motion setting: render NOTHING while it is on (the rule from the plan, see above).
  // Starts false so server and first client render agree — the layer is empty until mount anyway.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // The effect actually on screen. A scene change fades the layer out first, then swaps and fades in.
  const [shown, setShown] = useState<Effect | undefined>(effect);
  const [fadedIn, setFadedIn] = useState(true);
  useEffect(() => {
    if (effect === shown) return;
    setFadedIn(false);
    const timer = window.setTimeout(() => {
      setShown(effect);
      setFadedIn(true);
    }, FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [effect, shown]);

  // The particle parameters: generated after mount, regenerated when the shown effect or density changes.
  const [dots, setDots] = useState<Dot[]>([]);
  useEffect(() => {
    if (!shown || density === "off" || reducedMotion) {
      setDots([]);
      return;
    }
    const base = BASE_COUNTS[density];
    const target = Math.max(
      EFFECT_MIN[shown],
      Math.round((window.innerWidth >= 768 ? base.desktop : base.phone) * EFFECT_SCALE[shown]),
    );
    setDots(makeDots(shown, target));
  }, [shown, density, reducedMotion]);

  if (density === "off" || reducedMotion || !shown) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        opacity: fadedIn ? 1 : 0,
        transition: `opacity ${fadedIn ? FADE_IN_MS : FADE_OUT_MS}ms ease-in-out`,
      }}
    >
      {dots.map((dot, i) => (
        <span
          key={i}
          className={`absolute block ${EFFECT_CLASS[shown]}`}
          style={
            {
              left: dot.left,
              top: dot.top,
              width: dot.width,
              height: dot.height,
              ...dot.vars,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
});

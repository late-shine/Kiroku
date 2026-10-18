// Phase 16b-1: the full-screen scene behind the app.
//
// Why a component of its own: on Chrome Android a `fixed inset-0` box is as tall as the *visible* viewport,
// which grows and shrinks as the URL bar hides and shows while you scroll. With `object-cover` the picture
// was re-scaled and re-cropped every time. This container is as tall as the LARGE viewport (`100lvh`), which
// does not change when the URL bar moves, and sits on its own compositing layer.
//
// The slow "drift" animation lives on ONE wrapper (not on each of the four images), and the darkness layer
// and the two vignettes live inside the same container.
//
// Phase 21: only the CURRENT and the NEXT scene image are mounted (cycling always moves forward, so the
// next one is the only preload that matters), plus the outgoing scene until its 2.8 s fade-out finishes —
// otherwise a crossfade would cut to the bare background colour. The scene's particle effect
// (`Particles`) is a SIBLING of the drift wrapper, so it does not inherit the scale animation.
import { memo, useEffect, useState, type CSSProperties } from "react";
import { Particles } from "@/components/atmosphere/Particles";
import type { ParticleDensity } from "@/lib/atmosphere-prefs";

type Props = {
  backgrounds: { name: string; url: string }[];
  /** Index of the scene to show (any integer; it is wrapped to the list length). */
  activeIndex: number;
  /** Changing this remounts the images, as the old inline code did when cycling was toggled. */
  cycling: boolean;
  /** 0–1: how much of the page background colour is laid over the picture (the reading-contrast slider). */
  darkness: number;
  /** Phase 16d: how the picture drifts. "still" = no animation (held at the drift's resting zoom). */
  motion: "slow" | "medium" | "still";
  /** Phase 21: the scene's particle effect density. "off" draws nothing. */
  particles: ParticleDensity;
};

// One drift cycle, in seconds. "slow" is the speed it always had; styles.css reads the variable.
const DRIFT_SECONDS = { slow: 24, medium: 12 } as const;
// A touch past the 2800ms opacity transition, so the outgoing scene stays mounted for its whole fade.
const FADE_OUT_HOLD_MS = 3000;

export const SceneBackdrop = memo(function SceneBackdrop({
  backgrounds,
  activeIndex,
  cycling,
  darkness,
  motion,
  particles,
}: Props) {
  const active = backgrounds.length > 0 ? activeIndex % backgrounds.length : 0;
  const next = backgrounds.length > 0 ? (active + 1) % backgrounds.length : 0;
  // The scene that is leaving, or null. It is recorded DURING RENDER, not in an effect: the old image
  // must stay mounted in the very commit that introduces the new scene. An effect runs after the
  // commit, so with an effect-only flag the old image is already unmounted and its half of the
  // crossfade never paints. Setting state during render is the documented "adjust state when a prop
  // changes" pattern: React re-renders immediately, before anything reaches the screen.
  const [prevActive, setPrevActive] = useState(active);
  const [fadingOut, setFadingOut] = useState<number | null>(null);
  if (prevActive !== active) {
    setPrevActive(active);
    setFadingOut(prevActive);
  }
  // The outgoing image unmounts a touch past the 2800ms transition. A rapid second change re-arms the
  // timer for the newer outgoing scene; the older one was already (mostly) transparent.
  useEffect(() => {
    if (fadingOut === null) return;
    const outgoing = fadingOut;
    const timer = window.setTimeout(
      () => setFadingOut((f) => (f === outgoing ? null : f)),
      FADE_OUT_HOLD_MS,
    );
    return () => window.clearTimeout(timer);
  }, [fadingOut]);
  const mountedScenes = new Set<number>([active, next]);
  if (fadingOut !== null) mountedScenes.add(fadingOut);

  return (
    <div
      aria-hidden
      className="scene-backdrop pointer-events-none fixed left-0 top-0 w-full overflow-hidden"
    >
      <div
        className={`absolute inset-0 ${motion === "still" ? "" : "scene-drift"}`}
        style={
          (motion === "still"
            ? { transform: "scale(1.05)" }
            : { "--scene-drift-duration": `${DRIFT_SECONDS[motion]}s` }) as CSSProperties
        }
      >
        {backgrounds.map((bg, index) =>
          mountedScenes.has(index) ? (
            <img
              key={`${bg.name}-${cycling ? "cycling" : "static"}`}
              src={bg.url}
              alt=""
              className={`absolute inset-0 size-full object-cover transition-opacity duration-[2800ms] ease-in-out ${
                index === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : null,
        )}
      </div>
      {/* A sibling of the drift wrapper (so no inherited scale), UNDER the darkness layer, so the
          reading-contrast slider dims the particles together with the scene. */}
      <Particles sceneName={backgrounds[active]?.name ?? ""} density={particles} />
      <div
        className="absolute inset-0 bg-background transition-opacity duration-700"
        style={{ opacity: darkness }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_95%)] opacity-70" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,transparent_35%,transparent_65%,var(--background)_100%)] opacity-35" />
    </div>
  );
});

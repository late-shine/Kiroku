import type { CSSProperties } from "react";
import type { EffectId } from "@/lib/friend-decorations";
import type { CardEffectPhase } from "@/lib/card-motion";

// Fixed positions/delays: no randomness or regeneration on typing/stat refreshes.
const PARTICLES = [
  { left: "2%", top: "12%", delay: 0, wx: "3px", wy: "18px" },
  { left: "96%", top: "18%", delay: 0.2, wx: "-3px", wy: "24px" },
  { left: "3%", top: "43%", delay: 0.4, wx: "2px", wy: "-16px" },
  { left: "95%", top: "51%", delay: 0.6, wx: "-2px", wy: "20px" },
  { left: "2%", top: "73%", delay: 0.8, wx: "3px", wy: "-22px" },
  { left: "96%", top: "79%", delay: 1, wx: "-3px", wy: "-18px" },
] as const;

/** At most seven decorative elements; the avatar ring is a separate single ornament. */
export function CardEffects({
  effect,
  phase,
  token,
}: {
  effect: EffectId;
  phase: CardEffectPhase;
  token: number;
}) {
  if (effect === "none" || effect === "breath") return null;
  if ((effect === "petals" || effect === "fireflies") && phase !== "running") return null;
  return (
    <span
      key={token}
      aria-hidden="true"
      className="card-effects"
      data-effect={effect}
      data-phase={phase}
    >
      {effect === "glint" && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="card-effect-edge"
          fill="none"
        >
          <rect
            x="1"
            y="1"
            width="98"
            height="98"
            rx="4"
            className="card-effect-quiet-line"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x="1"
            y="1"
            width="98"
            height="98"
            rx="4"
            pathLength="100"
            className="card-effect-trace"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {effect === "vines" &&
        ["top", "bottom"].map((corner) => (
          <svg
            key={corner}
            viewBox="0 0 40 40"
            fill="none"
            className={`card-effect-vine card-effect-vine-${corner}`}
          >
            <path d="M4 36Q8 12 36 4" stroke="currentColor" strokeWidth="1.1" />
            <path
              d="M10 25Q0 21 5 12Q17 13 10 25ZM21 13Q17 0 31 3Q34 14 21 13ZM16 23Q27 13 33 23Q27 34 16 23Z"
              fill="currentColor"
            />
          </svg>
        ))}
      {(effect === "petals" || effect === "fireflies") &&
        PARTICLES.map((particle, index) => (
          <span
            key={index}
            className={`card-effect-particle card-effect-${effect === "petals" ? "petal" : "firefly"}`}
            style={
              {
                left: particle.left,
                top: particle.top,
                "--card-particle-delay": `${particle.delay}s`,
                "--wx": particle.wx,
                "--wy": particle.wy,
              } as CSSProperties
            }
          />
        ))}
    </span>
  );
}

/** Selection thumbnails remain still; replay affects only the single live card. */
export function EffectSample({ effect }: { effect: EffectId }) {
  return (
    <span aria-hidden="true" className="effect-sample" data-effect={effect}>
      {effect === "none"
        ? "記"
        : effect === "glint"
          ? "⌁"
          : effect === "breath"
            ? "◯"
            : effect === "vines"
              ? "❧"
              : effect === "petals"
                ? "❀"
                : "· · ·"}
    </span>
  );
}

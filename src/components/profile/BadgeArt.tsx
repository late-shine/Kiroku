/**
 * Writing quests, Phase Q6b — the badge artwork, drawn in code (inline SVG, no image files, no dependency).
 * The look follows the badge reference sheet (handmade paper, gold foil, carved wood, glass, green cord on dark slate)
 * but nothing is copied from it: every shape here is plain SVG geometry on a 100 x 100 canvas.
 *
 * Counting badges show their real number (3 discs, 7 discs, 30 discs, 20 coins, 10 sheets, 10 blocks); each counted
 * element carries `data-unit` so the check script can verify it. The art is decorative: it is `aria-hidden` and the
 * name and the "how" text beside it carry the meaning.
 *
 * `BadgeArtDefs` must be rendered once on the page (BadgeShelf does it); the art refers to its gradients and the grain
 * filter by id (`kq-*`). The colours below are illustration colours, not interface tokens.
 */
import type { ReactNode } from "react";

const GOLD = "url(#kq-gold)";
const PAPER = "url(#kq-paper)";
const WOOD = "url(#kq-wood)";
const GOLD_LINE = "#c79a3c";
const INK = "#0f1512";
const CORD = "#2d5a43";

/** Shared gradients and the paper/wood/foil grain filter. Zero-size, not `display: none`, so the references resolve. */
export function BadgeArtDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="kq-slate" gradientUnits="userSpaceOnUse" cx="38" cy="30" r="80">
          <stop offset="0" stopColor="#2b3d34" />
          <stop offset="1" stopColor="#0e1512" />
        </radialGradient>
        <linearGradient id="kq-gold" gradientUnits="userSpaceOnUse" x1="20" y1="14" x2="80" y2="86">
          <stop offset="0" stopColor="#f2d98d" />
          <stop offset="0.45" stopColor="#d3a844" />
          <stop offset="1" stopColor="#966c25" />
        </linearGradient>
        <linearGradient
          id="kq-paper"
          gradientUnits="userSpaceOnUse"
          x1="24"
          y1="18"
          x2="76"
          y2="84"
        >
          <stop offset="0" stopColor="#f5eed9" />
          <stop offset="1" stopColor="#d6c9a9" />
        </linearGradient>
        <linearGradient id="kq-wood" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="80" y2="80">
          <stop offset="0" stopColor="#98764c" />
          <stop offset="1" stopColor="#5a4128" />
        </linearGradient>
        <radialGradient id="kq-glass" gradientUnits="userSpaceOnUse" cx="38" cy="28" r="72">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
        </radialGradient>
        <filter id="kq-grain" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={2}
            seed={7}
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.04  1.2 0 0 0 -0.6"
            result="specks"
          />
          <feComposite in="specks" in2="SourceAlpha" operator="in" result="speckled" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="speckled" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// ---- helpers ---------------------------------------------------------------------------------

const n2 = (v: number): number => Math.round(v * 100) / 100;
const polar = (cx: number, cy: number, r: number, deg: number) => ({
  x: n2(cx + r * Math.cos((deg * Math.PI) / 180)),
  y: n2(cy + r * Math.sin((deg * Math.PI) / 180)),
});
/** `count` points evenly around a circle, the first straight up. */
const ring = (count: number, radius: number, cx = 50, cy = 50) =>
  Array.from({ length: count }, (_, i) => polar(cx, cy, radius, -90 + (360 * i) / count));

/** The dark slate medallion every badge sits on, with a thin gold edge. */
function Base() {
  return (
    <>
      <circle cx="50" cy="50" r="47" fill="url(#kq-slate)" filter="url(#kq-grain)" />
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={GOLD_LINE}
        strokeOpacity="0.55"
        strokeWidth="0.8"
      />
    </>
  );
}

/** A glass dish: a clear disc with a rim and a soft highlight. */
function Glass() {
  return (
    <>
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="url(#kq-glass)"
        stroke="#ffffff"
        strokeOpacity="0.3"
        strokeWidth="0.9"
      />
      <path
        d="M20 34 A34 34 0 0 1 44 17"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.4"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  );
}

/** A deckled paper outline: a rough circle (fixed wobble, so it is the same every render). */
function tornPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 36 }, (_, i) => {
    const a = (i * 10 * Math.PI) / 180;
    const wobble =
      1 + 0.045 * Math.sin(3 * a + 1) + 0.03 * Math.sin(7 * a + 2) + 0.022 * Math.sin(17 * a);
    return `${n2(cx + r * wobble * Math.cos(a))} ${n2(cy + r * wobble * Math.sin(a))}`;
  });
  return `M${pts.join(" L")} Z`;
}

/** A paper disc with a gold centre (the unit of the streak badges). */
function PaperDisc({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g data-unit="disc">
      <circle cx={x} cy={y} r={r} fill={PAPER} stroke="#b8aa86" strokeWidth="0.5" />
      <circle cx={x} cy={y} r={r * 0.4} fill={GOLD} />
    </g>
  );
}

/** The tapered brush stroke (a gold stroke on paper, or a groove cut into wood). */
const STROKE = "M31 72 C38 60 50 44 66 29 C69 26 74 27 72 32 C64 46 52 62 40 76 Q34 76 31 72 Z";

// ---- the eleven pieces -----------------------------------------------------------------------

function FirstAnswer() {
  return (
    <>
      <Base />
      <g filter="url(#kq-grain)">
        <path d={tornPath(50, 51, 31)} fill={PAPER} stroke="#bcae88" strokeWidth="0.6" />
      </g>
      <path d={STROKE} fill={GOLD} />
    </>
  );
}

function ThreeInARow() {
  return (
    <>
      <Base />
      <g filter="url(#kq-grain)">
        <PaperDisc x={29} y={50} r={14.5} />
        <PaperDisc x={50} y={50} r={14.5} />
        <PaperDisc x={71} y={50} r={14.5} />
      </g>
      <path d="M9 50 H14 M86 50 H91" stroke={GOLD_LINE} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function FullWeek() {
  return (
    <>
      <Base />
      <circle
        cx="50"
        cy="50"
        r="29"
        fill="none"
        stroke={GOLD_LINE}
        strokeWidth="0.9"
        strokeOpacity="0.8"
      />
      <g filter="url(#kq-grain)">
        {ring(7, 29).map((p, i) => (
          <PaperDisc key={i} x={p.x} y={p.y} r={9.5} />
        ))}
      </g>
    </>
  );
}

function FullMonth() {
  return (
    <>
      <Base />
      <circle
        cx="50"
        cy="50"
        r="29"
        fill="#16221c"
        stroke={GOLD_LINE}
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      <g filter="url(#kq-grain)">
        {ring(30, 37).map((p, i) => (
          <PaperDisc key={i} x={p.x} y={p.y} r={3.5} />
        ))}
      </g>
    </>
  );
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`}
      fill={GOLD}
    />
  );
}

function FirstMastered() {
  return (
    <>
      <Base />
      <Glass />
      <g filter="url(#kq-grain)">
        <rect
          x="27"
          y="29"
          width="46"
          height="46"
          rx="3"
          fill="#cdbf9f"
          transform="rotate(5 50 52)"
        />
        <rect
          x="24"
          y="26"
          width="46"
          height="46"
          rx="3"
          fill={PAPER}
          stroke="#b8aa86"
          strokeWidth="0.5"
          transform="rotate(-2 47 49)"
        />
      </g>
      <circle cx="45" cy="52" r="13" fill={GOLD} filter="url(#kq-grain)" />
      <Sparkle x={67} y={33} s={8} />
    </>
  );
}

function TwentyMastered() {
  const coins = ring(20, 36);
  return (
    <>
      <Base />
      {ring(20, 25.5).map((p, i) => {
        const outer = polar(50, 50, 31, -90 + (360 * i) / 20);
        return (
          <path
            key={i}
            d={`M${p.x} ${p.y} L${outer.x} ${outer.y}`}
            stroke={GOLD_LINE}
            strokeOpacity="0.6"
            strokeWidth="0.5"
          />
        );
      })}
      {coins.map((p, i) => (
        <circle key={i} data-unit="coin" cx={p.x} cy={p.y} r={3.2} fill={GOLD} />
      ))}
      <circle data-unit="centre" cx="50" cy="50" r="18" fill={GOLD} filter="url(#kq-grain)" />
      <circle
        cx="50"
        cy="50"
        r="14.5"
        fill="none"
        stroke="#8a6420"
        strokeOpacity="0.55"
        strokeWidth="0.8"
      />
    </>
  );
}

function TenDays() {
  return (
    <>
      <Base />
      <rect
        x="20"
        y="20"
        width="60"
        height="60"
        fill="none"
        stroke={GOLD_LINE}
        strokeOpacity="0.5"
        strokeWidth="0.7"
        transform="rotate(45 50 50)"
      />
      <g filter="url(#kq-grain)">
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            data-unit="sheet"
            x="30"
            y={22 + i * 5}
            width="40"
            height="8"
            rx="2.5"
            fill={PAPER}
            stroke="#b9ad8c"
            strokeWidth="0.5"
          />
        ))}
      </g>
      <path d="M50 19 V81" stroke={CORD} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="50" cy="50" r="6" fill={GOLD} />
      <circle cx="50" cy="50" r="3.4" fill="none" stroke="#8a6420" strokeWidth="0.9" />
    </>
  );
}

/** A carved block of wood with a gold-lit groove; `scale` and the centre place it. */
function WoodBlock({
  x,
  y,
  size,
  rx,
  groove,
}: {
  x: number;
  y: number;
  size: number;
  rx: number;
  groove: number;
}) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  return (
    <g>
      <g filter="url(#kq-grain)">
        <rect x={x} y={y} width={size} height={size} rx={rx} fill={WOOD} />
      </g>
      {size >= 26 &&
        [0.22, 0.38, 0.54, 0.7, 0.86].map((f, i) => (
          <path
            key={i}
            d={`M${n2(x + size * 0.06)} ${n2(y + f * size)} C${n2(x + size * 0.35)} ${n2(y + f * size - size * 0.05)} ${n2(x + size * 0.65)} ${n2(y + f * size + size * 0.05)} ${n2(x + size * 0.94)} ${n2(y + f * size - size * 0.02)}`}
            fill="none"
            stroke="#3a2814"
            strokeOpacity="0.3"
            strokeWidth="0.7"
          />
        ))}
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={rx}
        fill="none"
        stroke="#c9a679"
        strokeOpacity="0.35"
        strokeWidth="0.7"
      />
      <g transform={`translate(${n2(cx - 50 * groove)} ${n2(cy - 50 * groove)}) scale(${groove})`}>
        <path d={STROKE} fill="#26180c" />
        <path
          d="M40 76 C52 62 64 46 72 32"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

function FirstCarve() {
  return (
    <>
      <Base />
      <WoodBlock x={24} y={24} size={52} rx={7} groove={0.92} />
    </>
  );
}

function TenCarved() {
  return (
    <>
      <Base />
      <circle
        cx="50"
        cy="50"
        r="34"
        fill="none"
        stroke={GOLD_LINE}
        strokeOpacity="0.7"
        strokeWidth="0.7"
      />
      {ring(9, 34).map((p, i) => (
        <g key={i} data-unit="block">
          <WoodBlock x={n2(p.x - 5.5)} y={n2(p.y - 5.5)} size={11} rx={2.2} groove={0.2} />
        </g>
      ))}
      <g data-unit="block-main">
        <WoodBlock x={37} y={37} size={26} rx={4} groove={0.46} />
      </g>
    </>
  );
}

/**
 * A (3,4) torus-knot projection: eight crossings, woven by painting short pieces of the strand from the lowest to the
 * highest, each with a dark casing under its gold. Computed once; the numbers are plain data after that.
 */
const KNOT = (() => {
  const N = 288;
  const STEP = 4;
  const R = 0.62;
  const r = 0.3;
  const S = 40;
  const pt = (i: number) => {
    const t = (2 * Math.PI * (((i % N) + N) % N)) / N;
    const radius = R + r * Math.cos(4 * t);
    return {
      x: 50 + S * radius * Math.cos(3 * t),
      y: 50 + S * radius * Math.sin(3 * t),
      z: r * Math.sin(4 * t),
    };
  };
  const path = (from: number, to: number) => {
    const parts: string[] = [];
    for (let i = from; i <= to; i++) {
      const p = pt(i);
      parts.push(`${i === from ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
    return parts.join(" ");
  };
  const pieces: { z: number; core: string; wide: string }[] = [];
  for (let c = 0; c < N / STEP; c++) {
    const a = c * STEP;
    let z = 0;
    for (let i = a; i <= a + STEP; i++) z += pt(i).z;
    pieces.push({ z: z / (STEP + 1), core: path(a, a + STEP), wide: path(a - 2, a + STEP + 2) });
  }
  return pieces.sort((p, q) => p.z - q.z);
})();

function HardOne() {
  return (
    <>
      <Base />
      {KNOT.map((piece, i) => (
        <g key={i} fill="none" strokeLinejoin="round">
          <path d={piece.core} stroke={INK} strokeWidth="6.6" strokeLinecap="butt" />
          <path d={piece.wide} stroke={GOLD} strokeWidth="3.6" strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

function CheckedPage() {
  return (
    <>
      <Base />
      <Glass />
      <g filter="url(#kq-grain)">
        <rect
          x="27"
          y="27"
          width="46"
          height="46"
          rx="3"
          fill={PAPER}
          stroke="#b8aa86"
          strokeWidth="0.5"
        />
      </g>
      <path
        d="M37 51 L47 61 L64 40"
        fill="none"
        stroke="#2d4f3a"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 35 V23 H35 M65 23 H77 V35 M77 65 V77 H65 M35 77 H23 V65"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="square"
      />
    </>
  );
}

const ART: Readonly<Record<string, () => ReactNode>> = {
  "first-answer": FirstAnswer,
  "streak-3": ThreeInARow,
  "streak-7": FullWeek,
  "streak-30": FullMonth,
  "first-mastered": FirstMastered,
  "mastered-20": TwentyMastered,
  "lessons-10": TenDays,
  "first-carve": FirstCarve,
  "carved-10": TenCarved,
  "hard-one": HardOne,
  "checked-page": CheckedPage,
};

/** The badge ids this file can draw (the check script compares them with `BADGES`). */
export const BADGE_ART_IDS: readonly string[] = Object.keys(ART);

/** One badge's medallion. Size it with `className` (it is square); an unknown id draws nothing. */
export function BadgeArt({ id, className = "" }: { id: string; className?: string }) {
  if (!Object.prototype.hasOwnProperty.call(ART, id)) return null;
  const Piece = ART[id];
  if (Piece === undefined) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-badge-art={id}
    >
      <Piece />
    </svg>
  );
}

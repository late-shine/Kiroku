export type DecorationSlot = "frame" | "border" | "charm" | "effect";
export type DecorationDefinition = {
  name: string;
  visual: string;
  requiredBadge?: string;
  minVersion: 1 | 4;
  implemented?: boolean;
};

/** One catalogue for persisted IDs, names, unlocks and artwork keys. No achievement writes. */
export const DECORATIONS = {
  frame: {
    plain: { name: "Quiet ink", visual: "plain", minVersion: 1 },
    gold: { name: "Golden brush", visual: "gold", minVersion: 1 },
    stitch: { name: "Sashiko", visual: "stitch", minVersion: 1 },
    moss: { name: "Little garden", visual: "moss", minVersion: 1 },
    double: { name: "Bookplate", visual: "double", minVersion: 1 },
    seal: { name: "Personal seal", visual: "seal", minVersion: 1 },
    orbit: { name: "Moon orbit", visual: "orbit", minVersion: 4 },
    petal: { name: "Petal crown", visual: "petal", minVersion: 4 },
    woven: { name: "Woven paper", visual: "woven", minVersion: 4 },
    archive: {
      name: "Gilded archive",
      visual: "archive",
      requiredBadge: "lessons-10",
      minVersion: 4,
    },
  },
  border: {
    none: { name: "Plain", visual: "none", minVersion: 4 },
    gilt: { name: "Gilt corners", visual: "gilt", minVersion: 4 },
    stitched: { name: "Notebook stitch", visual: "stitched", minVersion: 4 },
    garden: { name: "Garden margins", visual: "garden", minVersion: 4 },
    archival: {
      name: "Crane manuscript",
      visual: "archival",
      requiredBadge: "first-carve",
      minVersion: 4,
    },
  },
  charm: {
    none: { name: "No detail", visual: "none", minVersion: 4 },
    bookmark: { name: "Folded ribbon", visual: "bookmark", minVersion: 4 },
    moon: {
      name: "Seven-night moon",
      visual: "moon",
      requiredBadge: "streak-7",
      minVersion: 4,
    },
    blossom: { name: "One blossom", visual: "blossom", minVersion: 4 },
    seal: { name: "Little stamp", visual: "seal", minVersion: 4 },
  },
  effect: {
    none: { name: "Still", visual: "none", minVersion: 1 },
    vines: {
      name: "Growing garden",
      visual: "vines",
      requiredBadge: "streak-30",
      minVersion: 1,
      implemented: true,
    },
    petals: {
      name: "Passing petals",
      visual: "petals",
      requiredBadge: "carved-10",
      minVersion: 1,
      implemented: true,
    },
    fireflies: {
      name: "Evening lights",
      visual: "fireflies",
      requiredBadge: "mastered-20",
      minVersion: 1,
      implemented: true,
    },
    glint: {
      name: "Golden trace",
      visual: "glint",
      requiredBadge: "first-answer",
      minVersion: 4,
      implemented: true,
    },
    breath: {
      name: "Lantern glow",
      visual: "breath",
      requiredBadge: "streak-3",
      minVersion: 4,
      implemented: true,
    },
  },
} as const satisfies Record<DecorationSlot, Record<string, DecorationDefinition>>;

export type DecorationId<S extends DecorationSlot> = keyof (typeof DECORATIONS)[S] & string;
export type FrameId = DecorationId<"frame">;
export type BorderId = DecorationId<"border">;
export type CharmId = DecorationId<"charm">;
export type EffectId = DecorationId<"effect">;

export function decorationIds<S extends DecorationSlot>(slot: S): DecorationId<S>[] {
  return Object.keys(DECORATIONS[slot]) as DecorationId<S>[];
}
export function decorationDefinition(
  slot: DecorationSlot,
  id: unknown,
): DecorationDefinition | undefined {
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(DECORATIONS[slot], id))
    return undefined;
  return (DECORATIONS[slot] as Readonly<Record<string, DecorationDefinition>>)[id];
}
export function isDecorationId<S extends DecorationSlot>(
  slot: S,
  id: unknown,
): id is DecorationId<S> {
  return decorationDefinition(slot, id) !== undefined;
}

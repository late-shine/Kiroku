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
    gold: { name: "Golden brush", visual: "gold", requiredBadge: "first-answer", minVersion: 1 },
    stitch: { name: "Sashiko", visual: "stitch", requiredBadge: "streak-3", minVersion: 1 },
    moss: { name: "Little garden", visual: "moss", requiredBadge: "streak-7", minVersion: 1 },
    double: { name: "Bookplate", visual: "double", requiredBadge: "lessons-10", minVersion: 1 },
    seal: { name: "Personal seal", visual: "seal", requiredBadge: "first-carve", minVersion: 1 },
    orbit: { name: "Moon orbit", visual: "orbit", requiredBadge: "first-mastered", minVersion: 4 },
    petal: { name: "Petal crown", visual: "petal", requiredBadge: "carved-10", minVersion: 4 },
    woven: { name: "Woven paper", visual: "woven", requiredBadge: "hard-one", minVersion: 4 },
    archive: { name: "Archive seal", visual: "archive", requiredBadge: "streak-30", minVersion: 4 },
  },
  border: {
    none: { name: "Plain", visual: "none", minVersion: 4 },
    gilt: { name: "Gilt corners", visual: "gilt", minVersion: 4 },
    stitched: {
      name: "Notebook stitch",
      visual: "stitched",
      requiredBadge: "lessons-10",
      minVersion: 4,
    },
    garden: { name: "Garden margins", visual: "garden", requiredBadge: "streak-7", minVersion: 4 },
    archival: {
      name: "Archive plate",
      visual: "archival",
      requiredBadge: "mastered-20",
      minVersion: 4,
    },
  },
  charm: {
    none: { name: "No detail", visual: "none", minVersion: 4 },
    bookmark: { name: "Folded ribbon", visual: "bookmark", minVersion: 4 },
    moon: { name: "Moon token", visual: "moon", requiredBadge: "first-mastered", minVersion: 4 },
    blossom: { name: "One blossom", visual: "blossom", requiredBadge: "carved-10", minVersion: 4 },
    seal: { name: "Little stamp", visual: "seal", requiredBadge: "first-carve", minVersion: 4 },
  },
  effect: {
    none: { name: "Still", visual: "none", minVersion: 1 },
    vines: {
      name: "Vines",
      visual: "vines",
      requiredBadge: "streak-30",
      minVersion: 1,
      implemented: false,
    },
    petals: {
      name: "Petals",
      visual: "petals",
      requiredBadge: "carved-10",
      minVersion: 1,
      implemented: false,
    },
    fireflies: {
      name: "Fireflies",
      visual: "fireflies",
      requiredBadge: "mastered-20",
      minVersion: 1,
      implemented: false,
    },
    // Reserved for F3h; its motion/unlock packet supplies their implementation.
    glint: { name: "Glint", visual: "glint", minVersion: 4, implemented: false },
    breath: { name: "Breath", visual: "breath", minVersion: 4, implemented: false },
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

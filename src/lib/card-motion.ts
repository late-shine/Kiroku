import type { EffectId } from "./friend-decorations";

/** One ephemeral trigger shared across self/published views; never persisted. */
export type CardEffectRun = {
  token: number;
  effect: EffectId;
  claim: () => boolean;
  wasPlayed: () => boolean;
};
export function cardEffectRun(effect: EffectId, token = 0): CardEffectRun {
  let played = false;
  return {
    token,
    effect,
    wasPlayed: () => played,
    claim: () => {
      if (played) return false;
      played = true;
      return true;
    },
  };
}
export type CardEffectPhase = "static" | "running" | "settled";
export const CARD_EFFECT_DURATION: Readonly<Record<EffectId, number>> = {
  none: 0,
  glint: 5000,
  breath: 16000,
  vines: 1400,
  petals: 12000,
  fireflies: 10000,
};

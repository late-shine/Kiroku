/** Ephemeral activity-thread latch for one selected friend and reader-calendar day. */
export type StudyThreadRun = { claim: () => boolean; wasPlayed: () => boolean };
export function studyThreadRun(): StudyThreadRun {
  let played = false;
  return {
    wasPlayed: () => played,
    claim: () => {
      if (played) return false;
      played = true;
      return true;
    },
  };
}

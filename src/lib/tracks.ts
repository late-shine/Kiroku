export type SpeedMode = "slowed" | "normal" | "sped-up";

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Not every song has all three versions — a missing key means "no file for that speed". */
  versions: Partial<Record<SpeedMode, string>>;
}

export const SPEED_LABELS: Record<SpeedMode, string> = {
  slowed: "Slowed",
  normal: "Normal",
  "sped-up": "Sped Up",
};

export const SPEED_ORDER: SpeedMode[] = ["slowed", "normal", "sped-up"];

export const TRACKS: Track[] = [
  {
    id: "love-story",
    title: "Love Story",
    artist: "Indila",
    versions: {
      slowed: "/audio/love-story-slowed.mp3",
      normal: "/audio/love-story-normal.mp3",
      "sped-up": "/audio/love-story-sped-up.m4a",
    },
  },
  {
    id: "thousand-years",
    title: "A Thousand Years",
    artist: "John Michael Howell, JVKE & ZVC",
    versions: {
      slowed: "/audio/thousand-years-slowed.mp3",
      normal: "/audio/thousand-years-normal.mp3",
      "sped-up": "/audio/thousand-years-sped-up.mp3",
    },
  },
  {
    id: "golden-brown",
    title: "Golden Brown",
    artist: "The Stranglers",
    versions: {
      slowed: "/audio/golden-brown-slowed.m4a",
      normal: "/audio/golden-brown-normal.mp3",
      "sped-up": "/audio/golden-brown-sped-up.mp3",
    },
  },
  {
    id: "last-leaves",
    title: "Last Leaves of Autumn",
    artist: "Zleepyfred",
    versions: {
      slowed: "/audio/last-leaves-slowed.mp3",
      normal: "/audio/last-leaves-normal.mp3",
      "sped-up": "/audio/last-leaves-sped-up.mp3",
    },
  },
  {
    id: "say-yes-to-heaven",
    title: "Say Yes To Heaven",
    artist: "Lana Del Rey",
    versions: {
      slowed: "/audio/say-yes-to-heaven-slowed.mp3",
      normal: "/audio/say-yes-to-heaven-normal.mp3",
      "sped-up": "/audio/say-yes-to-heaven-sped-up.mp3",
    },
  },
  {
    id: "cardigan",
    title: "cardigan",
    artist: "Taylor Swift",
    versions: {
      slowed: "/audio/cardigan-slowed.mp3",
      normal: "/audio/cardigan-normal.mp3",
      "sped-up": "/audio/cardigan-sped-up.mp3",
    },
  },
  {
    id: "death-bed",
    title: "Death Bed",
    artist: "Powfu ft. beabadoobee",
    versions: {
      slowed: "/audio/death-bed-slowed.mp3",
      normal: "/audio/death-bed-normal.mp3", // the nightcore upload — the user's own "normal" for this song
      "sped-up": "/audio/death-bed-sped-up.mp3",
    },
  },
  {
    id: "yume-to-hazakura",
    title: "Yume to Hazakura",
    artist: "Wotamin · Aoki Gekkoh",
    versions: {
      slowed: "/audio/yume-to-hazakura-slowed.mp3",
      normal: "/audio/yume-to-hazakura-normal.mp3", // the nightcore upload — the user's own "normal" for this song
      "sped-up": "/audio/yume-to-hazakura-sped-up.mp3",
    },
  },
];

export function hasVersion(track: Track, mode: SpeedMode): boolean {
  return Boolean(track.versions[mode]);
}

/** Speeds tried, in order, when the wanted one has no file for a track. */
const SPEED_FALLBACK: SpeedMode[] = ["normal", "sped-up", "slowed"];

/** The wanted speed if this track has it, otherwise the closest thing that exists. */
export function resolveSpeed(track: Track, wanted: SpeedMode): SpeedMode {
  if (hasVersion(track, wanted)) return wanted;
  return SPEED_FALLBACK.find((m) => hasVersion(track, m)) ?? wanted;
}

/** Safe indexer — this project builds with noUncheckedIndexedAccess, so plain TRACKS[i] is `Track | undefined`. */
export function trackAt(index: number): Track {
  return TRACKS[index] ?? TRACKS[0]!;
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Key used to track which (trackId, speed) combinations have failed to load. */
export function versionKey(trackId: string, speed: SpeedMode): string {
  return `${trackId}__${speed}`;
}

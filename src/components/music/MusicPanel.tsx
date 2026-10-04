import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { STORAGE_KEYS, migrateLegacyStorage } from "@/lib/storage";
import { SPEED_LABELS, SPEED_ORDER, TRACKS, formatTime, hasVersion, resolveSpeed, trackAt, versionKey, type SpeedMode } from "@/lib/tracks";

const STORAGE_KEY = STORAGE_KEYS.music;

interface StoredSettings {
  trackId: string;
  speedMode: SpeedMode;
  volume: number;
  loopTrack: boolean;
  shuffle: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  trackId: trackAt(0).id,
  speedMode: "normal",
  volume: 0.65,
  loopTrack: true,
  shuffle: false,
};

function loadStoredSettings(): StoredSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  migrateLegacyStorage();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      trackId: TRACKS.some((t) => t.id === parsed.trackId) ? parsed.trackId : DEFAULT_SETTINGS.trackId,
      speedMode: SPEED_ORDER.includes(parsed.speedMode) ? parsed.speedMode : DEFAULT_SETTINGS.speedMode,
      volume: typeof parsed.volume === "number" ? parsed.volume : DEFAULT_SETTINGS.volume,
      loopTrack: typeof parsed.loopTrack === "boolean" ? parsed.loopTrack : DEFAULT_SETTINGS.loopTrack,
      shuffle: typeof parsed.shuffle === "boolean" ? parsed.shuffle : DEFAULT_SETTINGS.shuffle,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function indexOfTrack(trackId: string) {
  const i = TRACKS.findIndex((t) => t.id === trackId);
  return i === -1 ? 0 : i;
}

export function MusicPanel({ expanded, onToggleExpanded }: { expanded: boolean; onToggleExpanded: () => void }) {
  const initial = useRef(loadStoredSettings()).current;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startIndex = indexOfTrack(initial.trackId);
  const startMode = resolveSpeed(trackAt(startIndex), initial.speedMode);
  // The speed the user last picked by hand. `speedMode` below is what's actually playing, which can
  // differ: a song with no file for the preferred speed falls back, and shuffle randomizes it.
  const preferredSpeed = useRef<SpeedMode>(initial.speedMode);

  const [trackIndex, setTrackIndex] = useState(startIndex);
  const [speedMode, setSpeedMode] = useState<SpeedMode>(startMode);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(initial.volume);
  const [isMuted, setIsMuted] = useState(false);
  const [loopTrack, setLoopTrack] = useState(initial.loopTrack);
  const [shuffle, setShuffle] = useState(initial.shuffle);
  const [missing, setMissing] = useState<Set<string>>(new Set());

  const currentTrack = trackAt(trackIndex);

  const loadSrc = useCallback((index: number, mode: SpeedMode, preserveTime: boolean, autoplay: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    const track = trackAt(index);
    const resumeAt = preserveTime ? audio.currentTime : 0;
    const src = track.versions[mode];
    if (!src) return;
    audio.src = src;
    audio.load();
    const onLoaded = () => {
      audio.currentTime = resumeAt;
      if (autoplay) audio.play().catch(() => setIsPlaying(false));
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
  }, []);

  // Mount: restore last track/speed but never autoplay.
  useEffect(() => {
    loadSrc(startIndex, startMode, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextIndex = useCallback(
    (dir: 1 | -1) => {
      if (TRACKS.length <= 1) return trackIndex;
      if (shuffle) {
        let candidate = trackIndex;
        while (candidate === trackIndex) candidate = Math.floor(Math.random() * TRACKS.length);
        return candidate;
      }
      return (trackIndex + dir + TRACKS.length) % TRACKS.length;
    },
    [trackIndex, shuffle],
  );

  // Which speed to load for a track. `randomize` is only true for shuffle-driven moves (skip / auto-advance),
  // never for a track the user tapped on purpose.
  const pickSpeed = useCallback(
    (index: number, randomize: boolean): SpeedMode => {
      const track = trackAt(index);
      if (randomize) {
        const available = SPEED_ORDER.filter((m) => hasVersion(track, m));
        const healthy = available.filter((m) => !missing.has(versionKey(track.id, m)));
        const pool = healthy.length > 0 ? healthy : available;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) return pick;
      }
      return resolveSpeed(track, preferredSpeed.current);
    },
    [missing],
  );

  // Wire up native audio events: position/duration sync, missing-file detection, auto-advance.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onError = () => {
      setMissing((prev) => new Set(prev).add(versionKey(trackAt(trackIndex).id, speedMode)));
      setIsPlaying(false);
      setDuration(0);
    };
    const onEnded = () => {
      const next = nextIndex(1);
      const mode = pickSpeed(next, shuffle);
      setTrackIndex(next);
      setSpeedMode(mode);
      loadSrc(next, mode, false, true);
      setIsPlaying(true);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, [trackIndex, speedMode, shuffle, loadSrc, nextIndex, pickSpeed]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopTrack;
  }, [loopTrack]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Persist preferences only — never playback position, never an "isPlaying" flag (no autoplay on reload).
  useEffect(() => {
    const settings: StoredSettings = { trackId: currentTrack.id, speedMode, volume, loopTrack, shuffle };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [currentTrack.id, speedMode, volume, loopTrack, shuffle]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const selectTrack = (index: number) => {
    if (index === trackIndex) {
      togglePlay();
      return;
    }
    const mode = pickSpeed(index, false);
    setTrackIndex(index);
    setSpeedMode(mode);
    loadSrc(index, mode, false, true);
    setIsPlaying(true);
  };

  const stepTrack = (dir: 1 | -1) => {
    const next = nextIndex(dir);
    const mode = pickSpeed(next, shuffle);
    setTrackIndex(next);
    setSpeedMode(mode);
    loadSrc(next, mode, false, isPlaying);
  };

  const selectSpeed = (mode: SpeedMode) => {
    if (mode === speedMode || !hasVersion(currentTrack, mode)) return;
    preferredSpeed.current = mode;
    setSpeedMode(mode);
    loadSrc(trackIndex, mode, true, isPlaying);
  };

  const handleSeek = (t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentMissing = missing.has(versionKey(currentTrack.id, speedMode));

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <audio ref={audioRef} preload="metadata" />

      {expanded && (
        <div className="absolute bottom-full right-0 mb-2 w-[min(90vw,360px)] max-h-[min(70vh,560px)] overflow-y-auto rounded-lg border border-border bg-glass-strong p-4 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs italic text-primary">音楽 · lo-fi lounge</span>
            <button onClick={onToggleExpanded} aria-label="Collapse music player" title="Collapse" className="rounded-md p-1 text-muted-foreground hover:text-foreground">
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {TRACKS.map((track, idx) => {
              const isActive = idx === trackIndex;
              const brokenHere = missing.has(versionKey(track.id, speedMode));
              return (
                <button
                  key={track.id}
                  onClick={() => selectTrack(idx)}
                  className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                    isActive ? "border-primary/50 bg-primary/15" : "border-border bg-glass hover:bg-accent"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-md border ${
                      isActive ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {isActive && isPlaying ? (
                      <span className="flex h-3 items-end gap-[2px]">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="equalize w-[2px] rounded-full bg-primary" style={{ height: "100%", animationDelay: `${i * 120}ms` }} />
                        ))}
                      </span>
                    ) : (
                      <Music2 className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-xs font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>{track.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {isActive && brokenHere ? "Track file not found" : track.artist}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-1 rounded-md border border-border bg-glass p-1">
            {SPEED_ORDER.map((mode) => {
              const noVersion = !hasVersion(currentTrack, mode);
              const brokenHere = missing.has(versionKey(currentTrack.id, mode));
              return (
                <button
                  key={mode}
                  onClick={() => selectSpeed(mode)}
                  disabled={noVersion}
                  title={noVersion ? `No ${SPEED_LABELS[mode].toLowerCase()} version of this song` : brokenHere ? "Track file not found" : undefined}
                  className={`flex-1 rounded px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    speedMode === mode
                      ? "bg-primary text-primary-foreground"
                      : noVersion
                        ? "cursor-not-allowed text-muted-foreground/40"
                        : brokenHere
                          ? "text-destructive/70"
                          : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {SPEED_LABELS[mode]}
                </button>
              );
            })}
          </div>

          {currentMissing && (
            <p className="mt-2 text-[11px] text-destructive">Track file not found — check public/audio for {currentTrack.versions[speedMode]}.</p>
          )}

          <div className="mt-3 space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-primary"
              style={{ background: `linear-gradient(to right, var(--primary) ${progressPct}%, var(--border) ${progressPct}%)` }}
              aria-label="Seek"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <button onClick={() => stepTrack(-1)} aria-label="Previous track" title="Previous track" className="rounded-full p-2 text-muted-foreground hover:text-primary">
              <SkipBack className="size-4" />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play"}
              className="rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
            </button>
            <button onClick={() => stepTrack(1)} aria-label="Next track" title="Next track" className="rounded-full p-2 text-muted-foreground hover:text-primary">
              <SkipForward className="size-4" />
            </button>
            <button
              onClick={() => setShuffle((v) => !v)}
              aria-label={shuffle ? "Shuffle on — random track and speed" : "Shuffle off"}
              title={shuffle ? "Shuffle on — random track and speed" : "Shuffle off"}
              className={`rounded-full p-2 transition-colors ${shuffle ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Shuffle className="size-4" />
            </button>
            <button
              onClick={() => setLoopTrack((v) => !v)}
              aria-label={loopTrack ? "Looping this track — tap to play through the playlist instead" : "Playing through the playlist — tap to loop this track"}
              title={loopTrack ? "Looping this track" : "Playing through playlist"}
              className={`rounded-full p-2 transition-colors ${loopTrack ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {loopTrack ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <button onClick={() => setIsMuted((m) => !m)} aria-label={isMuted ? "Unmute" : "Mute"} title={isMuted ? "Unmute" : "Mute"} className="shrink-0 p-1.5 text-muted-foreground hover:text-primary">
              {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(parseFloat(e.target.value));
              }}
              className="w-full accent-primary"
              aria-label="Track volume"
            />
          </div>
        </div>
      )}

      {/* Persistent collapsed pill — always visible so playback stays reachable at a glance. */}
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-glass-strong py-1.5 pl-1.5 pr-2 shadow-xl backdrop-blur-lg">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full border ${
            isPlaying ? "border-primary/50 bg-primary/20 text-primary" : "border-border bg-glass text-muted-foreground"
          }`}
        >
          {isPlaying ? (
            <span className="flex h-3 items-end gap-[2px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="equalize w-[2px] rounded-full bg-primary" style={{ height: "100%", animationDelay: `${i * 120}ms` }} />
              ))}
            </span>
          ) : (
            <Music2 className="size-3.5" />
          )}
        </span>
        <button onClick={onToggleExpanded} className="flex min-w-0 max-w-[130px] items-center gap-1.5 text-left" aria-label={expanded ? "Collapse music player" : "Expand music player"}>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-foreground">{currentTrack.title}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {currentMissing ? "File not found" : SPEED_LABELS[speedMode]}
            </span>
          </span>
        </button>
        <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} title={isPlaying ? "Pause" : "Play"} className="shrink-0 rounded-full bg-primary p-1.5 text-primary-foreground transition-transform active:scale-95">
          {isPlaying ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5" />}
        </button>
      </div>
    </div>
  );
}

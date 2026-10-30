/**
 * Phase 19a — the Profile page: a MODE of the shell (like a tab), not a route and not a floating sheet. Opened from the
 * avatar button in the header. Sections: You, At a glance, Account & sync, Your data, Preferences, Danger zone.
 * One column on phones, two from `lg`. It owns no app state: lessons and progress come in as props, the profile
 * (name, avatar, last backup) comes from `useProfile`, the account from the shared account/sync context.
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAccountSync } from "@/components/account/AccountSyncContext";
import { AccountCard } from "@/components/account/AccountCard";
import { Avatar } from "@/components/profile/Avatar";
import { AvatarCropper } from "@/components/profile/AvatarCropper";
import { BackupControls } from "@/components/profile/BackupControls";
import { ResetControl } from "@/components/profile/ResetControl";
import { useProfile } from "@/components/profile/useProfile";
import { AvatarImageError, loadAvatarSource, type AvatarSource } from "@/lib/avatar-image";
import {
  GLYPH_AUTO,
  GLYPH_UPLOAD,
  MAX_NAME_LENGTH,
  PROFILE_GLYPHS,
  avatarFor,
  initialOf,
  resolveName,
} from "@/lib/profile";
import { streak } from "@/lib/study-log";
import { isEmptySnapshot, snapshotOf } from "@/lib/sync";
import { localDay } from "@/lib/word-memory";
import type { DayLesson, UserProgressState } from "@/types/japanese";

const labelClass = "font-display text-xs font-semibold tracking-wider text-primary";

function Section({
  label,
  delay = "0ms",
  className = "",
  children,
}: {
  label: string;
  delay?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`glass-panel pane-in rounded-xl p-5 md:p-6 ${className}`}
      style={{ "--tilt": "0deg", animationDelay: delay } as CSSProperties}
    >
      <span className={labelClass}>{label}</span>
      {children}
    </section>
  );
}

function Stat({
  value,
  label,
  hint,
  onClick,
}: {
  value: number;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={`${value} ${label}. ${hint}`}
      className="rounded-lg border border-border/60 bg-glass/50 p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
    >
      <p className="font-display text-2xl font-medium tracking-tight text-primary tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </button>
  );
}

export function ProfilePage({
  lessons,
  progress,
  setLessons,
  setProgress,
  emptyProgress,
  onRestored,
  onResetAll,
  due,
  mastered,
  onOpenProgress,
  onOpenQuiz,
  onOpenAtmosphere,
  onShowTipsAgain,
  questsOn,
  onSetQuestsOn,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  setLessons: React.Dispatch<React.SetStateAction<DayLesson[]>>;
  setProgress: React.Dispatch<React.SetStateAction<UserProgressState>>;
  emptyProgress: UserProgressState;
  onRestored: (firstDay: number) => void;
  onResetAll: () => void;
  /** Words due for review today, and words mastered (both computed by the shell, the same way the Quiz badge is). */
  due: number;
  mastered: number;
  onOpenProgress: () => void;
  onOpenQuiz: () => void;
  onOpenAtmosphere: () => void;
  /** The shell's `useTips().showAgain`: the shell owns the tip state (a second copy here would not refresh its tip cards). */
  onShowTipsAgain: () => void;
  /** Writing quests Q2: whether Writing practice is on, and the switch that sets it (the shell owns the device-only state). */
  questsOn: boolean;
  onSetQuestsOn: (on: boolean) => void;
}) {
  const { account } = useAccountSync();
  const { profile, setName, setGlyph, setPhoto, removePhoto, markExported } = useProfile();
  const identity = account.auth.status === "in" ? account.auth.account : null;
  const hasData = !isEmptySnapshot(snapshotOf(lessons, progress));

  // The name box keeps what is being typed and saves on Enter or when it loses focus, so a sync isn't started by
  // every keystroke. It follows the stored name when that changes underneath it (a sync brought another one).
  const [draft, setDraft] = useState(profile.name ?? "");
  useEffect(() => {
    setDraft(profile.name ?? "");
  }, [profile.name]);

  const shownName = resolveName(profile, identity);
  const automaticName = resolveName({ name: null }, identity);
  const initial = initialOf(shownName);
  const avatar = avatarFor(profile, identity);
  const autoAvatar = avatarFor({ ...profile, glyph: GLYPH_AUTO }, identity);
  const chosen = profile.glyph ?? GLYPH_AUTO;

  // Phase 19a-2: the uploaded picture. The file is shrunk in the browser first (see src/lib/avatar-image.ts).
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Phase 22: a chosen file is decoded first and shown in the crop panel; only "Use this picture" stores anything.
  // The decoded bitmap is freed whenever it is replaced, dismissed or the page goes away.
  const [cropSource, setCropSource] = useState<AvatarSource | null>(null);
  useEffect(
    () => () => {
      cropSource?.close();
    },
    [cropSource],
  );
  const uploadedAvatar = avatarFor({ ...profile, glyph: GLYPH_UPLOAD }, null);
  const onPickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still counts
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setCropSource(await loadAvatarSource(file));
    } catch (error) {
      setPhotoError(
        error instanceof AvatarImageError
          ? error.message
          : "Couldn't use that picture. Try a different one.",
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const [tipsReset, setTipsReset] = useState(false);
  const lastBackup = profile.lastExportAt
    ? new Date(profile.lastExportAt).toLocaleDateString()
    : null;

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-5 lg:grid-cols-2">
      <Section label="あなた · YOU">
        <div className="mt-5 flex items-center gap-4">
          <Avatar
            avatar={avatar}
            fallbackChar={initial}
            className="size-16 border border-primary/40 bg-primary/10 text-3xl text-primary"
            iconClassName="size-7"
          />
          <div className="min-w-0 flex-1">
            <label htmlFor="profile-name" className="text-xs text-muted-foreground">
              Name
            </label>
            <input
              id="profile-name"
              value={draft}
              maxLength={MAX_NAME_LENGTH}
              placeholder={automaticName}
              autoComplete="off"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => setName(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="mt-1 w-full rounded-lg border border-border/60 bg-glass/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Up to {MAX_NAME_LENGTH} characters. Leave it empty to use your Google name.
        </p>

        <p className="mt-5 text-xs text-muted-foreground">Avatar</p>
        <div role="group" aria-label="Avatar" className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGlyph(GLYPH_AUTO)}
            aria-pressed={chosen === GLYPH_AUTO}
            aria-label="Automatic: your Google photo when signed in, otherwise your initial"
            title="Automatic (Google photo or initial)"
            className={`grid size-10 place-items-center rounded-full border text-base transition-colors ${
              chosen === GLYPH_AUTO
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            <Avatar
              avatar={autoAvatar}
              fallbackChar={initial}
              className="size-8 text-sm"
              iconClassName="size-4"
            />
          </button>
          {profile.photo && uploadedAvatar.kind === "photo" && (
            <button
              type="button"
              onClick={() => setGlyph(GLYPH_UPLOAD)}
              aria-pressed={chosen === GLYPH_UPLOAD}
              aria-label="Your uploaded picture"
              title="Your uploaded picture"
              className={`grid size-10 place-items-center rounded-full border transition-colors ${
                chosen === GLYPH_UPLOAD
                  ? "border-primary bg-primary/15"
                  : "border-border/70 hover:border-primary/50"
              }`}
            >
              <Avatar avatar={uploadedAvatar} fallbackChar={initial} className="size-8" />
            </button>
          )}
          {PROFILE_GLYPHS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGlyph(g.id)}
              aria-pressed={chosen === g.id}
              aria-label={g.label}
              title={g.label}
              lang="ja"
              className={`grid size-10 place-items-center rounded-full border text-lg font-semibold transition-colors ${
                chosen === g.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {g.char}
            </button>
          ))}
        </div>
        {cropSource ? (
          <AvatarCropper
            source={cropSource}
            onSave={(url) => {
              setPhoto(url);
              setCropSource(null);
            }}
            onCancel={() => setCropSource(null)}
          />
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void onPickPhoto(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={photoBusy}
              className="hit-area rounded-md border border-border px-3 py-2 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {photoBusy ? "Preparing…" : profile.photo ? "Change picture" : "Upload a picture"}
            </button>
            {profile.photo && (
              <button
                type="button"
                onClick={() => {
                  setPhotoError(null);
                  removePhoto();
                }}
                className="hit-area rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Remove picture
              </button>
            )}
          </div>
        )}
        {photoError && (
          <p role="alert" className="mt-2 text-[11px] text-destructive">
            {photoError}
          </p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          {account.configured
            ? "Your name, avatar and uploaded picture sync with your Kiroku account (not Google). You choose which part to keep, then it is shrunk to a small square."
            : "You choose which part of a picture to keep, then it is shrunk to a small square and kept on this device."}
        </p>
      </Section>

      <Section label="概要 · AT A GLANCE" delay="60ms">
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <Stat
            value={streak(progress.studyLog, localDay())}
            label="day streak"
            hint="Open your progress"
            onClick={onOpenProgress}
          />
          <Stat value={due} label="due today" hint="Open the quiz" onClick={onOpenQuiz} />
          <Stat
            value={mastered}
            label="mastered"
            hint="Open your progress"
            onClick={onOpenProgress}
          />
        </div>
      </Section>

      <Section label="同期 · ACCOUNT & SYNC" delay="120ms">
        {account.configured ? (
          <AccountCard />
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Sign-in isn&apos;t set up in this build. Everything else on this page still works.
          </p>
        )}
      </Section>

      <Section label="データ · YOUR DATA" delay="180ms">
        <p className="mt-3 text-xs text-muted-foreground">
          Export saves a backup file. Restore replaces your lessons and progress with one.
        </p>
        <div className="mt-4">
          <BackupControls
            lessons={lessons}
            progress={progress}
            setLessons={setLessons}
            setProgress={setProgress}
            onRestored={onRestored}
            canExport={hasData}
            emptyProgress={emptyProgress}
            onExported={markExported}
          />
        </div>
        {lastBackup ? (
          <p className="mt-3 text-[11px] text-muted-foreground">Last backup: {lastBackup}</p>
        ) : (
          hasData && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              No backup made on this device yet.
            </p>
          )
        )}
      </Section>

      <Section label="設定 · PREFERENCES" delay="240ms">
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p id="pref-furigana" className="text-sm">
                Furigana
              </p>
              <p className="text-[11px] text-muted-foreground">
                Show readings above kanji in your lessons.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={progress.showFurigana}
              aria-labelledby="pref-furigana"
              onClick={() => setProgress((p) => ({ ...p, showFurigana: !p.showFurigana }))}
              className={`hit-area relative h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                progress.showFurigana ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`block size-4 rounded-full bg-background shadow transition-transform ${
                  progress.showFurigana ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p id="pref-writing" className="text-sm">
                Writing practice
              </p>
              <p className="text-[11px] text-muted-foreground">
                {
                  "Short pen-and-paper pages for kanji you can read but can't yet write. Off by default."
                }
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={questsOn}
              aria-labelledby="pref-writing"
              onClick={() => onSetQuestsOn(!questsOn)}
              className={`hit-area relative h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors motion-reduce:transition-none ${
                questsOn ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`block size-4 rounded-full bg-background shadow transition-transform motion-reduce:transition-none ${
                  questsOn ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">Tips</p>
              <p className="text-[11px] text-muted-foreground">
                {tipsReset ? "The tips will show again." : "Bring back the tips you dismissed."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onShowTipsAgain();
                setTipsReset(true);
              }}
              className="hit-area shrink-0 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
            >
              Show tips again
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The voice that reads Japanese aloud is chosen in{" "}
            <button
              type="button"
              onClick={onOpenAtmosphere}
              className="underline underline-offset-2 hover:text-primary"
            >
              Atmosphere
            </button>
            .
          </p>
        </div>
      </Section>

      <Section
        label="危険 · DANGER ZONE"
        delay="300ms"
        className="border border-destructive/30 lg:col-span-2"
      >
        <p className="mt-3 text-xs text-muted-foreground">
          Erases every lesson and all progress on this device. Export first if you might want them
          back.
        </p>
        <div className="mt-4">
          <ResetControl onReset={onResetAll} disabled={!hasData} />
        </div>
      </Section>
    </div>
  );
}

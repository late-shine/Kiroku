/**
 * Phase 19a — the Profile page: a MODE of the shell (like a tab), not a route and not a floating sheet. Opened from the
 * avatar button in the header. F3: name card, study summaries, Friends, preferences and a collapsed account group.
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
import { ChevronDown } from "lucide-react";
import { useFriends } from "@/components/friends/useFriends";
import { ProfileCard } from "./ProfileCard";
import { DecorChooser } from "./DecorChooser";
import { BadgeArtDefs } from "./BadgeArt";
import {
  buildFriendPublication,
  friendCardSource,
  publicName,
  publicGlyph,
  type CardScene,
  type FriendDecoration,
  type FriendSettings,
} from "@/lib/friends";
import { AccountCard } from "@/components/account/AccountCard";
import { FriendsPanel } from "@/components/friends/FriendsPanel";
import { Avatar } from "@/components/profile/Avatar";
import { AccentChooser } from "@/components/profile/AccentChooser";
import { AvatarCropper } from "@/components/profile/AvatarCropper";
import { BackupControls } from "@/components/profile/BackupControls";
import { BadgeShelf } from "@/components/profile/BadgeShelf";
import { GeminiKeyControls } from "@/components/profile/GeminiKeyControls";
import { ResetControl } from "@/components/profile/ResetControl";
import { useProfile } from "@/components/profile/useProfile";
import { StampChooser, StampedRankLine } from "@/components/write/RankStamp";
import type { QuestPrefsApi } from "@/components/write/useQuestPrefs";
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
import { withAccent, withStamp } from "@/lib/quest-prefs";
import { streak } from "@/lib/study-log";
import { carvedCount } from "@/lib/writing";
import { isEmptySnapshot, snapshotOf } from "@/lib/sync";
import { localDay } from "@/lib/word-memory";
import type { DayLesson, UserProgressState } from "@/types/japanese";

const DEFAULT_DECO: FriendDecoration = { fr: "plain", fx: "none" };

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
  quests,
  scenes,
}: {
  scenes: readonly CardScene[];
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
  /** Writing quests Q7/Q8: the shell's device-only quest prefs (the rank stamp and the accent colour are read from them and chosen through `update`). */
  quests: Pick<QuestPrefsApi, "prefs" | "update">;
}) {
  const { account, sync } = useAccountSync();
  const friends = useFriends();
  const { profile, setName, setGlyph, setPhoto, removePhoto, markExported } = useProfile();
  const identity = account.auth.status === "in" ? account.auth.account : null;
  const hasData = !isEmptySnapshot(snapshotOf(lessons, progress));

  // The name box keeps what is being typed and saves on Enter or when it loses focus, so a sync isn't started by
  // every keystroke. It follows the stored name when that changes underneath it (a sync brought another one).
  const [draft, setDraft] = useState(profile.name ?? "");
  useEffect(() => {
    setDraft(profile.name ?? "");
  }, [profile.name]);

  const shownName = publicName(profile.name, identity?.displayName ?? null) ?? "Learner";
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

  // Writing quests Q6: the writing card shows while Writing practice is on, or once any badge has been earned (so a fresh
  // app shows no empty trophy case). The rank is writing-only; the shelf lists every badge, including the quiz ones.
  const today = localDay();
  const source = friendCardSource(lessons, progress, profile, quests.prefs, today);
  const hasBadges = Object.keys(source.badges).length > 0;
  const showRewards = questsOn || hasBadges;
  const carved = carvedCount(lessons, progress.writing);

  const [tipsReset, setTipsReset] = useState(false);
  const lastBackup = profile.lastExportAt
    ? new Date(profile.lastExportAt).toLocaleDateString()
    : null;

  const [previewAsFriend, setPreviewAsFriend] = useState(false);
  const [editing, setEditing] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const editor = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (editing) editor.current?.querySelector<HTMLInputElement>("#profile-name")?.focus();
  }, [editing]);
  useEffect(() => {
    setPreviewAsFriend(false);
    setEditing(false);
    setFriendsOpen(false);
    setAccountOpen(false);
  }, [friends.uid]);
  useEffect(() => {
    if (friends.invite) setFriendsOpen(true);
  }, [friends.invite]);
  useEffect(() => {
    if (account.error || sync.notice?.kind === "error") setAccountOpen(true);
  }, [account.error, sync.notice]);
  useEffect(() => {
    if (previewAsFriend) void friends.loadPreviewPhoto();
  }, [previewAsFriend, friends.sharing.card, friends.loadPreviewPhoto]);

  const accountLook = Boolean(
    friends.available && friends.snapshot?.own && !friends.activity.deleting,
  );
  const savedDeco = accountLook ? (friends.sharing.settings?.deco ?? DEFAULT_DECO) : DEFAULT_DECO;
  const mainDeco = accountLook ? savedDeco : (friends.decoDraft ?? DEFAULT_DECO);
  const cardSettings = (deco: FriendDecoration): FriendSettings => ({
    v: 1,
    rev: friends.sharing.settings?.rev ?? "0".repeat(32),
    prev: "",
    on: friends.sharing.settings?.on ?? false,
    photo: false,
    n: publicName(profile.name, identity?.displayName ?? null) ?? "Learner",
    deco,
    ...(friends.sharing.settings?.since ? { since: friends.sharing.settings.since } : {}),
  });
  const selfCard = { ...buildFriendPublication(cardSettings(mainDeco), source).card, t: null };
  const cover = {
    n:
      friends.sharing.settings?.n ??
      publicName(profile.name, identity?.displayName ?? null) ??
      "Learner",
    g: publicGlyph(profile.glyph),
  };
  const publicState = friends.sharing.card;
  const confirmedClosed =
    (friends.sharing.loaded && !friends.sharing.settings?.on) ||
    (friends.snapshot !== null && !friends.snapshot.cached && friends.snapshot.own === null) ||
    (publicState.kind === "closed" && publicState.fetchedAt > 0);
  const previewCard =
    friends.sharing.settings?.on &&
    publicState.kind === "published" &&
    publicState.card.rev === friends.sharing.settings.rev
      ? publicState.card
      : null;
  const previewUnavailable = friends.activity.deleting || (!previewCard && !confirmedClosed);

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <BadgeArtDefs />
      <div className="min-w-0 space-y-4">
        {previewAsFriend ? (
          previewUnavailable ? (
            <article
              aria-label="Friend preview unavailable"
              className="glass-panel-strong rounded-xl p-5 text-sm text-muted-foreground"
            >
              {friends.activity.deleting
                ? "Cloud deletion is in progress."
                : publicState.kind === "unsupported"
                  ? "Update the app to view this card."
                  : "The friend view is not confirmed. Refresh Friends to check your published card."}
            </article>
          ) : (
            <ProfileCard
              mode="friend"
              data={previewCard}
              cover={cover}
              scenes={scenes}
              photo={friends.previewPhoto}
              renderDefs={false}
            />
          )
        ) : (
          <ProfileCard
            mode="self"
            data={selfCard}
            cover={cover}
            scenes={scenes}
            privateAvatar={avatar}
            onEdit={() => setEditing(true)}
            onStat={() => onOpenProgress()}
            sharing={Boolean(friends.sharing.settings?.on && friends.sharing.loaded)}
            draft={Boolean(!accountLook && friends.decoDraft)}
            renderDefs={false}
          />
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            role="switch"
            className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
            checked={previewAsFriend}
            disabled={!friends.available}
            onChange={(event) => setPreviewAsFriend(event.target.checked)}
          />
          <span>Preview as friend</span>
        </label>
        {previewAsFriend && (
          <p className="text-xs text-muted-foreground">
            Last confirmed friend view. Draft changes are not shown here.
          </p>
        )}
        {!friends.available && (
          <p className="text-xs text-muted-foreground">
            Sign in with sync configured to preview your saved friend card. Signing out does not
            hide a previously shared card.
          </p>
        )}
        <details
          ref={editor}
          open={editing}
          onToggle={(event) => setEditing(event.currentTarget.open)}
          className="group min-w-0"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            Name and avatar
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
          </summary>
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
        </details>
        {hasBadges && (
          <details className="group min-w-0 rounded-xl border border-border bg-glass/40 p-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              Customise
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
            </summary>
            <DecorChooser
              key={`${friends.uid ?? "local"}:${friends.activity.deleting ? "deleting" : "active"}`}
              saved={savedDeco}
              localDraft={friends.decoDraft}
              revision={friends.sharing.settings?.rev ?? null}
              loaded={!accountLook || friends.sharing.loaded}
              accountMode={accountLook}
              disabled={friends.activity.busy || friends.activity.deleting}
              scenes={scenes}
              badges={source.badges}
              onDraft={friends.setDecoDraft}
              onSave={(deco, revision) => friends.saveSharing({ deco }, revision)}
              renderPreview={(deco) => {
                const publication = buildFriendPublication(
                  {
                    ...cardSettings(deco),
                    n: friends.sharing.settings?.n ?? cover.n,
                    photo: friends.sharing.settings?.photo ?? false,
                  },
                  source,
                );
                return (
                  <ProfileCard
                    mode="friend"
                    data={{ ...publication.card, t: null }}
                    cover={cover}
                    scenes={scenes}
                    photo={publication.photo}
                    draft
                    renderDefs={false}
                  />
                );
              }}
            />
          </details>
        )}
      </div>
      <div className="min-w-0 space-y-5">
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
        {showRewards && (
          <Section label={questsOn ? "書く · WRITING" : "バッジ · BADGES"} delay="90ms">
            {questsOn && (
              <StampedRankLine carved={carved} saved={quests.prefs.stamp} className="mt-4" />
            )}
            <BadgeShelf
              includeDefs={false}
              badges={progress.badges}
              today={today}
              className="mt-5"
            />
          </Section>
        )}
      </div>
      {friends.available && (
        <details
          open={friendsOpen}
          onToggle={(event) => setFriendsOpen(event.currentTarget.open)}
          className="group glass-panel min-w-0 rounded-xl lg:col-span-2"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-5 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <span>
              <span className="block font-display text-base">Friends and sharing</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {friends.sharing.loaded
                  ? friends.sharing.settings?.on
                    ? "Sharing on"
                    : "Friends · Off. Study alongside someone you know."
                  : "Study alongside someone you know. Review your saved sharing choice."}
              </span>
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
          </summary>
          <FriendsPanel />
        </details>
      )}
      <div className="min-w-0 lg:col-span-2">
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
            {questsOn && (
              <StampChooser
                carved={carved}
                saved={quests.prefs.stamp}
                onChoose={(stamp) => quests.update((p) => withStamp(p, stamp))}
              />
            )}
            {showRewards && (
              <AccentChooser
                badges={progress.badges}
                saved={quests.prefs.accent}
                onChoose={(accent) => quests.update((p) => withAccent(p, accent))}
              />
            )}
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
      </div>
      <details
        open={accountOpen}
        onToggle={(event) => setAccountOpen(event.currentTarget.open)}
        className="group glass-panel min-w-0 rounded-xl lg:col-span-2"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-5 font-display text-base focus-visible:outline-2 focus-visible:outline-ring">
          Account, keys and data
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" />
        </summary>
        <div className="grid min-w-0 items-start gap-5 p-4 pt-0 lg:grid-cols-2">
          <Section label="同期 · ACCOUNT & SYNC" delay="120ms">
            {account.configured ? (
              <>
                <AccountCard />
                {identity && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Signing out doesn&apos;t hide your card. Turn sharing off first.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Sign-in isn&apos;t set up in this build. Everything else on this page still works.
              </p>
            )}
          </Section>
          <Section label="鍵 · GEMINI KEY" delay="150ms">
            <GeminiKeyControls />
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
          <Section
            label="危険 · DANGER ZONE"
            delay="300ms"
            className="border border-destructive/30 lg:col-span-2"
          >
            <p className="mt-3 text-xs text-muted-foreground">
              Erases every lesson and all progress on this device. Export first if you might want
              them back.
            </p>
            <div className="mt-4">
              <ResetControl onReset={onResetAll} disabled={!hasData} />
            </div>
          </Section>
        </div>
      </details>
    </div>
  );
}

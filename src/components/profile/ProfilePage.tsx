/**
 * Phase 19a — the Profile page: a MODE of the shell (like a tab), not a route and not a floating sheet. Opened from the
 * avatar button in the header. F3 redesign: live card studio and a separate Desk & Account view.
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
import { ArrowUpRight, BookOpen, ChevronDown, Settings2, Users } from "lucide-react";
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
} from "@/lib/profile";
import { withAccent, withStamp } from "@/lib/quest-prefs";
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
      className={`studio-panel rounded-2xl p-5 md:p-6 ${className}`}
      style={{ "--tilt": "0deg", animationDelay: delay } as CSSProperties}
    >
      <span className={labelClass}>{label}</span>
      {children}
    </section>
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
  const automaticName = publicName(null, identity?.displayName ?? null) ?? "Your name";
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
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<"card" | "desk">("card");
  const sharingSection = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    setPreviewAsFriend(false);
    setFriendsOpen(false);
    setProfileTab("card");
  }, [friends.uid]);
  useEffect(() => {
    if (friends.invite) {
      setFriendsOpen(true);
      setProfileTab("card");
    }
  }, [friends.invite]);
  useEffect(() => {
    if (account.error || sync.notice?.kind === "error") setProfileTab("desk");
  }, [account.error, sync.notice]);
  useEffect(() => {
    if (previewAsFriend) void friends.loadPreviewPhoto();
  }, [previewAsFriend, friends.sharing.card, friends.loadPreviewPhoto]);

  const accountLook = Boolean(
    friends.available && friends.snapshot?.own && !friends.activity.deleting,
  );
  const savedDeco = accountLook ? (friends.sharing.settings?.deco ?? DEFAULT_DECO) : DEFAULT_DECO;
  const cardSettings = (deco: FriendDecoration): FriendSettings => ({
    v: 1,
    rev: friends.sharing.settings?.rev ?? "0".repeat(32),
    prev: "",
    on: friends.sharing.settings?.on ?? false,
    photo: false,
    n: publicName(draft, identity?.displayName ?? null) ?? "Learner",
    deco,
    ...(friends.sharing.settings?.since ? { since: friends.sharing.settings.since } : {}),
  });
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

  const openSharing = () => {
    setFriendsOpen(true);
    setProfileTab("card");
    requestAnimationFrame(() => sharingSection.current?.scrollIntoView({ block: "start" }));
  };
  const friendPreview = previewUnavailable ? (
    <article
      aria-label="Friend preview unavailable"
      className="studio-panel rounded-2xl p-6 text-sm text-muted-foreground"
    >
      {friends.activity.deleting
        ? "Cloud deletion is in progress."
        : publicState.kind === "unsupported"
          ? "Update the app to view this card."
          : "Your published card isn't confirmed yet."}
      <button type="button" className="studio-text-button mt-3 block" onClick={openSharing}>
        Open Friends & sharing
      </button>
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
  );

  return (
    <div className="profile-workspace mx-auto max-w-6xl">
      <BadgeArtDefs />
      <header className="profile-workspace-heading">
        <div>
          <p className="studio-eyebrow">記録 · A notebook of your own</p>
          <h1 className="font-display text-2xl sm:text-3xl">Your corner of Kiroku</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A little personality. A record of your progress.
          </p>
        </div>
        <div className="profile-workspace-tabs" role="tablist" aria-label="Profile sections">
          {(
            [
              ["card", "Calling Card", BookOpen],
              ["desk", "Desk & Account", Settings2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              id={`profile-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={profileTab === id}
              aria-controls={`profile-panel-${id}`}
              tabIndex={profileTab === id ? 0 : -1}
              onClick={() => setProfileTab(id)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "card"
                    : event.key === "End"
                      ? "desk"
                      : id === "card"
                        ? "desk"
                        : "card";
                setProfileTab(next);
                document.getElementById(`profile-tab-${next}`)?.focus();
              }}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div
        id="profile-panel-card"
        role="tabpanel"
        aria-labelledby="profile-tab-card"
        hidden={profileTab !== "card"}
      >
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
          previewAsFriend={previewAsFriend}
          onPreviewChange={setPreviewAsFriend}
          previewAvailable={friends.available}
          friendPreview={friendPreview}
          saveError={friends.sharing.error ?? friends.error}
          onManageSharing={openSharing}
          renderPreview={(deco, dirty) => {
            const publication = buildFriendPublication(cardSettings(deco), source);
            const liveName = publication.card.n;
            return (
              <ProfileCard
                mode="self"
                data={{ ...publication.card, t: null }}
                cover={cover}
                scenes={scenes}
                privateAvatar={
                  avatar.kind === "initial"
                    ? { kind: "initial", char: initialOf(liveName) }
                    : avatar
                }
                onStat={() => onOpenProgress()}
                sharing={Boolean(friends.sharing.settings?.on && friends.sharing.loaded)}
                draft={accountLook && dirty}
                renderDefs={false}
              />
            );
          }}
          identityEditor={
            <div className="studio-identity-editor">
              <div className="flex items-center gap-4">
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
                    className="mt-1 w-full rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Name saves when you leave the field. Leave it empty to use your Google name.
              </p>

              <p className="mt-5 text-xs text-muted-foreground">Avatar</p>
              <div role="group" aria-label="Avatar" className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setGlyph(GLYPH_AUTO)}
                  aria-pressed={chosen === GLYPH_AUTO}
                  aria-label="Automatic: your Google photo when signed in, otherwise your initial"
                  title="Automatic (Google photo or initial)"
                  className={`grid size-11 place-items-center rounded-full border text-base transition-colors ${
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
                    className={`grid size-11 place-items-center rounded-full border transition-colors ${
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
                    className={`grid size-11 place-items-center rounded-full border text-lg font-semibold transition-colors ${
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
                    {photoBusy
                      ? "Preparing…"
                      : profile.photo
                        ? "Change picture"
                        : "Upload a picture"}
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
                  ? "Name and avatar save separately from your look. Your uploaded picture is shared with friends only if you choose to share it."
                  : "Name and avatar are saved on this device. You choose the crop before saving a picture."}
              </p>
            </div>
          }
        />

        {friends.available && (
          <details
            ref={sharingSection}
            open={friendsOpen}
            onToggle={(event) => setFriendsOpen(event.currentTarget.open)}
            className="profile-sharing-section studio-panel group mt-6 rounded-2xl"
          >
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-5 focus-visible:outline-2 focus-visible:outline-ring">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-primary">
                <Users aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm">Friends & sharing</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {friends.sharing.loaded
                    ? friends.sharing.settings?.on
                      ? "Your card is shared with accepted friends."
                      : "Your progress stays private until you choose to share."
                    : "Choose who studies alongside you."}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground group-open:rotate-180"
              />
            </summary>
            <FriendsPanel />
          </details>
        )}

        <section
          className="studio-panel mt-6 rounded-2xl p-5 md:p-6"
          aria-label="Your study notebook"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="studio-eyebrow">One page at a time</p>
              <h2 className="font-display text-lg">Your notebook</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="studio-button studio-button-quiet"
                onClick={onOpenQuiz}
              >
                {due > 0 ? `${due} words to revisit` : "Practice a few words"}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </button>
              <button
                type="button"
                className="studio-button studio-button-quiet"
                onClick={onOpenProgress}
              >
                View progress
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          </div>
          {questsOn && (
            <StampedRankLine carved={carved} saved={quests.prefs.stamp} className="mt-5" />
          )}
          {showRewards && (
            <details className="studio-achievements mt-5">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
                <span>Your badge collection</span>
                <span className="text-xs text-muted-foreground">
                  {Object.keys(source.badges).length} earned
                </span>
              </summary>
              <BadgeShelf
                includeDefs={false}
                badges={progress.badges}
                today={today}
                className="mt-4"
              />
            </details>
          )}
        </section>
      </div>

      {profileTab === "desk" && (
        <div
          id="profile-panel-desk"
          role="tabpanel"
          aria-labelledby="profile-tab-desk"
          className="profile-desk-grid"
        >
          <div className="min-w-0">
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
                      {tipsReset
                        ? "The tips will show again."
                        : "Bring back the tips you dismissed."}
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
          <div className="grid min-w-0 items-start gap-5">
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
              className="border border-destructive/30"
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
        </div>
      )}
    </div>
  );
}

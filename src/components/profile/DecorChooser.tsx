import { useEffect, useRef, useState, type ReactNode } from "react";
import { Award, Check, ChevronDown, ChevronUp, Eye, Lock, Palette, UserRound } from "lucide-react";
import { BADGES } from "@/lib/rewards";
import {
  FRIEND_FRAMES,
  FRIEND_TAGS,
  FRIEND_STATUSES,
  FRIEND_STATUS_LABELS,
  FRIEND_TAG_LABELS,
  FRAME_BADGES,
  decorationUnlocked,
  resolveDeco,
  type CardScene,
  type FriendDecoration,
} from "@/lib/friends";
import { Frame } from "./Frame";
import { BadgeArt } from "./BadgeArt";
import { formatDay } from "./BadgeShelf";

const DEFAULT: FriendDecoration = { fr: "plain", fx: "none" };
const FRAME_NAMES: Record<FriendDecoration["fr"], string> = {
  plain: "Quiet ink",
  gold: "Golden brush",
  stitch: "Sashiko",
  moss: "Little garden",
  double: "Bookplate",
  seal: "Personal seal",
};
const PANELS = [
  { id: "about", label: "About", icon: UserRound },
  { id: "style", label: "Style", icon: Palette },
  { id: "badges", label: "Badges", icon: Award },
] as const;
type Panel = (typeof PANELS)[number]["id"];

/**
 * One live preview, one editor with About / Style / Badges sections. Existing draft and revisioned-save ownership is
 * preserved. This component stays mounted while the Profile switches between Calling Card and Desk & Account, so the
 * draft, the captured settings revision and the open crop editor all survive that switch.
 */
export function DecorChooser({
  saved,
  localDraft,
  revision,
  loaded,
  accountMode,
  disabled,
  scenes,
  badges,
  today,
  onDraft,
  onSave,
  renderPreview,
  identityEditor,
  rankLine,
  cardLinks,
  cropActive,
  previewAsFriend,
  onPreviewChange,
  friendPreview,
  previewAvailable,
  saveError,
  onManageSharing,
}: {
  saved: FriendDecoration;
  localDraft: FriendDecoration | null;
  revision: string | null;
  loaded: boolean;
  accountMode: boolean;
  disabled: boolean;
  scenes: readonly CardScene[];
  badges: Readonly<Record<string, string>>;
  /** Local day (YYYY-MM-DD), used only to word the "Earned <date>" captions. */
  today: string;
  onDraft: (value: FriendDecoration | null) => unknown;
  onSave: (value: FriendDecoration, revision: string | null) => Promise<boolean>;
  renderPreview: (value: FriendDecoration, dirty: boolean) => ReactNode;
  identityEditor: ReactNode;
  /** The writing rank line (null while Writing practice is off); shown at the top of Badges. */
  rankLine: ReactNode;
  /** Two small shortcut links drawn below the card. */
  cardLinks: ReactNode;
  /** True while the avatar crop editor is open: the preview then stops being sticky. */
  cropActive: boolean;
  previewAsFriend: boolean;
  onPreviewChange: (value: boolean) => void;
  friendPreview: ReactNode;
  previewAvailable: boolean;
  saveError: string | null;
  onManageSharing: () => void;
}) {
  const [panel, setPanel] = useState<Panel>("about");
  // The entry animation replays on a section only after the learner has switched sections, so the first section does
  // not animate twice (the whole panel already rose in). A choice inside a section never changes its class or display.
  const [sectionsAnimate, setSectionsAnimate] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(localDraft ?? saved);
  const [dirty, setDirty] = useState(localDraft !== null);
  const [baseRevision, setBaseRevision] = useState(revision);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const hasBase = useRef(loaded);
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  const savedKey = JSON.stringify(saved);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!loaded) return;
    if (!hasBase.current || !dirty) {
      hasBase.current = true;
      setBaseRevision(revision);
      if (!dirty) setDraft(JSON.parse(savedKey) as FriendDecoration);
    }
    if (accountMode && draftKey === savedKey && dirty) {
      setDirty(false);
      setBaseRevision(revision);
      onDraftRef.current(null);
    }
  }, [revision, loaded, savedKey, draftKey, dirty, accountMode]);
  const resolved = resolveDeco(draft, badges);
  const changedElsewhere = accountMode && loaded && dirty && revision !== baseRevision;
  const selectedPins = resolved.pin?.split(",") ?? [];
  const sectionClass = sectionsAnimate ? "pane-in" : undefined;
  const stateText = previewAsFriend
    ? "As your friends see it"
    : !accountMode
      ? "Kept on this device"
      : saving
        ? "Saving…"
        : dirty
          ? "Unsaved changes"
          : "Saved";
  const earned = BADGES.filter((badge) => Boolean(badges[badge.id]));
  const lockedBadges = BADGES.filter((badge) => !badges[badge.id]);
  const change = (next: FriendDecoration) => {
    if (disabled || saving) return;
    setDraft(next);
    setDirty(true);
    setNotice(null);
    onPreviewChange(false);
    onDraft(next);
  };
  const discard = () => {
    setDraft(saved);
    setDirty(false);
    setBaseRevision(revision);
    onDraft(null);
    onPreviewChange(false);
    setNotice(accountMode ? "Back to your saved look." : "Back to the original look.");
  };
  return (
    <div className="card-studio">
      <div className="card-studio-side">
        <aside
          className="card-studio-preview glass-panel pane-in rounded-2xl"
          aria-label="Card preview"
          data-expanded={expanded}
          data-crop={cropActive}
        >
          <div className="studio-preview-bar">
            <div className="studio-preview-heading">
              <span className="studio-eyebrow">
                {previewAsFriend ? "Published view" : "Your calling card"}
              </span>
              <span className="studio-preview-state" role="status">
                {stateText}
              </span>
            </div>
            <div className="studio-preview-tools">
              <label className="studio-preview-switch">
                <Eye aria-hidden="true" className="size-3.5" />
                <span>Friend view</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={previewAsFriend}
                  disabled={!previewAvailable}
                  onChange={(event) => onPreviewChange(event.target.checked)}
                  aria-label="Preview the last confirmed card your friends see"
                />
              </label>
              <button
                type="button"
                className="studio-preview-toggle"
                aria-expanded={expanded}
                aria-controls="studio-card-preview"
                aria-label={expanded ? "Show the compact card" : "Show the full card"}
                title={expanded ? "Show the compact card" : "Show the full card"}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? (
                  <ChevronUp aria-hidden="true" className="size-4" />
                ) : (
                  <ChevronDown aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div id="studio-card-preview">
            {previewAsFriend ? friendPreview : renderPreview(draft, dirty)}
          </div>
        </aside>
        {cardLinks && (
          <nav
            className="card-studio-links glass-panel pane-in rounded-xl"
            style={{ animationDelay: "60ms" }}
            aria-label="Study shortcuts"
          >
            {cardLinks}
          </nav>
        )}
      </div>

      <section
        className="card-studio-editor glass-panel-strong pane-in rounded-2xl"
        style={{ animationDelay: "90ms" }}
        aria-label="Edit your card"
      >
        <div className="studio-section-picker" role="group" aria-label="Card editor section">
          {PANELS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={panel === id}
              aria-controls={`studio-section-${id}`}
              onClick={() => {
                setPanel(id);
                setSectionsAnimate(true);
                onPreviewChange(false);
              }}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <div
          className="studio-editor-content"
          onFocusCapture={() => {
            if (previewAsFriend) onPreviewChange(false);
          }}
        >
          <div id="studio-section-about" hidden={panel !== "about"} className={sectionClass}>
            {identityEditor}
            <fieldset disabled={disabled || saving} className="studio-fieldset">
              <legend className="studio-field-label">Study tag</legend>
              <p className="studio-field-hint">A small hint of what you are learning.</p>
              <div className="studio-chip-row" role="group" aria-label="Study tag">
                <button
                  type="button"
                  className="studio-chip"
                  aria-pressed={!draft.tg}
                  onClick={() => {
                    const { tg: _old, ...rest } = draft;
                    change(rest);
                  }}
                >
                  None
                </button>
                {FRIEND_TAGS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="studio-chip"
                    aria-pressed={draft.tg === id}
                    onClick={() => change({ ...draft, tg: id })}
                  >
                    {FRIEND_TAG_LABELS[id]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={disabled || saving} className="studio-fieldset">
              <legend className="studio-field-label">Status</legend>
              <p className="studio-field-hint">A quiet note on your card.</p>
              <div className="studio-status-options" role="group" aria-label="Card status">
                <button
                  type="button"
                  className="studio-status"
                  aria-pressed={!draft.sb}
                  onClick={() => {
                    const { sb: _old, ...rest } = draft;
                    change(rest);
                  }}
                >
                  No status<span aria-hidden="true">—</span>
                </button>
                {FRIEND_STATUSES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="studio-status"
                    aria-pressed={draft.sb === id}
                    onClick={() => change({ ...draft, sb: id })}
                  >
                    {FRIEND_STATUS_LABELS[id]}
                    {draft.sb === id && <Check aria-hidden="true" className="size-4 shrink-0" />}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div id="studio-section-style" hidden={panel !== "style"} className={sectionClass}>
            <fieldset disabled={disabled || saving} className="studio-fieldset">
              <legend className="studio-field-label">Banner</legend>
              <p className="studio-field-hint">A little atmosphere behind your name.</p>
              <div className="studio-scene-grid">
                <button
                  type="button"
                  className="studio-scene studio-scene-ink"
                  aria-pressed={draft.bk === undefined}
                  onClick={() => {
                    const { bk: _old, ...rest } = draft;
                    change(rest);
                  }}
                >
                  <span aria-hidden="true" className="studio-ink-mark">
                    記
                  </span>
                  <span className="studio-scene-name">Quiet ink</span>
                  {draft.bk === undefined && (
                    <span className="studio-choice-check">
                      <Check aria-hidden="true" className="size-3" />
                    </span>
                  )}
                </button>
                {scenes.slice(0, 4).map((scene, index) => (
                  <button
                    key={scene.name}
                    type="button"
                    className="studio-scene"
                    aria-pressed={draft.bk === index}
                    onClick={() => change({ ...draft, bk: index })}
                  >
                    <img src={scene.url} alt="" loading="lazy" />
                    <span className="studio-scene-name">{scene.name}</span>
                    {draft.bk === index && (
                      <span className="studio-choice-check">
                        <Check aria-hidden="true" className="size-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={disabled || saving} className="studio-fieldset">
              <legend className="studio-field-label">Frame</legend>
              <p className="studio-field-hint">Frames are earned along the way.</p>
              <div className="studio-frame-grid">
                {FRIEND_FRAMES.map((id) => {
                  const locked = !decorationUnlocked("frame", id, badges);
                  const badge = BADGES.find((item) => item.id === FRAME_BADGES[id]);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="studio-frame-choice"
                      aria-disabled={locked}
                      aria-pressed={resolved.fr === id}
                      title={locked && badge ? `${badge.name}: ${badge.how}` : FRAME_NAMES[id]}
                      aria-label={`${FRAME_NAMES[id]}${locked && badge ? `. Locked. ${badge.how}` : ""}`}
                      onClick={() => {
                        if (!locked) change({ ...draft, fr: id });
                      }}
                    >
                      <Frame frame={id}>
                        <span aria-hidden="true" className="profile-avatar studio-frame-sample">
                          記
                        </span>
                      </Frame>
                      <span className="studio-choice-name">{FRAME_NAMES[id]}</span>
                      <span className="studio-choice-caption">
                        {locked ? (
                          <>
                            <Lock aria-hidden="true" className="size-3" />
                            {badge?.name ?? "Locked"}
                          </>
                        ) : resolved.fr === id ? (
                          <>
                            <Check aria-hidden="true" className="size-3" />
                            Selected
                          </>
                        ) : (
                          "Available"
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div id="studio-section-badges" hidden={panel !== "badges"} className={sectionClass}>
            {rankLine && <div className="studio-rank-block">{rankLine}</div>}
            <fieldset disabled={disabled || saving} className="studio-fieldset">
              <legend className="studio-field-label">Pinned badges</legend>
              <p className="studio-field-hint">
                Pin up to three badges. Select a pinned badge to remove it.
              </p>
              <div
                className="studio-pin-slots"
                aria-label={`${selectedPins.length} of 3 badges pinned`}
              >
                {[0, 1, 2].map((index) => {
                  const id = selectedPins[index];
                  return (
                    <span key={index} className="studio-pin-slot" aria-hidden="true">
                      {id ? <BadgeArt id={id} className="size-9" /> : <span>＋</span>}
                    </span>
                  );
                })}
              </div>
              {earned.length === 0 && (
                <p className="studio-empty-note">
                  Your first badge will find a home here. Keep studying at your own pace.
                </p>
              )}
              <div className="studio-badge-grid">
                {earned.map((badge) => {
                  const selected = selectedPins.includes(badge.id);
                  const full = selectedPins.length >= 3 && !selected;
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      className="studio-badge-choice"
                      aria-pressed={selected}
                      aria-disabled={full}
                      title={full ? "Unpin another badge to make room." : `${badge.how} Select to pin.`}
                      onClick={() => {
                        if (full) return;
                        const next = selected
                          ? selectedPins.filter((id) => id !== badge.id)
                          : [...selectedPins, badge.id];
                        const { pin: _old, ...rest } = draft;
                        change(next.length ? { ...rest, pin: next.join(",") } : rest);
                      }}
                    >
                      <BadgeArt id={badge.id} className="size-12 shrink-0" />
                      <span className="studio-choice-name">{badge.name}</span>
                      <span className="studio-choice-caption">
                        {selected
                          ? "Pinned"
                          : full
                            ? "All three places filled"
                            : `Earned ${formatDay(badges[badge.id] ?? today, today)}`}
                      </span>
                      {selected && (
                        <Check aria-hidden="true" className="studio-badge-tick size-4" />
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {lockedBadges.length > 0 && (
              <details className="studio-unlock-list">
                <summary>
                  Still to discover <span>{lockedBadges.length}</span>
                </summary>
                <ul>
                  {lockedBadges.map((badge) => (
                    <li key={badge.id}>
                      <BadgeArt id={badge.id} className="size-8 shrink-0 opacity-40 grayscale" />
                      <span>
                        <span className="block text-sm">{badge.name}</span>
                        <span className="text-xs text-muted-foreground">{badge.how}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        <footer className="studio-savebar">
          {changedElsewhere && (
            <div className="studio-inline-message">
              <p>Your saved look changed on another device.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {FRAME_NAMES[saved.fr]} ·{" "}
                {saved.bk === undefined ? "Quiet ink" : (scenes[saved.bk]?.name ?? "Quiet ink")}
                {saved.tg ? ` · ${FRIEND_TAG_LABELS[saved.tg]}` : ""}
                {saved.sb ? ` · ${FRIEND_STATUS_LABELS[saved.sb]}` : ""}
              </p>
              <button
                type="button"
                className="studio-text-button"
                disabled={disabled || saving}
                onClick={() => {
                  setBaseRevision(revision);
                  setNotice("Draft kept. Save to apply it to the current look.");
                }}
              >
                Keep my draft instead
              </button>
            </div>
          )}
          {saveError && (
            <p role="alert" className="studio-inline-message text-destructive">
              {saveError}
            </p>
          )}
          <div className="studio-savebar-row">
            <p className="studio-savebar-hint">
              {accountMode
                ? "Saving your look does not turn sharing on."
                : "Your look stays on this device. Sharing is a separate choice."}
            </p>
            {dirty && (
              <button
                type="button"
                className="studio-button studio-button-quiet"
                disabled={disabled || saving}
                onClick={discard}
              >
                {accountMode ? "Discard" : "Reset look"}
              </button>
            )}
            {accountMode && (
              <button
                type="button"
                className="studio-button studio-button-primary"
                disabled={disabled || saving || !loaded || !dirty || changedElsewhere}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const ok = await onSave(draft, baseRevision);
                    if (ok) {
                      setDirty(false);
                      onDraft(null);
                      setNotice(null);
                    } else
                      setNotice(
                        "Couldn't save your look. Your draft is kept here. Check Friends & sharing, then try again.",
                      );
                  } catch {
                    setNotice(
                      "Couldn't save your look. Your draft is kept on this device. Try again in a moment.",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving…" : "Save look"}
              </button>
            )}
          </div>
          {accountMode && !loaded && (
            <p className="mt-2 text-xs text-muted-foreground">
              Reconnect and refresh your sharing settings to save this look.
            </p>
          )}
          {notice && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {notice}
            </p>
          )}
          {(saveError || (accountMode && !loaded)) && (
            <button type="button" className="studio-text-button" onClick={onManageSharing}>
              Open Friends & sharing
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

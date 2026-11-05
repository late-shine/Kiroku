import { useEffect, useRef, useState, type ReactNode } from "react";
import { BADGES } from "@/lib/rewards";
import {
  FRIEND_FRAMES,
  FRIEND_EFFECTS,
  FRIEND_TAGS,
  FRIEND_STATUSES,
  FRIEND_STATUS_LABELS,
  FRIEND_TAG_LABELS,
  FRAME_BADGES,
  EFFECT_BADGES,
  decorationUnlocked,
  resolveDeco,
  type CardScene,
  type FriendDecoration,
} from "@/lib/friends";
import { Frame } from "./Frame";
import { BadgeArt } from "./BadgeArt";

const control =
  "min-h-11 rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";
const DEFAULT: FriendDecoration = { fr: "plain", fx: "none" };

export function DecorChooser({
  saved,
  localDraft,
  revision,
  loaded,
  accountMode,
  disabled,
  scenes,
  badges,
  onDraft,
  onSave,
  renderPreview,
}: {
  saved: FriendDecoration;
  localDraft: FriendDecoration | null;
  revision: string | null;
  loaded: boolean;
  accountMode: boolean;
  disabled: boolean;
  scenes: readonly CardScene[];
  badges: Readonly<Record<string, string>>;
  onDraft: (value: FriendDecoration | null) => unknown;
  onSave: (value: FriendDecoration, revision: string | null) => Promise<boolean>;
  renderPreview: (value: FriendDecoration) => ReactNode;
}) {
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
  const change = (next: FriendDecoration) => {
    if (disabled || saving) return;
    setDraft(next);
    setDirty(true);
    setNotice(null);
    onDraft(next);
  };
  const requirement = (id: string, effect = false) => {
    const badge = BADGES.find(
      (item) => item.id === (effect ? EFFECT_BADGES[id] : FRAME_BADGES[id]),
    );
    return badge ? `Earn “${badge.name}”. ${badge.how}` : "Always available";
  };
  return (
    <div className="mt-4 min-w-0 space-y-5">
      <p className="text-xs text-muted-foreground">
        Earned frames and pins only. A saved locked choice is kept and displays its default until
        its badge is available again.
      </p>
      <fieldset disabled={disabled || saving} className="min-w-0">
        <legend className="text-sm font-medium">Avatar frame</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {FRIEND_FRAMES.map((id) => {
            const locked = !decorationUnlocked("frame", id, badges);
            return (
              <button
                key={id}
                type="button"
                aria-disabled={locked}
                aria-pressed={resolved.fr === id}
                className={`${control} flex flex-col items-start gap-2 text-left ${resolved.fr === id ? "border-primary/50 bg-primary/10" : "bg-glass/40"}`}
                onClick={() => {
                  if (!locked) change({ ...draft, fr: id });
                }}
              >
                <Frame frame={id}>
                  <span
                    aria-hidden="true"
                    className="profile-avatar grid size-8 place-items-center rounded-full bg-secondary text-primary"
                  >
                    記
                  </span>
                </Frame>
                <span className="capitalize">
                  {id}
                  {resolved.fr === id ? " · In use" : ""}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {locked ? `Locked. ${requirement(id)}` : requirement(id)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset disabled={disabled || saving} className="min-w-0">
        <legend className="text-sm font-medium">Banner</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={draft.bk === undefined}
            className={`${control} bg-secondary text-left`}
            onClick={() => {
              const { bk: _old, ...rest } = draft;
              change(rest);
            }}
          >
            Flat ink
          </button>
          {scenes.slice(0, 4).map((scene, index) => (
            <button
              key={scene.name}
              type="button"
              aria-pressed={draft.bk === index}
              className={`${control} overflow-hidden p-0 text-left ${draft.bk === index ? "border-primary" : ""}`}
              onClick={() => change({ ...draft, bk: index })}
            >
              <img src={scene.url} alt="" loading="lazy" className="h-12 w-full object-cover" />
              <span className="block px-2 py-2 text-xs">{scene.name}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid min-w-0 gap-3">
        <label className="space-y-2 text-sm">
          <span className="block">Study tag</span>
          <select
            disabled={disabled || saving}
            className={`${control} w-full min-w-0 bg-background`}
            value={draft.tg ?? ""}
            onChange={(event) => {
              const { tg: _old, ...rest } = draft;
              change(
                event.target.value
                  ? { ...rest, tg: event.target.value as NonNullable<FriendDecoration["tg"]> }
                  : rest,
              );
            }}
          >
            <option value="">None</option>
            {FRIEND_TAGS.map((id) => (
              <option key={id} value={id}>
                {FRIEND_TAG_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="block">Status</span>
          <select
            disabled={disabled || saving}
            className={`${control} w-full min-w-0 bg-background`}
            value={draft.sb ?? ""}
            onChange={(event) => {
              const { sb: _old, ...rest } = draft;
              change(
                event.target.value
                  ? { ...rest, sb: event.target.value as NonNullable<FriendDecoration["sb"]> }
                  : rest,
              );
            }}
          >
            <option value="">None</option>
            {FRIEND_STATUSES.map((id) => (
              <option key={id} value={id}>
                {FRIEND_STATUS_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset disabled={disabled || saving} className="min-w-0">
        <legend className="text-sm font-medium">Pinned badges · up to 3</legend>
        <div className="mt-2 space-y-2">
          {BADGES.map((badge) => {
            const earned = Boolean(badges[badge.id]);
            const selected = selectedPins.includes(badge.id);
            const full = selectedPins.length >= 3 && !selected;
            return (
              <label
                key={badge.id}
                className="flex min-h-11 items-start gap-2 rounded-lg border border-border/60 p-2 text-xs"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                  checked={selected}
                  disabled={!earned || full}
                  aria-disabled={!earned || full}
                  onChange={() => {
                    const next = selected
                      ? selectedPins.filter((id) => id !== badge.id)
                      : [...selectedPins, badge.id].slice(0, 3);
                    const { pin: _old, ...rest } = draft;
                    change(next.length ? { ...rest, pin: next.join(",") } : rest);
                  }}
                />
                <BadgeArt
                  id={badge.id}
                  className={`size-7 shrink-0 ${earned ? "" : "opacity-40 grayscale"}`}
                />
                <span>
                  {badge.name}
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {!earned
                      ? `Locked. ${badge.how}`
                      : full
                        ? "Unpin another badge first."
                        : "Earned"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset disabled={disabled || saving} className="min-w-0">
        <legend className="text-sm font-medium">Effects</legend>
        <div className="mt-2 space-y-2">
          {FRIEND_EFFECTS.map((id) => (
            <button
              key={id}
              type="button"
              aria-disabled={id !== "none"}
              aria-pressed={resolved.fx === id}
              className={`${control} w-full text-left`}
              onClick={() => {
                if (id === "none") change({ ...draft, fx: "none" });
              }}
            >
              <span className="capitalize">{id}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {id === "none" ? "No animated effect" : `Coming in F6. ${requirement(id, true)}`}
              </span>
            </button>
          ))}
        </div>
        {draft.fx !== "none" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your saved effect choice is kept. Effects currently render none.
          </p>
        )}
      </fieldset>
      {dirty && <div className="min-w-0 border-t border-border pt-4">{renderPreview(draft)}</div>}
      <p className="text-xs text-muted-foreground">
        {accountMode
          ? "Save look keeps these choices with this account. Sharing off keeps the public card closed."
          : "Your look is kept on this device. After setting up Friends, make an explicit Save look to keep it with your account."}
      </p>
      <div className="flex flex-wrap gap-2">
        {accountMode && !loaded && (
          <p className="text-xs text-muted-foreground">
            Your draft is kept on this device. Reconnect and refresh Friends before saving to your
            account.
          </p>
        )}
        {changedElsewhere && (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Your saved look changed. Review it here before keeping your draft for a new save.</p>
            <p>
              Saved frame: {saved.fr}. Banner:{" "}
              {saved.bk === undefined ? "Flat ink" : (scenes[saved.bk]?.name ?? "Flat ink")}. Study
              tag: {saved.tg ? FRIEND_TAG_LABELS[saved.tg] : "None"}. Status:{" "}
              {saved.sb ? FRIEND_STATUS_LABELS[saved.sb] : "None"}.
            </p>
            <button
              type="button"
              className={control}
              disabled={disabled || saving}
              onClick={() => {
                setBaseRevision(revision);
                setNotice("Draft kept. Choose Save look to apply it to the current account look.");
              }}
            >
              Keep my draft
            </button>
          </div>
        )}
        {accountMode && (
          <button
            type="button"
            className={`${control} bg-primary text-primary-foreground`}
            disabled={disabled || saving || !loaded || !dirty || changedElsewhere}
            onClick={async () => {
              setSaving(true);
              try {
                const ok = await onSave(draft, baseRevision);
                if (ok) {
                  setDirty(false);
                  onDraft(null);
                  setNotice("Your look is saved.");
                } else
                  setNotice("Your draft is kept. Review the Friends message before saving again.");
              } catch {
                setNotice("Your look could not be saved. The draft is kept on this device.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save look"}
          </button>
        )}
        {dirty && (
          <button
            type="button"
            className={control}
            disabled={disabled || saving}
            onClick={() => {
              setDraft(saved ?? DEFAULT);
              setDirty(false);
              setBaseRevision(revision);
              onDraft(null);
              setNotice("Draft discarded.");
            }}
          >
            Discard draft
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </div>
  );
}

// Phase 9b: the two sync dialogs — "how should this device and your account be combined?" and "delete my cloud data?".
// Portaled to <body> for the same reason as ConfirmDialog in routes/index.tsx (glass panes use backdrop-blur and
// transforms, which would trap a `fixed` child inside the pane). Tokens only.
import { useState } from "react";
import { createPortal } from "react-dom";
import type { SyncMode } from "@/lib/sync";
import type { SyncController, SyncDialogState } from "./useSync";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const counts = (c: { days: number; reviewWords: number }) =>
  `${plural(c.days, "day")} · ${plural(c.reviewWords, "word")} in review`;

function Overlay({
  children,
  onClose,
  labelId,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelId: string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-glass-strong p-5 shadow-2xl backdrop-blur-xl"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

type Choose = Extract<SyncDialogState, { kind: "choose" }>;

const OPTIONS: { mode: SyncMode; title: string; body: string }[] = [
  {
    mode: "merge",
    title: "Merge (recommended)",
    body: "Keeps every day from both. If a day is on both with different content, this device's version is kept.",
  },
  {
    mode: "use-cloud",
    title: "Use my account's data",
    body: "Replaces the lessons and progress on this device with your account's copy.",
  },
  {
    mode: "use-device",
    title: "Use this device's data",
    body: "Replaces your account's copy with this device's. Days the account has that this device doesn't are removed from the account, and from your other devices when they sync.",
  },
];

function ChooseDialog({
  state,
  onCancel,
  onRun,
}: {
  state: Choose;
  onCancel: () => void;
  onRun: SyncController["runChoice"];
}) {
  const [mode, setMode] = useState<SyncMode>("merge");
  // Upload (account empty) is a plain merge, so the backup is optional; otherwise something gets replaced, so it starts ticked.
  const [backup, setBackup] = useState(!state.cloudEmpty && state.device.days > 0);
  const disabled = (m: SyncMode): string | null => {
    if (m === "use-cloud" && state.cloudEmpty) return "Your account has no data yet.";
    if (m === "use-device" && !state.deviceHasLessons)
      return "This device has no lessons; this would erase the account's copy.";
    return null;
  };
  const destructive = mode !== "merge";

  return (
    <Overlay onClose={onCancel} labelId="sync-choose-title">
      <h2 id="sync-choose-title" className="font-display text-lg">
        {state.cloudEmpty ? "Upload to your account?" : "Sync this device with your account"}
      </h2>
      <dl className="mt-3 space-y-1 rounded-md border border-border bg-glass p-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">This device</dt>
          <dd>{counts(state.device)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Your account</dt>
          <dd>{state.cloudEmpty ? "empty" : counts(state.cloud)}</dd>
        </div>
      </dl>

      {state.cloudEmpty ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Your account has nothing yet. This copies your lessons and review progress to it so other
          devices can pick them up. Nothing on this device changes.
        </p>
      ) : (
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">How to combine them</legend>
          {OPTIONS.map((option) => {
            const why = disabled(option.mode);
            return (
              <label
                key={option.mode}
                className={`flex items-start gap-3 rounded-md border p-3 ${
                  mode === option.mode ? "border-primary/60" : "border-border"
                } ${why ? "opacity-50" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="sync-mode"
                  className="mt-1 accent-primary"
                  checked={mode === option.mode}
                  disabled={why !== null}
                  onChange={() => setMode(option.mode)}
                />
                <span className="text-xs">
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="mt-0.5 block text-muted-foreground">{why ?? option.body}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs">
        <input
          type="checkbox"
          className="mt-0.5 accent-primary"
          checked={backup}
          disabled={state.device.days === 0}
          onChange={(e) => setBackup(e.target.checked)}
        />
        <span>
          Download a backup file of this device first{" "}
          <span className="text-muted-foreground">
            (kiroku-backup-before-sync.json — restores from the Progress tab)
          </span>
        </span>
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button
          onClick={() => onRun(state.cloudEmpty ? "merge" : mode, backup)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-primary-foreground ${
            destructive && !state.cloudEmpty ? "bg-destructive" : "bg-primary"
          }`}
        >
          {state.cloudEmpty ? "Upload" : mode === "merge" ? "Merge" : "Replace"}
        </button>
      </div>
    </Overlay>
  );
}

function DeleteDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Overlay onClose={onCancel} labelId="sync-delete-title">
      <h2 id="sync-delete-title" className="font-display text-lg">
        Delete my cloud data?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This erases the copy of your lessons and progress stored in your account. Lessons and
        progress on this device are not touched, and you can upload them again with Sync now. Your
        other devices keep their own copies, and any that still sync automatically will upload them
        to your account again; switch off "Sync automatically" on them first if you don't want that.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Delete cloud data
        </button>
      </div>
    </Overlay>
  );
}

function WipeDialog({
  device,
  onCancel,
  onConfirm,
}: {
  device: { days: number; reviewWords: number };
  onCancel: () => void;
  onConfirm: (backupFirst: boolean) => void;
}) {
  const [backup, setBackup] = useState(true);
  return (
    <Overlay onClose={onCancel} labelId="sync-wipe-title">
      <h2 id="sync-wipe-title" className="font-display text-lg">
        Remove this device's data and sign out?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Kiroku first saves your latest changes to your account. If that fails, nothing is removed
        and you stay signed in. Then the {counts(device)} on this device are removed and you are
        signed out. Signing in again brings them back from your account. Good for a shared computer.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs">
        <input
          type="checkbox"
          className="mt-0.5 accent-primary"
          checked={backup}
          onChange={(e) => setBackup(e.target.checked)}
        />
        <span>
          Download a backup file of this device first{" "}
          <span className="text-muted-foreground">(kiroku-backup-before-sign-out.json)</span>
        </span>
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(backup)}
          className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Remove and sign out
        </button>
      </div>
    </Overlay>
  );
}

export function SyncDialogs({ sync }: { sync: SyncController }) {
  const { dialog } = sync;
  if (!dialog) return null;
  if (dialog.kind === "delete")
    return <DeleteDialog onCancel={sync.closeDialog} onConfirm={sync.confirmDelete} />;
  if (dialog.kind === "wipe") {
    return (
      <WipeDialog
        device={dialog.device}
        onCancel={sync.closeDialog}
        onConfirm={sync.confirmWipeSignOut}
      />
    );
  }
  return <ChooseDialog state={dialog} onCancel={sync.closeDialog} onRun={sync.runChoice} />;
}

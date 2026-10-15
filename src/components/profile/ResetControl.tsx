/**
 * Phase 19a — the type-"reset" control, moved here unchanged from `routes/index.tsx` (the Profile page's danger zone).
 */
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAccountSync } from "@/components/account/AccountSyncContext";

// A stronger confirmation than the curriculum list's ConfirmDialog, since this clears every
// lesson and all progress at once. Requires typing "reset" rather than a single click.
export function ResetControl({ onReset, disabled }: { onReset: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // Phase 9c: signed in and synced → a second question about the account's copy (default: leave it alone).
  const { sync } = useAccountSync();
  const [alsoCloud, setAlsoCloud] = useState(false);
  const askCloud = sync.linked && sync.canDeleteCloud;
  if (!open) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="hit-area flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="size-3" />
          Reset all progress
        </button>
        {disabled && <p className="mt-2 text-xs text-muted-foreground">Nothing to reset yet.</p>}
      </>
    );
  }
  const canConfirm = text.trim().toLowerCase() === "reset";
  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-xs text-muted-foreground">
        This deletes every lesson and all progress — back it up first if you're not sure. Type{" "}
        <span className="font-semibold text-foreground">reset</span> to confirm.
      </p>
      {askCloud && (
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={alsoCloud}
            onChange={(e) => setAlsoCloud(e.target.checked)}
          />
          <span>
            Also delete the copy in my account
            <span className="block text-muted-foreground">
              {alsoCloud
                ? "Your account's copy is erased too. Your other devices keep theirs and may upload it again."
                : "Left off: your account keeps its copy, and automatic sync is switched off on this device so it doesn't bring everything straight back. Sync now brings it back whenever you want."}
            </span>
          </span>
        </label>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="reset"
          className="min-w-0 flex-1 rounded-md border border-border bg-glass px-2 py-1.5 text-xs outline-none focus:border-destructive"
        />
        <button
          disabled={!canConfirm}
          onClick={() => {
            onReset();
            if (askCloud) {
              if (alsoCloud) void sync.deleteCloudData();
              else sync.setAuto(false);
            }
            setOpen(false);
            setText("");
            setAlsoCloud(false);
          }}
          className="shrink-0 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          Confirm
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

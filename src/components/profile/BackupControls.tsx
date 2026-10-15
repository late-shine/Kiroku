/**
 * Phase 19a — Export + validated Restore, moved here from `routes/index.tsx` (it lives on the Profile page now).
 * Behaviour is unchanged except: the Restore file input is no longer shared with the Progress empty state (that
 * button now opens the Profile page), `emptyProgress` comes in as a prop instead of a module constant, and an
 * export reports back through `onExported`.
 */
import { useState } from "react";
import { Download, Upload } from "lucide-react";
import type { DayLesson, UserProgressState } from "@/types/japanese";
import { buildBackup, parseBackup, type ParsedBackup } from "@/lib/backup";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAccountSync } from "@/components/account/AccountSyncContext";

// Phase 13 — Export + validated Restore. All the checking lives in `src/lib/backup.ts`; this only
// shows the result. A bad file never touches state: it becomes an in-app message, and a good one
// waits behind a ConfirmDialog that shows day counts before anything is replaced.
export function BackupControls({
  lessons,
  progress,
  setLessons,
  setProgress,
  onRestored,
  canExport,
  emptyProgress,
  onExported,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  setLessons: React.Dispatch<React.SetStateAction<DayLesson[]>>;
  setProgress: React.Dispatch<React.SetStateAction<UserProgressState>>;
  onRestored: (firstDay: number) => void;
  /** False when there is nothing to export (no lessons and no progress). Restore always stays available. */
  canExport: boolean;
  /** The shell's all-zero progress: `parseBackup` fills anything a restored file lacks from it. */
  emptyProgress: UserProgressState;
  /** Called right after the backup file was handed to the browser (the Profile page remembers the date). */
  onExported: () => void;
}) {
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const { sync } = useAccountSync();
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

  const exportData = () => {
    setNotice(null);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(buildBackup(lessons, progress), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "kiroku-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onExported();
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setNotice(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ kind: "error", text: "Couldn't read that file, so nothing was restored." });
      return;
    }
    const result = parseBackup(text, emptyProgress);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.message });
      return;
    }
    setPending(result.data);
  };

  const madeOn = pending?.exportedAt
    ? ` It was exported on ${new Date(pending.exportedAt).toLocaleDateString()}.`
    : "";
  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={exportData}
          disabled={!canExport}
          className="hit-area flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-3" />
          Export
        </button>
        <label className="hit-area flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
          <Upload className="size-3" />
          Restore
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void chooseFile(file);
            }}
          />
        </label>
      </div>
      {!canExport && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing to export yet. Build or restore a lesson first.
        </p>
      )}
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-xs ${notice.kind === "error" ? "text-destructive" : "text-success"}`}
        >
          {notice.text}
        </p>
      )}
      {pending && (
        <ConfirmDialog
          title="Replace your data with this backup?"
          body={`${lessons.length === 0 ? `Restore the backup's ${days(pending.lessons.length)}?` : `Replace your ${days(lessons.length)} with the backup's ${days(pending.lessons.length)}?`}${madeOn} Your current lessons and progress will be overwritten — export first if you want to keep them.${sync.linked ? " You're signed in with sync, so the restored days will be ADDED to your account on the next sync; nothing in your account is deleted, and days your account has that this backup doesn't will come back to this device." : ""}`}
          confirmLabel="Replace"
          onConfirm={() => {
            setLessons(pending.lessons);
            setProgress(pending.progress);
            // Phase 11b: point the shell at the first restored day (lessons come back sorted), so the header can't read D1 for a backup that starts at Day 5. An empty backup leaves `day` alone.
            const firstRestored = pending.lessons[0];
            if (firstRestored) onRestored(firstRestored.dayNumber);
            setNotice({
              kind: "success",
              text: `Restored ${days(pending.lessons.length)} from the backup.`,
            });
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

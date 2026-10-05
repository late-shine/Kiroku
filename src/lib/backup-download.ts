/**
 * Phase 9b — saves a backup file from the browser. The same file the Progress tab's Export makes (built by
 * `buildBackup`, so it restores like any other backup); sync uses it for the "download a backup first" step.
 * Browser only: call it from a click handler, never during render.
 */
import { buildBackup } from "@/lib/backup";
import type { DayLesson, UserProgressState } from "@/types/japanese";

export function downloadBackupFile(
  lessons: DayLesson[],
  progress: UserProgressState,
  filename = "kiroku-backup.json",
): void {
  const text = JSON.stringify(buildBackup(lessons, progress), null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

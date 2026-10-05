// Phase 9b: owns the account + sync state for the whole app and renders the sync dialogs. It adds no DOM of its
// own around the children. It needs the lessons and progress (and their setters) from the shell, because a sync
// reads them and, when the person chooses "use my account's data" or merges in new days, writes them.
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { DayLesson, UserProgressState } from "@/types/japanese";
import { AccountSyncContext } from "./AccountSyncContext";
import { SyncDialogs } from "./SyncDialogs";
import { useAccount } from "./useAccount";
import { useSync } from "./useSync";

export function AccountSyncProvider({
  lessons,
  progress,
  setLessons,
  setProgress,
  onApplied,
  children,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  setLessons: Dispatch<SetStateAction<DayLesson[]>>;
  setProgress: Dispatch<SetStateAction<UserProgressState>>;
  onApplied: (lessons: DayLesson[]) => void;
  children: ReactNode;
}) {
  // handleRedirect: this is the always-mounted spot, so it picks up the result of a redirect sign-in (moved here from the header in 9b).
  const account = useAccount({ handleRedirect: true });
  const sync = useSync({ account, lessons, progress, setLessons, setProgress, onApplied });
  return (
    <AccountSyncContext.Provider value={{ account, sync }}>
      {children}
      {account.configured && <SyncDialogs sync={sync} />}
    </AccountSyncContext.Provider>
  );
}

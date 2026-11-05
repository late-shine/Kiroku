import type { ReactNode } from "react";
import { useAccountSync } from "@/components/account/AccountSyncContext";
import { FriendsContext, useFriendsController } from "./useFriends";
import type { QuestPrefs } from "@/lib/quest-prefs";
import type { DayLesson, UserProgressState } from "@/types/japanese";

export function FriendsProvider({
  children,
  onOpenProfile,
  lessons,
  progress,
  hydrated,
  prefs,
}: {
  children: ReactNode;
  onOpenProfile: () => void;
  lessons: readonly DayLesson[];
  progress: UserProgressState;
  hydrated: boolean;
  prefs: QuestPrefs;
}) {
  const { account, sync } = useAccountSync();
  const friends = useFriendsController({
    account: account.auth.status === "in" ? account.auth.account : null,
    resolved: account.auth.status !== "loading",
    configured: sync.configured,
    onOpenProfile,
    study: {
      lessons,
      progress,
      hydrated,
      prefs,
      syncBusy: sync.busy,
      syncLinked: sync.linked,
      syncStamp: sync.lastSyncedAt,
    },
  });
  return <FriendsContext.Provider value={friends}>{children}</FriendsContext.Provider>;
}

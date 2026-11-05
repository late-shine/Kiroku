import type { ReactNode } from "react";
import { useAccountSync } from "@/components/account/AccountSyncContext";
import { FriendsContext, useFriendsController } from "./useFriends";

export function FriendsProvider({
  children,
  onOpenProfile,
}: {
  children: ReactNode;
  onOpenProfile: () => void;
}) {
  const { account, sync } = useAccountSync();
  const friends = useFriendsController({
    account: account.auth.status === "in" ? account.auth.account : null,
    resolved: account.auth.status !== "loading",
    configured: sync.configured,
    onOpenProfile,
  });
  return <FriendsContext.Provider value={friends}>{children}</FriendsContext.Provider>;
}

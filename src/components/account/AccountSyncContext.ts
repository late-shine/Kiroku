// Phase 9b: the one shared account + sync state. AccountSyncProvider (top of the app) owns it; the header popover
// and the Progress card only read it, so they can never disagree and there is only one set of dialogs.
import { createContext, useContext } from "react";
import type { AccountController } from "./useAccount";
import type { SyncController } from "./useSync";

export type AccountSyncValue = { account: AccountController; sync: SyncController };

export const AccountSyncContext = createContext<AccountSyncValue | null>(null);

export function useAccountSync(): AccountSyncValue {
  const value = useContext(AccountSyncContext);
  if (!value) throw new Error("useAccountSync must be used inside <AccountSyncProvider>.");
  return value;
}

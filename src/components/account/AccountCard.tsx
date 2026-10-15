// Phase 9a/9b: the account block (sign in / out, and since 9b the sync controls). Phase 19a: it is the "Account & sync"
// section of the Profile page (it used to sit in the Progress tab). Renders nothing when the build has no Firebase
// config; the Profile page shows its own one-line note in that case.
import { AccountPanel } from "./AccountPanel";
import { useAccountSync } from "./AccountSyncContext";

export function AccountCard() {
  const shared = useAccountSync();
  if (!shared.account.configured) return null;
  return (
    <div>
      <AccountPanel {...shared} />
    </div>
  );
}

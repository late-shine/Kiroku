// Phase 9a/9b: the Account card in the Progress tab (sign in / out, and since 9b the same sync controls as the header).
// Hidden entirely when the build has no Firebase config, so a clone without a `.env` looks unchanged.
import { AccountPanel } from "./AccountPanel";
import { useAccountSync } from "./AccountSyncContext";

export function AccountCard() {
  const shared = useAccountSync();
  if (!shared.account.configured) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <span className="font-display text-xs italic text-primary">account</span>
      <AccountPanel {...shared} />
    </div>
  );
}

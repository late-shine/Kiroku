// Phase 9a: the Account card in the Progress tab. Sign in / sign out only — nothing syncs yet.
// Hidden entirely when the build has no Firebase config, so a clone without a `.env` looks unchanged.
import { AccountPanel } from "./AccountPanel";
import { useAccount } from "./useAccount";

export function AccountCard() {
  const account = useAccount();
  if (!account.configured) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <span className="font-display text-xs italic text-primary">account</span>
      <AccountPanel account={account} />
    </div>
  );
}

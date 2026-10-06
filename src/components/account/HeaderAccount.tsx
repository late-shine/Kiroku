// Phase 9a (addendum): the account button in the header, in the slot the "?" used to occupy.
// Click opens a small popover with the same account panel as the Progress card. Signed in, the
// button shows the first letter of the email. Renders nothing when the build has no Firebase config.
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AccountPanel } from "./AccountPanel";
import { useAccountSync } from "./AccountSyncContext";

export function HeaderAccount() {
  const shared = useAccountSync();
  const { account, sync } = shared;
  const [open, setOpen] = useState(false);

  // A failed sign-in (or a failed redirect sign-in) must be visible: open the popover to show it. Phase 9b: so must
  // the outcome of a sync, because clicking inside a sync dialog closes the popover (it counts as an outside click).
  useEffect(() => {
    if (account.error) setOpen(true);
  }, [account.error]);
  useEffect(() => {
    if (sync.notice) setOpen(true);
  }, [sync.notice]);

  if (!account.configured) return null;

  const signedInAs =
    account.auth.status === "in"
      ? (account.auth.account.email ?? account.auth.account.displayName)
      : null;
  const initial = signedInAs ? signedInAs.charAt(0).toUpperCase() : "";
  // Phase 9c: a small dot for the sync state (nothing when sync is off or not set up).
  const dotFor: Record<string, string> = {
    idle: "bg-success",
    syncing: "bg-primary animate-pulse",
    offline: "bg-muted-foreground",
    error: "bg-destructive",
  };
  const dot = signedInAs ? (dotFor[sync.status] ?? "") : "";
  const statusWord: Record<string, string> = {
    idle: "synced",
    syncing: "syncing",
    offline: "offline, will sync later",
    error: "sync problem",
  };
  const word = dot ? `, ${statusWord[sync.status] ?? ""}` : "";
  const label = signedInAs ? `Account (signed in as ${signedInAs}${word})` : "Account";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={label}
          title={label}
          className={`relative rounded-md border p-2 hover:bg-accent hover:text-primary ${
            signedInAs ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
          }`}
        >
          {signedInAs ? (
            <span className="grid size-3.5 place-items-center text-[11px] font-semibold leading-none">
              {initial}
            </span>
          ) : (
            <User className="size-3.5" />
          )}
          {dot && (
            <span
              aria-hidden="true"
              className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ring-1 ring-background ${dot}`}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 border-border bg-glass-strong p-4 text-foreground backdrop-blur-xl"
      >
        <span className="font-display text-xs italic text-primary">account</span>
        <AccountPanel {...shared} />
      </PopoverContent>
    </Popover>
  );
}

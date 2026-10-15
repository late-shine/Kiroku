// Phase 9a (addendum): the account button in the header. Phase 19a: it is now the AVATAR button that opens the Profile
// page (a mode of the shell, not a popover). It shows the person's avatar (photo, chosen glyph, initial, or a neutral
// icon), keeps the sync dot and the status words in its label, and renders even when the build has no Firebase config,
// because the Profile page also holds Export, Restore and Reset.
import { useEffect, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { useProfile } from "@/components/profile/useProfile";
import { avatarFor, initialOf, resolveName } from "@/lib/profile";
import { useAccountSync } from "./AccountSyncContext";

export function HeaderAccount({
  onOpen,
  active = false,
}: {
  /** Open the Profile page. Also called once when a sign-in fails (see below). */
  onOpen: () => void;
  /** The Profile page is the current screen. */
  active?: boolean;
}) {
  const { account, sync } = useAccountSync();
  const { profile } = useProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // A failed sign-in (or a failed redirect sign-in) must be visible: the redirect reloads the page on the Lessons tab,
  // so go to the Profile page, where the error is shown. Fires when an error appears, not every time the page changes.
  useEffect(() => {
    if (account.error) onOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onOpen` is a fresh closure every render; only a NEW error should open the page
  }, [account.error]);

  const identity = account.auth.status === "in" ? account.auth.account : null;
  const signedInAs = identity ? (identity.email ?? identity.displayName) : null;
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
  const label = signedInAs ? `Account (signed in as ${signedInAs}${word})` : "Profile and account";

  // Until mounted the stored profile is not known, so draw the neutral icon: server and first client render agree.
  const avatar = mounted ? avatarFor(profile, identity) : ({ kind: "none" } as const);
  const initial = mounted ? initialOf(resolveName(profile, identity)) : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`hit-area rounded-md border p-2 hover:bg-accent hover:text-primary ${
        active
          ? "border-primary bg-primary/15 text-primary"
          : signedInAs
            ? "border-primary/40 text-primary"
            : "border-border text-muted-foreground"
      }`}
    >
      <Avatar
        avatar={avatar}
        fallbackChar={initial}
        className="size-3.5 text-[11px]"
        iconClassName="size-full"
      />
      {dot && (
        <span
          aria-hidden="true"
          className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ring-1 ring-background ${dot}`}
        />
      )}
    </button>
  );
}

import type { ReactNode } from "react";
import type { FriendDecoration } from "@/lib/friends";

/** The caller resolves unlocks; the wrapper has no storage or animation. */
export function Frame({
  frame = "plain",
  children,
  className = "",
}: {
  frame?: FriendDecoration["fr"];
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-frame={frame}
      className={`profile-frame relative inline-grid shrink-0 place-items-center rounded-full bg-background p-[3px] ${className}`}
    >
      {children}
      {frame === "seal" && (
        <span
          aria-hidden="true"
          lang="ja"
          className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-md border border-primary/50 bg-background text-[11px] text-primary"
        >
          記
        </span>
      )}
    </span>
  );
}

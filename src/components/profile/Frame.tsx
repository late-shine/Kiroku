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
      {frame === "gold" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="profile-frame-art profile-frame-brush"
          fill="none"
        >
          <path
            d="M76 13C58 1 28 8 13 30C-1 52 10 79 31 90C55 102 83 85 91 64"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M84 25C94 39 95 47 93 54M21 18L26 15"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )}
      {frame === "moss" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="profile-frame-art profile-frame-leaves"
          fill="none"
        >
          <path
            d="M18 85C1 67 2 38 18 19M82 85C99 67 98 38 82 19"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M9 58C-2 48 1 41 8 43C14 45 15 51 9 58ZM11 38C7 26 13 22 17 26C20 31 18 35 11 38ZM12 75C1 70 0 63 6 63C12 62 16 68 12 75ZM91 58C102 48 99 41 92 43C86 45 85 51 91 58ZM89 38C93 26 87 22 83 26C80 31 82 35 89 38ZM88 75C99 70 100 63 94 63C88 62 84 68 88 75Z"
            fill="currentColor"
            opacity=".85"
          />
        </svg>
      )}
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

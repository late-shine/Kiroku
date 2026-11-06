import type { ReactNode } from "react";
import { decorationDefinition, type FrameId } from "@/lib/friend-decorations";

/** The caller resolves unlocks; the wrapper has no storage or animation. */
export function Frame({
  frame = "plain",
  children,
  className = "",
}: {
  frame?: FrameId;
  children: ReactNode;
  className?: string;
}) {
  const visual = decorationDefinition("frame", frame)?.visual ?? "plain";
  return (
    <span
      data-frame={visual}
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
      {visual === "orbit" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="profile-frame-art profile-frame-orbit"
          fill="none"
        >
          <circle cx="47" cy="50" r="45" stroke="currentColor" strokeWidth="1.2" />
          <ellipse
            cx="52"
            cy="48"
            rx="47"
            ry="44"
            transform="rotate(-24 52 48)"
            stroke="currentColor"
            strokeWidth=".8"
          />
          <circle
            cx="82"
            cy="15"
            r="3.2"
            fill="currentColor"
            stroke="var(--background)"
            strokeWidth="1.5"
          />
        </svg>
      )}
      {visual === "petal" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="profile-frame-art profile-frame-petals"
          fill="none"
        >
          <path d="M8 31Q3 13 21 9M79 91Q97 88 93 70" stroke="currentColor" strokeWidth="1" />
          <path
            d="M13 21Q-1 16 7 6Q18 6 13 21ZM15 20Q13 4 25 3Q32 13 15 20ZM18 22Q32 10 36 22Q30 31 18 22ZM87 80Q102 85 94 95Q82 94 87 80ZM85 81Q87 97 75 98Q68 88 85 81Z"
            fill="currentColor"
            opacity=".8"
          />
        </svg>
      )}
      {visual === "woven" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="profile-frame-art profile-frame-woven"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
        >
          <path d="M31 5H76Q91 5 91 20V69M91 79Q91 94 76 94H22Q7 94 7 79V31M7 21Q7 5 22 5" />
          <path
            d="M69 1H19Q1 1 1 19V76Q1 90 20 90H69M79 90Q98 90 98 73V18Q98 1 79 1"
            transform="rotate(7 50 50)"
          />
        </svg>
      )}
      {visual === "archive" && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="profile-frame-art profile-frame-archive"
          fill="none"
          stroke="currentColor"
        >
          <rect x="4" y="4" width="92" height="92" rx="19" strokeWidth="1.6" />
          <rect x="9" y="9" width="82" height="82" rx="14" strokeWidth=".8" />
          <path d="M0 25V12Q0 0 12 0H25M75 100H88Q100 100 100 88V75" strokeWidth="2" />
        </svg>
      )}
      {visual === "archive" && (
        <span aria-hidden="true" lang="ja" className="profile-frame-archive-stamp">
          蔵
        </span>
      )}
    </span>
  );
}

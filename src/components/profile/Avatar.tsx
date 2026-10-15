/**
 * Phase 19a — draws an `Avatar` (see src/lib/profile.ts): the Google photo, a chosen kanji glyph, an initial, or a
 * neutral icon. The caller sets the size and text size through `className`. A photo that fails to load falls back
 * to the initial (Google picture addresses sometimes do). No `aria-hidden` spans here: the header button's
 * sync-status dot must stay the first one in its button.
 */
import { useState } from "react";
import { User } from "lucide-react";
import type { Avatar as AvatarData } from "@/lib/profile";

export function Avatar({
  avatar,
  fallbackChar,
  className = "",
  iconClassName = "size-[60%]",
}: {
  avatar: AvatarData;
  /** Shown instead of a photo that didn't load. */
  fallbackChar: string;
  className?: string;
  /** Size of the neutral icon, as a class. */
  iconClassName?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const base = `grid shrink-0 place-items-center overflow-hidden rounded-full leading-none ${className}`;

  if (avatar.kind === "photo" && failedUrl !== avatar.url) {
    return (
      <span className={base}>
        <img
          src={avatar.url}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedUrl(avatar.url)}
        />
      </span>
    );
  }
  if (avatar.kind === "glyph") {
    return (
      <span lang="ja" className={`${base} font-semibold`}>
        {avatar.char}
      </span>
    );
  }
  if (avatar.kind === "photo" || avatar.kind === "initial") {
    const char = avatar.kind === "initial" ? avatar.char : fallbackChar;
    if (char) return <span className={`${base} font-semibold`}>{char}</span>;
  }
  return (
    <span className={base}>
      <User className={iconClassName} />
    </span>
  );
}

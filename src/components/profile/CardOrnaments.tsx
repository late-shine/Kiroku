import { Flower2 } from "lucide-react";
import { decorationDefinition, type BorderId, type CharmId } from "@/lib/friend-decorations";

/** Resolved static artwork only. Pointer events never intercept card controls. */
export function CardBorder({ border = "none" }: { border?: BorderId }) {
  const visual = decorationDefinition("border", border)?.visual ?? "none";
  if (visual === "none") return null;
  return (
    <span aria-hidden="true" className="profile-card-border" data-card-border={visual}>
      {visual === "gilt" &&
        ["tl", "tr", "bl", "br"].map((corner) => (
          <span key={corner} className={`profile-border-corner profile-border-${corner}`} />
        ))}
      {visual === "archival" &&
        ["top", "bottom"].map((position) => (
          <svg
            key={position}
            viewBox="0 0 48 48"
            fill="none"
            className={`profile-border-crane profile-border-crane-${position}`}
          >
            <path
              d="M3 35L20 27L9 5L29 24L40 13L44 14L36 17L33 31L20 27Z"
              fill="var(--background)"
            />
            <path d="M9 5L20 27L29 24ZM20 27L33 31L27 42Z" fill="currentColor" opacity=".28" />
            <path
              d="M3 35L20 27L9 5L29 24L40 13L44 14L36 17L33 31L27 42L20 27L29 24L33 31L3 35Z"
              stroke="currentColor"
              strokeWidth=".9"
              strokeLinejoin="round"
            />
            <path d="M33 4V8M31 6H35M7 42H12" stroke="currentColor" strokeWidth=".7" />
          </svg>
        ))}
      {visual === "garden" && (
        <>
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className="profile-border-leaf profile-border-leaf-top"
          >
            <path d="M3 29Q10 9 29 3" stroke="currentColor" strokeWidth="1" />
            <path
              d="M10 20Q0 18 5 9Q16 9 10 20ZM18 11Q16 0 27 2Q30 11 18 11ZM15 18Q25 11 29 19Q24 28 15 18Z"
              fill="currentColor"
            />
          </svg>
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className="profile-border-leaf profile-border-leaf-bottom"
          >
            <path d="M3 29Q10 9 29 3" stroke="currentColor" strokeWidth="1" />
            <path
              d="M10 20Q0 18 5 9Q16 9 10 20ZM18 11Q16 0 27 2Q30 11 18 11Z"
              fill="currentColor"
            />
          </svg>
        </>
      )}
    </span>
  );
}

export function LittleDetail({ charm = "none" }: { charm?: CharmId }) {
  const visual = decorationDefinition("charm", charm)?.visual ?? "none";
  if (visual === "none") return null;
  return (
    <span aria-hidden="true" className="profile-card-charm" data-card-charm={visual}>
      {visual === "bookmark" && <span className="profile-charm-ribbon" />}
      {visual === "moon" && (
        <svg viewBox="0 0 40 52" fill="none" className="size-full">
          <path d="M20 0V12" stroke="currentColor" strokeWidth=".8" />
          <circle cx="20" cy="15" r="3" stroke="currentColor" strokeWidth="1" />
          <circle
            cx="20"
            cy="33"
            r="16"
            fill="var(--background)"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle cx="20" cy="33" r="13" stroke="currentColor" strokeWidth=".5" opacity=".5" />
          <path d="M24 23A10 10 0 1 0 29 37A10 10 0 0 1 24 23Z" fill="currentColor" />
          <path d="M29 23L30 26L33 27L30 28L29 31L28 28L25 27L28 26Z" fill="currentColor" />
          <path
            d="M8 39H8.1M10 43H10.1M15 46H15.1M20 47H20.1M25 46H25.1M30 43H30.1M32 39H32.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {visual === "blossom" && <Flower2 className="size-full" strokeWidth={1.3} />}
      {visual === "seal" && (
        <span className="profile-charm-seal" lang="ja">
          記
        </span>
      )}
    </span>
  );
}

/** Shared artwork is used in thumbnails, so a choice previews its actual card geometry. */
export function OrnamentSample({
  border = "none",
  charm = "none",
}: {
  border?: BorderId;
  charm?: CharmId;
}) {
  return (
    <span aria-hidden="true" className="decoration-mini-card">
      <span className="decoration-mini-banner">
        <LittleDetail charm={charm} />
      </span>
      <span className="decoration-mini-lines">
        <i />
        <i />
      </span>
      <CardBorder border={border} />
    </span>
  );
}

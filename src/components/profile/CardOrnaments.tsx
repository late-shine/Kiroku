import { Flower2, Moon } from "lucide-react";
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
      {visual === "moon" && <Moon className="size-full" strokeWidth={1.4} />}
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

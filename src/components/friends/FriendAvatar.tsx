import { Avatar } from "@/components/profile/Avatar";
import { Frame } from "@/components/profile/Frame";
import { PROFILE_GLYPHS, initialOf, type Avatar as AvatarData } from "@/lib/profile";
import type { FrameId } from "@/lib/friend-decorations";

/** Static, even when the full card has a saved effect. */
export function FriendAvatar({
  name,
  glyph,
  frame = "plain",
  size = 20,
  photo = null,
  avatar,
}: {
  name: string;
  glyph: string;
  frame?: FrameId;
  size?: 20 | 48;
  photo?: string | null;
  avatar?: AvatarData;
}) {
  const symbol = PROFILE_GLYPHS.find((item) => item.id === glyph);
  const image: AvatarData =
    avatar ??
    (photo
      ? { kind: "photo", url: photo }
      : symbol
        ? { kind: "glyph", id: symbol.id, char: symbol.char }
        : { kind: "initial", char: initialOf(name) });
  return (
    <Frame frame={frame}>
      <Avatar
        avatar={image}
        fallbackChar={initialOf(name)}
        className={`profile-avatar rounded-full bg-secondary text-primary ${size === 48 ? "size-12 text-xl" : "size-5 text-xs"}`}
      />
    </Frame>
  );
}

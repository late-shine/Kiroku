// Phase 16b-1: the full-screen scene behind the app.
//
// Why a component of its own: on Chrome Android a `fixed inset-0` box is as tall as the *visible* viewport,
// which grows and shrinks as the URL bar hides and shows while you scroll. With `object-cover` the picture
// was re-scaled and re-cropped every time. This container is as tall as the LARGE viewport (`100lvh`), which
// does not change when the URL bar moves, and sits on its own compositing layer.
//
// The slow "drift" animation lives on ONE wrapper (not on each of the four images), and the darkness layer
// and the two vignettes live inside the same container.
import { memo } from "react";

type Props = {
  backgrounds: { name: string; url: string }[];
  /** Index of the scene to show (any integer; it is wrapped to the list length). */
  activeIndex: number;
  /** Changing this remounts the images, as the old inline code did when cycling was toggled. */
  cycling: boolean;
  /** 0–1: how much of the page background colour is laid over the picture (the reading-contrast slider). */
  darkness: number;
};

export const SceneBackdrop = memo(function SceneBackdrop({
  backgrounds,
  activeIndex,
  cycling,
  darkness,
}: Props) {
  const active = backgrounds.length > 0 ? activeIndex % backgrounds.length : 0;
  return (
    <div
      aria-hidden
      className="scene-backdrop pointer-events-none fixed left-0 top-0 w-full overflow-hidden"
    >
      <div className="scene-drift absolute inset-0">
        {backgrounds.map((bg, index) => (
          <img
            key={`${bg.name}-${cycling ? "cycling" : "static"}`}
            src={bg.url}
            alt=""
            className={`absolute inset-0 size-full object-cover transition-opacity duration-[2800ms] ease-in-out ${
              index === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 bg-background transition-opacity duration-700"
        style={{ opacity: darkness }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_95%)] opacity-70" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,transparent_35%,transparent_65%,var(--background)_100%)] opacity-35" />
    </div>
  );
});

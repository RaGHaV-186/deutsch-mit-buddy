import type { ReactNode } from "react";
import { BlazeNotch } from "./BlazeNotch";
import { cx } from "./cx";

interface Props {
  children: ReactNode;
  /** Auth screens: less bottom padding. */
  compact?: boolean;
  /** Colour of the area below (the notch is drawn in it). Default: the page ground. */
  notchFill?: string;
  className?: string;
  as?: "header" | "div";
  /** Desktop shape: a hero card in the content column (default), or the full-height left panel of the auth screens. */
  desktop?: "hero" | "panel";
}

/**
 * The blue-grey "coat" block on top of every main screen: rounded only at the bottom, with the blaze notch.
 * On desktop (1024px and up) it becomes a hero card with 24 24 40 72 corners, or the left panel of a split screen.
 */
export function CoatHeader({ children, compact = false, notchFill, className, as: Tag = "header", desktop = "hero" }: Props) {
  const panel = desktop === "panel";
  return (
    <Tag
      className={cx(
        "relative rounded-coat bg-coat px-[22px] pt-[max(58px,calc(env(safe-area-inset-top)+20px))] text-on-coat",
        compact ? "pb-9" : "pb-11",
        panel
          ? "desk:sticky desk:top-0 desk:flex desk:h-dvh desk:w-[45%] desk:shrink-0 desk:flex-col desk:rounded-panel desk:px-14 desk:py-11"
          : "desk:mt-10 desk:rounded-hero desk:px-11 desk:pb-12 desk:pt-10",
        className,
      )}
    >
      {children}
      {panel ? (
        <>
          <BlazeNotch fill={notchFill} className="block desk:hidden" />
          <BlazeNotch edge="right" fill={notchFill} className="hidden desk:block" />
        </>
      ) : (
        <BlazeNotch fill={notchFill} />
      )}
    </Tag>
  );
}

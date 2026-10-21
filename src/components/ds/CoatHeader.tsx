import type { CSSProperties, ReactNode } from "react";
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
}

/** The blue-grey "coat" block on top of every main screen: rounded only at the bottom, with the blaze notch. */
export function CoatHeader({ children, compact = false, notchFill, className, as: Tag = "header" }: Props) {
  const style: CSSProperties = {
    paddingTop: "max(58px, calc(env(safe-area-inset-top) + 20px))",
    paddingBottom: compact ? 36 : 44,
  };
  return (
    <Tag className={cx("relative rounded-coat bg-coat px-[22px] text-on-coat", className)} style={style}>
      {children}
      <BlazeNotch fill={notchFill} />
    </Tag>
  );
}

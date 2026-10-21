import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { cx } from "./cx";

interface Props {
  children: ReactNode;
  /** 24 to 32. */
  radius?: number;
  className?: string;
  style?: CSSProperties;
  /** Makes it a link. */
  href?: string;
  /** Makes it a button. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  "aria-label"?: string;
}

/** A soft, raised card. Plain by default; with `href` or `onClick` it is a link or button with a press state. */
export function Cushion({ children, radius = 24, className, style, href, onClick, disabled, ...rest }: Props) {
  const base = cx("block bg-surface text-text shadow-cushion", className);
  const merged: CSSProperties = { borderRadius: radius, ...style };
  if (href) {
    return (
      <Link href={href} className={cx(base, "ds-press ds-focus")} style={merged} aria-label={rest["aria-label"]}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cx(base, "ds-press ds-focus w-full text-left disabled:opacity-50")}
        style={merged}
        aria-label={rest["aria-label"]}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={base} style={merged}>
      {children}
    </div>
  );
}

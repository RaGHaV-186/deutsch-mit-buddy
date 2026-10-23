import type { ReactNode } from "react";
import { cx } from "./cx";
import { TAB_BAR_CLEARANCE } from "./tab-bar-clearance";

/**
 * The page's `<main>` landmark. Phone: a column of at most 480px, centred; 768 to 1023px: 560px. Desktop (1024px and up):
 * the content area to the right of the sidebar, a column of at most 960px (`width="narrow"`: 640px).
 * Pass `as="div"` when the screen draws its own `<main>` inside.
 */
export function Screen({
  children,
  withTabBar = false,
  className,
  as: Tag = "main",
  width = "wide",
}: {
  children: ReactNode;
  /** The screen has the tab bar (phone) and the sidebar (desktop): leave room for them. */
  withTabBar?: boolean;
  className?: string;
  as?: "main" | "div";
  /** Desktop column: wide 960px (default), narrow 640px (Me, legal texts) or hero 1120px (landing). */
  width?: "wide" | "narrow" | "hero";
}) {
  return (
    <Tag className={cx("flex w-full flex-1 flex-col", withTabBar ? "desk:pl-[280px] desk:pr-10" : "desk:px-10")}>
      <div
        className={cx(
          "mx-auto flex w-full max-w-[480px] flex-1 flex-col tab:max-w-[560px]",
          width === "narrow" ? "desk:max-w-[640px]" : width === "hero" ? "desk:max-w-[1120px]" : "desk:max-w-[960px]",
          withTabBar && "pb-[var(--tab-bar-clearance)] desk:pb-12",
          className,
        )}
        style={withTabBar ? ({ "--tab-bar-clearance": TAB_BAR_CLEARANCE } as React.CSSProperties) : undefined}
      >
        {children}
      </div>
    </Tag>
  );
}

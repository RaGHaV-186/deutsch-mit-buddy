import type { ReactNode } from "react";
import { cx } from "./cx";
import { TAB_BAR_CLEARANCE } from "./FloatingTabBar";

/** Phone-width column (max 480px), centred on the page ground on wide screens. */
export function Screen({ children, withTabBar = false, className }: { children: ReactNode; withTabBar?: boolean; className?: string }) {
  return (
    <div
      className={cx("mx-auto flex w-full max-w-[480px] flex-1 flex-col", className)}
      style={withTabBar ? { paddingBottom: TAB_BAR_CLEARANCE } : undefined}
    >
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

/**
 * Pins the primary action to the bottom of a padded (22px) form column so it stays visible while the page scrolls,
 * and above the on-screen keyboard where the browser resizes the page (Android Chrome, via interactive-widget).
 */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-[22px] flex flex-col gap-3 bg-bg px-[22px] pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
      {children}
    </div>
  );
}

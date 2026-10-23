"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { TabId } from "./FloatingTabBar";

/** If the navigation never lands (connection lost mid-tap), the tapped tab stops looking active after this long. */
const PENDING_TIMEOUT_MS = 10_000;

/**
 * Tab taps answer at once, locally: the tapped tab takes the active look the moment it is pressed, while the server still renders the
 * screen behind it. The state belongs to the screen that was tapped from (keyed by its path), so it disappears by itself when the new screen
 * arrives and its own tab bar mounts.
 */
export function usePendingTab(active: TabId) {
  const pathname = usePathname();
  const [tap, setTap] = useState<{ id: TabId; from: string | null } | null>(null);

  useEffect(() => {
    if (!tap) return;
    const timer = setTimeout(() => setTap(null), PENDING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [tap]);

  const pending = tap && tap.from === pathname ? tap.id : null;
  return {
    pending,
    /** The tab that should look active: the one just tapped, else the current screen's. */
    shown: pending ?? active,
    onTap: (id: TabId) => {
      if (id !== active) setTap({ id, from: pathname });
    },
  };
}

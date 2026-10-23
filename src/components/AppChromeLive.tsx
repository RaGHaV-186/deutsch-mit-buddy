"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppChromeProvider } from "@/components/ds";
import { DECK_CHANGED_EVENT, readDueBadge } from "@/lib/cards/deck-badge";

/** The app layout's chrome: the learner's initial (from the server) and the Cards badge, counted from the deck on this device. */
export function AppChromeLive({ initial, userId, children }: { initial: string; userId: string; children: ReactNode }) {
  const [due, setDue] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      readDueBadge(userId)
        .then((n) => alive && setDue(n))
        .catch(() => {
          // No usable storage: the badge simply stays hidden.
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener(DECK_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener(DECK_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  const value = useMemo(() => ({ initial, due }), [initial, due]);
  return <AppChromeProvider value={value}>{children}</AppChromeProvider>;
}

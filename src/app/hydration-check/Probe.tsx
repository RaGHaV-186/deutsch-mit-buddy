"use client";

import { useEffect, useState } from "react";

const KEY = "hydration-check";

/** A button that only works when React has hydrated this component, plus a tally (kept on this phone) of how many loads worked. */
export function Probe({ page }: { page: string }) {
  const [taps, setTaps] = useState(0);
  const [tally, setTally] = useState<{ loads: number; hydrated: number } | null>(null);

  useEffect(() => {
    let saved: Record<string, { loads: number; hydrated: number }> = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {
      // private mode: the tally just starts over
    }
    const next = { loads: (saved[page]?.loads ?? 0) + 1, hydrated: (saved[page]?.hydrated ?? 0) + 1 };
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...saved, [page]: next }));
    } catch {
      // ignore
    }
    queueMicrotask(() => setTally(next));
  }, [page]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p id="status" style={{ fontWeight: 700 }}>
        {tally ? `JS is running ✓ (hydrated loads on this phone: ${tally.hydrated})` : "Waiting for JS… (if this stays, hydration failed)"}
      </p>
      <button id="tap" type="button" onClick={() => setTaps((n) => n + 1)} style={{ minHeight: 56, fontSize: 18, borderRadius: 16, border: "2px solid currentColor", background: "transparent" }}>
        Tap me: {taps}
      </button>
    </div>
  );
}

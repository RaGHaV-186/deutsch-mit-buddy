"use client";

import { useEffect } from "react";

/**
 * Registers the offline worker (production only) and asks it to save the offline shell (and the static files the
 * shell and this page use) once per visit. Doing this on every start keeps them in step with new deployments.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const registration = await navigator.serviceWorker.ready;
        if (cancelled || !navigator.onLine) return;
        const assets = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(location.origin));
        registration.active?.postMessage({ type: "warm", assets });
      } catch {
        // No worker (private mode, blocked): the app still works online.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

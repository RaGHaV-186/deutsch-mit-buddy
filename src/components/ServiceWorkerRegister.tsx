"use client";

import { useEffect } from "react";

const APP_PAGES = ["/home", "/cards"];

/**
 * Registers the offline worker (production only) and asks it to save the app pages once per visit. Doing this on
 * every start keeps the saved pages and files in step with new deployments.
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
        registration.active?.postMessage({ type: "warm", pages: APP_PAGES, assets });
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

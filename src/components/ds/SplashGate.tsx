"use client";

import { useEffect } from "react";
import { SPLASH_ATTRIBUTE, SPLASH_ID, SPLASH_STORAGE_KEY } from "@/lib/splash";

const FADE_MS = 250;

/** Takes the splash away once the app has started, and remembers (for this session) that it was shown. */
export function SplashGate() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute(SPLASH_ATTRIBUTE)) return;
    try {
      sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    } catch {
      // Private mode: the splash may show again next time, which is harmless.
    }
    const splash = document.getElementById(SPLASH_ID);
    splash?.classList.add("is-leaving");
    const timer = setTimeout(() => {
      root.removeAttribute(SPLASH_ATTRIBUTE);
      splash?.classList.remove("is-leaving");
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

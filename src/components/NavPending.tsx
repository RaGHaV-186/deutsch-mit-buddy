"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const ATTRIBUTE = "data-nav-pending";
/** A navigation that never lands (connection lost) must not leave the screen dimmed. */
const GIVE_UP_MS = 10_000;

/** A plain left click on a link to another screen of this app. */
function isInternalNavigation(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return false;
  const url = new URL(link.href, location.href);
  return url.origin === location.origin && (url.pathname !== location.pathname || url.search !== location.search);
}

/**
 * The moment a link to another screen is pressed, the current screen dims a little (CSS in globals.css, opacity only) until the new one
 * arrives, so a tap never looks ignored while the server renders. Purely local: nothing waits for the network.
 */
export function NavPending() {
  const pathname = usePathname();

  // A new screen arrived: clear it.
  useEffect(() => {
    document.documentElement.removeAttribute(ATTRIBUTE);
  }, [pathname]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      clearTimeout(timer);
      document.documentElement.removeAttribute(ATTRIBUTE);
    };
    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigation(event)) return;
      document.documentElement.setAttribute(ATTRIBUTE, "");
      clearTimeout(timer);
      timer = setTimeout(clear, GIVE_UP_MS);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", clear);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("pageshow", clear);
      clear();
    };
  }, []);

  return null;
}

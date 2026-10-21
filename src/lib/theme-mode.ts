import { themeColor } from "@/theme";

// Manual light/dark override. "system" (the default) follows the device; "light" and "dark" set <html data-theme>.
// The choice lives in localStorage (a per-device convenience, no cookie) and is applied by an inline script in the
// root layout before the first paint, so there is no flash of the wrong theme.

export type ThemePreference = "system" | "light" | "dark";
export const THEME_STORAGE_KEY = "buddy.theme";
export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

export const isThemePreference = (v: unknown): v is ThemePreference => v === "system" || v === "light" || v === "dark";

export function readThemePreference(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Sets the attribute and the browser-chrome colour. Pure DOM, so it also runs in tests. */
export function applyThemePreference(preference: ThemePreference, doc: Document = document) {
  const root = doc.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);

  // Next renders one theme-color tag per colour scheme (with a media query). A manual choice overrides both.
  doc.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const own = (meta.getAttribute("media") ?? "").includes("dark") ? "dark" : "light";
    meta.setAttribute("content", themeColor[preference === "system" ? own : preference]);
  });
}

export function setThemePreference(preference: ThemePreference, doc: Document = document) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode or blocked storage: the choice applies until the page is closed.
  }
  applyThemePreference(preference, doc);
}

/**
 * Runs in <head> before first paint. Self-contained (no imports); a "system" or missing value does nothing,
 * because the CSS already follows the device. The colour is applied again after parsing, and whenever a theme-color
 * tag is added to the head (the app router re-adds them on client updates), so a manual choice always wins.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(p!=="light"&&p!=="dark")return;document.documentElement.setAttribute("data-theme",p);var c=${JSON.stringify(themeColor)}[p];var f=function(){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",c)};f();document.addEventListener("DOMContentLoaded",f);new MutationObserver(f).observe(document.head,{childList:true})}catch(e){}})();`;

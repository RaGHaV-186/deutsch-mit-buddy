// First-load splash (docs/DESIGN_BRIEF.md, Phase 3): a full-screen coat colour with Buddy, shown once per session when the
// app is opened from the home screen, until the page is ready. A tiny script in <head> decides before first paint (so there
// is no flash in a normal browser tab); SplashGate removes it once React has started.

export const SPLASH_STORAGE_KEY = "buddy.splash";
export const SPLASH_ATTRIBUTE = "data-splash";
export const SPLASH_ID = "app-splash";

/** Pure version of the decision, used by SplashGate and tests. */
export function shouldShowSplash(env: {
  standalone: boolean;
  search: string;
  seen: boolean;
}): boolean {
  if (/[?&]splash=1(&|$)/.test(env.search)) return true; // preview / testing
  return env.standalone && !env.seen;
}

/** Self-contained (no imports): marks <html> when the splash should show. Never throws. */
export const splashInitScript = `(function(){try{var s=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||window.navigator.standalone===true;var f=/[?&]splash=1(&|$)/.test(location.search);var seen=false;try{seen=!!sessionStorage.getItem(${JSON.stringify(SPLASH_STORAGE_KEY)})}catch(e){}if(f||(s&&!seen))document.documentElement.setAttribute(${JSON.stringify(SPLASH_ATTRIBUTE)},"")}catch(e){}})();`;

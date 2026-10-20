import { SPLASH_ID } from "@/lib/splash";
import { BuddyMascot } from "./BuddyMascot";

/**
 * Full-screen coat splash: Buddy (120px) and the app name. Hidden by CSS unless <html data-splash> is set (see
 * src/lib/splash.ts). The spinner only fades in if loading takes longer than a second.
 * `preview` renders it in place (for /design) instead of covering the screen.
 */
export function Splash({ title, preview = false }: { title: string; preview?: boolean }) {
  return (
    <div id={preview ? undefined : SPLASH_ID} className={preview ? "splash-preview" : "splash"} aria-hidden="true">
      <BuddyMascot pose="neutral" size={120} priority />
      <p className="text-[20px] font-extrabold leading-tight tracking-[-0.02em]">{title}</p>
      <span className="splash-spinner" />
    </div>
  );
}

import { redirect } from "next/navigation";
import { AppChromeLive } from "@/components/AppChromeLive";
import { NavPending } from "@/components/NavPending";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { requireAal2FromClaims } from "@/lib/auth/guard";
import { STALE_SESSION_PATH } from "@/lib/auth/stale-session";
import { getProfile } from "@/lib/profile";

// Everything inside the app needs a verified two-factor session and a chosen starting point.
// Each screen draws its own top (coat header) and navigation (tab bar on phones, sidebar on desktop).
// The layout makes one database call (the profile, shared with the page); the Cards badge on the desktop sidebar is counted on the device.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireAal2FromClaims();
  const profile = await getProfile(userId);
  // Every account has a profile row from sign-up on: none means the account is gone (or the database is unreachable), so end the session
  // properly instead of looping between /login and the app. A profile that is not onboarded yet goes to onboarding.
  if (!profile) redirect(STALE_SESSION_PATH);
  if (!profile.onboarded_at) redirect("/onboarding");
  const initial = (profile.display_name ?? "").trim().charAt(0).toUpperCase();

  return (
    <>
      <ServiceWorkerRegister />
      <NavPending />
      <AppChromeLive initial={initial} userId={userId}>
        <div className="flex flex-1 flex-col">{children}</div>
      </AppChromeLive>
    </>
  );
}

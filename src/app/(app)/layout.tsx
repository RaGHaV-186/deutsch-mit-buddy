import { redirect } from "next/navigation";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AppChromeProvider } from "@/components/ds";
import { requireAal2 } from "@/lib/auth/guard";
import { ensureLessonCards } from "@/lib/cards/ensure-unlocked";
import { getDueCounts } from "@/lib/cards/server";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/time";

// Everything inside the app needs a verified two-factor session and a chosen starting point.
// Each screen draws its own top (coat header) and navigation (tab bar on phones, sidebar on desktop).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  if (!profile?.onboarded_at) redirect("/onboarding");
  // Cards of lessons published since the last visit are copied in first, so the counts include them. The pages that count cards await the
  // same per-request promise (the layout and the page render in parallel).
  await ensureLessonCards(userId);
  // Only the desktop sidebar uses these (the Cards badge and the initial on the Me row).
  const counts = await getDueCounts(await createClient(), userId, new Date(), safeTimeZone(profile.timezone));
  const initial = (profile.display_name ?? "").trim().charAt(0).toUpperCase();

  return (
    <>
      <ServiceWorkerRegister />
      <AppChromeProvider value={{ initial, due: counts ? counts.due + counts.fresh : 0 }}>
        <div className="flex flex-1 flex-col">{children}</div>
      </AppChromeProvider>
    </>
  );
}

import { redirect } from "next/navigation";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { requireAal2 } from "@/lib/auth/guard";
import { getProfile } from "@/lib/profile";

// Everything inside the app needs a verified two-factor session and a chosen starting point.
// Each screen draws its own top (coat header) and bottom (tab bar).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <>
      <ServiceWorkerRegister />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/app/(auth)/actions";
import { FeedbackButton } from "@/components/FeedbackButton";
import { LegalLinks, secondaryButtonClass } from "@/components/ui";
import { requireAal2 } from "@/lib/auth/guard";
import { getProfile } from "@/lib/profile";

// Everything inside the app needs a verified two-factor session and a chosen starting point.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  if (!profile?.onboarded_at) redirect("/onboarding");

  const t = await getTranslations("App");
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Image src="/buddy/buddy-happy.svg" alt="" width={40} height={41} />
        <div className="flex items-center gap-2">
          <FeedbackButton />
          <form action={signOutAction}>
            <button type="submit" className={`${secondaryButtonClass} w-auto whitespace-nowrap px-3 py-2 text-sm`}>
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="px-4 py-6">
        <LegalLinks />
      </footer>
    </>
  );
}

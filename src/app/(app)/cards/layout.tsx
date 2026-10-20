import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { FeedbackButton } from "@/components/FeedbackButton";
import { SignOutForm } from "@/components/SignOutForm";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LegalLinks, secondaryButtonClass } from "@/components/ui";

// TEMPORARY: Cards still has the first version's top row and footer until it is redesigned (design phase 6).
export default async function CardsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("App");
  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <Image src="/buddy/buddy-happy.svg" alt="" width={40} height={41} />
        <div className="flex items-center gap-2">
          <FeedbackButton />
          <SignOutForm>
            <button type="submit" className={`${secondaryButtonClass} w-auto whitespace-nowrap px-3 py-2 text-sm`}>
              {t("signOut")}
            </button>
          </SignOutForm>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="flex flex-col items-center gap-4 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
        <ThemeSwitch />
        <LegalLinks />
      </footer>
    </>
  );
}

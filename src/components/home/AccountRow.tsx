import { useTranslations } from "next-intl";
import { FeedbackButton } from "@/components/FeedbackButton";
import { SignOutForm } from "@/components/SignOutForm";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LegalLinks, compactButtonClass } from "@/components/ui";

/**
 * TEMPORARY: feedback, log out, theme and legal links. They live on Home until the Me screen exists (design phase 7),
 * which takes them over.
 */
export function AccountRow() {
  const t = useTranslations("App");
  const h = useTranslations("Home");
  return (
    <section aria-label={h("accountLabel")} className="mt-4 flex flex-col items-center gap-4 pb-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <FeedbackButton />
        <SignOutForm>
          <button type="submit" className={`${compactButtonClass} min-h-11 whitespace-nowrap px-3 text-sm`}>
            {t("signOut")}
          </button>
        </SignOutForm>
      </div>
      <ThemeSwitch />
      <LegalLinks />
    </section>
  );
}

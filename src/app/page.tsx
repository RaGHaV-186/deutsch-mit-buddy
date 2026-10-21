import Image from "next/image";
import { useTranslations } from "next-intl";
import { BuddyMascot, CoatHeader, PillButton, Screen } from "@/components/ds";
import { LegalLinks } from "@/components/ui";

/**
 * Signed-out landing. Phone: Buddy greets you in the coat block, sign up and log in below. Desktop: a wide hero with the copy
 * and the two buttons on the left and a big Buddy on the right.
 */
export default function Home() {
  const t = useTranslations("Home");
  const meta = useTranslations("Meta");
  return (
    <Screen as="div" width="hero">
      <main className="flex flex-1 flex-col desk:justify-center">
        <CoatHeader className="desk:mt-0 desk:min-h-[520px] desk:overflow-hidden desk:py-12">
          <div className="hidden items-center gap-3 desk:absolute desk:left-11 desk:top-9 desk:flex">
            <Image src="/buddy/buddy-icon-light.svg" alt="" width={36} height={36} className="rounded-[10px]" unoptimized />
            <span className="text-[17px] font-bold">{meta("title")}</span>
          </div>
          <div className="flex flex-col items-center gap-4 text-center desk:min-h-[420px] desk:flex-row-reverse desk:items-center desk:justify-between desk:gap-12 desk:pt-10 desk:text-left">
            <BuddyMascot pose="happy" size={160} priority className="desk:-mb-12 desk:h-auto desk:w-[400px] desk:self-end" />
            <div className="flex flex-col items-center gap-4 desk:max-w-[520px] desk:items-start desk:gap-6">
              <h1 className="text-display desk:text-[64px] desk:leading-[1.05]">{t("greeting")}</h1>
              <p className="max-w-xs text-body text-on-coat-muted desk:max-w-none desk:text-[20px] desk:leading-snug">{t("tagline")}</p>
              <div className="hidden gap-3 desk:mt-2 desk:flex">
                <PillButton href="/signup" variant="blaze" size={60}>
                  {t("signUp")}
                </PillButton>
                <PillButton href="/login" variant="outline-on-coat" size={60}>
                  {t("logIn")}
                </PillButton>
              </div>
            </div>
          </div>
        </CoatHeader>
        <div className="flex flex-col gap-3 px-[22px] pt-8 desk:hidden">
          <PillButton href="/signup" fullWidth>
            {t("signUp")}
          </PillButton>
          <PillButton href="/login" variant="cushion" fullWidth>
            {t("logIn")}
          </PillButton>
        </div>
      </main>
      <footer className="px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-8">
        <LegalLinks />
      </footer>
    </Screen>
  );
}

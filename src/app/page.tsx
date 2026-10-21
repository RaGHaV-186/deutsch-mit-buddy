import { useTranslations } from "next-intl";
import { BuddyMascot, CoatHeader, PillButton, Screen } from "@/components/ds";
import { LegalLinks } from "@/components/ui";

/** Signed-out landing: Buddy greets you in the coat block, sign up and log in below. */
export default function Home() {
  const t = useTranslations("Home");
  return (
    <Screen as="div">
      <main className="flex flex-1 flex-col">
        <CoatHeader>
          <div className="flex flex-col items-center gap-4 text-center">
            <BuddyMascot pose="happy" size={160} priority />
            <h1 className="text-display">{t("greeting")}</h1>
            <p className="max-w-xs text-body text-on-coat-muted">{t("tagline")}</p>
          </div>
        </CoatHeader>
        <div className="flex flex-col gap-3 px-[22px] pt-8">
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

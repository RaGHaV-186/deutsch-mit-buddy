import { useTranslations } from "next-intl";
import { BuddyMascot, CoatHeader, Cushion, DocIcon, FloatingTabBar, Screen } from "@/components/ds";
import { FeedbackButton } from "@/components/FeedbackButton";
import { LogOutRow } from "@/components/me/LogOutRow";
import { SettingsGroup, SettingsRow } from "@/components/me/SettingsList";
import { ThemeSwitch } from "@/components/ThemeSwitch";

interface Props {
  /** The learner's first name; null shows no name line. */
  name: string | null;
  /** "static" lets the /design page show the tab bar in place instead of pinned to the screen. */
  tabBar?: "fixed" | "static";
}

/** Me: the theme switch, feedback, legal links and log out. */
export function MeView({ name, tabBar = "fixed" }: Props) {
  const t = useTranslations("Me");
  const nav = useTranslations("Ds.nav");
  const common = useTranslations("Common");
  return (
    <>
      <Screen withTabBar={tabBar === "fixed"}>
        <CoatHeader compact>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-3">
              <h1 className="text-display">{nav("me")}</h1>
              {name ? <p className="text-headline text-on-coat-muted">{name}</p> : null}
            </div>
            <BuddyMascot pose="happy" size={72} className="mt-1 shrink-0" priority />
          </div>
        </CoatHeader>
        <div className="flex flex-col gap-6 px-5 pt-6">
          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-label text-muted">{t("appearance")}</h2>
            <Cushion className="p-4">
              <ThemeSwitch />
            </Cushion>
          </section>
          <SettingsGroup title={t("help")}>
            <FeedbackButton />
          </SettingsGroup>
          <SettingsGroup title={t("legal")}>
            <SettingsRow icon={<DocIcon size={22} />} label={common("legalImpressum")} href="/impressum" />
            <SettingsRow icon={<DocIcon size={22} />} label={common("legalPrivacy")} href="/datenschutz" />
            <SettingsRow icon={<DocIcon size={22} />} label={common("legalTerms")} href="/terms" />
          </SettingsGroup>
          <SettingsGroup title={t("account")}>
            <LogOutRow />
          </SettingsGroup>
        </div>
      </Screen>
      <FloatingTabBar active="me" position={tabBar} />
    </>
  );
}

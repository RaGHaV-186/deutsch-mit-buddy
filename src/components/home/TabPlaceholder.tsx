import { useTranslations } from "next-intl";
import { BuddyMascot, CoatHeader, EmptyState, AppNav, Screen, SpeechBubble, type TabId } from "@/components/ds";

/** A tab whose screen isn't built yet (Learn and Play): the coat header, "coming soon", and the tab bar so the app stays navigable. */
export function TabPlaceholder({ tab }: { tab: Extract<TabId, "learn" | "play"> }) {
  const nav = useTranslations("Ds.nav");
  const soon = useTranslations("Soon");
  return (
    <>
      <Screen withTabBar width="narrow">
        <CoatHeader compact>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-3">
              <h1 className="text-display desk:text-[40px]">{nav(tab)}</h1>
              <SpeechBubble>{soon("line")}</SpeechBubble>
            </div>
            <BuddyMascot pose="resting" size={72} className="mt-1 shrink-0 desk:h-auto desk:w-[120px]" priority />
          </div>
        </CoatHeader>
        <div className="px-5 pt-6 desk:px-0 desk:pt-8">
          <EmptyState pose="curious" message={`${soon("title")}. ${soon("message")}`} />
        </div>
      </Screen>
      <AppNav active={tab} />
    </>
  );
}

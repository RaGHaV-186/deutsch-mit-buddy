import { getTranslations } from "next-intl/server";
import { CoatHeader, Cushion, Screen } from "@/components/ds";
import { LegalLinks } from "./ui";

type Section = { heading: string; body: string };

/** Renders one of the placeholder legal texts from messages/en.json ("Legal.<doc>"). */
export async function LegalPage({ doc }: { doc: "impressum" | "privacy" | "terms" }) {
  const t = await getTranslations("Legal");
  const sections = Object.values(t.raw(`${doc}.sections`) as Record<string, Section>);
  return (
    <Screen as="div">
      <main className="flex flex-1 flex-col">
        <CoatHeader compact>
          <h1 className="text-display">{t(`${doc}.title`)}</h1>
        </CoatHeader>
        <div className="flex flex-col gap-4 px-[22px] pt-8">
          <p role="note" className="rounded-field bg-tint px-4 py-3 text-caption text-on-tint">
            {t("placeholderNotice")}
          </p>
          {sections.map((s) => (
            <Cushion key={s.heading} className="flex flex-col gap-1.5 p-5">
              <h2 className="text-headline">{s.heading}</h2>
              <p className="whitespace-pre-line text-body">{s.body}</p>
            </Cushion>
          ))}
        </div>
      </main>
      <footer className="px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-8">
        <LegalLinks />
      </footer>
    </Screen>
  );
}

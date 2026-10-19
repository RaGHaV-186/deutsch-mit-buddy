import { getTranslations } from "next-intl/server";
import { AuthShell } from "./ui";

type Section = { heading: string; body: string };

/** Renders one of the placeholder legal texts from messages/en.json ("Legal.<doc>"). */
export async function LegalPage({ doc }: { doc: "impressum" | "privacy" | "terms" }) {
  const t = await getTranslations("Legal");
  const sections = Object.values(t.raw(`${doc}.sections`) as Record<string, Section>);
  return (
    <AuthShell title={t(`${doc}.title`)}>
      <p role="note" className="rounded-lg border border-foreground/30 bg-foreground/5 px-3 py-2 text-sm">
        {t("placeholderNotice")}
      </p>
      {sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-bold">{s.heading}</h2>
          <p className="whitespace-pre-line">{s.body}</p>
        </section>
      ))}
    </AuthShell>
  );
}

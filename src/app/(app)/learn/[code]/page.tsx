import { SESSIONS } from "@data/curriculum";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppNav, CoatHeader, PillButton, Screen } from "@/components/ds";
import { LessonReader } from "@/components/learn/LessonReader";
import { requireAal2FromClaims } from "@/lib/auth/guard";
import { lessonTitle } from "@/lib/buddy-lines";
import { getPublishedLesson } from "@/lib/lessons/server";
import { createClient } from "@/lib/supabase/server";

/** The published lesson to read through. Any published lesson can be opened by its code (members see published lessons only). */
export default async function LessonPage({ params }: { params: Promise<{ code: string }> }) {
  await requireAal2FromClaims();
  const { code } = await params;
  const session = SESSIONS.find((s) => s.kind === "lesson" && s.code === decodeURIComponent(code));
  if (!session) notFound();
  const lesson = await getPublishedLesson(await createClient(), session.code);
  if (!lesson) notFound();
  const t = await getTranslations("Learn");
  return (
    <>
      <Screen withTabBar width="narrow">
        <CoatHeader compact>
          <p className="text-label uppercase text-on-coat-muted tabular">{session.code}</p>
          <h1 className="text-display break-words desk:text-[40px]">{lessonTitle(session)}</h1>
          <PillButton variant="blaze" href="/learn" className="mt-4">
            {t("back")}
          </PillButton>
        </CoatHeader>
        <div className="px-5 pb-8 pt-6 desk:px-0 desk:pt-8">
          <LessonReader lesson={lesson} />
        </div>
      </Screen>
      <AppNav active="learn" />
    </>
  );
}

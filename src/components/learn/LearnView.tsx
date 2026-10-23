import { useTranslations } from "next-intl";
import { AppNav, BuddyMascot, CoatHeader, Cushion, EmptyState, PillButton, Screen, SpeechBubble } from "@/components/ds";
import { PARTS } from "@/lib/content/lesson-schema";

// Exercises and the day exam are questions: they come with the lesson player, so they are listed but not opened here.
const PLAYER_PARTS = new Set<string>(["exercises", "exam"]);

export interface LearnLesson {
  day: number;
  code: string;
  title: string;
  /** The grammar point of the day. */
  grammar: string;
  /** The can-do goal; null while the lesson is not published. */
  goal: string | null;
  published: boolean;
  /** The learner's cards of this lesson: how many, how many are new. */
  cards: { total: number; fresh: number };
}

/** The Learn tab: today's lesson (goal, parts, cards). Weekends, reviews and tests have no lesson text yet. */
export function LearnView({ lesson, kind }: { lesson: LearnLesson | null; kind: "lesson" | "other" }) {
  const t = useTranslations("Learn");
  const parts = useTranslations("Learn.parts");
  const nav = useTranslations("Ds.nav");
  return (
    <>
      <Screen withTabBar width="narrow">
        <CoatHeader compact>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-3">
              {lesson ? <p className="text-label uppercase text-on-coat-muted tabular">{t("dayLabel", { day: lesson.day, code: lesson.code })}</p> : null}
              <h1 className="text-display break-words desk:text-[40px]">{lesson ? lesson.title : nav("learn")}</h1>
              <SpeechBubble>{lesson?.goal ?? t(kind === "lesson" ? "notReadyLine" : "restDayLine")}</SpeechBubble>
            </div>
            <BuddyMascot pose="resting" size={72} className="mt-1 shrink-0 desk:h-auto desk:w-[120px]" priority />
          </div>
        </CoatHeader>

        <div className="flex flex-col gap-4 px-5 pt-6 desk:px-0 desk:pt-8">
          {lesson?.published ? (
            <>
              <Cushion radius={28} className="flex flex-col gap-3 p-5">
                <p className="text-label uppercase text-muted">{t("grammarLabel")}</p>
                <p className="text-headline">{lesson.grammar}</p>
                <PillButton href={`/learn/${lesson.code}`} fullWidth>
                  {t("openLesson")}
                </PillButton>
              </Cushion>

              <Cushion radius={28} className="flex flex-col gap-3 p-5">
                <p className="text-label uppercase text-muted">{t("cardsLabel")}</p>
                <p className="text-headline">{lesson.cards.total === 0 ? t("noCards") : t("cardsCount", { total: lesson.cards.total, fresh: lesson.cards.fresh })}</p>
                <PillButton variant="cushion" href="/cards" fullWidth className="ring-1 ring-track">
                  {t("reviewCards")}
                </PillButton>
              </Cushion>

              <Cushion radius={28} className="flex flex-col gap-2 p-5">
                <p className="text-label uppercase text-muted">{t("partsLabel")}</p>
                <ol className="flex flex-col">
                  {PARTS.map((p, i) => (
                    <li key={p} className="border-b border-track last:border-0">
                      {PLAYER_PARTS.has(p) ? (
                        <span className="flex min-h-11 items-center gap-3 py-2 text-muted">
                          <span className="tabular w-6">{i + 1}</span>
                          <span className="font-semibold">{parts(p)}</span>
                        </span>
                      ) : (
                        <a href={`/learn/${lesson.code}#${p}`} className="ds-focus flex min-h-11 items-center gap-3 rounded-xl py-2">
                          <span className="tabular w-6 text-muted">{i + 1}</span>
                          <span className="font-semibold">{parts(p)}</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="text-caption text-muted">{t("playerLater")}</p>
              </Cushion>
            </>
          ) : (
            <EmptyState pose="curious" message={t(kind === "lesson" ? "notReady" : "restDay")} action={{ label: t("reviewCards"), href: "/cards" }} />
          )}
        </div>
      </Screen>
      <AppNav active="learn" />
    </>
  );
}

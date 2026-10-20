import { useTranslations } from "next-intl";
import {
  BuddyMascot,
  CoatHeader,
  DueCardsTile,
  FloatingTabBar,
  LevelCard,
  PawStreakWeek,
  PillButton,
  Screen,
  SpeechBubble,
  TreatChip,
} from "@/components/ds";
import type { GameData } from "@/lib/game-layer";
import { homeAction, type HomeAction } from "@/lib/home-action";

export interface HomeLesson {
  day: number;
  code: string;
  title: string;
}

interface Props {
  /** The learner's first name; null shows a plain "Hallo!". */
  name: string | null;
  /** Buddy's German line for today (already translated, without quotation marks). */
  line: string;
  /** Today's lesson from the curriculum; null if the profile has no valid session. */
  lesson: HomeLesson | null;
  /** Cards to review today plus new ones. */
  due: number;
  /** Game layer (streak, level, treats). null = switched off: none of it is rendered. */
  game: GameData | null;
  /** Content below the cards, above the tab bar (the temporary account row until the Me screen exists). */
  children?: React.ReactNode;
  /** The big button. Defaults to what is possible today (see lib/home-action.ts). */
  action?: HomeAction;
  /** "static" lets the /design page show the tab bar in place instead of pinned to the screen. */
  tabBar?: "fixed" | "static";
}

/** The Home screen: coat block with today's lesson and Continue, then cards due (and the game layer when it is on). */
export function HomeView({ name, line, lesson, due, game, children, tabBar = "fixed", action = homeAction() }: Props) {
  const t = useTranslations("App");
  const h = useTranslations("Home");
  const ds = useTranslations("Ds");
  return (
    <>
      <Screen withTabBar={tabBar === "fixed"}>
        <CoatHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-3">
              <h1 className="text-display break-words">{name ? t("hello", { name }) : t("helloNoName")}</h1>
              <SpeechBubble>{line}</SpeechBubble>
            </div>
            <BuddyMascot pose="happy" size={58} className="mt-1 shrink-0" priority />
          </div>
          {lesson ? (
            <div className="mt-5 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-label uppercase text-on-coat-muted tabular">{h("dayLabel", { day: lesson.day, code: lesson.code })}</p>
                {game ? <TreatChip>{ds("treats", { count: game.lessonReward })}</TreatChip> : null}
              </div>
              <h2 className="text-title">{lesson.title}</h2>
            </div>
          ) : null}
          <PillButton variant="blaze" fullWidth href={action.href} className="mt-5">
            {h(action.label)}
          </PillButton>
        </CoatHeader>

        <div className="flex flex-col gap-3 px-5 pt-5">
          {game ? <PawStreakWeek streak={game.streak} days={game.week} /> : null}
          <div className={game ? "grid grid-cols-[1.4fr_1fr] gap-3" : undefined}>
            {game ? <LevelCard level={game.level} treats={game.treats} nextAt={game.nextAt} /> : null}
            <DueCardsTile count={due} />
          </div>
          {game?.preview ? <p className="text-caption text-muted">{h("preview")}</p> : null}
          {children}
        </div>
      </Screen>
      <FloatingTabBar active="home" position={tabBar} />
    </>
  );
}

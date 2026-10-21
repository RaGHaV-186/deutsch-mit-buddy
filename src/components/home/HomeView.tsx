import { useTranslations } from "next-intl";
import {
  BuddyMascot,
  CoatHeader,
  DueCardsTile,
  AppNav,
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
  /** The big button. Defaults to what is possible today (see lib/home-action.ts). */
  action?: HomeAction;
  /** Desktop hero only: today's date in German, e.g. "Dienstag, 20. Oktober" (formatted on the server, in the learner's time zone). */
  dateLabel?: string;
  /** Desktop only: due cards split into reviews and new ones, for the caption of the cards tile. */
  dueDetail?: { reviews: number; fresh: number };
  /** "static" lets the /design page show the tab bar in place instead of pinned to the screen. */
  tabBar?: "fixed" | "static";
}

/** The Home screen: coat block with today's lesson and Continue, then cards due (and the game layer when it is on). */
export function HomeView({ name, line, lesson, due, game, dateLabel, dueDetail, tabBar = "fixed", action = homeAction() }: Props) {
  const t = useTranslations("App");
  const h = useTranslations("Home");
  const ds = useTranslations("Ds");
  return (
    <>
      <Screen withTabBar={tabBar === "fixed"}>
        <CoatHeader className="desk:min-h-[404px]">
          {dateLabel ? <p className="mb-2 hidden text-[15px] font-medium text-on-coat-muted desk:block">{dateLabel}</p> : null}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-3 desk:max-w-[calc(100%-260px)]">
              <h1 className="text-display break-words desk:text-[44px] desk:leading-[1.15]">{name ? t("hello", { name }) : t("helloNoName")}</h1>
              <SpeechBubble className="desk:px-5 desk:py-3 desk:text-[17px]">{line}</SpeechBubble>
            </div>
            <BuddyMascot
              pose="happy"
              size={58}
              className="mt-1 shrink-0 desk:absolute desk:bottom-0 desk:right-11 desk:mt-0 desk:h-auto desk:w-[210px]"
              priority
            />
          </div>
          {lesson ? (
            <div className="mt-5 flex flex-col gap-2 desk:mt-6 desk:max-w-[calc(100%-260px)]">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-label uppercase text-on-coat-muted tabular">{h("dayLabel", { day: lesson.day, code: lesson.code })}</p>
                {game ? <TreatChip>{ds("treats", { count: game.lessonReward })}</TreatChip> : null}
              </div>
              <h2 className="text-title desk:text-[32px] desk:leading-tight">{lesson.title}</h2>
            </div>
          ) : null}
          <PillButton variant="blaze" fullWidth href={action.href} className="mt-5 desk:mt-6 desk:w-auto">
            {h(action.label)}
          </PillButton>
        </CoatHeader>

        <div className="flex flex-col gap-3 px-5 pt-5 desk:grid desk:grid-cols-3 desk:gap-5 desk:px-0 desk:pt-6">
          {game ? <PawStreakWeek streak={game.streak} days={game.week} className="desk:order-2" /> : null}
          <div className={game ? "grid grid-cols-[1.4fr_1fr] gap-3 desk:contents" : "desk:contents"}>
            {game ? <LevelCard level={game.level} treats={game.treats} nextAt={game.nextAt} className="desk:order-3" /> : null}
            <DueCardsTile count={due} detail={dueDetail} bar={!game} className={game ? "desk:order-1" : "desk:col-span-3"} />
          </div>
          {game?.preview ? <p className="text-caption text-muted desk:order-4 desk:col-span-3">{h("preview")}</p> : null}
        </div>
      </Screen>
      <AppNav active="home" position={tabBar} />
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuddyMascot, EmptyState, FloatingTabBar, PillButton, Screen, TreatChip } from "@/components/ds";
import { buildQueue, type Direction, type Mode } from "@/lib/cards/queue";
import type { SnapshotCard } from "@/lib/cards/schema";
import { useDeck } from "@/lib/cards/use-deck";
import type { Grade } from "@/lib/srs";
import { safeTimeZone } from "@/lib/time";
import { CardOptions } from "./CardOptions";
import { CardsHub } from "./CardsHub";
import { ImportSeedButton } from "./ImportSeedButton";
import { ReviewSession } from "./ReviewSession";
import { SyncChip } from "./SyncChip";

const PREFS_KEY = "buddy.cards.prefs";
interface Prefs {
  mode: Mode;
  direction: Direction;
}
const DEFAULT_PREFS: Prefs = { mode: "both", direction: "en-de" };

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    return {
      mode: raw?.mode === "words" || raw?.mode === "speaking" || raw?.mode === "both" ? raw.mode : DEFAULT_PREFS.mode,
      direction: raw?.direction === "de-en" || raw?.direction === "en-de" ? raw.direction : DEFAULT_PREFS.direction,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

type View =
  | { name: "hub" }
  | { name: "review"; cards: SnapshotCard[]; run: number }
  | { name: "done"; answered: number; treats: number };

export function CardsApp({ userId, isAdmin, gameLayer }: { userId: string; isAdmin: boolean; gameLayer: boolean }) {
  const t = useTranslations("Cards");
  const ds = useTranslations("Ds");
  const [view, setView] = useState<View>({ name: "hub" });
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const answeredIds = useRef(new Set<string>());
  const deck = useDeck(userId, view.name === "review");
  const { reload, syncDeck, answer } = deck;

  // Saved choices are read after mount so the server and first client render match.
  useEffect(() => {
    const saved = readPrefs();
    queueMicrotask(() => setPrefs(saved));
  }, []);

  const updatePrefs = (next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const queueFor = useCallback(
    (mode: Mode) =>
      buildQueue(deck.cards, {
        mode,
        now: new Date(),
        timezone: safeTimeZone(deck.info?.timezone),
        newToday: deck.info?.newToday ?? 0,
      }),
    [deck.cards, deck.info],
  );
  // `view` is a dependency so the counts are recomputed when coming back from a session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queue = useMemo(() => queueFor(prefs.mode), [queueFor, prefs.mode, view]);

  const finish = useCallback(
    (answered: number, treats: number) => {
      setView(answered > 0 ? { name: "done", answered, treats } : { name: "hub" });
      void reload().then(() => syncDeck(true));
    },
    [reload, syncDeck],
  );

  const answerAndRemember = useCallback(
    (card: SnapshotCard, grade: Grade, ms: number) => {
      answeredIds.current.add(card.id);
      return answer(card, grade, ms);
    },
    [answer],
  );

  const start = () => {
    answeredIds.current = new Set();
    setView({ name: "review", cards: queue.cards, run: 0 });
  };

  /** Changing what to practise mid-session starts a fresh queue from today's cards, without the ones just answered. */
  const changeMode = (mode: Mode) => {
    updatePrefs({ ...prefs, mode });
    if (view.name !== "review") return;
    const cards = queueFor(mode).cards.filter((c) => !answeredIds.current.has(c.id));
    setView(cards.length > 0 ? { name: "review", cards, run: view.run + 1 } : { name: "hub" });
  };

  const options = (
    <CardOptions
      open={optionsOpen}
      onClose={() => setOptionsOpen(false)}
      mode={prefs.mode}
      direction={prefs.direction}
      onMode={changeMode}
      onDirection={(direction) => updatePrefs({ ...prefs, direction })}
      inSession={view.name === "review"}
    />
  );

  if (view.name === "review") {
    return (
      <>
        <ReviewSession
          key={view.run}
          cards={view.cards}
          direction={prefs.direction}
          gameLayer={gameLayer}
          onAnswer={answerAndRemember}
          onFinish={finish}
          onOptions={() => setOptionsOpen(true)}
        />
        {options}
      </>
    );
  }

  if (view.name === "done") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-4 px-5 py-10 text-center">
        <BuddyMascot pose="happy" size={140} priority />
        <h1 className="text-display">{t("done.title")}</h1>
        <p className="text-[18px]">{t("done.body", { count: view.answered })}</p>
        {gameLayer ? <TreatChip>{ds("treats", { count: view.treats })}</TreatChip> : null}
        <SyncChip sync={deck.sync} pending={deck.pending} onRetry={() => void syncDeck(true)} />
        <div className="mt-2 flex w-full flex-col gap-3">
          <PillButton variant="coat" fullWidth href="/home">
            {t("backHome")}
          </PillButton>
          <PillButton variant="cushion" fullWidth onClick={() => setView({ name: "hub" })}>
            {t("done.back")}
          </PillButton>
        </div>
      </main>
    );
  }

  const noDeck = deck.status === "ready" && deck.cards.length === 0;
  const ready = deck.status === "ready" && !noDeck;
  return (
    <>
      <Screen withTabBar>
        <CardsHub counts={ready ? queue.counts : null} onStart={start} onOptions={() => setOptionsOpen(true)} />
        <div className="flex flex-col gap-4 px-5 pt-5">
          <SyncChip sync={deck.sync} pending={deck.pending} onRetry={() => void syncDeck(true)} />
          {deck.status === "no-storage" ? (
            <p role="alert">{t("empty.storage")}</p>
          ) : deck.status === "loading" || (noDeck && !deck.firstSyncDone) ? (
            <p className="text-center text-muted">{t("empty.loading")}</p>
          ) : noDeck ? (
            <EmptyState pose="resting" message={deck.sync === "offline" ? t("empty.offline") : t("empty.none")} />
          ) : null}
          {isAdmin && deck.status !== "no-storage" ? <ImportSeedButton onImported={() => void syncDeck(true)} /> : null}
        </div>
      </Screen>
      <FloatingTabBar active="cards" />
      {options}
    </>
  );
}

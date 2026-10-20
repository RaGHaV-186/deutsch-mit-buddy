"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { primaryButtonClass } from "@/components/ui";
import { buildQueue, type Direction, type Mode } from "@/lib/cards/queue";
import type { SnapshotCard } from "@/lib/cards/schema";
import { useDeck } from "@/lib/cards/use-deck";
import { safeTimeZone } from "@/lib/time";
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

type View = { name: "hub" } | { name: "review"; cards: SnapshotCard[] } | { name: "done"; answered: number };

export function CardsApp({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const t = useTranslations("Cards");
  const [view, setView] = useState<View>({ name: "hub" });
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const deck = useDeck(userId, view.name === "review");
  const { reload, syncDeck } = deck;

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

  const queue = useMemo(
    () =>
      buildQueue(deck.cards, {
        mode: prefs.mode,
        now: new Date(),
        timezone: safeTimeZone(deck.info?.timezone),
        newToday: deck.info?.newToday ?? 0,
      }),
    // `view` is a dependency so the counts are recomputed when coming back from a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck.cards, deck.info, prefs.mode, view],
  );

  const finish = useCallback(
    (answered: number) => {
      setView(answered > 0 ? { name: "done", answered } : { name: "hub" });
      void reload().then(() => syncDeck(true));
    },
    [reload, syncDeck],
  );

  const header = (
    <header className="flex items-center justify-between gap-3">
      <h1 className="font-heading text-2xl font-bold">{t("title")}</h1>
      <Link href="/home" className="text-sm font-bold text-der underline underline-offset-2 dark:text-sky-300">
        {t("backHome")}
      </Link>
    </header>
  );

  if (view.name === "review") {
    return (
      <ReviewSession
        cards={view.cards}
        direction={prefs.direction}
        onAnswer={deck.answer}
        onFinish={finish}
      />
    );
  }

  if (view.name === "done") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <Image src="/buddy/buddy-happy.svg" alt="" width={140} height={142} />
        <h1 className="font-heading text-3xl font-bold">{t("done.title")}</h1>
        <p>{t("done.body", { count: view.answered })}</p>
        <SyncChip sync={deck.sync} pending={deck.pending} onRetry={() => void syncDeck(true)} />
        <button type="button" className={`${primaryButtonClass} max-w-xs`} onClick={() => setView({ name: "hub" })}>
          {t("done.back")}
        </button>
      </main>
    );
  }

  const noDeck = deck.status === "ready" && deck.cards.length === 0;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-4">
      {header}
      <SyncChip sync={deck.sync} pending={deck.pending} onRetry={() => void syncDeck(true)} />

      {deck.status === "no-storage" ? (
        <p role="alert">{t("empty.storage")}</p>
      ) : deck.status === "loading" || (noDeck && !deck.firstSyncDone) ? (
        <p className="text-muted">{t("empty.loading")}</p>
      ) : noDeck ? (
        <p>{deck.sync === "offline" ? t("empty.offline") : t("empty.none")}</p>
      ) : (
        <CardsHub
          counts={queue.counts}
          mode={prefs.mode}
          direction={prefs.direction}
          onMode={(mode) => updatePrefs({ ...prefs, mode })}
          onDirection={(direction) => updatePrefs({ ...prefs, direction })}
          onStart={() => setView({ name: "review", cards: queue.cards })}
        />
      )}

      {isAdmin && deck.status !== "no-storage" ? <ImportSeedButton onImported={() => void syncDeck(true)} /> : null}
    </main>
  );
}

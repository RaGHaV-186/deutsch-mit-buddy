"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compactButtonClass, primaryButtonClass } from "@/components/ui";
import { buildCardView } from "@/lib/cards/display";
import { requeue, type Direction } from "@/lib/cards/queue";
import type { SnapshotCard } from "@/lib/cards/schema";
import { GRADES, previewInterval, type Grade } from "@/lib/srs";
import { stopSpeaking } from "@/lib/speech";
import { AudioBar } from "./AudioBar";
import { CardFace } from "./CardFace";

interface Props {
  cards: SnapshotCard[];
  direction: Direction;
  /** Saves the answer on this device and resolves with the card's updated schedule. */
  onAnswer: (card: SnapshotCard, grade: Grade, msTaken: number) => Promise<SnapshotCard>;
  /** Called when the queue is empty (answered = number of answers given) or the learner ends the session. */
  onFinish: (answered: number) => void;
}

export function ReviewSession({ cards, direction, onAnswer, onFinish }: Props) {
  const t = useTranslations("Cards");
  const [queue, setQueue] = useState(cards);
  const [answered, setAnswered] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(0);
  const current = queue[0];

  const view = useMemo(() => (current ? buildCardView(current, direction) : null), [current, direction]);
  const previews = useMemo(
    () => (current ? GRADES.map((g) => [g, previewInterval(current.srs, g, new Date())] as const) : []),
    [current],
  );

  useEffect(() => {
    shownAt.current = Date.now();
    return () => stopSpeaking();
  }, [current?.id]);

  const flip = useCallback(() => setFlipped(true), []);

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const updated = await onAnswer(current, g, Date.now() - shownAt.current);
        const rest = queue.slice(1);
        // "Again" comes back a few cards later in this same session.
        const next = g === "again" ? requeue(rest, updated) : rest;
        setQueue(next);
        setAnswered((n) => n + 1);
        setFlipped(false);
        if (next.length === 0) onFinish(answered + 1);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, queue, onAnswer, answered, onFinish],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        flip();
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        void grade(GRADES[Number(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, flip, grade]);

  if (!current || !view) return null;
  const audio = flipped ? view.speak : view.frontSpeak;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={`${compactButtonClass} min-h-11 whitespace-nowrap px-3 text-sm`} onClick={() => onFinish(answered)}>
          {t("exit")}
        </button>
        <p className="whitespace-nowrap font-bold" aria-live="polite">
          {t("left", { count: queue.length })}
        </p>
      </div>

      <div
        className="flex min-h-64 flex-1 flex-col items-center justify-center gap-6 rounded-2xl border border-foreground/20 p-5"
        onClick={flipped ? undefined : flip}
      >
        <div aria-live="polite" className="w-full">
          <CardFace view={view} side={flipped ? "back" : "front"} />
        </div>
        {audio ? <AudioBar key={`${current.id}-${flipped}`} speakView={audio} /> : null}
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {flipped ? (
          <div role="group" aria-label={t("gradeGroup")} className="grid grid-cols-4 gap-2">
            {previews.map(([g, preview], i) => (
              <button
                key={g}
                type="button"
                disabled={busy}
                onClick={() => grade(g)}
                className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-foreground/30 px-1 py-2 text-base font-bold hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-der disabled:opacity-60"
              >
                <span>{t(`grade.${g}`)}</span>
                <span className="text-xs font-normal text-muted">
                  {t(`gradeHint.${preview.unit}`, { n: preview.value })}
                  <span className="sr-only"> ({i + 1})</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button type="button" className={`${primaryButtonClass} min-h-14`} onClick={flip}>
              {t("flip")}
            </button>
            <p className="text-center text-sm text-muted">{t("flipHint")}</p>
          </>
        )}
      </div>
    </div>
  );
}

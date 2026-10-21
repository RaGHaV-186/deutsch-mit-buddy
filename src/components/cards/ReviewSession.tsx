"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, PillButton, SlidersIcon, TreatFloat, WedgeProgress } from "@/components/ds";
import { buildCardView } from "@/lib/cards/display";
import { requeue, type Direction } from "@/lib/cards/queue";
import type { SnapshotCard } from "@/lib/cards/schema";
import { GRADE_TREATS } from "@/lib/game-layer";
import { speak, stopSpeaking } from "@/lib/speech";
import { GRADES, previewInterval, type Grade } from "@/lib/srs";
import { FlashCard } from "./FlashCard";

interface Props {
  cards: SnapshotCard[];
  direction: Direction;
  /** Game layer on: combo chip, treat labels on the buttons, floating "+10". Off: none of it, and nothing is counted. */
  gameLayer: boolean;
  /** Saves the answer on this device and resolves with the card's updated schedule. */
  onAnswer: (card: SnapshotCard, grade: Grade, msTaken: number) => Promise<SnapshotCard>;
  /** Called when the queue is empty or the learner closes the session. `treats` is 0 unless the game layer is on. */
  onFinish: (answered: number, treats: number) => void;
  onOptions: () => void;
}

const GRADE_VARIANT = { again: "cushion", hard: "cushion", good: "coat", easy: "cushion" } as const;

/** Focus mode: no tab bar. Progress and Close on top, the flashcard, then Show answer / the four grade buttons. */
export function ReviewSession({ cards, direction, gameLayer, onAnswer, onFinish, onOptions }: Props) {
  const t = useTranslations("Cards");
  const ds = useTranslations("Ds");
  const [queue, setQueue] = useState(cards);
  const [answered, setAnswered] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [combo, setCombo] = useState(0);
  const [treats, setTreats] = useState(0);
  const [float, setFloat] = useState<{ key: number; amount: number } | null>(null);
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
        const earned = gameLayer ? GRADE_TREATS[g] : 0;
        const nextCombo = g === "again" ? 0 : g === "hard" ? combo : combo + 1;
        setQueue(next);
        setAnswered((n) => n + 1);
        setFlipped(false);
        setCombo(nextCombo);
        setTreats((n) => n + earned);
        if (gameLayer && earned > 0) setFloat((f) => ({ key: (f?.key ?? 0) + 1, amount: earned }));
        if (next.length === 0) onFinish(answered + 1, treats + earned);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, queue, onAnswer, answered, onFinish, gameLayer, combo, treats],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !view) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) flip();
        else {
          const text = view.speak.word ?? view.speak.sentence;
          if (text) void speak(text);
        }
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        void grade(GRADES[Number(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, flip, grade, view]);

  if (!current || !view) return null;
  const progress = answered / Math.max(1, answered + queue.length);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <div className="flex items-center gap-3 px-5 pt-[max(20px,calc(env(safe-area-inset-top)+16px))]">
        <button
          type="button"
          onClick={() => onFinish(answered, treats)}
          aria-label={t("close")}
          className="ds-press ds-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-cushion"
        >
          <CloseIcon size={20} />
        </button>
        <WedgeProgress value={progress} marker height={12} label={t("progress")} className="min-w-0 flex-1" />
        <p className="whitespace-nowrap text-[14px] font-bold tabular" aria-live="polite">
          {t("left", { count: queue.length })}
        </p>
        <button
          type="button"
          onClick={onOptions}
          aria-label={t("options.button")}
          className="ds-press ds-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-cushion"
        >
          <SlidersIcon size={20} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-6">
        <FlashCard view={view} cardId={current.id} flipped={flipped} combo={gameLayer ? combo : null} onFlip={flip} />
      </div>

      <div className="relative px-5 pb-[max(34px,env(safe-area-inset-bottom))]">
        {float ? <TreatFloat key={float.key}>{ds("treats", { count: float.amount })}</TreatFloat> : null}
        {flipped ? (
          <div role="group" aria-label={t("gradeGroup")} className="grid grid-cols-2 gap-[10px]">
            {previews.map(([g, preview], i) => (
              <PillButton key={g} variant={GRADE_VARIANT[g]} size={60} disabled={busy} className="px-3" onClick={() => grade(g)}>
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-[16px]">{t(`grade.${g}`)}</span>
                  <span className="text-[12px] font-medium opacity-80">
                    {t(`gradeHint.${preview.unit}`, { n: preview.value })}
                    {gameLayer ? ` · ${ds("treats", { count: GRADE_TREATS[g] })}` : ""}
                    <span className="sr-only"> ({i + 1})</span>
                  </span>
                </span>
              </PillButton>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PillButton variant="coat" size={60} fullWidth onClick={flip}>
              {t("flip")}
            </PillButton>
            <p className="text-center text-caption text-muted">{t("flipHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

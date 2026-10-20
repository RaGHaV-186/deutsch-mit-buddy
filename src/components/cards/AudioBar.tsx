"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SpeakView } from "@/lib/cards/display";
import { speak, type SpeakResult } from "@/lib/speech";
import { compactButtonClass } from "@/components/ui";

type Target = "word" | "sentence";
const buttonClass = `${compactButtonClass} min-h-12`;

/**
 * Play word / Play sentence / Slow. "Slow" repeats whichever was played last (the word, or the sentence if there is no word).
 * Give it a `key` that changes with the card and the side, so its state starts fresh.
 */
export function AudioBar({ speakView }: { speakView: SpeakView }) {
  const t = useTranslations("Cards.audio");
  const first: Target = speakView.word ? "word" : "sentence";
  const [last, setLast] = useState<Target>(first);
  const [problem, setProblem] = useState<SpeakResult | null>(null);

  async function play(target: Target, slow: boolean) {
    const text = target === "word" ? speakView.word : speakView.sentence;
    if (!text) return;
    setLast(target);
    const result = await speak(text, { slow });
    setProblem(result === "spoken" ? null : result);
  }

  if (!speakView.word && !speakView.sentence) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        {speakView.word ? (
          <button type="button" className={buttonClass} onClick={() => play("word", false)}>
            {t("word")}
          </button>
        ) : null}
        {speakView.sentence ? (
          <button type="button" className={buttonClass} onClick={() => play("sentence", false)}>
            {t("sentence")}
          </button>
        ) : null}
        <button type="button" className={buttonClass} onClick={() => play(last, true)}>
          {t("slow")}
        </button>
      </div>
      {problem ? (
        <p role="status" className="max-w-sm text-center text-sm text-muted">
          {problem === "no-voice" ? t("noVoice") : t("unsupported")}
        </p>
      ) : null}
    </div>
  );
}

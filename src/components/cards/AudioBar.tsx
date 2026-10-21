"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PillButton, SpeakerIcon } from "@/components/ds";
import type { SpeakView } from "@/lib/cards/display";
import { speak, type SpeakResult } from "@/lib/speech";

type Target = "word" | "sentence";

/**
 * Play word / Play sentence / Slow, sitting on the coat strip of the card. "Slow" repeats whichever was played last
 * (the word, or the sentence if there is no word). Give it a `key` that changes with the card and the side.
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
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {speakView.word ? (
          <PillButton variant="blaze" size={44} icon={<SpeakerIcon size={20} />} className="px-4" onClick={() => play("word", false)}>
            {t("word")}
          </PillButton>
        ) : null}
        {speakView.sentence ? (
          <PillButton variant="blaze" size={44} icon={<SpeakerIcon size={20} />} className="px-4" onClick={() => play("sentence", false)}>
            {t("sentence")}
          </PillButton>
        ) : null}
        <PillButton variant="outline-on-coat" size={44} className="px-4" onClick={() => play(last, true)}>
          {t("slow")}
        </PillButton>
      </div>
      {problem ? (
        <p role="status" className="max-w-[28ch] text-right text-caption text-on-coat-muted">
          {problem === "no-voice" ? t("noVoice") : t("unsupported")}
        </p>
      ) : null}
    </div>
  );
}

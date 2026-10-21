"use client";

import { useTranslations } from "next-intl";
import { BuddyMascot, CoatHeader, PillButton, SlidersIcon } from "@/components/ds";
import type { QueueCounts } from "@/lib/cards/queue";

interface Props {
  /** null while the deck isn't available (loading, empty, offline without data): just the title is shown. */
  counts: QueueCounts | null;
  onStart: () => void;
  onOptions: () => void;
}

/** The Cards tab's coat block: today's reviews and new cards, Start review, and the options button. */
export function CardsHub({ counts, onStart, onOptions }: Props) {
  const t = useTranslations("Cards");
  const total = counts ? counts.due + counts.fresh : 0;
  return (
    <CoatHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display">{t("title")}</h1>
          {counts ? (
            <>
              <p className="mt-3 text-title tabular">{t("due", { count: counts.due })}</p>
              <p className="text-[16px] text-on-coat-muted tabular">{t("fresh", { count: counts.fresh })}</p>
              {counts.waiting > 0 ? <p className="text-caption text-on-coat-muted tabular">{t("waiting", { count: counts.waiting })}</p> : null}
              {total === 0 ? <p className="text-[16px] text-on-coat-muted">{t("allDone")}</p> : null}
            </>
          ) : null}
        </div>
        <BuddyMascot pose={counts && total === 0 ? "resting" : "happy"} size={58} className="mt-1 shrink-0" priority />
      </div>
      {counts ? (
        <div className="mt-5 flex gap-3">
          <PillButton variant="blaze" className="flex-1" disabled={total === 0} onClick={onStart}>
            {t("start")}
          </PillButton>
          <PillButton variant="outline-on-coat" icon={<SlidersIcon size={20} />} className="px-5" onClick={onOptions}>
            {t("options.button")}
          </PillButton>
        </div>
      ) : null}
    </CoatHeader>
  );
}

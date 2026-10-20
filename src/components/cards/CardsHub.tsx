"use client";

import { useTranslations } from "next-intl";
import { primaryButtonClass } from "@/components/ui";
import { DIRECTIONS, MODES, type Direction, type Mode, type QueueCounts } from "@/lib/cards/queue";

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  text,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  text: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <p className="font-bold">{label}</p>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-foreground/20 p-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            className={`min-h-12 rounded-lg px-2 py-2 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              o === value ? "bg-coat text-on-coat" : "hover:bg-foreground/5"
            }`}
          >
            {text(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  counts: QueueCounts;
  mode: Mode;
  direction: Direction;
  onMode: (m: Mode) => void;
  onDirection: (d: Direction) => void;
  onStart: () => void;
}

export function CardsHub({ counts, mode, direction, onMode, onDirection, onStart }: Props) {
  const t = useTranslations("Cards");
  const total = counts.due + counts.fresh;
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1 rounded-xl border border-foreground/20 p-4 text-center">
        <p className="font-heading text-2xl font-bold">{t("due", { count: counts.due })}</p>
        <p>{t("fresh", { count: counts.fresh })}</p>
        {counts.waiting > 0 ? <p className="text-sm text-muted">{t("waiting", { count: counts.waiting })}</p> : null}
        {total === 0 ? <p className="mt-1 text-muted">{t("allDone")}</p> : null}
      </section>

      <Choice label={t("mode.label")} value={mode} options={MODES} onChange={onMode} text={(m) => t(`mode.${m}`)} />
      <Choice
        label={t("direction.label")}
        value={direction}
        options={DIRECTIONS}
        onChange={onDirection}
        text={(d) => t(d === "en-de" ? "direction.enDe" : "direction.deEn")}
      />

      <button type="button" className={`${primaryButtonClass} min-h-14`} disabled={total === 0} onClick={onStart}>
        {t("start")}
      </button>
    </div>
  );
}

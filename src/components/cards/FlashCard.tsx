import { useTranslations } from "next-intl";
import { BlazeNotch, PawIcon, SlidersIcon } from "@/components/ds";
import type { CardView } from "@/lib/cards/display";
import { AudioBar } from "./AudioBar";
import { CardFace } from "./CardFace";

interface Props {
  view: CardView;
  cardId: string;
  flipped: boolean;
  /** Answers in a row (Got it / Easy). Shown from 3, game layer only: pass null when that layer is off. */
  combo: number | null;
  onFlip?: () => void;
  /** Desktop: the options button sits at the right end of the coat strip (on phones it is in the top bar). */
  onOptions?: () => void;
}

/**
 * The flashcard: a coat strip on top (combo chip on the left, audio on the right) joined to the white body by the
 * blaze notch. Tapping an unflipped card shows the answer. On desktop the direction label moves from the strip into the
 * card body, and the options button joins the audio buttons in the strip.
 */
export function FlashCard({ view, cardId, flipped, combo, onFlip, onOptions }: Props) {
  const t = useTranslations("Cards");
  const audio = flipped ? view.speak : view.frontSpeak;
  const comboOn = combo !== null && combo >= 3;
  const direction = t(view.direction === "en-de" ? "direction.enDe" : "direction.deEn");
  return (
    <div
      className="flex flex-1 flex-col overflow-hidden rounded-[32px] bg-surface shadow-cushion desk:min-h-[520px] desk:flex-none"
      onClick={flipped ? undefined : onFlip}
    >
      <div className="relative flex min-h-[84px] flex-wrap items-start justify-between gap-3 rounded-coat-card bg-coat px-[18px] pb-10 pt-5 text-on-coat desk:min-h-[106px] desk:flex-nowrap desk:items-center desk:pb-12 desk:pt-4">
        <div className="flex min-h-11 items-center">
          {comboOn ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-bubble px-4 text-[14px] font-bold tabular">
              <PawIcon size={16} />
              {t("combo", { count: combo })}
            </span>
          ) : (
            <span className="text-label uppercase text-on-coat-muted desk:hidden">{direction}</span>
          )}
        </div>
        <div className="flex items-start gap-2 desk:items-center">
          {audio ? <AudioBar key={`${cardId}-${flipped}`} speakView={audio} /> : null}
          {onOptions ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOptions();
              }}
              aria-label={t("options.button")}
              className="ds-press ds-focus hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-coat [--ring:var(--on-coat)] desk:flex"
            >
              <SlidersIcon size={20} />
            </button>
          ) : null}
        </div>
        <BlazeNotch small fill="var(--surface)" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center desk:px-10 desk:py-12" aria-live="polite">
        {flipped || !view.front.label ? <p className="mb-5 hidden text-label uppercase text-muted desk:block">{direction}</p> : null}
        <CardFace view={view} side={flipped ? "back" : "front"} />
      </div>
    </div>
  );
}

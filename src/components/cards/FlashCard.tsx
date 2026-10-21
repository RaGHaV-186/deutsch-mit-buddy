import { useTranslations } from "next-intl";
import { BlazeNotch, PawIcon } from "@/components/ds";
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
}

/**
 * The flashcard: a coat strip on top (combo chip on the left, audio on the right) joined to the white body by the
 * blaze notch. Tapping an unflipped card shows the answer.
 */
export function FlashCard({ view, cardId, flipped, combo, onFlip }: Props) {
  const t = useTranslations("Cards");
  const audio = flipped ? view.speak : view.frontSpeak;
  return (
    <div
      className="flex flex-1 flex-col overflow-hidden rounded-[32px] bg-surface shadow-cushion"
      onClick={flipped ? undefined : onFlip}
    >
      <div className="relative flex min-h-[84px] flex-wrap items-start justify-between gap-3 rounded-coat-card bg-coat px-[18px] pb-10 pt-5 text-on-coat">
        <div className="flex min-h-11 items-center">
          {combo !== null && combo >= 3 ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-bubble px-4 text-[14px] font-bold tabular">
              <PawIcon size={16} />
              {t("combo", { count: combo })}
            </span>
          ) : (
            <span className="text-label uppercase text-on-coat-muted">{t(view.direction === "en-de" ? "direction.enDe" : "direction.deEn")}</span>
          )}
        </div>
        {audio ? <AudioBar key={`${cardId}-${flipped}`} speakView={audio} /> : null}
        <BlazeNotch small fill="var(--surface)" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center" aria-live="polite">
        <CardFace view={view} side={flipped ? "back" : "front"} />
      </div>
    </div>
  );
}

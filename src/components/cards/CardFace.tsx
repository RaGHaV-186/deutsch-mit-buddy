import { useTranslations } from "next-intl";
import { articleColor, type CardView } from "@/lib/cards/display";

const toneVar = articleColor;

/** One side of a card: `front` while guessing, `back` after the flip. Layout follows CLAUDE.md "Card format". */
export function CardFace({ view, side }: { view: CardView; side: "front" | "back" }) {
  const t = useTranslations("Cards");
  const { front, back } = view;

  if (side === "front") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        {front.label ? <p className="text-sm font-bold uppercase tracking-wide text-muted">{t(`label.${front.label}`)}</p> : null}
        <p className="font-heading text-3xl font-bold leading-snug" style={front.article ? { color: toneVar(front.article) } : undefined}>
          {front.article && front.article !== "none" ? `${front.article} ` : ""}
          {front.text}
        </p>
        {front.context ? <p className="text-muted">({front.context})</p> : null}
      </div>
    );
  }

  const color = { color: toneVar(back.article) };
  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <p className="font-heading text-3xl font-bold leading-snug" style={color} data-testid="german">
        {back.articleText ? `${back.articleText} ` : ""}
        {back.german}
      </p>
      {back.forms ? <p className="text-lg text-muted">{back.forms}</p> : null}
      {back.english ? <p className="text-xl">{back.english}</p> : null}
      {back.example ? (
        <div className="mt-1 flex flex-col gap-0.5 border-t border-foreground/15 pt-3">
          <p className="text-lg">{back.example}</p>
          {back.exampleEn ? <p className="text-muted">{back.exampleEn}</p> : null}
        </div>
      ) : null}
      {back.tip ? <p className="mt-1 rounded-lg bg-foreground/5 px-3 py-2 text-sm text-muted">{back.tip}</p> : null}
    </div>
  );
}

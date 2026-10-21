import { useTranslations } from "next-intl";
import { ArticleWord } from "@/components/ds";
import type { CardView } from "@/lib/cards/display";
import { cx } from "@/components/ds/cx";

/** The white body of a flashcard: the front while guessing, the full back after the flip. Layout follows CLAUDE.md "Card format". */
export function CardFace({ view, side }: { view: CardView; side: "front" | "back" }) {
  const t = useTranslations("Cards");
  const { front, back } = view;

  if (side === "front") {
    const isWord = Boolean(front.article) || front.text.length <= 22;
    return (
      <div className="flex flex-col items-center gap-3">
        {front.label ? <p className="text-label uppercase text-muted">{t(`label.${front.label}`)}</p> : null}
        <p className={cx("break-words font-extrabold", isWord ? "text-word desk:text-[56px]" : "text-title desk:text-[32px]")} data-testid="front">
          {front.article && front.article !== "none" ? <ArticleWord article={front.article} word={front.text} /> : front.text}
        </p>
        {front.context ? <p className="text-muted">({front.context})</p> : null}
      </div>
    );
  }

  const isNoun = Boolean(back.articleText);
  const headword = back.german.length <= 22 || isNoun;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className={cx("break-words font-extrabold", headword ? "text-word desk:text-[56px]" : "text-title desk:text-[32px]")} data-testid="german">
        <ArticleWord article={back.articleText} word={back.german} />
      </p>
      {back.forms ? <p className="text-[16px] text-muted">{isNoun ? t("plural", { forms: back.forms }) : back.forms}</p> : null}
      {back.english ? <p className="text-[22px] font-bold leading-snug">{back.english}</p> : null}
      {back.example ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-[18px] font-medium">{back.example}</p>
          {back.exampleEn ? <p className="text-[15px] text-muted">{back.exampleEn}</p> : null}
        </div>
      ) : null}
      {back.tip ? <p className="mt-1 rounded-field bg-bg px-3 py-2 text-caption text-muted">{back.tip}</p> : null}
    </div>
  );
}

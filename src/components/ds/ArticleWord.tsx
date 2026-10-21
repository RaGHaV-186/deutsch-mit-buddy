import { articleToken, type Article } from "@/theme";
import { cx } from "./cx";

interface Props {
  /** "der", "die" or "das" (any case); null for words without one. */
  article: string | null | undefined;
  word: string;
  /** Plural articles (always "die") are shown muted so they don't read as feminine. */
  plural?: boolean;
  className?: string;
}

/** A noun with its article coloured by gender: der blue, die red, das green. Only on page and card surfaces, never on the coat block. */
export function ArticleWord({ article, word, plural = false, className }: Props) {
  const lower = article?.toLowerCase();
  const tone: Article = lower === "der" || lower === "die" || lower === "das" ? lower : "none";
  const color = plural ? "var(--muted)" : `var(--${articleToken(tone)})`;
  return (
    <span className={className}>
      {article ? (
        <>
          <span style={{ color }} data-article={plural ? "plural" : tone}>
            {article}
          </span>{" "}
        </>
      ) : null}
      <span className={cx("text-text")}>{word}</span>
    </span>
  );
}

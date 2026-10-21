import { useTranslations } from "next-intl";
import { Cushion } from "./Cushion";
import { cx } from "./cx";
import { ArrowRightIcon, CardsIcon } from "./icons";

interface Props {
  count: number;
  href?: string;
  /** Desktop only: the split shown instead of the plain caption, "cards due · 29 reviews, 20 new". */
  detail?: { reviews: number; fresh: number };
  /** Desktop only: a full-width horizontal bar instead of a tile (Home without the game layer). */
  bar?: boolean;
  className?: string;
}

/** "29 cards due · Review →", linking to the deck. On desktop it is a taller tile with a cards icon, or a full-width bar. */
export function DueCardsTile({ count, href = "/cards", detail, bar = false, className }: Props) {
  const t = useTranslations("Ds.due");
  return (
    <Cushion
      href={href}
      radius={28}
      className={cx(
        "flex h-full flex-col justify-between gap-1 p-[18px] desk:gap-2 desk:p-6",
        bar && "desk:flex-row desk:items-center desk:gap-4 desk:px-6 desk:py-5",
        className,
      )}
    >
      <span className={cx("hidden desk:block", bar && "desk:shrink-0")}>
        <CardsIcon size={24} className="text-muted" />
      </span>
      <span className={cx("text-[26px] font-extrabold leading-none tabular desk:text-[40px]", bar && "desk:shrink-0")}>{count}</span>
      <span className={cx("text-[14px] font-medium text-muted", bar && "desk:flex-1")}>
        {detail ? (
          <>
            <span className="desk:hidden">{t("cards", { count })}</span>
            <span className="hidden desk:inline">{t("detail", { count, reviews: detail.reviews, fresh: detail.fresh })}</span>
          </>
        ) : (
          t("cards", { count })
        )}
      </span>
      <span className="mt-1 inline-flex items-center gap-1 text-[15px] font-bold desk:mt-0">
        {t("review")} <ArrowRightIcon size={16} />
      </span>
    </Cushion>
  );
}

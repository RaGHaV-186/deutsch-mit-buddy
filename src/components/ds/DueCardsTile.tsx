import { useTranslations } from "next-intl";
import { Cushion } from "./Cushion";
import { ArrowRightIcon } from "./icons";

/** "29 cards due · Review →", linking to the deck. */
export function DueCardsTile({ count, href = "/cards" }: { count: number; href?: string }) {
  const t = useTranslations("Ds.due");
  return (
    <Cushion href={href} radius={28} className="flex h-full flex-col justify-between gap-1 p-[18px]">
      <span className="text-[26px] font-extrabold leading-none tabular">{count}</span>
      <span className="text-[14px] font-medium text-muted">{t("cards", { count })}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-[15px] font-bold">
        {t("review")} <ArrowRightIcon size={16} />
      </span>
    </Cushion>
  );
}

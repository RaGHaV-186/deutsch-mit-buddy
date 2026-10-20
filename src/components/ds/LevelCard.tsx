import { useTranslations } from "next-intl";
import { Cushion } from "./Cushion";
import { WedgeProgress } from "./WedgeProgress";

const fmt = (n: number) => n.toLocaleString("en-US");

interface Props {
  level: number;
  /** Treats collected in total. */
  treats: number;
  /** Treats needed for the next level. */
  nextAt: number;
  /** Treats where this level began. Default: 500 below nextAt. */
  levelStart?: number;
}

/** "Level 3", the treat count and a wedge bar to the next level. */
export function LevelCard({ level, treats, nextAt, levelStart = nextAt - 500 }: Props) {
  const t = useTranslations("Ds.level");
  const span = Math.max(1, nextAt - levelStart);
  // The bar and its label both count inside this level: "240 / 500". The running total is the caption under the title.
  const inLevel = Math.min(span, Math.max(0, treats - levelStart));
  return (
    <Cushion radius={28} className="flex h-full flex-col justify-between gap-2.5 p-[18px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-extrabold leading-tight">{t("title", { level })}</h2>
          <p className="text-[12px] font-medium text-muted tabular">{t("total", { count: fmt(treats) })}</p>
        </div>
        <p className="text-[12px] font-medium text-muted tabular">
          {fmt(inLevel)} / {fmt(span)}
        </p>
      </div>
      <WedgeProgress value={inLevel / span} height={12} label={t("progressLabel", { next: level + 1 })} />
      <p className="text-[14px] font-medium text-muted tabular">{t("toNext", { count: fmt(Math.max(0, nextAt - treats)), next: level + 1 })}</p>
    </Cushion>
  );
}

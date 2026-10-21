import { useTranslations } from "next-intl";
import { Cushion } from "./Cushion";
import { cx } from "./cx";
import { PawIcon } from "./icons";

export type DayStatus = "done" | "today" | "upcoming" | "missed";
const DAY_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;

/** Mon to Sun. `days` has seven entries. What counts as a day (and what Sunday, a test day, does) is decided in slice 10. */
export function PawStreakWeek({ streak, days, className }: { streak: number; days: readonly DayStatus[]; className?: string }) {
  const t = useTranslations("Ds.streak");
  return (
    <Cushion radius={28} className={cx("p-4 desk:p-6", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[16px] font-extrabold leading-tight tabular">{t("title", { count: streak })}</h2>
        <p className="hidden text-[13px] font-medium text-muted desk:block">{t("testDay")}</p>
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1">
        {DAY_KEYS.map((key, i) => {
          const status = days[i] ?? "upcoming";
          return (
            <li key={key} className="flex flex-col items-center gap-1.5">
              <span
                className={cx(
                  "flex h-[34px] w-[34px] items-center justify-center rounded-full",
                  status === "done" && "bg-progress text-on-progress",
                  status === "today" && "bg-tint text-on-tint ring-2 ring-progress",
                  (status === "upcoming" || status === "missed") && "bg-track text-muted",
                )}
              >
                <PawIcon size={18} />
              </span>
              <span className={cx("text-[13px]", status === "today" ? "font-bold text-text" : "font-medium text-muted")} aria-hidden="true">
                {t(`days.${key}`)}
              </span>
              <span className="sr-only">
                {t(`dayNames.${key}`)}, {t(`status.${status}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </Cushion>
  );
}

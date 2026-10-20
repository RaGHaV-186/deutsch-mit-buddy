import { useTranslations } from "next-intl";
import { Cushion } from "./Cushion";
import { cx } from "./cx";
import { PawIcon } from "./icons";

export type DayStatus = "done" | "today" | "upcoming" | "missed";
const DAY_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;

/** Mon to Sun. `days` has seven entries. Sunday is a rest day and never breaks a streak. */
export function PawStreakWeek({ streak, days }: { streak: number; days: readonly DayStatus[] }) {
  const t = useTranslations("Ds.streak");
  return (
    <Cushion radius={28} className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-extrabold leading-tight tabular">{t("title", { count: streak })}</h2>
        <p className="text-caption text-muted">{t("rest")}</p>
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

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { readThemePreference, setThemePreference, THEME_PREFERENCES, type ThemePreference } from "@/lib/theme-mode";

/** System / Light / Dark. Lives in Me > Settings once that screen exists. */
export function ThemeSwitch() {
  const t = useTranslations("Theme");
  const [value, setValue] = useState<ThemePreference>("system");

  // Read after mount so the server and first client render match.
  useEffect(() => {
    const saved = readThemePreference();
    queueMicrotask(() => setValue(saved));
  }, []);

  return (
    <div role="radiogroup" aria-label={t("label")} className="inline-flex gap-1 rounded-full bg-track p-1">
      {THEME_PREFERENCES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => {
            setValue(option);
            setThemePreference(option);
          }}
          className={`min-h-11 rounded-full px-4 text-caption font-bold ${
            option === value ? "bg-progress text-on-progress" : "text-text hover:bg-surface"
          }`}
        >
          {t(option)}
        </button>
      ))}
    </div>
  );
}

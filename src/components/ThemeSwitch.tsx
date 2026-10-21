"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ds";
import { readThemePreference, setThemePreference, THEME_PREFERENCES, type ThemePreference } from "@/lib/theme-mode";

/** System / Light / Dark, on the Me screen. */
export function ThemeSwitch() {
  const t = useTranslations("Theme");
  const [value, setValue] = useState<ThemePreference>("system");

  // Read after mount so the server and first client render match.
  useEffect(() => {
    const saved = readThemePreference();
    queueMicrotask(() => setValue(saved));
  }, []);

  return (
    <SegmentedControl
      label={t("label")}
      value={value}
      options={THEME_PREFERENCES}
      text={(option) => t(option)}
      onChange={(option) => {
        setValue(option);
        setThemePreference(option);
      }}
    />
  );
}

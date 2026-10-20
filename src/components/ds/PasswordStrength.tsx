"use client";

import { useTranslations } from "next-intl";
import { WedgeProgress } from "./WedgeProgress";

export type Strength = "empty" | "short" | "fair" | "strong";

/** A length hint only (the server enforces 10+ characters and checks leaked passwords). */
export function strengthOf(password: string): Strength {
  if (password.length === 0) return "empty";
  if (password.length < 10) return "short";
  return password.length < 14 ? "fair" : "strong";
}

const SHAPE = { short: { value: 0.3, tone: "die" }, fair: { value: 0.65, tone: "progress" }, strong: { value: 1, tone: "das" } } as const;

/** Wedge meter with a text label (colour is never the only signal). Renders nothing for an empty password. */
export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("Auth.strength");
  const strength = strengthOf(password);
  if (strength === "empty") return null;
  const { value, tone } = SHAPE[strength];
  return (
    <div className="flex items-center gap-3">
      <WedgeProgress value={value} tone={tone} height={10} label={t("label")} className="flex-1" />
      <span className="w-20 text-caption font-bold text-text" aria-live="polite">
        {t(strength)}
      </span>
    </div>
  );
}

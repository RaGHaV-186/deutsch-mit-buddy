"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { primaryButtonClass } from "./ui";

export function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Common");
  return (
    <button type="submit" className={primaryButtonClass} disabled={pending || disabled}>
      {pending ? t("loading") : children}
    </button>
  );
}

export function FormError({ code }: { code?: string }) {
  const t = useTranslations("Errors");
  if (!code) return null;
  return (
    <p role="alert" className="rounded-lg border border-die/50 bg-die/10 px-3 py-2 text-die dark:text-red-300">
      {t.has(code) ? t(code) : t("generic")}
    </p>
  );
}

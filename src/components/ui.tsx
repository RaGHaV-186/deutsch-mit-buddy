import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-foreground/30 bg-background px-3 py-3 text-base text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-der";
export const primaryButtonClass =
  "w-full rounded-lg bg-der px-4 py-3 text-base font-bold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-der disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButtonClass =
  "w-full rounded-lg border border-foreground/30 px-4 py-3 text-base font-bold text-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-der disabled:opacity-60";
// Same look as secondaryButtonClass but sized to its content (the two can't be combined: both set the width).
export const compactButtonClass =
  "rounded-lg border border-foreground/30 px-4 py-2 text-base font-bold text-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-der disabled:opacity-60";
export const linkClass = "font-bold text-der underline underline-offset-2 dark:text-sky-300";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-bold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function LegalLinks() {
  const t = useTranslations("Common");
  return (
    <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted">
      <Link href="/impressum" className="underline underline-offset-2">
        {t("legalImpressum")}
      </Link>
      <Link href="/datenschutz" className="underline underline-offset-2">
        {t("legalPrivacy")}
      </Link>
      <Link href="/terms" className="underline underline-offset-2">
        {t("legalTerms")}
      </Link>
    </nav>
  );
}

/** Centered card layout used by every signed-out screen. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold">{title}</h1>
        {subtitle ? <p className="text-muted">{subtitle}</p> : null}
      </header>
      {children}
      <LegalLinks />
    </main>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveStartingPointAction } from "@/app/onboarding/actions";
import { FormError, SubmitButton } from "./FormParts";
import { Field, inputClass, linkClass } from "./ui";

export interface PhaseGroup {
  phase: string;
  options: { seq: number; label: string }[];
}

export function OnboardingForm({
  groups,
  defaultSeq,
  needsTerms,
}: {
  groups: PhaseGroup[];
  defaultSeq: number;
  needsTerms: boolean;
}) {
  const t = useTranslations("Onboarding");
  const s = useTranslations("SignUp");
  const [state, action] = useActionState(saveStartingPointAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError code={state?.error} />
      <Field label={t("label")} htmlFor="seq">
        <select id="seq" name="seq" defaultValue={defaultSeq} className={inputClass}>
          {groups.map((g) => (
            <optgroup key={g.phase} label={t(`phase.${g.phase}`)}>
              {g.options.map((o) => (
                <option key={o.seq} value={o.seq}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {needsTerms ? (
        <label className="flex items-start gap-3">
          <input type="checkbox" name="terms" required className="mt-1 size-5 shrink-0 accent-[var(--der)]" />
          <span>
            {t("terms")}{" "}
            <Link href="/terms" className={linkClass} target="_blank">
              {s("termsLinkTerms")}
            </Link>
            {" · "}
            <Link href="/datenschutz" className={linkClass} target="_blank">
              {s("termsLinkPrivacy")}
            </Link>
          </span>
        </label>
      ) : null}
      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}

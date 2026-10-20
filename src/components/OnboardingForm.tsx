"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveStartingPointAction } from "@/app/onboarding/actions";
import { CheckboxField, SelectField, StickyActions } from "./ds";
import { FormError, SubmitButton, useBuddyReaction } from "./FormParts";
import { linkClass } from "./ui";

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
  useBuddyReaction(Boolean(state?.error));
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError code={state?.error} />
      <SelectField label={t("label")} name="seq" defaultValue={defaultSeq}>
        {groups.map((g) => (
          <optgroup key={g.phase} label={t(`phase.${g.phase}`)}>
            {g.options.map((o) => (
              <option key={o.seq} value={o.seq}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>
      {needsTerms ? (
        <CheckboxField name="terms" required>
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
        </CheckboxField>
      ) : null}
      <StickyActions>
        <SubmitButton>{t("submit")}</SubmitButton>
      </StickyActions>
    </form>
  );
}

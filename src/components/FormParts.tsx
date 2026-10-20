"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useAuthMood } from "./auth/AuthLayout";
import { AlertIcon, PillButton } from "./ds";

/** The primary action of a form: full width, 56px, a spinner while the form is being sent. */
export function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <PillButton type="submit" variant="coat" fullWidth loading={pending} disabled={disabled}>
      {children}
    </PillButton>
  );
}

/** Turns an error code from the server into the learner-facing message (messages/en.json "Errors"). */
export function useErrorMessage() {
  const t = useTranslations("Errors");
  return (code: string | undefined) => (code ? (t.has(code) ? t(code) : t("generic")) : undefined);
}

/** A banner for errors that aren't about one field (rate limit, captcha, outage). Always with an icon. */
export function FormError({ code }: { code?: string }) {
  const message = useErrorMessage()(code);
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-field bg-surface p-3 text-body text-die shadow-cushion">
      <AlertIcon size={20} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Keeps what was typed in a field across a failed submit. React empties uncontrolled inputs after a form action
 * finishes and restores them to their `defaultValue`, so the field's default follows what the learner typed.
 */
export function useRetainedValue(initial = "") {
  const [value, setValue] = useState(initial);
  return { defaultValue: value, onChange: (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value) };
}

/**
 * Buddy reacts while `active`: puzzled ("curious") for an error, or "happy" for a success. When it ends he goes back to
 * the screen's own pose. Several fields on one screen can use this; only an active one changes anything.
 */
export function useBuddyReaction(active: boolean, pose: "curious" | "happy" = "curious") {
  const setMood = useAuthMood();
  useEffect(() => {
    if (!active) return;
    setMood(pose);
    return () => setMood(undefined);
  }, [active, pose, setMood]);
}

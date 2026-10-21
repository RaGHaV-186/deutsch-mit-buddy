"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  enrollTotpAction,
  verifyEnrollAction,
  verifyLoginAction,
  type EnrollResult,
  type MfaFormState,
} from "@/app/mfa/actions";
import { AlertIcon, CodeInput, Cushion, StickyActions } from "./ds";
import { FormError, SubmitButton, useBuddyReaction, useErrorMessage } from "./FormParts";

const CODE_LENGTH = 6;

/**
 * The code boxes plus the confirm button, shared by setup and login. The six digits go to the server action in a
 * hidden `code` field, exactly as the old single input did. When the sixth digit is entered the form is sent; a
 * wrong code clears the boxes, shakes them once and makes Buddy look puzzled.
 */
function CodeForm({
  action,
  state,
  hidden,
  submitLabel,
  autoFocus,
}: {
  action: (formData: FormData) => void;
  state: MfaFormState;
  hidden: Record<string, string | undefined>;
  submitLabel: string;
  /** Focus the first box on load. Not on setup: the QR code and instructions come first and the page must not jump past them. */
  autoFocus: boolean;
}) {
  const message = useErrorMessage();
  const formRef = useRef<HTMLFormElement>(null);
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [errorVisible, setErrorVisible] = useState(false);
  const [seen, setSeen] = useState(state);

  // A new answer from the server: for an error, clear the boxes, replay the shake and show the message.
  if (state !== seen) {
    setSeen(state);
    if (state?.error) {
      setCode("");
      setAttempt((n) => n + 1);
      setErrorVisible(true);
    }
  }
  useBuddyReaction(errorVisible);

  useEffect(() => {
    if (code.length === CODE_LENGTH) formRef.current?.requestSubmit();
  }, [code]);

  const isCodeError = state?.error === "invalid_code";
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      {errorVisible && !isCodeError ? <FormError code={state?.error} /> : null}
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <CodeInput
        key={attempt}
        name="code"
        value={code}
        onChange={(v) => {
          setCode(v);
          setErrorVisible(false);
        }}
        error={errorVisible && isCodeError}
        autoFocus={autoFocus}
      />
      {errorVisible && isCodeError ? (
        <p role="alert" className="flex items-start gap-1.5 text-caption text-die">
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          <span>{message(state?.error)}</span>
        </p>
      ) : null}
      <StickyActions>
        <SubmitButton disabled={code.length < CODE_LENGTH}>{submitLabel}</SubmitButton>
      </StickyActions>
    </form>
  );
}

export function TotpSetup({ next }: { next?: string }) {
  const t = useTranslations("Mfa");
  const [enroll, setEnroll] = useState<EnrollResult>();
  const started = useRef(false);
  const [state, action] = useActionState(verifyEnrollAction, undefined);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    enrollTotpAction().then(setEnroll);
  }, []);

  if (!enroll) return <p role="status" className="text-muted">{t("preparing")}</p>;
  if ("error" in enroll) return <FormError code={enroll.error} />;

  return (
    <div className="flex flex-col gap-5">
      <p>{t("step1")}</p>
      {/* QR codes need a white background to scan, also in dark mode. */}
      <div className="self-center rounded-[20px] bg-white p-3 shadow-cushion">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enroll.qr} alt={t("qrAlt")} width={200} height={200} />
      </div>
      <Cushion radius={20} className="flex flex-col gap-1.5 p-4">
        <p className="text-caption text-muted">{t("step2")}</p>
        <code className="break-all font-mono text-[15px] font-semibold select-all">{enroll.secret}</code>
        <p className="text-caption text-muted">{t("saveKey")}</p>
      </Cushion>
      <p>{t("step3")}</p>
      <CodeForm
        action={action}
        state={state}
        hidden={{ factorId: enroll.factorId, next }}
        submitLabel={t("confirm")}
        autoFocus={false}
      />
    </div>
  );
}

export function MfaVerifyForm({ next }: { next?: string }) {
  const t = useTranslations("Mfa");
  const [state, action] = useActionState(verifyLoginAction, undefined);
  return <CodeForm action={action} state={state} hidden={{ next }} submitLabel={t("verify")} autoFocus />;
}

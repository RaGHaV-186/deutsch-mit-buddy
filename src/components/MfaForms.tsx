"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  enrollTotpAction,
  verifyEnrollAction,
  verifyLoginAction,
  type EnrollResult,
} from "@/app/mfa/actions";
import { FormError, SubmitButton } from "./FormParts";
import { Field, inputClass } from "./ui";

function CodeField() {
  const t = useTranslations("Mfa");
  return (
    <Field label={t("code")} htmlFor="code">
      <input
        id="code"
        name="code"
        required
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="one-time-code"
        autoFocus
        className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em]`}
      />
    </Field>
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

  if (!enroll) return <p role="status">{t("preparing")}</p>;
  if ("error" in enroll) return <FormError code={enroll.error} />;

  return (
    <div className="flex flex-col gap-5">
      <p>{t("step1")}</p>
      {/* QR codes need a white background to scan, also in dark mode. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enroll.qr} alt={t("qrAlt")} width={200} height={200} className="self-center rounded-lg bg-white p-2" />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">{t("step2")}</p>
        <code className="break-all rounded-lg bg-foreground/10 px-3 py-2 font-mono text-sm select-all">
          {enroll.secret}
        </code>
        <p className="text-sm text-muted">{t("saveKey")}</p>
      </div>
      <p>{t("step3")}</p>
      <form action={action} className="flex flex-col gap-4">
        <FormError code={state?.error} />
        <input type="hidden" name="factorId" value={enroll.factorId} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <CodeField />
        <SubmitButton>{t("confirm")}</SubmitButton>
      </form>
    </div>
  );
}

export function MfaVerifyForm({ next }: { next?: string }) {
  const t = useTranslations("Mfa");
  const [state, action] = useActionState(verifyLoginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={state?.error} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <CodeField />
      <SubmitButton>{t("verify")}</SubmitButton>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  forgotPasswordAction,
  googleSignInAction,
  joinWaitlistAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/app/(auth)/actions";
import { FormError, SubmitButton } from "./FormParts";
import { TurnstileField } from "./TurnstileField";
import { Field, inputClass, linkClass, secondaryButtonClass } from "./ui";

const captchaConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

function useCaptcha() {
  const [token, setToken] = useState("");
  return { token, setToken, blocked: captchaConfigured && !token };
}

export function GoogleButton({ label }: { label: string }) {
  const t = useTranslations("Errors");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={secondaryButtonClass}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          const res = await googleSignInAction();
          if (res.url) {
            window.location.assign(res.url);
          } else {
            setError(res.error ?? "generic");
            setBusy(false);
          }
        }}
      >
        {label}
      </button>
      {error ? (
        <p role="alert" className="text-die">
          {t.has(error) ? t(error) : t("generic")}
        </p>
      ) : null}
    </div>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations("SignUp");
  const c = useTranslations("Common");
  const [state, action] = useActionState(signUpAction, undefined);
  const captcha = useCaptcha();
  return (
    <div className="flex flex-col gap-5">
      {googleEnabled ? (
        <>
          <GoogleButton label={t("google")} />
          <p className="text-center text-muted">{c("or")}</p>
        </>
      ) : null}
      <form action={action} className="flex flex-col gap-4">
        <FormError code={state?.error} />
        <Field label={t("displayName")} htmlFor="displayName">
          <input id="displayName" name="displayName" maxLength={40} autoComplete="given-name" className={inputClass} />
        </Field>
        <Field label={c("email")} htmlFor="email">
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
        </Field>
        <Field label={c("password")} hint={t("passwordHint")} htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="terms" required className="mt-1 size-5 shrink-0 accent-[var(--der)]" />
          <span>
            {t("terms")}{" "}
            <Link href="/terms" className={linkClass} target="_blank">
              {t("termsLinkTerms")}
            </Link>
            {" · "}
            <Link href="/datenschutz" className={linkClass} target="_blank">
              {t("termsLinkPrivacy")}
            </Link>
          </span>
        </label>
        <TurnstileField onToken={captcha.setToken} resetSignal={state} />
        <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
      </form>
      <p>
        {t("haveAccount")}{" "}
        <Link href="/login" className={linkClass}>
          {t("logIn")}
        </Link>
      </p>
    </div>
  );
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const t = useTranslations("LogIn");
  const c = useTranslations("Common");
  const [state, action] = useActionState(signInAction, undefined);
  const captcha = useCaptcha();
  return (
    <div className="flex flex-col gap-5">
      <GoogleButton label={t("google")} />
      <p className="text-center text-muted">{c("or")}</p>
      <form action={action} className="flex flex-col gap-4">
        <FormError code={state?.error ?? initialError} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label={c("email")} htmlFor="email">
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
        </Field>
        <Field label={c("password")} htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>
        <TurnstileField onToken={captcha.setToken} resetSignal={state} />
        <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
      </form>
      <p>
        <Link href="/forgot-password" className={linkClass}>
          {t("forgot")}
        </Link>
      </p>
      <p>
        {t("noAccount")}{" "}
        <Link href="/signup" className={linkClass}>
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("Forgot");
  const c = useTranslations("Common");
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  const captcha = useCaptcha();
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={state?.error} />
      <Field label={c("email")} htmlFor="email">
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
      </Field>
      <TurnstileField onToken={captcha.setToken} resetSignal={state} />
      <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("Reset");
  const s = useTranslations("SignUp");
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={state?.error} />
      <Field label={t("newPassword")} hint={s("passwordHint")} htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}

export function WaitlistForm() {
  const t = useTranslations("Waitlist");
  const c = useTranslations("Common");
  const [state, action] = useActionState(joinWaitlistAction, undefined);
  const captcha = useCaptcha();
  if (state?.done) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border border-das/50 bg-das/10 p-4">
        <p className="font-heading text-xl font-bold">{t("doneTitle")}</p>
        <p>{t("done")}</p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={state?.error} />
      <Field label={c("email")} htmlFor="email">
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
      </Field>
      <TurnstileField onToken={captcha.setToken} resetSignal={state} />
      <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
    </form>
  );
}

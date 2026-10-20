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
import { EMAIL_ERRORS, PASSWORD_ERRORS, routeError } from "@/lib/auth/error-routing";
import { CheckboxField, Divider, PasswordField, PasswordStrength, PillButton, StickyActions, TextField } from "./ds";
import { FormError, SubmitButton, useBuddyReaction, useErrorMessage, useRetainedValue } from "./FormParts";
import { TurnstileField } from "./TurnstileField";
import { linkClass } from "./ui";

const captchaConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

function useCaptcha() {
  const [token, setToken] = useState("");
  return { token, setToken, blocked: captchaConfigured && !token };
}

export function GoogleButton({ label }: { label: string }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useBuddyReaction(Boolean(error));
  return (
    <div className="flex flex-col gap-2">
      <PillButton
        variant="cushion"
        fullWidth
        loading={busy}
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
      </PillButton>
      <FormError code={error} />
    </div>
  );
}

function TermsLabel({ lead }: { lead: string }) {
  const s = useTranslations("SignUp");
  return (
    <span>
      {lead}{" "}
      <Link href="/terms" className={linkClass} target="_blank">
        {s("termsLinkTerms")}
      </Link>
      {" · "}
      <Link href="/datenschutz" className={linkClass} target="_blank">
        {s("termsLinkPrivacy")}
      </Link>
    </span>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations("SignUp");
  const c = useTranslations("Common");
  const message = useErrorMessage();
  const [state, action] = useActionState(signUpAction, undefined);
  const captcha = useCaptcha();
  const name = useRetainedValue();
  const email = useRetainedValue();
  const [password, setPassword] = useState("");
  const routed = routeError(state?.error, { email: EMAIL_ERRORS, password: PASSWORD_ERRORS });
  useBuddyReaction(Boolean(state?.error));
  return (
    <div className="flex flex-col gap-4">
      {googleEnabled ? (
        <>
          <GoogleButton label={t("google")} />
          <Divider>{c("or")}</Divider>
        </>
      ) : null}
      <form action={action} className="flex flex-col gap-4">
        <FormError code={routed.banner} />
        <TextField label={t("displayName")} name="displayName" maxLength={40} autoComplete="given-name" {...name} />
        <TextField
          label={c("email")}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          error={message(routed.email)}
          {...email}
        />
        <div className="flex flex-col gap-2">
          <PasswordField
            label={c("password")}
            name="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            hint={routed.password ? undefined : t("passwordHint")}
            error={message(routed.password)}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </div>
        <CheckboxField name="terms" required>
          <TermsLabel lead={t("terms")} />
        </CheckboxField>
        <TurnstileField onToken={captcha.setToken} resetSignal={state} />
        <StickyActions>
          <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
        </StickyActions>
      </form>
      <p className="text-center">
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
  const message = useErrorMessage();
  const [state, action] = useActionState(signInAction, undefined);
  const captcha = useCaptcha();
  const email = useRetainedValue();
  const error = state?.error ?? initialError;
  const routed = routeError(error, { email: EMAIL_ERRORS, password: ["invalid_credentials"] });
  useBuddyReaction(Boolean(error));
  return (
    <div className="flex flex-col gap-4">
      <GoogleButton label={t("google")} />
      <Divider>{c("or")}</Divider>
      <form action={action} className="flex flex-col gap-4">
        <FormError code={routed.banner} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <TextField
          label={c("email")}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          error={message(routed.email)}
          {...email}
        />
        <div className="flex flex-col gap-1">
          <PasswordField
            label={c("password")}
            name="password"
            required
            maxLength={128}
            autoComplete="current-password"
            error={message(routed.password)}
          />
          <p className="self-end">
            <Link href="/forgot-password" className={`${linkClass} inline-flex min-h-11 items-center`}>
              {t("forgot")}
            </Link>
          </p>
        </div>
        <TurnstileField onToken={captcha.setToken} resetSignal={state} />
        <StickyActions>
          <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
        </StickyActions>
      </form>
      <p className="text-center">
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
  const message = useErrorMessage();
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  const captcha = useCaptcha();
  const email = useRetainedValue();
  const routed = routeError(state?.error, { email: [...EMAIL_ERRORS, "invalid_input"] });
  useBuddyReaction(Boolean(state?.error));
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={routed.banner} />
      <TextField
        label={c("email")}
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        error={message(routed.email)}
        {...email}
      />
      <TurnstileField onToken={captcha.setToken} resetSignal={state} />
      <StickyActions>
        <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
      </StickyActions>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("Reset");
  const s = useTranslations("SignUp");
  const message = useErrorMessage();
  const [state, action] = useActionState(resetPasswordAction, undefined);
  const [password, setPassword] = useState("");
  const routed = routeError(state?.error, { password: [...PASSWORD_ERRORS, "invalid_input"] });
  useBuddyReaction(Boolean(state?.error));
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={routed.banner} />
      <div className="flex flex-col gap-2">
        <PasswordField
          label={t("newPassword")}
          name="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          hint={routed.password ? undefined : s("passwordHint")}
          error={message(routed.password)}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} />
      </div>
      <StickyActions>
        <SubmitButton>{t("submit")}</SubmitButton>
      </StickyActions>
    </form>
  );
}

export function WaitlistForm() {
  const t = useTranslations("Waitlist");
  const c = useTranslations("Common");
  const message = useErrorMessage();
  const [state, action] = useActionState(joinWaitlistAction, undefined);
  const captcha = useCaptcha();
  const email = useRetainedValue();
  const routed = routeError(state?.error, { email: [...EMAIL_ERRORS, "invalid_input"] });
  useBuddyReaction(Boolean(state?.error));
  useBuddyReaction(Boolean(state?.done), "happy");
  if (state?.done) {
    return (
      <div role="status" className="flex flex-col gap-1 rounded-cushion bg-surface p-5 shadow-cushion">
        <p className="text-headline">{t("doneTitle")}</p>
        <p className="text-muted">{t("done")}</p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={routed.banner} />
      <TextField
        label={c("email")}
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        error={message(routed.email)}
        {...email}
      />
      <TurnstileField onToken={captcha.setToken} resetSignal={state} />
      <StickyActions>
        <SubmitButton disabled={captcha.blocked}>{t("submit")}</SubmitButton>
      </StickyActions>
    </form>
  );
}

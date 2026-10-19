/** Every key that can appear in messages/en.json "Errors". A test keeps this list and the messages in sync. */
export const ERROR_KEYS = [
  "invalid_input",
  "captcha",
  "rate_limited",
  "email_rate_limit",
  "email_not_authorized",
  "unavailable",
  "generic",
  "pwned",
  "weak_password",
  "invalid_credentials",
  "email_not_confirmed",
  "invalid_code",
  "same_password",
  "oauth",
  "link",
  "link_device",
  "terms_required",
] as const;
export type ErrorKey = (typeof ERROR_KEYS)[number];

interface AuthErrorLike {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
}

/** Maps a Supabase auth error to a key in messages/en.json "Errors". */
export function authErrorKey(error: AuthErrorLike | null | undefined): ErrorKey {
  switch (error?.code) {
    case "captcha_failed":
      return "captcha";
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "validation_failed":
    case "email_address_invalid":
      return "invalid_input";
    // Too many requests to Supabase from this IP/user.
    case "over_request_rate_limit":
      return "rate_limited";
    // Supabase's email quota (the built-in sender allows only a couple of emails per hour).
    case "over_email_send_rate_limit":
      return "email_rate_limit";
    // Supabase's built-in sender refuses addresses outside your team until custom SMTP is configured.
    case "email_address_not_authorized":
      return "email_not_authorized";
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
      return "invalid_code";
  }
  // No usable answer from Supabase (network failure or its own 5xx): not the member's fault.
  if (error?.name === "AuthRetryableFetchError" || (error?.status !== undefined && (error.status === 0 || error.status >= 500))) {
    return "unavailable";
  }
  return "generic";
}

/** The database trigger rejects sign-ups once the member cap is reached; GoTrue reports it as a database error. */
export function isMemberCapError(error: { message?: string } | null | undefined): boolean {
  return /database error/i.test(error?.message ?? "");
}

/**
 * Logs why an auth call failed, so a vague message on screen can be traced in the server logs.
 * Only the error's code, name and HTTP status are logged: no message text, email, token or key.
 */
export function logAuthError(context: string, error: AuthErrorLike | null | undefined) {
  console.error(`auth error in ${context}`, { code: error?.code, name: error?.name, status: error?.status });
}

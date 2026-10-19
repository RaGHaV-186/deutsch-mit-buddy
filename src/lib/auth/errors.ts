/** Maps a Supabase auth error to one of the keys in messages/en.json "Errors". */
export function authErrorKey(error: { code?: string; message?: string } | null | undefined): string {
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
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
      return "invalid_code";
    default:
      return "generic";
  }
}

/** The database trigger rejects sign-ups once the member cap is reached; GoTrue reports it as a database error. */
export function isMemberCapError(error: { message?: string } | null | undefined): boolean {
  return /database error/i.test(error?.message ?? "");
}

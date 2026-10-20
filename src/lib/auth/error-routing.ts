/**
 * Decides where an auth error message is shown. The server actions return one error code; the screens put it under
 * the field it is about, and everything else (rate limits, captcha, outages) in a banner above the form.
 * Display only: it never changes which error the server returns.
 */
export type ErrorFields = { email?: readonly string[]; password?: readonly string[]; code?: readonly string[] };

export interface RoutedError {
  email?: string;
  password?: string;
  code?: string;
  banner?: string;
}

export function routeError(error: string | undefined, fields: ErrorFields): RoutedError {
  if (!error) return {};
  for (const name of ["email", "password", "code"] as const) {
    if (fields[name]?.includes(error)) return { [name]: error };
  }
  return { banner: error };
}

/** Errors that belong to the email field on every screen that has one. */
export const EMAIL_ERRORS = ["email_not_confirmed", "email_not_authorized", "email_rate_limit"] as const;
/** Errors that are about the password the learner typed. */
export const PASSWORD_ERRORS = ["weak_password", "pwned", "same_password"] as const;

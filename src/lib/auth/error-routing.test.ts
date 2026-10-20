import { describe, expect, it } from "vitest";
import messages from "../../../messages/en.json";
import { EMAIL_ERRORS, PASSWORD_ERRORS, routeError } from "./error-routing";

describe("routeError", () => {
  it("nothing to show when there is no error", () => {
    expect(routeError(undefined, { email: ["x"] })).toEqual({});
  });

  it("puts an error under the field it belongs to", () => {
    expect(routeError("invalid_credentials", { password: ["invalid_credentials"] })).toEqual({ password: "invalid_credentials" });
    expect(routeError("email_not_confirmed", { email: EMAIL_ERRORS })).toEqual({ email: "email_not_confirmed" });
    expect(routeError("invalid_code", { code: ["invalid_code"] })).toEqual({ code: "invalid_code" });
  });

  it("everything else goes to the banner, so nothing is ever hidden", () => {
    for (const code of ["rate_limited", "captcha", "unavailable", "generic", "terms_required", "link", "oauth"]) {
      expect(routeError(code, { email: EMAIL_ERRORS, password: PASSWORD_ERRORS })).toEqual({ banner: code });
    }
    // A code that is a field error on another screen is a banner here.
    expect(routeError("invalid_credentials", { email: EMAIL_ERRORS })).toEqual({ banner: "invalid_credentials" });
  });

  it("every code it knows has a message", () => {
    const errors = messages.Errors as Record<string, string>;
    for (const code of [...EMAIL_ERRORS, ...PASSWORD_ERRORS, "invalid_credentials", "invalid_code"]) expect(errors[code], code).toBeTruthy();
  });
});

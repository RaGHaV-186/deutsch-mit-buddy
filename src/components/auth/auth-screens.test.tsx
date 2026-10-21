import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils";

const signIn = vi.fn();
const signUp = vi.fn();
const forgot = vi.fn();
const reset = vi.fn();
const waitlist = vi.fn();
const google = vi.fn();
const verifyLogin = vi.fn();
const verifyEnroll = vi.fn();
const enroll = vi.fn();
const saveStart = vi.fn();

vi.mock("@/app/(auth)/actions", () => ({
  signInAction: (...a: unknown[]) => signIn(...a),
  signUpAction: (...a: unknown[]) => signUp(...a),
  forgotPasswordAction: (...a: unknown[]) => forgot(...a),
  resetPasswordAction: (...a: unknown[]) => reset(...a),
  joinWaitlistAction: (...a: unknown[]) => waitlist(...a),
  googleSignInAction: (...a: unknown[]) => google(...a),
}));
vi.mock("@/app/mfa/actions", () => ({
  verifyLoginAction: (...a: unknown[]) => verifyLogin(...a),
  verifyEnrollAction: (...a: unknown[]) => verifyEnroll(...a),
  enrollTotpAction: (...a: unknown[]) => enroll(...a),
}));
vi.mock("@/app/onboarding/actions", () => ({ saveStartingPointAction: (...a: unknown[]) => saveStart(...a) }));

import { ForgotPasswordForm, LoginForm, ResetPasswordForm, SignUpForm, WaitlistForm } from "../AuthForms";
import { MfaVerifyForm, TotpSetup } from "../MfaForms";
import { OnboardingForm } from "../OnboardingForm";
import { AuthLayout } from "./AuthLayout";

const layout = (children: React.ReactNode, over: Partial<React.ComponentProps<typeof AuthLayout>> = {}) =>
  renderWithIntl(
    <AuthLayout title="Welcome back" line="Schön, dich zu sehen!" helper="Good to see you!" pose="neutral" {...over}>
      {children}
    </AuthLayout>,
  );

// Buddy himself (the app icon next to the name is a different image and only shows on desktop).
const pose = () => document.querySelector('header img[src*="/buddy/buddy-"]:not([src*="icon"])')!.getAttribute("src")!;
const submit = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
  });
};
const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  signIn.mockResolvedValue(undefined);
  signUp.mockResolvedValue(undefined);
  forgot.mockResolvedValue(undefined);
  reset.mockResolvedValue(undefined);
  waitlist.mockResolvedValue(undefined);
  verifyLogin.mockResolvedValue(undefined);
  verifyEnroll.mockResolvedValue(undefined);
  google.mockResolvedValue({ error: "oauth" });
});

describe("AuthLayout", () => {
  it("compact coat block with the title, Buddy's German line in quotes, an English helper and Buddy; the form below", () => {
    layout(<p>form here</p>);
    const header = document.querySelector("header")!;
    expect(header.className).toContain("rounded-coat");
    expect(header.className).toContain("pb-9"); // compact
    expect(header.querySelector("polygon")).not.toBeNull(); // the blaze notch
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(header).toHaveTextContent("„Schön, dich zu sehen!“");
    expect(header).toHaveTextContent("Good to see you!");
    expect(pose()).toContain("buddy-neutral.svg");
    expect(screen.getByText("form here")).toBeInTheDocument();
  });

  it("is a phone-width column and has no tab bar", () => {
    layout(<p>x</p>);
    expect(screen.getByRole("main").className).toContain("max-w-[480px]");
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("shows the intro text above the form", () => {
    layout(<p>form</p>, { intro: "Free. Takes a minute." });
    expect(screen.getByText("Free. Takes a minute.")).toBeInTheDocument();
  });
});

describe("login", () => {
  it("has labelled email and password fields with the right autofill hints, a show/hide button and the forgot link", () => {
    layout(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("button", { name: "Log in" })).toHaveAttribute("type", "submit");
  });

  it("passes the redirect target on and keeps it out of sight", () => {
    const { container } = layout(<LoginForm next="/cards" />);
    expect(container.querySelector('input[type="hidden"][name="next"]')).toHaveValue("/cards");
  });

  it("sends exactly the typed email and password to the server action", async () => {
    const { container } = layout(<LoginForm />);
    type("Email", "anna@example.com");
    type("Password", "hunter2hunter2");
    await submit(container);
    expect(signIn).toHaveBeenCalledTimes(1);
    const data = signIn.mock.calls[0][1] as FormData;
    expect(data.get("email")).toBe("anna@example.com");
    expect(data.get("password")).toBe("hunter2hunter2");
  });

  it("wrong credentials: the message sits under the password field, Buddy looks puzzled, the email stays, the password is cleared", async () => {
    signIn.mockResolvedValue({ error: "invalid_credentials" });
    const { container } = layout(<LoginForm />);
    expect(pose()).toContain("buddy-neutral");
    type("Email", "anna@example.com");
    type("Password", "wrong-password");
    await submit(container);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Email or password is wrong."));
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(password.getAttribute("aria-describedby")!)).toHaveTextContent("Email or password is wrong.");
    expect(pose()).toContain("buddy-curious");
    expect(screen.getByLabelText("Email")).toHaveValue("anna@example.com");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(password).toHaveValue("");
  });

  it("errors that aren't about a field (rate limit) show in a banner with an icon", async () => {
    signIn.mockResolvedValue({ error: "rate_limited" });
    const { container } = layout(<LoginForm />);
    type("Email", "a@b.de");
    await submit(container);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many tries");
    expect(alert.querySelector("svg")).not.toBeNull();
    expect(screen.getByLabelText("Email")).toHaveValue("a@b.de");
  });

  it("an error from the sign-in link (?error=) shows at once and Buddy looks puzzled", () => {
    layout(<LoginForm initialError="link" />);
    expect(screen.getByRole("alert")).toHaveTextContent("expired");
    expect(pose()).toContain("buddy-curious");
  });

  it("Google sign-in failing shows its message and puzzles Buddy", async () => {
    layout(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in didn't work");
    expect(pose()).toContain("buddy-curious");
  });

  it("the show/hide button reveals the password", () => {
    layout(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });
});

describe("sign up", () => {
  it("fields, required terms checkbox named by its text, and a link back to login", () => {
    layout(<SignUpForm googleEnabled />, { pose: "talking" });
    expect(screen.getByLabelText("Your name (optional)")).toHaveAttribute("autocomplete", "given-name");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "10");
    const terms = screen.getByRole("checkbox", { name: /I am 16 or older/ });
    expect(terms).toBeRequired();
    expect(terms).toHaveAttribute("name", "terms");
    const termsLinks = screen.getAllByRole("link", { name: "Terms" }); // one in the checkbox text, one in the page footer
    expect(termsLinks.every((l) => l.getAttribute("href") === "/terms")).toBe(true);
    expect(termsLinks.some((l) => l.getAttribute("target") === "_blank")).toBe(true);
    expect(screen.getByRole("button", { name: "Sign up with Google" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  it("password strength: nothing when empty, then Too short, Okay, Strong with a wedge meter", () => {
    layout(<SignUpForm googleEnabled={false} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    type("Password", "short");
    expect(screen.getByRole("progressbar", { name: "Password strength" })).toBeInTheDocument();
    expect(screen.getByText("Too short")).toBeInTheDocument();
    type("Password", "twelve-chars");
    expect(screen.getByText("Okay")).toBeInTheDocument();
    type("Password", "a-much-longer-passphrase");
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("a leaked password: message under the password field, name and email kept", async () => {
    signUp.mockResolvedValue({ error: "pwned" });
    const { container } = layout(<SignUpForm googleEnabled={false} />);
    type("Your name (optional)", "Anna");
    type("Email", "anna@example.com");
    type("Password", "password1234");
    await submit(container);
    await waitFor(() => expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByRole("alert")).toHaveTextContent("known data leaks");
    expect(screen.getByLabelText("Your name (optional)")).toHaveValue("Anna");
    expect(screen.getByLabelText("Email")).toHaveValue("anna@example.com");
    expect(pose()).toContain("buddy-curious");
  });
});

describe("forgot and reset password, waitlist", () => {
  it("forgot: one email field; an invalid email shows under it and the typed email stays", async () => {
    forgot.mockResolvedValue({ error: "invalid_input" });
    const { container } = layout(<ForgotPasswordForm />, { pose: "curious" });
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    type("Email", "not-an-email");
    await submit(container);
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Email")).toHaveValue("not-an-email");
  });

  it("reset: new password with strength meter; a reused password shows under the field", async () => {
    reset.mockResolvedValue({ error: "same_password" });
    const { container } = layout(<ResetPasswordForm />);
    type("New password", "a-fresh-passphrase");
    expect(screen.getByText("Strong")).toBeInTheDocument();
    await submit(container);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("haven't used before"));
    expect(screen.getByLabelText("New password")).toHaveAttribute("aria-invalid", "true");
  });

  it("waitlist: once joined, the confirmation shows and Buddy is happy", async () => {
    waitlist.mockResolvedValue({ done: true });
    const { container } = layout(<WaitlistForm />, { pose: "resting" });
    type("Email", "anna@example.com");
    await submit(container);
    expect(await screen.findByRole("status")).toHaveTextContent("You're on the list");
    expect(pose()).toContain("buddy-happy");
  });
});

describe("two-factor", () => {
  const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];

  it("verify: six boxes, a confirm button that waits for the full code, autofill-friendly", () => {
    layout(<MfaVerifyForm next="/home" />, { pose: "listening" });
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0]).toHaveAttribute("autocomplete", "one-time-code");
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    expect(pose()).toContain("buddy-listening");
  });

  it("verify: the sixth digit sends the code (as the field `code`) without pressing a button", async () => {
    layout(<MfaVerifyForm next="/cards" />);
    await act(async () => {
      "482915".split("").forEach((d, i) => fireEvent.change(boxes()[i], { target: { value: d } }));
    });
    await waitFor(() => expect(verifyLogin).toHaveBeenCalledTimes(1));
    const data = verifyLogin.mock.calls[0][1] as FormData;
    expect(data.get("code")).toBe("482915");
    expect(data.get("next")).toBe("/cards");
  });

  it("verify: a pasted code is sent too", async () => {
    layout(<MfaVerifyForm />);
    await act(async () => {
      fireEvent.paste(boxes()[0], { clipboardData: { getData: () => "301 422" } });
    });
    await waitFor(() => expect(verifyLogin).toHaveBeenCalledTimes(1));
    expect((verifyLogin.mock.calls[0][1] as FormData).get("code")).toBe("301422");
  });

  it("verify: a wrong code clears the boxes, shakes them, shows the message and puzzles Buddy; typing again clears the error", async () => {
    verifyLogin.mockResolvedValue({ error: "invalid_code" });
    layout(<MfaVerifyForm />, { pose: "listening" });
    await act(async () => {
      "000000".split("").forEach((d, i) => fireEvent.change(boxes()[i], { target: { value: d } }));
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That code didn't work"));
    expect(boxes().map((b) => b.value).join("")).toBe("");
    expect(document.querySelector('[role="group"]')!.className).toContain("ds-shake");
    expect(boxes()[0]).toHaveAttribute("aria-invalid", "true");
    expect(pose()).toContain("buddy-curious");
    expect(verifyLogin).toHaveBeenCalledTimes(1); // the empty boxes don't send anything

    fireEvent.change(boxes()[0], { target: { value: "1" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(pose()).toContain("buddy-listening");
  });

  it("verify: other failures (rate limit) show as a banner", async () => {
    verifyLogin.mockResolvedValue({ error: "rate_limited" });
    layout(<MfaVerifyForm />);
    await act(async () => {
      "123456".split("").forEach((d, i) => fireEvent.change(boxes()[i], { target: { value: d } }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries");
  });

  it("setup: QR code on a white tile, the manual key, and the code boxes that send the factor id", async () => {
    enroll.mockResolvedValue({ factorId: "factor-1", qr: "data:image/svg+xml;base64,AAAA", secret: "JBSWY3DPEHPK3PXP" });
    layout(<TotpSetup next="/home" />);
    const qr = await screen.findByAltText("QR code for your authenticator app");
    expect(qr).toHaveAttribute("src", "data:image/svg+xml;base64,AAAA");
    expect(qr.parentElement!.className).toContain("bg-white");
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    await act(async () => {
      "123456".split("").forEach((d, i) => fireEvent.change(boxes()[i], { target: { value: d } }));
    });
    await waitFor(() => expect(verifyEnroll).toHaveBeenCalledTimes(1));
    const data = verifyEnroll.mock.calls[0][1] as FormData;
    expect(data.get("code")).toBe("123456");
    expect(data.get("factorId")).toBe("factor-1");
    expect(data.get("next")).toBe("/home");
  });

  it("setup: an enrolment error shows instead of the QR code", async () => {
    enroll.mockResolvedValue({ error: "unavailable" });
    layout(<TotpSetup />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something is wrong on our side");
  });
});

describe("onboarding", () => {
  const groups = [
    { phase: "zero", options: [{ seq: 0, label: "Z1 · Greetings" }, { seq: 1, label: "Z2 · Pronouns" }] },
    { phase: "A1", options: [{ seq: 20, label: "W1.1 · Hobbies" }] },
  ];

  it("a starting-lesson select grouped by phase, with the default chosen", () => {
    layout(<OnboardingForm groups={groups} defaultSeq={0} needsTerms={false} />, { pose: "talking" });
    const select = screen.getByLabelText("Starting lesson") as HTMLSelectElement;
    expect(select).toHaveAttribute("name", "seq");
    expect(select.value).toBe("0");
    expect(screen.getByRole("group", { name: "A1" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("asks for the terms only when they haven't been accepted", () => {
    layout(<OnboardingForm groups={groups} defaultSeq={0} needsTerms />);
    expect(screen.getByRole("checkbox", { name: /I am 16 or older/ })).toBeRequired();
  });

  it("sends the chosen lesson; a server error puzzles Buddy", async () => {
    saveStart.mockResolvedValue({ error: "terms_required" });
    const { container } = layout(<OnboardingForm groups={groups} defaultSeq={0} needsTerms={false} />);
    fireEvent.change(screen.getByLabelText("Starting lesson"), { target: { value: "20" } });
    await submit(container);
    expect((saveStart.mock.calls[0][1] as FormData).get("seq")).toBe("20");
    expect(await screen.findByRole("alert")).toHaveTextContent("16 or older");
    expect(pose()).toContain("buddy-curious");
  });
});

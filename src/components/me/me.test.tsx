import { createTranslator } from "next-intl";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils";
import messages from "../../../messages/en.json";

const requireAal2 = vi.fn();
const getProfile = vi.fn();

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages, namespace: namespace as never }),
}));
vi.mock("@/lib/auth/guard", () => ({ requireAal2FromClaims: (...a: unknown[]) => requireAal2(...a) }));
vi.mock("@/lib/profile", () => ({ getProfile: (...a: unknown[]) => getProfile(...a) }));
// The real SignOutForm calls a server action; what matters here is that the confirm button submits it.
vi.mock("@/components/SignOutForm", () => ({
  SignOutForm: ({ children }: { children: React.ReactNode }) => <form data-testid="sign-out">{children}</form>,
}));

import MePage from "@/app/(app)/me/page";
import { MeView } from "./MeView";

beforeEach(() => {
  localStorage.clear();
  requireAal2.mockResolvedValue({ userId: "u1" });
  getProfile.mockResolvedValue({ display_name: "Raghav" });
});
afterEach(() => vi.unstubAllGlobals());

describe("Me", () => {
  it("coat header with the name and a happy Buddy, the tab bar with Me active, and no 'coming soon'", async () => {
    const { container } = renderWithIntl(await MePage());
    const header = container.querySelector("header")!;
    expect(header.className).toContain("rounded-coat");
    expect(screen.getByRole("heading", { level: 1, name: "Me" })).toBeInTheDocument();
    expect(header).toHaveTextContent("Raghav");
    expect(header.querySelector("img")!.getAttribute("src")).toContain("buddy-happy");
    expect(screen.getByRole("link", { name: "Me" })).toHaveAttribute("aria-current", "page");
    expect(container).not.toHaveTextContent("Coming soon");
  });

  it("works without a profile name", () => {
    renderWithIntl(<MeView name={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Me" })).toBeInTheDocument();
  });

  it("has the theme switch, feedback, the three legal links and Log out", () => {
    renderWithIntl(<MeView name="Raghav" />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send feedback" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum");
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/datenschutz");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("the theme switch changes the theme", () => {
    renderWithIntl(<MeView name="Raghav" />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("Log out", () => {
  it("asks first; only the confirm button inside the sign-out form logs out, and Stay logged in closes the sheet", () => {
    renderWithIntl(<MeView name="Raghav" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = screen.getByRole("dialog", { name: "Log out?" });
    expect(dialog).toHaveTextContent("Reviews that haven't synced yet are kept");
    const confirm = within(dialog).getByRole("button", { name: "Log out" });
    expect(confirm).toHaveAttribute("type", "submit");
    expect(confirm.closest("form")).toBe(screen.getByTestId("sign-out"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Stay logged in" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Send feedback", () => {
  it("opens a sheet, posts the message and says thanks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderWithIntl(<MeView name="Raghav" />);
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    const dialog = screen.getByRole("dialog", { name: "Send feedback" });
    fireEvent.change(within(dialog).getByLabelText("What's on your mind?"), { target: { value: "Wuff" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Thank you!"));
    expect(fetchMock).toHaveBeenCalledWith("/api/feedback", expect.objectContaining({ method: "POST", body: JSON.stringify({ message: "Wuff" }) }));
  });

  it("shows an error and keeps the message box when sending fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    renderWithIntl(<MeView name="Raghav" />);
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("What's on your mind?"), { target: { value: "x" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Couldn't send that");
  });
});

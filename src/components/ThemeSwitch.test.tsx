import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test-utils";
import { ThemeSwitch } from "./ThemeSwitch";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeSwitch", () => {
  it("offers System, Light and Dark and starts on System", () => {
    renderWithIntl(<ThemeSwitch />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "false");
  });

  it("switching to Dark sets the theme and remembers it; System clears it", () => {
    renderWithIntl(<ThemeSwitch />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("buddy.theme")).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("shows the saved choice after mount", async () => {
    localStorage.setItem("buddy.theme", "light");
    renderWithIntl(<ThemeSwitch />);
    expect(await screen.findByRole("radio", { name: "Light", checked: true })).toBeInTheDocument();
  });
});

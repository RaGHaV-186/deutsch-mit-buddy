/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors on purpose: this is what the click listener sees */
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/home";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { NavPending } from "./NavPending";

const pending = () => document.documentElement.hasAttribute("data-nav-pending");
const page = () =>
  render(
    <>
      <NavPending />
      <a href="/learn">Learn</a>
      <a href="/home">Here</a>
      <a href="/learn" target="_blank">New tab</a>
      <a href="https://example.com/x">Elsewhere</a>
    </>,
  );

beforeEach(() => history.pushState({}, "", "/home"));
afterEach(() => {
  pathname = "/home";
  document.documentElement.removeAttribute("data-nav-pending");
  vi.useRealTimers();
});

describe("NavPending", () => {
  it("marks the page as pending the moment a link to another screen is pressed", () => {
    const { getByText } = page();
    expect(pending()).toBe(false);
    fireEvent.click(getByText("Learn"));
    expect(pending()).toBe(true);
  });

  it("ignores the same screen, a new tab, another site and modified clicks", () => {
    const { getByText } = page();
    fireEvent.click(getByText("Here"));
    fireEvent.click(getByText("New tab"));
    fireEvent.click(getByText("Elsewhere"));
    fireEvent.click(getByText("Learn"), { metaKey: true });
    fireEvent.click(getByText("Learn"), { button: 1 });
    expect(pending()).toBe(false);
  });

  it("clears when the new screen arrives", () => {
    const { getByText, rerender } = page();
    fireEvent.click(getByText("Learn"));
    pathname = "/learn";
    rerender(<NavPending />);
    expect(pending()).toBe(false);
  });

  it("gives up after 10 seconds so a lost connection never leaves the screen dimmed", () => {
    vi.useFakeTimers();
    const { getByText } = page();
    fireEvent.click(getByText("Learn"));
    vi.advanceTimersByTime(10_100);
    expect(pending()).toBe(false);
  });
});

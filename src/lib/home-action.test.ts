import { describe, expect, it } from "vitest";
import { homeAction, LESSON_CONTENT_AVAILABLE } from "./home-action";

describe("homeAction", () => {
  it("today (no lesson content yet): review the cards, never a coming-soon page", () => {
    expect(LESSON_CONTENT_AVAILABLE).toBe(false);
    expect(homeAction()).toEqual({ href: "/cards", label: "reviewCards" });
  });
  it("when lessons exist: Continue opens the lesson", () => {
    expect(homeAction(true)).toEqual({ href: "/learn", label: "continue" });
  });
});

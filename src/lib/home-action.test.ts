import { describe, expect, it } from "vitest";
import { homeAction, LESSON_CONTENT_AVAILABLE } from "./home-action";

describe("homeAction", () => {
  it("today (lessons are published and can be read on Learn): Continue opens the Learn tab", () => {
    expect(LESSON_CONTENT_AVAILABLE).toBe(true);
    expect(homeAction()).toEqual({ href: "/learn", label: "continue" });
  });
  it("with the switch off: review the cards, never a coming-soon page", () => {
    expect(homeAction(false)).toEqual({ href: "/cards", label: "reviewCards" });
  });
  it("when lessons exist: Continue opens the lesson", () => {
    expect(homeAction(true)).toEqual({ href: "/learn", label: "continue" });
  });
});

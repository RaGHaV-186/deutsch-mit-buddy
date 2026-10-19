import { SESSIONS } from "@data/curriculum";
import { describe, expect, it } from "vitest";
import { findStartingPoint, groupByPhase, STARTING_POINTS } from "./starting-points";

describe("starting points", () => {
  it("offers lessons only, with unique codes", () => {
    const codes = STARTING_POINTS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain("SAT");
    expect(codes).not.toContain("SUN");
    expect(codes).not.toContain("BUF");
    expect(codes[0]).toBe("Z1");
  });
  it("maps every seq back to the same session", () => {
    for (const p of STARTING_POINTS) {
      expect(SESSIONS[p.seq].code).toBe(p.code);
      expect(findStartingPoint(p.seq)).toBe(p);
    }
  });
  it("rejects weekends, reviews and out-of-range values", () => {
    const sat = SESSIONS.findIndex((s) => s.code === "SAT");
    expect(findStartingPoint(sat)).toBeUndefined();
    expect(findStartingPoint(-1)).toBeUndefined();
    expect(findStartingPoint(SESSIONS.length)).toBeUndefined();
  });
  it("groups by phase in order", () => {
    expect(groupByPhase().map((g) => g.phase)).toEqual(["zero", "A1", "A2", "B1", "exam"]);
  });
});

import { describe, expect, it } from "vitest";
import { localDayKey, safeTimeZone, startOfLocalDay, startOfNextLocalDay } from "./time";

const BERLIN = "Europe/Berlin";

describe("time zones", () => {
  it("finds the local day, which can differ from the UTC day", () => {
    expect(localDayKey(new Date("2026-10-20T22:30:00Z"), BERLIN)).toBe("2026-10-21");
    expect(localDayKey(new Date("2026-10-20T21:59:00Z"), BERLIN)).toBe("2026-10-20");
  });

  it("ends the local day at local midnight (summer time, UTC+2)", () => {
    expect(startOfNextLocalDay(new Date("2026-10-20T10:00:00Z"), BERLIN).toISOString()).toBe("2026-10-20T22:00:00.000Z");
  });

  it("handles the 25-hour day when summer time ends (25 Oct 2026)", () => {
    const now = new Date("2026-10-25T08:00:00Z");
    expect(startOfLocalDay(now, BERLIN).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(startOfNextLocalDay(now, BERLIN).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("handles the 23-hour day when summer time starts (29 Mar 2026)", () => {
    const now = new Date("2026-03-29T08:00:00Z");
    expect(startOfLocalDay(now, BERLIN).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(startOfNextLocalDay(now, BERLIN).toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("falls back to Berlin for an unknown zone", () => {
    expect(safeTimeZone("Mars/Olympus")).toBe(BERLIN);
    expect(safeTimeZone(null)).toBe(BERLIN);
    expect(safeTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });
});

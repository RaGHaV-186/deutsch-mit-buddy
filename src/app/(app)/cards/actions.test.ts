import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAal2 = vi.fn();
const getProfile = vi.fn();
const limitError = vi.fn();
const importSeedDeck = vi.fn();
const setSeedPointer = vi.fn();
const ensureLessonCards = vi.fn();

vi.mock("@/lib/auth/guard", () => ({ requireAal2: (...a: unknown[]) => requireAal2(...a) }));
vi.mock("@/lib/profile", () => ({ getProfile: (...a: unknown[]) => getProfile(...a) }));
vi.mock("@/lib/rate-limit", () => ({ limitError: (...a: unknown[]) => limitError(...a) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ admin: true }) }));
vi.mock("@/lib/cards/server", () => ({
  importSeedDeck: (...a: unknown[]) => importSeedDeck(...a),
  setSeedPointer: (...a: unknown[]) => setSeedPointer(...a),
}));
vi.mock("@/lib/cards/ensure-unlocked", () => ({ ensureLessonCards: (...a: unknown[]) => ensureLessonCards(...a) }));

import { importSeedDeckAction } from "./actions";

const result = { imported: 202, alreadyThere: 0, duplicatesSkipped: 11, seen: 170, fresh: 32 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireAal2.mockResolvedValue({ userId: "admin-1" });
  getProfile.mockResolvedValue({ role: "admin" });
  limitError.mockResolvedValue(undefined);
  importSeedDeck.mockResolvedValue(result);
  setSeedPointer.mockResolvedValue({ moved: true });
  ensureLessonCards.mockResolvedValue({ unlocked: 41, skipped: 7, throughSeq: 8 });
});

describe("importSeedDeckAction", () => {
  it("imports for the signed-in admin, moves the pointer to Z9, unlocks the lesson cards and reports the counts", async () => {
    expect(await importSeedDeckAction()).toEqual({ result: { ...result, pointerMoved: true, lessonCardsUnlocked: 41 } });
    expect(importSeedDeck).toHaveBeenCalledWith({ admin: true }, "admin-1", expect.anything(), expect.any(Date));
    expect(setSeedPointer).toHaveBeenCalledWith({ admin: true }, "admin-1");
    expect(ensureLessonCards).toHaveBeenCalledWith("admin-1", expect.any(Date));
    // the pointer is set before the unlock, so the unlock sees Z9
    expect(setSeedPointer.mock.invocationCallOrder[0]).toBeLessThan(ensureLessonCards.mock.invocationCallOrder[0]);
  });

  it("still reports the import when the unlock finds nothing (no lesson published yet)", async () => {
    ensureLessonCards.mockResolvedValue(null);
    setSeedPointer.mockResolvedValue({ moved: false });
    expect(await importSeedDeckAction()).toEqual({ result: { ...result, pointerMoved: false, lessonCardsUnlocked: 0 } });
  });

  it("refuses members, without touching the database", async () => {
    getProfile.mockResolvedValue({ role: "member" });
    expect(await importSeedDeckAction()).toEqual({ error: "forbidden" });
    getProfile.mockResolvedValue(null);
    expect(await importSeedDeckAction()).toEqual({ error: "forbidden" });
    expect(importSeedDeck).not.toHaveBeenCalled();
    expect(setSeedPointer).not.toHaveBeenCalled();
  });

  it("is rate limited, and says 'unavailable' when the limiter is broken", async () => {
    limitError.mockResolvedValue("rate_limited");
    expect(await importSeedDeckAction()).toEqual({ error: "rate_limited" });
    limitError.mockResolvedValue("unavailable");
    expect(await importSeedDeckAction()).toEqual({ error: "unavailable" });
    expect(importSeedDeck).not.toHaveBeenCalled();
  });

  it("shows a generic error when the import fails", async () => {
    importSeedDeck.mockRejectedValue(new Error("boom"));
    expect(await importSeedDeckAction()).toEqual({ error: "generic" });
  });
});

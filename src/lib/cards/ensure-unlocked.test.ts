import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
const unlockForUser = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ limit }) }) }),
}));
vi.mock("./unlock", async (importOriginal) => ({ ...(await importOriginal<typeof import("./unlock")>()), unlockForUser: (...a: unknown[]) => unlockForUser(...a) }));

import { indexOfCode } from "@data/curriculum";
import { ensureLessonCardsIfNew, resetPublishedCache } from "./ensure-unlocked";

const profile = (over = {}) => ({ onboarded_at: "2026-10-01T00:00:00Z", session_seq: indexOfCode("Z9"), deck_unlocked_seq: indexOfCode("Z9"), ...over });
const published = (...codes: string[]) => limit.mockResolvedValue({ data: codes.map((session_code) => ({ session_code })), error: null });

beforeEach(() => {
  vi.clearAllMocks();
  resetPublishedCache();
  unlockForUser.mockResolvedValue({ unlocked: 0, skipped: 0, throughSeq: null });
});

describe("ensureLessonCardsIfNew", () => {
  it("does nothing before onboarding, and without reading anything", async () => {
    await ensureLessonCardsIfNew("u1", profile({ onboarded_at: null }));
    expect(limit).not.toHaveBeenCalled();
    expect(unlockForUser).not.toHaveBeenCalled();
  });

  it("skips the unlock when every published lesson up to today's is already unlocked", async () => {
    published("Z8", "Z9", "Z10");
    await ensureLessonCardsIfNew("u1", profile());
    expect(unlockForUser).not.toHaveBeenCalled();
  });

  it("remembers the published lessons for a minute: one read for many screens", async () => {
    published("Z9");
    await ensureLessonCardsIfNew("u1", profile());
    await ensureLessonCardsIfNew("u1", profile());
    await ensureLessonCardsIfNew("u2", profile());
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it("runs the full unlock when a lesson up to today's is published after the last unlocked one", async () => {
    published("Z9", "Z10");
    await ensureLessonCardsIfNew("u1", profile({ deck_unlocked_seq: indexOfCode("Z8"), session_seq: indexOfCode("Z10") }));
    expect(unlockForUser).toHaveBeenCalledTimes(1);
    expect(unlockForUser.mock.calls[0][1]).toBe("u1");
  });

  it("runs the unlock for a learner who never unlocked anything", async () => {
    published("Z1");
    await ensureLessonCardsIfNew("u1", profile({ deck_unlocked_seq: null, session_seq: 0 }));
    expect(unlockForUser).toHaveBeenCalledTimes(1);
  });

  it("falls back to the full unlock (which never throws) when the list cannot be read", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "down" } });
    await ensureLessonCardsIfNew("u1", profile());
    expect(unlockForUser).toHaveBeenCalledTimes(1);
  });
});

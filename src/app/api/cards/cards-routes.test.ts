import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getClaims = vi.fn();
const limitError = vi.fn();
const applyReviews = vi.fn();
const getSnapshot = vi.fn();
const maybeSingle = vi.fn();
const adminClient = { admin: true };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, getClaims },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));
vi.mock("@/lib/rate-limit", () => ({
  limitError: (...a: unknown[]) => limitError(...a),
  clientIp: () => "1.1.1.1",
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/cards/server", () => ({
  applyReviews: (...a: unknown[]) => applyReviews(...a),
  getSnapshot: (...a: unknown[]) => getSnapshot(...a),
}));

import { POST as sync } from "./sync/route";
import { POST as snapshot } from "./snapshot/route";

const signedIn = (aal = "aal2") => {
  getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.de" } }, error: null });
  getClaims.mockResolvedValue({ data: { claims: { aal } } });
};
const post = (route: (r: Request) => Promise<Response>, body: unknown) =>
  route(new Request("http://x/api/cards", { method: "POST", body: JSON.stringify(body) }));
const event = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  cardId: randomUUID(),
  grade: "good",
  reviewedAt: "2026-10-20T10:00:00Z",
  msTaken: 900,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  limitError.mockResolvedValue(undefined);
  getUser.mockResolvedValue({ data: { user: null }, error: { message: "none" } });
  maybeSingle.mockResolvedValue({ data: { timezone: "Asia/Kolkata" } });
  applyReviews.mockResolvedValue({ acknowledged: [], cards: [] });
  getSnapshot.mockResolvedValue({ now: "2026-10-20T10:00:00.000Z", timezone: "Asia/Kolkata", newToday: 0, cards: [] });
});

describe("POST /api/cards/sync", () => {
  it("needs a session and two-factor, and never reaches the database without them", async () => {
    expect((await post(sync, { reviews: [event()] })).status).toBe(401);
    signedIn("aal1");
    expect((await post(sync, { reviews: [event()] })).status).toBe(403);
    expect(applyReviews).not.toHaveBeenCalled();
  });

  it("applies the reviews as the signed-in user with the service role", async () => {
    signedIn();
    const reviews = [event(), event({ grade: "easy" })];
    const res = await post(sync, { reviews });
    expect(res.status).toBe(200);
    expect(applyReviews).toHaveBeenCalledWith(adminClient, "user-1", reviews, expect.any(Date));
  });

  it("ignores a user id smuggled into the body", async () => {
    signedIn();
    await post(sync, { reviews: [event()], userId: "someone-else" });
    expect(applyReviews.mock.calls[0][1]).toBe("user-1");
  });

  it.each([
    ["an unknown grade", { reviews: [event({ grade: "perfect" })] }],
    ["a card id that is not a uuid", { reviews: [event({ cardId: "1 OR 1=1" })] }],
    ["a bad date", { reviews: [event({ reviewedAt: "yesterday" })] }],
    ["a negative time taken", { reviews: [event({ msTaken: -1 })] }],
    ["an empty batch", { reviews: [] }],
    ["501 events", { reviews: Array.from({ length: 501 }, () => event()) }],
    ["no body fields", {}],
  ])("rejects %s", async (_name, body) => {
    signedIn();
    expect((await post(sync, body)).status).toBe(400);
    expect(applyReviews).not.toHaveBeenCalled();
  });

  it("accepts a full batch of 500", async () => {
    signedIn();
    expect((await post(sync, { reviews: Array.from({ length: 500 }, () => event()) })).status).toBe(200);
  });

  it("is rate limited", async () => {
    signedIn();
    limitError.mockResolvedValue("rate_limited");
    expect((await post(sync, { reviews: [event()] })).status).toBe(429);
    expect(applyReviews).not.toHaveBeenCalled();
  });

  it("answers 500 without leaking details when saving fails", async () => {
    signedIn();
    applyReviews.mockRejectedValue(new Error("duplicate key value violates unique constraint secret_detail"));
    const res = await post(sync, { reviews: [event()] });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "failed" });
  });
});

describe("POST /api/cards/snapshot", () => {
  it("needs two-factor", async () => {
    signedIn("aal1");
    expect((await post(snapshot, {})).status).toBe(403);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("returns the snapshot for the signed-in user in their timezone", async () => {
    signedIn();
    const res = await post(snapshot, {});
    expect(res.status).toBe(200);
    expect((await res.json()).timezone).toBe("Asia/Kolkata");
    expect(getSnapshot).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(Date), "Asia/Kolkata");
  });

  it("falls back to Berlin when the profile has no usable timezone", async () => {
    signedIn();
    maybeSingle.mockResolvedValue({ data: { timezone: "Not/AZone" } });
    await post(snapshot, {});
    expect(getSnapshot.mock.calls[0][3]).toBe("Europe/Berlin");
  });
});

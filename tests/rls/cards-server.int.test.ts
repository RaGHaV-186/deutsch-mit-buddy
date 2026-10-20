import { randomUUID } from "node:crypto";
import rawSeed from "@data/seed-cards.json";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyReviews, getSnapshot, importSeedDeck } from "@/lib/cards/server";
import { admin, createMember, resetState, type TestUser } from "./helpers";

// The server-side card logic against a real database: the same code the sync route and the import action run.
const TZ = "Europe/Berlin";
const ev = (cardId: string, grade: "again" | "hard" | "good" | "easy", at: Date) => ({
  id: randomUUID(),
  cardId,
  grade,
  reviewedAt: at.toISOString(),
  msTaken: 1200,
});
const minutes = (base: Date, n: number) => new Date(base.getTime() + n * 60_000);

describe("flashcards: server logic", () => {
  let a: TestUser;
  let b: TestUser;
  const now = new Date();

  beforeAll(async () => {
    await resetState();
    a = await createMember();
    b = await createMember();
  });
  afterAll(resetState);

  async function srs(cardId: string) {
    const { data } = await admin.from("card_srs").select("*").eq("card_id", cardId).single();
    return data!;
  }
  async function firstCard(userId: string, where: { seen: boolean }) {
    const { data } = await admin.from("card_srs").select("card_id, reps, last_reviewed_at").eq("user_id", userId);
    return data!.find((r) => (r.last_reviewed_at !== null) === where.seen)!.card_id as string;
  }

  describe("importSeedDeck", () => {
    it("imports the deck once: seen cards spread over days, Z9 cards new", async () => {
      const first = await importSeedDeck(admin, a.id, rawSeed, now);
      expect(first).toMatchObject({ imported: 202, alreadyThere: 0, duplicatesSkipped: 11 });
      expect(first.seen + first.fresh).toBe(202);
      expect(first.fresh).toBeGreaterThan(0);
      const { count } = await admin.from("card_srs").select("*", { count: "exact", head: true }).eq("user_id", a.id);
      expect(count).toBe(202);
    });

    it("run again: nothing duplicated and no progress reset", async () => {
      const id = await firstCard(a.id, { seen: true });
      const changed = await applyReviews(admin, a.id, [ev(id, "easy", minutes(now, 1))], now);
      const before = await srs(id);
      const again = await importSeedDeck(admin, a.id, rawSeed, minutes(now, 5));
      expect(again).toMatchObject({ imported: 0, alreadyThere: 202 });
      expect(await srs(id)).toEqual(before);
      expect(changed.cards).toHaveLength(1);
    });

    it("keeps each user's deck separate", async () => {
      expect((await importSeedDeck(admin, b.id, rawSeed, now)).imported).toBe(202);
      const { count } = await admin.from("cards").select("*", { count: "exact", head: true }).eq("user_id", a.id);
      expect(count).toBe(202);
    });
  });

  describe("getSnapshot (read with the member's own session)", () => {
    it("returns only the member's cards: due reviews plus a limited set of new cards", async () => {
      const snap = await getSnapshot(a.aal2, a.id, now, TZ);
      expect(snap.cards.length).toBeGreaterThan(0);
      expect(snap.cards.length).toBeLessThanOrEqual(300 + 40);
      const ids = snap.cards.map((c) => c.id);
      const { data: mine } = await admin.from("cards").select("id").eq("user_id", a.id).in("id", ids);
      expect(mine).toHaveLength(ids.length);
      const fresh = snap.cards.filter((c) => c.srs.lastReviewedAt === null);
      expect(fresh.filter((c) => c.kind === "word").length).toBeLessThanOrEqual(20);
      expect(fresh.filter((c) => c.kind !== "word").length).toBeLessThanOrEqual(20);
      const due = snap.cards.filter((c) => c.srs.lastReviewedAt !== null);
      expect(due.length).toBeGreaterThan(0);
      expect(due.every((c) => Date.parse(c.srs.dueAt) < now.getTime() + 2 * 86_400_000)).toBe(true);
    });

    it("an aal1 session gets nothing", async () => {
      const snap = await getSnapshot(a.aal1, a.id, now, TZ);
      expect(snap.cards).toEqual([]);
    });

    it("counts new cards started today, but not already-seen cards reviewed today", async () => {
      const before = (await getSnapshot(a.aal2, a.id, now, TZ)).newToday;
      const fresh = await firstCard(a.id, { seen: false });
      await applyReviews(admin, a.id, [ev(fresh, "good", minutes(now, -1))], now);
      const seen = await firstCard(a.id, { seen: true });
      await applyReviews(admin, a.id, [ev(seen, "good", minutes(now, -1))], now);
      expect((await getSnapshot(a.aal2, a.id, now, TZ)).newToday).toBe(before + 1);
    });
  });

  describe("applyReviews", () => {
    it("schedules a new card from a review and records it", async () => {
      const id = await firstCard(a.id, { seen: false });
      const t = minutes(now, -30);
      const event = ev(id, "good", t);
      const res = await applyReviews(admin, a.id, [event], now);
      expect(res.acknowledged).toEqual([event.id]);
      expect(res.cards[0]).toMatchObject({ id, srs: { reps: 1, intervalDays: 2 } });
      expect(new Date((await srs(id)).last_reviewed_at).toISOString()).toBe(t.toISOString());
      const { data } = await admin.from("reviews").select("applied, was_new, ms_taken").eq("id", event.id).single();
      expect(data).toEqual({ applied: true, was_new: true, ms_taken: 1200 });
    });

    it("is safe to repeat: the same event id is acknowledged but changes nothing", async () => {
      const id = await firstCard(a.id, { seen: false });
      const event = ev(id, "good", minutes(now, -20));
      await applyReviews(admin, a.id, [event], now);
      const before = await srs(id);
      const again = await applyReviews(admin, a.id, [event], now);
      expect(again.acknowledged).toEqual([event.id]);
      expect(await srs(id)).toEqual(before);
      const { count } = await admin.from("reviews").select("*", { count: "exact", head: true }).eq("id", event.id);
      expect(count).toBe(1);
    });

    it("latest review wins: an older review that arrives later is stored but not applied", async () => {
      const id = await firstCard(a.id, { seen: false });
      const newer = ev(id, "easy", minutes(now, -10));
      await applyReviews(admin, a.id, [newer], now);
      const after = await srs(id);
      const older = ev(id, "again", minutes(now, -50));
      const res = await applyReviews(admin, a.id, [older], now);
      expect(await srs(id)).toEqual(after);
      expect(res.cards[0].srs.reps).toBe(after.reps);
      const { data } = await admin.from("reviews").select("applied").eq("id", older.id).single();
      expect(data!.applied).toBe(false);
    });

    it("sorts a batch by time, whatever order the device sent it in", async () => {
      const id = await firstCard(a.id, { seen: false });
      const first = ev(id, "good", minutes(now, -40));
      const second = ev(id, "good", minutes(now, -35));
      await applyReviews(admin, a.id, [second, first], now);
      const row = await srs(id);
      expect(row.reps).toBe(2);
      expect(new Date(row.last_reviewed_at).toISOString()).toBe(minutes(now, -35).toISOString());
    });

    it("two devices syncing the same card at once end up consistent", async () => {
      const id = await firstCard(a.id, { seen: false });
      const early = ev(id, "good", minutes(now, -4));
      const late = ev(id, "good", minutes(now, -2));
      await Promise.all([applyReviews(admin, a.id, [late], now), applyReviews(admin, a.id, [early], now)]);
      const row = await srs(id);
      expect(new Date(row.last_reviewed_at).toISOString()).toBe(minutes(now, -2).toISOString());
      const { data } = await admin.from("reviews").select("id").in("id", [early.id, late.id]);
      expect(data).toHaveLength(2);
    });

    it("cannot touch another member's card, but still acknowledges the event", async () => {
      const bCard = await firstCard(b.id, { seen: true });
      const before = await srs(bCard);
      const event = ev(bCard, "again", minutes(now, -1));
      const res = await applyReviews(admin, a.id, [event], now);
      expect(res.acknowledged).toEqual([event.id]);
      expect(res.cards).toEqual([]);
      expect(await srs(bCard)).toEqual(before);
      const { count } = await admin.from("reviews").select("*", { count: "exact", head: true }).eq("id", event.id);
      expect(count).toBe(0);
    });

    it("pulls a review from a phone with a wrong clock back to the server time", async () => {
      const id = await firstCard(a.id, { seen: false });
      const future = ev(id, "good", new Date(now.getTime() + 3 * 86_400_000));
      await applyReviews(admin, a.id, [future], now);
      const row = await srs(id);
      expect(Date.parse(row.last_reviewed_at)).toBeLessThanOrEqual(now.getTime());
    });
  });
});

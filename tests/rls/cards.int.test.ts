import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createMember, resetState, type TestUser } from "./helpers";

const card = (userId: string, over: Record<string, unknown> = {}) => ({
  user_id: userId,
  kind: "word",
  en: "dog",
  article: "der",
  de: "Hund",
  plural: "die Hunde",
  example: "Der Hund schläft.",
  example_en: "The dog is sleeping.",
  source: "seed",
  ...over,
});

describe("flashcards", () => {
  let a: TestUser;
  let b: TestUser;
  let aCard: string;
  let bCard: string;
  const aReview = randomUUID();

  beforeAll(async () => {
    await resetState();
    a = await createMember();
    b = await createMember();
    const ins = await admin
      .from("cards")
      .insert([card(a.id), card(b.id, { de: "Katze", en: "cat", article: "die" })])
      .select("id, user_id");
    expect(ins.error).toBeNull();
    aCard = ins.data!.find((c) => c.user_id === a.id)!.id;
    bCard = ins.data!.find((c) => c.user_id === b.id)!.id;
    expect((await admin.from("card_srs").insert([{ card_id: aCard, user_id: a.id }, { card_id: bCard, user_id: b.id }])).error).toBeNull();
    const rev = await admin
      .from("reviews")
      .insert({ id: aReview, user_id: a.id, card_id: aCard, grade: "good", reviewed_at: new Date().toISOString() });
    expect(rev.error).toBeNull();
  });
  afterAll(resetState);

  for (const table of ["cards", "card_srs", "reviews"]) {
    it(`${table}: members see only their own rows`, async () => {
      const { data, error } = await a.aal2.from(table).select("user_id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((r) => r.user_id === a.id)).toBe(true);
      const other = await a.aal2.from(table).select("user_id").eq("user_id", b.id);
      expect(other.data).toEqual([]);
    });

    it(`${table}: members cannot insert, update or delete (the server writes)`, async () => {
      const write =
        table === "cards"
          ? a.aal2.from(table).insert(card(a.id, { source: "manual", de: "Maus" }))
          : table === "card_srs"
            ? a.aal2.from(table).update({ due_at: new Date(0).toISOString() }).eq("card_id", aCard)
            : a.aal2
                .from(table)
                .insert({ id: randomUUID(), user_id: a.id, card_id: aCard, grade: "easy", reviewed_at: new Date().toISOString() });
      expect((await write).error?.code).toBe("42501");
      expect((await a.aal2.from(table).update({ user_id: a.id }).eq("user_id", a.id)).error?.code).toBe("42501");
      expect((await a.aal2.from(table).delete().eq("user_id", a.id)).error?.code).toBe("42501");
    });

    it(`${table}: aal1 sessions and anon get nothing`, async () => {
      expect((await a.aal1.from(table).select("*")).data).toEqual([]);
      expect((await anon().from(table).select("*")).error?.code).toBe("42501");
    });
  }

  it("cannot be altered through someone else's card id", async () => {
    await a.aal2.from("card_srs").update({ ease: 3 }).eq("card_id", bCard);
    const { data } = await admin.from("card_srs").select("ease").eq("card_id", bCard).single();
    expect(data!.ease).toBe(2.5);
  });

  it("enforces column checks", async () => {
    const bad = [
      { kind: "poem" },
      { article: "le" },
      { en: "" },
      { de: "x".repeat(301) },
      { tip: "x".repeat(301) },
      { source: "hacked" },
    ];
    for (const [i, over] of bad.entries()) {
      const { error } = await admin.from("cards").insert(card(a.id, { de: `Test${i}`, ...over }));
      expect(error?.code, JSON.stringify(over)).toBe("23514");
    }
    expect((await admin.from("card_srs").update({ ease: 1.0 }).eq("card_id", aCard)).error?.code).toBe("23514");
    const badReview = await admin
      .from("reviews")
      .insert({ id: randomUUID(), user_id: a.id, card_id: aCard, grade: "perfect", reviewed_at: new Date().toISOString() });
    expect(badReview.error?.code).toBe("23514");
  });

  it("makes the seed import idempotent, per user", async () => {
    const dup = await admin.from("cards").insert(card(a.id));
    expect(dup.error?.code).toBe("23505");
    // The same word for another user, and the same text as a non-seed card, are fine.
    expect((await admin.from("cards").insert(card(b.id))).error).toBeNull();
    expect((await admin.from("cards").insert(card(a.id, { source: "lesson" }))).error).toBeNull();
  });

  it("refuses a review id that was already recorded", async () => {
    const dup = await admin
      .from("reviews")
      .insert({ id: aReview, user_id: a.id, card_id: aCard, grade: "easy", reviewed_at: new Date().toISOString() });
    expect(dup.error?.code).toBe("23505");
  });

  it("removes everything when the user is deleted", async () => {
    const c = await createMember();
    const ins = await admin.from("cards").insert(card(c.id)).select("id").single();
    await admin.from("card_srs").insert({ card_id: ins.data!.id, user_id: c.id });
    await admin
      .from("reviews")
      .insert({ id: randomUUID(), user_id: c.id, card_id: ins.data!.id, grade: "hard", reviewed_at: new Date().toISOString() });
    expect((await admin.auth.admin.deleteUser(c.id)).error).toBeNull();
    for (const table of ["cards", "card_srs", "reviews"]) {
      const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", c.id);
      expect(count, table).toBe(0);
    }
  });
});

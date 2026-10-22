import { indexOfCode } from "@data/curriculum";
import rawSeed from "@data/seed-cards.json";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importSeedDeck, setSeedPointer } from "@/lib/cards/server";
import { parseSeedDeck } from "@/lib/cards/seed";
import { cardKey, unlockForUser, type Plan } from "@/lib/cards/unlock";
import { itemIdsOf, mergeLesson, publishPayload, type PublishPayload } from "@/lib/content/pipeline.ts";
import { lessonRow, validLesson } from "@/lib/content/test-fixtures.ts";
import { admin, createMember, resetState, type TestUser } from "./helpers";

// Unlocking lesson cards against a real database, with a small FAKE lesson plan (TXU1 to TXU8) so that nothing real is touched: the lessons
// that are published in this database are not deleted or changed, and the unlock ignores them because they are not in the fake plan.
// Three words of each fake lesson are words from Raghav's seed deck (the seed words of Z2 to Z9, in capitals: still the same card).
const CODES = ["TXU1", "TXU2", "TXU3", "TXU4", "TXU5", "TXU6", "TXU7", "TXU8"];
const PLAN: Plan = CODES.map((code) => ({ code, kind: "lesson" }));
const REAL = ["Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8", "Z9"];
const SEQ = (code: string) => 9400 + CODES.indexOf(code);
const NOW = new Date("2026-10-23T08:00:00Z");
const seed = parseSeedDeck(rawSeed).cards;
const seedWordsOf = (code: string) => seed.filter((c) => c.kind === "word" && c.sessionCode === REAL[CODES.indexOf(code)]).map((c) => c.de);
/** Cards of one fake lesson: up to three seed words, 15 new words, 5 phrases. */
const cardsIn = (code: string) => seedWordsOf(code).slice(0, 3).length + 20;
const TOTAL = CODES.reduce((n, code) => n + cardsIn(code), 0);

function payload(code: string): PublishPayload {
  const lesson = validLesson();
  const verdicts = itemIdsOf(code, lesson).map((id) => ({ id, status: "ok" as const, reason: "fine", fixed_json: null }));
  const p = publishPayload(mergeLesson(lessonRow({ code, seq: SEQ(code) }), lesson, verdicts));
  const words = [
    ...seedWordsOf(code).slice(0, 3).map((de) => ({ de: de.toUpperCase() })),
    ...Array.from({ length: 15 }, (_, i) => ({ de: `${code}Wort${i}` })),
  ];
  p.cards = [
    ...words.map((w, i) => ({
      session_code: code, kind: "word", tier: i < 10 ? "core" : "bonus", position: i + 1, en: `en ${w.de}`,
      article: null, de: w.de, plural: null, example: "Beispiel.", example_en: "Example.", tip: null,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      session_code: code, kind: "say", tier: "core", position: words.length + i + 1, en: `say ${code} ${i}`, article: null, de: `${code} Satz ${i}.`, plural: null, example: "Satz.", example_en: "Sentence.", tip: null,
    })),
  ];
  return p;
}
const publish = (code: string, p = payload(code)) =>
  admin.rpc("publish_lesson", { p_code: code, p_parts: p.parts, p_status: p.part_status, p_model: "claude-opus-5-5", p_cards: p.cards, p_questions: p.questions });

/** Removes only this test's own lessons (codes TXU*). */
async function wipe() {
  await admin.from("lesson_publications").delete().like("session_code", "TXU%");
  await admin.from("lesson_parts").delete().like("session_code", "TXU%");
  await admin.from("card_templates").delete().like("session_code", "TXU%");
  await admin.from("question_bank").delete().like("session_code", "TXU%");
}
const deckOf = async (userId: string) => (await admin.from("cards").select("id, kind, de, en, source, session_code, template_id, user_edited").eq("user_id", userId).limit(5000)).data!;
/** Puts a test learner on a fake lesson: pointer and start both there (day count as given). */
const onboard = (userId: string, code: string, day = 1) =>
  admin.from("profiles").update({ onboarded_at: NOW.toISOString(), session_seq: CODES.indexOf(code), start_code: code, day_count: day, deck_unlocked_seq: null }).eq("user_id", userId);
const unlock = (userId: string, now = NOW) => unlockForUser(admin, userId, now, PLAN);

describe("unlocking lesson cards", () => {
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  beforeAll(async () => {
    await resetState();
    await wipe();
    await admin.from("curriculum_sessions").delete().like("code", "TXU%");
    const rows = CODES.map((code) => ({ seq: SEQ(code), code, kind: "lesson", phase: "zero", grammar: "g", theme: "t", word_target: 18 }));
    expect((await admin.from("curriculum_sessions").insert(rows)).error).toBeNull();
    a = await createMember();
    b = await createMember();
    c = await createMember();
    for (const code of CODES) expect((await publish(code)).error, code).toBeNull();
  });
  afterAll(async () => {
    await wipe();
    await admin.from("curriculum_sessions").delete().like("code", "TXU%");
    await resetState();
  });

  it("a learner who owns the seed deck gets the lesson words he does not own, and no second copy of any seed word", async () => {
    await onboard(a.id, "TXU8", 11);
    await importSeedDeck(admin, a.id, rawSeed, NOW);
    const seedBefore = (await deckOf(a.id)).length;
    const result = await unlock(a.id);
    const overlap = CODES.reduce((n, code) => n + seedWordsOf(code).slice(0, 3).length, 0);
    expect(overlap).toBeGreaterThan(15);
    expect(result).toMatchObject({ unlocked: TOTAL - overlap, skipped: overlap, throughSeq: CODES.length - 1 });

    const deck = await deckOf(a.id);
    const lessonCards = deck.filter((x) => x.source === "lesson");
    expect(deck.filter((x) => x.source === "seed")).toHaveLength(seedBefore);
    expect(lessonCards).toHaveLength(result!.unlocked);
    expect(lessonCards.every((x) => x.template_id !== null)).toBe(true);
    // no new card repeats a seed card or another lesson card
    const seedKeys = new Set(deck.filter((x) => x.source === "seed").map((x) => cardKey(x.kind, x.de)));
    const lessonKeys = lessonCards.map((x) => cardKey(x.kind, x.de));
    expect(lessonKeys.some((k) => seedKeys.has(k))).toBe(false);
    expect(new Set(lessonKeys).size).toBe(lessonKeys.length);

    // TXU1 to TXU7 start as already seen (reps 1, spread over days); TXU8, the starting lesson, is new
    const { data: srs } = await admin.from("card_srs").select("card_id, reps, due_at").eq("user_id", a.id);
    const repsOf = new Map(srs!.map((r) => [r.card_id as string, r.reps as number]));
    expect(lessonCards.filter((x) => x.session_code === "TXU8").every((x) => repsOf.get(x.id) === 0)).toBe(true);
    expect(lessonCards.filter((x) => x.session_code === "TXU5").every((x) => repsOf.get(x.id) === 1)).toBe(true);
    expect(deck.every((x) => repsOf.has(x.id))).toBe(true);
    const { data: profile } = await admin.from("profiles").select("deck_unlocked_seq").eq("user_id", a.id).single();
    expect(profile!.deck_unlocked_seq).toBe(CODES.length - 1);
  });

  it("running it again changes nothing", async () => {
    const before = await deckOf(a.id);
    expect(await unlock(a.id, new Date(NOW.getTime() + 3600_000))).toMatchObject({ unlocked: 0 });
    expect(await deckOf(a.id)).toHaveLength(before.length);
  });

  it("the other way round: lesson cards first, then the seed import skips the words he already has", async () => {
    await onboard(b.id, "TXU8", 11);
    const first = await unlock(b.id);
    expect(first!.unlocked).toBe(TOTAL);
    const imported = await importSeedDeck(admin, b.id, rawSeed, NOW);
    const ownedKeys = new Set((await deckOf(b.id)).filter((x) => x.source === "lesson").map((x) => cardKey(x.kind, x.de)));
    const clashes = seed.filter((s) => ownedKeys.has(cardKey(s.kind, s.de))).length;
    expect(clashes).toBeGreaterThan(15);
    expect(imported.imported).toBe(seed.length - clashes);
  });

  describe("a corrected template reaches every copy", () => {
    it("updates the text of the copies, keeps their schedule, and leaves edited cards alone", async () => {
      const corrected = "corrected meaning";
      const target = (await deckOf(a.id)).find((x) => x.session_code === "TXU5" && x.de === "TXU5Wort0")!;
      const { data: srsBefore } = await admin.from("card_srs").select("*").eq("card_id", target.id).single();
      // a second learner edited the same card himself
      const editedCopy = (await deckOf(b.id)).find((x) => x.session_code === "TXU5" && x.de === "TXU5Wort0")!;
      await admin.from("cards").update({ user_edited: true, en: "my own wording" }).eq("id", editedCopy.id);

      const p = payload("TXU5");
      p.cards.find((x) => x.de === "TXU5Wort0")!.en = corrected;
      expect((await publish("TXU5", p)).error).toBeNull();

      const after = (await deckOf(a.id)).find((x) => x.id === target.id)!;
      expect(after.en).toBe(corrected);
      const { data: srsAfter } = await admin.from("card_srs").select("*").eq("card_id", target.id).single();
      expect(srsAfter).toEqual(srsBefore);
      const stillEdited = (await deckOf(b.id)).find((x) => x.id === editedCopy.id)!;
      expect(stillEdited.en).toBe("my own wording");
      // the template is one row, updated in place: the copies still point at it
      const { data: tpls } = await admin.from("card_templates").select("id, en").eq("session_code", "TXU5").eq("de", "TXU5Wort0");
      expect(tpls).toHaveLength(1);
      expect(tpls![0].id).toBe(target.template_id);
    });

    it("a slot the lesson no longer has is removed; the copy keeps its text and loses the link", async () => {
      const p = payload("TXU6");
      const gone = p.cards.find((x) => x.de === "TXU6Wort14")!;
      p.cards = p.cards.filter((x) => x !== gone);
      p.cards.push({ ...gone, kind: "say", position: 99, de: "TXU6 Satz extra.", en: "say TXU6 extra" });
      expect((await publish("TXU6", p)).error).toBeNull();
      const copy = (await deckOf(a.id)).find((x) => x.de === "TXU6Wort14")!;
      expect(copy.template_id).toBeNull();
      expect((await admin.from("card_templates").select("id").eq("session_code", "TXU6").eq("de", "TXU6Wort14")).data).toHaveLength(0);
    });
  });

  // These two unpublish and publish again (wipe: only the TXU lessons), which unlinks the copies of those lessons: they run after the correction tests.
  it("lessons published later are picked up when the learner next comes (and only those)", async () => {
    await onboard(c.id, "TXU8", 11);
    await wipe();
    for (const code of ["TXU1", "TXU2"]) await publish(code);
    expect((await unlock(c.id))!.unlocked).toBe(cardsIn("TXU1") + cardsIn("TXU2"));
    for (const code of CODES.slice(2)) expect((await publish(code)).error).toBeNull();
    const later = await unlock(c.id);
    expect(later!.unlocked).toBe(TOTAL - cardsIn("TXU1") - cardsIn("TXU2"));
    expect((await deckOf(c.id)).filter((x) => x.source === "lesson")).toHaveLength(TOTAL);
  });

  it("does nothing before onboarding, and only published lessons up to the pointer count", async () => {
    const d = await createMember();
    expect(await unlock(d.id)).toBeNull();
    await onboard(d.id, "TXU3");
    const r = await unlock(d.id);
    expect(r!.unlocked).toBe(cardsIn("TXU1") + cardsIn("TXU2") + cardsIn("TXU3"));
  });

  it("an admin's deck is not unlocked before the seed import (his own cards come first), and is right after it", async () => {
    const f = await createMember();
    await onboard(f.id, "TXU4", 11);
    await admin.from("profiles").update({ role: "admin" }).eq("user_id", f.id);
    expect(await unlock(f.id)).toBeNull();
    expect((await deckOf(f.id)).length).toBe(0);
    await importSeedDeck(admin, f.id, rawSeed, NOW);
    const seedCount = (await deckOf(f.id)).length;
    const after = await unlock(f.id);
    expect(after!.unlocked).toBeGreaterThan(0);
    expect((await deckOf(f.id)).filter((x) => x.source === "seed")).toHaveLength(seedCount);
  });

  it("never reads or changes the real lessons published in this database", async () => {
    const real = async () => (await admin.from("lesson_publications").select("session_code").not("session_code", "like", "TX%")).data!.map((r) => r.session_code).sort();
    const before = await real();
    await wipe();
    expect(await real()).toEqual(before);
  });

  describe("setSeedPointer", () => {
    it("moves a learner who is earlier to Day 11 · Z9, never backwards", async () => {
      const e = await createMember();
      await admin.from("profiles").update({ onboarded_at: NOW.toISOString(), session_seq: 0, start_code: "Z1", day_count: 1 }).eq("user_id", e.id);
      expect(await setSeedPointer(admin, e.id)).toEqual({ moved: true });
      const { data } = await admin.from("profiles").select("session_seq, day_count, start_code").eq("user_id", e.id).single();
      expect(data).toEqual({ session_seq: indexOfCode("Z9"), day_count: 11, start_code: "Z9" });
      expect(await setSeedPointer(admin, e.id)).toEqual({ moved: false });
      await admin.from("profiles").update({ session_seq: indexOfCode("Z9"), day_count: 12 }).eq("user_id", e.id);
      expect(await setSeedPointer(admin, e.id)).toEqual({ moved: false });
      await admin.from("profiles").update({ session_seq: indexOfCode("W2.1"), day_count: 30 }).eq("user_id", e.id);
      expect(await setSeedPointer(admin, e.id)).toEqual({ moved: false });
      const { data: kept } = await admin.from("profiles").select("session_seq, day_count").eq("user_id", e.id).single();
      expect(kept).toEqual({ session_seq: indexOfCode("W2.1"), day_count: 30 });
    });
  });
});

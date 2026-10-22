import { SESSIONS, indexOfCode } from "@data/curriculum";
import rawSeed from "@data/seed-cards.json";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importSeedDeck, setSeedPointer } from "@/lib/cards/server";
import { parseSeedDeck } from "@/lib/cards/seed";
import { cardKey, unlockForUser } from "@/lib/cards/unlock";
import { toCurriculumRows } from "@/lib/content/curriculum-rows.ts";
import { itemIdsOf, mergeLesson, publishPayload, type PublishPayload } from "@/lib/content/pipeline.ts";
import { lessonRow, validLesson } from "@/lib/content/test-fixtures.ts";
import { admin, createMember, resetState, type TestUser } from "./helpers";

// Unlocking lesson cards against a real database: published lessons Z2 to Z9 (three words of each are words Raghav's seed deck has),
// a learner who already owns the seed deck, and a template correction that must reach the copies without touching the schedule.
const CODES = ["Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8", "Z9"];
const NOW = new Date("2026-10-23T08:00:00Z");
const seed = parseSeedDeck(rawSeed).cards;
const seedWordsOf = (code: string) => seed.filter((c) => c.kind === "word" && c.sessionCode === code).map((c) => c.de);
/** Cards of one test lesson: up to three seed words, 15 new words, 5 phrases. */
const cardsIn = (code: string) => seedWordsOf(code).slice(0, 3).length + 20;
const TOTAL = CODES.reduce((n, code) => n + cardsIn(code), 0);

function payload(code: string): PublishPayload {
  const lesson = validLesson();
  const verdicts = itemIdsOf(code, lesson).map((id) => ({ id, status: "ok" as const, reason: "fine", fixed_json: null }));
  const p = publishPayload(mergeLesson(lessonRow({ code, seq: indexOfCode(code) }), lesson, verdicts));
  const own = seedWordsOf(code).slice(0, 3);
  const words = [
    ...own.map((de) => ({ de: de.toUpperCase(), article: null })), // a seed word, written in capitals: still the same card
    ...Array.from({ length: 15 }, (_, i) => ({ de: `${code}Wort${i}`, article: null })),
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

/** Removes ALL published lesson content (the tests need a database where only their lessons exist, as in CI): after a local run, publish again. */
async function wipe() {
  await admin.from("lesson_publications").delete().neq("session_code", "");
  await admin.from("lesson_parts").delete().neq("session_code", "");
  await admin.from("card_templates").delete().neq("session_code", "");
  await admin.from("question_bank").delete().neq("session_code", "");
}
const deckOf = async (userId: string) => (await admin.from("cards").select("id, kind, de, en, source, session_code, template_id, user_edited").eq("user_id", userId).limit(5000)).data!;
const onboard = (userId: string, seq: string, day = 1) =>
  admin.from("profiles").update({ onboarded_at: NOW.toISOString(), session_seq: indexOfCode(seq), start_code: seq, day_count: day }).eq("user_id", userId);

describe("unlocking lesson cards", () => {
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  beforeAll(async () => {
    await resetState();
    await wipe();
    // A fresh database (CI) has no lesson plan: put the real rows of these lessons in (a no-op where the seed script already did).
    const plan = toCurriculumRows(SESSIONS).filter((r) => CODES.includes(r.code) && r.kind === "lesson");
    expect((await admin.from("curriculum_sessions").upsert(plan, { onConflict: "seq" })).error).toBeNull();
    a = await createMember();
    b = await createMember();
    c = await createMember();
    for (const code of CODES) expect((await publish(code)).error, code).toBeNull();
  });
  afterAll(async () => {
    await wipe();
    await resetState();
  });

  it("a learner who owns the seed deck gets the lesson words he does not own, and no second copy of any seed word", async () => {
    await onboard(a.id, "Z9", 11);
    await importSeedDeck(admin, a.id, rawSeed, NOW);
    const seedBefore = (await deckOf(a.id)).length;
    const result = await unlockForUser(admin, a.id, NOW);
    const overlap = CODES.reduce((n, code) => n + seedWordsOf(code).slice(0, 3).length, 0);
    expect(overlap).toBeGreaterThan(15);
    expect(result).toMatchObject({ unlocked: TOTAL - overlap, skipped: overlap, throughSeq: indexOfCode("Z9") });

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

    // Z2 to Z8 start as already seen (reps 1, spread over days); Z9 is new
    const { data: srs } = await admin.from("card_srs").select("card_id, reps, due_at").eq("user_id", a.id);
    const repsOf = new Map(srs!.map((r) => [r.card_id as string, r.reps as number]));
    expect(lessonCards.filter((x) => x.session_code === "Z9").every((x) => repsOf.get(x.id) === 0)).toBe(true);
    expect(lessonCards.filter((x) => x.session_code === "Z5").every((x) => repsOf.get(x.id) === 1)).toBe(true);
    expect(deck.every((x) => repsOf.has(x.id))).toBe(true);
    const { data: profile } = await admin.from("profiles").select("deck_unlocked_seq").eq("user_id", a.id).single();
    expect(profile!.deck_unlocked_seq).toBe(indexOfCode("Z9"));
  });

  it("running it again changes nothing", async () => {
    const before = await deckOf(a.id);
    expect(await unlockForUser(admin, a.id, new Date(NOW.getTime() + 3600_000))).toMatchObject({ unlocked: 0 });
    expect(await deckOf(a.id)).toHaveLength(before.length);
  });

  it("the other way round: lesson cards first, then the seed import skips the words he already has", async () => {
    await onboard(b.id, "Z9", 11);
    const first = await unlockForUser(admin, b.id, NOW);
    expect(first!.unlocked).toBe(TOTAL);
    const imported = await importSeedDeck(admin, b.id, rawSeed, NOW);
    const ownedKeys = new Set((await deckOf(b.id)).filter((x) => x.source === "lesson").map((x) => cardKey(x.kind, x.de)));
    const clashes = seed.filter((s) => ownedKeys.has(cardKey(s.kind, s.de))).length;
    expect(clashes).toBeGreaterThan(15);
    expect(imported.imported).toBe(seed.length - clashes);
    const keys = (await deckOf(b.id)).filter((x) => x.source !== "seed" || !ownedKeys.has(cardKey(x.kind, x.de)));
    expect(keys.length).toBeGreaterThan(0);
  });

  describe("a corrected template reaches every copy", () => {
    it("updates the text of the copies, keeps their schedule, and leaves edited cards alone", async () => {
      const corrected = "corrected meaning";
      const before = await deckOf(a.id);
      const target = before.find((x) => x.session_code === "Z5" && x.de === "Z5Wort0")!;
      const { data: srsBefore } = await admin.from("card_srs").select("*").eq("card_id", target.id).single();
      // a second learner edited the same card himself
      const editedCopy = (await deckOf(b.id)).find((x) => x.session_code === "Z5" && x.de === "Z5Wort0")!;
      await admin.from("cards").update({ user_edited: true, en: "my own wording" }).eq("id", editedCopy.id);

      const p = payload("Z5");
      p.cards.find((x) => x.de === "Z5Wort0")!.en = corrected;
      expect((await publish("Z5", p)).error).toBeNull();

      const after = (await deckOf(a.id)).find((x) => x.id === target.id)!;
      expect(after.en).toBe(corrected);
      const { data: srsAfter } = await admin.from("card_srs").select("*").eq("card_id", target.id).single();
      expect(srsAfter).toEqual(srsBefore);
      const stillEdited = (await deckOf(b.id)).find((x) => x.id === editedCopy.id)!;
      expect(stillEdited.en).toBe("my own wording");
      // the template is one row, updated in place: the copies still point at it
      const { data: tpls } = await admin.from("card_templates").select("id, en").eq("session_code", "Z5").eq("de", "Z5Wort0");
      expect(tpls).toHaveLength(1);
      expect(tpls![0].id).toBe(target.template_id);
    });

    it("a slot the lesson no longer has is removed; the copy keeps its text and loses the link", async () => {
      const p = payload("Z6");
      const gone = p.cards.find((x) => x.de === "Z6Wort14")!;
      p.cards = p.cards.filter((x) => x !== gone);
      p.cards.push({ ...gone, kind: "say", position: 99, de: "Z6 Satz extra.", en: "say Z6 extra" });
      expect((await publish("Z6", p)).error).toBeNull();
      const copy = (await deckOf(a.id)).find((x) => x.de === "Z6Wort14")!;
      expect(copy.template_id).toBeNull();
      expect((await admin.from("card_templates").select("id").eq("session_code", "Z6").eq("de", "Z6Wort14")).data).toHaveLength(0);
    });
  });

  // These two re-publish from scratch (wipe), which unlinks every copy: they run after the correction tests.
  it("lessons published later are picked up when the learner next comes (and only those)", async () => {
    await onboard(c.id, "Z9", 11);
    await wipe();
    for (const code of ["Z2", "Z3"]) await publish(code);
    expect((await unlockForUser(admin, c.id, NOW))!.unlocked).toBe(cardsIn("Z2") + cardsIn("Z3"));
    for (const code of CODES.slice(2)) expect((await publish(code)).error).toBeNull();
    const later = await unlockForUser(admin, c.id, NOW);
    expect(later!.unlocked).toBe(TOTAL - cardsIn("Z2") - cardsIn("Z3"));
    expect((await deckOf(c.id)).filter((x) => x.source === "lesson")).toHaveLength(TOTAL);
  });

  it("does nothing before onboarding, and only published lessons count", async () => {
    const d = await createMember();
    expect(await unlockForUser(admin, d.id, NOW)).toBeNull();
    await onboard(d.id, "Z4");
    const r = await unlockForUser(admin, d.id, NOW);
    // Z4 is the current lesson: Z2, Z3 (before the start: seen) and Z4 (new) are published; Z5+ are ahead of the pointer
    expect(r!.unlocked).toBe(cardsIn("Z2") + cardsIn("Z3") + cardsIn("Z4"));
  });

  describe("setSeedPointer", () => {
    it("moves a learner who is earlier to Day 11 · Z9, never backwards", async () => {
      const e = await createMember();
      await onboard(e.id, "Z1");
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

import { indexOfCode } from "@data/curriculum";
import rawSeed from "@data/seed-cards.json";
import { describe, expect, it } from "vitest";
import { parseSeedDeck } from "./seed";
import { cardKey, newLessonCodes, planUnlock, startSeqOf, type TemplateRow } from "./unlock";

const NOW = new Date("2026-10-23T08:00:00Z");
let n = 0;
const tpl = (session_code: string, de: string, over: Partial<TemplateRow> = {}): TemplateRow => ({
  id: `t-${++n}`,
  session_code,
  kind: "word",
  tier: "core",
  position: n,
  en: `en ${de}`,
  article: null,
  de,
  plural: null,
  example: "Beispiel.",
  example_en: "Example.",
  tip: null,
  ...over,
});

describe("planUnlock", () => {
  it("never adds a card the learner owns: same kind and German, case and spaces ignored, any source", () => {
    const plan = planUnlock([tpl("Z5", "Tisch"), tpl("Z5", "Lampe"), tpl("Z5", "Wie geht's?", { kind: "say" })], [{ kind: "word", de: " tisch " }, { kind: "say", de: "Wie geht's?" }], {
      startSeq: indexOfCode("Z5"),
      today: NOW,
    });
    expect(plan.cards.map((c) => c.template.de)).toEqual(["Lampe"]);
    expect(plan.skipped).toBe(2);
  });

  it("a word and a sentence with the same German are different cards (kind is part of the key)", () => {
    expect(cardKey("word", "Hallo")).not.toBe(cardKey("say", "Hallo"));
    const plan = planUnlock([tpl("Z2", "Hallo", { kind: "say" })], [{ kind: "word", de: "Hallo" }], { startSeq: 0, today: NOW });
    expect(plan.cards).toHaveLength(1);
  });

  it("the same word in two lessons of one batch is added once, for the earlier lesson", () => {
    const plan = planUnlock([tpl("Z6", "Haus"), tpl("Z4", "Haus")], [], { startSeq: 0, today: NOW });
    expect(plan.cards).toHaveLength(1);
    expect(plan.cards[0].template.session_code).toBe("Z4");
    expect(plan.skipped).toBe(1);
  });

  it("lessons before the starting lesson count as already seen (spread over days); the starting lesson and later ones are new", () => {
    const templates = ["Z3", "Z4", "Z5", "Z6"].flatMap((code) => [tpl(code, `${code}-a`), tpl(code, `${code}-b`)]);
    const plan = planUnlock(templates, [], { startSeq: indexOfCode("Z5"), today: NOW });
    const byCode = (code: string) => plan.cards.filter((c) => c.template.session_code === code);
    expect(byCode("Z3").every((c) => c.seen && c.srs.reps === 1)).toBe(true);
    expect(byCode("Z4").every((c) => c.seen)).toBe(true);
    expect(byCode("Z5").every((c) => !c.seen && c.srs.reps === 0 && c.srs.lastReviewedAt === null)).toBe(true);
    expect(byCode("Z6").every((c) => !c.seen)).toBe(true);
    // the seen cards are not all due on the same day
    const dueDays = new Set(plan.cards.filter((c) => c.seen).map((c) => c.srs.dueAt.slice(0, 10)));
    expect(dueDays.size).toBeGreaterThan(1);
  });

  it("orders cards by lesson, then words before phrases, then position", () => {
    const plan = planUnlock([tpl("Z5", "Satz eins", { kind: "say", position: 16 }), tpl("Z4", "Wort", { position: 2 }), tpl("Z5", "Wort B", { position: 2 }), tpl("Z5", "Wort A", { position: 1 })], [], {
      startSeq: 0,
      today: NOW,
    });
    expect(plan.cards.map((c) => c.template.de)).toEqual(["Wort", "Wort A", "Wort B", "Satz eins"]);
  });

  it("ignores templates of lessons that are not in the curriculum", () => {
    expect(planUnlock([tpl("NOPE", "x")], [], { startSeq: 0, today: NOW }).cards).toEqual([]);
  });
});

describe("a learner who already owns Raghav's seed deck (Z2 to Z9)", () => {
  const seedOwned = parseSeedDeck(rawSeed).cards.map((c) => ({ kind: c.kind, de: c.de }));

  it("gets only the lesson words he does not own yet, never a second copy of a seed card", () => {
    // Templates for Z2..Z9: three words of each lesson are words from his seed deck, the rest are new.
    const seedByLesson = new Map<string, string[]>();
    for (const c of parseSeedDeck(rawSeed).cards) if (c.kind === "word" && c.sessionCode) seedByLesson.set(c.sessionCode, [...(seedByLesson.get(c.sessionCode) ?? []), c.de]);
    const templates: TemplateRow[] = [];
    let overlap = 0;
    for (const code of ["Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8", "Z9"]) {
      const own = (seedByLesson.get(code) ?? []).slice(0, 3);
      overlap += own.length;
      own.forEach((de) => templates.push(tpl(code, de.toUpperCase()))); // same word, different case
      for (let i = 0; i < 15; i++) templates.push(tpl(code, `${code}-neu-${i}`));
    }
    const plan = planUnlock(templates, seedOwned, { startSeq: indexOfCode("Z9"), today: NOW });
    expect(overlap).toBeGreaterThan(15);
    expect(plan.skipped).toBe(overlap);
    expect(plan.cards).toHaveLength(templates.length - overlap);

    // (his seed deck may repeat a German word with two meanings itself; what must hold is that nothing NEW repeats a card he has or another new card)
    const owned = new Set(seedOwned.map((c) => cardKey(c.kind, c.de)));
    const added = plan.cards.map((c) => cardKey(c.template.kind, c.template.de));
    expect(added.some((k) => owned.has(k))).toBe(false);
    expect(new Set(added).size).toBe(added.length);
    // Z2..Z8 lesson cards are already seen, Z9 ones are new
    expect(plan.cards.filter((c) => c.template.session_code === "Z9").every((c) => !c.seen)).toBe(true);
    expect(plan.cards.filter((c) => c.template.session_code === "Z5").every((c) => c.seen)).toBe(true);
  });
});

describe("startSeqOf", () => {
  it("is the picked start lesson, else the current lesson", () => {
    expect(startSeqOf({ start_code: "Z9", session_seq: indexOfCode("W1.2") })).toBe(indexOfCode("Z9"));
    expect(startSeqOf({ start_code: null, session_seq: 12 })).toBe(12);
    expect(startSeqOf({ start_code: "NOPE", session_seq: 12 })).toBe(12);
  });
});

describe("newLessonCodes", () => {
  const z = (code: string) => indexOfCode(code);
  it("keeps published lessons after the last unlocked one, up to the learner's current lesson", () => {
    const published = ["Z5", "Z6", "Z7", "Z8", "Z9"];
    expect(newLessonCodes(published, { targetSeq: z("Z8"), unlockedSeq: z("Z6") })).toEqual(["Z7", "Z8"]);
  });
  it("is empty when everything up to today is unlocked, and ignores codes that are not lessons", () => {
    expect(newLessonCodes(["Z5", "Z6"], { targetSeq: z("Z6"), unlockedSeq: z("Z6") })).toEqual([]);
    expect(newLessonCodes(["nonsense"], { targetSeq: z("Z6"), unlockedSeq: null })).toEqual([]);
  });
  it("with nothing unlocked yet, everything published up to today's lesson is new", () => {
    expect(newLessonCodes(["Z1", "Z2", "Z9"], { targetSeq: z("Z2"), unlockedSeq: null })).toEqual(["Z1", "Z2"]);
  });
});

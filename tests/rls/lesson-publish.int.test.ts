import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mergeLesson, publishPayload, itemIdsOf, type PublishPayload } from "@/lib/content/pipeline.ts";
import { lessonRow, validLesson } from "@/lib/content/test-fixtures.ts";
import { PARTS } from "@/lib/content/lesson-schema.ts";
import { admin, anon, createMember, resetState, type TestUser } from "./helpers";

// The 14-part lesson standard, enforced by the database: a lesson publishes only when every part exists and passed the review.
const CODE = "TXP1";
const row = lessonRow({ code: CODE, seq: 9300 });
const payload = (): PublishPayload => {
  const lesson = validLesson();
  const verdicts = itemIdsOf(CODE, lesson).map((id) => ({ id, status: "ok" as const, reason: "fine", fixed_json: null }));
  return publishPayload(mergeLesson(row, lesson, verdicts));
};
const publish = (p: PublishPayload, over: Partial<{ parts: unknown; status: unknown; code: string; cards: unknown; questions: unknown }> = {}) =>
  admin.rpc("publish_lesson", {
    p_code: over.code ?? p.code,
    p_parts: over.parts ?? p.parts,
    p_status: over.status ?? p.part_status,
    p_model: "claude-opus-5-5",
    p_cards: over.cards ?? p.cards,
    p_questions: over.questions ?? p.questions,
  });

async function wipe() {
  await admin.from("lesson_publications").delete().like("session_code", "TXP%");
  await admin.from("lesson_parts").delete().like("session_code", "TXP%");
  await admin.from("card_templates").delete().like("session_code", "TXP%");
  await admin.from("question_bank").delete().like("session_code", "TXP%");
}
const counts = async () => {
  const n = async (table: string) => (await admin.from(table).select("*", { count: "exact", head: true }).eq("session_code", CODE)).count;
  return { parts: await n("lesson_parts"), cards: await n("card_templates"), questions: await n("question_bank"), published: await n("lesson_publications") };
};

describe("publish_lesson", () => {
  let a: TestUser;
  beforeAll(async () => {
    await resetState();
    await admin.from("curriculum_sessions").delete().gte("seq", 9300);
    await admin.from("curriculum_sessions").insert({ seq: 9300, code: CODE, kind: "lesson", phase: "zero", grammar: "g", theme: "t", word_target: 18 });
    a = await createMember();
  });
  beforeEach(wipe);
  afterAll(async () => {
    await wipe();
    await admin.from("curriculum_sessions").delete().gte("seq", 9300);
    await resetState();
  });

  it("publishes a complete lesson in one go: 14 parts, 18 words + 5 phrases, 42 questions, then the publication", async () => {
    expect((await publish(payload())).error).toBeNull();
    expect(await counts()).toEqual({ parts: 14, cards: 23, questions: 42, published: 1 });
    const { data } = await admin.from("lesson_parts").select("part, review_status").eq("session_code", CODE);
    expect(data!.map((r) => r.part).sort()).toEqual([...PARTS].sort());
    expect(data!.every((r) => r.review_status === "ok")).toBe(true);
  });

  it("stores accepted answers with the question (a payload without them stores none)", async () => {
    const p = payload();
    const typing = p.questions.find((q) => q.part === "exercises" && q.type === "typing")!;
    typing.accepted_answers = ["Mein Name ist Jonas.", "Ich bin Jonas."];
    const old = p.questions.find((q) => q.part === "exercises" && q.type === "dictation")!;
    delete old.accepted_answers;
    expect((await publish(p)).error).toBeNull();
    const { data } = await admin.from("question_bank").select("type, prompt, accepted_answers").eq("session_code", CODE).eq("part", "exercises");
    expect(data!.find((q) => q.prompt === typing.prompt)!.accepted_answers).toEqual(["Mein Name ist Jonas.", "Ich bin Jonas."]);
    expect(data!.find((q) => q.type === "dictation" && q.prompt === old.prompt)!.accepted_answers).toEqual([]);
    expect(data!.filter((q) => q.type === "multiple_choice").every((q) => (q.accepted_answers as unknown[]).length === 0)).toBe(true);
    const tooMany = await admin.from("question_bank").update({ accepted_answers: Array.from({ length: 9 }, (_, i) => `x${i}`) }).eq("session_code", CODE).eq("prompt", typing.prompt);
    expect(tooMany.error?.code).toBe("23514");
  });

  it("a question is identified by its slot, not its prompt: dictation questions share one, and a corrected prompt replaces the old row", async () => {
    const p = payload();
    const exercises = p.questions.filter((q) => q.part === "exercises");
    for (const q of exercises.slice(0, 2)) Object.assign(q, { type: "dictation", skill: "dictation", prompt: "Listen and write the sentence.", distractors: [] });
    expect((await publish(p)).error).toBeNull();
    expect((await counts()).questions).toBe(42);

    const corrected = payload();
    const first = corrected.questions.find((q) => q.part === "exercises" && q.position === 1)!;
    const oldPrompt = first.prompt;
    first.prompt = "A corrected prompt?";
    expect((await publish(corrected)).error).toBeNull();
    expect((await counts()).questions).toBe(42);
    const { data } = await admin.from("question_bank").select("prompt").eq("session_code", CODE).eq("part", "exercises").eq("position", 1);
    expect(data).toEqual([{ prompt: "A corrected prompt?" }]);
    expect((await admin.from("question_bank").select("id").eq("session_code", CODE).eq("part", "exercises").eq("prompt", oldPrompt)).data).toHaveLength(0);
  });

  it("a card template is identified by its slot: a corrected word replaces the template, a removed slot is deleted", async () => {
    expect((await publish(payload())).error).toBeNull();
    const again = payload();
    const word = again.cards.find((c) => c.kind === "word" && c.position === 1)!;
    word.de = "Korrektur";
    word.en = "correction";
    again.cards = again.cards.filter((c) => !(c.kind === "word" && c.position === 18)); // 17 words are still allowed (15 to 20)
    expect((await publish(again)).error).toBeNull();
    const { data } = await admin.from("card_templates").select("de, kind, position").eq("session_code", CODE).order("position");
    expect(data!.filter((c) => c.kind === "word" && c.position === 1)).toEqual([{ de: "Korrektur", kind: "word", position: 1 }]);
    expect(data).toHaveLength(22); // 23 minus the removed word; the corrected word did not add a second row
  });

  it("needs 3 warm-up questions, except in the very first lesson, whose warm-up is a preview", async () => {
    const noWarmup = (p: PublishPayload) => p.questions.filter((q) => q.part !== "warmup");
    expect((await publish(payload(), { questions: noWarmup(payload()) })).error?.message).toMatch(/too few exercises or questions/);
    expect(await counts()).toEqual({ parts: 0, cards: 0, questions: 0, published: 0 });
    // Make TXP1 the first lesson for a moment (the real first lesson steps aside), then restore everything.
    const { data: first } = await admin.from("curriculum_sessions").select("code").eq("seq", 0).maybeSingle();
    if (first) await admin.from("curriculum_sessions").update({ seq: 9301 }).eq("code", first.code);
    try {
      await admin.from("curriculum_sessions").update({ seq: 0 }).eq("code", CODE);
      expect((await publish(payload(), { questions: noWarmup(payload()) })).error).toBeNull();
      expect((await counts()).questions).toBe(39);
    } finally {
      await admin.from("curriculum_sessions").update({ seq: 9300 }).eq("code", CODE);
      if (first) await admin.from("curriculum_sessions").update({ seq: 0 }).eq("code", first.code);
    }
  });

  it("refuses a lesson with a missing part, and writes nothing", async () => {
    for (const part of PARTS) {
      const p = payload();
      const parts = { ...p.parts } as Record<string, unknown>;
      delete parts[part];
      const { error } = await publish(p, { parts });
      expect(error?.message, part).toMatch(new RegExp(`missing part ${part}`));
      expect(await counts(), part).toEqual({ parts: 0, cards: 0, questions: 0, published: 0 });
    }
  });

  it("refuses a lesson with a part that has not passed the review (needs-human, or no status at all)", async () => {
    const p = payload();
    expect((await publish(p, { status: { ...p.part_status, reading: "needs-human" } })).error?.message).toMatch(/Part reading .* has not passed the review/);
    const without: Record<string, unknown> = { ...p.part_status };
    delete without.writing;
    expect((await publish(p, { status: without })).error?.message).toMatch(/Part writing/);
    expect(await counts()).toEqual({ parts: 0, cards: 0, questions: 0, published: 0 });
  });

  it("refuses an unknown lesson, a part that is not an object, and cards or questions of another lesson", async () => {
    const p = payload();
    expect((await publish(p, { code: "NOPE" })).error?.message).toMatch(/Unknown lesson/);
    expect((await publish(p, { parts: { ...p.parts, goal: "text" } })).error?.message).toMatch(/missing part goal/);
    expect((await publish(p, { cards: [...p.cards, { ...p.cards[0], session_code: "OTHER" }] })).error?.message).toMatch(/must all belong/);
    expect(await counts()).toEqual({ parts: 0, cards: 0, questions: 0, published: 0 });
  });

  it("the database also checks the pools: too many words, too few phrases or too few exercises are refused", async () => {
    const p = payload();
    const extra = Array.from({ length: 3 }, (_, i) => ({ ...p.cards[0], de: `Extra${i}`, position: 30 + i }));
    expect((await publish(p, { cards: [...p.cards, ...extra] })).error?.message).toMatch(/21 words/);
    expect((await publish(p, { cards: p.cards.filter((c) => c.kind === "word") })).error?.message).toMatch(/0 phrases/);
    expect((await publish(p, { questions: p.questions.filter((q) => q.part !== "exercises") })).error?.message).toMatch(/too few exercises/);
    expect(await counts()).toEqual({ parts: 0, cards: 0, questions: 0, published: 0 });
  });

  it("the publication itself cannot be inserted by hand for an incomplete lesson (trigger)", async () => {
    const { error } = await admin.from("lesson_publications").insert({ session_code: CODE });
    expect(error?.code).toBe("23514");
    expect(error?.message).toMatch(/0 of 14 parts/);
    await admin.from("lesson_parts").insert({ session_code: CODE, part: "goal", content: {}, review_status: "ok", reviewed_by_model: "x" });
    expect((await admin.from("lesson_publications").insert({ session_code: CODE })).error?.message).toMatch(/1 of 14 parts/);
  });

  it("a part cannot be stored as needs-human at all", async () => {
    const { error } = await admin.from("lesson_parts").insert({ session_code: CODE, part: "goal", content: {}, review_status: "needs-human", reviewed_by_model: "x" });
    expect(error?.code).toBe("23514");
    expect((await admin.from("lesson_parts").insert({ session_code: CODE, part: "lunch", content: {}, review_status: "ok", reviewed_by_model: "x" })).error?.code).toBe("23514");
    expect((await admin.from("lesson_parts").insert({ session_code: CODE, part: "goal", content: [], review_status: "ok", reviewed_by_model: "x" })).error?.code).toBe("23514");
  });

  it("publishing again after a correction updates the content in place and raises the version", async () => {
    expect((await publish(payload())).error).toBeNull();
    const fixed = payload();
    fixed.cards[0] = { ...fixed.cards[0], example: "Der Kaffee ist heiß." };
    (fixed.parts.goal as { can_do: string }).can_do = "I can order a drink (corrected).";
    expect((await publish(fixed)).error).toBeNull();
    expect(await counts()).toEqual({ parts: 14, cards: 23, questions: 42, published: 1 });
    const { data: goal } = await admin.from("lesson_parts").select("content, template_version").eq("session_code", CODE).eq("part", "goal").single();
    expect(goal!.content.can_do).toMatch(/corrected/);
    expect(goal!.template_version).toBe(2);
    const { data: card } = await admin.from("card_templates").select("example").eq("session_code", CODE).eq("de", "Kaffee").single();
    expect(card!.example).toBe("Der Kaffee ist heiß.");
  });

  it("members read a lesson's parts only once it is published", async () => {
    await admin.from("lesson_parts").insert({ session_code: CODE, part: "goal", content: { can_do: "hidden" }, review_status: "ok", reviewed_by_model: "x" });
    expect((await a.aal2.from("lesson_parts").select("part").eq("session_code", CODE)).data).toEqual([]);
    await wipe();
    expect((await publish(payload())).error).toBeNull();
    expect((await a.aal2.from("lesson_parts").select("part").eq("session_code", CODE)).data).toHaveLength(14);
    expect((await a.aal2.from("lesson_publications").select("session_code").eq("session_code", CODE)).data).toHaveLength(1);
  });

  it("members, aal1 sessions and anon can neither publish nor write, and aal1/anon read nothing", async () => {
    const p = payload();
    for (const client of [a.aal2, a.aal1, anon()]) {
      const { error } = await client.rpc("publish_lesson", { p_code: CODE, p_parts: p.parts, p_status: p.part_status, p_model: "x", p_cards: p.cards, p_questions: p.questions });
      expect(error?.code).toBe("42501");
    }
    for (const table of ["lesson_parts", "lesson_publications"]) {
      const row: Record<string, unknown> = table === "lesson_parts" ? { session_code: CODE, part: "goal", content: {}, review_status: "ok", reviewed_by_model: "x" } : { session_code: CODE };
      expect((await a.aal2.from(table).insert(row)).error?.code).toBe("42501");
      expect((await a.aal2.from(table).delete().eq("session_code", CODE)).error?.code).toBe("42501");
      expect((await anon().from(table).select("*")).error?.code).toBe("42501");
    }
    await publish(p);
    expect((await a.aal1.from("lesson_parts").select("*")).data).toEqual([]);
  });
});

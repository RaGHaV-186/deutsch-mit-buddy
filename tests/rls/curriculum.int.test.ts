import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createMember, resetState, type TestUser } from "./helpers";

// Shared content tables: every verified member can read them, nobody but the server can write them.
// Test rows use seq 9000+ and codes starting "TX" so they never collide with real content.
const session = (seq: number, over: Record<string, unknown> = {}) => ({
  seq,
  code: `TX${seq}`,
  kind: "lesson",
  phase: "A1",
  grammar: "Test grammar",
  theme: "Test theme",
  word_target: 15,
  ...over,
});
const template = (over: Record<string, unknown> = {}) => ({
  session_code: "TX9000",
  kind: "word",
  tier: "core",
  position: 1,
  en: "coffee",
  article: "der",
  de: "Kaffee",
  plural: "die Kaffees",
  example: "Ich trinke einen Kaffee.",
  example_en: "I drink a coffee.",
  ...over,
});
const question = (over: Record<string, unknown> = {}) => ({
  session_code: "TX9000",
  skill: "articles",
  type: "multiple_choice",
  prompt: "Which article goes with Kaffee?",
  answer: "der",
  distractors: ["die", "das"],
  explanation: "Kaffee is masculine.",
  ...over,
});

async function cleanup() {
  await admin.from("question_bank").delete().like("session_code", "TX%");
  await admin.from("card_templates").delete().like("session_code", "TX%");
  await admin.from("curriculum_sessions").delete().gte("seq", 9000);
}

describe("curriculum content tables", () => {
  let a: TestUser;
  beforeAll(async () => {
    await resetState();
    await cleanup();
    a = await createMember();
    expect((await admin.from("curriculum_sessions").insert([session(9000), session(9001, { kind: "saturday", code: "SAT", word_target: 0 })])).error).toBeNull();
    expect((await admin.from("card_templates").insert(template())).error).toBeNull();
    expect((await admin.from("question_bank").insert(question())).error).toBeNull();
  });
  afterAll(async () => {
    await cleanup();
    await resetState();
  });

  const tables = ["curriculum_sessions", "card_templates", "question_bank"] as const;

  for (const table of tables) {
    it(`${table}: a verified member can read it`, async () => {
      const { data, error } = await a.aal2.from(table).select("*");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it(`${table}: a member cannot insert, update or delete`, async () => {
      const row: Record<string, unknown> = table === "curriculum_sessions" ? session(9100) : table === "card_templates" ? template({ de: "Tee", en: "tea" }) : question({ prompt: "x?" });
      expect((await a.aal2.from(table).insert(row)).error?.code).toBe("42501");
      expect((await a.aal2.from(table).update({ created_at: new Date().toISOString() }).gte("created_at", "2000-01-01")).error?.code).toBe("42501");
      expect((await a.aal2.from(table).delete().gte("created_at", "2000-01-01")).error?.code).toBe("42501");
    });

    it(`${table}: aal1 sessions and anon get nothing`, async () => {
      expect((await a.aal1.from(table).select("*")).data).toEqual([]);
      expect((await anon().from(table).select("*")).error?.code).toBe("42501");
    });
  }

  describe("constraints", () => {
    it("curriculum_sessions: valid kind and phase, lesson codes are unique, other codes may repeat", async () => {
      expect((await admin.from("curriculum_sessions").insert(session(9200, { kind: "party" }))).error?.code).toBe("23514");
      expect((await admin.from("curriculum_sessions").insert(session(9200, { phase: "C2" }))).error?.code).toBe("23514");
      expect((await admin.from("curriculum_sessions").insert(session(9200, { word_target: 99 }))).error?.code).toBe("23514");
      expect((await admin.from("curriculum_sessions").insert(session(9201, { code: "TX9000" }))).error?.code).toBe("23505"); // a second lesson with the same code
      expect((await admin.from("curriculum_sessions").insert(session(9202, { kind: "saturday", code: "SAT", word_target: 0 }))).error).toBeNull(); // SAT repeats
      expect((await admin.from("curriculum_sessions").insert(session(9203, { phase: "B2", code: "TXB2" }))).error).toBeNull(); // B2 is accepted already
      expect((await admin.from("curriculum_sessions").insert(session(9000))).error?.code).toBe("23505"); // seq is the key
    });

    it("card_templates: article, kind, tier and length checks; the same card is stored once per lesson", async () => {
      for (const bad of [{ article: "le" }, { kind: "poem" }, { tier: "extra" }, { en: "" }, { de: "x".repeat(301) }, { audio_url: "x".repeat(501) }]) {
        const { error } = await admin.from("card_templates").insert(template({ de: "Bad", ...bad }));
        expect(error?.code, JSON.stringify(bad)).toBe("23514");
      }
      expect((await admin.from("card_templates").insert(template())).error?.code).toBe("23505");
      expect((await admin.from("card_templates").insert(template({ session_code: "TX9001" }))).error).toBeNull(); // same word in another lesson is fine
    });

    it("question_bank: skill and type checks, at most 6 distractors that must be an array", async () => {
      for (const bad of [{ skill: "magic" }, { type: "essay" }, { part: "lunch" }, { distractors: "die" }, { distractors: ["a", "b", "c", "d", "e", "f", "g"] }, { prompt: "" }]) {
        const { error } = await admin.from("question_bank").insert(question({ prompt: "Bad one?", ...bad }));
        expect(error?.code, JSON.stringify(bad)).toBe("23514");
      }
      expect((await admin.from("question_bank").insert(question())).error?.code).toBe("23505");
      expect((await admin.from("question_bank").insert(question({ type: "typing", prompt: "Type it", distractors: [] }))).error).toBeNull();
      expect((await admin.from("question_bank").insert(question({ type: "dictation", skill: "dictation", prompt: "Listen and write.", distractors: [] }))).error).toBeNull(); // new in the lesson standard
      expect((await admin.from("question_bank").insert(question({ part: "exam" }))).error).toBeNull(); // the same prompt may appear in another part
    });
  });

  describe("deck unlocking support", () => {
    it("a learner's deck can hold a lesson card only once, but the same text from another source is fine", async () => {
      const card = { user_id: a.id, kind: "word", en: "tea", de: "Tee", article: "der", source: "lesson", session_code: "TX9000" };
      expect((await admin.from("cards").insert(card)).error).toBeNull();
      expect((await admin.from("cards").insert(card)).error?.code).toBe("23505");
      expect((await admin.from("cards").insert({ ...card, source: "manual" })).error).toBeNull();
    });

    it("profiles.deck_unlocked_seq is written by the server only", async () => {
      expect((await a.aal2.from("profiles").update({ deck_unlocked_seq: 5 }).eq("user_id", a.id)).error?.code).toBe("42501");
      expect((await admin.from("profiles").update({ deck_unlocked_seq: 5 }).eq("user_id", a.id)).error).toBeNull();
      expect((await admin.from("profiles").update({ deck_unlocked_seq: -1 }).eq("user_id", a.id)).error?.code).toBe("23514");
      const { data } = await a.aal2.from("profiles").select("deck_unlocked_seq").single();
      expect(data!.deck_unlocked_seq).toBe(5);
    });
  });
});

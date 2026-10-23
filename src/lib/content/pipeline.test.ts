import { describe, expect, it, vi } from "vitest";
import { enumerateItems } from "./lesson-items.ts";
import { PARTS, type ReviewVerdict } from "./lesson-schema.ts";
import {
  applyManualFixes,
  assertApproved,
  buildPassARequests,
  buildPassBRequests,
  buildPassCRequests,
  buildPassDRequests,
  buildReviewRequests,
  combineLesson,
  costReport,
  currentVerdicts,
  fixHash,
  customId,
  estimateStage,
  fingerprint,
  itemIdsOf,
  manualFixIds,
  mergeLesson,
  parsePassA,
  parsePassB,
  parsePassC,
  parsePassD,
  parseReview,
  publishPayload,
  runBatch,
  runDirect,
  summarize,
  type BatchClient,
  type BatchRequest,
  type BatchResultLine,
} from "./pipeline.ts";
import { GENERATION_MODEL, PASS_A_MAX_TOKENS, REVIEW_MODEL } from "./prompts.ts";
import { lessonRow, validLesson, validPassA, validPassB, validPassC, validPassD } from "./test-fixtures.ts";

const usage = { input_tokens: 5000, output_tokens: 9000 };
const succeeded = (id: string, body: unknown, over: { stop_reason?: string | null } = {}): BatchResultLine => ({
  custom_id: id,
  result: { type: "succeeded", message: { content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }], stop_reason: over.stop_reason ?? "end_turn", usage } },
});
const verdict = (id: string, status: ReviewVerdict["status"] = "ok", over: Partial<ReviewVerdict> = {}): ReviewVerdict => ({ id, status, reason: "fine", fixed_json: null, ...over });
const row = lessonRow({ code: "Z1", seq: 1 }); // not the first lesson of the course: the first one has a preview instead of warm-up questions
const allOk = (lesson = validLesson()) => itemIdsOf("Z1", lesson).map((id) => verdict(id));
const withVerdict = (id: string, v: Partial<ReviewVerdict>, lesson = validLesson()) => allOk(lesson).map((x) => (x.id === id ? { ...x, ...v } : x));

describe("requests", () => {
  const lessons = [lessonRow(), lessonRow({ seq: 40, code: "W3.2", phase: "A1", theme: "Freizeit" })];

  it("custom ids avoid characters the Batch API rejects", () => {
    expect(customId("generate-a", "W3.2")).toBe("generate-a-W3_2");
    expect(customId("generate-b", "W3.2")).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    expect(customId("review", "W13.5")).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it("pass A: one Sonnet request per lesson with the lesson's level, structured output and no sampling parameters", () => {
    const reqs = buildPassARequests(lessons);
    expect(reqs.map((r) => r.custom_id)).toEqual(["generate-a-Z9", "generate-a-W3_2"]);
    for (const r of reqs) {
      expect(r.params.model).toBe(GENERATION_MODEL);
      expect(r.params.model).toBe("claude-sonnet-5-5");
      expect(r.params.max_tokens).toBe(PASS_A_MAX_TOKENS);
      expect(r.params.output_config.format.type).toBe("json_schema");
      expect(Object.keys(r.params).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    }
    expect(reqs[1].params.messages[0].content).toContain("CEFR level A1");
    expect(reqs[0].params.messages[0].content).toContain("English only");
    expect(reqs[0].params.system).toContain("PASS A");
  });

  it("pass B (reading, listening, writing, speaking) only for lessons that have pass A, and it carries pass A's grammar and words", () => {
    const reqs = buildPassBRequests(lessons, new Map([["Z9", validPassA()]]));
    expect(reqs).toHaveLength(1);
    const content = reqs[0].params.messages[0].content;
    expect(content).toContain("Verbs with ich");
    expect(content).toContain("der Kaffee");
    expect(content).toContain("Reading passage length: 25 to 70 words");
    expect(reqs[0].params.system).toContain("PASS B");
    expect(reqs[0].custom_id).toBe("generate-b-Z9");
  });

  it("pass C (the day exam) sees pass A and has its own limits", () => {
    const reqs = buildPassCRequests(lessons, new Map([["Z9", validPassA()]]));
    expect(reqs).toHaveLength(1);
    expect(reqs[0].custom_id).toBe("generate-c-Z9");
    expect(reqs[0].params.system).toContain("PASS C");
    expect(reqs[0].params.messages[0].content).toContain("der Kaffee");
    expect(reqs[0].params.messages[0].content).toContain("Write the day exam of this lesson");
    expect(buildPassCRequests(lessons, new Map())).toEqual([]);
  });

  it("pass D (warm-up, culture, mission, close day) sees pass A and the earlier sessions", () => {
    const plan = [lessonRow({ code: "Z8", seq: 7, grammar: "Telling time" }), lessons[0]];
    const reqs = buildPassDRequests([plan[1]], new Map([["Z9", validPassA()], ["Z8", { ...validPassA(), vocabulary: { ...validPassA().vocabulary, words: [{ ...validPassA().vocabulary.words[0], de: "Uhr", article: "die" as const }] } }]]), plan);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].custom_id).toBe("generate-d-Z9");
    expect(reqs[0].params.system).toContain("PASS D");
    const content = reqs[0].params.messages[0].content;
    expect(content).toContain("der Kaffee");
    expect(content).toContain("- Z8: Telling time");
    expect(content).toContain("die Uhr");
    expect(content).toContain("Write the warm-up, culture note, mission and close day");
    expect(buildPassDRequests(lessons, new Map(), lessons)).toEqual([]);
  });

  it("every generation request tells the model how to write 'nothing' (empty string, none for an article)", () => {
    for (const r of [...buildPassARequests(lessons), ...buildPassBRequests(lessons, new Map([["Z9", validPassA()]])), ...buildPassCRequests(lessons, new Map([["Z9", validPassA()]])), ...buildPassDRequests(lessons, new Map([["Z9", validPassA()]]), lessons)]) {
      expect(r.params.system).toContain("empty string");
      expect(JSON.stringify(r.params.output_config.format.schema)).not.toContain('"null"');
    }
  });

  it("review: Opus, one request per complete lesson, listing every item with its id", () => {
    const reqs = buildReviewRequests(lessons, new Map([["Z9", validLesson()]]), lessons);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].params.model).toBe(REVIEW_MODEL);
    expect(reqs[0].params.model).toBe("claude-opus-5-5");
    expect(reqs[0].params.messages[0].content).toContain("Items to check (93)");
    expect(reqs[0].params.messages[0].content).toContain("Z9#exam.speaking");
  });
});

describe("cost estimate and approval", () => {
  const reqs = buildPassARequests([lessonRow(), lessonRow({ code: "Z10", seq: 9 })]);

  it("estimates requests, tokens and euros before anything is paid for", () => {
    const e = estimateStage("generate-a", reqs);
    expect(e).toMatchObject({ stage: "generate-a", requests: 2, model: "claude-sonnet-5-5" });
    expect(e.inputTokens).toBeGreaterThan(5000);
    expect(e.ceilingEur).toBeGreaterThan(e.expectedEur);
    expect(e.id).toBe(fingerprint(reqs));
  });

  it("an approval is bound to the exact requests", () => {
    const e = estimateStage("generate-a", reqs);
    expect(() => assertApproved(reqs, undefined, e)).toThrow(/approve/);
    expect(() => assertApproved(reqs, "deadbeef", e)).toThrow(/not for these requests/);
    expect(() => assertApproved(reqs, e.id, e)).not.toThrow();
    const changed = buildPassARequests([lessonRow({ grammar: "Something else" }), lessonRow({ code: "Z10", seq: 9 })]);
    expect(() => assertApproved(changed, e.id, e)).toThrow(/not for these requests/);
  });

  it("a direct run costs twice the batch price and needs its own approval", () => {
    const batch = estimateStage("generate-a", reqs);
    const direct = estimateStage("generate-a", reqs, { mode: "direct" });
    expect(direct.expectedUsd).toBeCloseTo(batch.expectedUsd * 2);
    expect(direct.ceilingUsd).toBeCloseTo(batch.ceilingUsd * 2);
    expect(direct.id).toBe(`${batch.id}-direct`);
    // approving the cheap batch is not approving the direct run, and the other way round
    expect(() => assertApproved(reqs, batch.id, direct)).toThrow(/not for these requests/);
    expect(() => assertApproved(reqs, direct.id, batch)).toThrow(/not for these requests/);
    expect(() => assertApproved(reqs, direct.id, direct)).not.toThrow();
  });

  it("hard stop at €10, even with an approval", () => {
    const many = buildPassARequests(Array.from({ length: 200 }, (_, i) => lessonRow({ code: `Z${i}`, seq: i })));
    const e = estimateStage("generate-a", many);
    expect(e.ceilingEur).toBeGreaterThan(10);
    expect(() => assertApproved(many, e.id, e)).toThrow(/Hard stop/);
  });

  it("the tranche plan fits: 30 lessons per pass stays under €10 in the worst case for all three passes", () => {
    const lessons = Array.from({ length: 30 }, (_, i) => lessonRow({ code: `Z${i}`, seq: i }));
    const a = estimateStage("generate-a", buildPassARequests(lessons));
    const b = estimateStage("generate-b", buildPassBRequests(lessons, new Map(lessons.map((l) => [l.code, validPassA()]))));
    const c = estimateStage("generate-c", buildPassCRequests(lessons, new Map(lessons.map((l) => [l.code, validPassA()]))));
    const r = estimateStage("review", buildReviewRequests(lessons, new Map(lessons.map((l) => [l.code, validLesson()])), lessons));
    for (const e of [a, b, c, r]) expect(e.ceilingEur, e.stage).toBeLessThan(10);
  });

  it("the Opus pass is the one that limits a tranche: 45 lessons fit under €10, 60 do not", () => {
    const review = (n: number) => estimateStage("review", buildReviewRequests(Array.from({ length: n }, (_, i) => lessonRow({ code: `Z${i}`, seq: i })), new Map(Array.from({ length: n }, (_, i) => [`Z${i}`, validLesson()] as const)), []));
    expect(review(45).ceilingEur).toBeLessThan(10);
    expect(review(60).ceilingEur).toBeGreaterThan(10);
  });
});

describe("runDirect", () => {
  const message = (text: string) => ({ content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } });
  const clientOf = (calls: string[], fail: string[] = []) => ({
    messages: {
      stream: (params: { messages: { content: string }[] }) => ({
        finalMessage: async () => {
          calls.push(params.messages[0].content);
          if (fail.includes(params.messages[0].content)) throw new Error("overloaded");
          return message(`answer to ${params.messages[0].content}`);
        },
      }),
    },
  });
  const req = (id: string): BatchRequest => ({ custom_id: id, params: { model: "m", max_tokens: 10, system: "s", messages: [{ role: "user", content: id }], output_config: { effort: "medium", format: { type: "json_schema", schema: {} } } } });

  it("asks once per request, stores every answer at once, and reuses stored answers instead of paying again", async () => {
    const calls: string[] = [];
    const stored: string[] = [];
    const first = await runDirect(clientOf(calls) as never, [req("a"), req("b"), req("c")], { store: (l) => stored.push(l.custom_id) });
    expect(first.map((l) => l.custom_id)).toEqual(["a", "b", "c"]);
    expect(stored.sort()).toEqual(["a", "b", "c"]);
    expect(calls.sort()).toEqual(["a", "b", "c"]);

    const again: string[] = [];
    const done = new Map(first.map((l) => [l.custom_id, l]));
    const second = await runDirect(clientOf(again) as never, [req("a"), req("b"), req("c"), req("d")], { done });
    expect(again).toEqual(["d"]); // only the new request is asked (and paid)
    expect(second).toHaveLength(4);
  });

  it("a failed request becomes an errored line that is not stored (so a rerun asks again), and the others still finish", async () => {
    const stored: string[] = [];
    const lines = await runDirect(clientOf([], ["b"]) as never, [req("a"), req("b")], { store: (l) => stored.push(l.custom_id) });
    expect(lines.find((l) => l.custom_id === "b")!.result.type).toBe("errored");
    expect(lines.find((l) => l.custom_id === "a")!.result.type).toBe("succeeded");
    expect(stored).toEqual(["a"]);
  });
});

describe("runBatch", () => {
  function fakeClient(statuses: ("in_progress" | "ended")[], lines: BatchResultLine[]) {
    const create = vi.fn(async () => ({ id: "batch_1" }));
    const retrieve = vi.fn(async () => ({ processing_status: statuses.shift() ?? ("ended" as const) }));
    const results = vi.fn(async () =>
      (async function* () {
        yield* lines;
      })(),
    );
    return { client: { messages: { batches: { create, retrieve, results } } } as BatchClient, create, retrieve };
  }
  const reqs = buildPassARequests([lessonRow()]);

  it("submits once, records the batch id first, polls until it has ended, then reads every result", async () => {
    const { client, create, retrieve } = fakeClient(["in_progress", "in_progress", "ended"], [succeeded("generate-a-Z9", validPassA())]);
    const onSubmitted = vi.fn();
    const sleep = vi.fn(async () => {});
    const out = await runBatch(client, reqs, { onSubmitted, sleep });
    expect(create).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith("batch_1");
    expect(retrieve).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(out.lines).toHaveLength(1);
  });

  it("resuming never submits (and so never pays for) the batch again", async () => {
    const { client, create } = fakeClient(["ended"], []);
    const onSubmitted = vi.fn();
    const out = await runBatch(client, reqs, { batchId: "batch_old", onSubmitted });
    expect(create).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(out.batchId).toBe("batch_old");
  });

  it("submit-only saves the batch id and returns without waiting; a later call collects it once it has ended", async () => {
    const { client, create, retrieve } = fakeClient(["in_progress", "in_progress", "ended"], [succeeded("generate-a-Z9", validPassA())]);
    const onSubmitted = vi.fn();
    const sleep = vi.fn(async () => {});
    const first = await runBatch(client, reqs, { onSubmitted, sleep, submitOnly: true });
    expect(first).toMatchObject({ batchId: "batch_1", pending: true, lines: [] });
    expect(onSubmitted).toHaveBeenCalledWith("batch_1");
    expect(sleep).not.toHaveBeenCalled();
    const again = await runBatch(client, reqs, { batchId: "batch_1", onSubmitted, sleep, submitOnly: true });
    expect(again.pending).toBe(true); // still running: no waiting, no second submit
    const done = await runBatch(client, reqs, { batchId: "batch_1", onSubmitted, sleep, submitOnly: true });
    expect(done).toMatchObject({ pending: false });
    expect(done.lines).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledTimes(3);
  });
});

describe("reading generation results", () => {
  const lessons = [lessonRow(), lessonRow({ code: "W3.2", seq: 40 })];

  it("the four passes are read by lesson code and combined into one valid lesson with all 14 parts", () => {
    const a = parsePassA(lessons, [succeeded("generate-a-Z9", validPassA()), succeeded("generate-a-W3_2", validPassA())]);
    const b = parsePassB([lessons[0]], [succeeded("generate-b-Z9", validPassB())]);
    const c = parsePassC([lessons[0]], [succeeded("generate-c-Z9", validPassC())]);
    const d = parsePassD([lessons[0]], [succeeded("generate-d-Z9", validPassD())]);
    expect([...a.results.keys()]).toEqual(["Z9", "W3.2"]);
    const lesson = combineLesson(a.results.get("Z9")!, b.results.get("Z9")!, c.results.get("Z9")!, d.results.get("Z9")!);
    expect(Object.keys(lesson)).toEqual([...PARTS]);
  });

  it("one pass's answer is not accepted as another's", () => {
    expect(parsePassB([lessons[0]], [succeeded("generate-b-Z9", validPassA())]).failures[0].reason).toMatch(/did not match/);
    expect(parsePassC([lessons[0]], [succeeded("generate-c-Z9", validPassB())]).failures[0].reason).toMatch(/did not match/);
  });

  it("the model's empty strings (nothing) are turned back into nulls before the lesson is checked", () => {
    const plain = JSON.parse(JSON.stringify(validPassA()).replaceAll("null", '""'));
    const out = parsePassA([lessons[0]], [succeeded("generate-a-Z9", plain)]);
    expect(out.failures).toEqual([]);
    expect(out.results.get("Z9")!.vocabulary.words[0].tip).toBeNull();
    const dialogue = JSON.parse(JSON.stringify(validPassB()));
    dialogue.listening.passage.script[0].en = "";
    expect(parsePassB([lessons[0]], [succeeded("generate-b-Z9", dialogue)]).results.get("Z9")!.listening.passage.script[0].en).toBeNull();
  });

  it.each([
    ["invalid JSON", succeeded("generate-a-Z9", "not json"), /not valid JSON/],
    ["the wrong shape", succeeded("generate-a-Z9", { goal: "nope" }), /did not match/],
    ["a cut-off answer", succeeded("generate-a-Z9", validPassA(), { stop_reason: "max_tokens" }), /cut off/],
    ["a refusal", succeeded("generate-a-Z9", validPassA(), { stop_reason: "refusal" }), /declined/],
    ["an errored request", { custom_id: "generate-a-Z9", result: { type: "errored", error: { type: "overloaded_error" } } } as BatchResultLine, /request failed/],
    ["an expired request", { custom_id: "generate-a-Z9", result: { type: "expired" } } as BatchResultLine, /expired/],
  ])("%s is a failure for that lesson only", (_n, line, reason) => {
    const out = parsePassA([lessons[0]], [line]);
    expect(out.results.size).toBe(0);
    expect(out.failures).toEqual([{ code: "Z9", reason: expect.stringMatching(reason) }]);
  });

  it("a lesson with no result at all is a failure; usage is still counted for the ones that came back", () => {
    const out = parsePassA(lessons, [succeeded("generate-a-Z9", validPassA())]);
    expect(out.failures).toEqual([{ code: "W3.2", reason: "no result came back" }]);
    expect(out.usages).toHaveLength(1);
  });
});

describe("parseReview", () => {
  const lesson = validLesson();
  const contents = new Map([["Z1", lesson]]);
  const ids = itemIdsOf("Z1", lesson);

  it("one verdict per item, in lesson order, whatever order the reviewer used", () => {
    const out = parseReview([row], contents, [succeeded("review-Z1", { verdicts: [...allOk(lesson)].reverse() })]);
    expect(out.results.get("Z1")!.map((v) => v.id)).toEqual(ids);
    expect(ids).toHaveLength(93);
  });

  it("an item the reviewer skipped is not an ok: it waits for a human", () => {
    const out = parseReview([row], contents, [succeeded("review-Z1", { verdicts: allOk(lesson).slice(1) })]);
    expect(out.results.get("Z1")![0]).toMatchObject({ id: ids[0], status: "needs-human" });
  });

  it("ignores ids that were never asked about and takes the first of a repeated id", () => {
    const out = parseReview([row], contents, [succeeded("review-Z1", { verdicts: [verdict("Z1#nope"), verdict(ids[0], "needs-human", { reason: "first" }), ...allOk(lesson)] })]);
    expect(out.results.get("Z1")).toHaveLength(93);
    expect(out.results.get("Z1")![0]).toMatchObject({ status: "needs-human", reason: "first" });
  });

  it("a failed review leaves the lesson without verdicts", () => {
    const out = parseReview([row], contents, [succeeded("review-Z1", "garbage")]);
    expect(out.results.size).toBe(0);
    expect(out.failures[0].code).toBe("Z1");
  });
});

describe("mergeLesson: a lesson publishes only when every item is settled", () => {
  const lesson = validLesson();

  it("everything ok: publishable, every part ok", () => {
    const review = mergeLesson(row, lesson, allOk());
    expect(review.publishable).toBe(true);
    expect(review.lessonIssues).toEqual([]);
    expect(review.items).toHaveLength(93);
    expect(Object.values(review.partStatus).every((s) => s === "ok")).toBe(true);
    expect(Object.keys(review.partStatus)).toEqual([...PARTS]);
  });

  it("one needs-human item blocks the lesson (and only its part), with the reason kept", () => {
    const review = mergeLesson(row, lesson, withVerdict("Z1#reading.q2", { status: "needs-human", reason: "Two answers are possible" }));
    expect(review.publishable).toBe(false);
    expect(review.partStatus.reading).toBe("needs-human");
    expect(review.partStatus.listening).toBe("ok");
    expect(review.items.find((i) => i.id === "Z1#reading.q2")).toMatchObject({ status: "needs-human", final: null, reason: "Two answers are possible" });
    expect(() => publishPayload(review)).toThrow(/not publishable/);
  });

  describe("a correction may change an item's TYPE: an open typing question becomes multiple choice", () => {
    const openQuestion = { skill: "reading" as const, type: "typing" as const, prompt: "Was machen Anna und Jonas? Answer in one short sentence.", answer: "Sie essen und trinken.", distractors: [], accepted_answers: ["Anna und Jonas essen und trinken."], explanation: "Anna und Jonas sind im Café." };
    const choice = { skill: "reading" as const, type: "multiple_choice" as const, prompt: "Was machen Anna und Jonas? Choose the correct answer.", answer: "Sie essen und trinken im Café.", distractors: ["Sie arbeiten im Büro.", "Sie schlafen zu Hause.", "Sie kaufen im Supermarkt ein."], accepted_answers: [], explanation: "Anna und Jonas sind im Café." };
    const open = () => {
      const l = validLesson();
      l.reading.questions[4] = openQuestion;
      return l;
    };

    it("the merge step accepts it: the type changes, the id stays, the part is fixed, and the lesson publishes with the new question", () => {
      const l = open();
      const review = mergeLesson(row, l, withVerdict("Z1#reading.q5", { status: "fixed", reason: "too open for typing", fixed_json: JSON.stringify(choice) }, l));
      const item = review.items.find((i) => i.id === "Z1#reading.q5")!;
      expect(item).toMatchObject({ status: "fixed", original: { type: "typing" }, final: { type: "multiple_choice", accepted_answers: [] } });
      expect(review.partStatus.reading).toBe("fixed");
      expect(review.publishable).toBe(true);
      expect(review.final.reading.questions[4]).toMatchObject({ type: "multiple_choice", answer: "Sie essen und trinken im Café." });
      expect(publishPayload(review).questions.find((q) => q.part === "reading" && q.position === 5)).toMatchObject({ type: "multiple_choice", accepted_answers: [], distractors: choice.distractors });
    });

    it("it works for the day exam's reading questions too", () => {
      const l = validLesson();
      l.exam.reading.questions[0] = { ...openQuestion, prompt: "Was macht Lena? Answer in one short sentence." };
      const review = mergeLesson(row, l, withVerdict("Z1#exam.reading.q1", { status: "fixed", reason: "too open", fixed_json: JSON.stringify({ ...choice, prompt: "Was macht Lena? Choose the correct answer." }) }, l));
      expect(review.items.find((i) => i.id === "Z1#exam.reading.q1")).toMatchObject({ status: "fixed", final: { type: "multiple_choice" } });
      expect(review.publishable).toBe(true);
    });

    it("a manual correction can do the same (how W1.5 question 5 was changed)", () => {
      const fixed = applyManualFixes("Z1", open(), { "Z1#reading.q5": { reason: "too open", value: choice } });
      expect(fixed.reading.questions[4].type).toBe("multiple_choice");
    });

    it("but a badly formed multiple choice is still refused by the automatic checks and waits for a human (accepted answers left in, too few wrong options)", () => {
      const l = open();
      const withAccepted = mergeLesson(row, l, withVerdict("Z1#reading.q5", { status: "fixed", reason: "x", fixed_json: JSON.stringify({ ...choice, accepted_answers: ["Anna und Jonas essen."] }) }, l));
      expect(withAccepted.items.find((i) => i.id === "Z1#reading.q5")).toMatchObject({ status: "needs-human" });
      expect(withAccepted.publishable).toBe(false);
      const oneWrong = mergeLesson(row, l, withVerdict("Z1#reading.q5", { status: "fixed", reason: "x", fixed_json: JSON.stringify({ ...choice, distractors: ["Sie arbeiten."] }) }, l));
      expect(oneWrong.items.find((i) => i.id === "Z1#reading.q5")).toMatchObject({ status: "needs-human" });
      const sameAsAnswer = mergeLesson(row, l, withVerdict("Z1#reading.q5", { status: "fixed", reason: "x", fixed_json: JSON.stringify({ ...choice, distractors: ["Sie essen und trinken im Café.", "Sie schlafen.", "Sie arbeiten."] }) }, l));
      expect(sameAsAnswer.items.find((i) => i.id === "Z1#reading.q5")).toMatchObject({ status: "needs-human" });
    });
  });

  it("a correction is applied to the lesson, keeps the original for the review file, and marks the part fixed", () => {
    const fixed = { ...lesson.vocabulary.words[0], plural: "die Kaffees (selten)" };
    const review = mergeLesson(row, lesson, withVerdict("Z1#vocabulary.w01", { status: "fixed", reason: "plural note", fixed_json: JSON.stringify(fixed) }));
    expect(review.publishable).toBe(true);
    const item = review.items.find((i) => i.id === "Z1#vocabulary.w01")!;
    expect(item.status).toBe("fixed");
    expect((item.original as { plural: string }).plural).toBe("die Kaffees");
    expect(review.final.vocabulary.words[0].plural).toBe("die Kaffees (selten)");
    expect(lesson.vocabulary.words[0].plural).toBe("die Kaffees");
    expect(review.partStatus.vocabulary).toBe("fixed");
  });

  it("a fix with no replacement, an invalid replacement, or one that still fails a check waits for a human", () => {
    const none = mergeLesson(row, lesson, withVerdict("Z1#goal", { status: "fixed", reason: "changed it" }));
    expect(none.items[0]).toMatchObject({ status: "needs-human", final: null });
    const invalid = mergeLesson(row, lesson, withVerdict("Z1#goal", { status: "fixed", reason: "x", fixed_json: '{"can_do": 5}' }));
    expect(invalid.items[0].status).toBe("needs-human");
    const stillBroken = mergeLesson(row, lesson, withVerdict("Z1#vocabulary.w01", { status: "fixed", reason: "x", fixed_json: JSON.stringify({ ...lesson.vocabulary.words[0], de: "der Kaffee" }) }));
    const item = stillBroken.items.find((i) => i.id === "Z1#vocabulary.w01")!;
    expect(item.status).toBe("needs-human");
    expect(item.reason).toMatch(/still fails an automatic check/);
    expect(stillBroken.publishable).toBe(false);
  });

  it("the reviewer's ok is not enough when a mechanical check fails", () => {
    const broken = validLesson();
    broken.exercises.items[0] = { ...broken.exercises.items[0], prompt: "Ich trinke Kaffee." }; // gap fill without a gap
    const review = mergeLesson(row, broken, allOk(broken));
    const item = review.items.find((i) => i.id === "Z1#exercises.01")!;
    expect(item.status).toBe("needs-human");
    expect(item.reason).toMatch(/reviewer said ok, but an automatic check failed/);
    expect(review.publishable).toBe(false);
  });

  it("a lesson of the wrong shape cannot publish even if every item is ok", () => {
    const short = validLesson();
    short.exercises.items.pop();
    const review = mergeLesson(row, short, allOk(short));
    expect(review.items.every((i) => i.status === "ok")).toBe(true);
    expect(review.lessonIssues.join(" ")).toMatch(/exercise|19/);
    expect(review.publishable).toBe(false);
  });

  it("an item with no verdict waits for a human", () => {
    const review = mergeLesson(row, lesson, allOk().slice(1));
    expect(review.items[0]).toMatchObject({ id: "Z1#goal", status: "needs-human" });
  });

  it("summarises counts and which lessons can publish", () => {
    const good = mergeLesson(row, lesson, allOk());
    const blocked = mergeLesson(lessonRow({ code: "Z2", seq: 1 }), lesson, withVerdict("Z1#goal", { status: "needs-human" }).map((v) => ({ ...v, id: v.id.replace("Z1", "Z2") })));
    expect(summarize([good, blocked])).toEqual({ lessons: 2, items: 186, ok: 185, fixed: 0, needsHuman: 1, publishable: ["Z1"], blocked: ["Z2"] });
  });
});

describe("publishPayload", () => {
  const review = mergeLesson(row, validLesson(), allOk());
  const payload = publishPayload(review);

  it("carries all 14 parts, each with its review status", () => {
    expect(Object.keys(payload.parts)).toEqual([...PARTS]);
    expect(Object.values(payload.part_status).every((s) => s === "ok")).toBe(true);
    expect(payload.code).toBe("Z1");
  });

  it("derives the flashcards (18 words as word cards, 5 phrases as speaking cards) and the question pools", () => {
    expect(payload.cards.filter((c) => c.kind === "word")).toHaveLength(18);
    expect(payload.cards.filter((c) => c.kind === "say")).toHaveLength(5);
    expect(payload.cards[0]).toMatchObject({ session_code: "Z1", kind: "word", tier: "core", position: 1, de: "Kaffee", article: "der" });
    expect(payload.cards.at(-1)).toMatchObject({ kind: "say", article: null, plural: null, position: 23 });
    const parts = (p: string) => payload.questions.filter((q) => q.part === p).length;
    expect({ warmup: parts("warmup"), exercises: parts("exercises"), reading: parts("reading"), listening: parts("listening"), exam: parts("exam") }).toEqual({ warmup: 3, exercises: 19, reading: 5, listening: 5, exam: 10 });
  });

  it("uses the corrected content, not the original", () => {
    const fixed = { ...validLesson().vocabulary.words[0], en: "coffee (drink)" };
    const r = mergeLesson(row, validLesson(), withVerdict("Z1#vocabulary.w01", { status: "fixed", reason: "x", fixed_json: JSON.stringify(fixed) }));
    expect(publishPayload(r).cards[0]).toMatchObject({ en: "coffee (drink)" });
    expect(publishPayload(r).part_status.vocabulary).toBe("fixed");
  });
});

describe("costReport", () => {
  it("records the actual cost at Batch prices next to the estimate", () => {
    const reqs = buildPassARequests([lessonRow()]);
    const estimate = estimateStage("generate-a", reqs);
    const outcome = parsePassA([lessonRow()], [succeeded("generate-a-Z9", validPassA())]);
    const report = costReport("generate-a", estimate, "batch_1", outcome, 1);
    expect(report).toMatchObject({ stage: "generate-a", batchId: "batch_1", requests: 1, failedRequests: 0, inputTokens: 5000, outputTokens: 9000 });
    expect(report.actualUsd).toBeCloseTo((5000 * 2 + 9000 * 10) / 1e6 / 2, 4);
    expect(report.actualEur).toBeCloseTo(report.actualUsd * estimate.usdToEur, 3);
  });
});

describe("items match what the reviewer is asked about", () => {
  it("the review prompt lists exactly the lesson's items", () => {
    const reqs = buildReviewRequests([row], new Map([["Z1", validLesson()]]), [row]);
    const text = reqs[0].params.messages[0].content;
    for (const item of enumerateItems("Z1", validLesson())) expect(text).toContain(`"id":"${item.id}"`);
  });
});

describe("manual corrections and the re-review of just those items", () => {
  const lesson = validLesson();
  const contents = new Map([["Z1", lesson]]);
  const fixedWriting = { ...lesson.writing, min_words: 20 };
  const fixes = { "Z1#writing": { reason: "shorter minimum", value: fixedWriting }, "Z2#goal": { reason: "another lesson", value: lesson.goal } };

  it("a correction replaces exactly its item, in the lesson it names", () => {
    expect(manualFixIds("Z1", fixes)).toEqual(["Z1#writing"]);
    const fixed = applyManualFixes("Z1", lesson, fixes);
    expect(fixed.writing.min_words).toBe(20);
    expect(fixed.goal).toEqual(lesson.goal);
    expect(lesson.writing.min_words).toBe(30); // the written lesson is not mutated
  });

  it("a correction for an item that does not exist, or that does not fit its format, is refused loudly", () => {
    expect(() => applyManualFixes("Z1", lesson, { "Z1#writing.nope": { reason: "x", value: {} } })).toThrow("no such item");
    expect(() => applyManualFixes("Z1", lesson, { "Z1#writing": { reason: "x", value: { task: 1 } } })).toThrow("does not fit");
  });

  it("an old verdict no longer counts for a corrected item: only the re-review's verdict does, and without one the item waits for a human", () => {
    const first = allOk(lesson);
    const corrected = applyManualFixes("Z1", lesson, fixes);
    const waiting = mergeLesson(row, corrected, currentVerdicts("Z1", first, undefined, fixes)!);
    expect(waiting.items.find((i) => i.id === "Z1#writing")).toMatchObject({ status: "needs-human" });
    expect(waiting.publishable).toBe(false);
    const done = mergeLesson(row, corrected, currentVerdicts("Z1", first, [verdict("Z1#writing", "ok", { reason: "re-checked" })], fixes)!);
    expect(done.items.find((i) => i.id === "Z1#writing")).toMatchObject({ status: "ok", reason: "re-checked" });
    expect(done.items.filter((i) => i.status === "ok")).toHaveLength(93);
    expect(done.publishable).toBe(true);
  });

  it("a re-review verdict is only valid for the exact text it checked: edit the correction afterwards and the item waits for a human again", () => {
    const first = allOk(lesson);
    const checked = [verdict("Z1#writing", "ok", { reason: "re-checked" })];
    const hashes = { "Z1#writing": fixHash(fixes["Z1#writing"].value) };
    // same text: the verdict counts
    expect(currentVerdicts("Z1", first, checked, fixes, hashes)!.find((v) => v.id === "Z1#writing")).toMatchObject({ reason: "re-checked" });
    // the correction was edited after the re-check: the verdict is stale, nothing counts for it
    const edited = { ...fixes, "Z1#writing": { ...fixes["Z1#writing"], value: { ...(fixes["Z1#writing"].value as object), model_answer: "Ein neuer Text." } } };
    expect(currentVerdicts("Z1", first, checked, edited, hashes)!.some((v) => v.id === "Z1#writing")).toBe(false);
    const waiting = mergeLesson(row, applyManualFixes("Z1", lesson, edited), currentVerdicts("Z1", first, checked, edited, hashes)!);
    expect(waiting.items.find((i) => i.id === "Z1#writing")).toMatchObject({ status: "needs-human" });
    expect(waiting.publishable).toBe(false);
    // no recorded hash at all counts as stale too
    expect(currentVerdicts("Z1", first, checked, fixes, {})!.some((v) => v.id === "Z1#writing")).toBe(false);
  });

  it("a re-review verdict for an item that was not corrected is ignored", () => {
    const got = currentVerdicts("Z1", allOk(lesson), [verdict("Z1#goal", "needs-human"), verdict("Z1#writing")], fixes)!;
    expect(got.find((v) => v.id === "Z1#goal")!.status).toBe("ok");
  });

  it("the re-review request holds only the corrected items (and the passage a question refers to), with small token limits", () => {
    const reqs = buildReviewRequests([row], contents, [row], new Map([["Z1", ["Z1#writing", "Z1#exam.reading.q1"]]]));
    expect(reqs).toHaveLength(1);
    const text = reqs[0].params.messages[0].content;
    expect(text).toContain("Items to check (2)");
    expect(text).toContain("RE-REVIEW");
    expect(text).toContain('"id":"Z1#writing"');
    expect(text).toContain('"id":"Z1#exam.reading.q1"');
    expect(text).toContain('"id":"Z1#exam.reading.passage"'); // as context
    expect(text).not.toContain('"id":"Z1#exam.reading.q2"');
    expect(text).not.toContain('"id":"Z1#goal"');
    expect(reqs[0].params.max_tokens).toBeLessThan(20_000);
    expect(buildReviewRequests([row], contents, [row], new Map())).toEqual([]);
  });

  it("the answer to a re-review holds exactly the asked items; a skipped one waits for a human", () => {
    const only = new Map([["Z1", ["Z1#writing", "Z1#goal"]]]);
    const out = parseReview([row], contents, [succeeded("review-Z1", { verdicts: [verdict("Z1#writing"), verdict("Z1#exam.speaking", "needs-human")] })], only);
    expect(out.results.get("Z1")!.map((v) => [v.id, v.status])).toEqual([["Z1#goal", "needs-human"], ["Z1#writing", "ok"]]);
  });

  it("a correction that breaks another item is caught when the finished lesson is checked again", () => {
    const broken = structuredClone(lesson);
    broken.exam.grammar_vocab[0] = { ...broken.exercises.items[0] }; // an exam item that repeats an exercise
    const review = mergeLesson(row, broken, allOk(broken));
    expect(review.items.find((i) => i.id === "Z1#exam.gv1")).toMatchObject({ status: "needs-human" });
    expect(review.publishable).toBe(false);
  });
});

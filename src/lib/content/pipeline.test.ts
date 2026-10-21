import { describe, expect, it, vi } from "vitest";
import {
  approvedRows,
  assertApproved,
  buildGenerationRequests,
  buildReviewRequests,
  costReport,
  customId,
  estimateStage,
  fingerprint,
  itemIds,
  mergeLesson,
  parseGeneration,
  parseReview,
  runBatch,
  summarize,
  type BatchClient,
  type BatchResultLine,
} from "./pipeline.ts";
import { GENERATION_MAX_TOKENS, GENERATION_MODEL, REVIEW_MODEL } from "./prompts.ts";
import { generatedCardSchema, type Verdict } from "./schema.ts";
import { lessonRow, validContent } from "./test-fixtures.ts";

const usage = { input_tokens: 2000, output_tokens: 4000 };
const succeeded = (id: string, body: unknown, over: { stop_reason?: string | null } = {}): BatchResultLine => ({
  custom_id: id,
  result: { type: "succeeded", message: { content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }], stop_reason: over.stop_reason ?? "end_turn", usage } },
});
const verdict = (id: string, status: Verdict["status"] = "ok", over: Partial<Verdict> = {}): Verdict => ({ id, status, reason: "fine", fixed_card: null, fixed_question: null, ...over });
const allOk = (code: string, content = validContent()) => itemIds(code, content).map((id) => verdict(id));

describe("requests", () => {
  const lessons = [lessonRow(), lessonRow({ seq: 40, code: "W3.2", phase: "A1", theme: "Freizeit" })];

  it("custom ids avoid characters the Batch API rejects", () => {
    expect(customId("generate", "W3.2")).toBe("generate-W3_2");
    expect(customId("review", "Z9")).toBe("review-Z9");
    expect(customId("generate", "W3.2")).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it("generation: one request per lesson, Sonnet, structured output, no sampling parameters", () => {
    const reqs = buildGenerationRequests(lessons);
    expect(reqs.map((r) => r.custom_id)).toEqual(["generate-Z9", "generate-W3_2"]);
    for (const r of reqs) {
      expect(r.params.model).toBe(GENERATION_MODEL);
      expect(r.params.model).toBe("claude-sonnet-5-5");
      expect(r.params.max_tokens).toBe(GENERATION_MAX_TOKENS);
      expect(r.params.output_config.format.type).toBe("json_schema");
      expect(Object.keys(r.params).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    }
    expect(reqs[1].params.messages[0].content).toContain("W3.2");
    expect(reqs[1].params.messages[0].content).toContain("CEFR level A1");
  });

  it("review: Opus, only for lessons that have content, carrying the lesson's items and automatic hints", () => {
    const contents = new Map([["Z9", validContent()]]);
    const reqs = buildReviewRequests(lessons, contents);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].params.model).toBe(REVIEW_MODEL);
    expect(reqs[0].params.model).toBe("claude-opus-5-5");
    expect(reqs[0].params.messages[0].content).toContain("Z9#c01");
    expect(reqs[0].params.messages[0].content).toContain("Z9#q12");
  });
});

describe("cost estimate and approval", () => {
  const reqs = buildGenerationRequests([lessonRow(), lessonRow({ code: "Z10", seq: 9 })]);

  it("estimates requests, tokens and euros before anything is paid for", () => {
    const e = estimateStage("generate", reqs);
    expect(e).toMatchObject({ stage: "generate", requests: 2, model: "claude-sonnet-5-5" });
    expect(e.inputTokens).toBeGreaterThan(2000);
    expect(e.ceilingEur).toBeGreaterThan(e.expectedEur);
    expect(e.id).toBe(fingerprint(reqs));
  });

  it("uses exact token counts when they are given", () => {
    expect(estimateStage("generate", reqs, { exactInputTokens: [100, 200] }).inputTokens).toBe(300);
  });

  it("an approval is bound to the exact requests: no id, a stale id and a changed request are all refused", () => {
    const e = estimateStage("generate", reqs);
    expect(() => assertApproved(reqs, undefined, e)).toThrow(/approve/);
    expect(() => assertApproved(reqs, "deadbeef", e)).toThrow(/not for these requests/);
    expect(() => assertApproved(reqs, e.id, e)).not.toThrow();
    const changed = buildGenerationRequests([lessonRow({ grammar: "Something else" }), lessonRow({ code: "Z10", seq: 9 })]);
    expect(fingerprint(changed)).not.toBe(e.id);
    expect(() => assertApproved(changed, e.id, e)).toThrow(/not for these requests/);
  });

  it("hard stop at €10 even with an approval", () => {
    const many = buildGenerationRequests(Array.from({ length: 600 }, (_, i) => lessonRow({ code: `Z${i}`, seq: i })));
    const e = estimateStage("generate", many);
    expect(e.ceilingEur).toBeGreaterThan(10);
    expect(() => assertApproved(many, e.id, e)).toThrow(/Hard stop/);
  });

  it("the whole 90-lesson run stays under the cap pass by pass", () => {
    const lessons = Array.from({ length: 90 }, (_, i) => lessonRow({ code: `Z${i}`, seq: i }));
    const gen = estimateStage("generate", buildGenerationRequests(lessons));
    const review = estimateStage("review", buildReviewRequests(lessons, new Map(lessons.map((l) => [l.code, validContent()]))));
    expect(gen.ceilingEur).toBeLessThan(10);
    expect(review.ceilingEur).toBeLessThan(10);
    expect(gen.expectedEur + review.expectedEur).toBeLessThan(10);
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
    return { client: { messages: { batches: { create, retrieve, results } } } as BatchClient, create, retrieve, results };
  }
  const reqs = buildGenerationRequests([lessonRow()]);

  it("submits once, records the batch id, polls until it has ended, then reads every result", async () => {
    const { client, create, retrieve } = fakeClient(["in_progress", "in_progress", "ended"], [succeeded("generate-Z9", validContent())]);
    const onSubmitted = vi.fn();
    const sleep = vi.fn(async () => {});
    const out = await runBatch(client, reqs, { onSubmitted, sleep });
    expect(create).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith("batch_1");
    expect(retrieve).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(out.lines).toHaveLength(1);
  });

  it("resuming a run never submits (and so never pays for) the batch again", async () => {
    const { client, create, retrieve } = fakeClient(["ended"], []);
    const onSubmitted = vi.fn();
    const out = await runBatch(client, reqs, { batchId: "batch_old", onSubmitted });
    expect(create).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledWith("batch_old");
    expect(out.batchId).toBe("batch_old");
  });
});

describe("parseGeneration", () => {
  const lessons = [lessonRow(), lessonRow({ code: "W3.2", seq: 40 })];

  it("reads valid lessons, keyed by lesson code (also dotted ones)", () => {
    const out = parseGeneration(lessons, [succeeded("generate-Z9", validContent()), succeeded("generate-W3_2", validContent())]);
    expect([...out.results.keys()]).toEqual(["Z9", "W3.2"]);
    expect(out.failures).toEqual([]);
    expect(out.usages).toHaveLength(2);
  });

  it.each([
    ["invalid JSON", succeeded("generate-Z9", "not json at all"), /not valid JSON/],
    ["the wrong shape", succeeded("generate-Z9", { cards: "nope" }), /did not match/],
    ["a cut-off answer", succeeded("generate-Z9", validContent(), { stop_reason: "max_tokens" }), /cut off/],
    ["a refusal", succeeded("generate-Z9", validContent(), { stop_reason: "refusal" }), /declined/],
    ["an errored request", { custom_id: "generate-Z9", result: { type: "errored", error: { type: "overloaded_error" } } } as BatchResultLine, /request failed/],
    ["an expired request", { custom_id: "generate-Z9", result: { type: "expired" } } as BatchResultLine, /expired/],
  ])("records %s as a failure for that lesson only", (_name, line, reason) => {
    const out = parseGeneration([lessons[0]], [line]);
    expect(out.results.size).toBe(0);
    expect(out.failures).toEqual([{ code: "Z9", reason: expect.stringMatching(reason) }]);
  });

  it("a lesson with no result at all is a failure", () => {
    expect(parseGeneration(lessons, [succeeded("generate-Z9", validContent())]).failures).toEqual([{ code: "W3.2", reason: "no result came back" }]);
  });
});

describe("parseReview", () => {
  const lessons = [lessonRow()];
  const contents = new Map([["Z9", validContent()]]);
  const ids = itemIds("Z9", validContent());

  it("returns one verdict per item, in item order", () => {
    const out = parseReview(lessons, contents, [succeeded("review-Z9", { verdicts: [...ids].reverse().map((id) => verdict(id)) })]);
    expect(out.results.get("Z9")!.map((v) => v.id)).toEqual(ids);
    expect(ids).toHaveLength(27);
  });

  it("an item the reviewer skipped is not an ok: it waits for a human", () => {
    const out = parseReview(lessons, contents, [succeeded("review-Z9", { verdicts: ids.slice(1).map((id) => verdict(id)) })]);
    const first = out.results.get("Z9")![0];
    expect(first).toMatchObject({ id: ids[0], status: "needs-human" });
    expect(first.reason).toMatch(/no verdict/);
  });

  it("ignores ids that were never asked about, and takes the first of a repeated id", () => {
    const out = parseReview(lessons, contents, [
      succeeded("review-Z9", { verdicts: [verdict("Z9#c99"), verdict(ids[0], "needs-human", { reason: "first" }), verdict(ids[0], "ok"), ...ids.slice(1).map((id) => verdict(id))] }),
    ]);
    const verdicts = out.results.get("Z9")!;
    expect(verdicts).toHaveLength(27);
    expect(verdicts[0]).toMatchObject({ status: "needs-human", reason: "first" });
  });

  it("a failed review request leaves the lesson without verdicts (nothing is approved)", () => {
    const out = parseReview(lessons, contents, [succeeded("review-Z9", "garbage")]);
    expect(out.results.size).toBe(0);
    expect(out.failures[0].code).toBe("Z9");
  });
});

describe("mergeLesson: only ok and fixed items get through", () => {
  const code = "Z9";
  const content = validContent();
  const ids = itemIds(code, content);

  it("everything ok: all 15 cards and 12 questions are approved, in order", () => {
    const review = mergeLesson(code, content, allOk(code));
    expect(review.lessonIssues).toEqual([]);
    expect(review.items.every((i) => i.status === "ok" && i.final)).toBe(true);
    const rows = approvedRows([review]);
    expect(rows.cards).toHaveLength(15);
    expect(rows.questions).toHaveLength(12);
    expect(rows.cards.slice(0, 3).map((c) => c.position)).toEqual([1, 2, 3]);
    expect(rows.cards[0]).toMatchObject({ session_code: "Z9", kind: "word", tier: "core", de: "Kaffee", article: "der" });
    expect(rows.cards[14]).toMatchObject({ tier: "bonus" });
  });

  it("needs-human items are listed with their reason but never inserted", () => {
    const verdicts = allOk(code).map((v) => (v.id === ids[2] ? verdict(v.id, "needs-human", { reason: "Brot: the example is odd for this level" }) : v));
    const review = mergeLesson(code, content, verdicts);
    const item = review.items[2];
    expect(item).toMatchObject({ status: "needs-human", final: null, reason: "Brot: the example is odd for this level" });
    const rows = approvedRows([review]);
    expect(rows.cards).toHaveLength(14);
    expect(rows.cards.some((c) => c.de === "Brot")).toBe(false);
  });

  it("a fixed card is inserted in its corrected form, keeping its tier", () => {
    const fixedCard = generatedCardSchema.parse({ ...content.cards[0], article: "der", plural: "die Kaffees", example: "Ich trinke gern Kaffee.", tier: "bonus" });
    const verdicts = allOk(code).map((v) => (v.id === ids[0] ? verdict(v.id, "fixed", { reason: "Example was ungrammatical", fixed_card: fixedCard }) : v));
    const review = mergeLesson(code, content, verdicts);
    expect(review.items[0]).toMatchObject({ status: "fixed", reason: "Example was ungrammatical" });
    expect((review.items[0].original as { example: string }).example).toBe("Ich trinke einen Kaffee."); // the original is kept for the review file
    expect(approvedRows([review]).cards[0]).toMatchObject({ example: "Ich trinke gern Kaffee.", tier: "core" });
  });

  it("a fix without a replacement item, or whose replacement still fails an automatic check, waits for a human", () => {
    const noPayload = allOk(code).map((v) => (v.id === ids[0] ? verdict(v.id, "fixed", { reason: "changed it" }) : v));
    expect(mergeLesson(code, content, noPayload).items[0]).toMatchObject({ status: "needs-human", final: null });
    const stillBroken = generatedCardSchema.parse({ ...content.cards[0], de: "der Kaffee" });
    const bad = allOk(code).map((v) => (v.id === ids[0] ? verdict(v.id, "fixed", { reason: "x", fixed_card: stillBroken }) : v));
    const item = mergeLesson(code, content, bad).items[0];
    expect(item.status).toBe("needs-human");
    expect(item.reason).toMatch(/still fails an automatic check/);
  });

  it("the reviewer's ok is not enough when a mechanical check fails (a gap question without a gap)", () => {
    const broken = validContent();
    broken.questions[6] = { ...broken.questions[6], prompt: "Ich trinke Kaffee." };
    const review = mergeLesson(code, broken, allOk(code, broken));
    const item = review.items.find((i) => i.id === "Z9#q07")!;
    expect(item.status).toBe("needs-human");
    expect(item.reason).toMatch(/reviewer said ok, but an automatic check failed/);
    expect(approvedRows([review]).questions).toHaveLength(11);
  });

  it("a lesson with the wrong number of cards is reported, and its good items are still handled one by one", () => {
    const short = validContent();
    short.cards.pop();
    const review = mergeLesson(code, short, allOk(code, short));
    expect(review.lessonIssues.join(" ")).toMatch(/Expected 10 core \+ 5 bonus/);
  });

  it("summarises the counts for the review file", () => {
    const verdicts = allOk(code).map((v, i) => (i === 0 ? verdict(v.id, "needs-human") : i === 1 ? verdict(v.id, "fixed", { fixed_card: content.cards[1] }) : v));
    expect(summarize([mergeLesson(code, content, verdicts)])).toEqual({ lessons: 1, items: 27, ok: 25, fixed: 1, needsHuman: 1, lessonsWithIssues: [] });
  });
});

describe("costReport", () => {
  it("records the actual cost at Batch prices next to the estimate", () => {
    const reqs = buildGenerationRequests([lessonRow()]);
    const estimate = estimateStage("generate", reqs);
    const outcome = parseGeneration([lessonRow()], [succeeded("generate-Z9", validContent())]);
    const report = costReport("generate", estimate, "batch_1", outcome, 1);
    expect(report).toMatchObject({ stage: "generate", batchId: "batch_1", requests: 1, failedRequests: 0, inputTokens: 2000, outputTokens: 4000 });
    expect(report.actualUsd).toBeCloseTo((2000 * 2 + 4000 * 10) / 1e6 / 2, 4);
    expect(report.actualEur).toBeCloseTo(report.actualUsd * estimate.usdToEur, 3);
    expect(report.ceilingEur).toBeGreaterThan(report.estimatedEur);
  });
});

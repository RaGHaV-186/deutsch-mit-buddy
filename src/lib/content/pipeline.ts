import { createHash } from "node:crypto";
import type { CurriculumRow } from "./curriculum-rows.ts";
import { applyFix, enumerateItems, valueOf, type LessonItem, type UnitName } from "./lesson-items.ts";
import { lessonErrors, lintLesson } from "./lesson-lint.ts";
import {
  PART_NUMBER,
  PARTS,
  PASS_A_JSON_SCHEMA,
  PASS_B_JSON_SCHEMA,
  PASS_C_JSON_SCHEMA,
  REVIEW_JSON_SCHEMA,
  lessonSchema,
  passASchema,
  passBSchema,
  passCSchema,
  reviewResultSchema,
  wireToDomain,
  type Lesson,
  type PartName,
  type PassA,
  type PassB,
  type PassC,
  type ReviewVerdict,
} from "./lesson-schema.ts";
import { actualCostUsd, assertWithinCap, estimateRun, estimateTokens, type RunEstimate, type Usage } from "./pricing.ts";
import {
  EXPECTED_OUTPUT,
  GENERATION_MODEL,
  PASS_A_MAX_TOKENS,
  PASS_A_SYSTEM,
  PASS_B_MAX_TOKENS,
  PASS_B_SYSTEM,
  PASS_C_MAX_TOKENS,
  PASS_C_SYSTEM,
  REVIEW_MAX_TOKENS,
  REVIEW_MODEL,
  REVIEW_SYSTEM,
  passAPrompt,
  passBPrompt,
  passCPrompt,
  reviewPrompt,
} from "./prompts.ts";

// The pipeline for a lesson: Sonnet pass A (teach), pass B (reading, listening, writing, speaking), pass C (culture, mission, day exam,
// close day; B and C see A), then an Opus review of every item. All of them are Batch API runs. The API client is injected, so everything here is testable with a fake.
// Relative imports only (the scripts run this file with plain Node).

export type Stage = "generate-a" | "generate-b" | "generate-c" | "review";

export interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: "user"; content: string }[];
    output_config: { effort: "low" | "medium" | "high"; format: { type: "json_schema"; schema: Record<string, unknown> } };
  };
}
export interface BatchResultLine {
  custom_id: string;
  result:
    | { type: "succeeded"; message: { content: { type: string; text?: string }[]; stop_reason: string | null; usage: Usage } }
    | { type: "errored"; error: unknown }
    | { type: "canceled" }
    | { type: "expired" };
}
export interface BatchClient {
  messages: {
    batches: {
      create(body: { requests: BatchRequest[] }): Promise<{ id: string }>;
      retrieve(id: string): Promise<{ processing_status: "in_progress" | "canceling" | "ended" }>;
      results(id: string): Promise<AsyncIterable<BatchResultLine>>;
    };
  };
}

// ---- Requests
/** Batch custom ids allow letters, digits, _ and - only; lesson codes such as W3.2 are mapped to W3_2. */
export const customId = (stage: Stage, code: string) => `${stage}-${code.replace(/[^A-Za-z0-9_-]/g, "_")}`;

const request = (stage: Stage, code: string, model: string, maxTokens: number, system: string, content: string, schema: Record<string, unknown>): BatchRequest => ({
  custom_id: customId(stage, code),
  params: { model, max_tokens: maxTokens, system, messages: [{ role: "user", content }], output_config: { effort: "medium", format: { type: "json_schema", schema } } },
});

export const buildPassARequests = (lessons: CurriculumRow[]): BatchRequest[] =>
  lessons.map((l) => request("generate-a", l.code, GENERATION_MODEL, PASS_A_MAX_TOKENS, PASS_A_SYSTEM, passAPrompt(l), PASS_A_JSON_SCHEMA));

export const buildPassBRequests = (lessons: CurriculumRow[], passA: Map<string, PassA>): BatchRequest[] =>
  lessons.flatMap((l) => {
    const a = passA.get(l.code);
    return a ? [request("generate-b", l.code, GENERATION_MODEL, PASS_B_MAX_TOKENS, PASS_B_SYSTEM, passBPrompt(l, a), PASS_B_JSON_SCHEMA)] : [];
  });

export const buildPassCRequests = (lessons: CurriculumRow[], passA: Map<string, PassA>): BatchRequest[] =>
  lessons.flatMap((l) => {
    const a = passA.get(l.code);
    return a ? [request("generate-c", l.code, GENERATION_MODEL, PASS_C_MAX_TOKENS, PASS_C_SYSTEM, passCPrompt(l, a), PASS_C_JSON_SCHEMA)] : [];
  });

export const buildReviewRequests = (lessons: CurriculumRow[], contents: Map<string, Lesson>): BatchRequest[] =>
  lessons.flatMap((l) => {
    const c = contents.get(l.code);
    return c ? [request("review", l.code, REVIEW_MODEL, REVIEW_MAX_TOKENS, REVIEW_SYSTEM, reviewPrompt(l, c, lintLesson(l.code, l.phase, c)), REVIEW_JSON_SCHEMA)] : [];
  });

// ---- Cost estimate (shown before every paid run, and what an approval is bound to)
export interface StageEstimate extends RunEstimate {
  stage: Stage;
  /** Fingerprint of the exact requests. An approval of this id is an approval of these requests and no others. */
  id: string;
}

export const fingerprint = (requests: BatchRequest[]) => createHash("sha256").update(JSON.stringify(requests)).digest("hex").slice(0, 16);

export function estimateStage(stage: Stage, requests: BatchRequest[], opts: { rate?: number; exactInputTokens?: number[] } = {}): StageEstimate {
  const first = requests[0]?.params;
  if (!first) throw new Error("Nothing to estimate: no requests.");
  // A JSON Schema costs input tokens too (about 1 token per 1.3 characters, measured with a real request); the token counter does not include it.
  const schemaTokens = (r: BatchRequest) => Math.ceil(JSON.stringify(r.params.output_config.format.schema).length / 1.3);
  const inputTokensPerRequest = opts.exactInputTokens
    ? opts.exactInputTokens.map((n, i) => n + schemaTokens(requests[i]))
    : requests.map((r) => estimateTokens(r.params.system + r.params.messages.map((m) => m.content).join("")) + schemaTokens(r));
  const estimate = estimateRun({ model: first.model, inputTokensPerRequest, expectedOutputPerRequest: EXPECTED_OUTPUT[stage], maxTokens: first.max_tokens, rate: opts.rate });
  return { ...estimate, stage, id: fingerprint(requests) };
}

/** Throws unless `approvedId` matches these exact requests and the worst case stays under the cap. */
export function assertApproved(requests: BatchRequest[], approvedId: string | undefined, estimate: StageEstimate) {
  if (!approvedId) throw new Error("This run is paid. Show the estimate first and pass --approve <estimate id> once it has been approved.");
  if (approvedId !== fingerprint(requests)) throw new Error(`The approved estimate (${approvedId}) is not for these requests (${fingerprint(requests)}). Run the estimate again.`);
  assertWithinCap(estimate);
}

// ---- Running a batch (resumable: a restarted run polls the batch it already paid for instead of submitting again)
export interface RunOptions {
  batchId?: string;
  onSubmitted: (batchId: string) => Promise<void> | void;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export async function runBatch(client: BatchClient, requests: BatchRequest[], opts: RunOptions) {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = opts.log ?? (() => {});
  let batchId = opts.batchId;
  if (batchId) log(`Resuming batch ${batchId} (nothing is submitted again).`);
  else {
    const batch = await client.messages.batches.create({ requests });
    batchId = batch.id;
    await opts.onSubmitted(batchId);
    log(`Submitted batch ${batchId} with ${requests.length} requests.`);
  }
  for (;;) {
    const status = await client.messages.batches.retrieve(batchId);
    if (status.processing_status === "ended") break;
    log(`Batch ${batchId}: ${status.processing_status}`);
    await sleep(opts.pollMs ?? 30_000);
  }
  const lines: BatchResultLine[] = [];
  for await (const line of await client.messages.batches.results(batchId)) lines.push(line);
  return { batchId, lines };
}

// ---- Reading results
function replyText(line: BatchResultLine): { text?: string; usage?: Usage; problem?: string } {
  const r = line.result;
  if (r.type !== "succeeded") return { problem: r.type === "errored" ? `request failed: ${JSON.stringify(r.error).slice(0, 200)}` : `request ${r.type}` };
  const { message } = r;
  if (message.stop_reason === "max_tokens") return { usage: message.usage, problem: "the answer was cut off at the token limit" };
  if (message.stop_reason === "refusal") return { usage: message.usage, problem: "the model declined the request" };
  return { text: message.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""), usage: message.usage };
}

type Parse<T> = (v: unknown) => { success: true; data: T } | { success: false; error: { message: string } };
function parseJson<T>(text: string | undefined, parse: Parse<T>) {
  if (!text) return { problem: "no text in the answer" } as const;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { problem: "the answer was not valid JSON" } as const;
  }
  const parsed = parse(raw);
  return parsed.success ? ({ data: parsed.data } as const) : ({ problem: `the answer did not match the format: ${parsed.error.message.slice(0, 300)}` } as const);
}

export interface StageOutcome<T> {
  results: Map<string, T>;
  failures: { code: string; reason: string }[];
  usages: Usage[];
}

function parseStage<T>(stage: Stage, lessons: CurriculumRow[], lines: BatchResultLine[], parse: Parse<T>): StageOutcome<T> {
  const byId = new Map(lines.map((l) => [l.custom_id, l]));
  const out: StageOutcome<T> = { results: new Map(), failures: [], usages: [] };
  for (const lesson of lessons) {
    const line = byId.get(customId(stage, lesson.code));
    if (!line) {
      out.failures.push({ code: lesson.code, reason: "no result came back" });
      continue;
    }
    const reply = replyText(line);
    if (reply.usage) out.usages.push(reply.usage);
    if (reply.problem) {
      out.failures.push({ code: lesson.code, reason: reply.problem });
      continue;
    }
    const parsed = parseJson(reply.text, parse);
    if ("problem" in parsed) out.failures.push({ code: lesson.code, reason: parsed.problem! });
    else out.results.set(lesson.code, parsed.data);
  }
  return out;
}

// The model writes "" for "nothing"; wireToDomain turns that back into null before the lesson's own schema checks it.
export const parsePassA = (lessons: CurriculumRow[], lines: BatchResultLine[]) => parseStage("generate-a", lessons, lines, (v) => passASchema.safeParse(wireToDomain(v)));
export const parsePassB = (lessons: CurriculumRow[], lines: BatchResultLine[]) => parseStage("generate-b", lessons, lines, (v) => passBSchema.safeParse(wireToDomain(v)));
export const parsePassC = (lessons: CurriculumRow[], lines: BatchResultLine[]) => parseStage("generate-c", lessons, lines, (v) => passCSchema.safeParse(wireToDomain(v)));

/** The whole lesson: the three passes together, validated as one. */
export function combineLesson(a: PassA, b: PassB, c: PassC): Lesson {
  return lessonSchema.parse({ ...a, ...b, ...c });
}

export const itemIdsOf = (code: string, lesson: Lesson) => enumerateItems(code, lesson).map((i) => i.id);

export function parseReview(lessons: CurriculumRow[], contents: Map<string, Lesson>, lines: BatchResultLine[]): StageOutcome<ReviewVerdict[]> {
  const reviewable = lessons.filter((l) => contents.has(l.code));
  const raw = parseStage("review", reviewable, lines, (v) => reviewResultSchema.safeParse(v));
  const out: StageOutcome<ReviewVerdict[]> = { results: new Map(), failures: raw.failures, usages: raw.usages };
  for (const [code, parsed] of raw.results) {
    // Exactly one verdict per item. A missing verdict is never an "ok": it waits for a human.
    const first = new Map<string, ReviewVerdict>();
    for (const v of parsed.verdicts) if (!first.has(v.id)) first.set(v.id, v);
    out.results.set(
      code,
      itemIdsOf(code, contents.get(code)!).map((id) => first.get(id) ?? { id, status: "needs-human" as const, reason: "The reviewer returned no verdict for this item.", fixed_json: null }),
    );
  }
  return out;
}

// ---- Merging the passes
export type ItemStatus = "ok" | "fixed" | "needs-human";

export interface ReviewItem {
  id: string;
  part: PartName;
  unit: UnitName;
  label: string;
  status: ItemStatus;
  reason: string;
  /** What Sonnet wrote. */
  original: unknown;
  /** What gets published: the original for "ok", the correction for "fixed", nothing for "needs-human". */
  final: unknown | null;
  /** Automatic checks that fired on this item. */
  lint: string[];
}

export interface LessonReview {
  code: string;
  phase: CurriculumRow["phase"];
  /** Problems with the lesson as a whole (for example a wrong number of exercises). They block publishing. */
  lessonIssues: string[];
  items: ReviewItem[];
  /** The lesson with every accepted correction applied (needs-human items stay as written). */
  final: Lesson;
  partStatus: Record<PartName, ItemStatus>;
  /** True only when every item is ok or fixed and the lesson as a whole has no errors. */
  publishable: boolean;
}

export function mergeLesson(lesson: CurriculumRow, content: Lesson, verdicts: ReviewVerdict[]): LessonReview {
  const { code, phase } = lesson;
  const verdictOf = new Map(verdicts.map((v) => [v.id, v]));
  const initialLint = lintLesson(code, phase, content);
  const items: ReviewItem[] = [];
  let current = content;

  for (const item of enumerateItems(code, content)) {
    const original = valueOf(content, item);
    const lintMessages = initialLint.filter((l) => l.id === item.id).map((l) => l.message);
    const base = { id: item.id, part: item.part, unit: item.unit, label: item.label, original, lint: lintMessages };
    const needsHuman = (reason: string): ReviewItem => ({ ...base, status: "needs-human", reason, final: null });
    const v = verdictOf.get(item.id);

    if (!v) items.push(needsHuman("No verdict for this item."));
    else if (v.status === "needs-human") items.push(needsHuman(v.reason));
    else if (v.status === "fixed") {
      const applied = v.fixed_json ? applyFix(current, item as LessonItem, v.fixed_json) : null;
      if (!applied) items.push(needsHuman(`Marked fixed, but the correction is missing or does not fit this item. (${v.reason})`));
      else {
        const remaining = lintLesson(code, phase, applied.lesson).filter((l) => l.id === item.id && l.level === "error");
        if (remaining.length) items.push(needsHuman(`The correction still fails an automatic check (${remaining[0].message}). (${v.reason})`));
        else {
          current = applied.lesson;
          items.push({ ...base, status: "fixed", reason: v.reason, final: applied.value });
        }
      }
    } else {
      // "ok" is believed only when the mechanical checks agree.
      const failing = initialLint.find((l) => l.id === item.id && l.level === "error");
      items.push(failing ? needsHuman(`The reviewer said ok, but an automatic check failed: ${failing.message}`) : { ...base, status: "ok", reason: v.reason, final: original });
    }
  }

  const lessonIssues = lessonErrors(lintLesson(code, phase, current)).map((l) => l.message);
  const partStatus = Object.fromEntries(
    PARTS.map((part) => {
      const mine = items.filter((i) => i.part === part);
      return [part, mine.some((i) => i.status === "needs-human") ? "needs-human" : mine.some((i) => i.status === "fixed") ? "fixed" : "ok"];
    }),
  ) as Record<PartName, ItemStatus>;
  const publishable = items.every((i) => i.status !== "needs-human") && lessonIssues.length === 0;
  return { code, phase, lessonIssues, items, final: current, partStatus, publishable };
}

// ---- What gets published
export interface PublishPayload {
  code: string;
  parts: Record<PartName, unknown>;
  part_status: Record<PartName, "ok" | "fixed">;
  cards: Record<string, unknown>[];
  questions: Record<string, unknown>[];
}

/** Rows for the publish function. Throws when the lesson is not publishable: nothing incomplete ever goes in. */
export function publishPayload(review: LessonReview): PublishPayload {
  if (!review.publishable) throw new Error(`${review.code} is not publishable: ${review.items.filter((i) => i.status === "needs-human").length} item(s) need a human, ${review.lessonIssues.length} lesson-level problem(s).`);
  const l = review.final;
  const cards: Record<string, unknown>[] = l.vocabulary.words.map((c, i) => ({
    session_code: review.code, kind: "word", tier: c.tier, position: i + 1, en: c.en, article: c.article, de: c.de, plural: c.plural, example: c.example, example_en: c.example_en, tip: c.tip,
  }));
  l.vocabulary.phrases.forEach((p, i) => cards.push({ session_code: review.code, kind: "say", tier: "core", position: l.vocabulary.words.length + i + 1, en: p.en, article: null, de: p.de, plural: null, example: p.example, example_en: p.example_en, tip: p.tip }));
  const questions: Record<string, unknown>[] = [];
  const push = (part: string, list: Lesson["exercises"]["items"]) =>
    list.forEach((q, i) => questions.push({ session_code: review.code, part, position: i + 1, skill: q.skill, type: q.type, prompt: q.prompt, answer: q.answer, distractors: q.distractors, explanation: q.explanation }));
  push("warmup", l.warmup.items);
  push("exercises", l.exercises.items);
  push("reading", l.reading.questions);
  push("listening", l.listening.questions);
  push("exam", [...l.exam.grammar_vocab, ...l.exam.reading.questions, ...l.exam.listening.questions]);
  const part_status = Object.fromEntries(PARTS.map((p) => [p, review.partStatus[p] === "fixed" ? "fixed" : "ok"])) as PublishPayload["part_status"];
  return { code: review.code, parts: Object.fromEntries(PARTS.map((p) => [p, l[p]])) as Record<PartName, unknown>, part_status, cards, questions };
}

export function summarize(reviews: LessonReview[]) {
  const count = (status: ItemStatus) => reviews.reduce((n, l) => n + l.items.filter((i) => i.status === status).length, 0);
  return {
    lessons: reviews.length,
    items: reviews.reduce((n, l) => n + l.items.length, 0),
    ok: count("ok"),
    fixed: count("fixed"),
    needsHuman: count("needs-human"),
    publishable: reviews.filter((l) => l.publishable).map((l) => l.code),
    blocked: reviews.filter((l) => !l.publishable).map((l) => l.code),
  };
}

export interface CostReport {
  stage: Stage;
  model: string;
  batchId: string;
  requests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  actualUsd: number;
  actualEur: number;
  estimatedEur: number;
  ceilingEur: number;
  usdToEur: number;
}

export function costReport(stage: Stage, estimate: StageEstimate, batchId: string, outcome: StageOutcome<unknown>, requests: number): CostReport {
  const usd = actualCostUsd(estimate.model, outcome.usages);
  return {
    stage, model: estimate.model, batchId, requests, failedRequests: outcome.failures.length,
    inputTokens: outcome.usages.reduce((n, u) => n + u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), 0),
    outputTokens: outcome.usages.reduce((n, u) => n + u.output_tokens, 0),
    actualUsd: Number(usd.toFixed(4)), actualEur: Number((usd * estimate.usdToEur).toFixed(4)),
    estimatedEur: Number(estimate.expectedEur.toFixed(4)), ceilingEur: Number(estimate.ceilingEur.toFixed(4)), usdToEur: estimate.usdToEur,
  };
}

export { PART_NUMBER };

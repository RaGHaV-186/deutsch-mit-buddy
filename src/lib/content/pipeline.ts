import { createHash } from "node:crypto";
import type { CurriculumRow } from "./curriculum-rows.ts";
import { applyFix, enumerateItems, valueOf, type LessonItem, type UnitName } from "./lesson-items.ts";
import { lessonErrors, lintLesson, type LintIssue } from "./lesson-lint.ts";
import {
  PART_NUMBER,
  PARTS,
  PASS_A_JSON_SCHEMA,
  PASS_B_JSON_SCHEMA,
  PASS_C_JSON_SCHEMA,
  PASS_D_JSON_SCHEMA,
  REVIEW_JSON_SCHEMA,
  lessonSchema,
  passASchema,
  passBSchema,
  passCSchema,
  passDSchema,
  reviewResultSchema,
  wireToDomain,
  type Lesson,
  type PartName,
  type PassA,
  type PassB,
  type PassC,
  type PassD,
  type ReviewVerdict,
} from "./lesson-schema.ts";
import { actualCostUsd, assertWithinCap, estimateRun, estimateTokens, type RunEstimate, type RunMode, type Usage } from "./pricing.ts";
import {
  EXPECTED_OUTPUT,
  GENERATION_MODEL,
  earlierContext,
  PASS_A_MAX_TOKENS,
  PASS_A_SYSTEM,
  PASS_B_MAX_TOKENS,
  PASS_B_SYSTEM,
  PASS_C_MAX_TOKENS,
  PASS_C_SYSTEM,
  PASS_D_MAX_TOKENS,
  PASS_D_SYSTEM,
  REVIEW_MAX_TOKENS,
  REVIEW_MODEL,
  REVIEW_PARTIAL_MAX_TOKENS,
  REVIEW_SYSTEM,
  passAPrompt,
  passBPrompt,
  passCPrompt,
  passDPrompt,
  reviewPrompt,
} from "./prompts.ts";

// The pipeline for a lesson: Sonnet pass A (teach), pass B (reading, listening, writing, speaking), pass C (day exam), pass D (warm-up, culture, mission,
// close day; B, C and D see A), then an Opus review of every item. All of them are Batch API runs. The API client is injected, so everything here is testable with a fake.
// Relative imports only (the scripts run this file with plain Node).

export type Stage = "generate-a" | "generate-b" | "generate-c" | "generate-d" | "review";

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

/** `plan` is every lesson of the course in order: pass D and the review need the earlier sessions (the warm-up reviews them). */
export const buildPassDRequests = (lessons: CurriculumRow[], passA: Map<string, PassA>, plan: readonly CurriculumRow[]): BatchRequest[] =>
  lessons.flatMap((l) => {
    const a = passA.get(l.code);
    const earlier = earlierContext(l, plan, (code) => wordsOf(passA.get(code)));
    return a ? [request("generate-d", l.code, GENERATION_MODEL, PASS_D_MAX_TOKENS, PASS_D_SYSTEM, passDPrompt(l, a, earlier), PASS_D_JSON_SCHEMA)] : [];
  });

const wordsOf = (lesson: { vocabulary: { words: { article: string | null; de: string }[] } } | undefined) => lesson?.vocabulary.words.map((c) => `${c.article ? c.article + " " : ""}${c.de}`);

/** `only` (lesson code -> item ids) limits the review to those items: the re-review of manual corrections. Lessons without an entry are skipped then. */
export const buildReviewRequests = (lessons: CurriculumRow[], contents: Map<string, Lesson>, plan: readonly CurriculumRow[], only?: Map<string, string[]>): BatchRequest[] =>
  lessons.flatMap((l) => {
    const c = contents.get(l.code);
    const ids = only?.get(l.code);
    if (!c || (only && !ids?.length)) return [];
    const earlier = earlierContext(l, plan, (code) => wordsOf(contents.get(code)));
    return [request("review", l.code, REVIEW_MODEL, only ? REVIEW_PARTIAL_MAX_TOKENS : REVIEW_MAX_TOKENS, REVIEW_SYSTEM, reviewPrompt(l, c, lintLesson(l.code, l.phase, c, { first: l.seq === 0 }), earlier, ids), REVIEW_JSON_SCHEMA)];
  });

/** The free check that runs before any Opus money is spent: the lessons whose automatic checks find an error. */
export function lintErrors(lessons: CurriculumRow[], contents: Map<string, Lesson>): { code: string; issues: LintIssue[] }[] {
  return lessons.flatMap((l) => {
    const c = contents.get(l.code);
    const issues = c ? lintLesson(l.code, l.phase, c, { first: l.seq === 0 }).filter((i) => i.level === "error") : [];
    return issues.length ? [{ code: l.code, issues }] : [];
  });
}

// ---- Cost estimate (shown before every paid run, and what an approval is bound to)
export interface StageEstimate extends RunEstimate {
  stage: Stage;
  /** Fingerprint of the exact requests (plus "-direct" for a direct run, which costs twice as much). An approval of this id is an approval of these requests, paid this way, and no others. */
  id: string;
  mode: RunMode;
}

export const fingerprint = (requests: BatchRequest[]) => createHash("sha256").update(JSON.stringify(requests)).digest("hex").slice(0, 16);

export function estimateStage(stage: Stage, requests: BatchRequest[], opts: { rate?: number; exactInputTokens?: number[]; expectedOutput?: number; mode?: RunMode } = {}): StageEstimate {
  const first = requests[0]?.params;
  if (!first) throw new Error("Nothing to estimate: no requests.");
  // A JSON Schema costs input tokens too (about 1 token per 1.3 characters, measured with a real request); the token counter does not include it.
  const schemaTokens = (r: BatchRequest) => Math.ceil(JSON.stringify(r.params.output_config.format.schema).length / 1.3);
  const inputTokensPerRequest = opts.exactInputTokens
    ? opts.exactInputTokens.map((n, i) => n + schemaTokens(requests[i]))
    : requests.map((r) => estimateTokens(r.params.system + r.params.messages.map((m) => m.content).join("")) + schemaTokens(r));
  const estimate = estimateRun({ model: first.model, inputTokensPerRequest, expectedOutputPerRequest: opts.expectedOutput ?? EXPECTED_OUTPUT[stage], maxTokens: first.max_tokens, rate: opts.rate, mode: opts.mode });
  const mode = opts.mode ?? "batch";
  return { ...estimate, stage, mode, id: fingerprint(requests) + (mode === "direct" ? "-direct" : "") };
}

/** Throws unless `approvedId` matches these exact requests and the worst case stays under the cap. */
export function assertApproved(requests: BatchRequest[], approvedId: string | undefined, estimate: StageEstimate) {
  if (!approvedId) throw new Error("This run is paid. Show the estimate first and pass --approve <estimate id> once it has been approved.");
  // The id is the fingerprint of the requests plus how they are paid ("-direct" costs twice as much): an approval matches both, and the estimate must be for these requests.
  const expected = fingerprint(requests) + (estimate.mode === "direct" ? "-direct" : "");
  if (approvedId !== expected || estimate.id !== expected) throw new Error(`The approved estimate (${approvedId}) is not for these requests, paid this way (${expected}). Run the estimate again.`);
  assertWithinCap(estimate);
}

// ---- Running a batch (resumable: a restarted run polls the batch it already paid for instead of submitting again)
export interface RunOptions {
  batchId?: string;
  onSubmitted: (batchId: string) => Promise<void> | void;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Submit (or look at an already submitted batch once) and return without waiting: `pending` is then true unless the batch has ended. */
  submitOnly?: boolean;
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
    if (opts.submitOnly) return { batchId, lines: [] as BatchResultLine[], pending: true };
    await sleep(opts.pollMs ?? 30_000);
  }
  const lines: BatchResultLine[] = [];
  for await (const line of await client.messages.batches.results(batchId)) lines.push(line);
  return { batchId, lines, pending: false };
}

/**
 * The direct way: one ordinary (streamed) Messages API call per request, at list price, instead of a Batch. For when a batch is stuck or the
 * answer is needed now. Every finished answer is handed to `store` at once and `done` gives back the ones stored earlier, so a crash or a
 * second run never pays for the same request twice. Requests run `concurrency` at a time; a failed request becomes an "errored" line.
 */
export interface DirectClient {
  messages: { stream(body: BatchRequest["params"]): { finalMessage(): Promise<{ content: { type: string; text?: string }[]; stop_reason: string | null; usage: Usage }> } };
}
export async function runDirect(
  client: DirectClient,
  requests: BatchRequest[],
  opts: { done?: Map<string, BatchResultLine>; store?: (line: BatchResultLine) => void; concurrency?: number; log?: (m: string) => void } = {},
): Promise<BatchResultLine[]> {
  const log = opts.log ?? (() => {});
  const lines = new Map<string, BatchResultLine>(opts.done ?? []);
  const todo = requests.filter((r) => !lines.has(r.custom_id));
  if (lines.size) log(`${lines.size} answer(s) from an earlier run are reused (not paid again).`);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const r = todo[next++];
      if (!r) return;
      let line: BatchResultLine;
      try {
        const message = await client.messages.stream(r.params).finalMessage();
        line = { custom_id: r.custom_id, result: { type: "succeeded", message } };
        log(`${r.custom_id}: done`);
      } catch (error) {
        line = { custom_id: r.custom_id, result: { type: "errored", error: { message: (error as Error).message } } };
        log(`${r.custom_id}: failed (${(error as Error).message.slice(0, 120)})`);
      }
      lines.set(r.custom_id, line);
      if (line.result.type === "succeeded") opts.store?.(line);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 3, todo.length)) }, worker));
  return requests.map((r) => lines.get(r.custom_id)!).filter(Boolean);
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
export const parsePassD = (lessons: CurriculumRow[], lines: BatchResultLine[]) => parseStage("generate-d", lessons, lines, (v) => passDSchema.safeParse(wireToDomain(v)));

/** The whole lesson: the four passes together, validated as one. */
export function combineLesson(a: PassA, b: PassB, c: PassC, d: PassD): Lesson {
  return lessonSchema.parse({ ...a, ...b, ...c, ...d });
}

export const itemIdsOf = (code: string, lesson: Lesson) => enumerateItems(code, lesson).map((i) => i.id);

/** `only` (lesson code -> item ids): the answer to a partial review, which holds a verdict for exactly those items. */
export function parseReview(lessons: CurriculumRow[], contents: Map<string, Lesson>, lines: BatchResultLine[], only?: Map<string, string[]>): StageOutcome<ReviewVerdict[]> {
  const reviewable = lessons.filter((l) => contents.has(l.code));
  const raw = parseStage("review", reviewable, lines, (v) => reviewResultSchema.safeParse(v));
  const out: StageOutcome<ReviewVerdict[]> = { results: new Map(), failures: raw.failures, usages: raw.usages };
  for (const [code, parsed] of raw.results) {
    // Exactly one verdict per item. A missing verdict is never an "ok": it waits for a human.
    const first = new Map<string, ReviewVerdict>();
    for (const v of parsed.verdicts) if (!first.has(v.id)) first.set(v.id, v);
    out.results.set(
      code,
      itemIdsOf(code, contents.get(code)!).filter((id) => !only || only.get(code)?.includes(id)).map((id) => first.get(id) ?? { id, status: "needs-human" as const, reason: "The reviewer returned no verdict for this item.", fixed_json: null }),
    );
  }
  return out;
}

// ---- Manual corrections
// The course owner can correct single items after a review (manual-fixes.json in the run folder: item id -> new content + why). A correction is applied on top of
// what the writers produced, and the old verdict of that item no longer counts: the item waits for a re-review of just the corrected items.
export interface ManualFix {
  value: unknown;
  reason: string;
}
export type ManualFixes = Record<string, ManualFix>;

/** The ids of the corrected items of one lesson. */
export const manualFixIds = (code: string, fixes: ManualFixes) => Object.keys(fixes).filter((id) => id.startsWith(`${code}#`));

/** The lesson with the corrections of its items applied. Throws when a correction names no item or does not fit the item's format. */
export function applyManualFixes(code: string, lesson: Lesson, fixes: ManualFixes): Lesson {
  const items = new Map(enumerateItems(code, lesson).map((i) => [i.id, i]));
  let current = lesson;
  for (const id of manualFixIds(code, fixes)) {
    const item = items.get(id);
    if (!item) throw new Error(`Manual fix for ${id}: the lesson has no such item.`);
    const applied = applyFix(current, item, JSON.stringify(fixes[id].value));
    if (!applied) throw new Error(`Manual fix for ${id} does not fit the format of that item.`);
    current = applied.lesson;
  }
  return current;
}

/** The verdicts that count: the first review's, except for corrected items, whose only valid verdict is the one from the re-review (none yet = waits for a human). */
export function currentVerdicts(code: string, first: ReviewVerdict[] | undefined, rereviewed: ReviewVerdict[] | undefined, fixes: ManualFixes): ReviewVerdict[] | undefined {
  if (!first) return undefined;
  const corrected = new Set(manualFixIds(code, fixes));
  return [...first.filter((v) => !corrected.has(v.id)), ...(rereviewed ?? []).filter((v) => corrected.has(v.id))];
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
  const first = lesson.seq === 0;
  const verdictOf = new Map(verdicts.map((v) => [v.id, v]));
  const initialLint = lintLesson(code, phase, content, { first });
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
        const remaining = lintLesson(code, phase, applied.lesson, { first }).filter((l) => l.id === item.id && l.level === "error");
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

  // A correction of one item can break another (for example an exam item that now repeats an exercise): the finished lesson is checked once more.
  const finalErrors = lintLesson(code, phase, current, { first }).filter((l) => l.level === "error" && l.id !== "lesson");
  for (const err of finalErrors) {
    const i = items.findIndex((x) => x.id === err.id && x.status !== "needs-human");
    if (i >= 0) items[i] = { ...items[i], status: "needs-human", reason: `After the corrections an automatic check fails: ${err.message}`, final: null };
  }
  const lessonIssues = lessonErrors(lintLesson(code, phase, current, { first })).map((l) => l.message);
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
    list.forEach((q, i) => questions.push({ session_code: review.code, part, position: i + 1, skill: q.skill, type: q.type, prompt: q.prompt, answer: q.answer, distractors: q.distractors, accepted_answers: q.accepted_answers, explanation: q.explanation }));
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
  const usd = actualCostUsd(estimate.model, outcome.usages, estimate.mode);
  return {
    stage, model: estimate.model, batchId, requests, failedRequests: outcome.failures.length,
    inputTokens: outcome.usages.reduce((n, u) => n + u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), 0),
    outputTokens: outcome.usages.reduce((n, u) => n + u.output_tokens, 0),
    actualUsd: Number(usd.toFixed(4)), actualEur: Number((usd * estimate.usdToEur).toFixed(4)),
    estimatedEur: Number(estimate.expectedEur.toFixed(4)), ceilingEur: Number(estimate.ceilingEur.toFixed(4)), usdToEur: estimate.usdToEur,
  };
}

export { PART_NUMBER };

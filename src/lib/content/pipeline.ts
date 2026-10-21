import { createHash } from "node:crypto";
import type { CurriculumRow } from "./curriculum-rows.ts";
import { lintLesson, errorIds, type LintIssue } from "./lint.ts";
import { assertWithinCap, estimateRun, estimateTokens, actualCostUsd, type RunEstimate, type Usage } from "./pricing.ts";
import {
  GENERATION_EXPECTED_OUTPUT,
  GENERATION_MAX_TOKENS,
  GENERATION_MODEL,
  GENERATION_SYSTEM,
  generationPrompt,
  REVIEW_EXPECTED_OUTPUT,
  REVIEW_MAX_TOKENS,
  REVIEW_MODEL,
  REVIEW_SYSTEM,
  reviewPrompt,
} from "./prompts.ts";
import {
  cardId,
  GENERATION_JSON_SCHEMA,
  generatedCardSchema,
  generatedQuestionSchema,
  isCardId,
  lessonContentSchema,
  questionId,
  REVIEW_JSON_SCHEMA,
  reviewResultSchema,
  type GeneratedCard,
  type GeneratedQuestion,
  type LessonContent,
  type Verdict,
} from "./schema.ts";

// The two-pass pipeline: Sonnet writes a lesson (Batch API), Opus checks every card and question (Batch API).
// The API client is injected, so everything here is testable with a fake. Relative imports only (runs under plain Node).

export type Stage = "generate" | "review";

// ---- Minimal shapes of the Batch API (the real SDK client is assignable to these).
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

export function buildGenerationRequests(lessons: CurriculumRow[]): BatchRequest[] {
  return lessons.map((lesson) => ({
    custom_id: customId("generate", lesson.code),
    params: {
      model: GENERATION_MODEL,
      max_tokens: GENERATION_MAX_TOKENS,
      system: GENERATION_SYSTEM,
      messages: [{ role: "user", content: generationPrompt(lesson) }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: GENERATION_JSON_SCHEMA } },
    },
  }));
}

export function buildReviewRequests(lessons: CurriculumRow[], contents: Map<string, LessonContent>): BatchRequest[] {
  return lessons.flatMap((lesson) => {
    const content = contents.get(lesson.code);
    if (!content) return [];
    return [
      {
        custom_id: customId("review", lesson.code),
        params: {
          model: REVIEW_MODEL,
          max_tokens: REVIEW_MAX_TOKENS,
          system: REVIEW_SYSTEM,
          messages: [{ role: "user" as const, content: reviewPrompt(lesson, content, lintLesson(lesson.code, content)) }],
          output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema: REVIEW_JSON_SCHEMA } },
        },
      },
    ];
  });
}

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
  const inputTokensPerRequest =
    opts.exactInputTokens ??
    requests.map((r) => estimateTokens(r.params.system + r.params.messages.map((m) => m.content).join("") + JSON.stringify(r.params.output_config.format.schema)));
  const estimate = estimateRun({
    model: first.model,
    inputTokensPerRequest,
    expectedOutputPerRequest: stage === "generate" ? GENERATION_EXPECTED_OUTPUT : REVIEW_EXPECTED_OUTPUT,
    maxTokens: first.max_tokens,
    rate: opts.rate,
  });
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
  /** Set when a batch for this stage was already submitted. */
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
  const text = message.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  return { text, usage: message.usage };
}

function parseJson<T>(text: string | undefined, parse: (v: unknown) => { success: true; data: T } | { success: false; error: { message: string } }) {
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

export function parseGeneration(lessons: CurriculumRow[], lines: BatchResultLine[]): StageOutcome<LessonContent> {
  const byId = new Map(lines.map((l) => [l.custom_id, l]));
  const out: StageOutcome<LessonContent> = { results: new Map(), failures: [], usages: [] };
  for (const lesson of lessons) {
    const line = byId.get(customId("generate", lesson.code));
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
    const parsed = parseJson(reply.text, (v) => lessonContentSchema.safeParse(v));
    if ("problem" in parsed) out.failures.push({ code: lesson.code, reason: parsed.problem! });
    else out.results.set(lesson.code, parsed.data);
  }
  return out;
}

export function itemIds(code: string, content: LessonContent): string[] {
  return [...content.cards.map((_, i) => cardId(code, i)), ...content.questions.map((_, i) => questionId(code, i))];
}

export function parseReview(lessons: CurriculumRow[], contents: Map<string, LessonContent>, lines: BatchResultLine[]): StageOutcome<Verdict[]> {
  const byId = new Map(lines.map((l) => [l.custom_id, l]));
  const out: StageOutcome<Verdict[]> = { results: new Map(), failures: [], usages: [] };
  for (const lesson of lessons) {
    const content = contents.get(lesson.code);
    if (!content) continue;
    const line = byId.get(customId("review", lesson.code));
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
    const parsed = parseJson(reply.text, (v) => reviewResultSchema.safeParse(v));
    if ("problem" in parsed) {
      out.failures.push({ code: lesson.code, reason: parsed.problem! });
      continue;
    }
    // Exactly one verdict per item. A missing verdict is never an "ok": it waits for a human.
    const first = new Map<string, Verdict>();
    for (const v of parsed.data.verdicts) if (!first.has(v.id)) first.set(v.id, v);
    out.results.set(
      lesson.code,
      itemIds(lesson.code, content).map(
        (id) => first.get(id) ?? { id, status: "needs-human" as const, reason: "The reviewer returned no verdict for this item.", fixed_card: null, fixed_question: null },
      ),
    );
  }
  return out;
}

// ---- Merging the two passes
export type ItemStatus = "ok" | "fixed" | "needs-human";

export interface ReviewItem {
  id: string;
  lesson: string;
  kind: "card" | "question";
  status: ItemStatus;
  reason: string;
  /** What Sonnet wrote. */
  original: GeneratedCard | GeneratedQuestion;
  /** What gets inserted: the original for "ok", the corrected item for "fixed", nothing for "needs-human". */
  final: GeneratedCard | GeneratedQuestion | null;
  /** Automatic checks that fired on this item. */
  lint: string[];
}

export interface LessonReview {
  code: string;
  /** Problems with the lesson as a whole (for example a wrong number of cards). */
  lessonIssues: string[];
  items: ReviewItem[];
}

export function mergeLesson(code: string, content: LessonContent, verdicts: Verdict[]): LessonReview {
  const lint = lintLesson(code, content);
  const byItem = (id: string) => lint.filter((l) => l.id === id);
  const verdictOf = new Map(verdicts.map((v) => [v.id, v]));
  const items: ReviewItem[] = [];

  const settle = <T extends GeneratedCard | GeneratedQuestion>(id: string, kind: "card" | "question", original: T, issuesFor: (item: T) => LintIssue[], pick: (v: Verdict) => T | null, keep: (fixed: T) => T): ReviewItem => {
    const v = verdictOf.get(id);
    const base = { id, lesson: code, kind, original, lint: byItem(id).map((l) => l.message) };
    if (!v) return { ...base, status: "needs-human", reason: "No verdict for this item.", final: null };
    if (v.status === "needs-human") return { ...base, status: "needs-human", reason: v.reason, final: null };
    if (v.status === "fixed") {
      const fixed = pick(v);
      if (!fixed) return { ...base, status: "needs-human", reason: `Marked fixed but no corrected item came with it. (${v.reason})`, final: null };
      const kept = keep(fixed);
      const bad = issuesFor(kept).filter((i) => i.level === "error");
      if (bad.length) return { ...base, status: "needs-human", reason: `The correction still fails an automatic check (${bad[0].message}) (${v.reason})`, final: null };
      return { ...base, status: "fixed", reason: v.reason, final: kept };
    }
    // "ok": believed only when the mechanical checks agree.
    if (errorIds(byItem(id)).has(id)) return { ...base, status: "needs-human", reason: `The reviewer said ok, but an automatic check failed: ${byItem(id).find((l) => l.level === "error")!.message}`, final: null };
    return { ...base, status: "ok", reason: v.reason, final: original };
  };

  content.cards.forEach((card, i) => {
    const id = cardId(code, i);
    items.push(
      settle(id, "card", card, (c) => lintLesson(code, { cards: [c], questions: content.questions }).filter((l) => l.id === cardId(code, 0)), (v) => v.fixed_card, (f) => ({ ...f, tier: card.tier })),
    );
  });
  content.questions.forEach((q, i) => {
    const id = questionId(code, i);
    items.push(
      settle(id, "question", q, (x) => lintLesson(code, { cards: content.cards, questions: [x] }).filter((l) => l.id === questionId(code, 0)), (v) => v.fixed_question, (f) => ({ ...f, skill: q.skill, type: q.type })),
    );
  });
  const lessonIssues = lint.filter((l) => l.id === "lesson").map((l) => l.message);
  return { code, lessonIssues, items };
}

// ---- Output files
export interface ApprovedRows {
  cards: Record<string, unknown>[];
  questions: Record<string, unknown>[];
}

/** Only "ok" and "fixed" items are inserted; "needs-human" items wait. */
export function approvedRows(reviews: LessonReview[]): ApprovedRows {
  const cards: Record<string, unknown>[] = [];
  const questions: Record<string, unknown>[] = [];
  for (const lesson of reviews) {
    let position = 0;
    for (const item of lesson.items) {
      if (!item.final) continue;
      if (item.kind === "card") {
        const c = generatedCardSchema.parse(item.final);
        position += 1;
        cards.push({ session_code: lesson.code, kind: "word", tier: c.tier, position, en: c.en, article: c.article, de: c.de, plural: c.plural, example: c.example, example_en: c.example_en, tip: c.tip });
      } else {
        const q = generatedQuestionSchema.parse(item.final);
        questions.push({ session_code: lesson.code, skill: q.skill, type: q.type, prompt: q.prompt, answer: q.answer, distractors: q.distractors, explanation: q.explanation });
      }
    }
  }
  return { cards, questions };
}

export function summarize(reviews: LessonReview[]) {
  const count = (status: ItemStatus) => reviews.reduce((n, l) => n + l.items.filter((i) => i.status === status).length, 0);
  return {
    lessons: reviews.length,
    items: reviews.reduce((n, l) => n + l.items.length, 0),
    ok: count("ok"),
    fixed: count("fixed"),
    needsHuman: count("needs-human"),
    lessonsWithIssues: reviews.filter((l) => l.lessonIssues.length > 0).map((l) => l.code),
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
  /** Actual cost at Batch API prices. */
  actualUsd: number;
  actualEur: number;
  estimatedEur: number;
  ceilingEur: number;
  usdToEur: number;
}

export function costReport(stage: Stage, estimate: StageEstimate, batchId: string, outcome: StageOutcome<unknown>, requests: number): CostReport {
  const usd = actualCostUsd(estimate.model, outcome.usages);
  return {
    stage,
    model: estimate.model,
    batchId,
    requests,
    failedRequests: outcome.failures.length,
    inputTokens: outcome.usages.reduce((n, u) => n + u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), 0),
    outputTokens: outcome.usages.reduce((n, u) => n + u.output_tokens, 0),
    actualUsd: Number(usd.toFixed(4)),
    actualEur: Number((usd * estimate.usdToEur).toFixed(4)),
    estimatedEur: Number(estimate.expectedEur.toFixed(4)),
    ceilingEur: Number(estimate.ceilingEur.toFixed(4)),
    usdToEur: estimate.usdToEur,
  };
}

export { isCardId };

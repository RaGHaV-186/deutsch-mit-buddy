// Prices, token estimates and the spending cap for the generation runs. Prices are USD per million tokens
// (standard rates, checked 2026-10-21); the Batch API halves them.

export interface ModelPrice {
  input: number;
  output: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
export const BATCH_DISCOUNT = 0.5;

/** One paid run (a sample, or one full pass) may never be able to cost more than this. */
export const HARD_CAP_EUR = 10;
/** Dollars to euros. Deliberately on the high side so estimates err towards too expensive; override with USD_TO_EUR. */
export const DEFAULT_USD_TO_EUR = 0.95;

export const usdToEur = (usd: number, rate = DEFAULT_USD_TO_EUR) => usd * rate;

/** German text and JSON tokenize at roughly 3 characters per token; this errs on the high side. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3);

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function priceFor(model: string): ModelPrice {
  const price = PRICES[model];
  if (!price) throw new Error(`No price known for model ${model}`);
  return price;
}

/** How a request is paid: in a Batch (half price, but it can take hours) or directly through the Messages API (list price, answers at once). */
export type RunMode = "batch" | "direct";

/** Cost in USD of the given token counts. */
export function costUsd(model: string, inputTokens: number, outputTokens: number, mode: RunMode = "batch"): number {
  const p = priceFor(model);
  return ((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * (mode === "batch" ? BATCH_DISCOUNT : 1);
}

/** Cost in USD of the given token counts through the Batch API. */
export const batchCostUsd = (model: string, inputTokens: number, outputTokens: number) => costUsd(model, inputTokens, outputTokens, "batch");

export function actualCostUsd(model: string, usages: Usage[], mode: RunMode = "batch"): number {
  // Cache tokens are billed at different rates; these runs don't use caching, so any that show up are counted as input (a safe over-count).
  const input = usages.reduce((n, u) => n + u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), 0);
  const output = usages.reduce((n, u) => n + u.output_tokens, 0);
  return costUsd(model, input, output, mode);
}

export interface RunEstimate {
  model: string;
  requests: number;
  inputTokens: number;
  expectedOutputTokens: number;
  /** The most the run can output: every request using its whole max_tokens. */
  ceilingOutputTokens: number;
  expectedUsd: number;
  ceilingUsd: number;
  expectedEur: number;
  ceilingEur: number;
  usdToEur: number;
}

export function estimateRun(opts: {
  model: string;
  inputTokensPerRequest: number[];
  expectedOutputPerRequest: number;
  maxTokens: number;
  rate?: number;
  mode?: RunMode;
}): RunEstimate {
  const rate = opts.rate ?? DEFAULT_USD_TO_EUR;
  const requests = opts.inputTokensPerRequest.length;
  const inputTokens = opts.inputTokensPerRequest.reduce((a, b) => a + b, 0);
  const expectedOutputTokens = requests * opts.expectedOutputPerRequest;
  const ceilingOutputTokens = requests * opts.maxTokens;
  const mode = opts.mode ?? "batch";
  const expectedUsd = costUsd(opts.model, inputTokens, expectedOutputTokens, mode);
  const ceilingUsd = costUsd(opts.model, inputTokens, ceilingOutputTokens, mode);
  return {
    model: opts.model,
    requests,
    inputTokens,
    expectedOutputTokens,
    ceilingOutputTokens,
    expectedUsd,
    ceilingUsd,
    expectedEur: usdToEur(expectedUsd, rate),
    ceilingEur: usdToEur(ceilingUsd, rate),
    usdToEur: rate,
  };
}

/** Refuses a run whose worst case could cost more than the cap. */
export function assertWithinCap(estimate: RunEstimate, capEur = HARD_CAP_EUR) {
  if (estimate.ceilingEur > capEur) {
    throw new Error(
      `Hard stop: this run could cost up to €${estimate.ceilingEur.toFixed(2)} (more than the €${capEur} cap). ` +
        "Run fewer lessons, or lower the max tokens.",
    );
  }
}

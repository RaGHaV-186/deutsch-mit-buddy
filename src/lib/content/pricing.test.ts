import { describe, expect, it } from "vitest";
import { actualCostUsd, assertWithinCap, batchCostUsd, estimateRun, estimateTokens, HARD_CAP_EUR, priceFor } from "./pricing.ts";

describe("pricing", () => {
  it("uses the current list prices and halves them for the Batch API", () => {
    expect(priceFor("claude-sonnet-5-5")).toEqual({ input: 2, output: 10 });
    expect(priceFor("claude-opus-5-5")).toEqual({ input: 4, output: 20 });
    // 1M input + 1M output on Sonnet: ($2 + $10) / 2
    expect(batchCostUsd("claude-sonnet-5-5", 1_000_000, 1_000_000)).toBeCloseTo(6);
    expect(batchCostUsd("claude-opus-5-5", 1_000_000, 1_000_000)).toBeCloseTo(12);
  });

  it("refuses a model it has no price for", () => {
    expect(() => priceFor("claude-unknown")).toThrow(/No price/);
  });

  it("estimates tokens on the high side", () => {
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("x".repeat(300))).toBe(100);
  });

  it("a run has an expected cost and a ceiling that assumes every request uses its whole max_tokens", () => {
    const e = estimateRun({ model: "claude-sonnet-5-5", inputTokensPerRequest: [2000, 2000, 2000], expectedOutputPerRequest: 4500, maxTokens: 10_000, rate: 1 });
    expect(e.requests).toBe(3);
    expect(e.inputTokens).toBe(6000);
    expect(e.expectedUsd).toBeCloseTo((6000 * 2 + 13_500 * 10) / 1e6 / 2, 6);
    expect(e.ceilingUsd).toBeCloseTo((6000 * 2 + 30_000 * 10) / 1e6 / 2, 6);
    expect(e.ceilingUsd).toBeGreaterThan(e.expectedUsd);
    expect(e.ceilingEur).toBeCloseTo(e.ceilingUsd); // rate 1
  });

  it("converts to euros with the (high) default rate", () => {
    const e = estimateRun({ model: "claude-sonnet-5-5", inputTokensPerRequest: [1000], expectedOutputPerRequest: 1000, maxTokens: 1000 });
    expect(e.usdToEur).toBeGreaterThan(0.9);
    expect(e.expectedEur).toBeCloseTo(e.expectedUsd * e.usdToEur);
  });

  it("hard stop: a run whose worst case exceeds €10 is refused, one under it is not", () => {
    expect(HARD_CAP_EUR).toBe(10);
    const big = estimateRun({ model: "claude-opus-5-5", inputTokensPerRequest: Array(400).fill(5000), expectedOutputPerRequest: 4000, maxTokens: 10_000, rate: 1 });
    expect(() => assertWithinCap(big)).toThrow(/Hard stop.*€/);
    const small = estimateRun({ model: "claude-opus-5-5", inputTokensPerRequest: Array(3).fill(5000), expectedOutputPerRequest: 4000, maxTokens: 10_000, rate: 1 });
    expect(() => assertWithinCap(small)).not.toThrow();
  });

  it("the actual cost sums what each request really used (cache tokens counted as input)", () => {
    const cost = actualCostUsd("claude-sonnet-5-5", [
      { input_tokens: 1000, output_tokens: 2000 },
      { input_tokens: 500, output_tokens: 1000, cache_read_input_tokens: 500 },
    ]);
    expect(cost).toBeCloseTo((2000 * 2 + 3000 * 10) / 1e6 / 2, 8);
  });
});

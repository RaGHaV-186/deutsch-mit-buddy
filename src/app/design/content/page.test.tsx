import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeLesson, itemIds } from "@/lib/content/pipeline";
import { generatedCardSchema, type Verdict } from "@/lib/content/schema";
import { validContent } from "@/lib/content/test-fixtures";
import type { RunView } from "@/lib/content/preview";

const content = validContent();
const ids = itemIds("Z1", content);
const fixedCard = generatedCardSchema.parse({ ...content.cards[0], example: "Ich trinke gern Kaffee." });
const verdicts: Verdict[] = ids.map((id, i) => ({
  id,
  status: i === 0 ? "fixed" : i === 1 ? "needs-human" : "ok",
  reason: i === 0 ? "Example was awkward" : i === 1 ? "Doubtful level" : "fine",
  fixed_card: i === 0 ? fixedCard : null,
  fixed_question: null,
}));
const lesson = mergeLesson("Z1", content, verdicts);
const run: RunView = {
  name: "sample-z1-z3",
  generated: { Z1: content },
  review: { run: "sample-z1-z3", builtAt: "2026-10-21T10:00:00Z", summary: { lessons: 1, items: 27, ok: 25, fixed: 1, needsHuman: 1, lessonsWithIssues: [] }, unreviewedLessons: [], generationFailures: [], reviewFailures: [], lessons: [lesson] },
  reports: { generate: null, review: null },
};

vi.mock("@/lib/content/preview", () => ({ loadRun: (n: string) => (n === "sample-z1-z3" ? run : null), listRuns: () => ["sample-z1-z3"] }));

import ContentPreviewPage from "./page";

afterEach(() => vi.unstubAllEnvs());
const open = async (params: Record<string, string> = {}) => render(await ContentPreviewPage({ searchParams: Promise.resolve(params) }));

describe("/design/content", () => {
  it("is hidden in production unless SHOW_DESIGN_PAGE=1", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOW_DESIGN_PAGE", "");
    await expect(ContentPreviewPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });

  it("shows the totals and every item with its verdict and reason", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3" });
    expect(screen.getByText("27 items in 1 lessons")).toBeInTheDocument();
    expect(screen.getByText("25 ok")).toBeInTheDocument();
    expect(screen.getByText("1 need a human")).toBeInTheDocument();
    expect(screen.getByText(/Doubtful level/)).toBeInTheDocument();
    expect(screen.getAllByText("Kaffee").length).toBeGreaterThan(0);
  });

  it("a fixed item shows before and after, so the change can be judged", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3" });
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After (inserted)")).toBeInTheDocument();
    expect(screen.getByText("Ich trinke gern Kaffee.")).toBeInTheDocument();
  });

  it("can show only what needs a human", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "sample-z1-z3", show: "needs-human" });
    expect(screen.getAllByText(/needs human/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("Before")).toBeNull();
    expect(screen.queryByText(/Z1#c03/)).toBeNull();
  });

  it("an unknown run says so instead of failing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await open({ run: "does-not-exist" });
    expect(screen.getByText(/No run found/)).toBeInTheDocument();
  });
});

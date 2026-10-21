import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleWord, AlertIcon, CheckIcon, Cushion, InfoIcon } from "@/components/ds";
import { loadRun, listRuns } from "@/lib/content/preview";
import type { ReviewItem } from "@/lib/content/pipeline";
import type { GeneratedCard, GeneratedQuestion } from "@/lib/content/schema";

// Dev tool: look through the cards and questions of a generation run before they are inserted.
// Hidden in production unless SHOW_DESIGN_PAGE=1 (like /design); the route is behind login either way.
export const metadata: Metadata = { title: "Content review", robots: { index: false, follow: false } };

const STATUS = {
  ok: { label: "ok", color: "text-das", Icon: CheckIcon },
  fixed: { label: "fixed", color: "text-progress", Icon: InfoIcon },
  "needs-human": { label: "needs human", color: "text-die", Icon: AlertIcon },
} as const;

function Status({ item }: { item: Pick<ReviewItem, "status" | "reason"> }) {
  const s = STATUS[item.status];
  return (
    <p className={`flex items-start gap-1.5 text-caption ${s.color}`}>
      <s.Icon size={16} className="mt-0.5 shrink-0" />
      <span>
        <b>{s.label}</b> <span className="text-muted">· {item.reason}</span>
      </span>
    </p>
  );
}

function CardView({ card }: { card: GeneratedCard }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-headline">
        <ArticleWord article={card.article} word={card.de} /> <span className="text-caption font-medium text-muted">{card.tier}</span>
      </p>
      {card.plural ? <p className="text-caption text-muted">{card.plural}</p> : null}
      <p className="font-bold">{card.en}</p>
      <p>{card.example}</p>
      <p className="text-caption text-muted">{card.example_en}</p>
      {card.tip ? <p className="text-caption text-muted">Tip: {card.tip}</p> : null}
    </div>
  );
}

function QuestionView({ q }: { q: GeneratedQuestion }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-caption text-muted">
        {q.skill} · {q.type.replace("_", " ")}
      </p>
      <p className="font-bold">{q.prompt}</p>
      <p>
        <span className="text-caption text-muted">Answer: </span>
        {q.answer}
      </p>
      {q.distractors.length ? (
        <p className="text-caption text-muted">Wrong options: {q.distractors.join(" · ")}</p>
      ) : null}
      <p className="text-caption text-muted">Why: {q.explanation}</p>
    </div>
  );
}

function ItemBox({ item }: { item: ReviewItem }) {
  const view = (x: GeneratedCard | GeneratedQuestion) => (item.kind === "card" ? <CardView card={x as GeneratedCard} /> : <QuestionView q={x as GeneratedQuestion} />);
  return (
    <Cushion className="flex flex-col gap-2 p-4" radius={24}>
      <p className="text-caption font-bold tabular text-muted">{item.id}</p>
      {item.status === "fixed" && item.final ? (
        <>
          <div className="rounded-2xl bg-track p-3 opacity-80">
            <p className="text-caption font-bold uppercase text-muted">Before</p>
            {view(item.original)}
          </div>
          <div>
            <p className="text-caption font-bold uppercase text-muted">After (inserted)</p>
            {view(item.final)}
          </div>
        </>
      ) : (
        view(item.original)
      )}
      <Status item={item} />
      {item.lint.length ? <p className="text-caption text-muted">Automatic check: {item.lint.join(" ")}</p> : null}
    </Cushion>
  );
}

export default async function ContentPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DESIGN_PAGE !== "1") notFound();
  const params = await searchParams;
  const runs = listRuns();
  const name = typeof params.run === "string" ? params.run : runs[0];
  const filter = params.show === "needs-human" || params.show === "fixed" ? params.show : "all";
  const run = name ? loadRun(name) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-display">Content review</h1>
        <p className="text-muted">Generated cards and questions with the Opus verdict on each. Only “ok” and “fixed” items are inserted. Dev tool, not part of the app.</p>
        <nav aria-label="Runs" className="flex flex-wrap gap-2 text-caption">
          {runs.map((r) => (
            <Link key={r} href={`/design/content?run=${r}`} className={`rounded-full px-3 py-1.5 font-bold ${r === name ? "bg-coat text-on-coat" : "bg-surface shadow-cushion"}`}>
              {r}
            </Link>
          ))}
        </nav>
      </header>

      {!run ? (
        <p className="text-muted">No run found. Generate one with <code>npm run content</code> (see docs/SETUP-CURRICULUM.md).</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            {run.review ? (
              <Cushion className="flex flex-col gap-1 p-4" radius={24}>
                <p className="text-headline">
                  {run.review.summary.items} items in {run.review.summary.lessons} lessons
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-das font-bold">{run.review.summary.ok} ok</span>
                  <span className="text-progress font-bold">{run.review.summary.fixed} fixed</span>
                  <span className="text-die font-bold">{run.review.summary.needsHuman} need a human</span>
                </p>
                {run.review.summary.lessonsWithIssues.length ? <p className="text-caption text-die">Lessons with problems: {run.review.summary.lessonsWithIssues.join(", ")}</p> : null}
                {[...run.review.generationFailures, ...run.review.reviewFailures].map((f) => (
                  <p key={f.code + f.reason} className="text-caption text-die">
                    {f.code}: {f.reason}
                  </p>
                ))}
                <nav aria-label="Filter" className="mt-2 flex gap-2 text-caption">
                  {(["all", "fixed", "needs-human"] as const).map((f) => (
                    <Link key={f} href={`/design/content?run=${run.name}&show=${f}`} className={`rounded-full px-3 py-1.5 font-bold ${filter === f ? "bg-coat text-on-coat" : "bg-track"}`}>
                      {f === "all" ? "Everything" : f === "fixed" ? "Fixed" : "Needs human"}
                    </Link>
                  ))}
                </nav>
              </Cushion>
            ) : (
              <p className="text-muted">Not reviewed yet: only the generated content exists.</p>
            )}
            <div className="flex flex-wrap gap-3 text-caption text-muted">
              {(["generate", "review"] as const).map((s) =>
                run.reports[s] ? (
                  <span key={s}>
                    {s}: {run.reports[s]!.model}, actual €{run.reports[s]!.actualEur.toFixed(3)} (estimated €{run.reports[s]!.estimatedEur.toFixed(2)})
                  </span>
                ) : null,
              )}
            </div>
          </section>

          {run.review?.lessons.map((lesson) => {
            const items = lesson.items.filter((i) => filter === "all" || i.status === filter);
            if (!items.length) return null;
            const cards = items.filter((i) => i.kind === "card");
            const questions = items.filter((i) => i.kind === "question");
            return (
              <section key={lesson.code} className="flex flex-col gap-3">
                <h2 className="text-title">{lesson.code}</h2>
                {lesson.lessonIssues.map((m) => (
                  <p key={m} className="text-caption text-die">
                    {m}
                  </p>
                ))}
                {cards.length ? <h3 className="text-headline">Cards</h3> : null}
                <div className="grid gap-3 md:grid-cols-2">{cards.map((i) => <ItemBox key={i.id} item={i} />)}</div>
                {questions.length ? <h3 className="text-headline">Questions</h3> : null}
                <div className="grid gap-3 md:grid-cols-2">{questions.map((i) => <ItemBox key={i.id} item={i} />)}</div>
              </section>
            );
          })}

          {!run.review && run.generated
            ? Object.entries(run.generated).map(([code, content]) => (
                <section key={code} className="flex flex-col gap-3">
                  <h2 className="text-title">{code}</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {content.cards.map((c, i) => (
                      <Cushion key={i} className="p-4" radius={24}>
                        <CardView card={c} />
                      </Cushion>
                    ))}
                  </div>
                </section>
              ))
            : null}
        </>
      )}
    </main>
  );
}

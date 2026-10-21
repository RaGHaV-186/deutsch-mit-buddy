import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertIcon, ArticleWord, CheckIcon, Cushion, InfoIcon } from "@/components/ds";
import { enumerateItems, valueOf, type LessonItem } from "@/lib/content/lesson-items";
import { PARTS, PART_NUMBER, type Lesson, type PartName } from "@/lib/content/lesson-schema";
import { PART_TITLES, unitLines } from "@/lib/content/lesson-text";
import { listRuns, loadRun, type RunView } from "@/lib/content/preview";
import type { LessonReview, ReviewItem } from "@/lib/content/pipeline";

// Dev tool: read through a generated lesson (all 14 parts) with the Opus verdict on every item before it is published.
// Hidden in production unless SHOW_DESIGN_PAGE=1 (like /design); the route is behind login either way.
export const metadata: Metadata = { title: "Content review", robots: { index: false, follow: false } };

const STATUS = {
  ok: { label: "ok", color: "text-das", Icon: CheckIcon },
  fixed: { label: "fixed", color: "text-progress", Icon: InfoIcon },
  "needs-human": { label: "needs human", color: "text-die", Icon: AlertIcon },
} as const;

function Status({ status, reason }: { status: ReviewItem["status"]; reason: string }) {
  const s = STATUS[status];
  return (
    <p className={`flex items-start gap-1.5 text-caption ${s.color}`}>
      <s.Icon size={16} className="mt-0.5 shrink-0" />
      <span>
        <b>{s.label}</b> <span className="text-muted">· {reason}</span>
      </span>
    </p>
  );
}

function Lines({ item, value }: { item: Pick<LessonItem, "unit">; value: unknown }) {
  const lines = unitLines(item.unit, value as Record<string, unknown>);
  if (item.unit === "card") {
    const c = value as { article: string | null; de: string };
    return (
      <div>
        <p className="text-headline">
          <ArticleWord article={c.article} word={c.de} />
        </p>
        {lines.slice(0, 1).map((l) => (
          <p key={l} className="text-caption text-muted">{l}</p>
        ))}
        <p className="whitespace-pre-wrap">{lines.slice(1).join("\n")}</p>
      </div>
    );
  }
  return <p className="whitespace-pre-wrap leading-snug">{lines.join("\n")}</p>;
}

function ItemBox({ item }: { item: ReviewItem }) {
  return (
    <Cushion className="flex flex-col gap-2 p-4" radius={24}>
      <p className="text-caption font-bold tabular text-muted">
        {item.label} · {item.id}
      </p>
      {item.status === "fixed" && item.final ? (
        <>
          <div className="rounded-2xl bg-track p-3 opacity-80">
            <p className="text-caption font-bold uppercase text-muted">Before</p>
            <Lines item={item} value={item.original} />
          </div>
          <div>
            <p className="text-caption font-bold uppercase text-muted">After (published)</p>
            <Lines item={item} value={item.final} />
          </div>
        </>
      ) : (
        <Lines item={item} value={item.original} />
      )}
      <Status status={item.status} reason={item.reason} />
      {item.lint.length ? <p className="text-caption text-muted">Automatic check: {item.lint.join(" ")}</p> : null}
    </Cushion>
  );
}

function Link2({ href, on, children }: { href: string; on?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full px-3 py-1.5 text-caption font-bold ${on ? "bg-coat text-on-coat" : "bg-surface shadow-cushion"}`}>
      {children}
    </Link>
  );
}

function Unreviewed({ code, lesson }: { code: string; lesson: Lesson }) {
  const items = enumerateItems(code, lesson);
  return (
    <div className="flex flex-col gap-6">
      {PARTS.map((part) => (
        <section key={part} id={part} className="flex flex-col gap-3">
          <h2 className="text-title">{PART_NUMBER[part]}. {PART_TITLES[part]}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {items.filter((i) => i.part === part).map((i) => (
              <Cushion key={i.id} className="flex flex-col gap-2 p-4" radius={24}>
                <p className="text-caption font-bold tabular text-muted">{i.label} · {i.id}</p>
                <Lines item={i} value={valueOf(lesson, i)} />
              </Cushion>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Reviewed({ lesson, filter }: { lesson: LessonReview; filter: string }) {
  return (
    <div className="flex flex-col gap-8">
      <Cushion className="flex flex-col gap-1 p-4" radius={24}>
        <p className="text-headline">
          {lesson.code}: {lesson.publishable ? "can be published" : "blocked, items need a human"}
        </p>
        {lesson.lessonIssues.map((m) => (
          <p key={m} className="text-caption text-die">LESSON: {m}</p>
        ))}
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption">
          {PARTS.map((p: PartName) => (
            <a key={p} href={`#${p}`} className={`font-bold underline ${STATUS[lesson.partStatus[p]].color}`}>
              {PART_NUMBER[p]} {p}
            </a>
          ))}
        </p>
      </Cushion>
      {PARTS.map((part) => {
        const items = lesson.items.filter((i) => i.part === part && (filter === "all" || i.status === filter));
        if (!items.length) return null;
        return (
          <section key={part} id={part} className="flex flex-col gap-3">
            <h2 className="flex flex-wrap items-baseline gap-2 text-title">
              {PART_NUMBER[part]}. {PART_TITLES[part]}
              <span className={`text-caption font-bold ${STATUS[lesson.partStatus[part]].color}`}>{STATUS[lesson.partStatus[part]].label}</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">{items.map((i) => <ItemBox key={i.id} item={i} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

function Totals({ run }: { run: RunView }) {
  const r = run.review;
  return (
    <section className="flex flex-col gap-3">
      {r ? (
        <Cushion className="flex flex-col gap-1 p-4" radius={24}>
          <p className="text-headline">{r.summary.items} items in {r.summary.lessons} lessons</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-bold text-das">{r.summary.ok} ok</span>
            <span className="font-bold text-progress">{r.summary.fixed} fixed</span>
            <span className="font-bold text-die">{r.summary.needsHuman} need a human</span>
          </p>
          <p className="text-caption text-muted">Can be published: {r.summary.publishable.join(", ") || "none"} · Blocked: {r.summary.blocked.join(", ") || "none"}</p>
          {[...r.failures.generateA, ...r.failures.generateB, ...r.failures.review].map((f) => (
            <p key={f.code + f.reason} className="text-caption text-die">{f.code}: {f.reason}</p>
          ))}
        </Cushion>
      ) : (
        <p className="text-muted">Not reviewed yet: only the generated lessons exist.</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
        {(["generate-a", "generate-b", "review"] as const).map((s) =>
          run.reports[s] ? (
            <span key={s}>{s}: {run.reports[s]!.model}, actual €{run.reports[s]!.actualEur.toFixed(3)} (estimated €{run.reports[s]!.estimatedEur.toFixed(2)})</span>
          ) : null,
        )}
      </div>
    </section>
  );
}

export default async function ContentPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DESIGN_PAGE !== "1") notFound();
  const params = await searchParams;
  const runs = listRuns();
  const name = typeof params.run === "string" ? params.run : runs[0];
  const filter = params.show === "needs-human" || params.show === "fixed" ? params.show : "all";
  const run = name ? loadRun(name) : null;
  const codes = run ? (run.review?.lessons.map((l) => l.code) ?? Object.keys(run.generated ?? {})) : [];
  const code = typeof params.lesson === "string" && codes.includes(params.lesson) ? params.lesson : codes[0];
  const base = `/design/content?run=${name}`;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-display">Content review</h1>
        <p className="text-muted">A generated lesson, all 14 parts, with the Opus verdict on every item. A lesson is published only when no item needs a human. Dev tool, not part of the app.</p>
        <nav aria-label="Runs" className="flex flex-wrap gap-2">
          {runs.map((r) => <Link2 key={r} href={`/design/content?run=${r}`} on={r === name}>{r}</Link2>)}
        </nav>
      </header>

      {!run ? (
        <p className="text-muted">No run found. Generate one with <code>npm run content</code> (see docs/SETUP-CURRICULUM.md).</p>
      ) : (
        <>
          <Totals run={run} />
          <nav aria-label="Lessons" className="flex flex-wrap items-center gap-2">
            {codes.map((c) => <Link2 key={c} href={`${base}&lesson=${c}&show=${filter}`} on={c === code}>{c}</Link2>)}
            {run.review ? (
              <>
                <span className="mx-1 text-caption text-muted">Show:</span>
                {(["all", "fixed", "needs-human"] as const).map((f) => (
                  <Link2 key={f} href={`${base}&lesson=${code}&show=${f}`} on={filter === f}>{f === "all" ? "Everything" : f === "fixed" ? "Fixed" : "Needs human"}</Link2>
                ))}
              </>
            ) : null}
          </nav>
          {run.review && code ? <Reviewed lesson={run.review.lessons.find((l) => l.code === code)!} filter={filter} /> : null}
          {!run.review && run.generated && code ? <Unreviewed code={code} lesson={run.generated[code]} /> : null}
        </>
      )}
    </main>
  );
}

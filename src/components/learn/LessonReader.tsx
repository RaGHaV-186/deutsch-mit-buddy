import { useTranslations } from "next-intl";
import { ArticleWord, Cushion } from "@/components/ds";
import { PARTS, type Lesson, type PartName } from "@/lib/content/lesson-schema";

// The lesson as a learner reads it: the teaching parts, with their text exactly as published. The question parts (warm-up, exercises,
// day exam) are not shown here: they belong to the lesson player (slice 4a).

const READABLE: PartName[] = PARTS.filter((p) => p !== "exercises" && p !== "exam");

function Section({ part, children }: { part: PartName; children: React.ReactNode }) {
  const t = useTranslations("Learn.parts");
  return (
    <section id={part} className="flex scroll-mt-6 flex-col gap-3">
      <h2 className="text-headline">{t(part)}</h2>
      {children}
    </section>
  );
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <Cushion radius={24} className="flex flex-col gap-2 p-4">
    {children}
  </Cushion>
);

function Script({ lines }: { lines: { speaker: string; de: string; en: string | null }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((l, i) => (
        <li key={i}>
          <p>
            <b>{l.speaker}:</b> {l.de}
          </p>
          {l.en ? <p className="text-caption text-muted">{l.en}</p> : null}
        </li>
      ))}
    </ul>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc pl-5">
    {items.map((x) => (
      <li key={x}>{x}</li>
    ))}
  </ul>
);

export function LessonReader({ lesson }: { lesson: Lesson }) {
  const t = useTranslations("Learn.reader");
  const l = lesson;
  return (
    <div className="flex flex-col gap-8">
      <p className="text-caption text-muted">{t("note")}</p>

      {READABLE.map((part) => (
        <Section key={part} part={part}>
          {part === "goal" ? (
            <Card>
              <p className="text-headline">{l.goal.can_do}</p>
            </Card>
          ) : null}

          {part === "warmup" ? (
            l.warmup.preview.points.length ? (
              <Card>
                <p className="font-bold">{t("todayYouLearn")}</p>
                <List items={l.warmup.preview.points} />
              </Card>
            ) : (
              <p className="text-caption text-muted">{t("warmupLater", { count: l.warmup.items.length })}</p>
            )
          ) : null}

          {part === "grammar" ? (
            <>
              <Card>
                <p className="text-headline">{l.grammar.intro.title}</p>
                {l.grammar.intro.explanation.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                <p className="rounded-2xl bg-track p-3 font-bold">{l.grammar.intro.rule_summary}</p>
              </Card>
              {l.grammar.tables.map((tb) => (
                <Card key={tb.title}>
                  <p className="font-bold">{tb.title}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-caption">
                      <thead>
                        <tr>
                          {tb.headers.map((h) => (
                            <th key={h} className="border-b border-track px-2 py-1 text-left">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tb.rows.map((r, i) => (
                          <tr key={i}>
                            {r.map((c, j) => (
                              <td key={j} className="border-b border-track px-2 py-1">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
              <Card>
                <p className="font-bold">{t("examples")}</p>
                {l.grammar.examples.map((e) => (
                  <div key={e.de}>
                    <p>{e.de}</p>
                    <p className="text-caption text-muted">
                      {e.en}
                      {e.note ? ` (${e.note})` : ""}
                    </p>
                  </div>
                ))}
              </Card>
              <Card>
                <p className="font-bold">{t("traps")}</p>
                {l.grammar.traps.map((tr) => (
                  <div key={tr.wrong}>
                    <p>
                      <span className="text-die line-through">{tr.wrong}</span> → <span className="text-das font-bold">{tr.right}</span>
                    </p>
                    <p className="text-caption text-muted">{tr.why}</p>
                  </div>
                ))}
              </Card>
            </>
          ) : null}

          {part === "vocabulary" ? (
            <>
              <div className="grid gap-3 tab:grid-cols-2">
                {l.vocabulary.words.map((w) => (
                  <Card key={w.de}>
                    <p className="text-headline">
                      <ArticleWord article={w.article} word={w.de} />
                      {w.plural ? <span className="text-caption text-muted"> · {w.plural}</span> : null}
                    </p>
                    <p>{w.en}</p>
                    <p className="text-caption">{w.example}</p>
                    <p className="text-caption text-muted">{w.example_en}</p>
                    {w.tip ? <p className="text-caption text-muted">{w.tip}</p> : null}
                  </Card>
                ))}
              </div>
              <Card>
                <p className="font-bold">{t("phrases")}</p>
                {l.vocabulary.phrases.map((p) => (
                  <div key={p.de}>
                    <p>
                      <b>{p.de}</b> · {p.en}
                    </p>
                    <p className="text-caption text-muted">
                      {p.example} {p.example_en}
                    </p>
                  </div>
                ))}
              </Card>
            </>
          ) : null}

          {part === "pronunciation" ? (
            <Card>
              <p className="font-bold">{l.pronunciation.focus}</p>
              <p>{l.pronunciation.explanation}</p>
              <ul className="grid gap-1 tab:grid-cols-2">
                {l.pronunciation.words.map((w) => (
                  <li key={w.de}>
                    <b>{w.de}</b> <span className="text-caption text-muted">{w.hint}</span>
                  </li>
                ))}
              </ul>
              <List items={l.pronunciation.sentences} />
            </Card>
          ) : null}

          {part === "reading" ? (
            <Card>
              <p className="text-headline">{l.reading.passage.title}</p>
              <p>{l.reading.passage.text}</p>
            </Card>
          ) : null}

          {part === "listening" ? (
            <Card>
              <p className="text-headline">{l.listening.passage.title}</p>
              <Script lines={l.listening.passage.script} />
            </Card>
          ) : null}

          {part === "writing" ? (
            <Card>
              <p>{l.writing.task}</p>
              <p className="text-caption text-muted">{t("minWords", { count: l.writing.min_words })}</p>
              <p className="font-bold">{t("mustInclude")}</p>
              <List items={l.writing.must_include} />
              <p className="font-bold">{t("usefulPhrases")}</p>
              <List items={l.writing.useful_phrases} />
              <details className="rounded-2xl bg-track p-3">
                <summary className="cursor-pointer font-bold">{t("modelAnswer")}</summary>
                <p className="pt-2">{l.writing.model_answer}</p>
              </details>
            </Card>
          ) : null}

          {part === "speaking" ? (
            <>
              <Card>
                <p className="font-bold">{t("drill")}</p>
                {l.speaking.drill.map((d) => (
                  <div key={d.target}>
                    <p className="text-caption text-muted">{d.prompt}</p>
                    <p>{d.target}</p>
                  </div>
                ))}
              </Card>
              <Card>
                <p className="text-headline">{l.speaking.tandem.title}</p>
                <p>{l.speaking.tandem.setting}</p>
                <p className="text-caption text-muted">{t("tandemNote")}</p>
              </Card>
            </>
          ) : null}

          {part === "culture" ? (
            <Card>
              <p className="text-headline">{l.culture.title}</p>
              <p>{l.culture.note}</p>
              <p className="text-caption text-muted">{l.culture.reflection_question}</p>
            </Card>
          ) : null}

          {part === "mission" ? (
            <Card>
              <p className="text-headline">{l.mission.title}</p>
              <p>{l.mission.task}</p>
              <ol className="list-decimal pl-5">
                {l.mission.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="text-caption text-muted">{l.mission.report_prompt}</p>
              {l.mission.safety_note ? <p className="text-caption">{l.mission.safety_note}</p> : null}
            </Card>
          ) : null}

          {part === "closing" ? (
            <Card>
              <p className="font-bold">{t("covered")}</p>
              <List items={l.closing.covered} />
              <p className="text-caption text-muted">{l.closing.review_tomorrow}</p>
            </Card>
          ) : null}
        </Section>
      ))}
    </div>
  );
}

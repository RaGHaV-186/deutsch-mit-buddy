# Deutsch mit Buddy — project memory for Claude Code

Deutsch mit Buddy is a free web app (installable PWA) where an AI teacher dog, **Buddy**, takes learners from zero to C1 German.
Owner: Raghav (admin). Domain: deutschmitbuddy.de. Repo: github.com/RaGHaV-186/deutsch-mit-buddy (public).

## Source of truth
- `docs/BLUEPRINT.md` — product, Buddy, screens, database (25 tables), security + German law, costs, build order (slices 0–12). Read it before every slice.
- `data/curriculum.ts` — ordered sessions Z1 → W16.5 (+ Saturdays, Sundays, checkpoints). Z1 → B1 only for now; B2–C1 outlines and cards come in a later slice (BLUEPRINT slice 13).
- `data/seed-cards.json` — Raghav's existing 213 cards (word / say / answer), Days 2–11.
- `data/seed-tracker.ts` — Raghav's history: logs Days 1–10, weak spots, test score, Tandem log. He is at Day 11 = Z9.
- `assets/buddy/*.svg` — Buddy artwork (happy, curious, tandem). Buddy must look like Raghav's real dog: blue-grey + white pit bull type, white forehead blaze widening into a white muzzle, grey eye patches into the ears (left larger), grey rose ears with pink insides, amber eyes, big slate nose with freckles, neck wrinkles, white chest, red collar.

## How we work
- Build ONE slice at a time from BLUEPRINT section 8. Plan first, then code. Every slice ends working, tested and deployed.
- Never put secrets in code, commits or chat. Use `.env.local` (git-ignored) and Vercel env vars; keep `.env.example` updated with names only.
- Every table gets row-level security. Every API route: auth + AAL2 (2FA) check, zod validation, rate limit.
- AI calls only from the server. Model routing via env: MODEL_ADMIN (claude-opus-5-5), MODEL_MEMBER (claude-sonnet-5-5), MODEL_FAST (claude-haiku-5-5). Use prompt caching. Log every call to `ai_usage`. Shield check before every Buddy message.
- Before committing: `npm run lint && npm test && npm run build` must pass. The same three steps run in GitHub Actions CI on every push and PR and must be green before a slice counts as done.
- RLS tests (try to read another user's rows) run in CI from slice 1. Sentry and security headers (CSP, HSTS) are in from slice 1.
- Buddy's tools (add card, log mistake, update weak spot, close day) use shared zod schemas with length caps on every input. Canned-lesson regression tests guard prompt changes.
- Budget: admin (Raghav) AI spend is tracked separately in `ai_usage` and never counts toward the member budget or its 80% / 100% rules.
- Voice: a typed fallback exists everywhere voice is used. When browser speech recognition is unavailable (iOS), fall back to Azure Speech-to-Text on the server.
- Reminders: Supabase pg_cron (hourly) + pg_net call a secret-protected API route. No Vercel cron (Hobby is daily only).
- Offline sync conflicts: the latest review timestamp wins.
- Commit messages: short, imperative, one slice step each.
- UI strings go through the i18n layer (English now, German later).
- Design tokens live in one theme file (`src/theme.ts`, mirrored in `src/app/globals.css`) and follow `docs/DESIGN_BRIEF.md`: coat/surface/tint colours, der/die/das article colours (light + dark), font Plus Jakarta Sans; light + dark mode with a manual override; mobile first.
- Next.js 16: `middleware` is now `proxy.ts`; request APIs (cookies, headers, params) are async. Check node_modules/next/dist/docs when unsure.

## Teaching format Buddy follows (every lesson, Z1 → C1)
Review (exercises + recycled mistakes) → one grammar point (+10 drills) → 10 core + 5 bonus words via flashcards → writing (correct every error, explain why) → speaking drill (sentences become speaking cards) → end-of-day test → Close Day log: Covered | Mistakes | Carry over.
One section at a time; wait for the learner's answer. Hint first, never write the learner's sentences. English explanations early, more German as the level rises. Saturdays review + writing, Sundays tests, checkpoint mocks after each level.

## Card format (keep exactly)
Front: English (word cards) or "Say it in German" / "Answer out loud" (speaking cards). Back: coloured article + word (der blue / die red / das green / none grey), plural or verb forms line, English meaning, example sentence + English, tip line. Buttons: Play word, Play sentence, Slow; Again / Hard / Got it / Easy. Modes: Words / Speaking / Words + Speaking. Direction: English → German (default) or German → English.

## Design
- All UI work follows `docs/DESIGN_BRIEF.md` (it replaces any earlier design instructions). Work phase by phase as the brief says.
- Reference images are in `docs/design/`.
- Mascot assets (poses, app icons, glyph) are in `public/buddy/`.
- Auth and 2FA logic must never be changed by design work (restyle the screens only).
- Every new slice must build its screens from the components in `@/components/ds` and follow `docs/DESIGN_BRIEF.md` (tokens, layout, states). Don't add one-off styles or hard-coded colours.
- Game-layer UI (treats, level, streak, combo) is already built and hidden behind `NEXT_PUBLIC_GAME_LAYER` (off by default); slice 10 only needs to supply the data and turn the flag on. Never show mock numbers in production.
- Every new screen must work at 390px, 820px and 1440px (phone, tablet, desktop layouts from docs/DESIGN_BRIEF.md and docs/design/desktop/), in light and dark, using @/components/ds. Screenshots are taken only at checkpoints, and only at 390px light + 1440px dark unless Raghav asks for more (see Working rules).

## Working rules (to save Raghav's plan usage)
- Use Sonnet for routine building, tests and fixes. Say when a task needs Opus (hard design, tricky debugging, writing or changing the content-review prompts).
- Screenshots only at checkpoints, only 390px light + 1440px dark, unless Raghav asks for more.
- Batch jobs: submit, save the batch id (`data/generated/<run>/state.json`), then stop and tell Raghav. He says "continue"; resume with the same `npm run content -- run ...` command (it polls the saved batch and never submits or pays twice).
- Paid AI runs: show an estimate (requests, tokens, euros, worst case) and wait for a yes; no pass may be able to cost more than €10; `ANTHROPIC_API_KEY` only in `.env.local`, never in Vercel or a NEXT_PUBLIC variable.
- Keep "Where we are" below and the status line in BLUEPRINT section 8 current at every stopping point, so Raghav can /clear between steps without losing context.

## Where we are (update at every stop)
Updated 22 Oct 2026. Branch `slice-3-curriculum` (commits only, not pushed, no PR yet; this step's changes are not committed yet). Slices 0–2 and the redesign (design-v1.1) are merged and live.

**Slice 3a (lesson standard) is built and tested** (`src/lib/content/*`, `scripts/content.mts`, migrations `20261021100000_curriculum_content.sql` + `20261022100000_content_accepted_answers.sql`). Generator v2: `accepted_answers` + the answer checker `answer-check.ts`; free freshness lint; the warm-up reviews EARLIER lessons; support tables; `common-traps.ts`; `lesson-notes.ts`; a lesson is written in FOUR Sonnet passes (A teach, B reading/listening/writing/speaking, C day exam, D warm-up/culture/mission/close day) because the API refuses larger structured-output schemas (limit under ~3.9k schema characters). Commands: `check` (free lint, before and after the review), cost ledger `costs.json` per run. How to run it: `docs/SETUP-CURRICULUM.md`.

**New after Checkpoint A round 2 (22 Oct)**: (1) free lint error `model-answer-length` / `model-answer-sentences`: a writing model answer must have at least `min_words` words and the number of sentences its task names, in every lesson; (2) writer and Opus prompts: distractors must be "clearly false but plausible" (no nonsense, no wrong kind, no second correct answer); (3) manual corrections: `manual-fixes.json` in a run folder (item id -> `{reason, value}`) replaces single items, drops their old verdicts, and `estimate|run --stage review --fixes` has Opus re-check ONLY those items (about €0.05 for 5 items); (4) after a review, `mergeLesson` re-lints the finished lesson, so a correction that breaks another item blocks it.

**Checkpoint A is closed: Z1, Z2, Z3 are publishable** (run `sample-z1-z3-v2`: 285 items, 261 ok, 24 fixed, 0 needs-human; not yet published to any database, that is slice 3b). Raghav's six fixes are in; the re-review (€0.049) also corrected two more items (Z2 writing task now asks for the question to a friend; Z2 exam.reading.q1 distractor Lena -> Italien). Total cost of the sample: €0.55 (round 1) + €0.76 (round 2) + €0.05 (re-review). Files: `~/Downloads/z1-lesson.md`, `z2-lesson.md`, `z3-lesson.md`.

**Tranche 1 (Z4 → W4.5, 27 lessons, run `z1-b1`): generated and reviewed, 11 lessons blocked on 13 items (22 Oct)**. Total cost €6.39 (generation €2.60: A €1.34, B €0.56, C €0.35, D €0.35, the old pass D batch reused for 22 lessons; Opus review €3.79, estimate was €3.00). Raghav's limits: expected tranche total ≤ €7 (≤ €8 allowed), each pass's worst case ≤ €10, at least $5 of credit unspent (about $19 before this tranche, so about $13 left: check the console; a top-up of about $12+ is needed before B1). Result (`npm run content -- build --run z1-b1`): 2533 ok, 307 fixed, 13 need a human. **Publishable (19 incl. Z1–Z3): Z1–Z4, Z6, Z7, Z8, W1.2, W1.3, W2.1, W2.3, W2.5, W3.3, W3.4, W3.5, W4.1, W4.3, W4.4, W4.5. Blocked (11): Z5, Z9, Z10, W1.1, W1.4, W1.5, W2.2, W2.4, W3.1, W3.2, W4.2.** The 13 items (`data/generated/z1-b1/needs-human.json`, `review.md`) and the proposed fixes: (1) names rule: Z10 cards Herr/Frau use the surname "Lang" and the W1.1 culture note uses "Weber"; needs Raghav's decision (allow ONE surname for formal address, e.g. Braun, as in the Z10 exam, and use it everywhere; or none); also "Mr / man" -> "Mr / gentleman"; (2) Z5 reading passage: "Jonas hat keine Brille." does not fit Anna's room and uses keine (deferred): replace the sentence and re-point reading.q5; (3) W1.4, W2.2, W2.4, W3.1 writing: Opus's rewrite broke the sentence count (6 vs 5, 5 vs 4, 4 vs 5, 5 vs 4): mechanical fix by hand in `manual-fixes.json`, then a re-review of only those items (about €0.05, `--stage review --fixes`); (4) W1.5 reading.q5: the correction does not fit the item, check the accepted answers; (5) W3.2 reading and listening passages: "Gestern" clashes with the weekend timeline, change to "Am Samstag"; (6) W4.2 tandem: a new neighbour (stranger) with du conflicts with the Sie rule, make the neighbour a young neighbour or a friend; (7) Z9 culture: the tap-water claim for Austria/Switzerland is doubtful, limit it to Germany. Nothing is published yet (publishing is slice 3b). **Writer prompts tightened** for the next tranches (`prompts.ts`: how to count a model answer, exam freshness incl. standard phrases, no placeholder warm-up items); this changes pass B, C and D requests, so their estimate ids change. Gotchas: always pass the same `--lessons` list as the estimate; `estimate` overwrites `<stage>.estimate.json`; write pass A for the whole stretch before pass D. Patches made by hand before the review are logged in `data/generated/z1-b1/repairs.json`. Later tranches: A2 about €6.4, B1 + exam prep about €13.7 (split the last review in two); review cost ran about 25% above its estimate, so add margin. Keep the whole stretch under ONE run name (`z1-b1`). Idea for later: noun-gender check against a German noun dictionary (BLUEPRINT "Later").

**Next (slice 3b)**: generate the rest in tranches, publish, unlock cards per lesson with `template_id`, propagate template fixes to every user's copy without touching SRS or user-edited cards, a generic dedupe test with a fixture user who already owns the Z2–Z9 seed cards, set Raghav's pointer to Day 11 · Z9 in the admin seed-import action, then 3c (report a mistake, content_reports, admin screen, AI label, B2/C1 "coming soon" in the picker).

**Local setup notes**: `npm run test:rls` deletes every local user, so recreate a test user before using the app in a browser (the content preview page needs an AAL2 session; a throwaway-user script for screenshots lived in the session scratchpad, not in the repo). `.claude/launch.json` (untracked) starts the preview on port 3100 with `SHOW_DESIGN_PAGE=1`. Known issues: `docs/known-issues.md` (no streamed Suspense / `loading.tsx`).

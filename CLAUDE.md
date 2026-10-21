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
Updated 21 Oct 2026. Branch `slice-3-curriculum` (commits only, not pushed, no PR yet). Slices 0–2 and the redesign (design-v1.1) are merged and live.

**Slice 3a (lesson standard) is built and tested** (`src/lib/content/*`, `scripts/content.mts`, migration `20261021100000_curriculum_content.sql`): 14-part lesson schema, three Sonnet passes (A: parts 0–5, B: 6–9, C: 10–13), an Opus review of every item (ok / fixed / needs-human), automatic lint, a `publish_lesson` function plus trigger that refuses an incomplete lesson, Markdown export, and a preview page at `/design/content?run=<name>` (run the app with `SHOW_DESIGN_PAGE=1`). How to run it: `docs/SETUP-CURRICULUM.md`.

**In flight (Z1–Z3 sample, run `sample-z1-z3`)**: passes A, B and C are done for Z1, Z2, Z3 (actual cost about €0.21). The Opus review batch is submitted at Anthropic: batch `msgbatch_01G3Rk1zNB3GRVQT1p6kKYgE`, estimate id `b83b296ff55facbd` (exact estimate €0.30 expected, €0.65 worst case). Raghav pre-approved the whole sample while the combined actual cost stays under €1.20 (worst case so far about €0.88).

**When Raghav says "continue"**:
1. `npm run content -- run --run sample-z1-z3 --stage review --approve b83b296ff55facbd` (resumes the saved batch), then `npm run content -- build --run sample-z1-z3`.
2. Export Z1 to `~/Downloads/z1-lesson.md`: `npm run content -- markdown --run sample-z1-z3 --lesson Z1 --out ~/Downloads/z1-lesson.md`.
3. Screenshots of `/design/content?run=sample-z1-z3` at 390px light and 1440px dark only.
4. Checkpoint A report: review summary (ok / fixed / needs-human with reasons), actual cost of all four passes, screenshots, the Markdown file.
5. Do not run any further tranche until Raghav has reviewed the sample and topped up his API credits (about $19 left; Z1 → B1 needs roughly $16 expected, more with retries; run it in tranches, each pass under €10).

**Next after Checkpoint A (slice 3b)**: generate the rest in tranches, publish, unlock cards per lesson with `template_id`, propagate template fixes to every user's copy without touching SRS or user-edited cards, a generic dedupe test with a fixture user who already owns the Z2–Z9 seed cards, set Raghav's pointer to Day 11 · Z9 in the admin seed-import action, then 3c (report a mistake, content_reports, admin screen, AI label, B2/C1 "coming soon" in the picker).

**Local setup notes**: `npm run test:rls` deletes every local user, so recreate a test user before using the app in a browser. API schemas for structured output must stay small (the whole lesson in one schema was refused: that is why there are three passes). Known issues: `docs/known-issues.md` (no streamed Suspense / `loading.tsx`).

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
- **Backups: the Supabase Free plan has no automatic backups.** Before every release run `npm run backup` (three dumps, schema + data + auth, into `~/backups/deutschmitbuddy/` with the date; never into the repo; Raghav types the database password himself; it checks the files). Release steps live in `docs/RELEASE-slice-3.md` and run one at a time, each after his "next".
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
- **Approval means Raghav's explicit "yes" in this chat, for that exact spend** (what it buys and the amount). A small estimate, a limit he gave earlier for something else, or my own judgement never counts. If an estimate is above what he approved, or nothing was approved yet, stop, ask, and wait for his answer in his next message, even for a few cents. The same goes for anything on the hosted database, the production deploy and other outward-facing steps: only his explicit go for that step.
- Paid AI runs: show an estimate (requests, tokens, euros, worst case) and wait for a yes; no pass may be able to cost more than €10; `ANTHROPIC_API_KEY` only in `.env.local`, never in Vercel or a NEXT_PUBLIC variable.
- Keep "Where we are" below and the status line in BLUEPRINT section 8 current at every stopping point, so Raghav can /clear between steps without losing context.

## Where we are (update at every stop)
Updated 23 Oct 2026. **Slice 3 is live** (PR #12 merged as `bf0b801`, tag `slice-3`, production deployed from `main`). Slices 0–3 and the redesign (design-v1.1) are on `main`.

**Live now**: 9 migrations on the hosted database (slice 3 added the lesson content tables, `cards.template_id` + `user_edited`, `profiles.deck_unlocked_seq`, `publish_lesson`), the 131-row lesson plan, **all 30 lessons of tranche 1 published** (Z1–Z10, W1.1–W4.5: 24 on release day, the last six (Z10, W1.4, W1.5, W2.5, W3.2, W4.5) published in a second step after their re-checks; verify numbers matched: 30 publications, 420 parts, 692 templates, 1257 questions; Raghav's deck unchanged at 302 cards), the Learn tab (`/learn`, `/learn/<code>`: teaching parts only, questions come with the lesson player 4a), cards unlock per lesson (earlier-than-start lessons as already seen, no card twice), template corrections reach every copy without touching SRS or edited cards. Raghav pressed "Import seed deck" (Home shows Day 11 · Z9). `.env.hosted` was deleted. How it was released, with the checks and lessons learned (seq is a plan position, not a day; Free plan has no backups; zsh `read` syntax; check `start_code` before the first page load): `docs/RELEASE-slice-3.md`. How to run the content pipeline: `docs/SETUP-CURRICULUM.md`. Tests: `npm test` (unit), `npm run test:rls` (local Supabase only; refuses any other URL; never touches real lessons or accounts).

**Tranche 1 is complete and live (23 Oct 2026; total cost €6.75, 0 items need a human).** Rules that hold for tranches 2–4: (1) typing questions ask for a narrow answer only (one word, a number, a time, one fixed phrase from the text, or a short fixed translation); an open "answer in a sentence" reading/listening question is multiple choice with three options that are clearly wrong according to the text (ideally from the text at another time, place or person, so exactly one answer is defensible); accepted answers stay at most 8; the reviewer fixes an open one by replacing the item with multiple choice, never by listing more accepted answers (writer and reviewer prompts, plus the free warning `typing-open`, which currently flags `W4.4#reading.q4`, a live lesson: a one-item fix for later); (2) a standalone salutation and a closing formula do not count as sentences of a model answer; (3) re-review verdicts are bound to the exact correction text (`fixHash`); (4) a batch that hangs for hours: tell Raghav; a `--direct` run is double price and needs his explicit yes; (5) to publish only some lessons, copy their payloads into a new run folder and use `--run` with it (`docs/RELEASE-slice-3.md`, lessons learned).

**Domain (live 23 Oct 2026)**: canonical address `https://www.deutschmitbuddy.de`; the apex `deutschmitbuddy.de` redirects (308) to `www`; DNS at INWX (A `@` → 216.198.79.1, CNAME `www` → Vercel). Raghav set `NEXT_PUBLIC_SITE_URL=https://www.deutschmitbuddy.de` (Production only), redeployed without cache (`/api/health` shows `siteUrl` set), and updated Supabase Site URL + Redirect URLs, Google OAuth origins and Turnstile hostnames; password reset and Google login tested OK on `www`. The code has no hard-coded domain (only `siteUrl()`); where every address setting lives and how to check: `docs/DOMAIN.md`. Not set up yet: `metadataBase`/canonical/Open Graph tags, `robots.txt`, sitemap. Claude does not change Vercel or Supabase settings.

**Next**: tranches 2–4 of the content (A2 about €6.4, B1 + exam prep about €13.7, the last review split in two; reviews have run about 25% over their estimate) under the same run name `z1-b1` (write pass A for the whole stretch before pass D), after Raghav tops up the API credits (about $19 before tranche 1, a top-up of about $12+ is needed before B1; at least $5 must stay unspent). Then slice 3c (report a mistake, `content_reports`, admin screen, AI label, B2/C1 "coming soon" in the picker), then the lesson player 4a–4e. Cost limits are hard (see Working rules). Idea for later: noun-gender check against a German noun dictionary (BLUEPRINT "Later").

**Local setup notes**: `.claude/launch.json` (untracked) starts the preview on port 3100 with `SHOW_DESIGN_PAGE=1`; the preview needs a signed-in AAL2 user (a throwaway-user script lived in a session scratchpad, not in the repo: create a user with the admin API, enroll a TOTP factor, sign in with email + password, then a TOTP code). Known issues: `docs/known-issues.md` (no streamed Suspense / `loading.tsx`).

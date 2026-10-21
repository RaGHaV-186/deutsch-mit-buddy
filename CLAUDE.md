# Deutsch mit Buddy — project memory for Claude Code

Deutsch mit Buddy is a free web app (installable PWA) where an AI teacher dog, **Buddy**, takes learners from zero to C1 German.
Owner: Raghav (admin). Domain: deutschmitbuddy.de. Repo: github.com/RaGHaV-186/deutsch-mit-buddy (public).

## Source of truth
- `docs/BLUEPRINT.md` — product, Buddy, screens, database (25 tables), security + German law, costs, build order (slices 0–12). Read it before every slice.
- `data/curriculum.ts` — ordered sessions Z1 → W16.5 (+ Saturdays, Sundays, checkpoints). B2–C1 still to be generated (slice 3).
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
- Every new screen must work at 390px, 820px and 1440px (phone, tablet, desktop layouts from docs/DESIGN_BRIEF.md and docs/design/desktop/), in light and dark, using @/components/ds. Before finishing a slice, save screenshots at those three widths.

# Deutsch mit Buddy — Blueprint & Build Guide

19 Oct 2026 · Raghav

## 1. Product

Deutsch mit Buddy is a free web app (installable on phones) where an AI teacher, Buddy, takes each learner from absolute zero to C1 with a daily lesson, personalised flashcards, tests on demand and multiplayer word games. Domain: **deutschmitbuddy.de**.

**Who uses it**

- **Raghav (admin)**: full access, Opus lessons, admin page.
- **Members**: anyone with an account (email + password or Google, 2FA required). Capped at 30 members, then a waitlist. Minimum age 16.
- **Guests**: no account, nickname only, can join game rooms by code. No AI, no stored learning data.

**Lesson standard (every session from Z1 to C1, no exceptions)**

Buddy's daily lesson is the core of the product; flashcards are only its vocabulary part. Every lesson has all 14 parts, and a lesson cannot be published (in the database or in the generator) unless every part exists and passed the Opus check:

0. Can-do goal
1. Warm-up: yesterday's mistakes + spaced grammar review
2. Grammar point with examples and common traps
3. Exercises: gap fill, multiple choice, sentence builder, translation, dictation
4. Vocabulary: 15–20 words + useful phrases (Redemittel), learned through flashcards
5. Pronunciation focus of the day
6. Reading + questions
7. Listening (dialogue + questions; audio comes with the voice slice, the script is text until then)
8. Writing task with AI correction, every error explained
9. Speaking drill + Tandem scenario
10. Culture note
11. Real-world mission (reported back in the app, corrected by Buddy)
12. Day exam: all four skills + the day's grammar and words
13. Close Day (Covered | Mistakes | Carry over), which unlocks the day's flashcards

Progression: instructions are mostly English at A1, with more German at each level, and fully German from B2. Tasks grow from short messages (A1) to emails and opinions (B1), arguments and formal letters (B2), essays, presentations and long audio (C1). Saturday = review + longer writing; Sunday = weekly test (assembled from the week's lessons); a mock exam every 4 weeks in the format of the current level (original content, "modelled on the Goethe/telc format"). Every learner picks a starting lesson at signup or takes the placement test. B2 and C1 are shown as "coming soon" (visible, not selectable) until slice 13.

**v1 scope (everything below ships in v1)**

- Buddy as teacher and Tandem partner (text first, then voice); Buddy is always labelled as AI
- The daily lesson loop (14 parts), pre-generated and verified content; live AI only for writing correction, Tandem, Buddy's answers and mistake-based exercises
- Mistake log (an item clears after 3 correct answers on different days; feeds the warm-up, the day exam and generated exercises) and spaced repetition for grammar points
- Real-world missions, placement test, graded short stories that recycle the learner's words, busy-day mode (15 min), skill meter (Lesen / Hören / Schreiben / Sprechen), morning summary
- "Report a mistake" on cards and exercises, and corrections that reach every learner's copy without touching their progress
- Personalised flashcards with spaced repetition (Again / Hard / Got it / Easy)
- Self-test any time, covering everything learned up to the current day, plus Mistake Grind mode
- Practice: typing quiz, Diktat, numbers & time drill, word-order builder, Hörverstehen (the same engines as the lesson exercises)
- Games: Hangman (Galgenmännchen), der/die/das race (the article-drill engine, also played solo in a lesson when the mistake log shows article errors), quiz battle; guests can join
- XP (Buddy's treats), streaks, friends, leaderboard, daily challenge
- Tracker: day counter, test scores, weak spots, logs, curriculum map, export tracker.md
- "What Buddy knows about me" page, offline flashcards, reminders (push + weekly email)
- Interface in English; built so German and other languages can be added later

## 2. Buddy

Buddy is one character with two modes: **Teacher** (runs lessons, tests, corrections) and **Tandem** (a friendly conversation partner, wearing a headset). He is drawn from Raghav's dog: a blue-grey and white pit bull type with a white forehead blaze, grey eye patches, rose ears, amber eyes, a slate nose and a tongue-out grin.

**Personality**: playful but strict. Light dog humour ("Wuff!", treats as XP), never sarcastic. Corrects every error and explains why, hints before giving answers, never writes the learner's sentences for them. English at first, more German as the level rises.

**Moods (artwork set)**: happy, curious tilt, celebrating, sleepy (missed day), Tandem headset. Shown on the home screen, in lessons and in games.

**Which model does what**

| Job | Model | Why |
| --- | --- | --- |
| Lesson content (all 14 parts) and test questions, written once | Sonnet 5.5 via Batch API | 50% discount, runs once per lesson |
| Correctness check of every card, question and part, once | Opus 5.5 via Batch API | Best judge of German; items marked ok / fixed / needs-human |
| Writing correction (every error explained), mission reports | Opus 5.5 for Raghav, Sonnet 5.5 for members, then Haiku (budget guard) | Quality where it matters |
| Tandem chats and their end feedback, Buddy's answers, mistake-based exercises, grading short writing and speaking in the day exam | Haiku 5.5 | Very cheap, fast replies |
| Graded short stories that recycle the learner's words | Sonnet 5.5 | Needs the learner's own words |
| Shield (is this message about learning?) | Haiku 5.5 | Runs before every message |

Lessons are **not** generated live: teaching content and exercises are pre-generated and verified. Buddy is always labelled as an AI ("Buddy is an AI and can make mistakes") with a "Report a mistake" button wherever he speaks (EU AI Act, Art. 50).

**Voice**: Buddy speaks with a German neural text-to-speech voice (Azure or Google TTS, roughly €2–5/month at this scale); the free browser voice is the fallback. The learner speaks through the browser's speech recognition (free). When it is unavailable (iOS Safari, Firefox), the server falls back to Azure Speech-to-Text. A typed fallback exists everywhere voice is used. Tandem mode is voice-first, like a phone call. A short iOS voice spike opens slice 6. Pronunciation: the browser's speech recognition now, a design that lets Azure Pronunciation Assessment be switched on later as a per-user flag (consent first, recordings never stored).

**How Buddy remembers each learner**: every review, mistake, weak spot, test score and lesson log is stored as structured data. Before each session the server builds a compact learner profile (level, current lesson, top weak spots, last 3 logs, recent scores, due cards) and gives it to Buddy. Old chats are summarised, not replayed. This keeps lessons personal and cheap.

**Shield (learning only)**

1. A Haiku check classifies every message: learning German, or off-topic / jailbreak attempt. Off-topic gets "Wuff, I only teach German!" and never reaches the expensive model.
2. Buddy's system rules allow only teaching, German conversation, correction and quizzing.
3. Hard limits: message length, reply length, daily quota per user.
4. Flagged attempts are logged; repeat offenders are blocked automatically and listed on the admin page.

## 3. Features and screens

The app has five tabs on the phone (bottom bar) and the same five in a side bar on the laptop: Home, Learn, Cards, Play, Me.

| Screen | What it does |
| --- | --- |
| **Home** | Buddy's mood, today's lesson (Day N · code · topic), cards due, streak, XP, daily challenge, one-tap "Continue" |
| **Learn → Lesson** | The 14-part lesson player (goal, warm-up, grammar, exercises, vocabulary, pronunciation, reading, listening, writing, speaking, culture, mission, day exam, Close Day); busy-day mode (15 min); mistakes are logged automatically |
| **Learn → Tandem** | Buddy as conversation partner (not teacher) on the day's theme, no interruptions; text first, voice later; ends with a feedback list that goes into the mistake log |
| **Learn → Test** | Self-test any time: mixed test up to the current day, weekly/checkpoint tests, Mistake Grind, timed exam mocks from W14 |
| **Learn → Practice** | Typing quiz, Diktat, numbers & time drill, word-order builder, Hörverstehen (Buddy-generated dialogues + questions) |
| **Cards** | Your format: der blue / die red / das green, plural line, example, audio + slow; Words / Speaking / Both; due-today queue; browse + edit deck; offline |
| **Play** | Create or join a room by code; Hangman, der/die/das race, quiz battle; 2–8 players; emoji reactions only (no free chat) |
| **Me** | Tracker (logs, weak spots, test scores, curriculum map), friends, leaderboard, "What Buddy knows about me", settings, export tracker.md, export/delete account |
| **Auth** | Sign up / log in (email + password or Google), 2FA setup (authenticator app), choose starting point or placement quiz, waitlist page when full |
| **Admin** (Raghav only) | Users, quotas, AI spend this month, shield flags, block/unblock, waitlist approvals |
| **Legal** | Impressum, Datenschutzerklärung, Nutzungsbedingungen, cookie notice (only essential cookies, so no banner needed) |

**XP rules (Buddy's treats)**: 1 per card reviewed, 20 per lesson closed, 10 per Tandem chat, test score ÷ 2, 5 per game won, 15 for the daily challenge. Weekly and all-time leaderboards, among friends or all members.

**Reminders**: web push at the learner's chosen hour when cards are due or the streak is at risk; Sunday weekly report email (progress, weak spots, next week). Supabase pg_cron runs hourly and uses pg_net to call a secret-protected API route, which sends to learners whose reminder hour matches. Vercel cron is not used (Hobby allows daily only).

**Feedback**: the Me screen has a "Send feedback" button, so the first 30 members can report problems and ideas.

## 4. Architecture and tech stack

One TypeScript codebase on Next.js, hosted on Vercel, with Supabase for data, login and live games. The API keys live only on the server, so the browser never talks to Claude directly.

How the parts connect:

- **Browser (phone/laptop)**: Next.js app (installable PWA), offline flashcards, speech recognition, game room client. Talks to the Next.js server over HTTPS, and to Supabase Realtime directly for live game rooms.
- **Vercel: Next.js server**: Buddy API + shield, quotas + rate limits, learner profile builder, cron jobs for reminders. Calls the Claude API (Opus, Sonnet, Haiku), the neural TTS service (Buddy's voice) and Resend + Web Push (reminders, weekly report). Reads/writes Supabase (data, auth).
- **Supabase (Frankfurt, EU)**: Postgres with row-level security, Auth (email, Google, 2FA), Realtime for game rooms.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript | One language front and back; streaming; easy Vercel deploy |
| Styling | Tailwind CSS + your colour tokens (der blue, die red, das green) | Fast to build, easy to redesign later |
| Data + login | Supabase: Postgres, Auth (email, Google, TOTP 2FA), Realtime, Storage | All-in-one, free tier, EU region |
| AI | Anthropic SDK, prompt caching, Batch API for card generation | Cost control |
| Voice | Azure neural TTS (German voice) + browser speech recognition, Azure Speech-to-Text as server fallback | Natural voice, cheap, works on iOS |
| Scheduling | Supabase pg_cron (hourly) + pg_net → secured API route | Reminders at each learner's hour without Vercel Pro |
| CI | GitHub Actions: lint, test, build on every push and PR | Catch breakage before deploy |
| Email | Resend (free tier: 3,000 emails/month) | Reminders, weekly report, auth emails |
| Offline | Service worker + IndexedDB queue | Cards work on the train |
| Hosting | Vercel Hobby (free) | Preview link for every change |
| Tests | Vitest (logic) + Playwright (browser flows) | Catch breakage before deploy |
| Errors | Sentry free tier | See crashes on real phones |
| i18n | next-intl, English first | German UI later without rewrites |

## 5. Database tables

About 25 tables in Supabase Postgres (the exact count shifts slightly as pairs like `chats` + `messages` are counted). Every user-owned table has a `user_id` and a row-level security rule "you can only read and write your own rows"; shared content tables are read-only for members and written only by the server.

Supabase setting: **"Automatically expose new tables" is OFF** and **automatic RLS is ON**, so every migration must explicitly grant privileges to the anon/authenticated roles together with RLS policies.

**Shared content (written by the server, read by everyone)**

| Table | Holds | Key columns |
| --- | --- | --- |
| `curriculum_sessions` | Every lesson in order, plus Saturdays, Sundays, checkpoints (Z1 → B1 now, B2 and C1 later) | seq, code, kind, phase (the plan's level), grammar, theme, goal, word_target |
| `card_templates` | Pre-generated word cards per lesson (the shared deck) | session_code, en, article, de, plural, example, example_en, audio_url |
| `question_bank` | Test questions per lesson (multiple choice, gap fill, ordering, typing) | session_code, skill, type, prompt, answer, distractors |
| `game_words` | Word lists for games by level | level, article, word, en, hint |

**Lessons (written by the server, read by everyone; a lesson is visible only when published)**

| Table | Holds | Key columns |
| --- | --- | --- |
| `lesson_parts` | One row per lesson part (the 14 parts as validated JSON), each with its Opus review status | session_code, part, content, review_status (ok/fixed/needs-human), reviewed_by_model, template_version |
| `lesson_publications` | A lesson is published only when all parts exist and every one is ok or fixed (a database trigger enforces it) | session_code, published_at |

**Per learner (row-level security: own rows only)**

| Table | Holds | Key columns |
| --- | --- | --- |
| `profiles` | Name, avatar, level, current session pointer, day counter, settings, timezone | user_id, display_name, role, session_seq, day_count, start_code, voice_on, reminder_time |
| `cards` | The learner's own deck: copies of templates + Buddy-made cards from their mistakes. A copy keeps its `template_id`; a template fix updates it unless the learner edited the card | user_id, kind (word/say/answer), en, article, de, plural, example, tip, source, session_code, locked, template_id, user_edited |
| `card_srs` | Spaced-repetition state per card | card_id, due_at, interval_days, ease, reps, lapses |
| `reviews` | Every flashcard answer. Offline sync conflict rule: the latest `reviewed_at` wins | card_id, grade (again/hard/good/easy), reviewed_at, ms_taken |
| `lessons` | One row per lesson run | session_code, day_number, status, started_at, closed_at |
| `lesson_logs` | The 3-line log from Close Day | lesson_id, covered, mistakes, carry_over |
| `mistakes` + `mistake_answers` | Every error found (exercises, writing, tests, Tandem, speaking). Clears only after 3 correct answers on different days | user_id, item_ref, said, correct, why, grammar_key, source, created_at, cleared_at; mistake_id, correct, answered_on |
| `grammar_srs` | Spaced repetition per grammar point (same engine as cards) | user_id, grammar_key, due_at, interval_days, ease, reps, lapses |
| `lesson_progress` | Which parts of today's lesson are done, with scores and answers | user_id, session_seq, part, status, score, answers |
| `mission_reports`, `stories` | Real-world mission reports with Buddy's correction; graded stories made from the learner's words | user_id, session_code, report, correction; level, words, text |
| `weak_spots` | Grouped recurring mistakes with ⟳ counter | user_id, text, repeats, status (active/fixed), last_seen |
| `chats` + `messages` | Lesson and Tandem conversations (summarised after 30 days) | mode, session_code, role, content, tokens_in, tokens_out |
| `tests` + `test_answers` | Every self-test and its items | kind, score, max, per-skill breakdown; question_id, given, correct |
| `tandem_sessions` | Tandem scenario, feedback, cards added | scenario, did_well, mistakes, summary |
| `xp_events` | Every treat earned | user_id, reason, amount, created_at |
| `friendships` | Friend requests and accepted friends | user_id, friend_id, status |
| `push_subscriptions` | Device push endpoints | user_id, endpoint, keys |

**Games**

| Table | Holds | Key columns |
| --- | --- | --- |
| `game_rooms` | A room with code, game type, level, host, state | code (6 letters), game, level, host_id, status, expires_at |
| `game_players` | Members and guests in a room | room_id, user_id (null for guests), nickname, score |

**Safety and admin**

| Table | Holds | Key columns |
| --- | --- | --- |
| `ai_usage` | Every AI call: who, model, tokens, cost | user_id, model, purpose, tokens_in, tokens_out, cost_usd |
| `shield_flags` | Blocked off-topic or jailbreak attempts | user_id, message_excerpt, reason |
| `waitlist` | People waiting after the 30-member cap | email, created_at, approved |
| `feedback` | Messages from the Me → Send feedback button | user_id, message, created_at |
| `content_reports` | "Report a mistake" on a card, exercise or lesson part. Members can only add reports; only admins read them (admin review screen) | user_id, kind, ref, session_code, message, status (open/fixed/dismissed), resolved_by, resolved_at |

Daily quotas and the leaderboard are computed from `ai_usage` and `xp_events` (database views), so no extra tables are needed.

## 6. Security, privacy and German law

The rule: the browser is never trusted. Every permission is checked in the database (row-level security) and every AI call goes through the server, which checks login, 2FA, quota and the shield first.

**Accounts and access**

- Email + password (min. 10 characters, checked against Have I Been Pwned by our server, because Supabase's own leaked-password toggle is Pro-only) or Google sign-in.
- 2FA required for every member: authenticator app (TOTP) through Supabase MFA; no AI or data access until 2FA is set up.
- Email confirmation before first login; captcha (Cloudflare Turnstile) on sign-up and password reset. Supabase's built-in CAPTCHA also covers sign-in, so the login page carries the widget too.
- Session cookies are HTTP-only and secure (all auth runs on the server); they expire after 7 days without a visit (Supabase's inactivity timeout is Pro-only). 2FA is enforced in `proxy.ts`, in every server page/action/route, and in the database (RLS requires an `aal2` session).
- Signup closes automatically at 30 members; new people land on the waitlist.

**Protecting your money and the AI**

- Anthropic and Azure keys exist only as Vercel environment variables (and in the local, git-ignored `.env.local`), never in the browser or the repo.
- Rate limits per user and per IP on every API route.
- Daily AI quota per member; admin unlimited. Prepaid Anthropic credits with auto-reload off act as the hard spending cap.
- The shield (section 2) blocks non-learning use before it costs anything.

**Data and the app itself**

- Row-level security on every table; tested with automated tests that try to read another user's data. The RLS test harness is built in slice 1 and runs in CI on every push.
- Input validation (zod) on every API route; all text escaped on display. Buddy's tools (add card, log mistake, update weak spot, close day) use shared zod schemas with length caps, because learner text flows into them.
- Security headers: Content-Security-Policy, HSTS, no iframes from other sites. Sentry and these headers are set up in slice 1.
- Automated tests check that account deletion removes every row and that data export is complete.
- Guests in games get a random ID, store nothing, and can only send moves and emoji.
- Dependabot alerts on the GitHub repo; secrets scanning on.
- Backups: the Supabase Free plan has NO automatic backups, so a manual `npm run backup` (three dumps in ~/backups/deutschmitbuddy, never in the repo) runs before every release; daily backups and point-in-time recovery come with the Pro plan.

**GDPR and German law (to set up before going public)**

- **Impressum** (§ 5 DDG): full name, postal address, email. Raghav uses his own address for now; it will be public. Re-check before the public launch.
- **Datenschutzerklärung**: what is stored, why, how long, which processors (Supabase EU, Vercel, Anthropic, Azure, Resend, Google sign-in), users' rights, contact.
- **Nutzungsbedingungen** (terms): 16+, fair use, no abuse, account removal.
- Data processing agreements (AVV/DPA) accepted with each provider in their dashboards.
- Only essential cookies, no tracking, so no cookie banner is needed. Analytics, if added, must be cookie-free.
- Users can export all their data and delete their account in one click; deletion removes all rows.
- **Wording:** the product is "AI-based personalised German practice", never "official" or "certified". Mock exams are original, "modelled on the Goethe/telc format", with the line "not affiliated with Goethe-Institut or telc".
- **AI transparency (EU AI Act, Art. 50):** Buddy is always labelled as an AI, with "can make mistakes" and a report button, on every screen where he writes or speaks.
- **Pronunciation:** recording only after explicit consent, recordings are never stored; any third-party assessment (Azure) is a per-user opt-in.
- Not legal advice: have the Impressum and privacy policy checked before the public launch.

## 7. Costs and limits

Everything except AI and the voice is free at this scale. Lessons are pre-generated once, so the live AI per learner is small (about $0.3–1.1 a month for a daily learner, see below); the one-off content generation is the larger cost. A budget guard keeps the total near €15–20.

**Fixed monthly costs**

| Item | Cost |
| --- | --- |
| Vercel Hobby, Supabase free, Resend free, Sentry free, Cloudflare Turnstile | €0 |
| Domain deutschmitbuddy.de | ~€1 (≈€10/year) |
| Neural TTS voice | ~€2–5 |
| One-off: all 14 parts of the 90 lessons Z1 → B1, four Sonnet passes (write, incl. rewrites after the free checks) + Opus (check every item), Batch API | ~$31 expected in total (the Z1–Z3 sample ≈ $1.4 + the other 87 lessons ≈ $29: Z4 → A1 $7.9, A2 $6.7, B1 + exam prep $14.4); theoretical worst case ~$45; run in three tranches, each pass under €10 |
| One-off, later (slice 13): B2–C1 outlines and lessons | ~$17 expected |

**Live AI per activity (approximate, with prompt caching)**

| Activity | Model | ≈ cost each |
| --- | --- | --- |
| Writing correction, every error explained | Opus 5.5 / Sonnet 5.5 / Haiku 5.5 | $0.055 / $0.027 / $0.001 |
| Tandem chat (15 min) incl. end feedback and shield | Haiku 5.5 | ~$0.004 |
| Buddy's answers (5 questions) | Haiku 5.5 | ~$0.001 |
| Day exam: grading the short writing and speaking parts | Haiku 5.5 | < $0.001 |
| Mistake-based exercises, mission report, morning summary | Haiku 5.5 | < $0.001 each |
| Graded story | Sonnet 5.5 | ~$0.008 |
| Lesson parts, exercises, flashcards, games, practice drills | none (pre-generated) | $0 |

Per learner who studies every day for a month: about $1.1 with Sonnet writing correction throughout, **$0.6 with the default guard** (10 Sonnet corrections, then Haiku), $0.3 in budget mode. Raghav (Opus writing, more use): about $2.7.

**Budget guard (built into the server)**

- Monthly AI budget set in the admin page (start: $20). Spend is tracked live in `ai_usage`. **Admin (Raghav) spend is tracked separately and never counts toward this member budget**; the limits below apply to members only.
- Members: up to 10 Sonnet writing corrections per month, then they switch to Haiku automatically; Tandem within a daily cap (3 chats).
- When 80% of the monthly budget is used, all members switch to Haiku and Raghav gets an email; at 100% member AI pauses until the 1st.
- Anthropic: prepaid credits, auto-reload off, key scoped to the `deutschmitbuddy` workspace, key expires 28 Feb 2027 (rotate before).

Pricing (Claude API, checked 19 Oct 2026): Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50 per million input / output tokens; Batch API −50%. Content generation passes are capped at €10 each (worst case, by token limits), show a cost estimate first and wait for approval. Model IDs (verified in the current SDK): `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`.

## 8. Build order

**Status (23 Oct 2026):** slices 0, 1, 2 and the redesign (design-v1.1) are done and live. Slice 3a (lesson standard, generator v2, preview) is done. Slice 3b is built on branch `slice-3-curriculum` (PR open, not merged): tranche 1 (Z4 → W4.5) is generated and reviewed (€6.39), 19 of 30 lessons including Z1–Z3 are published to the local database, 11 wait for the Opus re-review of their corrected items (submitted), then publish; cards unlock per lesson with `template_id`, corrections propagate to every copy, the Learn tab reads published lessons, and the admin seed import sets his pointer to Day 11 · Z9. Not yet done: hosted database (the steps and rollback are in `docs/RELEASE-slice-3.md`; waits for Raghav's go), tranches 2–4 (A2, B1, exam prep: need an API credit top-up), slice 3c, then the lesson player 4a–4e. Details and resume steps: CLAUDE.md, "Where we are".

The app is built in 14 slices (3 and 4 split into small steps), each one working end to end and deployed before the next starts. At 1–2 slices per evening the whole v1 takes about two weeks.

0. **Setup** — git repo (remote github.com/RaGHaV-186/deutsch-mit-buddy), Next.js + Supabase connected, theme, `.env.example`, GitHub Actions CI (lint, test, build on every push and PR), Vercel previews, a live "Hallo! Ich bin Buddy." page on Vercel. Done when the URL loads on Raghav's phone and CI is green.
1. **Accounts** — sign-up/login (email + Google), required 2FA, captcha, 30-member cap + waitlist, profiles, starting-point picker, legal page skeletons, RLS test harness in CI, Sentry, security headers, feedback button + `feedback` table. Done when Raghav can sign up with 2FA on his phone and the RLS tests pass in CI.
2. **Flashcards** — the card format (see CLAUDE.md), spaced repetition, Words/Speaking modes, audio + slow, Raghav's 213 existing cards imported from data/seed-cards.json, offline queue. Done when today's cards can be reviewed offline.
3. **Lesson content (Z1 → B1)** — the 131 sessions of `data/curriculum.ts` in the database and all 14 lesson parts for the 90 lessons, as a schema-enforced template (a lesson publishes only when every part exists and passed the Opus check). Sonnet 5.5 writes (in four small passes), Opus 5.5 checks every item (ok / fixed / needs-human with the reason; only ok and fixed go in), free automatic checks run before and after, and a preview page shows everything. Every paid pass shows a cost estimate first (€10 cap per pass). Split into small steps:
   - **3a** Template, generator and Z1–Z3 sample. Done when Raghav approves the sample.
   - **3b** The rest in tranches (A1 first, then A2, B1), publish, unlock cards per lesson (a later starting point gets earlier lessons' cards as already seen and spread over days) with `template_id`, and propagation of template corrections to every copy without touching SRS or user-edited cards. Done when Day N shows the right lesson and cards. Built for tranche 1: publish by slot (card templates and questions are identified by lesson + position, so a correction replaces the row), unlock on onboarding / app open / seed import with a duplicate check on kind + German, the Learn tab and a read-only lesson page (the questions come with the player in 4a). Tranches 2–4 only need `generate`, `review`, `publish`.
   - **3c** "Report a mistake" on cards and exercises, `content_reports` (admins only) with a simple admin review screen, the AI label and legal wording, and B2/C1 shown as "coming soon" in the starting-lesson picker.
4. **Daily lesson loop** — in small slices, each working end to end:
   - **4a** Lesson player without AI: the 14 parts from published content, progress, automatic mistake capture, busy-day mode, Close Day with the Covered / Mistakes / Carry over log.
   - **4b** Mistake log (clears after 3 correct answers on different days), grammar spaced repetition, the warm-up, the day exam (objective parts graded without AI), article-drill round in the lesson.
   - **4c** AI foundation: `ai_usage`, quotas, budget guard (members only; admin tracked separately), shield, model routing, shared zod tool schemas, the AI label; Buddy's answers (Haiku).
   - **4d** Writing correction (every error explained, errors into the mistake log), real-world mission reports, grading the day exam's writing and speaking parts.
   - **4e** Tandem with Buddy, text mode: partner not teacher, no interruptions, feedback list into the mistake log.
5. **Tracker** — **5a** logs, weak spots, test scores, curriculum map, skill meter, morning summary in the app, "What Buddy knows about me", export tracker.md, Raghav's history imported from data/seed-tracker.ts (done when the export matches his Project tracker). **5b** placement test at onboarding (sets the starting lesson) and graded short stories.
6. **Voice + Tandem voice** — starts with an iOS voice spike (TTS playback, speech recognition, Azure Speech-to-Text fallback), then Buddy's neural voice, audio for listening and dictation, pronunciation focus with browser speech recognition (consent first, recordings never stored), voice Tandem. Done when a 10-minute voice Tandem works on a phone.
   Plan for slice 6 (plan only, nothing is built before the slice starts):
   - **Tandem = Claude live as Buddy**: text in slice 4e, voice in slice 6. The voice version reuses the same Tandem engine; only the input (speech to text) and output (text to speech) change.
   - **Speech-to-text must be VERBATIM.** It has to keep the learner's grammar mistakes ("Ich bin gehen", wrong endings, wrong word order) so Buddy can correct them; a service that silently "fixes" the sentence makes the feedback useless. Spike: test 2 to 3 services with Raghav's own recordings that contain deliberate mistakes: the browser's Web Speech API, plus e.g. OpenAI transcription, Deepgram, Google or Azure STT. Compare how many mistakes each keeps (and word error rate on correct speech), latency, iOS support and cost; pick the one that preserves mistakes best at a reasonable price. Recordings made for the test are not stored in the repo.
   - **Two tiers as a per-user flag**: premium STT + a natural German neural TTS voice (on for Raghav); the browser's STT/TTS for everyone else. A daily speaking cap per user (minutes, set in the admin page) protects the budget. Recordings are never stored: only the text and the scores are kept. A typed fallback stays everywhere voice is used.
   - **Cost table** (10 minutes of speaking a day = 300 minutes a month per user; Buddy's spoken replies about 6,000 characters a day = 180,000 a month; Tandem text model Haiku ≈ $0.09 a month; approximate list prices from memory, to be re-checked in the spike):

     | Setup | STT | TTS | Model | Per user / month | 30 users / month |
     | --- | --- | --- | --- | --- | --- |
     | Browser STT + browser TTS (everyone, default) | $0 | $0 | $0.09 | **≈ $0.1** | **≈ $3** |
     | Premium: OpenAI transcription ($0.006/min) + Azure neural TTS ($16 per 1M chars) | $1.80 | $2.88 | $0.09 | **≈ $4.8** | ≈ $143 if all 30 had it |
     | Premium: Deepgram ($0.0052/min) + Azure neural TTS | $1.56 | $2.88 | $0.09 | ≈ $4.5 | ≈ $136 |
     | Premium: Azure STT ($1/hour) + Azure neural TTS | $5.00 | $2.88 | $0.09 | ≈ $8.0 | ≈ $239 |
     | **Plan: Raghav premium, 29 members on the browser** | | | | | **≈ $7.4** (4.8 + 29 × 0.09) |

     So premium for everyone is not affordable inside the €15 to 20 budget: it stays a per-user flag (on for Raghav) with the daily cap, and could later be switched on for individual members.
7. **Tests** — Sunday tests assembled from the week's lessons, original mock exams every 4 weeks (generated with the same two-pass pipeline, "modelled on the Goethe/telc format"), checkpoint tests, Mistake Grind, scores saved. Done when a test result lands in the tracker.
8. **Practice** — typing quiz, Diktat, numbers & time drill, word-order builder, Hörverstehen (the lesson exercise engines, available on their own).
9. **Games** — rooms with codes, guests, live sync via Supabase Realtime, Hangman, der/die/das race (the article-drill engine), quiz battle; server validates scores. Done when two phones play one game.
10. **XP + friends** — treats, streaks, friends, leaderboards, daily challenge.
11. **Reminders** — Web Push (VAPID), the morning summary and the Sunday report email via Resend, triggered hourly by Supabase pg_cron + pg_net calling a secret-protected API route.
12. **Hardening + launch** — extra security tests (account deletion and data export tests), Playwright browser tests, final legal texts (Impressum re-check, AI and exam wording), final Buddy artwork, custom domain deutschmitbuddy.de, then the LinkedIn post.
13. **B2–C1 content** — starts with the B2 and C1 lesson outlines (grammar, theme, goal) for Raghav's review, and nothing is generated before he approves them. Then the same 14-part template and two-pass pipeline (instructions fully German from B2). Until then B2 and C1 are visible but not selectable in the starting-lesson picker ("coming soon").

**Later (not in v1):** Azure Pronunciation Assessment as a per-user flag (consent first, no stored recordings); Tandem with real people; a noun-gender check against a German noun dictionary in the free content lint (today the lint cannot tell that "die Lampe" is right and "der Lampe" as a card article is wrong; only the Opus review catches a wrong gender), with a licence-friendly word list and its plural forms, so a wrong article on a vocabulary card, example or exercise is an error before any review money is spent.

Design can change at any time: colours, fonts and spacing live in one theme file.

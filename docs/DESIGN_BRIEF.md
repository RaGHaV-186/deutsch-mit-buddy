# Deutsch mit Buddy — Design brief for Claude Code

Save this file in the project as `docs/DESIGN_BRIEF.md`. Reference screenshots live in `docs/design/`. Mascot and icon assets are already in `public/buddy/`.

---

## Your task

You are working in my existing **Next.js PWA** "Deutsch mit Buddy", a German-learning app (A1 → C1) where an AI teacher dog named Buddy runs lessons, flashcards, tests and multiplayer word games. Already built: **login with 2FA, Home, Flashcards**.

Redesign **every screen, starting from the login page**, to the approved design below ("Blaze × Coat × Belly Up — slightly gamified"). The first thing a user sees (splash, login, 2FA) must already feel like the finished app.

**Do not change auth/2FA logic, API routes, data fetching, database schema or spaced-repetition logic** unless a phase explicitly says so — this is a design + UI layer change. If a design change seems to require a logic change, stop and ask me first.

Look at the reference images in `docs/design/` before building each screen and match them closely: spacing, sizes, colours, shapes. Where the images and this brief disagree, this brief wins.

### How to work
- Work in **phases**. At the start of each phase, give me a short plan. At the end: run build + lint (and existing tests), fix errors, **commit** with a clear message, tell me what changed and exactly which URL/screen to open to review it. **Then stop and wait for my "go"** (or corrections) before the next phase.
- Prefer extending what already exists over adding libraries. Ask before adding any new dependency.
- Never invent colours, fonts or radii outside this brief.

---

## Scope update (supersedes the phases below where they differ)

The redesign covers only what exists today (slices 1 and 2: accounts, 2FA, Home, Flashcards). Game-layer UI is built, but gets real data later.

- **Feature flag:** `NEXT_PUBLIC_GAME_LAYER` (off by default; on in development and on `/design`). Everything gamified (treats, "+N treats" labels, level, streak, combo) is hidden when it is off. **No mock numbers in production.**
- **Phase 4 (auth):** done.
- **Phase 5 (Home):** real data only: today's lesson, cards due, Continue. Streak, level and "+N treats" are behind the flag.
- **Phase 6 (Flashcards):** same rule for the combo chip and the treat labels on the grade buttons.
- **Phase 7 (other screens):** minimal. "Coming soon" placeholders for Learn and Play, and a small Me screen with the theme switch, legal links, feedback and log out (moved from the temporary row).
- **Sunday is a test day** in the curriculum (`SUN`), not a rest day. There is no rest-day state and no "Sunday is a rest day" copy anywhere. Streak rules (what counts as a day, what Sunday does) are decided in slice 10.
- **Phase 8 (game layer logic): skipped.** It belongs to slice 10 (XP + friends). The UI pieces (`PawStreakWeek`, `LevelCard`, `TreatChip`, the combo chip) already exist in `@/components/ds` and only need data then.
- **Phase 9 (QA):** only for what exists, then merge.

---

## The design in one paragraph

Inspired by my blue-grey-and-white pit bull, Buddy — felt in the details, never cartoonish. Calm, Apple-level restraint, lots of white space. Each main screen has a **blue-grey "coat" block** on top (rounded only at the bottom, uneven: `0 0 40px 72px`) and white below, joined by the **"blaze notch"**: a narrow white wedge rising from the white area into the grey block, like the white stripe on his face. Everything tappable below the block is a soft **"cushion"** (rounded card with a soft double shadow). Progress bars are **wedges** (thin on the left, full height on the right). **Belly-pink** is reserved for rewards and the active tab. A light game layer: treats (XP), levels, a weekly paw streak, a combo counter, and Buddy saying one German line per day.

---

## Phase 0 — Audit (no code changes)

1. Report: Next.js version; App Router or Pages Router; styling approach (Tailwind? CSS modules? UI library?); current theming/dark mode; where Splash/Login/Sign-up/2FA/Forgot-password, Home, Flashcard and any other screens live; shared components; how flashcard data, user profile and progress are stored; existing tests.
2. Confirm `public/buddy/` contains the asset files listed in Phase 3 and `docs/design/` contains the reference images.
3. Propose how to map this brief onto the stack (e.g. CSS variables + Tailwind theme extension).
4. List risks — anything that would need logic changes.

---

## Phase 1 — Design tokens, font, themes

### Font
- **Plus Jakarta Sans** via `next/font/google`, weights 400, 500, 600, 700, 800. One family for everything.
- Type scale (px / weight / letter-spacing):
  - `display` 30–32 / 800 / -0.03em (greetings, auth titles)
  - `title` 28 / 800 / -0.02em (lesson title)
  - `word` 44 / 800 / -0.03em (flashcard headword)
  - `headline` 16–17 / 700–800
  - `body` 15–18 / 500 (inputs always ≥ 16px to stop iOS zoom)
  - `label` 13 / 700 / +0.06em uppercase (e.g. "DAY 11 · Z9")
  - `caption` 12–13 / 500
- `font-variant-numeric: tabular-nums` for counters and codes.

### Colour tokens — CSS variables, light + dark

Dark mode follows `prefers-color-scheme`, with a manual override (`data-theme="light|dark"` on `<html>`, persisted, no flash on load). Expose tokens to Tailwind if Tailwind is used.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F2F3F5` | `#16191E` | page ground |
| `--surface` | `#FFFFFF` | `#20252B` | cushions, cards, inputs, tab bar |
| `--text` | `#1F242A` | `#F2F1EE` | primary text |
| `--muted` | `#5C646E` | `#A3ABB5` | secondary text, placeholders |
| `--track` | `#E1E4E8` | `#2E343C` | empty progress, inactive paws, input borders |
| `--coat` | `#5E6875` | `#333B46` | coat block, primary buttons below the block, progress fill, focus ring |
| `--coat-track` | `#7D8693` | `#4A5360` | progress track on coat |
| `--on-coat` | `#FFFFFF` | `#F2F1EE` | text on coat |
| `--on-coat-muted` | `#E3E6EA` | `#C2C8CF` | secondary text on coat |
| `--bubble` | `#4A535F` | `#454E5B` | speech bubble / combo chip on coat |
| `--blaze` | `#F7F5F1` | `#E9E7E2` | primary button ON the coat block |
| `--on-blaze` | `#2F3741` | `#16191E` | text on blaze buttons |
| `--tint` | `#F1D3CC` | `#43363A` | belly-pink: reward chips and active tab ONLY |
| `--on-tint` | `#1F242A` | `#F2F1EE` | text on tint |
| `--der` | `#2457A8` | `#8DB4F2` | masculine article |
| `--die` | `#B83A32` | `#F29A90` | feminine article; also error text (always with icon) |
| `--das` | `#2B7550` | `#7CCB9C` | neuter article; also success text (always with icon) |

Shadows:
- `--cushion` light: `0 1px 2px rgba(30,40,55,.06), 0 14px 30px -14px rgba(30,40,55,.22)`
- `--cushion` dark: `inset 0 1px 0 rgba(255,255,255,.05), 0 14px 30px -12px rgba(0,0,0,.6)`

Rules:
- All text pairs pass WCAG AA (≥ 4.5:1). Don't add colours; ask if you think one is needed.
- **der/die/das colours only on `--surface`/`--bg`, never on the coat block.**
- No decorative gradients, no confetti, no emoji in UI.
- `theme-color` meta: light `#5E6875`, dark `#333B46` (the status bar blends into the coat block).

### Radius, spacing, sizes
- Coat block: `border-radius: 0 0 40px 72px`. Card coat strip: `0 0 28px 56px`.
- Cushion cards 24–32px · inputs 16px · buttons fully rounded pills · tab bar 34px pill.
- Spacing scale 4, 8, 12, 16, 20, 24, 32. Screen side padding 20–22px. Content max-width 480px, centred on wide screens (laptop shows the same phone-width layout centred on `--bg`).
- Tap targets ≥ 44×44; primary buttons 56px; inputs 56px; grade buttons 60px.
- Respect safe areas (`env(safe-area-inset-*)`).

### Icons
- 24px grid, 2px stroke, round caps/joins, `currentColor`. Use the existing icon set if it can do this (e.g. Lucide strokeWidth 2), else inline SVG.
- Custom: **paw** (filled; streak/combo) and **bone** (outline; treats).

### Motion
- 200–300ms ease-out, slightly springy. Reward animations < 600ms. Honour `prefers-reduced-motion`.
- Cushion/button press: translateY(2px) + reduced shadow.

---

## Phase 2 — Shared components

Build reusable components (adapt names to project conventions) and a dev-only **`/design`** route showing all of them in light and dark.

1. **`CoatHeader`** — blue-grey block, radius `0 0 40px 72px`, padding `max(58px, safe-area-top + 20px) 22px 44px`; renders `BlazeNotch` at bottom centre. Variant `compact` (padding-bottom 36px) for auth screens.
2. **`BlazeNotch`** — inline SVG 48×30, `position:absolute; bottom:-1px; left:50%; margin-left:-24px`, `polygon points="21,0 27,0 48,30 0,30"`, fill = colour of the area below (`--bg`, or `--surface` inside a card). Small variant 40×24 (`17.5,0 22.5,0 40,24 0,24`).
3. **`WedgeProgress`** — props `value` 0–1, `height` 12–14, `onCoat`, optional `marker` (paw at fill end). Track: `clip-path: polygon(0 36%, 100% 0, 100% 100%, 0 64%)`, bg `--track` (or `--coat-track` on coat); fill bg `--coat` (or `--on-coat`). `role="progressbar"` + aria values.
4. **`Cushion`** — `--surface`, radius prop (default 24), `--cushion` shadow; interactive version renders `<button>`/`<a>` with press state.
5. **`PillButton`** — variants `blaze` (on coat), `coat` (primary below the block), `cushion` (secondary), `outline-on-coat`, `ghost` (text link style, `--text`, underline on hover). Sizes 44/56/60. Loading state = small spinner + disabled, keeps width.
6. **`TextField`** — label above (13/700, `--text`), 56px field, `--surface`, radius 16, 1px inset `--track`, 16px text; focus = 2px ring `--coat` with 2px offset; error = border `--die` + message with icon below; optional trailing button (e.g. show/hide password, 44px).
7. **`CodeInput`** — 6 boxes (48×56, radius 14, Cushion style, 24/800 tabular), auto-advance, backspace goes back, paste of a 6-digit code fills all, `inputMode="numeric"`, `autocomplete="one-time-code"`; error state shakes once (unless reduced motion) and uses `--die` borders.
8. **`TreatChip`** — pill, bg `--tint`, text `--on-tint`, 12px/700, e.g. "+50 treats".
9. **`SpeechBubble`** — on coat: bg `--bubble`, text `--on-coat`, radius `16px 16px 16px 4px`, 14px/600; German text in „…“ quotes. Variant on white: bg `--surface` + cushion shadow, text `--text`.
10. **`FloatingTabBar`** — detached pill (margin `0 16px max(28px, safe-area-bottom + 12px)`), height 68, `--surface`, `--cushion`. Tabs: Home, Learn, Cards, Play, Me. Active = pill (52 high, padding 0 16) bg `--tint`, icon + label (14/700, `--on-tint`); inactive = icon only, 52×52, `--muted`, with `aria-label`. Optional 8px dot badge (`--coat`, 2px ring `--surface`).
11. **`PawStreakWeek`** — Cushion: "{n}-day streak" (16/800); 7 columns Mo Di Mi Do Fr Sa So; 34px circles with filled paw: done = `--coat` bg + `--on-coat` paw; today not done = `--tint` bg + 2px ring `--coat`; future/missed = `--track` + `--muted`.
12. **`LevelCard`** — "Level {n}" (16/800) + "1,240 / 1,500" (12, muted), WedgeProgress, "260 treats to Level 4".
13. **`DueCardsTile`** — Cushion link: number (26/800), "cards due", "Review →".
14. **`ArticleWord`** — noun with article coloured by gender from data (`der`/`die`/`das` → token). Plural articles use `--muted`.
15. **`BuddyMascot`** — `pose`: `neutral | talking | curious | happy | resting | listening`; `size`. Renders `/buddy/buddy-{pose}.svg` with `next/image` (decorative → `alt=""`).
16. **States:** `Skeleton` (rounded blocks in `--track`, gentle pulse), `EmptyState` (BuddyMascot + one line + one PillButton), `ErrorState` (BuddyMascot curious + message + Retry), `Toast` (Cushion pill at top, icon + text, auto-dismiss 3s).

---

## Phase 3 — Assets, PWA, splash

`public/buddy/` already contains:
- Poses: `buddy-neutral.svg`, `buddy-talking.svg`, `buddy-curious.svg`, `buddy-happy.svg`, `buddy-resting.svg`, `buddy-listening.svg`
- Icons: `buddy-icon-light.svg` + `buddy-icon-light-{1024,512,192,180}.png`, same for `buddy-icon-dark`
- Glyph: `buddy-glyph.svg`, `buddy-glyph-512.png`

Do:
- PWA manifest: name "Deutsch mit Buddy", short_name "Buddy", `theme_color` `#5E6875`, `background_color` `#F2F3F5`, icons 192 + 512 (`buddy-icon-light-*.png`) and a 512 `"purpose": "maskable"` entry; `display: standalone`.
- `apple-touch-icon` = `buddy-icon-light-180.png`; favicon from `buddy-glyph.svg`.
- **Splash / first load**: full-screen `--coat` background, `BuddyMascot pose="neutral"` 120px centred, "Deutsch mit Buddy" (20/800, `--on-coat`) below, no spinner unless > 1s.
- Do not edit the SVG artwork.

Pose usage:
| Pose | Where |
|---|---|
| neutral | splash, login, Home default, empty states |
| talking | speech bubbles, lesson intros, sign-up |
| curious | wrong answer, wrong 2FA code, errors |
| happy | Home header, correct streaks, level-up, successful login |
| resting | Sunday rest-day, nothing due, offline |
| listening | audio / Hören exercises |

---

## Phase 4 — Auth flow (first impression — make it great)

All auth screens share one layout: **CoatHeader (compact)** with Buddy + title + one line from Buddy, BlazeNotch, then a white area with the form (padding 22px, gap 16px), primary action at the bottom of the form. No tab bar. Keyboard-safe (the primary button stays visible above the keyboard; the page scrolls rather than squashing).

1. **Login**
   - Coat: `BuddyMascot neutral` (72px) on the right; left: "Willkommen zurück!" (display) + SpeechBubble „Schön, dich zu sehen!“ (small English line under it, `--on-coat-muted`: "Good to see you!").
   - Form: TextField "E-Mail" (`type=email`, `autocomplete=email`), TextField "Passwort" with show/hide button (`autocomplete=current-password`), right-aligned ghost link "Passwort vergessen?".
   - PillButton `coat` 56px full width: "Anmelden" (loading state while submitting).
   - Below: "Neu hier? **Konto erstellen**" (ghost link).
   - Errors: inline under the field + Buddy switches to `curious`. Never clear the email on error.
   - Labels: German first with English helper text in captions where useful (it's a learning app); keep it consistent across auth screens.
2. **Two-factor (2FA)**
   - Coat: `BuddyMascot listening` or `neutral`; "Nur noch ein Schritt" + caption "Enter the 6-digit code from your authenticator app" (or SMS/email — match the existing method).
   - `CodeInput` (6 boxes), auto-submit when complete; "Code erneut senden" with a countdown ("in 0:30") if the method supports resend; "Andere Methode" link if backup codes exist.
   - Wrong code: CodeInput error state, message "Der Code stimmt nicht. Try again.", Buddy `curious`.
   - Success: Buddy `happy` for ~500ms, then go to Home.
3. **Sign up** (if it exists): same layout, Buddy `talking`, „Lass uns anfangen!“; fields as existing; password strength as a WedgeProgress (`--die` → `--coat` → `--das`) with text label.
4. **Forgot password** (if it exists): Buddy `curious`, one email field, success state with Buddy `happy` + "Check your inbox".
5. Optional, only if the logic exists: "Mit Passkey anmelden" as `cushion` button.

**Do not change any auth/2FA logic, validation rules or redirects.**

---

## Phase 5 — Home

1. **CoatHeader**:
   - Row: left `h1` "Hallo, {firstName}!" (30/800) + SpeechBubble with today's line (e.g. „Heute bestellen wir Kaffee!“); right `BuddyMascot happy` ~58px.
   - Lesson: label "DAY {n} · {lessonCode}" (`--on-coat-muted`) + TreatChip "+{reward} treats"; title (28/800) e.g. "Essen & Trinken".
   - **Continue** — PillButton `blaze`, full width, 56px.
   - BlazeNotch.
2. Content (padding 20, gap 12): **PawStreakWeek**; then two columns: **LevelCard** (1.4fr) + **DueCardsTile** (1fr).
3. **FloatingTabBar**, Home active.
4. States: loading = skeletons in the same layout (see docs/known-issues.md: no route-level `loading.tsx` for now). ~~Sunday rest day state~~ removed: Sunday is a test day (see Scope update).

Review data: Raghav, Day 11 · Z9 · Essen & Trinken, +50 treats, 10-day streak (Mon done, Tue today), Level 3 (1,240 / 1,500), 29 cards due. Use real data where it exists; otherwise a clearly marked mock.

---

## Phase 6 — Flashcard

Focus mode, **no tab bar**.

1. Top bar (padding `56px 20px 0`, gap 14): round Close (44px Cushion, X icon, `aria-label="Close"`); WedgeProgress (flex 1, height 12, paw marker at fill end); "{n} left" (14/700).
2. Card = Cushion radius 32, overflow hidden, flex 1, margin `24px 20px 20px`:
   - Coat strip (`--coat`, radius `0 0 28px 56px`, padding `20px 18px 40px`): left combo chip (bg `--bubble`, paw + "{k} in a row", only when k ≥ 3); right **Play** (`blaze`, speaker icon) + **Slow** (`outline-on-coat`, 0.7× playback). Small BlazeNotch (fill `--surface`).
   - White body, centred: ArticleWord headword (44/800), "Plural · die Kaffees" (16, muted), translation (22/700), example (18/500) + translation (15, muted).
3. Grades: 2×2 grid, gap 10, padding `0 20px 34px`; 60px pills with label (16/700) + reward (12): **Again** "+0", **Hard** "+5 treats", **Got it** "+10 treats" (`coat` variant), **Easy** "+15 treats" (others `cushion`).
4. Keyboard: Space = flip/play, 1–4 = grades.
5. Feedback: "+10" TreatChip floats up (< 600ms); level-up → Buddy `happy` briefly; Again → Buddy `curious` subtly. No sounds by default.
6. End of session: Buddy `happy`, "Fertig! {n} cards reviewed · +{t} treats", PillButton "Zurück zu Home".

Keep existing spaced-repetition logic; only map its grades to these four buttons.

---

## Phase 7 — Every other screen

Apply the system to all remaining screens (Learn, Cards/deck list, Play, Me/profile & settings, lesson screens, any modals):
- Tab screens: CoatHeader (compact) with the screen title + a relevant Buddy pose, content as Cushions below, FloatingTabBar with the right tab active.
- Me/Settings: grouped Cushion lists (rows 56px, chevrons, toggles); include the **theme switch (System / Light / Dark)**; log out as a `ghost` button in `--die` with icon, with confirm.
- Screens not built yet: a tidy `EmptyState` placeholder ("Kommt bald — coming soon") rather than a blank page.
- Loading, empty, error and offline states everywhere (Phase 2 components).

---

## Phase 8 — Game layer (logic, minimal) — SKIPPED, belongs to slice 10 (see Scope update)

Only where not already present; store per user, server-safe:
- **Treats (XP):** lesson complete +50; grades Again 0 / Hard 5 / Got it 10 / Easy 15.
- **Levels:** every 500 treats = 1 level (L1 0–499, L2 500–999, L3 1,000–1,499 …).
- **Streak:** a day counts with ≥ 1 lesson or ≥ 10 reviews. **Sunday never breaks a streak.** Week view Mon–Sun.
- **Combo:** consecutive Got it/Easy in a session; resets on Again.
- **Buddy's line of the day:** one short German sentence tied to today's lesson (lesson data or a static list for now).

Restraint rules:
- Pink only for rewards and the active tab.
- No red badges, no guilt copy ("you'll lose your streak!"), no confetti.
- With the game layer switched off, every screen still works and looks complete.

---

## Phase 9 — QA (report pass/fail for each)

- [ ] Login → 2FA → Home → Flashcard → end of session works end to end; auth behaviour unchanged
- [ ] Light, dark and manual theme switch; no flash of wrong theme; no hard-coded colours outside tokens
- [ ] Text contrast ≥ 4.5:1 (check der/die/das and muted text on both surfaces)
- [ ] Tap targets ≥ 44px; works at 320px and on a 1440px laptop (centred)
- [ ] Safe areas (notch, home indicator) in installed PWA; keyboard doesn't hide the primary button
- [ ] Keyboard navigation + visible focus; icon buttons have aria-labels; progress bars have aria values; CodeInput works with paste and one-time-code autofill
- [ ] `prefers-reduced-motion` respected
- [ ] Lighthouse: PWA installable, accessibility ≥ 90, performance ≥ 85 on mobile
- [ ] Existing tests pass; `/design` shows all components in both themes
- [ ] Screens match the images in `docs/design/`

---

## Quick reference

- Font: Plus Jakarta Sans 400–800
- Coat block `0 0 40px 72px` · card strip `0 0 28px 56px`
- Blaze notch: `21,0 27,0 48,30 0,30` on 48×30, fill = colour below
- Wedge: `clip-path: polygon(0 36%, 100% 0, 100% 100%, 0 64%)`
- Pink = rewards + active tab only · der/die/das = blue/red/green, only on white surfaces
- Primary button: `blaze` on the coat, `coat` below it

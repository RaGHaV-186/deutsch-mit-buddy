# Performance: baseline (perf slice, step 1) and plan

Measured 23 Oct 2026, nothing in the app changed. Budgets are in `CLAUDE.md` ("Performance budgets"). Step 2 (fixes, before/after table, Lighthouse CI, Playwright width tests, Speed Insights) waits for Raghav's go.

## How it was measured (and what could not be)
- **Production, read-only, public URLs only**: response headers, TTFB of `/api/health`, `/login`, static files; Lighthouse on `/login`; DNS of the database host.
- **Local production build** (`next build && next start`, local Supabase) with a throwaway member (deleted afterwards): every outgoing request logged by a fetch wrapper (count + ms), real Chrome via puppeteer, Lighthouse 12.
- **Prod-like server time**: the wrapper can add a fixed delay to each Supabase call. 100 ms = pure Frankfurt↔Washington round trip, 300 ms = what production measures today (see below).
- Phone profile: 390×844, touch, 4× CPU, 170 ms RTT / 9 Mbps ("Fast 4G"). Desktop: 1440×900.
- **Not measured**: a real iPhone / mobile Safari / standalone PWA (no Xcode simulator on this Mac): IndexedDB speed on iOS, the iOS keyboard, iOS scroll fps. Authenticated production pages (no credentials: they are projected from local counts × per-call latency). Real-user data comes from Speed Insights (step 2).

## 1. The biggest finding: the server is on the wrong continent
- Function region: `x-vercel-id: fra1::iad1::…` = edge in Frankfurt, **function in iad1 (Washington DC, the Vercel default)**. No `vercel.json` exists.
- Database: host `db.<ref>.supabase.co` resolves into the AWS `eu-central-1` (Frankfurt) range. Every Supabase call crosses the Atlantic.
- Production timings from here (median of 8, TTFB): static file 78 ms · `/login` (function, no DB) 264 ms · `/api/health` (function + 2 serial Supabase calls) **851 ms** → about 300 ms per Supabase call.

## 2. Calls per screen (warm, after the first unlock; local production build)
Chain depth = calls that must wait for the previous one; each costs one Washington↔Frankfurt trip today.

| Screen | Calls | Chain | What they are |
|---|---|---|---|
| Layout (every full page load; **skipped on in-app taps**, the layout is shared) | 7 (admin 8) | 5 | `auth/user` → `profiles` → unlock: `profiles` again + `lesson_publications` (admin: + `cards` count) → counts: 2 HEAD on `card_srs` + `reviews` |
| Home | 7 | 5 | same as the layout; the page's own repeats are folded together (Next fetch memo + React `cache`) |
| Learn | 9 | 6 | + `lesson_parts`, + card counts, both after the unlock |
| Cards (shell) | 7 | 5 | the page itself needs only user + profile; the layout still does all 7 on a full load |
| Me, Play | 7 | 5 | |
| In-app tab tap (RSC request) | Home 7/5 · Learn 9/6 · Cards 2/2 | | layout skipped, page only; **no data is prefetched** (prefetch requests are 1–2 KB) |
| Grade a flashcard | **0 on the tap** (IndexedDB) | | 3 s later one background `POST /api/cards/sync`: 8 calls, chain 7 (limiter IP → user → limiter user → cards ∥ reviews → srs → update → insert) |
| Open Cards / end of session | `POST /api/cards/snapshot`: 9 calls, chain 5 | | background, but two limiter round trips before any work |
| `proxy.ts` | 0 warm | | session JWT is ES256, verified locally with a cached JWKS (1 fetch per cold instance) |
| Cold path (first request after a lesson is published) | 18 | | unlock copies cards: ~11 extra writes |

Other server facts: every page is dynamic (`connection()` for the CSP nonce, `Cache-Control: private, no-store`, also the legal pages); the unlock reads **all** `lesson_publications` rows (limit 1000) on every request just to learn that nothing is new; the profile is read twice (`getProfile` and the unlock) because they use different clients.

Server TTFB of a full page load, projected by per-call latency (local build, 3 runs, median):

| per Supabase call | /home | /learn | /cards | /me |
|---|---|---|---|---|
| 0 ms (local) | 20 ms | 25 ms | 25 ms | 18 ms |
| **10 ms (function in Frankfurt)** | 97 ms | 122 ms | 100 ms | 95 ms |
| 100 ms (pure Atlantic round trip) | 567 ms | 680 ms | 564 ms | 559 ms |
| **300 ms (measured on production today)** | **1.58 s** | **1.90 s** | **1.57 s** | **1.55 s** |

Add the learner's own round trip (about 100 ms to Washington from Europe) and the 170 ms mobile RTT.

## 3. Bundles (gzip, `route-bundle-stats` + analyzer)
- First-load JS per route: `/home`, `/learn`, `/play` **216 KB**; `/me` 253; `/cards` 260; `/login` 222. **Budget 200 KB: every route is over.** 207 KB of it is shared by every route.
- What is in it (analyzer, `/home`): Next + React runtime 217 KB (includes ~14 KB legacy polyfills Lighthouse flags), **Sentry 78 KB** (core 46, browser 13, utils 12, nextjs 5, web-vitals 3), next-intl/ICU ~8 KB, design system 8 KB, CSS 8 KB, fonts 3 files 56 KB (one used on first paint). `/cards` and `/me` add **zod 33 KB** (client-side validation of the snapshot and sync responses).
- Lighthouse "unused JavaScript": 70–88 KB.

## 4. Lighthouse (local server, so TTFB is ~50 ms: this is the best case for the server)
| Page | Mobile perf / LCP / FCP / TBT | Desktop perf / LCP |
|---|---|---|
| /home | 100 / 1.92 s / 1.04 s / 22 ms | 100 / 0.63 s |
| /learn | 99 / 1.96 s / 1.03 s / 26 ms | 100 / 0.64 s |
| /cards | 99 / **2.06 s** / 0.86 s / 28 ms | 100 / 0.65 s |
| /me | 99 / 1.96 s / 1.03 s / 13 ms | 100 / 0.52 s |
Production `/login`: mobile 93 / LCP 1.51 s / **CLS 0.15**; desktop 95 / **CLS 0.14**. Accessibility 100, best practices 96–100. LCP is already at the 2.0 s budget with a fast server, so the production server time comes on top.

## 5. Interactions (real Chrome, server +100 ms per call)
| Action | Phone (4× CPU, Fast 4G) | Desktop |
|---|---|---|
| Tab tap Home → Learn (tap → painted) | 713–721 ms (event duration up to 664 ms) | 745–753 ms |
| Tab tap Learn → Cards | 301–313 ms | 294–328 ms |
| Tab tap Cards → Home | 597–626 ms | 614–629 ms |
| Start review / flip | 76 ms / 47 ms | 38 ms / 45 ms |
| Grade "Got it" | **79–95 ms** | 48–76 ms |
At 300 ms per call, Home/Learn taps would be about 1.7–2.1 s. **Nothing changes on screen between the tap and the response** (no pending state, no skeleton, no data prefetch), so INP for tab taps is the whole round trip. Grading is already local (IndexedDB) but has only ~5–20 ms of headroom under 4× CPU, and iOS IndexedDB is unmeasured.

React Profiler pass (production profiling build, scratch copy): hydration of `/home` 45 ms (phone) / 8 ms (desktop); a tab tap 9 / 7 ms; opening Cards 28 / 8 ms over 5–6 commits; flip 3 ms; grade 9 ms over 2 commits. **Client rendering is not the problem**; server round trips and JS download are.

## 6. Known issue 1 (streamed Suspense / `loading.tsx` leaves components dead)
Could not reproduce in real Chrome: a minimal Next 16.4.2 + React 19.3.0 app (`loading.tsx`, hand-written `<Suspense>`, plain) hydrated 36/36 loads; the real app with a `loading.tsx` on `/home` (scratch copy, streaming boundary confirmed in the HTML) hydrated 20/20 at 4× CPU with 100 ms simulated latency. The old reports all came from the embedded preview browser (the in-app browser refused `localhost:3300` this time, so the repro could not be run there). Most likely a quirk of that browser, not of the app. Needs one check in **mobile Safari on a real iPhone** before the rule "no `loading.tsx`" is lifted.

## 7. Layout audit (7 widths × 7 app routes + 5 public routes; no screenshots taken)
- No horizontal scroll, no element wider than the viewport, no clipped text, no layout shift locally, inputs are 16 px (no iOS zoom), `viewport-fit=cover` + `interactive-widget=resizes-content` are set.
- Safe areas (Chrome emulation, notch 59 px / home bar 34 px, standalone): content starts at 75–79 px, tab bar clears the bottom by 46 px, grade buttons by 34 px: OK.
- Scrolling at 4× CPU: 291 frames, 0–2 over 20 ms (60 fps) on `/learn/Z4`, `/learn`, `/home`.
- Found: (1) **Turnstile pushes the page by 36–51 px about 2 s after load on production `/login`** (CLS 0.14); the widget container has no reserved height. (2) Touch targets under 44 px: "Show a model answer" toggle (24 px high, `/learn/<code>`), the signup checkbox (24 px, check that its label row is the target), the Terms / Datenschutz links in that row (21 px). (3) Desktop hover: only the sidebar rows, the segmented control and the ghost button have a hover state; the main buttons, cards and links have none (focus rings are global and fine). (4) No `touch-action: manipulation` anywhere. (5) Animation budget: `.ds-press` transitions `box-shadow` (paint, not allowed), `ds-float-up` 550 ms, `ds-shake` 400 ms, `ds-toast-in` 300 ms; reduced-motion is handled globally. (6) The service worker serves `/home` and `/cards` network-first with a 4 s wait, so a slow server blocks an installed-app start even though a cached shell exists; other screens have no shell.
- Keyboard: `StickyActions` relies on `interactive-widget` (Android Chrome only). On iOS Safari the keyboard overlays the page, so a bottom-pinned button can sit behind it. Slice 4's writing screens must not pin an input or its submit button to the bottom without a `visualViewport` fallback (not measurable here).

## 8. Proposed fixes, ranked by impact (step 2, after Raghav's go)
1. **Pin functions to Frankfurt** (`vercel.json` `"regions": ["fra1"]`): every Supabase call goes from 100–300 ms to ~10 ms; Home/Learn TTFB 1.6–1.9 s → ~0.1 s. No code. Raghav approves; the dashboard is not touched by Claude.
2. **Fewer, parallel round trips**: pages read the session from the locally verified JWT (`getClaims`) instead of an auth-server call (API routes and actions keep `getUser`; trade-off: a revoked session stays readable up to its 1 h token, decision for Raghav); unlock out of the layout and pages (run when the learner's pointer moves, after Close Day, or behind a cheap "anything newer?" check) ; page data and counts in one `Promise.all`; the sidebar badge from the on-device deck instead of the server. Target: chain 5–6 → 2.
3. **Instant-feel navigation**: tab taps show the new tab as active at once and a pending state; `loading.tsx` skeletons (after the Safari check on issue 1); `staleTimes.dynamic` so a repeat visit is instant; prefetch the next screens.
4. **JS ≤ 200 KB**: load Sentry after idle (−~75 KB), replace client-side zod with small checks (−33 KB on `/cards`, `/me`), modern-only build targets (−14 KB), lazy-load the feedback dialog and options sheet.
5. **Service worker**: cached shell first (stale-while-revalidate) for all app screens; keep static files cache-first.
6. **Flashcards**: advance the card first, write to IndexedDB in the background (grade tap stays under 100 ms on iOS too); one limiter round trip instead of two on the API routes.
7. **Layout fixes** from section 7 (Turnstile space, touch targets, hover states, animation budget, `touch-action`).
8. **Guardrails**: Lighthouse CI with the budgets, Playwright tests at 375/390/430/768/1024/1280/1440 (no overflow, targets, CLS), Vercel Speed Insights (package + component; Raghav switches it on in the Vercel dashboard: project → Speed Insights tab → Enable).

## 9. Results
### PR A: functions pinned to Frankfurt (merged, live 23 Oct 2026)
`x-vercel-id` now `fra1::fra1`. Production TTFB, median of 8 from here:

| | before | after |
|---|---|---|
| `/api/health` (function + 2 serial Supabase calls) | 851 ms | **239 ms** |
| `/login` (function, no DB) | 264 ms | 199 ms |
| static file (CDN) | 78 ms | 94 ms (noise) |

Per Supabase call: about 300 ms → about 25 ms.

### PR B: fewer round trips
What changed: pages that only read take the session from the token's claims (`requireAal2FromClaims`, aal2 still enforced, the proxy applies the same rule first); server actions, onboarding and every API route keep `getUser`. The card unlock left the layout and pages (`ensureLessonCardsIfNew`: a minute-long per-instance memory of the published lessons decides in memory; the full unlock runs only when a lesson up to today's is waiting, and in the snapshot route that feeds the device). The layout makes one call (the profile, shared with the page). The desktop Cards badge is counted from the deck on the device. Page data runs in parallel. API routes make one limiter call, keyed by the user from the verified claims, in parallel with `getUser`.

Calls (local production build, warm), count / chain:

| | before | after |
|---|---|---|
| Home (full load) | 7 / 5 | **4 / 2** |
| Learn | 9 / 6 | **3 / 2** |
| Cards shell | 7 / 5 | **1 / 1** |
| Me | 7 / 5 | **1 / 1** |
| Lesson page `/learn/<code>` | 8 / 5 | **2 / 1** |
| `POST /api/cards/sync` | 8 / 7 | 7 / 5 |
| `POST /api/cards/snapshot` | 9 / 5 | 9 / 4 (the unlock check is the 1 extra read in a cold instance) |
| Request without a valid token | 1+ limiter call | 0 |

Server TTFB of a full page load by per-call latency (median of 3):

| per call | /home | /learn | /cards | /me |
|---|---|---|---|---|
| 10 ms (Frankfurt, now) before → after | 97 → **47 ms** | 122 → **37 ms** | 100 → **28 ms** | 95 → **26 ms** |
| 100 ms before → after | 567 → 247 | 680 → 241 | 564 → 130 | 559 → 126 |
| 300 ms before → after | 1577 → 649 | 1904 → 640 | 1574 → 327 | 1551 → 325 |

Phone tab taps (4× CPU, Fast 4G, +100 ms per call), tap → painted: Home→Learn 713–721 → 330–426 ms; Learn→Cards 301–313 → 297–313; Cards→Home 597–626 → 330. (Client-only timings such as flip and grade doubled during that run because the Mac was busy with other apps, flip is unchanged code; re-measured in the final run.) The tab tap still shows nothing until the response arrives: PR C.

Also in PR B: known-issue 2 (stale login redirect loop) is fixed through `/auth/stale` (see `docs/known-issues.md`). Rate limits after PR B, pinned by tests: per IP on sign-up (10/h), log-in (20/10 min), Google sign-in (20/10 min), password-reset request (5/h), waitlist (5/h), Google callback and email links (30/10 min each) and the new `/auth/stale` (30/10 min); **per user** (never per IP) on the two-factor actions (10/10 min); per user on the API routes (one call). Not limited by us: setting a new password after the reset link (`resetPasswordAction`; it needs the recovery session, Supabase limits it).

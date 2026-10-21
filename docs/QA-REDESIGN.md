# Redesign QA (phase 9)

Run on 2026-10-21 against a production build (`next build && next start`) with local Supabase, in headless Chrome (Puppeteer) at 390, 320 and 1280px, plus Lighthouse (mobile) and the in-app browser for the first walkthrough. Test accounts were created and deleted by the run. The scripts live outside the repo.

| Check | Result |
| --- | --- |
| Full flow at 390px: sign-up → check email → login → MFA setup → onboarding → Home → Review cards → grade (keys 1–4) → done → Me → log out | Pass. Logout clears saved cards and caches. |
| Auth, redirects, sync, SRS unchanged | Pass. Only presentation changed; the diff outside components is MFA page layout, `error-routing.ts` (mood helper) and a service-worker version bump. |
| Light, dark, system theme on every screen (168 screen states, 8 theme/width combinations) | Pass |
| No flash on reload (stored theme vs OS theme, 4 screens × 4 combinations) | Pass |
| No hard-coded colours | Pass. Two intended exceptions: the white QR background and the dim overlay behind sheets. |
| Contrast (unit tests plus a computed-style check on every text node of every screen state) | Pass after fix: the 12px interval label on "Got it" was 4.31:1. |
| Tap targets ≥ 44px (app, legal and auth screens) | Pass after fixes (Terms link, switch-screen links, tab bar at 320px). Exception: the two links inside the sign-up consent sentence stay inline text. |
| 320px and wide laptop | Pass. No horizontal overflow. The column is centred and 480px wide at 1280px. |
| Keyboard | Pass. Tab order follows the screen, every control shows a focus ring, keys 1–4 grade, Space flips. The unnamed tab stops on sign-up and forgot-password belong to Cloudflare's Turnstile widget. |
| Icon-only buttons have labels | Pass (0 unnamed controls) |
| `prefers-reduced-motion` | Pass. No animations or transitions longer than 20ms with it on. |
| Game layer off: no treats, level, streak, combo or "+N" text | Pass |
| Game layer on: everything shows, same checks | Pass |
| Offline: Home and Cards open with the network off, a review made offline syncs when back online | Pass |
| Lighthouse mobile `/login` | Performance 96, accessibility 100, best practices 100, SEO 92 |
| Lighthouse mobile `/home` | 100 / 100 / 100 / 100 |
| Lighthouse mobile `/cards` | 100 / 100 / 96 / 100 |
| PWA installable (Chrome installability check on `/login` and `/home`) | Pass, no errors |
| Lint, 478 unit tests, 54 RLS tests, production build | Pass |

## Fixed during QA
- Landing page and the three legal pages were still in the old style: restyled with the design system; unused legacy classes removed.
- `Screen` is now the `<main>` landmark (Lighthouse `landmark-one-main`); the review session is a `<main>` too.
- Cards hub header reserves its loaded height, so the page no longer jumps when the deck loads (layout shift 0.09 → 0.01).

## Notes
- A first cold Lighthouse run of `/login` scored 79 (LCP 5.2s); four later runs scored 96. The Turnstile script is the only third-party request.
- Lighthouse best practices on `/cards` is 96 because of a Chrome DevTools "issue" entry; the issue text is not reported by Lighthouse.
- Two key presses in the same instant are not both counted on the card screen (the second is ignored while the first review is saving). Normal use is unaffected.

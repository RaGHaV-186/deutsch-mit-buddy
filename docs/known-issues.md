# Known issues

## 1. Streaming Suspense boundaries (and so `loading.tsx`) can leave client components un-hydrated

**Status:** open, cause not found. Workaround in place: no `loading.tsx` anywhere (a test fails if one is added). `HomeSkeleton` exists and is previewed on `/design`, but is not wired to a route.

**Symptom (local `next build && next start`, Chromium):** with a `loading.tsx` on a page, the first load after a (re)build hydrates, but later reloads often do not. The server HTML is complete and looks right, but client components inside the boundary never get React props/fibers: links work as plain links, but the theme switch, feedback dialog and Log out (a server-action form) are dead. No error appears in the console.

**Minimal repro (no app code involved):** an async page (300 ms delay) with a `loading.tsx` that renders one client component which sets `document.body.dataset.probe` in `useEffect`.
- with `loading.tsx`: loads 2 and 3 never ran the effect (first load fine);
- same page without `loading.tsx`: 3 of 3 loads fine;
- same page with a hand-written `<Suspense fallback>` around the async child, no `loading.tsx`: first load fine, loads 2 and 3 broken. So it is the streamed Suspense boundary, not the file convention.

**Ruled out** (each tested):
- Hydration errors: none in the console; `suppressHydrationWarning` is already on `<html>` (the theme script sets `data-theme` before React starts).
- CSP / nonce: every one of the 24 script tags in the streamed HTML, including the Suspense completion scripts, carries the request nonce; and the problem is identical with the CSP header and nonce removed entirely.
- Service worker: none registered (`getRegistrations()` is empty); this embedded browser cannot register one.
- Stylesheet "suspensey CSS": `experimental.inlineCss` (no `<link rel=stylesheet>` at all) did not help.
- Our content: Home's data, auth, the theme/splash scripts, the manual `<head>`, and the `Cache-Control: private, no-store` header from `proxy.ts` (removed in a dev run; dev runs were not conclusive because `/_next/hmr` is blocked on `127.0.0.1`).

**Not tested:** the stack without our root layout in a production build (a minimal layout fails to prerender because other pages need the intl provider); a different browser; other Next/React patch versions (Next 16.4.2, React 19.3.0).

**Pattern:** works when scripts are slow to arrive (first load, cold cache), fails when everything is cached and scripts run before the boundary's content has streamed, which looks like a race between React's hydration and the streamed `$RC` completion. Worth reproducing in a plain Next 16 app and, if it reproduces, reporting upstream.

**Affects any streamed Suspense, not just `loading.tsx`.** Investigate before slices that load data with streaming: test a fresh Next 16.4 app, and test with `proxy.ts` disabled.

**Rule until fixed:** no route-level `loading.tsx` and no streamed `<Suspense>` around interactive client components. Prefer client-side loading states (the offline-first Cards screen already does this).

## 2. Stale login redirect loop (auth bug, not part of the redesign)

**Status:** fixed (perf slice, PR B). Kept here for the history and the rule.

**Symptom (was):** if a user's account is deleted (or its session revoked) while their browser still holds a not-yet-expired access token, `/login` and the app redirected to each other forever and the browser gave up ("too many redirects"). Clearing the site's cookies fixed it.

**Cause:** `proxy.ts` decides from the JWT claims only (no network): a token with `aal2` makes `/login` redirect to `/home`. A page or action then asked the auth server (`getUser`), found nobody, and redirected to `/login`. A server component cannot clear cookies, so nothing ever ended the session.

**Fix:** every place that finds the session unusable redirects to `/auth/stale` (`src/app/auth/stale/route.ts`) instead of `/login`: the guards (`requireAal2`, `requireSession`) when the auth server rejects a token whose claims look valid, and the app layout when the signed-in account has no profile row. The route re-checks for itself, signs out (a client that writes no cookies), expires every `sb-*` cookie and redirects to `/login` once. Rules it keeps:
- it never signs out a healthy session (a link to it cannot log anyone out): healthy and verified goes to `/home`, healthy without two-factor to `/mfa`;
- it never acts on a guess: an auth-server outage, a 5xx or a database error answers 503 and leaves the cookies alone (`isDefinitivelySignedOut`: only "session missing" and 401/403/404 count);
- it is limited per IP (30 per 10 minutes), so a flapping error cannot become an endless loop.
Tests: `src/app/auth/stale/route.test.ts`, `src/lib/auth/guard.test.ts`, `src/lib/auth/stale-session.test.ts`, `src/app/(app)/layout.test.tsx`. Checked by hand on a production build: delete the user, keep the cookie, `GET /home` → `/auth/stale` → `/login` (cookie expired) → `/login` renders.

**Still true (by design):** pages that only read trust the token's claims (`requireAal2FromClaims`), so a deleted or revoked user keeps seeing cached screens until their token expires (at most an hour) or an action / API call / layout profile read notices. Anything that changes data re-checks with the auth server.

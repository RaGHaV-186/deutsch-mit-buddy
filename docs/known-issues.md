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

**Rule until fixed:** no route-level `loading.tsx` and no streamed `<Suspense>` around interactive client components. Prefer client-side loading states (the offline-first Cards screen already does this).

## 2. Stale login redirect loop (auth bug, not part of the redesign)

**Status:** open. Found while testing; no auth code was changed.

**Symptom:** if a user's account is deleted (or its session revoked) while their browser still holds a not-yet-expired access token, `/login` and `/home` redirect to each other forever and the browser gives up ("too many redirects"). Clearing the site's cookies fixes it.

**Cause:** `proxy.ts` decides from the JWT claims only (no network): a token with `aal2` makes `/login` redirect to `/home`. But `/home` calls `requireAal2()`, which verifies the user with the auth server (`getUser`), finds nobody, and redirects to `/login`.

**Fix idea (for the auth owner):** when `getUser()` fails in `requireAal2()` / `requireSession()`, clear the Supabase auth cookies (sign out) before redirecting, or let `/login` ignore a session that the server can't verify.

# The domain: deutschmitbuddy.de

**Canonical address: `https://www.deutschmitbuddy.de`.** The bare domain `https://deutschmitbuddy.de` answers with a 308 redirect to `www`. Live since 23 Oct 2026.

## DNS (at INWX, the registrar)
| Type | Name | Value | Why |
|---|---|---|---|
| A | `@` (deutschmitbuddy.de) | `216.198.79.1` | the apex, pointing at Vercel |
| CNAME | `www` | Vercel's CNAME target for the project (copy it from Vercel → Project → Settings → Domains; do not type it from memory) | the canonical host |

Nothing else is needed for the app. (Mail for the domain, if it is ever set up, is a separate set of MX/TXT records; add them here when it is.)

## Where each address setting lives
Every one of these must say `www.deutschmitbuddy.de`. If one is wrong, the symptom is in the last column.

| Where | Setting | Value | What breaks if it is wrong |
|---|---|---|---|
| Vercel → Settings → Domains | the two domains | `www.deutschmitbuddy.de` serves the app; `deutschmitbuddy.de` redirects (308) to it | the site does not open, or opens twice |
| Vercel → Environment Variables | `NEXT_PUBLIC_SITE_URL` | `https://www.deutschmitbuddy.de` (Production only, a plain variable, not a secret). After a change: Redeploy with the build cache off (it is baked in at build time) | links in sign-up, Google sign-in and password-reset emails point at the wrong address; `/api/health` shows `"siteUrl":"missing"` |
| Supabase → Authentication → URL Configuration | Site URL | `https://www.deutschmitbuddy.de` | Supabase falls back to it when a redirect is not allowed |
| same | Redirect URLs | `https://www.deutschmitbuddy.de/**` (covers `/auth/confirm`, `/auth/callback`, `/auth/confirm/recovery`), the preview pattern `https://*-<vercel-team>.vercel.app/**`, `http://localhost:3000/**` | email and Google links land on the Site URL instead of the page that completes the sign-in |
| Google Cloud Console → the OAuth client | Authorized JavaScript origins | `https://www.deutschmitbuddy.de` (the redirect URI stays Supabase's `https://<project-ref>.supabase.co/auth/v1/callback`) | Google sign-in is refused |
| Cloudflare → Turnstile → the widget | Hostnames | `www.deutschmitbuddy.de` (and `deutschmitbuddy.de`), `localhost` | the captcha does not load on sign-up and login |

## In the code
There is **no hard-coded domain** in `src/`, `public/` or the configuration. The address comes from one function, `siteUrl()` (`src/lib/site-url.ts`): `NEXT_PUBLIC_SITE_URL`, else the deployment's own `VERCEL_URL` (previews), else `http://localhost:3000`. It feeds the three auth redirects in `src/app/(auth)/actions.ts`. The content security policy uses `'self'` plus the Supabase, Turnstile and Sentry origins, so it does not depend on the domain; the PWA manifest uses relative URLs (`start_url` is `/`). Not set up yet: `metadataBase`, canonical and Open Graph tags, `robots.txt`, a sitemap.

## Checks after any change
- `curl -sI https://deutschmitbuddy.de | head -3` shows `308` and `location: https://www.deutschmitbuddy.de/`.
- `https://www.deutschmitbuddy.de/api/health` shows `"app":"ok"`, `"supabase":"ok"` and `"siteUrl":"set"`.
- Request a password reset for your own address on the live site: the link in the email must lead to `www.deutschmitbuddy.de`. Try Google sign-in too.

## Things to remember
- **Cookies and installed apps belong to one address.** A session or an installed PWA from the old `*.vercel.app` address (or the bare domain) is a different place from `www`: sign in again, and reinstall the app to the home screen from `www`.
- Vercel previews keep using their own `VERCEL_URL`, which is why `NEXT_PUBLIC_SITE_URL` is Production only and the preview pattern is on Supabase's Redirect URLs list.

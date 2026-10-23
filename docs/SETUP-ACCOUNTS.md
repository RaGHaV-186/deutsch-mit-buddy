# Slice 1 (Accounts): setup checklist

Do these once. Values marked `<…>` are yours. Never paste secrets into chat, commits or `NEXT_PUBLIC_*` variables except the ones named below.

## 0. Blocker: email delivery
Supabase's built-in email sender only mails your own team members and is heavily rate-limited. For anyone else to get the confirmation mail you need custom SMTP (step S6). Resend needs `deutschmitbuddy.de` DNS records verified first. Until then you can only test with your own address.

## 1. Supabase dashboard (project in Frankfurt)
| # | Where | Set |
|---|-------|-----|
| S1 | Project Settings → API | Copy **Project URL**, **anon** key, **service_role** key (see "Env vars"). The Data API keeps **"Automatically expose new tables" OFF**. |
| S2 | Authentication → Sign In / Providers → **Email** | Enabled · **Confirm email ON** · **Minimum password length 10** · Secure email change ON · "Allow new users to sign up" stays ON (the database trigger enforces the 30 cap) |
| S3 | Authentication → Sign In / Providers → **Google** | Enable, paste Client ID and Secret from section 2. Copy the shown **Callback URL** into Google (section 2, step 3). |
| S4 | Authentication → URL Configuration | **Site URL** = your live URL. **Redirect URLs**: `http://localhost:3000/**`, `https://<your-vercel-project>.vercel.app/**`, `https://*-<your-vercel-team>.vercel.app/**` (previews), later `https://deutschmitbuddy.de/**` |
| S5 | Authentication → Multi-Factor | **TOTP: Enroll and Verify both enabled** |
| S6 | Authentication → Emails → SMTP Settings | Enable custom SMTP. Resend: host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key, sender `no-reply@deutschmitbuddy.de` |
| S7 | Authentication → Emails → Templates | **Optional, only possible once custom SMTP (S6) is set up.** Until then Supabase's default templates are used and the app handles them (see "Email links" below). Later: **Confirm signup** ← `supabase/templates/confirmation.html`, **Reset password** ← `supabase/templates/recovery.html`; they work on any device. |
| S8 | Authentication → Attack Protection (Bot and Abuse Protection) | Enable **CAPTCHA** → provider **Cloudflare Turnstile** → paste the Turnstile **secret key**. Note: Supabase then asks for the token on sign-up, **sign-in** and password reset, so the login page also shows the (mostly invisible) widget. |
| S9 | Project Settings → JWT Keys | Make sure an **asymmetric signing key** is current (default on new projects), so sessions are verified locally and fast. |
| — | Pro-only, skipped | "Prevent use of leaked passwords" (we check Have I Been Pwned ourselves) and Sessions → inactivity timeout (we expire the cookie after 7 days instead). |

Push the database and make yourself admin:
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```
After your first sign-up, in **SQL Editor**:
```sql
update public.profiles set role = 'admin'
where user_id = (select id from auth.users where email = '<your email>');
```
(Admins don't use one of the 30 seats.) To let someone past the cap: `insert into public.waitlist (email, approved) values ('<their email>', true);`. To change the cap: `update public.app_config set value = '40' where key = 'member_cap';`

Lost authenticator? Authentication → Users → the user → remove the MFA factor, then they enrol again.

### Email links: default templates vs ours
- **Default templates (what you get on the free plan without custom SMTP):** the link goes to Supabase, which verifies it and redirects to `/auth/confirm?code=…` (sign-up) or `/auth/confirm/recovery?code=…` (password reset). The app exchanges the code for a session. **This only works in the browser that asked for the email** (it holds a one-time PKCE cookie). Opened elsewhere, the member lands on the login page with a hint: sign-up links still confirm the email on Supabase's side, so they can just log in; for a reset they request a new link in the browser they'll open it in.
- **Our templates (later):** link straight to our routes with `?token_hash=`, which work on any device.
- Either way, the redirect URL must be allow-listed (S4: `https://<site>/**` covers `/auth/confirm` and `/auth/confirm/recovery`). If it isn't, Supabase falls back to the Site URL and the link breaks.

## 2. Google Cloud Console (console.cloud.google.com)
1. Create project **deutsch-mit-buddy**. Google Auth Platform → **Branding**: app name, support email, authorized domains `deutschmitbuddy.de` and `supabase.co`, privacy policy `https://<site>/datenschutz`, terms `https://<site>/terms`.
2. **Audience** → **External**, then **Publish app** (in Testing mode only 100 named test users can sign in and tokens expire after 7 days; the basic scopes need no Google review). **Data Access** → scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` only.
3. **Clients** → Create client → **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000`, `https://<your-vercel-project>.vercel.app`, later `https://deutschmitbuddy.de`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase's callback, not the app's)
   - Copy Client ID and Secret into Supabase (S3).

## 3. Cloudflare (dash.cloudflare.com → Turnstile)
1. **Add widget** "Deutsch mit Buddy". Hostnames: `deutschmitbuddy.de`, `localhost`, your Vercel hostname(s). Mode **Managed**.
2. Site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; secret key → `TURNSTILE_SECRET_KEY` **and** Supabase (S8).

## 4. Env vars (Vercel → Project → Settings → Environment Variables; Production + Preview unless a row says otherwise; and `.env.local`)
| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from S1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from S1. **Server only**, never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.deutschmitbuddy.de` (the canonical address, see `docs/DOMAIN.md`), **Production only** (leave Preview and Development unticked: previews use `VERCEL_URL`). See "The site URL" below |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | from Cloudflare |
| `NEXT_PUBLIC_SENTRY_DSN` | optional; Sentry → new project, **EU region** |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | optional; only for source-map upload on production builds |

GitHub needs no secrets: CI runs the RLS tests against a throwaway local Supabase.

### The site URL (`NEXT_PUBLIC_SITE_URL`)
*Set on 23 Oct 2026 to `https://www.deutschmitbuddy.de`; DNS, the redirect and every address setting are in `docs/DOMAIN.md`.*
It is the address that goes into the links of **sign-up confirmation emails**, **Google sign-in** and **password-reset emails** (`src/lib/site-url.ts`, used by the three actions in `src/app/(auth)/actions.ts`). If it is not set, the app falls back to `VERCEL_URL`, which on production is the address of that one deployment (`deutsch-mit-buddy-<hash>-<team>.vercel.app`), not `deutschmitbuddy.de`: the links then point at a changing address (and at Vercel's login wall if Deployment Protection is on). Signing in with a password and 2FA does not use it. `/api/health` shows `"siteUrl":"missing"` until it is set.

Setting it (a `NEXT_PUBLIC_` value is baked in when the app is built, so it needs a new build):
1. Vercel → the project → Settings → Environment Variables → Add: Name `NEXT_PUBLIC_SITE_URL`, Value `https://www.deutschmitbuddy.de` (no path; a trailing slash is stripped), Environments: tick **Production only** → Save.
2. Deployments → the latest Production deployment → ⋯ → **Redeploy**, with "Use existing Build Cache" switched **off**.
3. When it is Ready, `https://deutschmitbuddy.de/api/health` shows `"siteUrl":"set"`.

Supabase must agree with it (Dashboard → Authentication → URL Configuration; these are the S4 values):
- **Site URL**: `https://www.deutschmitbuddy.de`
- **Redirect URLs** (an allow-list; a redirect that is not on it falls back to the Site URL and the link breaks): `https://www.deutschmitbuddy.de/**` (covers `/auth/confirm`, `/auth/callback` and `/auth/confirm/recovery`), `https://*-<your-vercel-team>.vercel.app/**` (previews; the team part of your Vercel URLs), and `http://localhost:3000/**` for local work.
- Google Cloud Console → your OAuth client: `https://www.deutschmitbuddy.de` is among the Authorized JavaScript origins (the redirect URI stays Supabase's `…supabase.co/auth/v1/callback`). Cloudflare Turnstile: `www.deutschmitbuddy.de` is among the widget's hostnames.

Check it end to end: request a password reset for your own address on the live site; the link in the email must lead to `https://www.deutschmitbuddy.de` (after Supabase's verification hop) and open the reset page.

### Checking a deployment
Open `https://<deployment>/api/health` (on a preview, while signed in to Vercel). It answers with plain words only, never keys:
- `supabase: ok` and `rateLimiter: ok`: the app can reach Supabase and use its rate limiter.
- `rateLimiter: not-configured` / `config.serviceRoleKey: missing`: `SUPABASE_SERVICE_ROLE_KEY` isn't set for this environment. In Vercel, each variable must be ticked for **Preview** as well as Production, and a new deployment is needed after changing it.
- `rateLimiter: unavailable`: the key is set but Supabase rejects it (wrong key, or from a different project).
- Sign-up failures are also logged in the Vercel function logs as `auth error in signUp {code, name, status}` or `rate limiter unavailable {…}` (codes only, no emails or keys).

## 5. Local development
```bash
npm run db:start            # Docker must be running; starts a local Supabase (Mailpit inbox: http://127.0.0.1:54324)
npm run dev
npm run test:rls            # row-level-security tests against the local stack
npm run db:reset            # re-apply migrations from scratch
```
`.env.local` for local use: URL `http://127.0.0.1:54321` plus the keys printed by `npx supabase status -o env`, and Cloudflare's published **test** Turnstile keys (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`). Local Supabase has CAPTCHA switched off in `supabase/config.toml`.

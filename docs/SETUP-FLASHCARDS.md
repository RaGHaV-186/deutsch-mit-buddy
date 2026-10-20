# Slice 2 (Flashcards): setup checklist

Do these once, in order. Nothing here needs new secrets or new environment variables.

## 1. Push the database migration
```bash
npx supabase db push        # adds cards, card_srs, reviews (read-only for members, written by the server)
```
Check it in the Supabase dashboard (Table Editor): the three tables exist and each shows RLS enabled.

## 2. Deploy
Merge the slice 2 pull request (or open the Vercel preview of it). CI must be green: lint, unit tests, build, and the RLS job (which now includes `tests/rls/cards.int.test.ts` and `cards-server.int.test.ts`).

## 3. Import your deck (admin only, once)
1. Log in on the deployed site with your admin account (the profile with `role = 'admin'`, see SETUP-ACCOUNTS.md).
2. Open **Cards**. At the bottom, press **Import seed deck**.
3. The result line says how many cards came in. Expected for your file: **202 imported** (213 rows, 11 are repeats of the same card on a later day and are skipped). Cards from Days 2–10 count as already seen and are spread over six days; the Day 11 (Z9) cards are new and arrive at 20 a day.
4. Pressing it again is safe: nothing is duplicated and no progress is reset.

## 4. Put it on your phone (needed for offline)
Offline needs HTTPS, so use the deployed URL, not a local address.
1. Open the site in Safari (iPhone) or Chrome (Android), log in, open **Cards** once while online. That step saves the app and your cards on the phone.
2. **Add to Home Screen** (iPhone: Share → Add to Home Screen; Android: menu → Install app). Use the Home Screen icon from now on. On iPhone this also stops Safari from deleting the saved cards after a week of not visiting.
3. Open the app from the icon, wait for **✓ Saved**.
4. **Airplane mode test:** switch on airplane mode, open the app, open **Cards**, review a few cards. The status line says "Offline · N reviews waiting to sync".
5. Switch airplane mode off. Within a few seconds the status turns to **✓ Saved** (open the app again if it stays on "waiting"). The reviews are now on the server.

## 5. Audio
Audio uses the German voice of the phone (Buddy's own voice comes in slice 6).
- **iPhone:** Settings → Accessibility → Spoken Content → Voices → German → download one (an "Enhanced" voice sounds best). Voices stored on the phone also work offline.
- **Android:** Settings → System → Languages → Text-to-speech → install German voice data.
- If a card says "This device has no German voice installed", that's the cause.

## Good to know
- **Today's queue** = cards due before midnight (Europe/Berlin) plus up to 20 new cards. The Cards page also keeps tomorrow's due cards on the phone, so a day without internet still works.
- **Two devices:** if you review the same card on two devices, the answer with the latest time decides the schedule; the other answer is kept in the history but doesn't move the card.
- **Log out** removes the saved pages and cards from that phone. If reviews are still waiting to sync (no internet), the app keeps them and sends them after your next login.
- **After a new deployment** the saved pages refresh the next time you open the app online. To force every phone to drop its saved files, bump `VERSION` in `public/sw.js`.
- The service worker only runs in production builds. `npm run dev` never registers it, so local development is unaffected.
- To try the production build locally: `npm run build && npm start`. Service workers need HTTPS or `localhost`; testing on a phone needs the deployed URL.

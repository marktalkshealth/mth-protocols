# Mark Talks Health — own website (replaces LearnWorlds)

Branch `own-site-mvp`. Nothing here touches the live LearnWorlds site or `main`.

**Test link:** https://raw.githack.com/marktalkshealth/mth-protocols/own-site-mvp/www/index.html

| Page | What it is |
|---|---|
| `index.html` | Homepage (same design as the LearnWorlds one) |
| `gut.html` | Gut Health Protocol sales page, $147 → $97, Stripe checkout |
| `login.html` | Sign in with a 6-digit email code, "remember me" |
| `course.html` | The course: 7 steps, video + ebook + refresher quiz per lesson, progress saved |
| `app.html` | The Gut Health app: phone app on phones (installable), full desktop app on computers |
| `welcome.html` | After payment: confirms with Stripe and unlocks everything |
| `account.html` | Purchases, "keep me signed in", sign out |

## Adding videos and ebooks
Supabase → Table editor → `mth_lesson_media` → one row per lesson (already created).
- `video_url`: paste a YouTube, Vimeo or Wistia link (unlisted is fine), or `wistia:MEDIAID`.
- `ebook_url`: upload the file to Storage → bucket `course-files` → folder `gut/`, then type its path, e.g. `gut/fasting.html` (HTML or PDF). Only buyers can open it.

Lesson titles, descriptions and quiz questions live in `assets/course-gut.js`.

## Stripe
- Test key: Supabase → Edge Functions → Secrets → `STRIPE_SECRET_KEY` = `sk_test_…`
- Optional backup webhook: Stripe → Webhooks → `https://oihefcsonqjeicelezln.supabase.co/functions/v1/mth-stripe-webhook`, event `checkout.session.completed`; add its `whsec_…` as `STRIPE_WEBHOOK_SECRET`.
- Going live: swap in the `sk_live_…` key **and** add secret `ALLOW_LIVE` = `true` (live keys are refused without it), then set `testMode:false` in `assets/mth.js`.
- Price is set in `supabase/functions/mth-checkout/index.ts` (9700 = $97).

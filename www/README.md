# Mark Talks Health — own website (replaces LearnWorlds)

Branch `own-site-mvp`. Nothing here touches the live LearnWorlds site or `main`.

**Test link:** https://raw.githack.com/marktalkshealth/mth-protocols/own-site-mvp/www/index.html

## Pages
| Page | What it is |
|---|---|
| `index.html` | Homepage (your LearnWorlds design), all three protocols, email-list sign-up |
| `protocols.html` | All protocols side by side |
| `gut.html` · `diabetes.html` · `glp1.html` | Sales pages, $147 → $97, Stripe checkout |
| `login.html` | Sign in with a 6-digit email code, "remember me" |
| `course.html?p=gut` (`sugar`, `glp1`) | The course: 7 steps, video + ebook + refresher quiz per lesson, progress saved |
| `app.html?p=gut` (`sugar`, `glp1`) | The app: phone app on phones (installable), desktop app on computers; plan saved to the account |
| `community.html` | The Healing Hub, for anyone who owns a protocol |
| `welcome.html` | After payment: confirms with Stripe and unlocks everything |
| `account.html` | Purchases, "keep me signed in", sign out (and a link to Admin for you) |
| `admin.html` | **Your admin:** overview, contacts (CRM with tags, notes, CSV export), course content, give/remove access |
| `terms.html` · `privacy.html` · `refunds.html` · `404.html` | Draft legal pages — please read before going live |

## Day-to-day (all in admin.html, sign in as marktalkshealth@gmail.com)
- **Videos:** Course content → pick the protocol → paste a YouTube / Vimeo / Wistia link → Save.
- **Ebooks:** Course content → Upload (HTML or PDF). Only buyers can open them.
- **Give someone access** (comp, friend, test): Give access → their email → protocol. They must have signed in once.
- **Contacts:** everyone who signed in or joined the list, what they own, your tags and notes. Export CSV any time.

Lesson titles, descriptions and quiz questions live in `assets/courses.js`.
The sales pages and homepage are built from the LearnWorlds designs in `site/` by `tools/build_pages.py`.

## Stripe
- Test key: Supabase → Edge Functions → Secrets → `STRIPE_SECRET_KEY` = `sk_test_…`
- Optional backup webhook: Stripe → Webhooks → `https://oihefcsonqjeicelezln.supabase.co/functions/v1/mth-stripe-webhook`, event `checkout.session.completed`; add its `whsec_…` as `STRIPE_WEBHOOK_SECRET`.
- Going live: swap in the `sk_live_…` key **and** add secret `ALLOW_LIVE` = `true` (live keys are refused without it), then set `testMode:false` in `assets/mth.js`.
- Prices are in `supabase/functions/mth-checkout/index.ts` (9700 = $97) and in `assets/mth.js` (what the pages show).

## Sign-in emails
- Supabase → Authentication → Emails → Magic Link: add `Your code: {{ .Token }}` so the email shows the 6-digit code.
- Supabase's built-in email sender only sends to your own address. Before customers arrive, add a real sender (Authentication → SMTP, e.g. Resend).
- Authentication → URL Configuration: add the site address (test link now, your domain later) to Redirect URLs.

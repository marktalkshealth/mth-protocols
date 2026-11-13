# Mark Talks Health — how Claude runs the growth system

> **Synced (Oct 24 2026):** `www/` (plus gut/sugar/glp1/hub, shared/, site/) now matches the live
> `marktalkshealth/mth-site` repo. A dry run of `tools/publish_site.sh` reproduces the live site exactly,
> except the Library (library.html, assets/library.*, assets/admin-library.js and 3 lines in admin.html),
> which is intentionally unpublished until `supabase/pending/mth_library.sql` is applied.
> RULE: edit here on `own-site-mvp`, then publish. Never edit mth-site directly. Before publishing,
> dry-run into a copy of mth-site and check `git status` shows only the changes you expect.
> `supabase/functions/mth-assess/` matches the deployed function (version 11).

> **WARNING (Nov 2 2026):** the live `mth-site` repo now has many changes that are NOT in `www/` here
> (newer admin tools, blog images, email images, functions/unsubscribe.js and more). Do NOT run
> `tools/publish_site.sh` until `www/` is synced back from mth-site, or it will wipe those changes.
> The Facebook-style Community app was published by hand (mth-site f18a52e) and then taken back off
> at Mark's request (mth-site 801bb80). That work lives on branch `community-feed` here.

> **Nov 3 2026:** Talk to Your Doctor (`shared/doctor.js` → live `media/shared/doctor.js`) was published by hand to
> mth-site (cfb1f6e): a `<div id="docTalk">` inside `.hc-risk-row` plus a script tag in gut/sugar/glp1. Here, only the
> script tag was added (these app copies are behind live); the module inserts itself under the risk panel if the div is missing.

> **Nov 3 2026 (later):** published by hand to mth-site (17db163): `start.html` = the Meta ad landing page
> (marktalkshealth.com/start, neutral URL on purpose; the 7-question gut quiz is the first thing on screen, `data-source="start"`),
> the weekly email signup (`MTH.newsBox` in mth.js: top of the public footer for signed-out visitors, under every blog article and
> on the blog front page via `assets/blog-render.mjs`), and cache versions 202611031700. NOT in `www/` here.
> `mth-meta` (v7, source now in `supabase/functions/mth-meta/`) also sends neutral custom events mth_signup / mth_account /
> mth_order next to Lead / CompleteRegistration / Purchase (Meta can block standard-event optimisation for health accounts);
> its cron now runs every 15 minutes.
> Also live (mth-site 87b345a): the gut / diabetes / GLP-1 quiz results end with the matching protocol offer
> (`$147` → `$97`, `MTH.buy`), guarantee and sales-page link (`assets/quiz.js` full()). DECISIONS (Mark, Nov 3): the ad freebie is the gut quiz; the homepage keeps
> app demo → Healing Assessment (no change); ads never point at the homepage.

> **Nov 13 2026 — own "Metricool" (auto-post + comment auto-DMs). BUILT, NOT LIVE YET.**
> Branch `social-autopost` here: `supabase/migrations/20261113040000_mth_social_autopost.sql`, `supabase/functions/mth-social/`
> (`core.ts` = the engine, no Supabase imports so it runs under test; `index.ts` = HTTP + database), tests in
> `supabase/tests/mth-social.test.ts` (`node --experimental-strip-types`, 17 checks against a fake Instagram/Facebook/YouTube).
> Branch `social-autopost` in **mth-site** (afdfe04): `assets/admin-social.js` (Social → "Auto-post & DMs"), the Auto-post tick box in
> `assets/admin-studio.js`, the extra tab in `assets/admin-hub.js`, script tags in `admin.html`.
> TO GO LIVE (needs Mark awake; the Supabase connector asks him to approve database changes): 1) apply the migration,
> 2) deploy `mth-social` with `verify_jwt=false` (it checks the cron secret / admin itself), 3) merge mth-site `social-autopost` into `main`.
> Until all three are done nothing changed on the live site or database.
> How it works: pg_cron `mth-social-tick` calls the function every 2 minutes, only while `mth_social_settings.enabled` or `.dm_enabled`.
> Posts: only `mth_posts.auto_publish = true`, status ready/scheduled, `publish_at` within the last 24 h → Instagram + Facebook Page
> (one Meta system-user token; the Page token is kept in Vault as `mth_social_fb_page_token`). Per-platform result in `mth_posts.publish_state`.
> NEVER write `publish_state` from a screen or a session (a stale copy can make a post go out twice); use the function's `retry` action.
> Claude sessions must not set `auto_publish`, flip the switches, or add keywords on their own: those are Mark's to do in the admin.
> Comments: polled (Instagram comment webhooks need App Review), keywords in `mth_dm_keywords`, one answer per comment in `mth_dm_log`.
> NOT included, on purpose: YouTube uploads (Google locks uploads from an unaudited API project to private) and TikTok (private until
> TikTok audits the app) → those two still go by hand / Metricool. Media must be a public https link; the `social-media` bucket takes
> files up to 50 MB on the free Supabase plan (longer videos need Cloudflare R2 or Supabase Pro — not decided).
> UNTESTED AGAINST THE REAL PLATFORMS: first live post and first live DM are the real test. Two things to watch: whether Meta allows the
> private reply at Standard Access (Instagram should; Facebook Messenger may ask for App Review), and Facebook Reels processing errors
> that arrive after the publish call.

This file is for Claude (any session) working on Mark's business. It describes the
system on branch `own-site-mvp` and how to operate it safely.

## Where things live
- **Site** (static, `www/`): homepage, protocols, sales pages (`gut.html`, `diabetes.html`, `glp1.html`),
  sign-in, courses (`course.html?p=`), apps (`app.html?p=`, which load `gut/`, `sugar/`, `glp1/`),
  Healing Hub (`community.html` → `hub/`), admin (`admin.html`).
- **Test link:** https://raw.githack.com/marktalkshealth/mth-protocols/own-site-mvp/www/index.html
- **Supabase project:** `oihefcsonqjeicelezln` (Postgres + auth + storage + edge functions).
- **Edge functions:** `mth-checkout`, `mth-confirm`, `mth-stripe-webhook` (Stripe, test mode unless `ALLOW_LIVE=true`),
  `mth-sync` (email service sync + status), `mth-hook` (leads in from ManyChat/Zapier, needs `HOOK_SECRET`),
  `mth-thumbs` (admin-only AI thumbnail maker → Google image model, needs `GEMINI_API_KEY`; files in private bucket `mth-thumbs`, screen `assets/admin-thumbs.js`).
  Source in `supabase/functions/` (the shared email code is `_shared/sync.ts`, copied into each function as `sync.ts`).

## Data (all admin-only unless noted)
| Table | What |
|---|---|
| `mth_enrollments` | who owns which protocol (`gut`, `sugar`, `glp1`); `active=false` = access removed |
| `mth_contacts` | CRM: name, tags, stage override, list opt-in, first_touch (utm) |
| `mth_notes`, `mth_tasks` | CRM notes timeline and follow-up tasks (tasks may have no email = Mark's own to-do) |
| `mth_progress` | course lessons done + quiz scores per member |
| `mth_app_state`, `gut_protocol_state` | members' app plans (Diabetes/GLP-1, and Gut) |
| `mth_events` | conversion events: visit, list_join, signup, checkout, purchase (with utm) |
| `mth_posts` | Social Studio: posts with status idea → script → filmed → edited → ready → scheduled → posted |
| `mth_lesson_media` | video / ebook link per lesson (members-only) |
| `mth_sync_log` | what was sent to Kit / Resend / MailerLite / webhook |

Useful read-only queries with the Supabase MCP (`execute_sql`):
- Pipeline and people: `select * from public.mth_admin_crm()` only works as an admin user; from SQL use the tables directly, e.g.
  `select stage, count(*) from mth_contacts group by 1`, or join `auth.users` → `mth_enrollments` → `mth_progress`.
- Conversions by post: `select utm->>'utm_content' post, event, count(*) from mth_events where created_at > now()-interval '30 days' group by 1,2`.
- Posts pipeline: `select id,title,status,publish_at,platforms from mth_posts order by publish_at nulls last`.

## What Claude may do on its own
- **Draft content:** insert `mth_posts` rows with `status='idea'` or `'script'` (title, hook, script, caption, hashtags, cta,
  pillar, product, link_page, platforms). Never set `scheduled`/`posted` — Mark reviews and schedules in Metricool.
- **Create follow-up tasks** in `mth_tasks` (e.g. at-risk customers, new sign-ups who haven't bought, testimonial asks).
- **Add CRM notes** in `mth_notes` summarising what the data shows.
- Report numbers (sales, funnel, top posts) back to Mark.

## What needs Mark
- Anything that sends email to customers, changes prices, issues refunds, removes access, switches Stripe to live,
  changes the domain, or touches `main` / LearnWorlds.
- Publishing: posts go out through Metricool (Studio → Export for Metricool → Metricool Planner → Import).

## Brand voice for drafts
Warm, plain, confident; first person ("I"). Mark lost 100 lbs and healed his gut with the 7 steps:
fasting & cleanse, meditation & journaling, keto & broths, cardio & strength, music & spirit, sleep & clean air, nature & sun.
Lead with gut health. Educational, not medical claims; no "cures"/"treats disease". Hooks under ~12 words.
Formats: Reels/TikTok/Shorts 9:16, Instagram feed 4:5, YouTube 16:9. CTA pattern: "Comment GUT and I'll send you the link".

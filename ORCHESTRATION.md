# Mark Talks Health — how Claude runs the growth system

> **Synced (Oct 24 2026):** `www/` (plus gut/sugar/glp1/hub, shared/, site/) now matches the live
> `marktalkshealth/mth-site` repo. A dry run of `tools/publish_site.sh` reproduces the live site exactly,
> except the Library (library.html, assets/library.*, assets/admin-library.js and 3 lines in admin.html),
> which is intentionally unpublished until `supabase/pending/mth_library.sql` is applied.
> RULE: edit here on `own-site-mvp`, then publish. Never edit mth-site directly. Before publishing,
> dry-run into a copy of mth-site and check `git status` shows only the changes you expect.
> `supabase/functions/mth-assess/` matches the deployed function (version 11).

This file is for Claude (any session) working on Mark's business. It describes the
system on branch `own-site-mvp` and how to operate it safely.

## Where things live
- **Site** (static, `www/`): homepage, protocols, sales pages (`gut.html`, `diabetes.html`, `glp1.html`),
  sign-in, courses (`course.html?p=`), apps (`app.html?p=`, which load `gut/`, `sugar/`, `glp1/`),
  Healing Hub (`community.html` → `hub/`), admin (`admin.html`).
- **Test link:** https://raw.githack.com/marktalkshealth/mth-protocols/own-site-mvp/www/index.html
- **Supabase project:** `oihefcsonqjeicelezln` (Postgres + auth + storage + edge functions).
- **Edge functions:** `mth-checkout`, `mth-confirm`, `mth-stripe-webhook` (Stripe, test mode unless `ALLOW_LIVE=true`),
  `mth-sync` (email service sync + status), `mth-hook` (leads in from ManyChat/Zapier, needs `HOOK_SECRET`).
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

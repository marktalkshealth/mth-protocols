-- The testing lab: results for every piece of content on Mark's accounts (auto-posted or by hand),
-- recorded over time, plus A/B experiments. Collected by the mth-social function (lab.ts).

-- 1) Experiments ("Does posting every 2 hours beat every 6?")
create table if not exists public.mth_experiments (
  id          bigint generated always as identity primary key,
  name        text not null check (length(btrim(name)) between 1 and 120),
  question    text,
  metric      text not null default 'views',          -- views | reach | likes | comments | shares | saves | avg_watch_sec | engagement
  at_hours    int  not null default 24,                -- compare each post at this age (0 = latest number)
  variants    jsonb not null default '[{"key":"A","label":"A"},{"key":"B","label":"B"}]'::jsonb,
  status      text not null default 'running' check (status in ('running','done')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.mth_experiments enable row level security;
drop policy if exists "admin manages experiments" on public.mth_experiments;
create policy "admin manages experiments" on public.mth_experiments for all to authenticated using ((select public.mth_is_admin())) with check ((select public.mth_is_admin()));
revoke all on public.mth_experiments from anon;
grant select, insert, update, delete on public.mth_experiments to authenticated;

-- a planned post can be put in a test before it goes out; the tag follows it onto the platform
alter table public.mth_posts add column if not exists experiment_id bigint references public.mth_experiments(id) on delete set null;
alter table public.mth_posts add column if not exists variant text;

-- 2) One row per piece of content found on a platform
create table if not exists public.mth_social_items (
  id            bigint generated always as identity primary key,
  platform      text not null,                 -- instagram | facebook | youtube
  external_id   text not null,
  post_id       bigint references public.mth_posts(id) on delete set null,
  via           text not null default 'hand' check (via in ('auto','hand')),   -- sent by our system, or posted by hand / another tool
  kind          text,                          -- reel | video | short | image | carousel | story | text
  title         text,
  caption       text,
  permalink     text,
  thumb_url     text,
  duration_sec  numeric,
  posted_at     timestamptz not null,
  experiment_id bigint references public.mth_experiments(id) on delete set null,
  variant       text,
  note          text,
  -- latest numbers (the full history is in mth_social_snapshots)
  views         bigint, reach bigint, likes bigint, comments bigint, shares bigint, saves bigint,
  avg_watch_sec numeric, watch_sec numeric,
  comments_pulled int,                         -- comment count when we last stored its comments
  last_snap_at  timestamptz,
  gone          boolean not null default false,   -- deleted on the platform
  created_at    timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists mth_social_items_posted on public.mth_social_items (posted_at desc);
create index if not exists mth_social_items_exp on public.mth_social_items (experiment_id) where experiment_id is not null;
alter table public.mth_social_items enable row level security;
drop policy if exists "admin reads items" on public.mth_social_items;
create policy "admin reads items" on public.mth_social_items for select to authenticated using ((select public.mth_is_admin()));
drop policy if exists "admin tags items" on public.mth_social_items;
create policy "admin tags items" on public.mth_social_items for update to authenticated using ((select public.mth_is_admin())) with check ((select public.mth_is_admin()));
revoke all on public.mth_social_items from anon;
revoke all on public.mth_social_items from authenticated;
grant select on public.mth_social_items to authenticated;
grant update (experiment_id, variant, note) on public.mth_social_items to authenticated;   -- the numbers are written only by the server

-- 3) The numbers over time (so two posts can be compared at the same age, e.g. "views at 24 hours")
create table if not exists public.mth_social_snapshots (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references public.mth_social_items(id) on delete cascade,
  captured_at timestamptz not null default now(),
  age_hours   numeric not null,
  views bigint, reach bigint, likes bigint, comments bigint, shares bigint, saves bigint,
  avg_watch_sec numeric, watch_sec numeric,
  raw         jsonb
);
create index if not exists mth_social_snapshots_item on public.mth_social_snapshots (item_id, age_hours);
alter table public.mth_social_snapshots enable row level security;
drop policy if exists "admin reads snapshots" on public.mth_social_snapshots;
create policy "admin reads snapshots" on public.mth_social_snapshots for select to authenticated using ((select public.mth_is_admin()));
revoke all on public.mth_social_snapshots from anon;
revoke all on public.mth_social_snapshots from authenticated;
grant select on public.mth_social_snapshots to authenticated;

-- 4) The comments themselves (for reading, counting, and later tone-grading)
create table if not exists public.mth_social_comments (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references public.mth_social_items(id) on delete cascade,
  platform    text not null,
  comment_id  text not null,
  username    text,
  body        text,
  likes       int,
  posted_at   timestamptz,
  tone        text,                           -- filled in later by the tone grader: positive | negative | neutral | question
  created_at  timestamptz not null default now(),
  unique (platform, comment_id)
);
create index if not exists mth_social_comments_item on public.mth_social_comments (item_id);
alter table public.mth_social_comments enable row level security;
drop policy if exists "admin reads comments" on public.mth_social_comments;
create policy "admin reads comments" on public.mth_social_comments for select to authenticated using ((select public.mth_is_admin()));
revoke all on public.mth_social_comments from anon;
revoke all on public.mth_social_comments from authenticated;
grant select on public.mth_social_comments to authenticated;

-- 5) Switch for the collector (on by default: it only reads)
alter table public.mth_social_settings add column if not exists metrics_enabled boolean not null default true;

-- 6) What the Tests & results screen reads: every item with its numbers at a chosen age.
--    A post only counts "at 24 hours" once it is at least 24 hours old; the number used is the last one recorded up to that age.
create or replace function public.mth_lab_items(p_hours int default 24, p_days int default 90)
returns table (
  id bigint, platform text, external_id text, post_id bigint, via text, kind text, title text, caption text, permalink text, thumb_url text,
  duration_sec numeric, posted_at timestamptz, experiment_id bigint, variant text, note text, age_hours numeric, reached boolean,
  views bigint, reach bigint, likes bigint, comments bigint, shares bigint, saves bigint, avg_watch_sec numeric, watch_sec numeric,
  latest_views bigint, gap_hours numeric, local_hour int, local_dow int, comments_stored bigint
) language sql stable security definer set search_path = public as $$
  with base as (
    select i.*, extract(epoch from (now() - i.posted_at)) / 3600.0 as age_h,
           extract(epoch from (i.posted_at - lag(i.posted_at) over (partition by i.platform order by i.posted_at))) / 3600.0 as gap_h
      from public.mth_social_items i
     where public.mth_is_admin() and not i.gone and i.posted_at > now() - make_interval(days => p_days)
  )
  select b.id, b.platform, b.external_id, b.post_id, b.via, b.kind, b.title, b.caption, b.permalink, b.thumb_url,
         b.duration_sec, b.posted_at, b.experiment_id, b.variant, b.note, round(b.age_h::numeric, 1),
         (p_hours = 0 or b.age_h >= p_hours) as reached,
         case when p_hours = 0 then b.views else s.views end, case when p_hours = 0 then b.reach else s.reach end,
         case when p_hours = 0 then b.likes else s.likes end, case when p_hours = 0 then b.comments else s.comments end,
         case when p_hours = 0 then b.shares else s.shares end, case when p_hours = 0 then b.saves else s.saves end,
         case when p_hours = 0 then b.avg_watch_sec else s.avg_watch_sec end, case when p_hours = 0 then b.watch_sec else s.watch_sec end,
         b.views, round(b.gap_h::numeric, 2),
         extract(hour from b.posted_at at time zone 'America/Chicago')::int, extract(isodow from b.posted_at at time zone 'America/Chicago')::int,
         (select count(*) from public.mth_social_comments c where c.item_id = b.id)
    from base b
    left join lateral (
      select x.* from public.mth_social_snapshots x
       where x.item_id = b.id and x.age_hours <= greatest(p_hours, 0) + 0.75
       order by x.age_hours desc limit 1
    ) s on p_hours > 0 and b.age_h >= p_hours
   order by b.posted_at desc;
$$;
revoke all on function public.mth_lab_items(int, int) from public, anon;
grant execute on function public.mth_lab_items(int, int) to authenticated;

-- 7) The clock also runs for the collector once an account is connected
select cron.unschedule('mth-social-tick') where exists (select 1 from cron.job where jobname = 'mth-social-tick');
select cron.schedule('mth-social-tick', '*/2 * * * *', $cron$
  select net.http_post(
    url := 'https://oihefcsonqjeicelezln.supabase.co/functions/v1/mth-social',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-mth-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'mth_mail_cron')),
    body := '{"action":"tick"}'::jsonb, timeout_milliseconds := 120000)
  where exists (select 1 from public.mth_social_settings
                 where enabled or dm_enabled or (metrics_enabled and (fb_page_id is not null or yt_channel_id is not null)));
$cron$);

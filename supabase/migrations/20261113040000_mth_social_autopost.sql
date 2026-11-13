-- Own "Metricool": auto-posting to Instagram + Facebook and comment-keyword auto-DMs.
-- Runs in the edge function mth-social (cron every 2 minutes, only while a switch is on).
-- Everything is OFF by default: nothing is posted or messaged until Mark connects his accounts
-- and turns the switches on in Admin -> Social -> Auto-post & DMs.

-- 1) Posts: an explicit opt-in per post, plus what happened on each platform.
--    (status = 'scheduled' alone still means "scheduled in Metricool"; only auto_publish posts are sent by us.)
alter table public.mth_posts add column if not exists auto_publish boolean not null default false;
alter table public.mth_posts add column if not exists publish_state jsonb not null default '{}'::jsonb;
create index if not exists mth_posts_auto_due on public.mth_posts (publish_at) where auto_publish;

-- 2) One settings row.
create table if not exists public.mth_social_settings (
  id               int primary key default 1 check (id = 1),
  enabled          boolean not null default false,   -- master switch: auto-posting
  dm_enabled       boolean not null default false,   -- master switch: auto-DMs / auto-replies
  dm_enabled_at    timestamptz,                      -- only comments made after this are answered
  fb_page_id       text,
  fb_page_name     text,
  ig_id            text,
  ig_username      text,
  meta_connected_at timestamptz,
  meta_note        text,                             -- e.g. "this token expires on ..."
  yt_channel_id    text,
  yt_channel_title text,
  yt_connected_at  timestamptz,
  poll_state       jsonb not null default '{}'::jsonb,
  tick_lock_until  timestamptz,
  last_tick_at     timestamptz,
  last_tick        jsonb,
  updated_at       timestamptz not null default now()
);
insert into public.mth_social_settings (id) values (1) on conflict (id) do nothing;
alter table public.mth_social_settings enable row level security;
drop policy if exists "admin reads social settings" on public.mth_social_settings;
create policy "admin reads social settings" on public.mth_social_settings for select to authenticated using ((select public.mth_is_admin()));
revoke all on public.mth_social_settings from anon;
grant select on public.mth_social_settings to authenticated;   -- changes go through the edge function

-- 3) Comment keywords ("Comment GUT and I'll send you the link").
create table if not exists public.mth_dm_keywords (
  id            bigint generated always as identity primary key,
  keyword       text not null check (length(btrim(keyword)) between 1 and 40),
  platforms     text[] not null default '{instagram,facebook,youtube}',
  dm_text       text not null check (length(btrim(dm_text)) between 1 and 900),
  public_reply  text,                       -- optional public reply under the comment (Instagram / Facebook)
  youtube_reply text,                       -- YouTube has no DMs: this is the public reply there (blank = use dm_text)
  active        boolean not null default true,
  hits          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists mth_dm_keywords_word on public.mth_dm_keywords (lower(btrim(keyword)));
alter table public.mth_dm_keywords enable row level security;
drop policy if exists "admin manages dm keywords" on public.mth_dm_keywords;
create policy "admin manages dm keywords" on public.mth_dm_keywords for all to authenticated using ((select public.mth_is_admin())) with check ((select public.mth_is_admin()));
revoke all on public.mth_dm_keywords from anon;
grant select, insert, update, delete on public.mth_dm_keywords to authenticated;

-- 4) One row per comment we answered (the unique key is what stops a second DM for the same comment).
create table if not exists public.mth_dm_log (
  id           bigint generated always as identity primary key,
  platform     text not null,
  comment_id   text not null,
  media_id     text,
  username     text,
  comment_text text,
  keyword_id   bigint,
  keyword      text,
  dm_ok        boolean,
  public_ok    boolean,
  detail       text,
  created_at   timestamptz not null default now(),
  unique (platform, comment_id)
);
create index if not exists mth_dm_log_recent on public.mth_dm_log (created_at desc);
alter table public.mth_dm_log enable row level security;
drop policy if exists "admin reads dm log" on public.mth_dm_log;
create policy "admin reads dm log" on public.mth_dm_log for select to authenticated using ((select public.mth_is_admin()));
revoke all on public.mth_dm_log from anon;
grant select on public.mth_dm_log to authenticated;

-- 5) Tokens live encrypted in Supabase Vault. Only the edge function (service role) can read or write them,
--    and only names starting with mth_social_ (so this can never reach other secrets).
create or replace function public.mth_social_secret_set(p_name text, p_value text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if p_name !~ '^mth_social_[a-z0-9_]{1,40}$' then raise exception 'bad secret name'; end if;
  select id into v_id from vault.secrets where name = p_name;
  if p_value is null or p_value = '' then
    if v_id is not null then delete from vault.secrets where id = v_id; end if;
    return;
  end if;
  if v_id is null then perform vault.create_secret(p_value, p_name);
  else perform vault.update_secret(v_id, p_value); end if;
end $$;
create or replace function public.mth_social_secret_get(p_name text)
returns text language plpgsql security definer set search_path = public, vault as $$
declare v text;
begin
  if p_name !~ '^mth_social_[a-z0-9_]{1,40}$' then raise exception 'bad secret name'; end if;
  select decrypted_secret into v from vault.decrypted_secrets where name = p_name;
  return v;
end $$;
revoke all on function public.mth_social_secret_set(text, text) from public, anon, authenticated;
revoke all on function public.mth_social_secret_get(text) from public, anon, authenticated;
grant execute on function public.mth_social_secret_set(text, text) to service_role;
grant execute on function public.mth_social_secret_get(text) to service_role;

-- 6) Only one run at a time.
create or replace function public.mth_social_claim_tick(p_seconds int default 170)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.mth_social_settings set tick_lock_until = now() + make_interval(secs => p_seconds)
   where id = 1 and (tick_lock_until is null or tick_lock_until < now());
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.mth_social_claim_tick(int) from public, anon, authenticated;
grant execute on function public.mth_social_claim_tick(int) to service_role;

create or replace function public.mth_dm_keyword_hit(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.mth_dm_keywords set hits = hits + 1 where id = p_id;
$$;
revoke all on function public.mth_dm_keyword_hit(bigint) from public, anon, authenticated;
grant execute on function public.mth_dm_keyword_hit(bigint) to service_role;

-- 7) The clock: every 2 minutes, and only when one of the switches is on.
select cron.unschedule('mth-social-tick') where exists (select 1 from cron.job where jobname = 'mth-social-tick');
select cron.schedule('mth-social-tick', '*/2 * * * *', $cron$
  select net.http_post(
    url := 'https://oihefcsonqjeicelezln.supabase.co/functions/v1/mth-social',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-mth-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'mth_mail_cron')),
    body := '{"action":"tick"}'::jsonb, timeout_milliseconds := 120000)
  where exists (select 1 from public.mth_social_settings where enabled or dm_enabled);
$cron$);

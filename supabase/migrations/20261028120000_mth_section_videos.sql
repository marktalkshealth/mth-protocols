-- Mark Talks Health: any number of videos per course section, in Mark's chosen order.
-- video_url is "stream:<cloudflare id>" (members-only, signed playback) or a YouTube/Vimeo/Wistia link.
create table if not exists public.mth_videos (
  id uuid primary key default gen_random_uuid(),
  product text not null,
  section_id text not null,
  position int not null default 0,
  title text not null default '',
  video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mth_videos_order on public.mth_videos (product, section_id, position);
alter table public.mth_videos enable row level security;
create policy "members of the course read its videos" on public.mth_videos
  for select to authenticated using (public.mth_has(product) and video_url is not null);
create policy "admins read all videos" on public.mth_videos for select to authenticated using (public.mth_is_admin());
create policy "admins add videos" on public.mth_videos for insert to authenticated with check (public.mth_is_admin());
create policy "admins edit videos" on public.mth_videos for update to authenticated using (public.mth_is_admin()) with check (public.mth_is_admin());
create policy "admins delete videos" on public.mth_videos for delete to authenticated using (public.mth_is_admin());
revoke all on public.mth_videos from anon;
grant select, insert, update, delete on public.mth_videos to authenticated;

-- move the one lesson video already uploaded (Gut Health, Fasting) into its section's list
insert into public.mth_videos (product, section_id, position, title, video_url)
select product, 's1', 0, 'Fasting & the green juice cleanse', video_url
from public.mth_lesson_media
where product = 'gut' and lesson_id = 'fasting' and video_url is not null
  and not exists (select 1 from public.mth_videos v where v.video_url = mth_lesson_media.video_url);
update public.mth_lesson_media set video_url = null where product = 'gut' and lesson_id = 'fasting';

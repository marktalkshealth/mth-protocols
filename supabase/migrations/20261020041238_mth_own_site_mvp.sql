-- Applied to Supabase project oihefcsonqjeicelezln on 2026-10-20 (kept here as a record).
-- Mark Talks Health own site (MVP): purchases, lesson media, course progress

create table if not exists public.mth_enrollments (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('gut','sugar','glp1')),
  source text not null default 'stripe',
  livemode boolean not null default false,
  stripe_session text unique,
  amount_cents integer,
  currency text,
  created_at timestamptz not null default now(),
  unique (user_id, product)
);
alter table public.mth_enrollments enable row level security;
create policy "members see their own purchases" on public.mth_enrollments
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.mth_has(p_product text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mth_enrollments e where e.user_id = (select auth.uid()) and e.product = p_product);
$$;
revoke all on function public.mth_has(text) from public, anon;
grant execute on function public.mth_has(text) to authenticated;

create table if not exists public.mth_lesson_media (
  product text not null,
  lesson_id text not null,
  video_url text,
  ebook_url text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (product, lesson_id)
);
alter table public.mth_lesson_media enable row level security;
create policy "members of the course read its media" on public.mth_lesson_media
  for select to authenticated using (public.mth_has(product));

create table if not exists public.mth_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product text not null,
  lesson_id text not null,
  done boolean not null default false,
  quiz jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, product, lesson_id)
);
alter table public.mth_progress enable row level security;
create policy "members read their progress" on public.mth_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members save their progress" on public.mth_progress
  for insert to authenticated with check (user_id = (select auth.uid()) and public.mth_has(product));
create policy "members update their progress" on public.mth_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.mth_has(product));

revoke all on public.mth_enrollments, public.mth_lesson_media, public.mth_progress from anon;
grant select on public.mth_enrollments, public.mth_lesson_media to authenticated;
grant select, insert, update on public.mth_progress to authenticated;

-- one row per lesson, ready for video / ebook links
insert into public.mth_lesson_media (product, lesson_id, notes) values
 ('gut','welcome','Welcome video'),('gut','app','App walkthrough video'),
 ('gut','fasting','Step 1'),('gut','meditation','Step 2'),('gut','journaling','Step 2'),
 ('gut','keto','Step 3'),('gut','broth','Step 3'),('gut','exercise','Step 4'),('gut','massage','Step 4'),
 ('gut','music','Step 5'),('gut','sleep','Step 6'),('gut','air','Step 6'),
 ('gut','sunlight','Step 7'),('gut','redlight','Step 7'),('gut','forest','Step 7')
on conflict do nothing;

-- 20261020041922_mth_course_files_bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('course-files', 'course-files', false, 524288000)
on conflict (id) do nothing;
create policy "course members read their course files" on storage.objects
  for select to authenticated
  using (bucket_id = 'course-files' and public.mth_has(split_part(name, '/', 1)));

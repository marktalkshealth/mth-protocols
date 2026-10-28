-- Mark Talks Health: course builder.
-- * mth_course_meta: the course's own title, subtitle and thumbnail (overrides courses.js / mth.js).
-- * mth_course_sections: each module's title, subtitle, thumbnail and order; Mark can add new modules
--   or hide built-in ones. Built-in modules with no row keep their courses.js values.
-- * mth_videos now holds every item in a module, in order:
--     kind 'video'  -> video_url = "stream:<id>" or a YouTube/Vimeo/Wistia link
--     kind 'ebook'  -> video_url = a course-files path (<product>/...) or an https link
--     kind 'lesson' -> video_url = "lesson:<courses.js lesson id>" (the reading + refresher quiz lessons)
--   hidden = true keeps an item out of the member course without deleting it.
-- Thumbnails go in the public site-media bucket under courses/.

create table if not exists public.mth_course_meta (
  product text primary key,
  title text,
  subtitle text,
  thumb_url text,
  updated_at timestamptz not null default now()
);
alter table public.mth_course_meta enable row level security;
create policy "anyone reads course titles" on public.mth_course_meta for select to anon, authenticated using (true);
create policy "admins write course titles" on public.mth_course_meta for all to authenticated using (public.mth_is_admin()) with check (public.mth_is_admin());
grant select on public.mth_course_meta to anon, authenticated;
grant insert, update, delete on public.mth_course_meta to authenticated;

create table if not exists public.mth_course_sections (
  product text not null,
  section_id text not null,
  position int not null default 0,
  title text,
  subtitle text,
  thumb_url text,
  hidden boolean not null default false,
  custom boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (product, section_id)
);
alter table public.mth_course_sections enable row level security;
create policy "anyone reads module titles" on public.mth_course_sections for select to anon, authenticated using (true);
create policy "admins write modules" on public.mth_course_sections for all to authenticated using (public.mth_is_admin()) with check (public.mth_is_admin());
grant select on public.mth_course_sections to anon, authenticated;
grant insert, update, delete on public.mth_course_sections to authenticated;

alter table public.mth_videos add column if not exists kind text not null default 'video';
alter table public.mth_videos add column if not exists hidden boolean not null default false;
alter table public.mth_videos drop constraint if exists mth_videos_kind_check;
alter table public.mth_videos add constraint mth_videos_kind_check check (kind in ('video','ebook','lesson'));
drop policy if exists "members of the course read its videos" on public.mth_videos;
create policy "members of the course read its videos" on public.mth_videos
  for select to authenticated using (public.mth_has(product) and (video_url is not null or kind = 'lesson'));   -- hidden items are filtered in the browser

-- admins can put thumbnails in site-media/courses/ (bucket is public, so members and visitors can see them)
create policy "admins upload course art" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and name like 'courses/%' and public.mth_is_admin());
create policy "admins replace course art" on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and name like 'courses/%' and public.mth_is_admin())
  with check (bucket_id = 'site-media' and name like 'courses/%' and public.mth_is_admin());
create policy "admins delete course art" on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and name like 'courses/%' and public.mth_is_admin());
create policy "admins delete course files" on storage.objects for delete to authenticated
  using (bucket_id = 'course-files' and public.mth_is_admin());

-- Seed (run once on 2026-10-28): every built-in lesson gets an ordered slot, and the one lesson ebook became its own item.
insert into public.mth_videos (product,section_id,position,title,video_url,kind) select * from (values
('gut','start',0,'Welcome to the Gut Health Protocol','lesson:welcome','lesson'),
('gut','start',1,'Set up your healing app','lesson:app','lesson'),
('gut','s1',2,'Fasting & the green juice cleanse','lesson:fasting','lesson'),
('gut','s1',3,'Fasting & the green juice cleanse — ebook','gut/fasting.html','ebook'),
('gut','s2',0,'Meditation','lesson:meditation','lesson'),
('gut','s2',1,'Journaling','lesson:journaling','lesson'),
('gut','s7',0,'Sunlight','lesson:sunlight','lesson'),
('gut','s7',1,'Red light therapy','lesson:redlight','lesson'),
('gut','s7',2,'Forest bathing','lesson:forest','lesson'),
('gut','s6',0,'Sleep','lesson:sleep','lesson'),
('gut','s6',1,'Indoor air quality','lesson:air','lesson'),
('gut','s5',0,'Music therapy','lesson:music','lesson'),
('gut','s4',0,'Exercise','lesson:exercise','lesson'),
('gut','s4',1,'Massage therapy','lesson:massage','lesson'),
('gut','s3',0,'The High Protein Meal Plan','lesson:keto','lesson'),
('gut','s3',1,'High hydration','lesson:hydration','lesson'),
('sugar','start',0,'Welcome to the Diabetes Protocol','lesson:welcome','lesson'),
('sugar','start',1,'Set up your healing app','lesson:app','lesson'),
('sugar','s1',0,'Fasting & your blood sugar','lesson:fasting','lesson'),
('sugar','s2',0,'Meditation','lesson:meditation','lesson'),
('sugar','s2',1,'Journaling','lesson:journaling','lesson'),
('sugar','s7',0,'Sunlight','lesson:sunlight','lesson'),
('sugar','s7',1,'Red light therapy','lesson:redlight','lesson'),
('sugar','s7',2,'Forest bathing','lesson:forest','lesson'),
('sugar','s6',0,'Sleep','lesson:sleep','lesson'),
('sugar','s6',1,'Indoor air quality','lesson:air','lesson'),
('sugar','s5',0,'Music therapy','lesson:music','lesson'),
('sugar','s4',0,'Exercise','lesson:exercise','lesson'),
('sugar','s4',1,'Massage therapy','lesson:massage','lesson'),
('sugar','s3',0,'High protein for steady glucose','lesson:keto','lesson'),
('sugar','s3',1,'High hydration','lesson:hydration','lesson'),
('glp1','start',0,'Welcome to the GLP-1 Weight Loss Protocol','lesson:welcome','lesson'),
('glp1','start',1,'Set up your healing app','lesson:app','lesson'),
('glp1','s1',0,'Fasting & cleansing on a GLP-1','lesson:fasting','lesson'),
('glp1','s2',0,'Meditation','lesson:meditation','lesson'),
('glp1','s2',1,'Journaling','lesson:journaling','lesson'),
('glp1','s7',0,'Sunlight','lesson:sunlight','lesson'),
('glp1','s7',1,'Red light therapy','lesson:redlight','lesson'),
('glp1','s7',2,'Forest bathing','lesson:forest','lesson'),
('glp1','s6',0,'Sleep','lesson:sleep','lesson'),
('glp1','s6',1,'Indoor air quality','lesson:air','lesson'),
('glp1','s5',0,'Music therapy','lesson:music','lesson'),
('glp1','s4',0,'Strength training to protect muscle','lesson:exercise','lesson'),
('glp1','s4',1,'Massage therapy','lesson:massage','lesson'),
('glp1','s3',0,'Protein-first eating on a GLP-1','lesson:keto','lesson'),
('glp1','s3',1,'High hydration','lesson:hydration','lesson')
) v(product,section_id,position,title,video_url,kind) where not exists (select 1 from public.mth_videos x where x.product=v.product and x.video_url=v.video_url);
update public.mth_lesson_media set ebook_url=null where product='gut' and lesson_id='fasting';

-- Blog articles, written and edited in Admin -> Edit -> Blog.
-- The website reads published ones (Cloudflare function /blog), so a Save is live straight away.
create table if not exists public.mth_blog_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text not null default '',
  description text,                       -- the line Google shows (blank = first sentences of the article)
  body        text not null default '',   -- the article: simple HTML paragraphs (p, b, i, a)
  study_title text,                       -- the study the article is about
  study_cite  text,                       -- "Wastyk HC et al. Cell, 2021"
  study_url   text,                       -- link to PubMed (or the journal)
  study_img   text,                       -- screenshot of the PubMed page (public URL)
  cover_img   text,                       -- optional picture at the top
  cta         text check (cta is null or cta in ('gut','sugar','glp1')),
  status      text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.mth_blog_posts enable row level security;
-- visitors (anon) can't run mth_is_admin(), so the public read policy must not call it
drop policy if exists "anyone reads live articles" on public.mth_blog_posts;
create policy "anyone reads live articles" on public.mth_blog_posts for select to anon, authenticated using (status = 'published');
drop policy if exists "admin manages articles" on public.mth_blog_posts;
create policy "admin manages articles" on public.mth_blog_posts for all to authenticated using ((select public.mth_is_admin())) with check ((select public.mth_is_admin()));
grant select on public.mth_blog_posts to anon, authenticated;
grant insert, update, delete on public.mth_blog_posts to authenticated;

-- pictures for articles (PubMed screenshots, covers) go in site-media/blog/
drop policy if exists "admins upload blog pictures" on storage.objects;
create policy "admins upload blog pictures" on storage.objects for insert with check (bucket_id = 'site-media' and name like 'blog/%' and public.mth_is_admin());
drop policy if exists "admins replace blog pictures" on storage.objects;
create policy "admins replace blog pictures" on storage.objects for update using (bucket_id = 'site-media' and name like 'blog/%' and public.mth_is_admin()) with check (bucket_id = 'site-media' and name like 'blog/%' and public.mth_is_admin());
drop policy if exists "admins delete blog pictures" on storage.objects;
create policy "admins delete blog pictures" on storage.objects for delete using (bucket_id = 'site-media' and name like 'blog/%' and public.mth_is_admin());

-- the vault also keeps videos (small files here; course videos live on Cloudflare Stream)
alter table public.mth_library drop constraint if exists mth_library_shelf_check;
alter table public.mth_library add constraint mth_library_shelf_check check (shelf in ('ebook','book','software','video'));

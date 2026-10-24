-- Mark's Library: a private vault for every ebook, finished book and software text,
-- and the public Library / book store built from the items Mark chooses to list.
--   shelf   : ebook | book | software
--   stage   : raw -> polishing -> signature -> ready   (Mark's polishing progress)
--   listing : private (vault only) | free (free download, email first) | sale (price + buy link) | amazon (Amazon link)

create table if not exists public.mth_library (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  description text,
  notes       text,                                   -- Mark's own notes, never shown publicly
  shelf       text not null default 'ebook' check (shelf in ('ebook','book','software')),
  topic       text,
  stage       text not null default 'raw' check (stage in ('raw','polishing','signature','ready')),
  listing     text not null default 'private' check (listing in ('private','free','sale','amazon')),
  price_cents integer check (price_cents is null or price_cents >= 0),
  buy_url     text,
  amazon_url  text,
  file_path   text,                                   -- in bucket library-files
  file_name   text,
  file_type   text,
  file_size   bigint,
  cover_url   text,                                   -- public URL in bucket library-covers
  featured    boolean not null default false,
  sort        integer not null default 0,
  downloads   integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.mth_library enable row level security;
drop policy if exists "admin manages library" on public.mth_library;
create policy "admin manages library" on public.mth_library for all to authenticated
  using (public.mth_is_admin()) with check (public.mth_is_admin());

-- what visitors may see: listed items only, without Mark's notes
create or replace function public.mth_library_public()
returns table (id uuid, title text, subtitle text, description text, shelf text, topic text, listing text,
               price_cents integer, buy_url text, amazon_url text, file_type text, cover_url text, featured boolean, sort integer)
language sql stable security definer set search_path = public as $$
  select id, title, subtitle, description, shelf, topic, listing, price_cents, buy_url, amazon_url,
         file_type, cover_url, featured, sort
  from public.mth_library where listing <> 'private'
  order by featured desc, sort, title;
$$;
grant execute on function public.mth_library_public() to anon, authenticated;

-- free download: join the email list, count it, and hand back the file path to open
create or replace function public.mth_library_free(p_id uuid, p_email text, p_anon text default null, p_utm jsonb default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_path text; v_title text;
begin
  select file_path, title into v_path, v_title from public.mth_library where id = p_id and listing = 'free';
  if v_path is null then return null; end if;
  if p_email is not null and p_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform public.mth_join(lower(trim(p_email)), null, 'library: ' || left(v_title, 60), p_anon, p_utm);
  end if;
  update public.mth_library set downloads = downloads + 1 where id = p_id;
  return v_path;
end $$;
grant execute on function public.mth_library_free(uuid, text, text, jsonb) to anon, authenticated;

-- storage: private vault files (admin), readable by anyone only when the item is a free download
insert into storage.buckets (id, name, public, file_size_limit)
values ('library-files', 'library-files', false, 524288000)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-covers', 'library-covers', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "admin library files" on storage.objects;
create policy "admin library files" on storage.objects for all to authenticated
  using (bucket_id in ('library-files','library-covers') and public.mth_is_admin())
  with check (bucket_id in ('library-files','library-covers') and public.mth_is_admin());
drop policy if exists "free library downloads" on storage.objects;
create policy "free library downloads" on storage.objects for select to anon, authenticated
  using (bucket_id = 'library-files' and exists (
    select 1 from public.mth_library l where l.file_path = storage.objects.name and l.listing = 'free'));

-- Mark Talks Health: words Mark changes on his pages (Admin -> Website words).
-- One row per changed piece of text: page (index, gut, diabetes ...), key (its place on the page),
-- orig (the original words, used to find it again if the layout moves), html (the new words).
-- Everyone can read (pages show the new words); only admins can write.

create table if not exists public.mth_site_text (
  page text not null,
  key text not null,
  orig text not null default '',
  html text not null default '',
  updated_at timestamptz not null default now(),
  primary key (page, key)
);
alter table public.mth_site_text enable row level security;
create policy "anyone reads site words" on public.mth_site_text for select to anon, authenticated using (true);
create policy "admins write site words" on public.mth_site_text for all to authenticated using (public.mth_is_admin()) with check (public.mth_is_admin());
grant select on public.mth_site_text to anon, authenticated;
grant insert, update, delete on public.mth_site_text to authenticated;

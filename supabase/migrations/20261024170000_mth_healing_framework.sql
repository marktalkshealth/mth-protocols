-- Healing Framework, Part 1 (Healing Snapshot intake) and Part 5 (weekly check-ins).
-- Each member sees and changes only their own rows. Mark (admin) can read all, to follow up personally.
create table if not exists public.mth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  red_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.mth_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid references public.mth_snapshots(id) on delete set null,
  scores jsonb not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists mth_snapshots_user on public.mth_snapshots(user_id, created_at desc);
create index if not exists mth_checkins_user on public.mth_checkins(user_id, created_at desc);
alter table public.mth_snapshots enable row level security;
alter table public.mth_checkins enable row level security;
drop policy if exists "own snapshots" on public.mth_snapshots;
create policy "own snapshots" on public.mth_snapshots for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin reads snapshots" on public.mth_snapshots;
create policy "admin reads snapshots" on public.mth_snapshots for select to authenticated using (public.mth_is_admin());
drop policy if exists "own checkins" on public.mth_checkins;
create policy "own checkins" on public.mth_checkins for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin reads checkins" on public.mth_checkins;
create policy "admin reads checkins" on public.mth_checkins for select to authenticated using (public.mth_is_admin());

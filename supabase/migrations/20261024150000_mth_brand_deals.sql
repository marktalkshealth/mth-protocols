-- Brand deals: sponsors / licensing CRM for Mark Talks Health.
--   mth_brands       one row per company (pipeline stage, contact, notes, next step)
--   mth_deals        quotes that become contracts: deliverables, licence, price, dates, contract text
--   mth_brand_settings  Mark's rate card (single row, id = 1)
--   mth_brand_inquiry()  public "Partner with us" form → new brand at stage 'inquiry'
-- All tables admin-only (mth_is_admin()); the form goes through the security-definer function.

create table if not exists public.mth_brands (
  id bigint generated always as identity primary key,
  name text not null,
  website text,
  category text,
  contact_name text,
  contact_email text,
  stage text not null default 'prospect',   -- prospect, inquiry, pitched, talking, quoted, signed, delivered, paid, renewal, lost
  source text default 'manual',             -- manual | website
  fit text,                                 -- why they fit the channel
  notes text,
  next_step text,
  next_date date,
  budget text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mth_deals (
  id bigint generated always as identity primary key,
  brand_id bigint references public.mth_brands(id) on delete cascade,
  title text not null default 'New deal',
  status text not null default 'draft',     -- draft, sent, accepted, signed, delivered, paid, declined
  items jsonb not null default '[]',        -- deliverables [{format, qty, fee_cents}]
  rights jsonb not null default '{}',       -- licence choices
  total_cents integer not null default 0,
  deposit_pct integer not null default 50,
  live_date date,                           -- first day the brand may use the ad
  usage_ends date,                          -- licence end (null = perpetual or not set)
  contract text,                            -- edited contract text
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mth_brand_settings (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.mth_brand_settings (id, data) values (1, '{}') on conflict (id) do nothing;

alter table public.mth_brands enable row level security;
alter table public.mth_deals enable row level security;
alter table public.mth_brand_settings enable row level security;

drop policy if exists "admins manage brands" on public.mth_brands;
create policy "admins manage brands" on public.mth_brands for all to authenticated using (public.mth_is_admin()) with check (public.mth_is_admin());
drop policy if exists "admins manage deals" on public.mth_deals;
create policy "admins manage deals" on public.mth_deals for all to authenticated using (public.mth_is_admin()) with check (public.mth_is_admin());
drop policy if exists "admins manage brand settings" on public.mth_brand_settings;
create policy "admins manage brand settings" on public.mth_brand_settings for all to authenticated using (public.mth_is_admin()) with check (public.mth_is_admin());

create index if not exists mth_deals_brand on public.mth_deals(brand_id);

-- Public form on partners.html. Validates lengths, merges repeat inquiries from the same email.
create or replace function public.mth_brand_inquiry(
  p_company text, p_name text, p_email text, p_website text, p_budget text, p_interest text, p_message text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_note text;
begin
  if coalesce(trim(p_company),'') = '' or coalesce(trim(p_email),'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please add your company and a valid email';
  end if;
  if length(coalesce(p_message,'')) > 4000 or length(p_company) > 200 or length(coalesce(p_name,'')) > 200
     or length(p_email) > 200 or length(coalesce(p_website,'')) > 300 or length(coalesce(p_budget,'')) > 100
     or length(coalesce(p_interest,'')) > 200 then
    raise exception 'That message is too long';
  end if;
  -- simple flood guard: max 20 website inquiries per hour overall
  if (select count(*) from mth_brands where source = 'website' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Please try again later';
  end if;
  v_note := to_char(now(),'YYYY-MM-DD') || ' · Website inquiry' ||
            coalesce(E'\nInterested in: ' || nullif(trim(p_interest),''), '') ||
            coalesce(E'\nBudget: ' || nullif(trim(p_budget),''), '') ||
            coalesce(E'\n' || nullif(trim(p_message),''), '');
  select id into v_id from mth_brands where lower(contact_email) = lower(trim(p_email)) order by id desc limit 1;
  if v_id is not null then
    update mth_brands set notes = coalesce(notes || E'\n\n','') || v_note, updated_at = now(),
      stage = case when stage in ('lost','prospect') then 'inquiry' else stage end where id = v_id;
  else
    insert into mth_brands (name, website, contact_name, contact_email, stage, source, notes, budget, next_step, next_date)
    values (trim(p_company), nullif(trim(p_website),''), nullif(trim(p_name),''), lower(trim(p_email)), 'inquiry', 'website',
            v_note, nullif(trim(p_budget),''), 'Reply to inquiry', current_date);
  end if;
  return true;
end $$;
revoke all on function public.mth_brand_inquiry(text,text,text,text,text,text,text) from public;
grant execute on function public.mth_brand_inquiry(text,text,text,text,text,text,text) to anon, authenticated;

-- Menetrend: publikus pontok + kezdőlap-publikálás beállítás
-- Futtasd a Supabase SQL Editorban (a schedule_items táblának már léteznie kell).

-- 1) Egyes menetrendi pontok jelölése publikusként
alter table public.schedule_items
  add column if not exists is_public boolean not null default false;

-- 2) Oldal-szintű beállítás: megjelenjen-e a menetrend a kezdőlapon
create table if not exists public.site_settings (
  id integer primary key default 1,
  schedule_published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);

insert into public.site_settings (id, schedule_published)
values (1, false)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

do $$
begin
  -- Kezdőlap: bárki olvashatja, hogy be van-e kapcsolva a publikálás
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Anyone can read site settings'
  ) then
    create policy "Anyone can read site settings"
    on public.site_settings
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Admins can insert site settings'
  ) then
    create policy "Admins can insert site settings"
    on public.site_settings
    for insert
    to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Admins can update site settings'
  ) then
    create policy "Admins can update site settings"
    on public.site_settings
    for update
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  -- Kezdőlap: vendégek csak a publikus menetrendi pontokat olvashatják
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_items'
      and policyname = 'Anyone can read public schedule items'
  ) then
    create policy "Anyone can read public schedule items"
    on public.schedule_items
    for select
    to anon, authenticated
    using (is_public = true);
  end if;
end $$;

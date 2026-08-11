-- Esküvői feladatok követése
-- Futtasd a Supabase SQL Editorban.

-- Admin profilok: innen választjuk a feladatokhoz assignolt embereket
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Feladatok (alfeladat: parent_id kitöltve)
create table if not exists public.wedding_tasks (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.wedding_tasks (id) on delete cascade,
  title text not null default '',
  progress integer not null default 0
    check (progress >= 0 and progress <= 100),
  notes text not null default '',
  timing text not null default 'months_before_more_than_6'
    check (
      timing in (
        'wedding_day',
        'days_before_1',
        'days_before_2',
        'days_before_3',
        'wedding_week',
        'weeks_before_1',
        'weeks_before_2_3',
        'months_before_1',
        'months_before_2',
        'months_before_3_6',
        'months_before_more_than_6'
      )
    ),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Feladat–admin hozzárendelések (több admin / feladat)
create table if not exists public.wedding_task_assignees (
  task_id uuid not null references public.wedding_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (task_id, user_id)
);

-- Alapanyagok (feladathoz kötve vagy wishlistben, task_id nélkül)
create table if not exists public.wedding_task_materials (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.wedding_tasks (id) on delete set null,
  name text not null default '',
  source text not null default '',
  estimated_price numeric(12, 2) not null default 0,
  is_acquired boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists wedding_tasks_parent_id_idx
  on public.wedding_tasks (parent_id);

create index if not exists wedding_tasks_sort_order_idx
  on public.wedding_tasks (sort_order);

create index if not exists wedding_tasks_timing_idx
  on public.wedding_tasks (timing);

create index if not exists wedding_task_assignees_user_id_idx
  on public.wedding_task_assignees (user_id);

create index if not exists wedding_task_materials_task_id_idx
  on public.wedding_task_materials (task_id);

alter table public.admin_profiles enable row level security;
alter table public.wedding_tasks enable row level security;
alter table public.wedding_task_assignees enable row level security;
alter table public.wedding_task_materials enable row level security;

do $$
begin
  -- admin_profiles
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_profiles'
      and policyname = 'Admins can read admin profiles'
  ) then
    create policy "Admins can read admin profiles"
    on public.admin_profiles for select to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_profiles'
      and policyname = 'Admins can insert admin profiles'
  ) then
    create policy "Admins can insert admin profiles"
    on public.admin_profiles for insert to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_profiles'
      and policyname = 'Admins can update admin profiles'
  ) then
    create policy "Admins can update admin profiles"
    on public.admin_profiles for update to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_profiles'
      and policyname = 'Admins can delete admin profiles'
  ) then
    create policy "Admins can delete admin profiles"
    on public.admin_profiles for delete to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  -- wedding_tasks
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_tasks'
      and policyname = 'Admins can read wedding tasks'
  ) then
    create policy "Admins can read wedding tasks"
    on public.wedding_tasks for select to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_tasks'
      and policyname = 'Admins can insert wedding tasks'
  ) then
    create policy "Admins can insert wedding tasks"
    on public.wedding_tasks for insert to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_tasks'
      and policyname = 'Admins can update wedding tasks'
  ) then
    create policy "Admins can update wedding tasks"
    on public.wedding_tasks for update to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_tasks'
      and policyname = 'Admins can delete wedding tasks'
  ) then
    create policy "Admins can delete wedding tasks"
    on public.wedding_tasks for delete to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  -- wedding_task_assignees
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_task_assignees'
      and policyname = 'Admins can read wedding task assignees'
  ) then
    create policy "Admins can read wedding task assignees"
    on public.wedding_task_assignees for select to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_task_assignees'
      and policyname = 'Admins can insert wedding task assignees'
  ) then
    create policy "Admins can insert wedding task assignees"
    on public.wedding_task_assignees for insert to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_task_assignees'
      and policyname = 'Admins can delete wedding task assignees'
  ) then
    create policy "Admins can delete wedding task assignees"
    on public.wedding_task_assignees for delete to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  -- wedding_task_materials
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_task_materials'
      and policyname = 'Admins can read wedding task materials'
  ) then
    create policy "Admins can read wedding task materials"
    on public.wedding_task_materials for select to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_task_materials'
      and policyname = 'Admins can insert wedding task materials'
  ) then
    create policy "Admins can insert wedding task materials"
    on public.wedding_task_materials for insert to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_task_materials'
      and policyname = 'Admins can update wedding task materials'
  ) then
    create policy "Admins can update wedding task materials"
    on public.wedding_task_materials for update to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wedding_task_materials'
      and policyname = 'Admins can delete wedding task materials'
  ) then
    create policy "Admins can delete wedding task materials"
    on public.wedding_task_materials for delete to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;
end $$;

-- Feltölti az admin_profiles táblát a meglévő admin userekkel
insert into public.admin_profiles (user_id, display_name)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'name', ''), email, 'Admin')
from auth.users
where coalesce(raw_app_meta_data ->> 'role', '') = 'admin'
on conflict (user_id) do update
set display_name = excluded.display_name;

-- Esküvői költségvetés táblák
-- Futtasd a Supabase SQL Editorban.

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  budgeted_amount numeric(12, 2) not null default 0,
  parent_id uuid references public.budget_categories (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.budget_categories (id) on delete cascade,
  amount numeric(12, 2) not null,
  description text not null default '',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists budget_categories_parent_id_idx
  on public.budget_categories (parent_id);

create index if not exists budget_categories_sort_order_idx
  on public.budget_categories (sort_order);

create index if not exists budget_transactions_category_id_idx
  on public.budget_transactions (category_id);

create index if not exists budget_transactions_transaction_date_idx
  on public.budget_transactions (transaction_date desc);

alter table public.budget_categories enable row level security;
alter table public.budget_transactions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'Admins can read budget categories'
  ) then
    create policy "Admins can read budget categories"
    on public.budget_categories
    for select
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'Admins can insert budget categories'
  ) then
    create policy "Admins can insert budget categories"
    on public.budget_categories
    for insert
    to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'Admins can update budget categories'
  ) then
    create policy "Admins can update budget categories"
    on public.budget_categories
    for update
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_categories'
      and policyname = 'Admins can delete budget categories'
  ) then
    create policy "Admins can delete budget categories"
    on public.budget_categories
    for delete
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_transactions'
      and policyname = 'Admins can read budget transactions'
  ) then
    create policy "Admins can read budget transactions"
    on public.budget_transactions
    for select
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_transactions'
      and policyname = 'Admins can insert budget transactions'
  ) then
    create policy "Admins can insert budget transactions"
    on public.budget_transactions
    for insert
    to authenticated
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_transactions'
      and policyname = 'Admins can update budget transactions'
  ) then
    create policy "Admins can update budget transactions"
    on public.budget_transactions
    for update
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_transactions'
      and policyname = 'Admins can delete budget transactions'
  ) then
    create policy "Admins can delete budget transactions"
    on public.budget_transactions
    for delete
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;
end $$;

-- Opcionális kezdő adatok (csak üres adatbázis esetén futtasd)
with inserted_parents as (
  insert into public.budget_categories (name, budgeted_amount, sort_order)
  values
    ('Étel és ital', 0, 1),
    ('Esküvőfotós', 250000, 2),
    ('Menyasszony', 0, 3),
    ('Dekoráció', 0, 4),
    ('Meghívók', 0, 5),
    ('Zenekar', 0, 6),
    ('Helyszín', 0, 7)
  returning id, name
),
bride_parent as (
  select id from inserted_parents where name = 'Menyasszony'
),
decor_parent as (
  select id from inserted_parents where name = 'Dekoráció'
),
invite_parent as (
  select id from inserted_parents where name = 'Meghívók'
),
music_parent as (
  select id from inserted_parents where name = 'Zenekar'
),
venue_parent as (
  select id from inserted_parents where name = 'Helyszín'
),
inserted_children as (
  insert into public.budget_categories (name, budgeted_amount, parent_id, sort_order)
  select * from (
    values
      ('Esküvői ruha', 200000, (select id from bride_parent), 1),
      ('Cipő', 50000, (select id from bride_parent), 2),
      ('Smink', 50000, (select id from bride_parent), 3),
      ('Haj', 30000, (select id from bride_parent), 4),
      ('Ékszer', 50000, (select id from bride_parent), 5),
      ('Save the date', 0, (select id from decor_parent), 1),
      ('Meghívó', 0, (select id from decor_parent), 2),
      ('Menükártya', 0, (select id from decor_parent), 3),
      ('Virágok', 0, (select id from decor_parent), 4),
      ('Fényfüzér', 0, (select id from decor_parent), 5),
      ('Esküvői torta', 0, (select id from invite_parent), 1),
      ('DJ', 0, (select id from music_parent), 1),
      ('Zenekar', 0, (select id from music_parent), 2),
      ('Szállás', 0, (select id from venue_parent), 1),
      ('Bérleti díj', 0, (select id from venue_parent), 2)
  ) as child_rows(name, budgeted_amount, parent_id, sort_order)
  returning id, name
)
insert into public.budget_transactions (category_id, amount, description, transaction_date)
select id, amount, description, transaction_date
from (
  select
    (select id from inserted_children where name = 'Esküvői ruha') as id,
    200000::numeric as amount,
    'Esküvői ruha előleg' as description,
    current_date as transaction_date
  union all
  select
    (select id from inserted_parents where name = 'Esküvőfotós'),
    250000,
    'Fotós előleg',
    current_date
) seeded_transactions
where id is not null;

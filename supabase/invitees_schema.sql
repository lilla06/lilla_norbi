-- Meghívottak + tervezett/valós ülésrend és szobabeosztás
-- Futtasd a Supabase SQL Editorban.

-- 1) Meghívottak listája (admin által szerkesztett)
create table if not exists public.invitees (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  label text,
  invite_round text not null default 'first'
    check (invite_round in ('first', 'second')),
  guest_id bigint unique references public.guests (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invitees_name_idx
  on public.invitees (name);

create index if not exists invitees_guest_id_idx
  on public.invitees (guest_id);

create index if not exists invitees_invite_round_idx
  on public.invitees (invite_round);

alter table public.invitees enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invitees' and policyname = 'invitees_select_admin'
  ) then
    create policy invitees_select_admin
      on public.invitees for select to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invitees' and policyname = 'invitees_insert_admin'
  ) then
    create policy invitees_insert_admin
      on public.invitees for insert to authenticated
      with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invitees' and policyname = 'invitees_update_admin'
  ) then
    create policy invitees_update_admin
      on public.invitees for update to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invitees' and policyname = 'invitees_delete_admin'
  ) then
    create policy invitees_delete_admin
      on public.invitees for delete to authenticated
      using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;
end $$;

-- 2) Ülésrend: tervezett vs valós
alter table public.seating_assignments
  add column if not exists plan_type text;

update public.seating_assignments
set plan_type = 'actual'
where plan_type is null;

alter table public.seating_assignments
  alter column plan_type set default 'actual';

alter table public.seating_assignments
  alter column plan_type set not null;

alter table public.seating_assignments
  drop constraint if exists seating_assignments_plan_type_check;

alter table public.seating_assignments
  add constraint seating_assignments_plan_type_check
  check (plan_type in ('planned', 'actual'));

-- Régi egyedi kulcs (plan_type nélkül) ütközne a két nézettel
alter table public.seating_assignments
  drop constraint if exists seating_assignments_table_key_seat_index_key;
drop index if exists seating_assignments_table_key_seat_index_key;

create unique index if not exists seating_assignments_plan_unique
  on public.seating_assignments (table_key, seat_index, plan_type);

-- Az elsődleges kulcsba is bele kell tenni a plan_type-ot
do $$
declare
  pk_name text;
  pk_columns text[];
begin
  select con.conname,
         array_agg(att.attname order by att.attnum)
    into pk_name, pk_columns
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid
   and att.attnum = any (con.conkey)
  where con.conrelid = 'public.seating_assignments'::regclass
    and con.contype = 'p'
  group by con.conname;

  if pk_name is not null
     and not ('plan_type' = any (pk_columns))
     and pk_columns <@ array['table_key', 'seat_index']
  then
    execute format('alter table public.seating_assignments drop constraint %I', pk_name);
    execute 'alter table public.seating_assignments
               add primary key (table_key, seat_index, plan_type)';
    execute 'drop index if exists seating_assignments_plan_unique';
  end if;
end $$;

-- 3) Szobabeosztás: tervezett vs valós
alter table public.accommodation_assignments
  add column if not exists plan_type text;

update public.accommodation_assignments
set plan_type = 'actual'
where plan_type is null;

alter table public.accommodation_assignments
  alter column plan_type set default 'actual';

alter table public.accommodation_assignments
  alter column plan_type set not null;

alter table public.accommodation_assignments
  drop constraint if exists accommodation_assignments_plan_type_check;

alter table public.accommodation_assignments
  add constraint accommodation_assignments_plan_type_check
  check (plan_type in ('planned', 'actual'));

alter table public.accommodation_assignments
  drop constraint if exists accommodation_assignments_room_key_bed_key_slot_index_key;
drop index if exists accommodation_assignments_room_key_bed_key_slot_index_key;

create unique index if not exists accommodation_assignments_plan_unique
  on public.accommodation_assignments (room_key, bed_key, slot_index, plan_type);

do $$
declare
  pk_name text;
  pk_columns text[];
begin
  select con.conname,
         array_agg(att.attname order by att.attnum)
    into pk_name, pk_columns
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid
   and att.attnum = any (con.conkey)
  where con.conrelid = 'public.accommodation_assignments'::regclass
    and con.contype = 'p'
  group by con.conname;

  if pk_name is not null
     and not ('plan_type' = any (pk_columns))
     and pk_columns <@ array['room_key', 'bed_key', 'slot_index']
  then
    execute format('alter table public.accommodation_assignments drop constraint %I', pk_name);
    execute 'alter table public.accommodation_assignments
               add primary key (room_key, bed_key, slot_index, plan_type)';
    execute 'drop index if exists accommodation_assignments_plan_unique';
  end if;
end $$;

-- 4) Meghívott kör (ha a tábla már korábban létrejött)
alter table public.invitees
  add column if not exists invite_round text;

update public.invitees
set invite_round = 'first'
where invite_round is null;

alter table public.invitees
  alter column invite_round set default 'first';

alter table public.invitees
  alter column invite_round set not null;

alter table public.invitees
  drop constraint if exists invitees_invite_round_check;

alter table public.invitees
  add constraint invitees_invite_round_check
  check (invite_round in ('first', 'second'));

create index if not exists invitees_invite_round_idx
  on public.invitees (invite_round);



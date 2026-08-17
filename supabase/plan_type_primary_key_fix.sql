-- Tervezett / valós nézet: az elsődleges kulcsba be kell kerülnie a plan_type-nak,
-- különben a két nézet ugyanazokra a helyekre ütközik.
-- Futtasd a Supabase SQL Editorban.

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
    -- A pkey mar biztositja az egyedisseget, a korabbi index redundans
    execute 'drop index if exists seating_assignments_plan_unique';
  end if;
end $$;

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

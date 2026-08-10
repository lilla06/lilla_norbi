-- Feladatok: mikor végezhető el
-- Futtasd a Supabase SQL Editorban, miután a tasks_schema.sql már lefutott.

alter table public.wedding_tasks
  add column if not exists timing text not null default 'anytime';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wedding_tasks_timing_check'
  ) then
    alter table public.wedding_tasks
      add constraint wedding_tasks_timing_check
      check (
        timing in (
          'wedding_day',
          'days_before_1',
          'days_before_2',
          'days_before_3',
          'week_before',
          'rsvp_window',
          'anytime'
        )
      );
  end if;
end $$;

create index if not exists wedding_tasks_timing_idx
  on public.wedding_tasks (timing);

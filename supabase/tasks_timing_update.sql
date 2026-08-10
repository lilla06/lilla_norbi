-- Feladatok időzítési opciók frissítése
-- Futtasd a Supabase SQL Editorban, ha a timing oszlop / constraint már létezik.
-- Fontos: előbb a constraintet dobjuk el, csak utána írjuk át az adatokat.

alter table public.wedding_tasks
  drop constraint if exists wedding_tasks_timing_check;

-- Régi értékek átírása az új skálára
update public.wedding_tasks
set timing = 'wedding_week'
where timing = 'week_before';

update public.wedding_tasks
set timing = 'months_before_1'
where timing = 'rsvp_window';

update public.wedding_tasks
set timing = 'months_before_3_6'
where timing = 'months_before_3';

update public.wedding_tasks
set timing = 'months_before_more_than_6'
where timing in ('anytime', 'months_before_more_than_3');

-- Bármilyen ismeretlen maradék érték a legtávolabbi kategóriába kerül
update public.wedding_tasks
set timing = 'months_before_more_than_6'
where timing not in (
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
);

alter table public.wedding_tasks
  alter column timing set default 'months_before_more_than_6';

alter table public.wedding_tasks
  add constraint wedding_tasks_timing_check
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
  );

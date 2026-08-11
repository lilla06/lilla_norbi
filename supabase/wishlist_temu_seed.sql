-- Wishlist feltöltése: Temuról beszerzendő, feladathoz nem rendelt tételek
-- Futtasd a Supabase SQL Editorban, MIUTÁN a tasks_materials_optional_task.sql már lefutott.
-- Újrafuttatás esetén a már létező (ugyanolyan nevű, task_id nélküli) tételeket nem duplicálja.

insert into public.wedding_task_materials (
  task_id,
  name,
  source,
  estimated_price,
  is_acquired,
  sort_order
)
select
  null,
  item.name,
  'Temu',
  0,
  false,
  item.sort_order
from (
  values
    (1,  'Leila ruhácska'),
    (2,  'Kerti fáklyák'),
    (3,  'LED gyertyaszett'),
    (4,  'Elemek'),
    (5,  'LED fényfüzér'),
    (6,  'Körabroszok'),
    (7,  'Mű moha'),
    (8,  'Üvegbúra ?'),
    (9,  'Mű virágok'),
    (10, 'Mű futók'),
    (11, 'Bevonulós szőnyeg'),
    (12, 'Mandzsetta'),
    (13, 'Nyakkendő tű'),
    (14, 'Gyűrű hordó doboz'),
    (15, 'Csipeszek'),
    (16, 'Buborék fújó'),
    (17, 'Mini üvegek vendégajándékhoz'),
    (18, 'LED fotófal'),
    (19, 'Lebegő gyertyák ?'),
    (20, 'Tündér fények'),
    (21, 'Fotel huzatok'),
    (22, 'Sziromoknak zsák'),
    (23, 'pénzes ladika'),
    (24, 'asztal táblák')
) as item(sort_order, name)
where not exists (
  select 1
  from public.wedding_task_materials existing
  where existing.task_id is null
    and lower(existing.name) = lower(item.name)
);

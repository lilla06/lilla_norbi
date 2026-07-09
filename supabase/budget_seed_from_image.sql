-- Törli a meglévő költségvetési adatokat, majd feltölti a képen szereplő kategóriákkal.
-- Futtasd a Supabase SQL Editorban.

begin;

delete from public.budget_transactions;
delete from public.budget_categories;

with inserted_parents as (
  insert into public.budget_categories (name, budgeted_amount, sort_order)
  values
    ('Helyszín & szállás', 1000000, 1),
    ('Étel & ital', 3000000, 2),
    ('Torta', 90000, 3),
    ('Kamu torta', 14000, 4),
    ('Egyházi ceremónia', 80000, 5),
    ('Polgári ceremónia', 80000, 6),
    ('Ceremóniamester', 280000, 7),
    ('DJ & fénytechnika', 150000, 8),
    ('Fotós & videós', 590000, 9),
    ('Közlekedés', 20000, 10),
    ('Gyűrűk', 80000, 11),
    ('Vőlegény', 120000, 12),
    ('Menyasszony', 200000, 13),
    ('Dekor', 400000, 14),
    ('Szék', 165000, 15),
    ('Ajándék', 150000, 16)
  returning id, name
),
decor_parent as (
  select id from inserted_parents where name = 'Dekor'
),
bride_parent as (
  select id from inserted_parents where name = 'Menyasszony'
)
insert into public.budget_categories (name, budgeted_amount, parent_id, sort_order)
values
  ('Save the date', 5000, (select id from decor_parent), 1),
  ('Meghívó', 30000, (select id from decor_parent), 2),
  ('Menü & itallap', 20000, (select id from decor_parent), 3),
  ('Welcome tükör', 16000, (select id from decor_parent), 4),
  ('Welcome sign', 4000, (select id from decor_parent), 5),
  ('Bar sign', 3000, (select id from decor_parent), 6),
  ('Művirág', 100000, (select id from decor_parent), 7),
  ('Élővirág', 150000, (select id from decor_parent), 8),
  ('Drapériák & szalvétát', 35000, (select id from decor_parent), 9),
  ('Fények & gyertyák', 60000, (select id from decor_parent), 10),
  ('Asztaldísz', 50000, (select id from decor_parent), 11),
  ('Elemek', 40000, (select id from decor_parent), 12),
  ('Rögzítés', 10000, (select id from decor_parent), 13),
  ('Menyasszonyi ruha', 100000, (select id from bride_parent), 1),
  ('Menyecske ruha', 20000, (select id from bride_parent), 2),
  ('Lapos talpú cipő', 5000, (select id from bride_parent), 3),
  ('Tánccipő', 12000, (select id from bride_parent), 4),
  ('Szempilla', 16000, (select id from bride_parent), 5),
  ('Körmös', 30000, (select id from bride_parent), 6),
  ('Smink', 40000, (select id from bride_parent), 7),
  ('Haj', 50000, (select id from bride_parent), 8),
  ('Ékszer', 5000, (select id from bride_parent), 9);

commit;

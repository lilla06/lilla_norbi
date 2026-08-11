-- Alapanyagok: feladat nélkül is létezhetnek (wishlist)
-- Futtasd a Supabase SQL Editorban.

alter table public.wedding_task_materials
  alter column task_id drop not null;

-- Feladat törlésekor az alapanyag maradjon a wishlistben, task_id = null
alter table public.wedding_task_materials
  drop constraint if exists wedding_task_materials_task_id_fkey;

alter table public.wedding_task_materials
  add constraint wedding_task_materials_task_id_fkey
  foreign key (task_id)
  references public.wedding_tasks (id)
  on delete set null;

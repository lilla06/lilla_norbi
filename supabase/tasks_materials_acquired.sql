-- Alapanyagok: beszerezve pipa
-- Futtasd a Supabase SQL Editorban.

alter table public.wedding_task_materials
  add column if not exists is_acquired boolean not null default false;

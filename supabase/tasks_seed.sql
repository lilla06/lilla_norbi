-- Esküvői feladatok feltöltése
-- Futtasd a Supabase SQL Editorban, MIUTÁN a tasks_schema.sql már lefutott.
--
-- Először átnevezi az admin profilokat:
--   "Lilla Matyasi" -> "Lilla"
--   "Ruszin Norbert" -> "Norbi"
-- Ezek a rövid nevek jelennek meg a Feladatok oldalon.
--
-- Ha újra szeretnéd futtatni: előtte töröld a meglévő feladatokat, pl.:
--   delete from public.wedding_tasks where parent_id is null;

do $$
declare
  lilla_id uuid;
  norbi_id uuid;
  task_id uuid;
  v_parent_id uuid;
  sort_counter integer := 0;
begin
  -- A feladatok oldalon rövid neveket jelenítünk meg
  update public.admin_profiles
  set display_name = 'Lilla'
  where display_name ilike '%lilla%';

  update public.admin_profiles
  set display_name = 'Norbi'
  where display_name ilike '%norbert%'
     or display_name ilike '%ruszin%'
     or display_name ilike '%norbi%';

  select user_id into lilla_id
  from public.admin_profiles
  where display_name = 'Lilla'
  order by display_name
  limit 1;

  select user_id into norbi_id
  from public.admin_profiles
  where display_name = 'Norbi'
  order by display_name
  limit 1;

  if lilla_id is null then
    raise exception 'Nem található Lilla az admin_profiles táblában (keresett: Lilla Matyasi / Lilla).';
  end if;

  if norbi_id is null then
    raise exception 'Nem található Norbi az admin_profiles táblában (keresett: Ruszin Norbert / Norbi).';
  end if;

  -- ---------------------------------------------------------------------------
  -- Segédfüggvény-szerű blokkok helyett inline beszúrások
  -- Leaf feladat: assignee a feladaton
  -- Parent + alfeladatok: assignee az alfeladatokon
  -- ---------------------------------------------------------------------------

  -- === Közös szülő: Uszadékfa asztaldísz (Norbi + Lilla alfeladatok) ===
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Uszadékfa asztaldísz', 0, '', sort_counter)
  returning id into v_parent_id;

  insert into public.wedding_tasks (parent_id, title, progress, notes, sort_order)
  values
    (v_parent_id, 'Uszadékfa gyűjtés', 0, '', 1),
    (v_parent_id, 'Uszadékfa darabolás', 0, '', 2),
    (v_parent_id, 'Uszadékfa kifőzés', 0, '', 3),
    (v_parent_id, 'Uszadékfa asztaldísz készítés', 0, '', 4);

  insert into public.wedding_task_assignees (task_id, user_id)
  select wt.id, norbi_id
  from public.wedding_tasks wt
  where wt.parent_id = v_parent_id
    and wt.title in ('Uszadékfa gyűjtés', 'Uszadékfa darabolás', 'Uszadékfa kifőzés');

  insert into public.wedding_task_assignees (task_id, user_id)
  select wt.id, lilla_id
  from public.wedding_tasks wt
  where wt.parent_id = v_parent_id
    and wt.title = 'Uszadékfa asztaldísz készítés';

  -- === Norbi leaf feladatok ===
  -- Tündérkert
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Tündérkert', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Signature koktélok
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Signature koktélok', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Ceremónia rituálé
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Ceremónia rituálé', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Pap bácsi egyeztetés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Pap bácsi egyeztetés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Anyakönyvvezető egyeztetés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Anyakönyvvezető egyeztetés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Faládák beszerzése
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Faládák beszerzése', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Régi bőröndök elhozatal
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Régi bőröndök elhozatal', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Köszönőajándék
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Köszönőajándék', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- === Vőlegény ruhák (Norbi alfeladatok) ===
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Vőlegény ruhák', 0, '', sort_counter)
  returning id into v_parent_id;

  insert into public.wedding_tasks (parent_id, title, progress, notes, sort_order)
  values
    (v_parent_id, 'Norbi Öltönyvásárlás', 0, '', 1),
    (v_parent_id, 'Norbi Cipő vásárlás', 0, '', 2),
    (v_parent_id, 'Norbi éjfél utáni ruha vásárlás', 0, '', 3);

  insert into public.wedding_task_assignees (task_id, user_id)
  select wt.id, norbi_id
  from public.wedding_tasks wt
  where wt.parent_id = v_parent_id;

  -- Borosüveg tündérfény
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Borosüveg tündérfény', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Tánc összerakása
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Tánc összerakása', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Animáció összerakás
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Animáció összerakás', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Norbi analóg óra kölcsön
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Norbi analóg óra kölcsön', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Torta állvány
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Torta állvány', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- Extra italbeszerzés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Extra italbeszerzés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, norbi_id);

  -- === Lilla leaf feladatok ===
  -- Tükör dekorálás
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Tükör dekorálás', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Szülő köszöntő ajándékok
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Szülő köszöntő ajándékok', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Boldogság kapu készítés ?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Boldogság kapu készítés?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Úti tábla
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Úti tábla', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Köszöntő táblák
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Köszöntő táblák', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Ültetési rend tábla
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Ültetési rend tábla', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Meghívók
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Meghívók', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Útlevél?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Útlevél?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- DIY Virág oszlopok?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('DIY Virág oszlopok?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Mennyezet körgyűrű
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Mennyezet körgyűrű', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Bucket list ?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Bucket list?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Szék dekor
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Szék dekor', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Bevonulós szőnyeg
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Bevonulós szőnyeg', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Torta készítés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Torta készítés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Műanyag poharak hajnalra ?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Műanyag poharak hajnalra?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- Asztal leírások égetett papírra
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Asztal leírások égetett papírra', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id) values (task_id, lilla_id);

  -- === Lilla és Norbi közös leaf feladatok ===
  -- Diaoráma asztaldísz festés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Diaoráma asztaldísz festés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Zene gyűjtés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Zene gyűjtés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Fotó/videó ötlet gyűjtés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Fotó/videó ötlet gyűjtés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Vendégváró játékok
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Vendégváró játékok', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Élő borostyán szedés
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Élő borostyán szedés', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Terítő vásárlás ?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Terítő vásárlás?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Befőttes üveg tündérmanó?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Befőttes üveg tündérmanó?', 0, 'HP wedding Pinterest inspiráció', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Főasztal háttér tábla?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Főasztal háttér tábla?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Quest for the ring játék?
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Quest for the ring játék?', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Gyűrűk
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Gyűrűk', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

  -- Fényképfalra fénykép válogatás, nyomtatás
  sort_counter := sort_counter + 1;
  insert into public.wedding_tasks (title, progress, notes, sort_order)
  values ('Fényképfalra fénykép válogatás, nyomtatás', 0, '', sort_counter)
  returning id into task_id;
  insert into public.wedding_task_assignees (task_id, user_id)
  values (task_id, lilla_id), (task_id, norbi_id);

end $$;

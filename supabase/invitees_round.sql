-- Meghívott kör (első / második)
-- Futtasd a Supabase SQL Editorban, ha az invitees tábla már létezik.

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

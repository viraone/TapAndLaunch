-- StageTime: the hosts dictate one set length for every comic from the Timer tab. It is stored on the single show-clock row
-- (lineup_spotlight, id 1) in the SHOW database (rickshaw-open-mic, ref ldodkbdzljfpbnzrpxpu), not the tapandlaunch one.
-- Run this BEFORE the code that selects the new columns is deployed (the clock query names them), in the Supabase SQL
-- editor, Viradeth only. The table's UPDATE rights are per column, so the two new columns need their own grant; the
-- existing row policy ("Hosts can move the spotlight") and the lineup_spotlight_stamp trigger still make it hosts only.

-- 1. See the table now (expect: no set_minutes columns yet).
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'lineup_spotlight' order by ordinal_position;

-- 2. Add the columns and let signed-in users update them (RLS + the trigger refuse anyone who is not a host).
alter table public.lineup_spotlight
  add column if not exists set_minutes smallint check (set_minutes between 1 and 15),
  add column if not exists set_minutes_for date;
grant update (set_minutes, set_minutes_for) on public.lineup_spotlight to authenticated;

-- 3. Take it back (comics' lengths go back to the sheet): the app ignores a null set_minutes.
-- update public.lineup_spotlight set set_minutes = null, set_minutes_for = null where id = 1;

-- 4. (added 2026-11-09) One comic's own length: a jsonb map {"for": "<show date>", "minutes": {"<lower-cased name>": 7}}. Run this
-- BEFORE deploying the picker version of the Timer tab (the clock query names set_each). Same column-grant rule as above.
alter table public.lineup_spotlight add column if not exists set_each jsonb;
grant update (set_each) on public.lineup_spotlight to authenticated;
-- Take it back: update public.lineup_spotlight set set_each = null where id = 1;

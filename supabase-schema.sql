-- =====================================================================
--  SQUASH-SCHIEDSRICHTER – SUPABASE SCHEMA
--  Im Supabase-Dashboard: SQL Editor -> New query -> alles einfügen -> Run
-- =====================================================================

-- Tabelle für alle Spiele -----------------------------------------------
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  draw            text,
  round           text,
  match_no        text,
  player1_name    text not null,
  player1_country text default 'de',
  player2_name    text not null,
  player2_country text default 'de',
  best_of         int  default 3,
  court_id        int,                         -- null = nicht zugewiesen
  status          text default 'scheduled',    -- scheduled | live | finished | confirmed
  state           jsonb,                       -- kompletter Spielzustand (vom Tablet gepflegt)
  result          text,                        -- z.B. '3-1'
  winner          int,                         -- 1 oder 2
  scheduled_time  timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Realtime für die Tabelle aktivieren -----------------------------------
alter publication supabase_realtime add table public.matches;

-- Row Level Security ----------------------------------------------------
-- ACHTUNG: Der anon-Key steckt im Browser und ist öffentlich.
-- Die folgenden Policies erlauben allen Lesen/Schreiben – ok für ein
-- geschlossenes Vereins-/Turnier-Tool im lokalen Netz. Für den echten
-- öffentlichen Einsatz solltest du Auth + strengere Policies ergänzen.
alter table public.matches enable row level security;

drop policy if exists "anon_read"   on public.matches;
drop policy if exists "anon_write"  on public.matches;
drop policy if exists "anon_update" on public.matches;
drop policy if exists "anon_delete" on public.matches;

create policy "anon_read"   on public.matches for select using (true);
create policy "anon_write"  on public.matches for insert with check (true);
create policy "anon_update" on public.matches for update using (true) with check (true);
create policy "anon_delete" on public.matches for delete using (true);

-- Optional: Beispiel-Daten ---------------------------------------------
insert into public.matches (draw, round, match_no, player1_name, player1_country,
                            player2_name, player2_country, best_of) values
  ('Ju11','RR1','#1','Jonas Buchholz','de','Johann Middele','de',3),
  ('Ju11','RR1','#2','Max Böhme','de','Bennet Bloching','de',3),
  ('U13/U17','Group A','#3','Dominik Bodo','de','Ahmad Wali Sherzad','af',5);

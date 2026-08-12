-- =====================================================================
--  SQUASH-SCHIEDSRICHTER – Supabase-Schema
--  Im Supabase-Dashboard unter "SQL Editor" ausführen.
--  Für BESTEHENDE Installationen einfach erneut ausführen – dank
--  "IF NOT EXISTS" werden nur die fehlenden Spalten ergänzt (Migration).
-- =====================================================================

-- 1) Tabelle -----------------------------------------------------------
create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  -- Turnier / Ansetzung
  event         text,            -- z.B. "BU19", "BU17 - Qualification A"
  draw          text,            -- Alt-Feld / Kompatibilität (= event)
  round         text,            -- z.B. "R64", "RR1"
  match_no      text,            -- Nr. aus der Importdatei, z.B. "#27"

  -- Spieler
  player1_name    text not null,
  player1_country text,          -- ISO-Code: "de", "nl", "eng" ...
  player2_name    text not null,
  player2_country text,

  -- Court / Zeit
  court_id        int,           -- physischer Court, wenn LIVE (aus Zuweisung)
  court_no        int,           -- geplanter Court laut Importdatei (CC->1, C2->2 ...)
  court_label     text,          -- Original-Label aus Import ("CC", "C2" ...)
  scheduled_time  text,          -- Original-Zeit ("Do 19.02.2026 16:10")
  sort_ts         bigint,        -- Zeit als Zahl (ms) zum Sortieren

  -- Schiedsrichter (automatisch = beide Spieler des Vorspiels am Court)
  referee         text,

  -- Spielmodus & Ergebnis
  best_of       int default 3,
  status        text default 'scheduled',   -- scheduled | live | confirmed
  state         jsonb,                       -- laufender Spielstand (Engine)
  result        text,                        -- Satz-Endstand, z.B. "3-1"
  winner        int,                         -- 1 oder 2
  score_text    text,                        -- Sätze einzeln: "11-9 8-11 11-5"

  -- Import-Deduplizierung
  import_key    text
);

-- 2) Migration bestehender Tabellen -----------------------------------
alter table public.matches add column if not exists event          text;
alter table public.matches add column if not exists court_no       int;
alter table public.matches add column if not exists court_label    text;
alter table public.matches add column if not exists scheduled_time text;
alter table public.matches add column if not exists sort_ts        bigint;
alter table public.matches add column if not exists referee        text;
alter table public.matches add column if not exists score_text     text;
alter table public.matches add column if not exists import_key     text;

-- 3) Indizes -----------------------------------------------------------
create index if not exists matches_status_idx     on public.matches (status);
create index if not exists matches_courtno_idx    on public.matches (court_no);
create index if not exists matches_sortts_idx     on public.matches (sort_ts);
create unique index if not exists matches_importkey_uidx
  on public.matches (import_key) where import_key is not null;

-- 4) Realtime aktivieren ----------------------------------------------
-- Nur hinzufügen, wenn die Tabelle noch nicht Teil der Realtime-Publikation
-- ist (sonst Fehler 42710 "is already member of publication").
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

-- 5) Row Level Security -----------------------------------------------
-- ACHTUNG: Der anon-Key ist im Browser sichtbar. Die folgenden Policies
-- erlauben JEDEM mit der URL Lesen UND Schreiben. Für ein internes
-- Vereins-/Turnier-Tool im WLAN ist das meist okay. Wer es absichern
-- will, nutzt z.B. eine eigene Auth oder eine Edge Function als Proxy.
alter table public.matches enable row level security;

drop policy if exists "public read"   on public.matches;
drop policy if exists "public insert" on public.matches;
drop policy if exists "public update" on public.matches;
drop policy if exists "public delete" on public.matches;

create policy "public read"   on public.matches for select using (true);
create policy "public insert" on public.matches for insert with check (true);
create policy "public update" on public.matches for update using (true) with check (true);
create policy "public delete" on public.matches for delete using (true);

-- =====================================================================
--  6) Einstellungen (geräteübergreifend: Logo, Hintergrund, Courts …)
-- =====================================================================
create table if not exists public.app_settings (
  id          text primary key default 'app',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

insert into public.app_settings (id, data)
  values ('app', '{}'::jsonb)
  on conflict (id) do nothing;

-- Realtime nur hinzufügen, wenn noch nicht Mitglied
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;

alter table public.app_settings enable row level security;
drop policy if exists "settings read"  on public.app_settings;
drop policy if exists "settings write" on public.app_settings;
create policy "settings read"  on public.app_settings for select using (true);
create policy "settings write" on public.app_settings for all using (true) with check (true);

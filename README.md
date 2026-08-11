# Squash-Schiedsrichter-App

Zentrale Turnierverwaltung + Schiedsrichter-Tablets pro Court, verbunden über
Supabase Realtime. Läuft komplett aus statischen Dateien (GitHub Pages).

## Was drin ist

| Datei | Zweck |
|---|---|
| `index.html` | **Verwaltung** – Spiele per Drag&Drop auf Courts ziehen, Ergebnisse zurückholen |
| `court.html` | **Schiedsrichter-Tablet** – eine Datei für alle Courts, gesteuert über `?court=N` |
| `store.js` | Datenschicht (Supabase **oder** lokaler Testmodus) |
| `config.js` | Zugangsdaten + Einstellungen – **hier trägst du deine Supabase-Daten ein** |
| `supabase-schema.sql` | Datenbank-Setup |

Zur Kernfrage aus deiner Nachricht: **Nein, du brauchst nicht pro Court eine
eigene HTML-Datei.** Es gibt genau eine `court.html`. Jedes Tablet bekommt nur
eine eigene URL mit Court-Nummer:

```
https://DEINNAME.github.io/squash/court.html?court=1   ← Tablet Court 1
https://DEINNAME.github.io/squash/court.html?court=2   ← Tablet Court 2
...
```

## Schnellstart ohne Server (zum Ausprobieren)

Ohne Supabase-Daten in `config.js` läuft alles im **lokalen Testmodus** – zwei
Browser-Tabs im selben Browser reden über den Rechner miteinander (kein
Internet, keine geräteübergreifende Nutzung):

1. Ordner öffnen, `index.html` im Browser öffnen → „Demo-Daten laden“.
2. Zweiten Tab öffnen: `court.html?court=1`.
3. In der Verwaltung ein Spiel auf **Court 1** ziehen → es poppt im Court-Tab auf.

Damit siehst du den kompletten Ablauf. Für echte Tablets an echten Courts →
Supabase einrichten (unten).

## Einrichtung mit Supabase (echter Betrieb)

1. **Projekt anlegen** auf [supabase.com](https://supabase.com) (kostenlos).
2. **Schema laden:** SQL Editor → Inhalt von `supabase-schema.sql` einfügen → *Run*.
3. **Zugangsdaten holen:** Settings → API → `Project URL` und `anon public` key.
4. In **`config.js`** eintragen:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...'
   ```
5. Fertig – die Verwaltung zeigt oben „● Supabase verbunden“.

## Deployment auf GitHub Pages

1. Repo anlegen, alle Dateien hochladen (Ordnerstruktur beibehalten).
2. Repo → Settings → Pages → Source: `main` / root → Save.
3. Nach ~1 Min ist alles erreichbar unter `https://DEINNAME.github.io/REPO/`.
   - Verwaltung: `.../index.html`
   - Tablets: `.../court.html?court=1` usw.

> `config.js` mit dem anon-Key liegt öffentlich im Repo. Der anon-Key ist dafür
> gedacht, aber siehe Sicherheitshinweis in `supabase-schema.sql`.

## Bedienung

**Verwaltung (`index.html`)**
- Spiel anlegen: „+ Spiel hinzufügen“. Best-of pro Spiel über die „Bo“-Auswahl.
- Zuweisen: Spiel auf einen Court **ziehen** – oder Spiel antippen, dann Court
  antippen (praktisch am Touchscreen).
- Läuft ein Spiel, zeigt die Court-Kachel den Live-Stand.
- Ist es beendet, erscheint „Bestätigen & zurückholen“ → Ergebnis landet unter
  „Bestätigte Ergebnisse“, der Court wird frei.

**Schiedsrichter-Tablet (`court.html?court=N`)**
- Aufwärm-Overlay mit Timer; danach wählst du, wer zuerst aufschlägt.
- **Punkt:** großes Feld des Spielers antippen (blau = Spieler 1, rot = Spieler 2).
- **Aufschlag:** der weiße Punkt zeigt den Aufschläger, das Feld „Aufschlag ·
  Rechts/Links“ die Box. Wechsel passieren automatisch nach PARS-Regeln.
- **R? / Let:** Behinderung → *Let* (Wiederholung), *Stroke* (Punkt für den
  behinderten Spieler) oder *No Let* (Punkt für den Gegner) über „Punkt →“.
- **Undo:** das ↶ in der Mitte nimmt den letzten Punkt zurück (auch am Matchende).
- **Satzball / Matchball** werden farbig eingeblendet.
- Zwischen den Sätzen läuft automatisch die 90-Sekunden-Pause.
- Bei Matchende wird das Ergebnis automatisch an die Verwaltung gemeldet.

## Squash-Regeln, die die App umsetzt

- **PARS bis 11**, Punkt bei jedem Ballwechsel, bei 10:10 mit 2 Punkten Vorsprung.
- **Aufschlag:** Aufschläger behält bei Punktgewinn den Aufschlag und wechselt die
  Box (R↔L); bei Hand-out wechselt der Aufschlag zum Gegner (der startet rechts).
- **Best of 3 oder 5**, pro Spiel einstellbar; Satzgewinner schlägt im nächsten
  Satz auf.
- **Timer:** Aufwärmen (Standard 5:00), Satzpause 90 s, Timeout – in `config.js`
  anpassbar.

## Wiederaufnahme

Der komplette Spielstand liegt in der Datenbank (`state`). Fällt ein Tablet aus
oder wird neu geladen, holt es sich beim Neustart automatisch den aktuellen Stand
und macht weiter.

## Nächste sinnvolle Schritte

- Anbindung an deine bestehende Turniersoftware (der Screenshot sieht nach
  *Tournament Planner* aus): Spiele automatisch als `matches` importieren statt
  von Hand anzulegen.
- Auth ergänzen, falls die Seiten öffentlich erreichbar sein sollen.
- Referee-Namen / Marker und Protokoll (jeder Punkt mit Zeitstempel) mitschreiben.

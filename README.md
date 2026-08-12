# 🎾 Squash-Schiedsrichter & Turnierverwaltung

Eine kleine, statische Web-App für Squash-Turniere:

- **Verwaltung** (`index.html`) – zeigt alle Courts und angesetzten Spiele.
  Ein Spiel per **Drag&Drop** (oder Button) auf einen Court legen → auf dem
  Court-Tablet erscheint sofort das Schiedsrichter-Board.
- **Court-Tablet** (`court.html?court=N`) – Schiedsrichter-Anzeige im
  „Squore“-Stil: große Punkte, Aufschlagseite, Satz-/Matchball, Timer,
  Let-Entscheidung, Undo. Solange kein Spiel anliegt, zeigt es eine
  **Vorschau der nächsten Spiele** dieses Courts.

Kommunikation läuft über **Supabase Realtime** (geräteübergreifend) – oder,
ganz ohne Konto, im **lokalen Testmodus** (nur Tabs im selben Browser).

---

## Dateien

| Datei                 | Zweck                                                        |
|-----------------------|-------------------------------------------------------------|
| `index.html`          | Verwaltung: Courts, Ansetzungen, Import, Ergebnisse         |
| `court.html`          | Schiedsrichter-Tablet (pro Court via `?court=N`)            |
| `config.js`           | Einstellungen (Supabase-Keys, Courts, Regeln)               |
| `store.js`            | Datenschicht + Helfer (Flaggen, Import-Parsing)             |
| `supabase-schema.sql` | Datenbank-Tabelle + Realtime + Rechte                       |
| `README.md`           | Diese Anleitung                                             |

---

## Schnellstart (lokaler Testmodus, ohne Internet-Konto)

1. Ordner in einen kleinen Webserver legen, z.B.:
   ```bash
   cd squash-referee
   python3 -m http.server 8000
   ```
2. Verwaltung öffnen: `http://localhost:8000/index.html`
3. Court-Tablet öffnen (zweiter Tab): `http://localhost:8000/court.html?court=1`
4. In der Verwaltung „**Demo**“ klicken (oder XLSX importieren), ein Spiel auf
   Court 1 ziehen → im Court-Tab läuft das Board.

> Im lokalen Modus synchronisieren sich nur Tabs **im selben Browser**
> (über `localStorage`/`BroadcastChannel`). Für echte Tablets Supabase nutzen.

---

## Echtbetrieb mit Supabase (mehrere Geräte)

1. Kostenloses Projekt auf **supabase.com** anlegen.
2. Im **SQL Editor** die Datei `supabase-schema.sql` ausführen.
   (Bei einem bestehenden Projekt einfach erneut ausführen – fehlende
   Spalten werden per Migration ergänzt.)
3. Unter **Settings → API** `Project URL` und `anon public`-Key kopieren und
   in `config.js` eintragen:
   ```js
   SUPABASE_URL: 'https://DEINPROJEKT.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...'
   ```
4. Dateien hochladen (z.B. **GitHub Pages**: Repo anlegen, Dateien pushen,
   Settings → Pages → Branch `main`/`root`). Die App läuft komplett statisch.

Jedes Court-Tablet ruft `…/court.html?court=1`, `?court=2` usw. auf.

---

## Spiele importieren (Tournament-Planner-XLSX)

In der Verwaltung: **„⬆ XLSX importieren“** und die Export-Datei aus dem
Squash Tournament Planner wählen. Die App liest die Spalten
`Time, Event, Nr, Court, Round, Team 1, Team 2, Score` automatisch.

Dabei gilt:

- **Bereits gespielte Spiele werden übersprungen.** Ist die Spalte `Score`
  gefüllt (z.B. `11-9 8-11 11-5`), gilt das Spiel als erledigt und wird
  **nicht** importiert. Nur offene Spiele landen in der Ansetzungsliste.
- **Duplikate werden erkannt** (gleiche Event+Nr+Runde+Spieler) – die Datei
  kann also gefahrlos mehrfach importiert werden.
- **Spielernamen & Länder** werden aus `Name (Land)[Setzung]` gelesen; die
  passende **Flagge** wird automatisch gesetzt (inkl. England/Schottland/Wales).
- Nach dem Import erscheint eine Meldung, z.B.
  *„79 importiert · 25 bereits gespielt übersprungen · 0 Duplikate“*.

### Court-Bezeichnungen sind flexibel

Die `Court`-Spalte darf `C1`, `1`, `C-1`, `Court 1` … heißen – die Ziffer
wird herausgelesen (`C2`→2, `C-13`→13). Namens-Courts ohne Ziffer werden über
`COURT_ALIASES` in `config.js` zugeordnet. Standard:

```js
COURT_ALIASES: { 'CC': 1 }   // "CC" (Center Court) = Court 1
```

Ein Tablet mit `?court=2` zeigt also automatisch alle Spiele, die im Import
auf `C2` (oder `2`, `C-2` …) stehen.

---

## Automatische Schiedsrichter

Beim Import trägt die App als Schiedsrichter automatisch **beide Spieler der
vorherigen Begegnung auf demselben Court** ein (sortiert nach Uhrzeit). So
pfeift jede Paarung das direkt folgende Spiel auf ihrem Court – auch wenn das
Vorspiel bereits gespielt war. Der Schiedsrichter erscheint

- in der **Ansetzungsliste** (Spalte „Schiedsrichter“),
- in der **Court-Vorschau** auf dem Tablet,
- und im **Live-Board** unten während des Spiels.

(Manuell angelegte Spiele haben zunächst keinen Schiedsrichter.)

---

## Vorschau pro Court

Solange auf einem Court kein Spiel läuft, zeigt `court.html?court=N` unter
„Warte auf Spiel“ die **nächsten Spiele dieses Courts**: Uhrzeit, Begegnung
(mit Flaggen), Event/Runde und Schiedsrichter. Die Anzahl steuert
`QUEUE_PREVIEW` in `config.js`.

---

## Ergebnisse & Satzergebnisse (für den Tournament Planner)

Wird ein Spiel beendet, meldet das Tablet automatisch zurück. Unter
**„Bestätigte Ergebnisse“** stehen dann:

- Der Satz-Endstand (z.B. `3-1`) und der Sieger,
- **alle einzelnen Satzergebnisse** als Text, z.B. `11-9 8-11 9-11 11-6`.

Ein Klick auf die Satzergebnisse **kopiert sie in die Zwischenablage** – so
lassen sie sich direkt im Tournament Planner eintragen.

---

## Squash-Regeln (eingebaut)

- **PARS bis 11**: Punkt bei jedem Ballwechsel, bei 10:10 mit zwei Punkten
  Vorsprung.
- **Aufschlag**: Gewinnt der Aufschläger, behält er das Aufschlagrecht und
  wechselt die Seite (Rechts↔Links). Bei Hand-out bekommt der Gegner Punkt
  **und** Aufschlag und beginnt rechts.
- **Best of 3 oder 5** pro Spiel einstellbar (importierte Junioren-Spiele
  stehen standardmäßig auf Bo5). Der Satzgewinner schlägt im nächsten Satz auf.
- **Timer**: Aufwärmen (5:00), Satzpause (90 s), Timeout.
- **Let-Button (R?)**: Let (Wiederholung, kein Punkt) oder Punkt an einen
  Spieler (deckt Stroke und No-Let ab).
- **Undo** nimmt den letzten Punkt bzw. Schritt zurück.

---

## Sicherheitshinweis

Der `anon`-Key steht im Browser und ist damit öffentlich. Die mitgelieferten
Policies erlauben Lesen **und** Schreiben für alle, die die URL kennen – für
ein internes Turnier-Tool im Vereins-WLAN in der Regel ausreichend. Wer es
absichern möchte, ergänzt eine eigene Authentifizierung oder einen Proxy.

---

# Neu: Einstellungen, Branding, Auto-Nachrücken, Livestream

## Datenbank aktualisieren
Wenn du Supabase nutzt: `supabase-schema.sql` **erneut** im SQL-Editor ausführen.
Es ist idempotent und legt zusätzlich die Tabelle `app_settings` an (für Logo,
Hintergrund, Courts und Optionen, die auf allen Geräten gelten).

## Einstellungsseite (`settings.html`)
Erreichbar über „⚙️ Einstellungen“ oben in der Verwaltung. Dort einstellbar:
- **Turniername** (erscheint in den Stream-Anzeigen),
- **Logo** und **Hintergrundbild** – per Datei-Upload oder als URL/Pfad. Kleine
  Logos werden direkt gespeichert und dauerhaft eingebunden; große Hintergründe
  besser als Datei (z.B. `assets/background.jpg`) oder URL,
- **Greenscreen-Farbe** der Stream-Anzeigen (Standard `#82F84E`),
- **„Spiele automatisch auf den Court nachrücken“**,
- **Courts** (Nummern) – darunter stehen für jeden Court alle **Links** zum
  Kopieren (Schiedsrichter-Tablet und die vier Stream-Ansichten).

Einstellungen gelten mit Supabase auf allen Geräten, im Testmodus im jeweiligen
Browser.

## Automatisch nachrücken
Ist die Option aktiv, rückt nach „**Bestätigen & zurückholen**“ automatisch das
nächste geplante Spiel dieses Courts auf das Tablet – der Schiedsrichter startet
dann nur noch den Timer. Ist sie inaktiv, zeigt der Court nach dem Matchball:
**„Das nächste Spiel wird von der Turnierleitung gestartet.“** – zusammen mit
Logo, Hintergrund und der Vorschau der nächsten Spiele.

## Warnung beim Court-Wechsel
Ziehst du ein Spiel, das für einen bestimmten Court geplant ist, auf einen
**anderen** Court, kommt eine Rückfrage, bevor es umgesetzt wird.

## Ergebnisse nachträglich bearbeiten
Unter „Bestätigte Ergebnisse“ werden die Sätze jetzt **groß** dargestellt. Über
**„✎ Ergebnis bearbeiten“** lassen sich einzelne Sätze ändern, hinzufügen oder
entfernen; Satzstand, Sieger und die Kopiervorlage werden automatisch neu
berechnet.

## Livestream- & Vollbild-Anzeige (`stream.html`)
Pro Court gibt es eine Greenscreen-Anzeige, die sich live aktualisiert:
`stream.html?court=N&view=…` mit vier Ansichten:
- `scoreboard` – große **Vollbild**-Punkteanzeige (auch für einen Monitor am Court),
- `psaline` – kompakte einzeilige PSA-Leiste,
- `fullscore` – Titelzeile mit Turnier/Court/Uhr, Namen, Länderkürzeln und Sätzen,
- `modern` – moderne, schräge Variante mit Flaggen.

Bedienung: Maus bewegen zeigt die Leiste oben rechts (Ansicht wechseln, Vollbild).
Tasten: **1–4** Ansicht, **F** Vollbild, **H** Leiste aus/ein.

### In OBS einbinden
Als **Browserquelle** die jeweilige Stream-URL eintragen (z.B. 1920×1080), dann
einen **Chroma-Key-Filter** auf Grün setzen. Für saubere Flaggen im Stream werden
echte Flaggenbilder (flagcdn.com) statt Emoji verwendet – dafür braucht der
Stream-Rechner Internetzugang.

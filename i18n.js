/* =====================================================================
   i18n.js – Sprachumschaltung Deutsch / English
   Ansatz: Die App ist auf Deutsch geschrieben. Bei "en" übersetzt eine
   Engine die Oberfläche automatisch (Wörterbuch DE->EN), inklusive
   dynamisch nachgeladener Inhalte (MutationObserver). Umschalten setzt
   die Sprache und lädt die Seite neu (sauberer Zustand).
   ===================================================================== */
(function () {
  var LANG = localStorage.getItem('lang') || 'de';

  // ---- Wörterbuch: exakter deutscher Text -> Englisch --------------------
  var DICT = {
    // Kopf / Navigation
    '⚙️ Einstellungen': '⚙️ Settings',
    '← Zur Verwaltung': '← To management',
    '⛶ Vollbild': '⛶ Fullscreen',
    '⤢ Fenster': '⤢ Window',
    '⏱ Timer': '⏱ Timer',
    '🔆 Display an': '🔆 Display on',
    '🌙 Display': '🌙 Display',
    'Supabase verbunden': 'Supabase connected',
    'lokaler Testmodus': 'local test mode',
    'Lokaler Testmodus': 'Local test mode',
    'Bildschirm bleibt an': 'Screen stays on',
    'Sprache / Language': 'Sprache / Language',

    // Reiter / Verwaltung
    'Angesetzte Spiele': 'Scheduled Matches',
    'Bestätigte Ergebnisse': 'Confirmed Results',
    'Übertragene Ergebnisse': 'Transferred Results',
    '🖨 TP-Eingabehilfe': '🖨 TP Entry Helper',
    'Alle Courts': 'All Courts',
    '⬆ XLSX importieren': '⬆ Import XLSX',
    '+ Spiel': '+ Match',
    'Demo': 'Demo',
    'Alles löschen': 'Clear all',
    'Suche Spieler / Event…': 'Search player / event…',
    'Courts': 'Courts',
    'Zeit': 'Time',
    'Court': 'Court',
    'Begegnung': 'Match',
    'Schiedsrichter': 'Referee',
    'Bo': 'Bo',
    'Ansetzen': 'Assign',
    'frei': 'free',
    'Läuft': 'Live',
    'Spiel hierher ziehen': 'Drag a match here',
    'Court oben antippen zum Zuweisen': 'Tap a court above to assign',
    'Keine Courts.': 'No courts.',
    'Keine offenen Ansetzungen. „⬆ XLSX importieren“ oder „Demo“.':
      'No open matches. “⬆ Import XLSX” or “Demo”.',
    'vs': 'vs',
    '✎ Bearbeiten': '✎ Edit',
    '✎ Ergebnis bearbeiten': '✎ Edit result',
    'Bestätigen & zurückholen': 'Confirm & pull back',
    'Übertrag TP-Software': 'Transferred to TP software',
    'Noch nichts an die TP-Software übertragen.': 'Nothing transferred to TP software yet.',
    // Ansetzungs-Hinweis (fragmentiert)
    'Spiel auf einen Court': 'Drag a match onto a court',
    'ziehen': '',
    ', den Button': ', use the',
    'nutzen, oder Spiel antippen und dann Court antippen. Bereits gespielte Spiele werden beim Import automatisch übersprungen.':
      'button, or tap a match then tap a court. Already-played matches are skipped automatically on import.',

    // TP-Eingabehilfe
    'nur noch nicht übertragene': 'only not yet transferred',
    'Drucken': 'Print',
    'Schließen': 'Close',
    'Nr': 'No',
    'Begegnung (Sieger fett)': 'Match (winner in bold)',
    'Sätze': 'Games',
    'TP': 'TP',
    'Keine Ergebnisse.': 'No results.',

    // Match-Dialog
    'Spiel hinzufügen': 'Add match',
    'Ergebnis bearbeiten': 'Edit result',
    'Event': 'Event',
    'Runde': 'Round',
    'Spieler': 'Players',
    'Spieler 1': 'Player 1',
    'Spieler 2': 'Player 2',
    'Land 1 (z.B. de oder England)': 'Country 1 (e.g. de or England)',
    'Land 2': 'Country 2',
    'leer = Nationalflagge': 'empty = national flag',
    'Bundesland 1 (optional, z.B. BY)': 'Region 1 (optional, e.g. BY)',
    'Bundesland 2 (optional)': 'Region 2 (optional)',
    'Court-Nr.': 'Court no.',
    'Best of': 'Best of',
    'Zeit (Anzeige)': 'Time (display)',
    'Schiri:': 'Ref:',
    'Wertung': 'Result type',
    'Normal (gespielt)': 'Normal (played)',
    'Walkover (Gegner gewinnt)': 'Walkover (opponent wins)',
    'Retired / Aufgabe (Gegner gewinnt)': 'Retired (opponent wins)',
    'Sieger': 'Winner',
    'Speichern': 'Save',
    'Abbrechen': 'Cancel',
    'z.B. Do 19.02.2026 16:10': 'e.g. Thu 19/02/2026 16:10',
    'optional': 'optional',

    // Court / Board
    'Squash – Court': 'Squash – Court',
    'Warte auf Spiel…': 'Waiting for match…',
    'Keine anstehenden Spiele für diesen Court.': 'No upcoming matches for this court.',
    'Aufwärmen': 'Warm-up',
    'Aufwärmen – Phase 1': 'Warm-up – phase 1',
    'Aufwärmen – Phase 2': 'Warm-up – phase 2',
    'Seiten wechseln – Phase 2': 'Switch sides – phase 2',
    'Seitenwechsel': 'Switch sides',
    '1 MINUTE – MATCH START': '1 MINUTE – MATCH START',
    'Wer schlägt auf?': 'Who serves?',
    'Letzte Minute vor Spielbeginn': 'Last minute before start',
    'Bereit – wer schlägt zuerst auf?': 'Ready – who serves first?',
    'Shirt-Farbe': 'Shirt colour',
    'Squash · Live-Übersicht': 'Squash · Live overview',
    'Laufende Spiele': 'Live matches',
    'In Vorbereitung': 'In preparation',
    'Beendete Spiele': 'Finished matches',
    'Keine laufenden Spiele': 'No live matches',
    'Keine Spiele in Vorbereitung': 'No matches in preparation',
    'Keine beendeten Spiele': 'No finished matches',
    'geplant': 'scheduled',
    'Retired': 'Retired',
    '📺 Live-Anzeige (Vollbild)': '📺 Live display (fullscreen)',
    'Wechselzeit zwischen den Ansichten (Sekunden)': 'Rotation time between views (seconds)',
    'Live-Anzeige': 'Live display',
    'Squash – Live-Anzeige': 'Squash – Live display',
    'Laufende Spiele': 'Live matches',
    'Spiele in Vorbereitung': 'Matches in preparation',
    'Beendete Spiele': 'Finished matches',
    'LÄUFT': 'LIVE', 'VORBEREITUNG': 'PREP', 'BEENDET': 'DONE',
    '📺 Live-Anzeige (Vollbild)': '📺 Live display (fullscreen)',
    'Live-Anzeige': 'Live display',
    '⏱ Timer‑Zeiten (Aufwärmen & Pausen)': '⏱ Timer times (warm-up & breaks)',
    'Seiten wechseln!': 'Switch sides!',
    'Nächste Phase – Start drücken': 'Next phase – press Start',
    'Aufwärmen beendet – wer schlägt zuerst auf?': 'Warm-up finished – who serves first?',
    'noch 60 Sekunden': '60 seconds left',
    'noch 30 Sekunden': '30 seconds left',
    'noch 15 Sekunden': '15 seconds left',
    '15 Sekunden – Spieler bitte auf den Court!': '15 seconds – players to the court, please!',
    'Aufschlagseite wechseln (R/L)': 'Switch serve side (R/L)',
    'Antippen: Satzergebnisse anzeigen': 'Tap: show game scores',
    'Shirt-Farbe Spieler 1': 'Shirt colour player 1',
    'Shirt-Farbe Spieler 2': 'Shirt colour player 2',
    'Aufschlag': 'Serve',
    'Rechts': 'Right',
    'Links': 'Left',
    'Start / Pause': 'Start / Pause',
    'Stop': 'Stop',
    'Reset': 'Reset',
    'Timeout 90s': 'Timeout 90s',
    'Satzpause 90s': 'Set break 90s',
    'Satzpause': 'Set break',
    'Nächsten Satz starten': 'Start next set',
    'Timer': 'Timer',
    'Punkt → P1': 'Point → P1',
    'Punkt → P2': 'Point → P2',
    'Undo': 'Undo',
    'Undo letzter Punkt': 'Undo last point',
    '− Satz': '− Set',
    '+ Satz': '+ Set',
    'Let': 'Let',
    'Let-Entscheidung': 'Let decision',
    'No Let': 'No Let',
    'Stroke': 'Stroke',
    'Wiederholung': 'Replay',
    'Zurück in die Ansetzungen': 'Back to schedule',
    'Vom Court nehmen': 'Remove from court',

    // Verhaltensstrafen
    'Verhaltensstrafe wegen': 'Conduct penalty for',
    'Empfohlene nächste Stufe:': 'Recommended next level:',
    'Verwarnung': 'Warning',
    'Strafpunkt → Gegner': 'Conduct stroke → opponent',
    'Strafsatz → Gegner': 'Conduct game → opponent',
    'Straf­punkt/-satz nur im laufenden Satz möglich': 'Conduct stroke/game only during a running game',
    'Schlägermissbrauch': 'Racket abuse',
    'Obszönität': 'Obscenity',
    'Spielverzögerung': 'Time wasting',
    'Widerspruch': 'Dissent',
    'Beschimpfung / Beleidigung Offizieller': 'Verbal abuse of official',
    'Übermäßiger körperlicher Kontakt': 'Excessive physical contact',
    'Unsportliches Verhalten': 'Unsporting behaviour',
    'Coaching': 'Coaching',

    // Verletzung
    'Verletzungstimer': 'Injury timer',
    'Verletzungspause': 'Injury time-out',
    'Selbst verschuldet · 3:00': 'Self-inflicted · 3:00',
    'Blutung (selbst) · 5:00': 'Bleeding (self) · 5:00',
    'Gegner mitverschuldet · 15:00': 'Opponent contributed · 15:00',
    'Gegner verschuldet · 15:00': 'Opponent-caused · 15:00',
    'Abbrechen (weiterspielen)': 'Cancel (resume)',
    '= Punkt für den Gegner. Beides über „Punkt →“.': '= point to the opponent. Both via “Point →”.',
    '= Punkt für den behinderten Spieler.': '= point to the obstructed player.',
    'Spiel wird fortgesetzt': 'Match resumes',
    'Verletzungspause abgebrochen – weiter': 'Injury time-out cancelled – resume',

    // Overlays (Matchball / Ende / Bestätigung)
    '🏁 Matchball': '🏁 Match ball',
    '🏆 Spielende': '🏆 Match over',
    'Ist das Ergebnis richtig?': 'Is the result correct?',
    'Wer schlägt zuerst auf?': 'Who serves first?',
    'Wer gewinnt das Spiel?': 'Who wins the match?',
    '✓ Ja · an die Turnierleitung': '✓ Yes · to tournament desk',
    '✗ Nein · ein Punkt zurück': '✗ No · one point back',
    '✓ Ja · weiterspielen': '✓ Yes · resume',
    '✗ Nein · Aufgabe (Retired)': '✗ No · retire',
    'Das nächste Spiel wird von der Turnierleitung gestartet.':
      'The next match is started by the tournament desk.',

    // Einstellungen
    'Squash – Einstellungen': 'Squash – Settings',
    'Turniere / Events': 'Tournaments / Events',
    'Aktives Turnier': 'Active tournament',
    'Umbenennen': 'Rename',
    'Löschen': 'Delete',
    'Neues Turnier anlegen': 'Create new tournament',
    'Anlegen & aktivieren': 'Create & activate',
    'Vorhandene Spiele ohne Turnier ins aktive Turnier übernehmen':
      'Adopt existing matches without a tournament into the active tournament',
    'Backup': 'Backup',
    '⬇ Backup des aktiven Turniers herunterladen': '⬇ Download backup of active tournament',
    '⬆ Backup einspielen…': '⬆ Import backup…',
    'Turnier-Anzeigename': 'Tournament display name',
    'Turniername (Kopf der App & Stream-Anzeigen)': 'Tournament name (app header & stream overlays)',
    'z.B. Deutsche Jugend Einzelmeisterschaft 2026': 'e.g. German Junior Championship 2026',
    'z.B. German Junior Open 2026': 'e.g. German Junior Open 2026',
    'Branding': 'Branding',
    'Logo': 'Logo',
    'Hintergrundbild': 'Background image',
    'Bild hochladen…': 'Upload image…',
    'Entfernen': 'Remove',
    'oder URL/Pfad:': 'or URL/path:',
    'Greenscreen-Farbe (Stream-Anzeigen)': 'Green-screen colour (stream overlays)',
    'Hintergrund-Deckkraft:': 'Background opacity:',
    'Ablauf': 'Workflow',
    'Spiele automatisch auf den Court nachrücken': 'Automatically advance matches onto the court',
    'Court-Nummern (kommagetrennt)': 'Court numbers (comma-separated)',
    'Links pro Court': 'Links per court',
    'Öffnen': 'Open',
    'Einstellungen speichern': 'Save settings',
    'Vereinsrangliste-Anbindung': 'Club ranking connection',
    'Schiedsrichter-Konto': 'Referee account',
    'Rangliste Supabase-URL': 'Ranking Supabase URL',
    'Rangliste anon-Key': 'Ranking anon key',
    'Schiedsrichter E-Mail': 'Referee e-mail',
    'Passwort': 'Password',
    'Verbinden & testen': 'Connect & test',
    'Event auswählen & importieren': 'Select event & import',
    'Event importieren': 'Import event',
    'Verknüpfung lösen': 'Unlink',
    'nur auf diesem Gerät': 'this device only',

    // Stream
    'Squash – Stream': 'Squash – Stream',

    // Toasts / Meldungen (statisch)
    'Demo-Daten geladen': 'Demo data loaded',
    'Spiel angelegt': 'Match created',
    'Ergebnis aktualisiert': 'Result updated',
    'Ergebnis bestätigt': 'Result confirmed',
    'Gelöscht': 'Deleted',
    'Gespeichert ✓': 'Saved ✓',
    'Umbenannt': 'Renamed',
    'Turnier gelöscht': 'Tournament deleted',
    'Turnier angelegt & aktiviert': 'Tournament created & activated',
    'Spiele übernommen': 'Matches adopted',
    'Link kopiert': 'Link copied',
    'Bitte beide Spieler eintragen': 'Please enter both players',
    'Bitte ein Event wählen': 'Please select an event',
    'Bitte einen Turniernamen eingeben': 'Please enter a tournament name',
    'Bitte zuerst ein Turnier aktivieren': 'Please activate a tournament first',
    'Kein Turnier ausgewählt': 'No tournament selected',
    'Popup blockiert – bitte erlauben': 'Popup blocked – please allow',
    'An Rangliste: Aufgabe/Walkover übertragen ✓': 'Sent to ranking: retirement/walkover ✓',
    'Ergebnis an Rangliste zurückgeschrieben ✓': 'Result written back to ranking ✓',
    'Rangliste nicht verbunden – Ergebnis lokal bestätigt': 'Ranking not connected – result confirmed locally',
    'Backup eingespielt & aktiviert': 'Backup imported & activated',
    'Hintergrund geladen (noch speichern!)': 'Background loaded (remember to save!)',
    'Logo geladen (noch speichern!)': 'Logo loaded (remember to save!)',
    'Turnier erstellt (bestehende Daten bleiben unberührt).': 'Tournament created (existing data untouched).',
    'Verknüpfung gelöst': 'Unlinked',
    'RET': 'RET', 'W.O.': 'W.O.',
    // Anmeldung / Rollen
    '🎾 Anmeldung': '🎾 Sign in',
    'Bitte mit E-Mail und Passwort anmelden.': 'Please sign in with e-mail and password.',
    'E-Mail': 'E-mail',
    'Anmelden': 'Sign in',
    'Anmelden…': 'Signing in…',
    'Abmelden': 'Sign out',
    'Abmelden / Konto wechseln': 'Sign out / switch account',
    'Kein Zugriff': 'No access',
    'E-Mail oder Passwort falsch.': 'Wrong e-mail or password.',
    'Bitte E-Mail und Passwort eingeben.': 'Please enter e-mail and password.',
    'E-Mail noch nicht bestätigt.': 'E-mail not confirmed yet.',
    'Benutzer & Rollen': 'Users & roles',
    'E-Mail': 'E-mail', 'Rolle': 'Role', 'Angelegt': 'Created',
    'Lade…': 'Loading…',
    'Keine Konten gefunden.': 'No accounts found.',
    'Administrator': 'Administrator',
    'Turnierleitung': 'Tournament desk',
    'Schiedsrichter (Court)': 'Referee (court)',
    'Nur ansehen': 'View only',
    'Keine Berechtigung': 'No permission',
    '— Event wählen —': '— Choose event —',
    '— Kein Turnier (Altdaten) —': '— No tournament (legacy) —',
    '— zuerst verbinden —': '— connect first —',
    'schiedsrichter@verein.de': 'referee@club.com',
    'Vorname Nachname': 'First name Last name'
  };

  // ---- Regeln für dynamische Strings (mit Zahlen/Namen) ------------------
  var RULES = [
    [/^Kopiert: (.+)$/, 'Copied: $1'],
    [/^Ausgewählt: (.+)$/, 'Selected: $1'],
    [/^Fehler beim Laden: (.+)$/, 'Loading error: $1'],
    [/^Fehler: (.+)$/, 'Error: $1'],
    [/^Import-Fehler: (.+)$/, 'Import error: $1'],
    [/^Backup-Fehler: (.+)$/, 'Backup error: $1'],
    [/^Rangliste-Rückschreiben fehlgeschlagen: (.+)$/, 'Ranking write-back failed: $1'],
    [/^(\d+) neue Spiele aus Rangliste geladen$/, '$1 new matches loaded from ranking'],
    [/^Backup heruntergeladen \((\d+) Spiele\)$/, 'Backup downloaded ($1 matches)'],
    [/^✓ (\d+) Spiele importiert & Turnier aktiviert\.$/, '✓ $1 matches imported & tournament activated.'],
    [/^(.+) · (\d+) Ergebnis\(se\)$/, '$1 · $2 result(s)'],
    [/^Bestätigt · (.+)$/, 'Confirmed · $1'],
    [/^Turnier: (.+)$/, 'Tournament: $1'],
    [/^Kein Turnier aktiv$/, 'No tournament active'],
    [/^(\d+) Ergebnis\(se\)$/, '$1 result(s)'],
    [/^●?\s*Supabase verbunden$/, '● Supabase connected'],
    [/^●?\s*Lokaler Testmodus$/, '● Local test mode'],
    [/^Nächste Spiele auf Court (.+)$/, 'Next matches on court $1'],
    [/^Nächstes Spiel auf Court (.+)$/, 'Next match on court $1'],
    [/^Rolle gespeichert: (.+)$/, 'Role saved: $1'],
    [/^Dein Konto \((.+)\) hat für diese Ansicht keine Berechtigung\.$/, 'Your account ($1) has no permission for this view.']
  ];

  function translate(str) {
    var key = str.trim().replace(/\u00A0/g, ' ');
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(DICT, key)) return DICT[key];
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(key)) return key.replace(RULES[i][0], RULES[i][1]);
    }
    return null;
  }

  function fixNode(node) {
    var raw = node.nodeValue;
    if (!raw) return;
    var norm = raw.replace(/\u00A0/g, ' ');
    var key = norm.trim();
    if (!key || /^[\d\s:.,%–—\-\/•()]+$/.test(key)) return;
    var en = translate(key);
    if (en != null && en !== key) node.nodeValue = norm.replace(key, en);
  }

  function fixAttrs(el) {
    if (!el.getAttribute) return;
    ['placeholder', 'title'].forEach(function (a) {
      if (el.hasAttribute(a)) {
        var v = el.getAttribute(a);
        var en = translate(v);
        if (en != null && en !== v.trim()) el.setAttribute(a, en);
      }
    });
  }

  function walk(node) {
    if (node.nodeType === 3) { fixNode(node); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || node.dataset && node.dataset.noI18n !== undefined) return;
    fixAttrs(node);
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  var observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (muts) {
      if (LANG !== 'en') return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        } else if (m.type === 'characterData') {
          fixNode(m.target);
        } else if (m.type === 'attributes' && m.target) {
          fixAttrs(m.target);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['placeholder', 'title']
    });
  }

  function applyAll() { if (LANG === 'en' && document.body) walk(document.body); }

  // Sprachauswahl im Kopf spiegeln
  function mountSelectors() {
    var sels = document.querySelectorAll('[data-lang-select]');
    for (var i = 0; i < sels.length; i++) sels[i].value = LANG;
  }

  function setLang(l) {
    if (l !== 'de' && l !== 'en') l = 'de';
    localStorage.setItem('lang', l);
    // Sauberer Zustand: neu laden (rendert Deutsch, Engine übersetzt bei 'en')
    location.reload();
  }

  // Öffentliche API
  window.I18N = {
    get: function () { return LANG; },
    set: setLang,
    t: function (s) { var en = translate(String(s)); return (LANG === 'en' && en != null) ? en : s; },
    apply: applyAll,
    dict: DICT
  };

  // Sofort Observer starten (fängt Inhalte, die nach diesem Script geparst werden)
  startObserver();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mountSelectors(); applyAll(); });
  } else { mountSelectors(); applyAll(); }
})();

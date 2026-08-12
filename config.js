// =====================================================================
//  KONFIGURATION  (Standardwerte)
//  Vieles lässt sich später auch in der Einstellungsseite (settings.html)
//  ändern – die dortigen Werte überschreiben diese Standards und gelten
//  auf allen Geräten (über Supabase) bzw. lokal (Testmodus).
// =====================================================================

window.CONFIG = {
  // ---- Supabase ---------------------------------------------------
  SUPABASE_URL: 'https://mfgxrnvwrirvjjanigul.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mZ3hybnZ3cmlydmpqYW5pZ3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODgyOTIsImV4cCI6MjEwMjA2NDI5Mn0.rWaYXT4Ve_QEmZMCO8pHWQgG_HUeBqs5eLVewKJUA-8',
                           // leer = LOKALER TESTMODUS (nur dieser Browser)

  // ---- Courts (Standard – in settings.html änderbar) --------------
  COURTS: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],

  // Court-Label aus der Importdatei -> Court-Nummer
  //  "CC" (Center Court) = Court 1;  "C2".."C15" automatisch über Ziffer
  COURT_ALIASES: { 'CC': 1 },

  // ---- Turnier / Branding (Standard – in settings.html änderbar) --
  TOURNAMENT_NAME: 'Squash Turnier',
  LOGO_URL: '',            // optional: Pfad/URL zum Logo (z.B. 'assets/logo.png')
  BACKGROUND_URL: '',      // optional: Pfad/URL zum Hintergrund
  GREEN: '#82F84E',        // Greenscreen-Farbe der Stream-Anzeigen

  // ---- Ablauf -----------------------------------------------------
  AUTO_ASSIGN: false,      // Spiele automatisch nachrücken (in settings.html)

  // ---- Squash-Standardwerte --------------------------------------
  DEFAULT_BEST_OF: 3,
  DEFAULT_IMPORT_BEST_OF: 5,
  POINTS_TO_WIN: 11,
  WARMUP_SECONDS: 300,
  REST_SECONDS: 90,
  QUEUE_PREVIEW: 4,
};

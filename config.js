// =====================================================================
//  KONFIGURATION
//  Einmal ausfüllen. Wird von index.html (Verwaltung) und
//  court.html (Schiedsrichter-Tablet) geladen.
// =====================================================================

window.CONFIG = {
  // ---- Supabase ---------------------------------------------------
  // Aus deinem Supabase-Projekt: Settings -> API
  // Leer lassen = LOKALER TESTMODUS (nur Tabs im selben Browser).
  SUPABASE_URL: 'https://mfgxrnvwrirvjjanigul.supabase.co',        // z.B. 'https://abcd1234.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mZ3hybnZ3cmlydmpqYW5pZ3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODgyOTIsImV4cCI6MjEwMjA2NDI5Mn0.rWaYXT4Ve_QEmZMCO8pHWQgG_HUeBqs5eLVewKJUA-8',   // der "anon public" Schlüssel

  // ---- Courts -----------------------------------------------------
  // So viele Court-Buttons zeigt die Verwaltung. Jedes Tablet öffnet
  // court.html?court=NUMMER.
  COURTS: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],

  // Court-Label aus der Importdatei -> Court-Nummer.
  // Beispiel: "CC" (Center Court) ist Court 1. "C2".."C15" werden
  // automatisch über die Ziffer erkannt (C2->2 usw.).
  // Weitere Sonderfälle hier ergänzen, z.B. { 'CC':1, 'CENTER':1 }.
  COURT_ALIASES: { 'CC': 1 },

  // ---- Squash-Standardwerte --------------------------------------
  DEFAULT_BEST_OF: 3,          // für manuell angelegte Spiele
  DEFAULT_IMPORT_BEST_OF: 5,   // für importierte Spiele (Junioren: Bo5)
  POINTS_TO_WIN: 11,           // PARS bis 11
  WARMUP_SECONDS: 300,         // Aufwärmzeit (5:00)
  REST_SECONDS: 90,            // Satzpause (90 s)

  // Wie viele kommende Spiele die Vorschau auf dem Court-Tablet zeigt
  QUEUE_PREVIEW: 4,
};

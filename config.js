// =====================================================================
//  KONFIGURATION
//  Diese Datei einmal ausfüllen. Sie wird von index.html (Verwaltung)
//  und court.html (Schiedsrichter-Tablet) geladen.
// =====================================================================

window.CONFIG = {
  // ---- Supabase ---------------------------------------------------
  // Aus deinem Supabase-Projekt: Settings -> API
  // Trägst du hier nichts ein, läuft die App im LOKALEN TEST-MODUS
  // (nur mehrere Tabs im selben Browser reden miteinander – kein Internet).
  SUPABASE_URL: 'https://mfgxrnvwrirvjjanigul.supabase.co',        // z.B. 'https://abcd1234.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mZ3hybnZ3cmlydmpqYW5pZ3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODgyOTIsImV4cCI6MjEwMjA2NDI5Mn0.rWaYXT4Ve_QEmZMCO8pHWQgG_HUeBqs5eLVewKJUA-8',   // der "anon public" Schlüssel

  // ---- Courts -----------------------------------------------------
  // So viele Court-Buttons zeigt die Verwaltung. Jeder Court hat ein
  // Tablet, das court.html?court=NUMMER öffnet.
  COURTS: [1, 2, 3, 4, 5, 6],

  // ---- Squash-Standardwerte --------------------------------------
  DEFAULT_BEST_OF: 3,      // 3 oder 5 – pro Spiel beim Ansetzen änderbar
  POINTS_TO_WIN: 11,       // PARS bis 11
  WARMUP_SECONDS: 300,     // Aufwärmzeit (5:00). Für Jugend ggf. 240.
  REST_SECONDS: 90,        // Pause zwischen den Sätzen (90 s)
};

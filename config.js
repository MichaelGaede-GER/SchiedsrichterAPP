// =====================================================================
//  KONFIGURATION  (Standardwerte)
//  Vieles lässt sich später auch in der Einstellungsseite (settings.html)
//  ändern – die dortigen Werte überschreiben diese Standards und gelten
//  auf allen Geräten (über Supabase) bzw. lokal (Testmodus).
// =====================================================================

window.CONFIG = {
  // ---- App-Version (bei jedem Deploy hochzählen) ------------------
  APP_VERSION: '48',

  // ---- Supabase ---------------------------------------------------
  SUPABASE_URL: 'https://mfgxrnvwrirvjjanigul.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mZ3hybnZ3cmlydmpqYW5pZ3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODgyOTIsImV4cCI6MjEwMjA2NDI5Mn0.rWaYXT4Ve_QEmZMCO8pHWQgG_HUeBqs5eLVewKJUA-8',
                           // leer = LOKALER TESTMODUS (nur dieser Browser)

  // ---- Courts (Standard – in settings.html änderbar) --------------
  COURTS: [1,2,3,4,5,6],

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

// ---- Versions-Anzeige (erscheint auf jeder Seite; Quelle: APP_VERSION oben) ----
(function(){
  function show(){
    try{
      if(window.__NO_APPVER) return;                 // Seiten mit eigenem Versions-Badge (court/tablet)
      if(document.getElementById('__appver')) return;
      var d=document.createElement('div'); d.id='__appver';
      d.textContent='v'+((window.CONFIG&&window.CONFIG.APP_VERSION)||'?');
      d.style.cssText='position:fixed;right:7px;bottom:5px;font:600 11px system-ui,Arial,sans-serif;'
        +'color:rgba(150,165,185,.85);background:rgba(0,0,0,.28);padding:1px 7px;border-radius:6px;'
        +'z-index:99999;pointer-events:none;letter-spacing:.03em';
      (document.body||document.documentElement).appendChild(d);
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',show); else show();
})();

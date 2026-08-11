// =====================================================================
//  DATENSCHICHT (Store)
//  Kapselt den Zugriff auf die Spiele. Zwei Backends:
//   - 'supabase' : echte Datenbank + Realtime (geräteübergreifend, Internet)
//   - 'local'    : Fallback über localStorage + BroadcastChannel
//                  (nur Tabs im selben Browser – gut zum Ausprobieren)
//
//  Ein "match"-Objekt sieht so aus:
//  {
//    id, draw, round, match_no,
//    player1_name, player1_country, player2_name, player2_country,
//    best_of, court_id (null wenn nicht zugewiesen),
//    status: 'scheduled' | 'live' | 'finished' | 'confirmed',
//    state: {...},        // kompletter Spielzustand (vom Tablet gepflegt)
//    result, winner
//  }
// =====================================================================

const Store = (() => {
  const cfg = window.CONFIG || {};
  const useSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  let sb = null;

  // ---------------------------------------------------------------
  //  SUPABASE-BACKEND
  // ---------------------------------------------------------------
  function initSupabase() {
    // supabase-js wird per <script> von jsDelivr geladen (siehe HTML)
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const SupabaseStore = {
    mode: 'supabase',
    async listMatches() {
      const { data, error } = await sb.from('matches')
        .select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    async getMatch(id) {
      const { data, error } = await sb.from('matches').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async updateMatch(id, patch) {
      const { error } = await sb.from('matches')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    async insertMatch(match) {
      const { data, error } = await sb.from('matches').insert(match).select().single();
      if (error) throw error;
      return data;
    },
    async deleteAll() {
      await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    },
    // Realtime: die Verwaltung hört auf ALLE Spiele
    subscribeAll(callback) {
      const ch = sb.channel('matches-all')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'matches' },
            () => callback())
        .subscribe();
      return () => sb.removeChannel(ch);
    },
    // Realtime: ein Tablet hört nur auf seinen Court
    subscribeCourt(courtId, callback) {
      const ch = sb.channel('court-' + courtId)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'matches',
              filter: 'court_id=eq.' + courtId },
            () => callback())
        .subscribe();
      return () => sb.removeChannel(ch);
    },
  };

  // ---------------------------------------------------------------
  //  LOKALES BACKEND (Fallback ohne Internet)
  // ---------------------------------------------------------------
  const KEY = 'squash_matches';
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('squash') : null;

  function readLS() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
  function writeLS(rows) {
    localStorage.setItem(KEY, JSON.stringify(rows));
    if (bc) bc.postMessage({ t: 'changed' });
  }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const LocalStore = {
    mode: 'local',
    async listMatches() { return readLS(); },
    async getMatch(id) { return readLS().find(m => m.id === id) || null; },
    async updateMatch(id, patch) {
      const rows = readLS();
      const i = rows.findIndex(m => m.id === id);
      if (i >= 0) { rows[i] = { ...rows[i], ...patch }; writeLS(rows); }
    },
    async insertMatch(match) {
      const rows = readLS();
      const row = { id: uuid(), created_at: new Date().toISOString(), ...match };
      rows.push(row); writeLS(rows); return row;
    },
    async deleteAll() { writeLS([]); },
    subscribeAll(callback) {
      const onMsg = () => callback();
      const onStorage = e => { if (e.key === KEY) callback(); };
      if (bc) bc.addEventListener('message', onMsg);
      window.addEventListener('storage', onStorage);
      return () => { if (bc) bc.removeEventListener('message', onMsg);
                     window.removeEventListener('storage', onStorage); };
    },
    subscribeCourt(courtId, callback) {
      // im lokalen Modus einfach auf alles hören und selbst filtern
      return this.subscribeAll(callback);
    },
  };

  // ---------------------------------------------------------------
  //  GEMEINSAME HELFER (Backend-unabhängig)
  // ---------------------------------------------------------------
  const backend = useSupabase ? SupabaseStore : LocalStore;

  if (useSupabase) initSupabase();

  return {
    mode: backend.mode,
    ready: useSupabase,   // false = lokaler Testmodus
    listMatches: (...a) => backend.listMatches(...a),
    getMatch: (...a) => backend.getMatch(...a),
    updateMatch: (...a) => backend.updateMatch(...a),
    insertMatch: (...a) => backend.insertMatch(...a),
    deleteAll: (...a) => backend.deleteAll(...a),
    subscribeAll: (...a) => backend.subscribeAll(...a),
    subscribeCourt: (...a) => backend.subscribeCourt(...a),

    // Spiel auf Court ziehen: nur wenn Court frei ist
    async assignToCourt(matchId, courtId, bestOf) {
      const all = await backend.listMatches();
      const busy = all.find(m => m.court_id === courtId &&
                                 (m.status === 'live'));
      if (busy) throw new Error('Court ' + courtId + ' ist belegt.');
      await backend.updateMatch(matchId, {
        court_id: courtId,
        status: 'live',
        best_of: bestOf,
        state: null,        // Tablet initialisiert frisch
        result: null,
        winner: null,
      });
    },

    // Ergebnis bestätigen und Court freigeben
    async confirmResult(matchId) {
      await backend.updateMatch(matchId, { status: 'confirmed', court_id: null });
    },

    // Spiel vom Court zurückholen ohne Ergebnis (Fehlzuweisung)
    async unassign(matchId) {
      await backend.updateMatch(matchId, {
        court_id: null, status: 'scheduled', state: null,
        result: null, winner: null,
      });
    },
  };
})();

// Ländercode (ISO-2, z.B. 'de') -> Flaggen-Emoji
function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return '🏳️';
  return cc.toUpperCase().replace(/./g,
    c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

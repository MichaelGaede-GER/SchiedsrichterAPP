// =====================================================================
//  DATENSCHICHT (Store)  +  gemeinsame Helfer (Flaggen, Import-Parsing)
//  Zwei Backends:
//   - 'supabase' : echte Datenbank + Realtime (geräteübergreifend, Internet)
//   - 'local'    : Fallback über localStorage + BroadcastChannel
//                  (nur Tabs im selben Browser – gut zum Ausprobieren)
// =====================================================================

const Store = (() => {
  const cfg = window.CONFIG || {};
  const useSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  let sb = null;

  function initSupabase() {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  // ---------------- SUPABASE-BACKEND ----------------
  const SupabaseStore = {
    mode: 'supabase',
    async listMatches() {
      const { data, error } = await sb.from('matches')
        .select('*').order('sort_ts', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    async getMatch(id) {
      const { data, error } = await sb.from('matches').select('*').eq('id', id).single();
      if (error) throw error; return data;
    },
    async updateMatch(id, patch) {
      const { error } = await sb.from('matches')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    async insertMatch(match) {
      const { data, error } = await sb.from('matches').insert(match).select().single();
      if (error) throw error; return data;
    },
    async insertMany(rows) {
      if (!rows.length) return [];
      const { data, error } = await sb.from('matches').insert(rows).select();
      if (error) throw error; return data;
    },
    async deleteAll() {
      await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    },
    subscribeAll(callback) {
      const ch = sb.channel('matches-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' },
            () => callback()).subscribe();
      return () => sb.removeChannel(ch);
    },
  };

  // ---------------- LOKALES BACKEND ----------------
  const KEY = 'squash_matches';
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('squash') : null;
  function readLS() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function writeLS(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); if (bc) bc.postMessage({ t: 'changed' }); }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); });
  }
  const LocalStore = {
    mode: 'local',
    async listMatches() {
      const rows = readLS();
      rows.sort((a, b) => (a.sort_ts || 0) - (b.sort_ts || 0));
      return rows;
    },
    async getMatch(id) { return readLS().find(m => m.id === id) || null; },
    async updateMatch(id, patch) {
      const rows = readLS(); const i = rows.findIndex(m => m.id === id);
      if (i >= 0) { rows[i] = { ...rows[i], ...patch }; writeLS(rows); }
    },
    async insertMatch(match) {
      const rows = readLS(); const row = { id: uuid(), created_at: new Date().toISOString(), ...match };
      rows.push(row); writeLS(rows); return row;
    },
    async insertMany(list) {
      const rows = readLS();
      const added = list.map(m => ({ id: uuid(), created_at: new Date().toISOString(), ...m }));
      rows.push(...added); writeLS(rows); return added;
    },
    async deleteAll() { writeLS([]); },
    subscribeAll(callback) {
      const onMsg = () => callback();
      const onStorage = e => { if (e.key === KEY) callback(); };
      if (bc) bc.addEventListener('message', onMsg);
      window.addEventListener('storage', onStorage);
      return () => { if (bc) bc.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); };
    },
  };

  const backend = useSupabase ? SupabaseStore : LocalStore;
  if (useSupabase) initSupabase();

  return {
    mode: backend.mode,
    ready: useSupabase,
    listMatches: (...a) => backend.listMatches(...a),
    getMatch: (...a) => backend.getMatch(...a),
    updateMatch: (...a) => backend.updateMatch(...a),
    insertMatch: (...a) => backend.insertMatch(...a),
    insertMany: (...a) => backend.insertMany(...a),
    deleteAll: (...a) => backend.deleteAll(...a),
    subscribeAll: (...a) => backend.subscribeAll(...a),
    // court.html hört ebenfalls auf alle Spiele und filtert lokal
    subscribeCourt: (courtId, cb) => backend.subscribeAll(cb),

    async assignToCourt(matchId, courtId, bestOf) {
      const all = await backend.listMatches();
      const busy = all.find(m => m.court_id === courtId && m.status === 'live');
      if (busy) throw new Error('Court ' + courtId + ' ist belegt.');
      await backend.updateMatch(matchId, {
        court_id: courtId, status: 'live', best_of: bestOf,
        state: null, result: null, winner: null,
      });
    },
    async confirmResult(matchId) {
      await backend.updateMatch(matchId, { status: 'confirmed', court_id: null });
    },
    async unassign(matchId) {
      await backend.updateMatch(matchId, {
        court_id: null, status: 'scheduled', state: null, result: null, winner: null });
    },
  };
})();

// =====================================================================
//  GEMEINSAME HELFER
// =====================================================================

// Ländername -> ISO-Code (für Flaggen). 'eng'/'sct'/'wls' = UK-Subdivisionen.
const COUNTRY_ISO = {
  'austria':'at','belgium':'be','bulgaria':'bg','czech republic':'cz','denmark':'dk',
  'egypt':'eg','england':'eng','estonia':'ee','finland':'fi','france':'fr','germany':'de',
  'hungary':'hu','ireland':'ie','latvia':'lv','lithuania':'lt','mauritius':'mu',
  'netherlands':'nl','norway':'no','poland':'pl','portugal':'pt','romania':'ro','spain':'es',
  'sweden':'se','switzerland':'ch','turkiye':'tr','türkiye':'tr','turkey':'tr','ukraine':'ua',
  'scotland':'sct','wales':'wls','usa':'us','united states':'us','canada':'ca','india':'in',
  'australia':'au','japan':'jp','malaysia':'my','hong kong':'hk','italy':'it','greece':'gr',
  'luxembourg':'lu','slovenia':'si','slovakia':'sk','croatia':'hr','iceland':'is','serbia':'rs',
};
function countryToISO(name) {
  if (!name) return null;
  // schon ein 2-Buchstaben-Code? unverändert lassen
  const s = String(name).trim();
  if (/^[a-z]{2}$/i.test(s) || ['eng','sct','wls'].includes(s.toLowerCase())) return s.toLowerCase();
  return COUNTRY_ISO[s.toLowerCase()] || null;
}

// ISO-Code -> Flaggen-Emoji (inkl. England/Schottland/Wales)
function flagEmoji(code) {
  if (!code) return '🏳️';
  const c = String(code).toLowerCase();
  const sub = { eng: 'gbeng', sct: 'gbsct', wls: 'gbwls' };
  if (sub[c]) {
    const base = String.fromCodePoint(0x1F3F4);
    const tags = sub[c].split('').map(ch => String.fromCodePoint(0xE0000 + ch.charCodeAt(0))).join('');
    return base + tags + String.fromCodePoint(0xE007F);
  }
  if (c.length !== 2) return '🏳️';
  return c.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

// Court-Label -> Nummer. Aliase (z.B. CC=1) zuerst, sonst Ziffern extrahieren.
//  "C2"->2  "C-13"->13  "1"->1  "Court 7"->7  "CC"->1
function courtToNo(label) {
  if (label == null) return null;
  const s = String(label).trim();
  const aliases = (window.CONFIG && window.CONFIG.COURT_ALIASES) || { CC: 1 };
  if (aliases[s.toUpperCase()] != null) return aliases[s.toUpperCase()];
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// "Vorname Nachname (Country)[seed]" -> {name, country, seed}
function parsePlayer(raw) {
  raw = (raw == null ? '' : String(raw)).trim();
  let seed = null, m;
  m = raw.match(/\[([^\]]*)\]\s*$/); if (m) { seed = m[1]; raw = raw.slice(0, m.index).trim(); }
  let country = null, name = raw;
  m = raw.match(/\(([^)]*)\)\s*$/); if (m) { country = (m[1].trim() || null); name = raw.slice(0, m.index).trim(); }
  return { name, country, seed };
}

// "Do 19.02.2026 16:10" -> epoch ms (zum Sortieren) | "16:10" für Anzeige
function parseTimeMs(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
}
function shortTime(raw) {
  if (!raw) return '';
  const m = String(raw).match(/(\d{1,2}:\d{2})\s*$/);
  return m ? m[1] : String(raw);
}
function hasScore(v) { return v != null && String(v).trim().length > 0; }
function importKey(event, nr, round, t1, t2) {
  return [event, nr, round, t1, t2].map(x => String(x == null ? '' : x).trim()).join('|');
}

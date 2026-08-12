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
      const { data, error } = await sb.from('matches').select('*');
      if (error) throw error;
      return (data || []).slice().sort((a, b) => (a.sort_ts || 0) - (b.sort_ts || 0));
    },    async getMatch(id) {
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
    async getSettingsRaw() {
      const { data, error } = await sb.from('app_settings').select('data').eq('id', 'app').maybeSingle();
      if (error) throw error; return (data && data.data) || {};
    },
    async saveSettingsRaw(obj) {
      const { error } = await sb.from('app_settings')
        .upsert({ id: 'app', data: obj, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    subscribeSettings(callback) {
      const ch = sb.channel('settings-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' },
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
      const onMsg = e => { if (!e.data || e.data.t === 'changed') callback(); };
      const onStorage = e => { if (e.key === KEY) callback(); };
      if (bc) bc.addEventListener('message', onMsg);
      window.addEventListener('storage', onStorage);
      return () => { if (bc) bc.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); };
    },
    async getSettingsRaw() { try { return JSON.parse(localStorage.getItem('squash_settings') || '{}'); } catch { return {}; } },
    async saveSettingsRaw(obj) {
      localStorage.setItem('squash_settings', JSON.stringify(obj));
      if (bc) bc.postMessage({ t: 'settings' });
    },
    subscribeSettings(callback) {
      const onMsg = e => { if (e.data && e.data.t === 'settings') callback(); };
      const onStorage = e => { if (e.key === 'squash_settings') callback(); };
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
    subscribeSettings: (...a) => backend.subscribeSettings(...a),

    // ---- Einstellungen (mit Standardwerten aus CONFIG) ----
    _defaults() {
      const c = window.CONFIG || {};
      return {
        tournamentName: c.TOURNAMENT_NAME || 'Squash Turnier',
        courts: c.COURTS || [1,2,3,4,5,6],
        autoAssign: !!c.AUTO_ASSIGN,
        green: c.GREEN || '#82F84E',
        logoUrl: c.LOGO_URL || '',
        backgroundUrl: c.BACKGROUND_URL || '',
      };
    },
    async getSettings() {
      let raw = {};
      try { raw = await backend.getSettingsRaw(); } catch (e) { raw = {}; }
      return Object.assign(this._defaults(), raw || {});
    },
    async saveSettings(patch) {
      let raw = {};
      try { raw = await backend.getSettingsRaw(); } catch (e) { raw = {}; }
      await backend.saveSettingsRaw(Object.assign({}, raw, patch));
    },

    // nächstes geplantes Spiel eines Courts (nach Uhrzeit)
    async nextScheduledForCourt(courtNo) {
      const all = await backend.listMatches();
      return all.filter(m => m.status === 'scheduled' && m.court_no === courtNo)
        .sort((a, b) => (a.sort_ts || 0) - (b.sort_ts || 0))[0] || null;
    },

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
  'austria':'at','belgium':'be','bulgaria':'bg','czech republic':'cz','czechia':'cz','denmark':'dk',
  'egypt':'eg','england':'eng','estonia':'ee','finland':'fi','france':'fr','germany':'de',
  'hungary':'hu','ireland':'ie','latvia':'lv','lithuania':'lt','mauritius':'mu',
  'netherlands':'nl','norway':'no','poland':'pl','portugal':'pt','romania':'ro','spain':'es',
  'sweden':'se','switzerland':'ch','turkiye':'tr','türkiye':'tr','turkey':'tr','ukraine':'ua',
  'scotland':'sct','wales':'wls','usa':'us','united states':'us','canada':'ca','india':'in',
  'australia':'au','japan':'jp','malaysia':'my','hong kong':'hk','italy':'it','greece':'gr',
  'luxembourg':'lu','slovenia':'si','slovakia':'sk','croatia':'hr','iceland':'is','serbia':'rs',
  // erweitert
  'afghanistan':'af','albania':'al','algeria':'dz','andorra':'ad','argentina':'ar','armenia':'am',
  'azerbaijan':'az','bahrain':'bh','bangladesh':'bd','belarus':'by','bolivia':'bo',
  'bosnia and herzegovina':'ba','bosnia':'ba','brazil':'br','chile':'cl','china':'cn',
  'chinese taipei':'tw','taiwan':'tw','colombia':'co','costa rica':'cr','cyprus':'cy',
  'ecuador':'ec','el salvador':'sv','georgia':'ge','gibraltar':'gi','great britain':'gb',
  'united kingdom':'gb','uk':'gb','guatemala':'gt','indonesia':'id','iran':'ir','iraq':'iq',
  'israel':'il','jamaica':'jm','jordan':'jo','kazakhstan':'kz','kenya':'ke','kosovo':'xk',
  'kuwait':'kw','lebanon':'lb','libya':'ly','liechtenstein':'li','macau':'mo','macao':'mo',
  'malta':'mt','mexico':'mx','moldova':'md','monaco':'mc','montenegro':'me','morocco':'ma',
  'nepal':'np','new zealand':'nz','nigeria':'ng','north macedonia':'mk','macedonia':'mk',
  'oman':'om','pakistan':'pk','panama':'pa','paraguay':'py','peru':'pe','philippines':'ph',
  'qatar':'qa','russia':'ru','saudi arabia':'sa','singapore':'sg','south africa':'za',
  'south korea':'kr','korea':'kr','republic of korea':'kr','sri lanka':'lk','syria':'sy',
  'thailand':'th','trinidad and tobago':'tt','tunisia':'tn','united arab emirates':'ae','uae':'ae',
  'uruguay':'uy','uzbekistan':'uz','venezuela':'ve','vietnam':'vn','zimbabwe':'zw',
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

// ---- Deutsche Bundesländer -> Flaggen (Wikimedia Commons) ----
const DE_STATE_FILE = {
  'bw':'Flag of Baden-Württemberg.svg',
  'by':'Flag of Bavaria (striped).svg',
  'be':'Flag of Berlin.svg',
  'bb':'Flag of Brandenburg.svg',
  'hb':'Flag of Bremen.svg',
  'hh':'Flag of Hamburg.svg',
  'he':'Flag of Hesse.svg',
  'mv':'Flag of Mecklenburg-Western Pomerania.svg',
  'ni':'Flag of Lower Saxony.svg',
  'nw':'Flag of North Rhine-Westphalia.svg',
  'rp':'Flag of Rhineland-Palatinate.svg',
  'sl':'Flag of Saarland.svg',
  'sn':'Flag of Saxony.svg',
  'st':'Flag of Saxony-Anhalt (state).svg',
  'sh':'Flag of Schleswig-Holstein.svg',
  'th':'Flag of Thuringia.svg',
};
const DE_STATE_ALIAS = {
  'baden-württemberg':'bw','baden-wuerttemberg':'bw','baden württemberg':'bw','württemberg':'bw',
  'bayern':'by','bavaria':'by',
  'berlin':'be',
  'brandenburg':'bb',
  'bremen':'hb',
  'hamburg':'hh',
  'hessen':'he','hesse':'he',
  'mecklenburg-vorpommern':'mv','mecklenburg vorpommern':'mv','meck-pomm':'mv','mecpom':'mv',
  'niedersachsen':'ni','lower saxony':'ni',
  'nordrhein-westfalen':'nw','nordrhein westfalen':'nw','nrw':'nw','north rhine-westphalia':'nw',
  'rheinland-pfalz':'rp','rheinland pfalz':'rp','rlp':'rp','rhineland-palatinate':'rp',
  'saarland':'sl',
  'sachsen':'sn','saxony':'sn',
  'sachsen-anhalt':'st','sachsen anhalt':'st','saxony-anhalt':'st',
  'schleswig-holstein':'sh','schleswig holstein':'sh',
  'thüringen':'th','thueringen':'th','thuringia':'th',
};
// Bundesland-Eingabe -> Kürzel (bw, by, …) oder null
function regionCode(region) {
  if (!region) return null;
  const k = String(region).toLowerCase().trim();
  if (DE_STATE_FILE[k]) return k;
  return DE_STATE_ALIAS[k] || null;
}
// Bundesland -> Flaggen-URL (Wikimedia), '' wenn unbekannt
function regionFlagUrl(region, width) {
  const c = regionCode(region);
  if (!c) return '';
  const file = DE_STATE_FILE[c];
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width || 80}`;
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

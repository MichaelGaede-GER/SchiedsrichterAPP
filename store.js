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
    async getTournamentSettings(tid) {
      const { data, error } = await sb.from('tournaments').select('settings').eq('id', tid).maybeSingle();
      if (error) throw error; return (data && data.settings) || {};
    },
    async saveTournamentSettings(tid, obj) {
      const { error } = await sb.from('tournaments').update({ settings: obj }).eq('id', tid);
      if (error) throw error;
    },
    subscribeSettings(callback) {
      const ch = sb.channel('settings-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => callback())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => callback())
        .subscribe();
      return () => sb.removeChannel(ch);
    },
    async listTournaments() {
      const { data, error } = await sb.from('tournaments').select('*').order('created_at', { ascending: true });
      if (error) throw error; return data || [];
    },
    async createTournament(name) {
      const { data, error } = await sb.from('tournaments').insert({ name }).select().single();
      if (error) throw error; return data;
    },
    async renameTournament(id, name) {
      const { error } = await sb.from('tournaments').update({ name }).eq('id', id);
      if (error) throw error;
    },
    async deleteTournament(id) {
      await sb.from('matches').delete().eq('tournament_id', id);
      const { error } = await sb.from('tournaments').delete().eq('id', id);
      if (error) throw error;
    },
    async deleteMatchesOfTournament(id) {
      if (id) await sb.from('matches').delete().eq('tournament_id', id);
      else await sb.from('matches').delete().is('tournament_id', null);
    },
    async adoptOrphans(toId) {
      const { error } = await sb.from('matches').update({ tournament_id: toId }).is('tournament_id', null);
      if (error) throw error;
    },
    // ---- Anlagen (Katalog) ----
    async listVenues() {
      const { data, error } = await sb.from('venues').select('id,name,city,venue_courts(court_no)').order('name');
      if (error) throw error;
      return (data || []).map(v => ({ id: v.id, name: v.name, city: v.city, courtCount: (v.venue_courts || []).length }));
    },
    async getVenueCourts(venueId) {
      const { data, error } = await sb.from('venue_courts').select('court_no,name').eq('venue_id', venueId).order('court_no');
      if (error) throw error; return data || [];
    },
    async createVenue(name, city, courtCount) {
      const { data, error } = await sb.from('venues').insert({ name, city: city || null }).select('id').single();
      if (error) throw error;
      const id = data.id, n = Math.max(0, parseInt(courtCount, 10) || 0), rows = [];
      for (let i = 1; i <= n; i++) rows.push({ venue_id: id, court_no: i });
      if (rows.length) { const r = await sb.from('venue_courts').insert(rows); if (r.error) throw r.error; }
      return { id, name, city: city || null, courtCount: n };
    },
    async setVenueCourtCount(venueId, courtCount) {
      const n = Math.max(0, parseInt(courtCount, 10) || 0);
      await sb.from('venue_courts').delete().eq('venue_id', venueId).gt('court_no', n);
      const rows = []; for (let i = 1; i <= n; i++) rows.push({ venue_id: venueId, court_no: i });
      if (rows.length) { const r = await sb.from('venue_courts').upsert(rows); if (r.error) throw r.error; }
    },
    async deleteVenue(venueId) {
      const { error } = await sb.from('venues').delete().eq('id', venueId); if (error) throw error;
    },
    // ---- Turnier <-> Location ----
    async getTournamentVenues(tid) {
      const { data, error } = await sb.from('tournament_venues')
        .select('venue_id,sort,venues(name,city)').eq('tournament_id', tid).order('sort');
      if (error) throw error;
      return (data || []).map(r => ({ venue_id: r.venue_id, sort: r.sort,
        name: r.venues ? r.venues.name : '', city: r.venues ? r.venues.city : '' }));
    },
    async setTournamentVenues(tid, venueIds) {
      await sb.from('tournament_venues').delete().eq('tournament_id', tid);
      const rows = (venueIds || []).map((id, i) => ({ tournament_id: tid, venue_id: id, sort: i }));
      if (rows.length) { const r = await sb.from('tournament_venues').insert(rows); if (r.error) throw r.error; }
    },
    // ---- Turnier-Courts (welche Courts + Funktion) ----
    async getTournamentCourts(tid) {
      const { data, error } = await sb.from('tournament_courts')
        .select('venue_id,court_no,function,sort').eq('tournament_id', tid).order('sort');
      if (error) throw error; return data || [];
    },
    async setTournamentCourts(tid, venueId, courts) {
      await sb.from('tournament_courts').delete().eq('tournament_id', tid).eq('venue_id', venueId);
      const rows = (courts || []).map((c, i) => ({ tournament_id: tid, venue_id: venueId,
        court_no: c.court_no, function: c.function || 'normal', sort: c.sort != null ? c.sort : i }));
      if (rows.length) { const r = await sb.from('tournament_courts').insert(rows); if (r.error) throw r.error; }
    },
    subscribeTournaments(callback) {
      const ch = sb.channel('tours-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' },
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
    async getTournamentSettings(tid) {
      try { return JSON.parse(localStorage.getItem('squash_settings_' + tid) || '{}'); } catch { return {}; }
    },
    async saveTournamentSettings(tid, obj) {
      localStorage.setItem('squash_settings_' + tid, JSON.stringify(obj));
      if (bc) bc.postMessage({ t: 'settings' });
    },
    subscribeSettings(callback) {
      const onMsg = e => { if (e.data && (e.data.t === 'settings' || e.data.t === 'tours')) callback(); };
      const onStorage = e => { if (e.key === 'squash_settings' || (e.key && e.key.indexOf('squash_settings_') === 0)) callback(); };
      if (bc) bc.addEventListener('message', onMsg);
      window.addEventListener('storage', onStorage);
      return () => { if (bc) bc.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); };
    },
    async listTournaments() { try { return JSON.parse(localStorage.getItem('squash_tournaments') || '[]'); } catch { return []; } },
    async createTournament(name) {
      const t = { id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), name, created_at: new Date().toISOString() };
      const l = await this.listTournaments(); l.push(t);
      localStorage.setItem('squash_tournaments', JSON.stringify(l));
      if (bc) bc.postMessage({ t: 'tours' }); return t;
    },
    async renameTournament(id, name) {
      const l = await this.listTournaments(); const t = l.find(x => x.id === id); if (t) t.name = name;
      localStorage.setItem('squash_tournaments', JSON.stringify(l));
      if (bc) bc.postMessage({ t: 'tours' });
    },
    async deleteTournament(id) {
      let l = await this.listTournaments(); l = l.filter(x => x.id !== id);
      localStorage.setItem('squash_tournaments', JSON.stringify(l));
      await this.deleteMatchesOfTournament(id);
      if (bc) bc.postMessage({ t: 'tours' });
    },
    async deleteMatchesOfTournament(id) {
      const rows = readLS().filter(m => (id ? m.tournament_id !== id : !!m.tournament_id));
      writeLS(rows);
    },
    async adoptOrphans(toId) {
      const rows = readLS(); rows.forEach(m => { if (!m.tournament_id) m.tournament_id = toId; }); writeLS(rows);
    },
    // ---- Anlagen (Katalog) ----
    async listVenues() {
      let vs = []; try { vs = JSON.parse(localStorage.getItem('squash_venues') || '[]'); } catch (e) {}
      return vs.map(v => ({ id: v.id, name: v.name, city: v.city || '', courtCount: (v.courts || []).length }));
    },
    async getVenueCourts(venueId) {
      let vs = []; try { vs = JSON.parse(localStorage.getItem('squash_venues') || '[]'); } catch (e) {}
      const v = vs.find(x => x.id === venueId); return v ? (v.courts || []).map(c => ({ court_no: c, name: null })) : [];
    },
    async createVenue(name, city, courtCount) {
      let vs = []; try { vs = JSON.parse(localStorage.getItem('squash_venues') || '[]'); } catch (e) {}
      const n = Math.max(0, parseInt(courtCount, 10) || 0), courts = [];
      for (let i = 1; i <= n; i++) courts.push(i);
      const v = { id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name, city: city || '', courts };
      vs.push(v); localStorage.setItem('squash_venues', JSON.stringify(vs));
      if (bc) bc.postMessage({ t: 'venues' });
      return { id: v.id, name, city: v.city, courtCount: n };
    },
    async setVenueCourtCount(venueId, courtCount) {
      let vs = []; try { vs = JSON.parse(localStorage.getItem('squash_venues') || '[]'); } catch (e) {}
      const v = vs.find(x => x.id === venueId); if (!v) return;
      const n = Math.max(0, parseInt(courtCount, 10) || 0); v.courts = [];
      for (let i = 1; i <= n; i++) v.courts.push(i);
      localStorage.setItem('squash_venues', JSON.stringify(vs)); if (bc) bc.postMessage({ t: 'venues' });
    },
    async deleteVenue(venueId) {
      let vs = []; try { vs = JSON.parse(localStorage.getItem('squash_venues') || '[]'); } catch (e) {}
      localStorage.setItem('squash_venues', JSON.stringify(vs.filter(v => v.id !== venueId)));
      if (bc) bc.postMessage({ t: 'venues' });
    },
    // ---- Turnier <-> Location ----
    async getTournamentVenues(tid) {
      let ids = []; try { ids = JSON.parse(localStorage.getItem('squash_tvenues_' + tid) || '[]'); } catch (e) {}
      let vs = []; try { vs = JSON.parse(localStorage.getItem('squash_venues') || '[]'); } catch (e) {}
      return ids.map((id, i) => { const v = vs.find(x => x.id === id) || {}; return { venue_id: id, sort: i, name: v.name || '', city: v.city || '' }; });
    },
    async setTournamentVenues(tid, venueIds) {
      localStorage.setItem('squash_tvenues_' + tid, JSON.stringify(venueIds || []));
      if (bc) bc.postMessage({ t: 'venues' });
    },
    // ---- Turnier-Courts ----
    async getTournamentCourts(tid) {
      try { return JSON.parse(localStorage.getItem('squash_tcourts_' + tid) || '[]'); } catch (e) { return []; }
    },
    async setTournamentCourts(tid, venueId, courts) {
      let all = []; try { all = JSON.parse(localStorage.getItem('squash_tcourts_' + tid) || '[]'); } catch (e) {}
      all = all.filter(c => c.venue_id !== venueId);
      (courts || []).forEach((c, i) => all.push({ venue_id: venueId, court_no: c.court_no, function: c.function || 'normal', sort: c.sort != null ? c.sort : i }));
      localStorage.setItem('squash_tcourts_' + tid, JSON.stringify(all));
      if (bc) bc.postMessage({ t: 'venues' });
    },
    subscribeTournaments(callback) {
      const onMsg = e => { if (e.data && e.data.t === 'tours') callback(); };
      const onStorage = e => { if (e.key === 'squash_tournaments') callback(); };
      if (bc) bc.addEventListener('message', onMsg);
      window.addEventListener('storage', onStorage);
      return () => { if (bc) bc.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); };
    },
  };

  const backend = useSupabase ? SupabaseStore : LocalStore;
  if (useSupabase) initSupabase();

  let ACTIVE; // undefined = noch nicht geladen, null = kein aktives Turnier, sonst id
  const ACTIVE_KEY = 'squash_active_tournament';
  async function ensureActive() {
    if (ACTIVE === undefined) {
      // 1) Turnier aus der URL (?t=<id>) hat Vorrang – macht court/live/stream turnier-spezifisch
      let fromUrl = null;
      try { fromUrl = new URLSearchParams(location.search).get('t'); } catch (e) {}
      if (fromUrl) {
        ACTIVE = fromUrl;
        try { localStorage.setItem(ACTIVE_KEY, fromUrl); } catch (e) {}
        return ACTIVE;
      }
      // 2) Sonst pro Gerät gespeichertes Turnier
      let v = null;
      try { v = localStorage.getItem(ACTIVE_KEY); } catch (e) {}
      if (v !== null) {
        ACTIVE = v || null;                 // '' = bewusst kein Turnier
      } else {
        // 3) Einmalige Übernahme des bisher global gespeicherten aktiven Turniers
        try { const s = await backend.getSettingsRaw(); ACTIVE = (s && s.activeTournament) || null; }
        catch (e) { ACTIVE = null; }
        try { localStorage.setItem(ACTIVE_KEY, ACTIVE || ''); } catch (e) {}
      }
    }
    return ACTIVE;
  }

  return {
    mode: backend.mode,
    ready: useSupabase,
    client: () => (useSupabase ? sb : null),
    async listMatches() {
      await ensureActive();
      const all = await backend.listMatches();
      return ACTIVE ? all.filter(m => m.tournament_id === ACTIVE)
                    : all.filter(m => !m.tournament_id);
    },
    getMatch: (...a) => backend.getMatch(...a),
    updateMatch: (...a) => backend.updateMatch(...a),
    async insertMatch(match) { await ensureActive();
      const row = Object.assign({}, match);
      if (row.tournament_id === undefined) row.tournament_id = ACTIVE || null;
      return backend.insertMatch(row); },
    async insertMany(list) { await ensureActive();
      return backend.insertMany((list || []).map(m => {
        const row = Object.assign({}, m);
        if (row.tournament_id === undefined) row.tournament_id = ACTIVE || null;
        return row; })); },
    async deleteAll() { await ensureActive(); return backend.deleteMatchesOfTournament(ACTIVE || null); },
    subscribeAll: (...a) => backend.subscribeAll(...a),
    subscribeCourt: (courtId, cb) => backend.subscribeAll(cb),
    subscribeSettings: (...a) => backend.subscribeSettings(...a),
    subscribeTournaments: (...a) => backend.subscribeTournaments(...a),

    // ---- Turniere ----
    listTournaments: (...a) => backend.listTournaments(...a),
    async createTournament(name) { const t = await backend.createTournament(name); return t; },
    renameTournament: (...a) => backend.renameTournament(...a),
    deleteTournament: (...a) => backend.deleteTournament(...a),
    activeTournament() { return ACTIVE || null; },
    ensureActiveTournament() { return ensureActive(); },
    async setActiveTournament(id) {
      ACTIVE = id || null;
      try { localStorage.setItem(ACTIVE_KEY, ACTIVE || ''); } catch (e) {}
    },
    async adoptOrphans() { await ensureActive(); if (!ACTIVE) throw new Error('Kein aktives Turnier ausgewählt.'); await backend.adoptOrphans(ACTIVE); },

    // ---- Anlagen / Locations / Courts ----
    listVenues() { return backend.listVenues(); },
    getVenueCourts(venueId) { return backend.getVenueCourts(venueId); },
    createVenue(name, city, courtCount) { return backend.createVenue(name, city, courtCount); },
    setVenueCourtCount(venueId, n) { return backend.setVenueCourtCount(venueId, n); },
    deleteVenue(venueId) { return backend.deleteVenue(venueId); },
    async getTournamentVenues(tid) { tid = tid || (await ensureActive()); if (!tid) return []; return backend.getTournamentVenues(tid); },
    async setTournamentVenues(ids, tid) { tid = tid || (await ensureActive()); if (!tid) throw new Error('Kein aktives Turnier.'); return backend.setTournamentVenues(tid, ids); },
    async getTournamentCourts(tid) { tid = tid || (await ensureActive()); if (!tid) return []; return backend.getTournamentCourts(tid); },
    async setTournamentCourts(venueId, courts, tid) { tid = tid || (await ensureActive()); if (!tid) throw new Error('Kein aktives Turnier.'); return backend.setTournamentCourts(tid, venueId, courts); },
    // Hilfsfunktion für die Index-/Anzeige-Filterung: genutzte Court-Nummern
    async usedCourtNumbers(tid, venueId) {
      tid = tid || (await ensureActive()); if (!tid) return [];
      let cs = await backend.getTournamentCourts(tid);
      if (venueId) cs = cs.filter(c => c.venue_id === venueId);
      return cs.slice().sort((a, b) => (a.sort - b.sort) || (a.court_no - b.court_no)).map(c => c.court_no);
    },

    // ---- Backup ----
    async exportBackup() {
      await ensureActive();
      const tours = await backend.listTournaments().catch(() => []);
      const t = tours.find(x => x.id === ACTIVE) || null;
      const all = await backend.listMatches();
      const matches = (ACTIVE ? all.filter(m => m.tournament_id === ACTIVE) : all.filter(m => !m.tournament_id))
        .map(m => { const c = Object.assign({}, m); delete c.id; delete c.created_at; delete c.updated_at; delete c.tournament_id; return c; });
      return { type: 'squash-backup', version: 1, exportedAt: new Date().toISOString(),
               tournament: { name: t ? t.name : (ACTIVE ? 'Turnier' : 'Ohne Turnier') }, matches };
    },
    async importBackup(obj, opts) {
      opts = opts || {};
      if (!obj || obj.type !== 'squash-backup' || !Array.isArray(obj.matches))
        throw new Error('Ungültige Backup-Datei');
      const name = opts.name || ((obj.tournament && obj.tournament.name) || 'Import') ;
      const t = await backend.createTournament(name);
      const rows = obj.matches.map(m => { const c = Object.assign({}, m);
        delete c.id; delete c.created_at; delete c.updated_at; c.tournament_id = t.id; return c; });
      if (rows.length) await backend.insertMany(rows);
      return t;
    },

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
        bgOpacity: (c.BG_OPACITY != null ? c.BG_OPACITY : 0.5),
        warmupP1: 120,      // Aufwärmen Phase 1 (Sek)
        warmupP2: 120,      // Aufwärmen Phase 2 (Sek, nach Seitenwechsel)
        warmupFinal: 60,    // letzte Minute vor Spielbeginn
        restSeconds: 120,   // Pause zwischen den Sätzen (Sek)
        liveRotate: 12,     // Live-Anzeige: Sekunden pro Ansicht
        liveMode: 'rotate', // 'live' | 'prep' | 'done' | 'rotate'
        sponsors: [],       // Sponsor-Logos (URLs/DataURLs) für die Live-Leiste
        highlightLabels: ['Halbfinale','Finale'],  // Presets für Highlight-Markierung
        activeTournament: null,
      };
    },
    async getSettings() {
      await ensureActive();                  // aktives Turnier pro Gerät (localStorage)
      let g = {};
      try { g = await backend.getSettingsRaw(); } catch (e) { g = {}; }
      let t = {};
      if (ACTIVE && backend.getTournamentSettings) {
        try { t = await backend.getTournamentSettings(ACTIVE) || {}; } catch (e) { t = {}; }
      }
      // Reihenfolge: Standardwerte < globale Settings < Turnier-Settings
      return Object.assign(this._defaults(), g || {}, t || {});
    },
    async saveSettings(patch) {
      patch = patch || {};
      await ensureActive();
      // aktives Turnier wird pro Gerät gespeichert (nicht global)
      if ('activeTournament' in patch) { await this.setActiveTournament(patch.activeTournament); }
      const rest = Object.assign({}, patch); delete rest.activeTournament;
      if (Object.keys(rest).length === 0) return;
      if (ACTIVE && backend.getTournamentSettings && backend.saveTournamentSettings) {
        let t = {};
        try { t = await backend.getTournamentSettings(ACTIVE) || {}; } catch (e) { t = {}; }
        await backend.saveTournamentSettings(ACTIVE, Object.assign({}, t, rest));
      } else {
        let g = {};
        try { g = await backend.getSettingsRaw(); } catch (e) { g = {}; }
        await backend.saveSettingsRaw(Object.assign({}, g, rest));
      }
    },

    // nächstes geplantes Spiel eines Courts (nach Uhrzeit, im aktiven Turnier)
    async nextScheduledForCourt(courtNo) {
      const all = await this.listMatches();
      return all.filter(m => m.status === 'scheduled' && m.court_no === courtNo)
        .sort((a, b) => (a.sort_ts || 0) - (b.sort_ts || 0))[0] || null;
    },

    async assignToCourt(matchId, courtId, bestOf) {
      const all = await this.listMatches();
      const busy = all.find(m => m.court_id === courtId && m.status === 'live');
      if (busy) throw new Error('Court ' + courtId + ' ist belegt.');
      await backend.updateMatch(matchId, {
        court_id: courtId, status: 'live', best_of: bestOf,
        state: null, result: null, winner: null,
      });
    },
    // Recovery: Spiel erneut auf einen Court schicken – Spielstand (state) bleibt erhalten
    async resendToCourt(matchId, courtId, venueId) {
      const all = await this.listMatches();
      const busy = all.find(m => m.court_id === courtId && m.status === 'live' && m.id !== matchId);
      if (busy) throw new Error('Court ' + courtId + ' ist belegt (anderes Spiel läuft).');
      const patch = { court_id: courtId, status: 'live' };
      if (venueId) patch.venue_id = venueId;
      await backend.updateMatch(matchId, patch);   // KEIN state:null -> letzter Spielstand bleibt
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
try { window.Store = Store; } catch (e) {}

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
  // Deutsche Ländernamen
  'deutschland':'de','österreich':'at','oesterreich':'at','schweiz':'ch','frankreich':'fr',
  'spanien':'es','italien':'it','niederlande':'nl','holland':'nl','belgien':'be','dänemark':'dk',
  'daenemark':'dk','schweden':'se','norwegen':'no','finnland':'fi','polen':'pl','tschechien':'cz',
  'tschechische republik':'cz','ungarn':'hu','irland':'ie','portugal':'pt','griechenland':'gr',
  'türkei':'tr','tuerkei':'tr','ukraine':'ua','russland':'ru','ägypten':'eg','aegypten':'eg',
  'england':'eng','schottland':'sct','wales':'wls','nordirland':'gb','grossbritannien':'gb',
  'großbritannien':'gb','vereinigtes königreich':'gb','vereinigte staaten':'us','usa':'us',
  'kanada':'ca','mexiko':'mx','brasilien':'br','argentinien':'ar','indien':'in','china':'cn',
  'japan':'jp','südkorea':'kr','suedkorea':'kr','südafrika':'za','suedafrika':'za','marokko':'ma',
  'kroatien':'hr','serbien':'rs','slowenien':'si','slowakei':'sk','rumänien':'ro','rumaenien':'ro',
  'bulgarien':'bg','island':'is','estland':'ee','lettland':'lv','litauen':'lt','luxemburg':'lu',
  'malta':'mt','zypern':'cy','katar':'qa','saudi-arabien':'sa','vereinigte arabische emirate':'ae',
  'neuseeland':'nz','australien':'au','malaysia':'my','hongkong':'hk','singapur':'sg',
};
// IOC/FIFA 3-Buchstaben-Codes -> internes Kürzel (inkl. Heimatnationen)
const COUNTRY_CODE3 = {
  eng:'eng',sco:'sct',wal:'wls',nir:'gb',gbr:'gb',
  ger:'de',aut:'at',sui:'ch',fra:'fr',esp:'es',ita:'it',ned:'nl',bel:'be',den:'dk',swe:'se',
  nor:'no',fin:'fi',pol:'pl',cze:'cz',svk:'sk',svn:'si',slo:'si',cro:'hr',srb:'rs',gre:'gr',
  tur:'tr',ukr:'ua',rus:'ru',hun:'hu',irl:'ie',por:'pt',lux:'lu',isl:'is',est:'ee',lat:'lv',
  lva:'lv',ltu:'lt',rou:'ro',bul:'bg',mlt:'mt',cyp:'cy',mon:'mc',lie:'li',and:'ad',smr:'sm',
  gib:'gi',egy:'eg',rsa:'za',mar:'ma',tun:'tn',alg:'dz',dza:'dz',ngr:'ng',nga:'ng',ken:'ke',
  zim:'zw',usa:'us',can:'ca',mex:'mx',bra:'br',arg:'ar',chi:'cl',chl:'cl',col:'co',per:'pe',
  ecu:'ec',uru:'uy',ven:'ve',crc:'cr',gua:'gt',jam:'jm',tto:'tt',ind:'in',pak:'pk',ban:'bd',
  bgd:'bd',sri:'lk',lka:'lk',nep:'np',jpn:'jp',kor:'kr',chn:'cn',tpe:'tw',twn:'tw',hkg:'hk',
  mas:'my',mys:'my',sgp:'sg',tha:'th',ina:'id',idn:'id',phi:'ph',phl:'ph',vie:'vn',vnm:'vn',
  aus:'au',nzl:'nz',qat:'qa',kuw:'kw',ksa:'sa',sau:'sa',uae:'ae',are:'ae',brn:'bh',bhr:'bh',
  oma:'om',omn:'om',jor:'jo',lbn:'lb',isr:'il',iri:'ir',irn:'ir',irq:'iq',syr:'sy',kaz:'kz',
  uzb:'uz',aze:'az',geo:'ge',arm:'am',
};
function countryToISO(name) {
  if (name == null) return null;
  const s = String(name).trim();
  if (!s) return null;
  const low = s.toLowerCase();
  // interne Sonder-Codes / 2-Buchstaben-ISO unverändert
  if (['eng','sct','wls'].includes(low)) return low;
  if (/^[a-z]{2}$/i.test(s)) return low;
  // 3-Buchstaben-Code (ENG, ESP, GER, …)
  if (/^[a-z]{3}$/i.test(s) && COUNTRY_CODE3[low]) return COUNTRY_CODE3[low];
  // ausgeschriebener Name (deutsch/englisch)
  return COUNTRY_ISO[low] || null;
}
const normCountry = countryToISO;   // zentraler Alias
// Setzung -> Anzeigetext, z.B. "3/4" -> "[3/4]"; leer -> ''
function seedText(seed) { const s = (seed == null ? '' : String(seed)).trim(); return s ? ('[' + s + ']') : ''; }

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

// =====================================================================
//  Vereinsrangliste-Anbindung (Supabase der Rangliste)
//  - eigene Verbindung (URL + anon-Key) + Schiedsrichter-Login
//  - Zugangsdaten liegen NUR lokal auf diesem Gerät (localStorage),
//    nicht in der geteilten Datenbank.
// =====================================================================
window.Ranking = (function () {
  let rb = null;            // Supabase-Client der Rangliste
  const LS = 'squash_ranking_conn';

  function saveConn(c) { localStorage.setItem(LS, JSON.stringify(c || {})); rb = null; }
  function loadConn() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } }
  function configured() { const c = loadConn(); return !!(c && c.url && c.anonKey); }
  function hasLogin() { const c = loadConn(); return !!(c && c.email && c.password); }

  function client() {
    const c = loadConn();
    if (!c || !c.url || !c.anonKey) throw new Error('Keine Ranglisten-Verbindung konfiguriert.');
    if (!rb) rb = window.supabase.createClient(c.url, c.anonKey,
      { auth: { persistSession: true, storageKey: 'rank-auth', autoRefreshToken: true } });
    return rb;
  }

  async function ensureAuth() {
    const c = loadConn(); const sb = client();
    const { data: { session } } = await sb.auth.getSession();
    if (session) return true;
    if (c.email && c.password) {
      const { error } = await sb.auth.signInWithPassword({ email: c.email, password: c.password });
      if (error) throw new Error('Login Rangliste fehlgeschlagen: ' + error.message);
      return true;
    }
    throw new Error('Kein Schiedsrichter-Login hinterlegt.');
  }

  async function test() {
    const sb = client(); await ensureAuth();
    const { error } = await sb.from('events').select('id').limit(1);
    if (error) throw error; return true;
  }

  async function listEvents() {
    const sb = client(); await ensureAuth();
    const { data, error } = await sb.from('events').select('id,name,win_sets').order('name');
    if (error) throw error; return data || [];
  }

  function regName(reg, pById) {
    if (!reg) return '';
    if (reg.player_id && pById[reg.player_id]) {
      const p = pById[reg.player_id];
      const ln = p.last_name || ''; const fi = (p.first_name || '')[0];
      return (ln + (fi ? ', ' + fi + '.' : '')).trim();
    }
    const gl = reg.guest_last_name || ''; const gf = (reg.guest_first_name || '')[0];
    return (gl + (gf ? ', ' + gf + '.' : '')).trim();
  }

  // offene, echte Spiele eines Events -> App-Match-Objekte (Planreihenfolge)
  async function loadOpenMatches(eventId) {
    const sb = client(); await ensureAuth();
    const ev = (await sb.from('events').select('id,name,win_sets').eq('id', eventId).maybeSingle()).data || {};
    const { data: ms, error } = await sb.from('matches').select('*').eq('event_id', eventId).order('sort_order');
    if (error) throw error;
    const regs = (await sb.from('registrations').select('id,player_id,guest_first_name,guest_last_name,retired_at').eq('event_id', eventId)).data || [];
    const regById = {}; regs.forEach(r => regById[r.id] = r);
    const pids = [...new Set(regs.map(r => r.player_id).filter(Boolean))];
    let players = [];
    if (pids.length) players = (await sb.from('players').select('id,first_name,last_name').in('id', pids)).data || [];
    const pById = {}; players.forEach(p => pById[p.id] = p);
    const winSets = ev.win_sets || 2, bestOf = Math.max(1, winSets * 2 - 1);

    const open = (ms || []).filter(m => !m.is_bye && m.status !== 'done' && m.home_reg_id && m.away_reg_id);
    return open.map(m => {
      const courtNum = m.court ? parseInt(String(m.court).replace(/\D/g, ''), 10) : null;
      return {
        ext: { source: 'ranking', matchId: m.id, homeReg: m.home_reg_id, awayReg: m.away_reg_id, eventId },
        event: ev.name || '', round: m.label || '',
        match_no: (m.sort_order != null ? String(m.sort_order) : ''),
        player1_name: regName(regById[m.home_reg_id], pById) || m.home_label || 'Heim',
        player2_name: regName(regById[m.away_reg_id], pById) || m.away_label || 'Gast',
        player1_country: null, player2_country: null,
        court_no: (courtNum || null), court_label: (m.court != null ? String(m.court) : null),
        scheduled_time: m.scheduled_time || null,
        sort_ts: (m.sort_order != null ? Number(m.sort_order) : null),
        best_of: bestOf,
      };
    });
  }

  // Ergebnis zurückschreiben (Rangliste rechnet Tabelle selbst)
  async function writeResult(ext, sets, hs, as) {
    const sb = client(); await ensureAuth();
    const patch = {
      sets: (sets && sets.length) ? sets : null,
      home_score: hs, away_score: as,
      status: 'done', ended_at: new Date().toISOString(),
    };
    const { error } = await sb.from('matches').update(patch).eq('id', ext.matchId);
    if (error) throw error;
  }

  // Aufgabe/Walkover: Verletzter/Abwesender bekommt retired_at
  // (Gegner gewinnt kampflos, Spieler wird zuletzt platziert), Match ohne Ergebnis auf 'done'
  async function retire(ext, injuredRegId) {
    const sb = client(); await ensureAuth();
    if (injuredRegId) {
      const { error: e1 } = await sb.from('registrations')
        .update({ retired_at: new Date().toISOString() }).eq('id', injuredRegId);
      if (e1) throw e1;
    }
    const { error: e2 } = await sb.from('matches')
      .update({ status: 'done', sets: null, home_score: null, away_score: null, ended_at: new Date().toISOString() })
      .eq('id', ext.matchId);
    if (e2) throw e2;
  }

  // Realtime: bei Änderungen an matches des Events benachrichtigen
  function subscribe(eventId, cb) {
    const sb = client();
    const ch = sb.channel('rank-matches-' + eventId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: 'event_id=eq.' + eventId },
        () => cb())
      .subscribe();
    return () => sb.removeChannel(ch);
  }

  return { saveConn, loadConn, configured, hasLogin, test, listEvents, loadOpenMatches, writeResult, retire, subscribe };
})();

/* =====================================================================
   auth.js – Anmeldung & Rollen (turnierbezogen)
   Rolle gilt pro AKTIVEM Turnier (tournament_members). Plattform-Admin
   (profiles.role='admin') ist überall Admin. Lokaler Testmodus = admin.
   Rollen: admin, director, office, referee, viewer.
   ===================================================================== */
(function () {
  var CAPS = {
    admin:    { view:1, score:1, manage:1, settings:1, members:1, destroy:1 },
    director: { view:1, score:1, manage:1, settings:1, members:1, destroy:1 },
    office:   { view:1, score:1, manage:1 },
    referee:  { view:1, score:1 },
    viewer:   { view:1 }
  };
  var ROLE_LABEL = { admin:'Administrator', director:'Tournament Director',
    office:'Tournament Office', referee:'Schiedsrichter (Court)', viewer:'Nur ansehen' };

  var sb = (typeof Store !== 'undefined' && Store.client) ? Store.client() : null;
  var USER = null, ROLE = null, PLATFORM_ADMIN = false, MEMBERSHIPS = 0, OFFLINE_AUTH = false, NET_DOWN = false;

  // ---------- Offline: zuletzt bekannte Anmeldung + Rollen pro Turnier merken ----------
  // Ohne Internet kann weder der Token erneuert noch die Rolle geladen werden. Damit ein
  // Tablet trotzdem (z. B. nach Neustart) weiter schiedsen kann, gilt dann die Rolle, die
  // dieses Konto zuletzt online für das Turnier hatte. Schreiben prüft weiterhin der Server.
  var AUTH_CACHE = 'squash_auth_cache';
  function cacheLoad() { try { return JSON.parse(localStorage.getItem(AUTH_CACHE) || 'null'); } catch (e) { return null; } }
  function cacheSave(tid) {
    if (!USER || !USER.id) return;
    try {
      var c = cacheLoad();
      if (!c || c.uid !== USER.id) c = { uid: USER.id, email: USER.email || '', roles: {} };
      c.email = USER.email || c.email; c.platformAdmin = PLATFORM_ADMIN; c.memberships = MEMBERSHIPS;
      if (tid) c.roles[tid] = ROLE; c.at = Date.now();
      localStorage.setItem(AUTH_CACHE, JSON.stringify(c));
    } catch (e) {}
  }
  function isNetErr(e) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    var m = String((e && (e.message || e.name || e)) || '');
    return /fetch|network|load failed|abort|timeout|timed out|offline/i.test(m);
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
  }

  // ---------- UI: Overlay ----------
  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  var box = null, msgEl = null, mode = 'login';

  function buildOverlay() {
    if (box) return;
    box = el('div', 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'background:#0d1118;color:#e7edf5;font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif');
    var card = el('div', 'width:min(380px,92vw);background:#161c26;border:1px solid #2a3444;border-radius:16px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5)');
    card.appendChild(el('div', 'font-size:20px;font-weight:800;margin-bottom:4px', '🎾 Anmeldung'));
    card.appendChild(el('div', 'color:#8aa0bf;font-size:13px;margin-bottom:18px', 'Bitte mit E-Mail und Passwort anmelden.'));

    var mailWrap = el('div', 'margin-bottom:12px');
    mailWrap.appendChild(el('label', 'display:block;font-size:12px;color:#8aa0bf;margin-bottom:5px', 'E-Mail'));
    var mail = el('input'); mail.type = 'email'; mail.autocomplete = 'username';
    mail.style.cssText = 'width:100%;box-sizing:border-box;background:#0f141c;color:#e7edf5;border:1px solid #2a3444;border-radius:9px;padding:11px 12px;font:inherit';
    mailWrap.appendChild(mail);

    var passWrap = el('div', 'margin-bottom:16px');
    passWrap.appendChild(el('label', 'display:block;font-size:12px;color:#8aa0bf;margin-bottom:5px', 'Passwort'));
    var pass = el('input'); pass.type = 'password'; pass.autocomplete = 'current-password';
    pass.style.cssText = 'width:100%;box-sizing:border-box;background:#0f141c;color:#e7edf5;border:1px solid #2a3444;border-radius:9px;padding:11px 12px;font:inherit';
    passWrap.appendChild(pass);

    var btn = el('button', 'width:100%;background:#2f6bff;color:#fff;border:0;border-radius:10px;padding:12px;font-weight:800;font-size:15px;cursor:pointer', 'Anmelden');
    msgEl = el('div', 'min-height:18px;margin-top:12px;font-size:13px;color:#ff9aa8;text-align:center');

    card.appendChild(mailWrap); card.appendChild(passWrap); card.appendChild(btn); card.appendChild(msgEl);
    box.appendChild(card); (document.body || document.documentElement).appendChild(box);

    async function doLogin() {
      var email = (mail.value || '').trim(), password = pass.value || '';
      if (!email || !password) { msg('Bitte E-Mail und Passwort eingeben.'); return; }
      btn.disabled = true; btn.textContent = 'Anmelden…'; msg('');
      try {
        var r = await sb.auth.signInWithPassword({ email: email, password: password });
        if (r.error) throw r.error;
        // Erfolg -> onAuthStateChange kümmert sich um den Rest
      } catch (e) {
        msg(mapErr(e && e.message));
        btn.disabled = false; btn.textContent = 'Anmelden';
      }
    }
    btn.addEventListener('click', doLogin);
    pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    mail.addEventListener('keydown', function (e) { if (e.key === 'Enter') pass.focus(); });
    box._focus = function () { setTimeout(function () { (mail.value ? pass : mail).focus(); }, 60); };
  }
  function msg(t) { if (msgEl) msgEl.textContent = t || ''; }
  var loadEl = null;
  function showLoading() {
    if (loadEl) return;
    loadEl = el('div', 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:#0d1118;color:#8aa0bf;font:15px system-ui,Segoe UI,Roboto,sans-serif', 'Lade…');
    (document.body || document.documentElement).appendChild(loadEl);
  }
  function hideLoading() { if (loadEl) { loadEl.remove(); loadEl = null; } }
  function mapErr(m) {
    m = m || 'Anmeldung fehlgeschlagen';
    if (/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort falsch.';
    if (/Email not confirmed/i.test(m)) return 'E-Mail noch nicht bestätigt.';
    return m;
  }
  function showLogin() { buildOverlay(); box.style.display = 'flex'; box.firstChild.style.opacity = '1'; renderLoginCard(); if (box._focus) box._focus(); }
  function renderLoginCard() { /* placeholder for future modes */ }
  function hideOverlay() { if (box) box.style.display = 'none'; }

  function showBlock(title, text) {
    buildOverlay(); box.style.display = 'flex';
    var card = box.firstChild;
    card.innerHTML = '';
    card.appendChild(el('div', 'font-size:20px;font-weight:800;margin-bottom:6px', title));
    card.appendChild(el('div', 'color:#8aa0bf;font-size:14px;margin-bottom:18px', text));
    var out = el('button', 'width:100%;background:#232d3d;color:#e7edf5;border:1px solid #2a3444;border-radius:10px;padding:11px;font-weight:700;cursor:pointer', 'Abmelden / Konto wechseln');
    out.addEventListener('click', function () { signOut(); });
    card.appendChild(out);
  }

  // ---------- Rolle laden (für das AKTIVE Turnier) ----------
  async function loadRole() {
    // Werte erst lokal ermitteln und am Ende gemeinsam setzen (parallele Aufrufe sehen nie „leer“)
    if (!USER) { ROLE = null; PLATFORM_ADMIN = false; MEMBERSHIPS = 0; return ROLE; }
    var uid = USER.id, role = null, pa = false, mem = 0, netFail = false, T = 8000;
    NET_DOWN = false;
    var chk = function (r) { if (r && r.error && isNetErr(r.error)) netFail = true; return r; };
    // aktives Turnier (vorab, damit auch offline das richtige Turnier gilt)
    var tid = null;
    try { tid = (typeof Store !== 'undefined' && Store.ensureActiveTournament) ? await Store.ensureActiveTournament() : (Store.activeTournament && Store.activeTournament()); } catch (e) {}
    if (!OFFLINE_AUTH) {
      // Plattform-Admin?
      try {
        var p = chk(await withTimeout(sb.from('profiles').select('role').eq('id', uid).maybeSingle(), T));
        if (p && p.data && p.data.role === 'admin') pa = true;
      } catch (e) { if (isNetErr(e)) netFail = true; }
      // Anzahl Turnier-Mitgliedschaften (für den Turnier-Picker-Zugang)
      if (!netFail) try {
        var c = chk(await withTimeout(sb.from('tournament_members').select('tournament_id', { count: 'exact', head: true }).eq('user_id', uid), T));
        mem = (c && c.count) || 0;
      } catch (e) { if (isNetErr(e)) netFail = true; }
      // Rolle für das aktive Turnier
      if (!netFail && !pa && tid) {
        try {
          var m = chk(await withTimeout(sb.from('tournament_members').select('role').eq('tournament_id', tid).eq('user_id', uid).maybeSingle(), T));
          role = (m && m.data && m.data.role) || null;
        } catch (e) { role = null; if (isNetErr(e)) netFail = true; }
      }
      if (!netFail) {
        if (pa) role = 'admin';
        PLATFORM_ADMIN = pa; MEMBERSHIPS = mem; ROLE = role;
        cacheSave(tid);                       // Online-Stand für spätere Offline-Starts merken
        return ROLE;
      }
    }
    // Offline / Server nicht erreichbar -> zuletzt bekannte Rolle dieses Kontos verwenden
    NET_DOWN = true;
    var ca = cacheLoad();
    pa = false; mem = 0; role = null;
    if (ca && ca.uid === uid) {
      OFFLINE_AUTH = true;
      pa = !!ca.platformAdmin; mem = ca.memberships || 0;
      role = pa ? 'admin' : ((tid && ca.roles && ca.roles[tid]) || null);
    }
    PLATFORM_ADMIN = pa; MEMBERSHIPS = mem; ROLE = role;
    return ROLE;
  }

  // ---------- Öffentliche API ----------
  var resolvers = [];
  function whenAuthed() { return new Promise(function (res) { if (USER) res({ user: USER, role: ROLE }); else resolvers.push(res); }); }

  async function guard(need) {
    // Lokaler Testmodus: keine Anmeldung, volle Rechte
    if (!sb) { PLATFORM_ADMIN = true; ROLE = 'admin'; USER = { email: '(lokal)' }; return { user: USER, role: ROLE }; }
    showLoading();
    var s = null, sErr = null;
    try { var gs = await withTimeout(sb.auth.getSession(), 8000); s = gs.data.session; sErr = gs.error || null; }
    catch (e) { sErr = e; }
    var ca = cacheLoad();
    if (!s && ca && ca.uid && (sErr ? isNetErr(sErr) : navigator.onLine === false)) {
      // Offline und Token kann nicht erneuert werden -> mit zuletzt angemeldetem Konto weiter
      USER = { id: ca.uid, email: ca.email || '' }; OFFLINE_AUTH = true; await loadRole();
    }
    else if (!s) { hideLoading(); showLogin(); await whenAuthed(); }
    else { USER = s.user; OFFLINE_AUTH = false; await loadRole(); }
    // Zugriffslogik
    var ok;
    if (need === 'view') {
      // Zutritt (z. B. Verwaltung) auch, wenn das aktuell gewählte Turnier
      // (noch) nicht seins ist – Hauptsache irgendeine Mitgliedschaft.
      ok = PLATFORM_ADMIN || ROLE != null || MEMBERSHIPS > 0;
    } else {
      ok = can(need);
    }
    if (need && !ok) {
      hideLoading();
      if (OFFLINE_AUTH || NET_DOWN) {
        showBlock('Offline', 'Keine Internetverbindung, und für dieses Turnier ist auf diesem Gerät noch keine Anmeldung gespeichert. '
          + 'Bitte einmal mit Internet öffnen – danach funktioniert dieser Court auch offline.');
        if (typeof window !== 'undefined') window.addEventListener('online', function () { location.reload(); }, { once: true });
        return new Promise(function () {});
      }
      var msg = (MEMBERSHIPS === 0 && !PLATFORM_ADMIN)
        ? 'Dein Konto ist noch keinem Turnier zugeordnet. Bitte von einem Administrator hinzufügen lassen.'
        : ('Dein Konto hat für diese Ansicht keine Berechtigung' + (ROLE ? (' (' + (ROLE_LABEL[ROLE] || ROLE) + ')') : '') + '.');
      showBlock('Kein Zugriff', msg);
      return new Promise(function () {});
    }
    hideLoading(); hideOverlay();
    return { user: USER, role: ROLE };
  }

  function can(cap) { var c = CAPS[ROLE]; return !!(c && c[cap]); }
  function role() { return ROLE; }
  function roleLabel() { return ROLE ? (ROLE_LABEL[ROLE] || ROLE) : '—'; }
  function user() { return USER; }
  function isPlatformAdmin() { return PLATFORM_ADMIN; }
  function membershipCount() { return MEMBERSHIPS; }
  async function refreshRole() { await loadRole(); return ROLE; }
  function isOffline() { return OFFLINE_AUTH; }

  async function signOut() {
    try { localStorage.removeItem(AUTH_CACHE); } catch (e) {}   // bewusst abgemeldet -> keine Offline-Anmeldung mehr
    try { if (sb) await sb.auth.signOut(); } catch (e) {}
    location.reload();
  }

  // ---------- Globale Benutzer (nur Plattform-Admin) ----------
  async function listUsers() {
    if (!sb) return [];
    var r = await sb.from('profiles').select('id,email,role,created_at').order('created_at');
    if (r.error) throw r.error; return r.data || [];
  }
  async function setUserRole(id, newRole) {
    var r = await sb.from('profiles').update({ role: newRole }).eq('id', id);
    if (r.error) throw r.error;
  }

  // ---------- Mitglieder eines Turniers (Admin/Director) via RPC ----------
  async function listMembers(tid) {
    if (!sb) return []; var r = await sb.rpc('list_tournament_members', { p_tid: tid });
    if (r.error) throw r.error; return r.data || [];
  }
  async function addMember(tid, email, mrole) {
    var r = await sb.rpc('add_tournament_member', { p_tid: tid, p_email: email, p_role: mrole });
    if (r.error) throw r.error; return r.data;
  }
  async function setMemberRole(tid, uid, mrole) {
    var r = await sb.rpc('set_tournament_member_role', { p_tid: tid, p_user_id: uid, p_role: mrole });
    if (r.error) throw r.error;
  }
  async function removeMember(tid, uid) {
    var r = await sb.rpc('remove_tournament_member', { p_tid: tid, p_user_id: uid });
    if (r.error) throw r.error;
  }

  // ---------- Auth-Events ----------
  if (sb) {
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') { USER = null; ROLE = 'viewer'; return; }
      if (session && session.user) {
        USER = session.user; OFFLINE_AUTH = false;            // wieder online angemeldet (z. B. Token erneuert)
        loadRole().then(function () {
          // Wartet die Login-Maske gerade? Dann auflösen – guard() erledigt
          // danach Rechteprüfung (Block oder Freigabe). Kein Reload!
          if (resolvers.length) {
            var rs = resolvers.splice(0);
            rs.forEach(function (res) { res({ user: USER, role: ROLE }); });
          }
        });
      }
    });
  }

  window.Auth = {
    guard: guard, can: can, role: role, roleLabel: roleLabel, user: user,
    isPlatformAdmin: isPlatformAdmin, membershipCount: membershipCount, refreshRole: refreshRole, isOffline: isOffline,
    signOut: signOut, listUsers: listUsers, setUserRole: setUserRole,
    listMembers: listMembers, addMember: addMember, setMemberRole: setMemberRole, removeMember: removeMember,
    ROLE_LABEL: ROLE_LABEL
  };
})();

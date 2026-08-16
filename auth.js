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
  var USER = null, ROLE = null, PLATFORM_ADMIN = false, MEMBERSHIPS = 0;

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
    ROLE = null; PLATFORM_ADMIN = false; MEMBERSHIPS = 0;
    if (!USER) return ROLE;
    // Plattform-Admin?
    try {
      var p = await sb.from('profiles').select('role').eq('id', USER.id).maybeSingle();
      if (p && p.data && p.data.role === 'admin') PLATFORM_ADMIN = true;
    } catch (e) {}
    // Anzahl Turnier-Mitgliedschaften (für den Turnier-Picker-Zugang)
    try {
      var c = await sb.from('tournament_members').select('tournament_id', { count: 'exact', head: true }).eq('user_id', USER.id);
      MEMBERSHIPS = c.count || 0;
    } catch (e) {}
    if (PLATFORM_ADMIN) { ROLE = 'admin'; return ROLE; }
    // Rolle für das aktive Turnier
    var tid = null;
    try { tid = (typeof Store !== 'undefined' && Store.ensureActiveTournament) ? await Store.ensureActiveTournament() : (Store.activeTournament && Store.activeTournament()); } catch (e) {}
    if (tid) {
      try {
        var m = await sb.from('tournament_members').select('role').eq('tournament_id', tid).eq('user_id', USER.id).maybeSingle();
        ROLE = (m && m.data && m.data.role) || null;
      } catch (e) { ROLE = null; }
    }
    return ROLE;
  }

  // ---------- Öffentliche API ----------
  var resolvers = [];
  function whenAuthed() { return new Promise(function (res) { if (USER) res({ user: USER, role: ROLE }); else resolvers.push(res); }); }

  async function guard(need) {
    // Lokaler Testmodus: keine Anmeldung, volle Rechte
    if (!sb) { PLATFORM_ADMIN = true; ROLE = 'admin'; USER = { email: '(lokal)' }; return { user: USER, role: ROLE }; }
    showLoading();
    var s = null;
    try { s = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (!s) { hideLoading(); showLogin(); await whenAuthed(); }
    else { USER = s.user; await loadRole(); }
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

  async function signOut() {
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
        USER = session.user;
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
    isPlatformAdmin: isPlatformAdmin, membershipCount: membershipCount, refreshRole: refreshRole,
    signOut: signOut, listUsers: listUsers, setUserRole: setUserRole,
    listMembers: listMembers, addMember: addMember, setMemberRole: setMemberRole, removeMember: removeMember,
    ROLE_LABEL: ROLE_LABEL
  };
})();

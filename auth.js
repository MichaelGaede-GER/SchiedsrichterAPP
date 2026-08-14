/* =====================================================================
   auth.js – Anmeldung & Rollen für die Schiedsrichter-App
   Nutzt denselben Supabase-Client wie store.js (gemeinsame Session).
   Rollen: admin, director, referee, viewer.
   Ohne Supabase (lokaler Testmodus) ist alles offen (Rolle 'admin').
   ===================================================================== */
(function () {
  var CAPS = {
    admin:    { manage: true,  admin: true,  score: true,  view: true },
    director: { manage: true,  admin: false, score: true,  view: true },
    referee:  { manage: false, admin: false, score: true,  view: true },
    viewer:   { manage: false, admin: false, score: false, view: true }
  };
  var ROLE_LABEL = { admin: 'Administrator', director: 'Turnierleitung', referee: 'Schiedsrichter (Court)', viewer: 'Nur ansehen' };

  var sb = (typeof Store !== 'undefined' && Store.client) ? Store.client() : null;
  var USER = null, ROLE = 'viewer';

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

  // ---------- Rolle laden ----------
  async function loadRole() {
    ROLE = 'viewer';
    if (!USER) return ROLE;
    try {
      var r = await sb.from('profiles').select('role').eq('id', USER.id).maybeSingle();
      if (r && r.data && r.data.role) ROLE = r.data.role;
    } catch (e) { /* keine profiles-Zeile -> viewer */ }
    return ROLE;
  }

  // ---------- Öffentliche API ----------
  var resolvers = [];
  function whenAuthed() { return new Promise(function (res) { if (USER) res({ user: USER, role: ROLE }); else resolvers.push(res); }); }

  async function guard(need) {
    // Lokaler Testmodus: keine Anmeldung, volle Rechte
    if (!sb) { ROLE = 'admin'; USER = { email: '(lokal)' }; return { user: USER, role: ROLE }; }
    showLoading();
    // Session prüfen
    var s = null;
    try { s = (await sb.auth.getSession()).data.session; } catch (e) {}
    if (!s) { hideLoading(); showLogin(); await whenAuthed(); }
    else { USER = s.user; await loadRole(); }
    // Berechtigung prüfen
    if (need && !can(need)) {
      hideLoading();
      showBlock('Kein Zugriff', 'Dein Konto (' + (ROLE_LABEL[ROLE] || ROLE) + ') hat für diese Ansicht keine Berechtigung.');
      return new Promise(function () {}); // bleibt bewusst offen -> Seite lädt nicht
    }
    hideLoading(); hideOverlay();
    return { user: USER, role: ROLE };
  }

  function can(cap) { var c = CAPS[ROLE] || CAPS.viewer; return !!c[cap]; }
  function role() { return ROLE; }
  function roleLabel() { return ROLE_LABEL[ROLE] || ROLE; }
  function user() { return USER; }

  async function signOut() {
    try { if (sb) await sb.auth.signOut(); } catch (e) {}
    location.reload();
  }

  // ---------- Benutzer-/Rollenverwaltung (nur admin) ----------
  async function listUsers() {
    if (!sb) return [];
    var r = await sb.from('profiles').select('id,email,role,created_at').order('created_at');
    if (r.error) throw r.error; return r.data || [];
  }
  async function setUserRole(id, newRole) {
    var r = await sb.from('profiles').update({ role: newRole }).eq('id', id);
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
    signOut: signOut, listUsers: listUsers, setUserRole: setUserRole,
    ROLE_LABEL: ROLE_LABEL
  };
})();

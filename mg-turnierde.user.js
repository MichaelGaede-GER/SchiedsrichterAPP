// ==UserScript==
// @name         MG Turnierplanner → turnier.de Ergebnis-Übertrag
// @namespace    https://schiedsrichter-app-seven.vercel.app/
// @version      0.3.1
// @description  Importiert Spiele von turnier.de / tournamentsoftware.com in den MG Sport Turnierplanner und überträgt bestätigte Ergebnisse zurück
// @match        https://dsqv.turnier.de/sport/legacymatches.aspx*
// @match        https://*.turnier.de/sport/legacymatches.aspx*
// @match        https://*.tournamentsoftware.com/sport/legacymatches.aspx*
// @match        https://dsqv.turnier.de/tournament/*
// @match        https://*.turnier.de/tournament/*
// @match        https://*.tournamentsoftware.com/tournament/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * NEU in 0.3.0 – Spiele-IMPORT
 *  - Button "⇩ Spiele importieren" (links neben "Ergebnisse übertragen").
 *  - Liest alle Spieltage: Datum, Uhrzeit, Event/Draw, Spieler + Nation, Court,
 *    vorhandene Ergebnisse und (optional) die Runde aus der Spieldetail-Seite ("i").
 *  - Schlüssel ist die MatchID von turnier.de → erneuter Import aktualisiert statt zu verdoppeln.
 *  - Spiele ohne feststehende Spieler ("-") haben online noch keine MatchID und werden
 *    übersprungen; sie kommen beim nächsten Import, sobald die Paarung feststeht.
 *  - Übergabe an die App automatisch (wenn die App das Fenster geöffnet hat) oder per "JSON kopieren".
 *  - Läuft auf dsqv.turnier.de, esf./wsf.tournamentsoftware.com usw. Auf der neuen
 *    Turnierseite (/tournament/…/Matches) erscheint ein Button zur Tabellenansicht.
 *
 * Ablauf Ergebnis-Übertrag
 *  1. Auf dsqv.turnier.de angemeldet die Spiele-Seite (legacymatches.aspx) öffnen.
 *  2. Rechts unten erscheint "Ergebnisse übertragen".
 *  3. JSON aus dem Turnierplanner einfügen → "Prüfen".
 *     Das Skript liest ALLE Spieltage des Turniers und ordnet jedes Ergebnis
 *     über Draw + beide Spielernamen der MatchID zu.
 *  4. Vorschau kontrollieren → "Übertragen". Pro Spiel wird das Formular
 *     "Ergebnis eingeben" geladen, ausgefüllt und gespeichert – genau wie von Hand,
 *     nur ohne Klicken. Danach wird die Liste neu geladen und geprüft.
 *
 * Erwartetes JSON (vom Turnierplanner erzeugt):
 * {
 *   "matches": [
 *     { "id": "app-id-123", "draw": "Testdraw",
 *       "p1": "Horst Test", "p2": "Thomas Test",
 *       "sets": [[3,11],[5,11],[11,5],[11,2],[4,11]],   // Punkte p1, p2
 *       "winner": 2,                                     // 1 = p1, 2 = p2
 *       "status": null }                                 // null | "walkover" | "retired"
 *   ]
 * }
 */

(function () {
  'use strict';

  const STATUS = { walkover: '1', retired: '2' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // Akzente weg (Günter → Gunter)
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pairKey = (draw, a, b) => norm(draw) + '|' + [norm(a), norm(b)].sort().join('|');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Neue Turnierseite (/tournament/<GUID>/…) → nur Sprung zur Tabellenansicht anbieten
  if (!/legacymatches\.aspx/i.test(location.pathname)) {
    const g = /\/tournament\/([0-9a-f-]{36})/i.exec(location.pathname);
    if (!g) return;
    const a = document.createElement('a');
    a.href = `${location.origin}/sport/legacymatches.aspx?id=${g[1]}${location.hash.startsWith('#mgtp') ? location.hash : ''}`;
    a.textContent = '⇩ Zur Spieltabelle (Import / Übertrag)';
    a.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;background:#1f5f99;color:#fff;border-radius:8px;padding:12px 16px;font:600 14px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.3);text-decoration:none';
    document.body.appendChild(a);
    if (location.hash.startsWith('#mgtp')) location.href = a.href;   // von der App geöffnet → direkt weiter
    return;
  }

  const tournamentId = new URLSearchParams(location.search).get('id');
  if (!tournamentId) return;

  // ---------- UI ----------
  const css = `
  #tpx-btn{position:fixed;right:18px;bottom:18px;z-index:99999;background:#1f7a3a;color:#fff;border:0;border-radius:8px;padding:12px 16px;font:600 14px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer}
  #tpx{position:fixed;right:18px;bottom:70px;z-index:99999;width:min(760px,95vw);max-height:80vh;overflow:auto;background:#fff;color:#222;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35);font:13px system-ui;padding:14px;display:none}
  #tpx h3{margin:0 0 8px;font-size:16px}
  #tpx textarea{width:100%;height:110px;font:12px monospace;box-sizing:border-box}
  #tpx button{margin:8px 6px 0 0;padding:7px 12px;border-radius:6px;border:1px solid #888;background:#f4f4f4;cursor:pointer}
  #tpx button.go{background:#1f7a3a;color:#fff;border-color:#1f7a3a}
  #tpx button:disabled{opacity:.5;cursor:default}
  #tpx table{width:100%;border-collapse:collapse;margin-top:10px}
  #tpx td,#tpx th{border-bottom:1px solid #e3e3e3;padding:4px 6px;text-align:left;vertical-align:top}
  #tpx .ok{color:#1f7a3a;font-weight:600} #tpx .warn{color:#b26a00;font-weight:600} #tpx .err{color:#c0392b;font-weight:600}
  #tpx .log{margin-top:8px;font:12px monospace;white-space:pre-wrap;background:#f7f7f7;padding:6px;border-radius:6px;max-height:160px;overflow:auto}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  document.body.insertAdjacentHTML('beforeend', `
    <button id="tpx-btn">⇪ Ergebnisse übertragen</button>
    <div id="tpx">
      <h3>Ergebnisse aus dem Turnierplanner</h3>
      <textarea id="tpx-json" placeholder='JSON aus dem Turnierplanner hier einfügen'></textarea>
      <div>
        <button id="tpx-check">Prüfen</button>
        <button id="tpx-run" class="go" disabled>Übertragen</button>
        <button id="tpx-copy" disabled>Übertragene IDs kopieren</button>
      </div>
      <div id="tpx-table"></div>
      <div id="tpx-log" class="log" style="display:none"></div>
    </div>`);
  const $ = (id) => document.getElementById(id);
  $('tpx-btn').onclick = () => { const p = $('tpx'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; };
  const log = (msg) => { const l = $('tpx-log'); l.style.display = 'block'; l.textContent += msg + '\n'; l.scrollTop = 1e9; };

  // ---------- turnier.de lesen ----------
  async function fetchDoc(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status} bei ${url}`);
    return new DOMParser().parseFromString(await r.text(), 'text/html');
  }

  // Alle Spieltage (Tabs) + "Unscheduled" einsammeln
  function dayUrls(doc) {
    const urls = new Set([location.href.split('#')[0]]);
    doc.querySelectorAll('a[href*="legacymatches.aspx"]').forEach((a) => {
      const u = new URL(a.getAttribute('href'), location.origin);
      if (u.searchParams.get('id')?.toLowerCase() === tournamentId.toLowerCase()) {
        u.hash = ''; urls.add(u.toString());
      }
    });
    return [...urls];
  }

  // Zeilen der Spielliste parsen
  function parseList(doc) {
    const out = [];
    doc.querySelectorAll('td.plannedtime').forEach((td) => {
      const tr = td.closest('tr');
      const drawA = tr.querySelector('a[href*="draw.aspx"]');
      const players = [...tr.querySelectorAll('a[href*="player.aspx"]')].map((a) => a.textContent.trim());
      if (!drawA || players.length < 2) return;
      const edit = tr.querySelector('a[href*="EditMatchScore"]');
      const score = tr.querySelector('.score');
      out.push({
        draw: drawA.textContent.trim(),
        p1: players[0], p2: players[1],
        matchId: edit ? new URL(edit.getAttribute('href'), location.origin).searchParams.get('MatchID') : null,
        editUrl: edit ? new URL(edit.getAttribute('href'), location.origin).toString() : null,
        score: score ? score.textContent.replace(/\s+/g, ' ').trim() : '',
      });
    });
    return out;
  }

  const nameKey = (a, b) => [norm(a), norm(b)].sort().join('|');
  let byNames = new Map();   // Ausweich-Zuordnung nur über Namen (falls Draw-Name abweicht)

  async function loadAllOnline() {
    const first = await fetchDoc(location.href.split('#')[0]);
    const urls = dayUrls(first);
    const all = new Map();
    byNames = new Map();
    for (const u of urls) {
      const d = u === location.href.split('#')[0] ? first : await fetchDoc(u);
      parseList(d).forEach((m) => {
        const k = pairKey(m.draw, m.p1, m.p2);
        const prev = all.get(k);
        if (!prev) all.set(k, m);
        else if (prev.matchId !== m.matchId) prev.duplicate = true;  // gleiche Paarung zweimal → nicht raten
        const nk = nameKey(m.p1, m.p2);
        if (!byNames.has(nk)) byNames.set(nk, []);
        if (!byNames.get(nk).some((x) => x.matchId === m.matchId && x.draw === m.draw)) byNames.get(nk).push(m);
      });
    }
    return all;
  }

  // ---------- Prüfen ----------
  let plan = [];
  const done = [];

  $('tpx-check').onclick = async () => {
    $('tpx-run').disabled = true; $('tpx-log').textContent = '';
    let data;
    try { data = JSON.parse($('tpx-json').value); } catch (e) { alert('JSON ungültig: ' + e.message); return; }
    const list = Array.isArray(data) ? data : data.matches;
    if (!Array.isArray(list) || !list.length) { alert('Keine Spiele im JSON.'); return; }

    log('Lese Spielliste von turnier.de …');
    let online;
    try { online = await loadAllOnline(); } catch (e) { log('FEHLER: ' + e.message); return; }
    log(`${online.size} Spiele online gefunden.`);

    plan = list.map((m) => {
      let o = online.get(pairKey(m.draw, m.p1, m.p2)), note = '';
      if (!o) {   // Draw heißt online evtl. anders → nur über Namen, wenn eindeutig
        const cand = byNames.get(nameKey(m.p1, m.p2)) || [];
        if (cand.length === 1) { o = cand[0]; note = ` (Draw online: ${o.draw})`; }
        else if (cand.length > 1) { o = { duplicate: true }; }
      }
      let state, cls;
      if (!o) { state = 'nicht gefunden (Namen prüfen)'; cls = 'err'; }
      else if (o.duplicate) { state = 'Paarung mehrfach im Draw – bitte von Hand'; cls = 'err'; }
      else if (!o.editUrl) { state = `bereits eingetragen: ${o.score || '–'}`; cls = 'warn'; }
      else if (![1, 2].includes(Number(m.winner))) { state = 'Gewinner fehlt'; cls = 'err'; }
      else { state = `MatchID ${o.matchId}${note}`; cls = note ? 'warn' : 'ok'; }
      return { m, o, state, cls, ready: !!(o && o.editUrl && !o.duplicate && [1, 2].includes(Number(m.winner))) };
    });
    renderTable();
    $('tpx-run').disabled = !plan.some((p) => p.ready);
  };

  const fmtSets = (m) => m.status === 'walkover' ? 'Walkover'
    : (m.sets || []).map((s) => s.join('-')).join(' ') + (m.status === 'retired' ? ' (ret.)' : '');

  function renderTable() {
    $('tpx-table').innerHTML = `<table><tr><th></th><th>Draw</th><th>Spiel</th><th>Ergebnis</th><th>Status</th></tr>${
      plan.map((p, i) => `<tr>
        <td><input type="checkbox" data-i="${i}" ${p.ready ? 'checked' : 'disabled'}></td>
        <td>${esc(p.m.draw)}</td>
        <td>${Number(p.m.winner) === 1 ? '<b>' + esc(p.m.p1) + '</b>' : esc(p.m.p1)} – ${Number(p.m.winner) === 2 ? '<b>' + esc(p.m.p2) + '</b>' : esc(p.m.p2)}</td>
        <td>${esc(fmtSets(p.m))}</td>
        <td class="${p.cls}" id="tpx-st-${i}">${esc(p.state)}</td></tr>`).join('')
    }</table>`;
  }

  // ---------- Übertragen ----------
  async function submitOne(p) {
    const doc = await fetchDoc(p.o.editUrl);
    const form = doc.querySelector('#matchscoreform');
    if (!form) throw new Error('Formular nicht gefunden (abgemeldet?)');

    // Wer steht im Formular als Team 1? → Sätze ggf. drehen
    const val = (id) => (doc.getElementById(id)?.value || '').trim();
    const t1 = norm(`${val('Team1Player1_FirstName')} ${val('Team1Player1_MiddleName')} ${val('Team1Player1_LastName')}`);
    const t2 = norm(`${val('Team2Player1_FirstName')} ${val('Team2Player1_MiddleName')} ${val('Team2Player1_LastName')}`);
    const a = norm(p.m.p1), b = norm(p.m.p2);
    let flip;
    if (t1 === a && t2 === b) flip = false;
    else if (t1 === b && t2 === a) flip = true;
    else throw new Error(`Spieler im Formular passen nicht (${t1} / ${t2})`);

    const maxSets = Number(val('MaxSets')) || 5;
    const sets = p.m.status === 'walkover' ? [] : (p.m.sets || []);
    if (sets.length > maxSets) throw new Error(`mehr als ${maxSets} Sätze`);
    let winner = Number(p.m.winner);
    if (flip) winner = winner === 1 ? 2 : 1;

    // Formular wie der Browser zusammenbauen (inkl. Token & versteckte Felder)
    const fd = new URLSearchParams();
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => {
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      if (el.tagName === 'SELECT') {
        if (el.name === 'Winner' || el.name === 'ScoreStatus') return;   // setzen wir selbst
        const opt = el.querySelector('option[selected]:not([disabled])');
        if (opt) fd.append(el.name, opt.value);
        return;
      }
      const m = /^SetList\[(\d+)\]\.Team([12])Points$/.exec(el.name);
      if (m) {
        const s = sets[Number(m[1])];
        let v = '';
        if (s) v = String(flip ? s[m[2] === '1' ? 1 : 0] : s[m[2] === '1' ? 0 : 1]);
        fd.append(el.name, v);
        return;
      }
      fd.append(el.name, el.value);
    });
    fd.append('Winner', String(winner));
    if (p.m.status && STATUS[p.m.status]) fd.append('ScoreStatus', STATUS[p.m.status]);

    const action = new URL(form.getAttribute('action'), location.origin).toString();
    const r = await fetch(action, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fd.toString(),
    });
    if (!r.ok) throw new Error(`Speichern fehlgeschlagen (HTTP ${r.status})`);
    const html = await r.text();
    // Bleibt man auf dem Formular mit Fehlermeldung, hat der Server abgelehnt
    const resp = new DOMParser().parseFromString(html, 'text/html');
    const errs = [...resp.querySelectorAll('.field-validation-error, .validation-summary-errors li')]
      .map((e) => e.textContent.trim()).filter(Boolean);
    if (errs.length) throw new Error('turnier.de: ' + errs.join('; '));
  }

  $('tpx-run').onclick = async () => {
    const chosen = [...document.querySelectorAll('#tpx-table input[type=checkbox]:checked')].map((c) => plan[c.dataset.i]);
    if (!chosen.length) return;
    if (!confirm(`${chosen.length} Ergebnis(se) auf turnier.de speichern?`)) return;
    $('tpx-run').disabled = $('tpx-check').disabled = true;

    for (const p of chosen) {
      const i = plan.indexOf(p), st = $('tpx-st-' + i);
      st.className = ''; st.textContent = 'speichere …';
      try { await submitOne(p); st.className = 'ok'; st.textContent = 'gespeichert – prüfe …'; }
      catch (e) { st.className = 'err'; st.textContent = e.message; log(`${p.m.p1} – ${p.m.p2}: ${e.message}`); p.failed = true; }
      await sleep(600);
    }

    // Gegenprüfung: Liste neu laden, Link "Ergebnis eingeben" muss weg sein
    try {
      const online = await loadAllOnline();
      for (const p of chosen) {
        if (p.failed) continue;
        const i = plan.indexOf(p), st = $('tpx-st-' + i);
        const o = [...online.values()].find((x) => x.p1 && nameKey(x.p1, x.p2) === nameKey(p.m.p1, p.m.p2) && x.draw === p.o.draw);
        if (o && !o.editUrl) { st.className = 'ok'; st.textContent = `✓ online: ${o.score}`; done.push(p.m.id); }
        else { st.className = 'err'; st.textContent = 'nicht bestätigt – bitte auf turnier.de prüfen'; }
      }
    } catch (e) { log('Gegenprüfung fehlgeschlagen: ' + e.message); }

    log(`${done.length} von ${chosen.length} übertragen.`);
    if (done.length) {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'mgtp-transferred', ids: done.slice() }, '*');
          log('Rückmeldung an den Turnierplanner gesendet – Spiele dort als "übertragen" markiert.');
        } else {
          log('Kein Turnierplanner-Fenster verbunden – "Übertragene IDs kopieren" und in der App einfügen.');
        }
      } catch (e) { log('Rückmeldung nicht möglich: ' + e.message); }
    }
    $('tpx-check').disabled = false;
    $('tpx-copy').disabled = !done.length;
  };

  // =====================================================================
  // ---------- SPIELE-IMPORT (turnier.de → Turnierplanner) ----------
  // =====================================================================
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const pad = (n) => String(n).padStart(2, '0');

  document.head.insertAdjacentHTML('beforeend', `<style>
  #tpi-btn{position:fixed;right:230px;bottom:18px;z-index:99999;background:#1f5f99;color:#fff;border:0;border-radius:8px;padding:12px 16px;font:600 14px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer}
  #tpi{position:fixed;right:18px;bottom:70px;z-index:99999;width:min(900px,96vw);max-height:80vh;overflow:auto;background:#fff;color:#222;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35);font:13px system-ui;padding:14px;display:none}
  #tpi h3{margin:0 0 8px;font-size:16px}
  #tpi label{margin-right:14px;cursor:pointer}
  #tpi button{margin:8px 6px 0 0;padding:7px 12px;border-radius:6px;border:1px solid #888;background:#f4f4f4;cursor:pointer}
  #tpi button.go{background:#1f5f99;color:#fff;border-color:#1f5f99}
  #tpi button:disabled{opacity:.5;cursor:default}
  #tpi table{width:100%;border-collapse:collapse;margin-top:10px}
  #tpi td,#tpi th{border-bottom:1px solid #e3e3e3;padding:3px 6px;text-align:left;vertical-align:top;white-space:nowrap}
  #tpi .ok{color:#1f7a3a;font-weight:600} #tpi .warn{color:#b26a00;font-weight:600} #tpi .mut{color:#888}
  #tpi .log{margin-top:8px;font:12px monospace;white-space:pre-wrap;background:#f7f7f7;padding:6px;border-radius:6px;max-height:120px;overflow:auto}</style>`);
  document.body.insertAdjacentHTML('beforeend', `
    <button id="tpi-btn">⇩ Spiele importieren</button>
    <div id="tpi">
      <h3>Spiele in den Turnierplanner importieren</h3>
      <div>
        <label><input type="checkbox" id="tpi-all" checked> alle Spieltage</label>
        <label><input type="checkbox" id="tpi-round" checked> Runde nachladen (Spieldetails)</label>
      </div>
      <div>
        <button id="tpi-read" class="go">Spiele lesen</button>
        <button id="tpi-send" disabled>An App senden</button>
        <button id="tpi-copy" disabled>JSON kopieren</button>
      </div>
      <div id="tpi-sum"></div>
      <div id="tpi-table"></div>
      <div id="tpi-log" class="log" style="display:none"></div>
    </div>`);
  $('tpi-btn').onclick = () => { const p = $('tpi'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; $('tpx').style.display = 'none'; };
  $('tpx-btn').addEventListener('click', () => { $('tpi').style.display = 'none'; });
  const ilog = (msg) => { const l = $('tpi-log'); l.style.display = 'block'; l.textContent += msg + '\n'; l.scrollTop = 1e9; };

  // Datum aus dem Tages-Link (…&d=20261031)
  function dayOf(url) {
    const d = new URL(url, location.origin).searchParams.get('d') || '';
    return /^\d{8}$/.test(d) ? { y: +d.slice(0, 4), m: +d.slice(4, 6), d: +d.slice(6, 8) } : null;
  }

  // Eine Seite (Spieltag) für den Import auslesen
  function parseImportList(doc, url) {
    const day = dayOf(url);
    const res = { matches: [], open: 0 };
    doc.querySelectorAll('td.plannedtime').forEach((td) => {
      const tr = td.closest('tr');
      const drawA = tr.querySelector('a[href*="draw.aspx"]');
      if (!drawA) return;
      const info = tr.querySelector('a[href*="match-info/"]');
      // Seiten: je Spieler-Seite eine innere Tabelle (Doppel → mehrere Namen)
      const sides = [...tr.children].map((c) => c.querySelector(':scope > table')).filter(Boolean)
        .map((tbl) => {
          const names = [...tbl.querySelectorAll('a[href*="player.aspx"]')].map((a) => clean(a.textContent)).filter(Boolean);
          const cA = tbl.querySelector('a[href*="c="]');
          let country = cA ? (new URL(cA.getAttribute('href'), location.origin).searchParams.get('c') || '') : '';
          if (!country) { const f = tbl.querySelector('.printonly.flag'); if (f) country = clean(f.textContent).replace(/[[\]]/g, ''); }
          return { name: names.join(' / '), country: country.toUpperCase() };
        });
      if (!info || sides.length < 2 || !sides[0].name || !sides[1].name) { res.open++; return; }

      const parts = new URL(info.getAttribute('href'), location.origin).pathname.split('/').filter(Boolean);
      const mi = parts.indexOf('match-info');
      const drawNo = parts[mi + 2] || '', matchId = parts[mi + 3] || '';
      if (!matchId) { res.open++; return; }

      const t = /(\d{1,2}):(\d{2})/.exec(td.textContent || '');
      let time = null, sortTs = null;
      if (t) {
        const hh = +t[1], mm = +t[2];
        time = day ? `${pad(day.d)}.${pad(day.m)}.${day.y} ${pad(hh)}:${pad(mm)}` : `${pad(hh)}:${pad(mm)}`;
        if (day) sortTs = new Date(day.y, day.m - 1, day.d, hh, mm).getTime();
      }
      const cA = tr.querySelector('a[href*="court.aspx"]');
      const court = cA ? clean(cA.textContent) : '';
      const cn = /(\d+)\s*$/.exec(court);

      let score = clean(tr.querySelector('.score')?.textContent);
      if (!score) {
        [...tr.children].forEach((c) => {
          if (c.querySelector('a,table')) return;
          const x = clean(c.textContent);
          if (/\d+\s*-\s*\d+/.test(x) || /walkover|w\.\s?o\.|retired|aufgabe|kampflos/i.test(x)) score = score ? score + ' ' + x : x;
        });
      }
      const played = /\d+\s*-\s*\d+/.test(score) || /walkover|w\.\s?o\.|retired|aufgabe|kampflos/i.test(score);

      res.matches.push({
        ext_key: `ts:${tournamentId.slice(0, 8).toLowerCase()}:${drawNo}:${matchId}`,
        ts_match_id: matchId, ts_draw: drawNo,
        info_url: new URL(info.getAttribute('href').split('?')[0], location.origin).toString(),
        event: clean(drawA.textContent), round: '',
        time, sort_ts: sortTs,
        court: court || null, court_no: cn ? Number(cn[1]) : null,
        p1: sides[0], p2: sides[1],
        score: score || null, played,
      });
    });
    return res;
  }

  // Runde aus der Spieldetail-Seite ("i") lesen – tolerant, sonst leer
  const ROUND_RX = /\b(runde|round|finale?|halbfinale|semi[- ]?finals?|viertelfinale|quarter[- ]?finals?|achtelfinale|play[- ]?offs?|platzierung(sspiel)?|place|pool|gruppe|group|qualifikation|qualifying|qualification|R\d{1,3})\b/i;
  function parseRound(doc) {
    doc.querySelectorAll('nav,header,footer,script,style,select,noscript,.navigation,.nav,.menu,.breadcrumb,[class*="cookie"],[class*="ad--"]').forEach((e) => e.remove());
    const leaves = [...doc.body.querySelectorAll('*')].filter((e) => !e.children.length);
    // 1) Beschriftung "Runde"/"Round" + Wert daneben
    for (const el of leaves) {
      if (!/^(runde|round)\s*:?$/i.test(clean(el.textContent))) continue;
      const cand = [el.nextElementSibling, el.parentElement && el.parentElement.nextElementSibling];
      for (const c of cand) { const v = c && clean(c.textContent); if (v && v.length <= 40) return v; }
    }
    // 2) kurzer Text, der wie eine Runde aussieht (z. B. "Testdraw - Runde 1", "Quarter final")
    for (const el of leaves) {
      const tx = clean(el.textContent);
      if (tx.length < 2 || tx.length > 60 || !ROUND_RX.test(tx)) continue;
      const seg = tx.split(/\s+[-–·|]\s+/).find((s) => ROUND_RX.test(s)) || tx;
      return seg.replace(/^(runde|round)\s*:\s*/i, '$1 ').trim();
    }
    return '';
  }

  async function loadRounds(list) {
    let i = 0, done = 0, found = 0;
    const worker = async () => {
      while (i < list.length) {
        const m = list[i++];
        try { m.round = parseRound(await fetchDoc(m.info_url)); if (m.round) found++; } catch (e) { /* leer lassen */ }
        done++;
        if (done % 10 === 0 || done === list.length) $('tpi-sum').textContent = `Runden: ${done}/${list.length} geladen …`;
        await sleep(120);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return found;
  }

  let importPayload = null;

  $('tpi-read').onclick = async () => {
    $('tpi-read').disabled = $('tpi-send').disabled = $('tpi-copy').disabled = true;
    $('tpi-log').textContent = ''; $('tpi-table').innerHTML = '';
    try {
      const here = location.href.split('#')[0];
      const first = await fetchDoc(here);
      const urls = $('tpi-all').checked ? dayUrls(first) : [here];
      const byKey = new Map(); let open = 0;
      for (const u of urls) {
        const d = u === here ? first : await fetchDoc(u);
        const r = parseImportList(d, u);
        open += r.open;
        r.matches.forEach((m) => {
          const prev = byKey.get(m.ext_key);
          if (!prev || (!prev.time && m.time)) byKey.set(m.ext_key, m);   // Tagesansicht schlägt "Unscheduled"
        });
        ilog(`${dayOf(u) ? new URL(u).searchParams.get('d') : 'ohne Termin'}: ${r.matches.length} Spiele${r.open ? `, ${r.open} noch ohne Paarung` : ''}`);
      }
      const list = [...byKey.values()].sort((a, b) => (a.sort_ts || 9e15) - (b.sort_ts || 9e15) || (a.court_no || 0) - (b.court_no || 0));
      let rounds = 0;
      if ($('tpi-round').checked && list.length) { ilog('Lade Runden aus den Spieldetails …'); rounds = await loadRounds(list); ilog(`Runde bei ${rounds} von ${list.length} Spielen gefunden.`); }

      importPayload = {
        type: 'mgtp-import', source: location.hostname, tournament: tournamentId,
        url: `${location.origin}/sport/legacymatches.aspx?id=${tournamentId}`,
        matches: list.map(({ info_url, ...m }) => m), open,
      };
      const played = list.filter((m) => m.played).length;
      $('tpi-sum').innerHTML = `<b>${list.length}</b> Spiele gefunden · <span class="ok">${list.length - played} offen</span> · <span class="mut">${played} bereits gespielt (werden in der App übersprungen)</span>${open ? ` · <span class="warn">${open} noch ohne Paarung (nicht importierbar)</span>` : ''}`;
      $('tpi-table').innerHTML = `<table><tr><th>Zeit</th><th>Event</th><th>Runde</th><th>Court</th><th>Spiel</th><th>Ergebnis</th></tr>${
        list.map((m) => `<tr class="${m.played ? 'mut' : ''}"><td>${esc(m.time || '–')}</td><td>${esc(m.event)}</td><td>${esc(m.round || '')}</td><td>${esc(m.court || '')}</td>
          <td>${esc(m.p1.name)} <span class="mut">${esc(m.p1.country)}</span> – ${esc(m.p2.name)} <span class="mut">${esc(m.p2.country)}</span></td><td>${esc(m.score || '')}</td></tr>`).join('')}</table>`;
      const hasApp = !!(window.opener && !window.opener.closed);
      $('tpi-send').disabled = !list.length || !hasApp;
      $('tpi-send').title = hasApp ? '' : 'Kein App-Fenster verbunden – Import in der App über „⇪ turnier.de → Spiele holen“ starten oder JSON kopieren';
      $('tpi-copy').disabled = !list.length;
      if (hasApp && location.hash === '#mgtp-import' && list.length) $('tpi-send').onclick();
    } catch (e) { ilog('FEHLER: ' + e.message); }
    $('tpi-read').disabled = false;
  };

  let ackTimer = null;
  window.addEventListener('message', (e) => {
    if (!window.opener || e.source !== window.opener || !e.data) return;
    const d = e.data;
    if (d.type === 'mgtp-import-ack') {
      clearTimeout(ackTimer);
      ilog(`✓ App hat ${d.n} Spiele empfangen → im App-Fenster erscheint jetzt „Spiele von turnier.de übernehmen“ – dort „✓ Jetzt importieren“ klicken.`);
    } else if (d.type === 'mgtp-import-done') {
      if (d.cancelled) ilog('Import in der App abgebrochen.');
      else if (d.error) ilog('Import-Fehler in der App: ' + d.error);
      else ilog(`✓ Import fertig: ${d.neu || 0} neu · ${d.upd || 0} aktualisiert · ${d.dup || 0} unverändert · ${d.played || 0} gespielt übersprungen${d.failed ? ' · ' + d.failed + ' fehlgeschlagen' : ''}`);
    }
  });

  $('tpi-send').onclick = () => {
    if (!importPayload) return;
    if (!window.opener || window.opener.closed) { ilog('Kein App-Fenster mehr verbunden – bitte „JSON kopieren“ nutzen.'); return; }
    try {
      window.opener.postMessage(importPayload, '*');
      try { window.opener.focus(); } catch (e) { /* Browser erlaubt evtl. kein Umschalten */ }
      ilog(`${importPayload.matches.length} Spiele an den Turnierplanner gesendet – warte auf Antwort …`);
      clearTimeout(ackTimer);
      ackTimer = setTimeout(() => ilog('⚠ Keine Antwort von der App. Prüfen: Ist die neue Version (v73) online und wurde dieses Fenster aus der App über „⇅ turnier.de → ⇩ Spiele holen“ geöffnet? Sonst „JSON kopieren“ und in der App unter „Spiele von Hand einfügen“ einfügen.'), 4000);
      if (location.hash === '#mgtp-import') history.replaceState(null, '', location.href.split('#')[0]);
    } catch (e) { ilog('Senden nicht möglich: ' + e.message + ' – bitte „JSON kopieren“ nutzen.'); }
  };
  $('tpi-copy').onclick = async () => {
    if (!importPayload) return;
    await navigator.clipboard.writeText(JSON.stringify(importPayload));
    ilog('JSON kopiert – in der App unter „⇪ turnier.de → Spiele von Hand einfügen“ einfügen.');
  };

  // Von der App geöffnet (#mgtp-import) → direkt lesen und senden
  if (location.hash === '#mgtp-import') { $('tpi').style.display = 'block'; $('tpi-read').onclick(); }

  // Übergabe aus dem Turnierplanner per Link (#mgtp=…)
  if (location.hash.startsWith('#mgtp=')) {
    try {
      const json = decodeURIComponent(location.hash.slice(6));
      JSON.parse(json);
      $('tpx-json').value = json;
      history.replaceState(null, '', location.href.split('#')[0]);
      $('tpx').style.display = 'block';
      $('tpx-check').onclick();
    } catch (e) { log('Übergabe aus dem Turnierplanner fehlerhaft: ' + e.message); $('tpx').style.display = 'block'; }
  }

  $('tpx-copy').onclick = async () => {
    await navigator.clipboard.writeText(JSON.stringify({ transferred: done }));
    log('IDs kopiert – im Turnierplanner einfügen, um sie als "übertragen" zu markieren.');
  };
})();

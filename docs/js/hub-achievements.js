/* ══════════════════════════════════════════════════════════════════════
   hub-achievements.js — Onglet Succès du Hub Jaharta

   Mode déterminé automatiquement :
     - Site normal (window._irpMode falsy) → succès NORMAL uniquement
     - Site IRP   (window._irpMode truthy) → succès IRP uniquement

   Containers :
     - Normal : #ach-container  (dans panel-succes)
     - IRP    : #irp-succes-container  (créé par hub-irp.js)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var RANK_POINTS = {
    F:1,E:2,D:3,C:5,B:8,A:12,S:18,SS:25,SSS:35,X:50,T:70,G:100,'G+':140,Z:200
  };
  var RANK_COLORS = {
    F:'#6b7280',E:'#60a5fa',D:'#34d399',C:'#a78bfa',B:'#f472b6',A:'#fbbf24',
    S:'#f97316',SS:'#ef4444',SSS:'#dc2626',X:'#7c3aed',T:'#06b6d4',G:'#eab308',
    'G+':'#f59e0b',Z:'#ff0055'
  };
  var RANK_ORDER = ['F','E','D','C','B','A','S','SS','SSS','X','T','G','G+','Z'];
  var STAT_LABELS = {
    strength:'STR',agility:'AGI',speed:'SPD',intelligence:'INT',
    mana:'MANA',resistance:'RES',charisma:'CHA',aura:'AURA'
  };

  var _achDefs = null;
  var _customIcons = null;
  var _userAch = null;
  var _allUsersAch = null;
  var _loaded = false;
  var _showingLeaderboard = false;
  var _userUnsub = null;
  var _watchedUID = null;

  function isIRP() { return !!window._irpMode; }
  function getLabel() { return isIRP() ? 'IRP' : 'NORMAL'; }

  function getContainer() {
    if (isIRP()) {
      return document.getElementById('irp-succes-container') || document.getElementById('ach-container');
    }
    return document.getElementById('ach-container');
  }

  /* ── Firestore loaders ── */
  async function loadDefs() {
    if (_achDefs) return _achDefs;
    try {
      var snap = await db.collection('config').doc('achievements_config').get();
      if (snap.exists) { _achDefs = snap.data(); return _achDefs; }
    } catch (_) {}
    /* Ne PAS cacher le fallback vide : on réessaiera au prochain appel */
    return { normal: {}, irp: {} };
  }

  async function loadCustomIcons() {
    if (_customIcons) return _customIcons;
    try {
      var snap = await db.collection('config').doc('achievements_icons').get();
      if (snap.exists) { _customIcons = snap.data() || {}; return _customIcons; }
    } catch (_) {}
    /* Ne PAS cacher le fallback vide : on réessaiera au prochain appel */
    return {};
  }

  async function saveIcon(achId, url) {
    try {
      if (!_customIcons) _customIcons = {};
      _customIcons[achId] = url;
      await db.collection('config').doc('achievements_icons').set(_customIcons);
      if (typeof showToast === 'function') showToast('Image sauvegardée !', 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast('Erreur: ' + e.message, 'error');
    }
  }

  function getDefs() {
    if (!_achDefs) return {};
    return isIRP() ? (_achDefs.irp || {}) : (_achDefs.normal || {});
  }

  /* Attache un listener temps-réel sur achievements_user/{uid}.
     Remplace le get() one-shot : dès que le bot écrit un nouvel unlock,
     Firestore push le snapshot et on re-render si le panneau est visible.
     Idempotent — relance seulement si l'UID a changé. */
  function watchUser() {
    if (typeof db === 'undefined' || !window.UID) return;
    var uidStr = String(window.UID);
    if (_userUnsub && _watchedUID === uidStr) return;
    if (_userUnsub) { try { _userUnsub(); } catch (_) {} _userUnsub = null; }
    _watchedUID = uidStr;
    try {
      _userUnsub = db.collection('achievements_user').doc(uidStr).onSnapshot(
        function (snap) {
          var data = snap.exists ? (snap.data() || {}) : {};
          _userAch = { unlocked: data.unlocked || {}, stats: data.stats || {} };
          /* Re-render seulement si le panneau succès est actuellement visible
             (évite de repeindre le DOM pour rien quand l'utilisateur est ailleurs). */
          var c = getContainer();
          if (_loaded && !_showingLeaderboard && c && c.offsetParent !== null) {
            render();
          }
        },
        function (err) { window._dbg && window._dbg.error && window._dbg.error('[ACH] watchUser', err); }
      );
    } catch (e) { window._dbg && window._dbg.error && window._dbg.error('[ACH] watchUser', e); }
  }

  async function loadUser() {
    /* Attendre jusqu'à 3 s que UID soit posé par hub-irp-core.js (race entre
       ouverture du tab Succès et fin du login). */
    if (!window.UID) {
      for (var i = 0; i < 30 && !window.UID; i++) {
        await new Promise(function (r) { setTimeout(r, 100); });
      }
    }
    if (!window.UID) { _userAch = { unlocked: {}, stats: {} }; return _userAch; }
    watchUser();
    /* Attendre la première arrivée du snapshot (max 3 s). Les updates
       suivantes passeront par le listener → re-render automatique. */
    for (var j = 0; j < 30 && !_userAch; j++) {
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    if (!_userAch) _userAch = { unlocked: {}, stats: {} };
    return _userAch;
  }

  async function loadAll() {
    if (_allUsersAch) return _allUsersAch;
    try {
      var snaps = await db.collection('achievements_user').get();
      _allUsersAch = {};
      snaps.forEach(function (d) { _allUsersAch[d.id] = d.data(); });
    } catch (_) { _allUsersAch = {}; }
    return _allUsersAch;
  }

  /* Renvoie uniquement les unlocks dont le champ `mode` correspond au hub courant.
     Le bot écrit `mode: "normal"|"irp"` sur chaque entrée ([achievement_system.py])
     → on filtre ici pour garantir la séparation hub normal / hub IRP, même si
     un ID venait à exister dans les deux sets définitions. */
  function unlockedForMode() {
    var all = (_userAch || {}).unlocked || {};
    var want = isIRP() ? 'irp' : 'normal';
    var out = {};
    Object.keys(all).forEach(function (k) {
      if ((all[k] || {}).mode === want) out[k] = all[k];
    });
    return out;
  }

  function score(unlocked, defs) {
    var s = 0;
    Object.keys(unlocked || {}).forEach(function (a) { if (defs[a]) s += (RANK_POINTS[defs[a].rank] || 0); });
    return s;
  }

  function bStr(bonus) {
    if (!bonus) return '';
    return Object.entries(bonus).filter(function (e) { return e[1] > 0; })
      .map(function (e) { return '+' + e[1] + ' ' + (STAT_LABELS[e[0]] || e[0]); }).join(', ');
  }

  /* ══════════════════════════════════════════════════════════════════════
     RENDER — main achievement list (current mode only)
     ══════════════════════════════════════════════════════════════════════ */
  async function render() {
    var c = getContainer();
    if (!c) return;

    if (_showingLeaderboard) { await renderLB(); return; }

    if (!_loaded) {
      c.innerHTML = '<div class="ach-loading">Chargement des succès...</div>';
      await loadDefs();
      await loadUser();
      await loadCustomIcons();
      _loaded = true;
    }

    var defs = getDefs();
    var icons = _customIcons || {};
    var unlocked = unlockedForMode();
    var total = Object.keys(defs).length;
    var cnt = Object.keys(unlocked).filter(function (a) { return !!defs[a]; }).length;
    var sc = score(unlocked, defs);
    var label = getLabel();
    var isAdmin = !!window._isAdmin;

    /* Group by rank */
    var byRank = {};
    RANK_ORDER.forEach(function (r) { byRank[r] = []; });
    Object.entries(defs).forEach(function (e) {
      var aid = e[0], d = e[1], r = d.rank || 'F';
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push({ id: aid, ...d, isUnlocked: !!unlocked[aid] });
    });

    var h = '';

    /* Header */
    h += '<div class="ach-header">';
    h += '<div class="ach-stats">';
    h += '<div class="ach-stat-box"><div class="ach-stat-val">' + cnt + '/' + total + '</div><div class="ach-stat-label">Débloqués</div></div>';
    h += '<div class="ach-stat-box"><div class="ach-stat-val">' + sc + '</div><div class="ach-stat-label">Score</div></div>';
    h += '</div>';
    h += '<button class="ach-mode-btn ach-lb-btn" onclick="window._achToggleLB()">🏆 Leaderboard</button>';
    h += '</div>';

    /* Total bonus */
    var tb = {};
    Object.keys(unlocked).forEach(function (aid) {
      var d = defs[aid];
      if (d && d.bonus) Object.entries(d.bonus).forEach(function (e) { tb[e[0]] = (tb[e[0]] || 0) + e[1]; });
    });
    var be = Object.entries(tb).filter(function (e) { return e[1] > 0; });
    if (be.length) {
      h += '<div class="ach-total-bonus">Bonus ' + label + ' : ' +
        be.map(function (e) { return '<span class="ach-bonus-tag">+' + e[1] + ' ' + (STAT_LABELS[e[0]] || e[0]) + '</span>'; }).join(' ') + '</div>';
    }

    /* Rank sections */
    RANK_ORDER.forEach(function (rank) {
      var achs = byRank[rank];
      if (!achs || !achs.length) return;
      var col = RANK_COLORS[rank] || '#6b7280';
      var uir = achs.filter(function (a) { return a.isUnlocked; }).length;

      h += '<div class="ach-rank-section">';
      h += '<div class="ach-rank-header" style="border-color:' + col + '">';
      h += '<span class="ach-rank-badge" style="background:' + col + '">' + rank + '</span>';
      h += '<span class="ach-rank-title">Rang ' + rank + '</span>';
      h += '<span class="ach-rank-count">' + uir + '/' + achs.length + '</span>';
      h += '</div>';
      h += '<div class="ach-grid">';

      achs.forEach(function (a) {
        var lk = !a.isUnlocked;
        var cls = 'ach-card' + (lk ? ' locked' : '') + ' rank-' + rank.replace('+', 'plus');
        var icon = icons[a.id] || a.icon || null;
        var bonus = bStr(a.bonus);

        h += '<div class="' + cls + '" style="--rank-color:' + col + '">';
        h += '<div class="ach-card-icon">';
        if (icon && !lk) h += '<img src="' + icon + '" alt="" class="ach-icon-img" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
          + '<div class="ach-icon-placeholder" style="display:none">🏆</div>';
        else h += '<div class="ach-icon-placeholder">' + (lk ? '?' : '🏆') + '</div>';
        h += '</div>';
        h += '<div class="ach-card-info">';
        h += '<div class="ach-card-name">' + (lk ? '???' : a.name) + '</div>';
        h += '<div class="ach-card-desc">' + (lk ? 'Succès verrouillé' : a.desc) + '</div>';
        if (!lk && bonus) h += '<div class="ach-card-bonus">' + bonus + '</div>';
        h += '<div class="ach-card-type">' + (a.type === 'owner' ? '👑 Owner' : '⚡ Auto') + '</div>';
        h += '</div>';
        if (isAdmin) h += '<button class="ach-edit-icon-btn" data-ach-id="' + a.id + '" title="Modifier image">✏️</button>';
        h += '</div>';
      });

      h += '</div></div>';
    });

    c.innerHTML = h;

    /* Admin edit icon binding */
    if (isAdmin) {
      c.querySelectorAll('.ach-edit-icon-btn').forEach(function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var achId = this.dataset.achId;
          var currentUrl = (icons[achId]) || '';
          var newUrl = prompt('URL image succès (vide = supprimer):', currentUrl);
          if (newUrl === null) return;
          saveIcon(achId, newUrl.trim()).then(function () {
            _loaded = false; _customIcons = null; render();
          });
        });
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     LEADERBOARD — current mode only
     ══════════════════════════════════════════════════════════════════════ */
  async function renderLB() {
    var c = getContainer();
    if (!c) return;
    c.innerHTML = '<div class="ach-loading">Chargement du leaderboard...</div>';

    await loadDefs();
    var allU = await loadAll();
    var defs = getDefs();
    var label = getLabel();

    var want = isIRP() ? 'irp' : 'normal';
    var scores = [];
    Object.entries(allU).forEach(function (e) {
      var uid = e[0], data = e[1], rawU = data.unlocked || {};
      var ul = {};
      Object.keys(rawU).forEach(function (k) {
        if ((rawU[k] || {}).mode === want) ul[k] = rawU[k];
      });
      var s = score(ul, defs);
      var n = Object.keys(ul).filter(function (a) { return !!defs[a]; }).length;
      if (s > 0) scores.push({ uid: uid, score: s, count: n });
    });
    scores.sort(function (a, b) { return b.score - a.score; });

    /* Usernames */
    var names = {};
    try {
      var ps = await db.collection('players').get();
      ps.forEach(function (d) { var dd = d.data(); names[d.id] = dd.display_name || dd.username || ('User#' + d.id.slice(-4)); });
    } catch (_) {}

    var h = '';
    h += '<div class="ach-header"><button class="ach-mode-btn" onclick="window._achToggleLB()">← Retour aux succès</button></div>';
    h += '<div class="ach-lb-title">🏆 LEADERBOARD SUCCÈS — ' + label + '</div>';

    if (!scores.length) {
      h += '<div class="ach-lb-empty">Aucun joueur n\'a encore de succès.</div>';
    } else {
      h += '<div class="ach-lb-list">';
      var medals = ['🥇', '🥈', '🥉'];
      scores.slice(0, 25).forEach(function (s, i) {
        var medal = i < 3 ? medals[i] : (i + 1) + '.';
        var name = names[s.uid] || ('User#' + s.uid.slice(-4));
        var isMe = String(s.uid) === String(window.UID);
        var cls = 'ach-lb-row' + (i < 3 ? ' top3' : '') + (isMe ? ' me' : '');
        h += '<div class="' + cls + '">';
        h += '<span class="ach-lb-rank">' + medal + '</span>';
        h += '<span class="ach-lb-name">' + name + '</span>';
        h += '<span class="ach-lb-score">' + s.score + ' pts</span>';
        h += '<span class="ach-lb-count">' + s.count + ' succès</span>';
        h += '</div>';
      });
      h += '</div>';
    }
    c.innerHTML = h;

    /* Admin edit icon binding */
    if (isAdmin) {
      c.querySelectorAll('.ach-edit-icon-btn').forEach(function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var achId = this.dataset.achId;
          var currentUrl = (icons[achId]) || '';
          var newUrl = prompt('URL image succès (vide = supprimer):', currentUrl);
          if (newUrl === null) return;
          saveIcon(achId, newUrl.trim()).then(function () {
            _loaded = false; _customIcons = null; render();
          });
        });
      });
    }
  }

  /* ── Public ── */
  window._achToggleLB = function () {
    _showingLeaderboard = !_showingLeaderboard;
    _allUsersAch = null;
    render();
  };
  window._achRefresh = function () {
    _showingLeaderboard = false;
    _loaded = false;
    _achDefs = null;
    _customIcons = null;
    /* NE PAS reset _userAch : le listener onSnapshot le garde à jour en
       temps réel. Le vider forcerait un re-await inutile de 3 s. */
    render();
  };
  window._achGetBonuses = function () {
    var defs = getDefs();
    var unlocked = unlockedForMode();
    var tb = {};
    Object.keys(unlocked).forEach(function (aid) {
      var d = defs[aid];
      if (d && d.bonus) Object.entries(d.bonus).forEach(function (e) { tb[e[0]] = (tb[e[0]] || 0) + e[1]; });
    });
    return tb;
  };
  window._achGetAllBonuses = function () {
    if (!_achDefs || !_userAch) return {};
    var unlocked = _userAch.unlocked || {};
    var allDefs = Object.assign({}, _achDefs.normal || {}, _achDefs.irp || {});
    var tb = {};
    Object.keys(unlocked).forEach(function (aid) {
      var d = allDefs[aid];
      if (d && d.bonus) Object.entries(d.bonus).forEach(function (e) { tb[e[0]] = (tb[e[0]] || 0) + e[1]; });
    });
    return tb;
  };

  /* ── Preload at startup for bonus getters ── */
  function _preloadAchData() {
    if (typeof db === 'undefined') { setTimeout(_preloadAchData, 200); return; }
    loadDefs().then(function () {
      function _waitUID() {
        if (window.UID) { loadUser().then(function () { loadCustomIcons(); }); }
        else { setTimeout(_waitUID, 300); }
      }
      _waitUID();
    }).catch(function () {});
  }
  _preloadAchData();

  /* Pas de poll périodique : `watchUser()` reçoit les nouveaux unlocks en
     temps réel via onSnapshot. Le doc `config/achievements_config` est
     rechargé seulement à l'ouverture du tab (change rarement — push horaire). */

  /* ── Lazy loaders ── */
  /* Normal hub: LAZY.succes */
  if (typeof LAZY !== 'undefined') {
    LAZY.succes = render;
  }
  /* IRP hub: exposed for hub-irp.js override */
  window._renderAchievements = render;

})();

/* ═══════════════════════════════════════════════════════════════════════
   axiomes-page.js — Système d'Axiomes v2 · Phase 1 (T0 + T1 only)
   Spec : neophyte (lvl<50) · pick (lvl 50+) · chosen (axiome actif)
   Persistance : characters.{id}.axiome_current via worker D1.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STATE = {
    chars: [],
    activeChar: null,
    data: null,
    axiomes: {},
    progression: null,
    tierUnlockLevels: { "1": 50, "2": 75, "3": 125, "4": 175, "5": 225 },
    secretRates: null,
    statLabels: null,
    axium: 0,
    noSession: false,
    fetchError: null,
    modalAxId: null,
    modalNodeId: null,
    /* switchMode legacy (toujours false avec la nouvelle sémantique irréversible) */
    switchMode: false
  };

  var MIN_LEVEL = 50;
  var SWITCH_COST = 1;

  /* ─── Utils ─── */
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

  /* Préfixes glyph par type d'effet (nouveau format `effects: []`). */
  var EFFECT_GLYPH = {
    unlock_slot:      '⊕',
    unlock_item_type: '⚒',
    stat_bonus:       '↑',
    narrative:        '✦',
    shop_discount:    '¤',
    shop_bonus:       '¤'
  };

  /**
   * Formate les effets d'un skill en items {glyph, text} pour rendu HTML.
   * Compatible avec :
   *  - Nouveau format : node.effects = [{type, summary, ...}, ...]
   *  - Legacy : node.effect = "string description"
   */
  function formatEffects(node){
    if (Array.isArray(node.effects) && node.effects.length) {
      return node.effects
        .filter(function(e){ return e && (e.summary || e.type); })
        .map(function(e){
          var g = EFFECT_GLYPH[e.type] || '·';
          return { glyph: g, text: e.summary || e.type };
        });
    }
    if (node.effect) {
      return [{ glyph: '·', text: String(node.effect) }];
    }
    return [];
  }

  /* Rendu HTML compact (1 ligne) pour les cartes de l'arbre. */
  function renderEffectsCompact(node){
    var items = formatEffects(node);
    if (!items.length) return '';
    /* On garde uniquement le 1er pour rester compact. Indique +N si plus. */
    var first = items[0];
    var extra = items.length > 1 ? ' <span class="ax-eff-more">+' + (items.length - 1) + '</span>' : '';
    return '<span class="ax-eff-glyph">' + esc(first.glyph) + '</span> ' + esc(first.text) + extra;
  }

  /* Rendu HTML détaillé (multi-ligne) pour le modal. */
  function renderEffectsDetailed(node){
    var items = formatEffects(node);
    if (!items.length) return '<em>—</em>';
    return items.map(function(it){
      return '<div class="ax-eff-row">' +
        '<span class="ax-eff-glyph">' + esc(it.glyph) + '</span> ' +
        esc(it.text) +
      '</div>';
    }).join('');
  }

  /* Hash FNV-1a → fraction [0,1) déterministe par (seed, salt). */
  function hashFraction(seed, salt){
    var s = String(seed) + '|' + String(salt);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h / 0x100000000;
  }

  /* Renvoie les ids des secrets visibles pour ce char.
     Chaque secret a son taux (default 10%, regressor 1%, override via _prob_rate). */
  function rolledSecrets(c){
    if (!c) return [];
    var lvl = parseInt(c.level || 0, 10) || 0;
    if (lvl < MIN_LEVEL) return [];
    var cid = c._id || c.id;
    if (!cid) return [];
    var defaultRate = (STATE.secretRates && STATE.secretRates.default) || 0.10;
    var out = [];
    Object.keys(STATE.axiomes || {}).forEach(function(id){
      var def = STATE.axiomes[id];
      if (!def || !def._prob_secret) return;
      var rate = (typeof def._prob_rate === 'number') ? def._prob_rate
              : (STATE.secretRates && STATE.secretRates[id]) || defaultRate;
      if (hashFraction(cid, id) < rate) out.push(id);
    });
    return out;
  }

  /* Calcule les multiplicateurs (buff, malus) selon le tier de l'axiome. */
  function getMultipliers(def, tier){
    var t = tier != null ? tier : (def && def.tier) || 1;
    var p = STATE.progression && STATE.progression[t];
    if (!p) return { buff: 1, malus: 1 };
    return { buff: p.buff, malus: p.malus };
  }

  /* ─── Visibility (pour le pick view T1) ─── */
  function isVisible(axId, def, c){
    /* Seul les T1 apparaissent dans le pick view (T2 sont via la progression chosen-view). */
    if ((def.tier || 1) !== 1) return false;
    var k = def.kind;
    if (k === 'neophyte') return false;
    if (k === 'common') return true;
    if (k === 'race_linked') {
      var lock = (def.race_lock || []).map(function(r){ return String(r).toLowerCase(); });
      var race = (c.class || c.race_specific || '').toLowerCase();
      var raceCat = (c.race_category || '').toLowerCase();
      if (!lock.length) return false;
      return lock.indexOf(race) >= 0 || lock.indexOf(raceCat) >= 0;
    }
    if (k === 'special') {
      var names = (def._name_lock || []).map(function(n){ return String(n).trim().toLowerCase(); });
      var fullName = ((c.first_name || '') + ' ' + (c.last_name || '')).trim().toLowerCase();
      return names.indexOf(fullName) >= 0;
    }
    if (k === 'secret') {
      if (!def._prob_secret) return true;
      return rolledSecrets(c).indexOf(axId) >= 0;
    }
    return false;
  }

  function visibleByKind(c){
    var out = { common: [], race_linked: [], secret: [], special: [] };
    Object.keys(STATE.axiomes || {}).forEach(function(id){
      var def = STATE.axiomes[id];
      if (!def) return;
      if (!isVisible(id, def, c)) return;
      if (out[def.kind]) out[def.kind].push(id);
    });
    return out;
  }

  /* ─── Gates ─── */
  /* Sémantique IRRÉVERSIBLE :
       - Initial pick T1 : autorisé si lvl >= 50 et aucun axiome courant.
       - Progression T1 → T2 (puis T2 → T3...) : autorisée gratuitement si le
         target est enfant direct du current et que le niveau requis est atteint.
       - Tout autre choix (changer de T1 quand on a déjà un T1, jump non-linéaire)
         est BLOQUÉ. Le joueur doit Réinitialiser (1 Axium) pour repartir au T0.
  */
  function canChooseAxiome(c, id){
    if (!c) return { ok: false, reason: 'no-char', label: 'PAS DE PERSO' };
    var def = STATE.axiomes && STATE.axiomes[id];
    if (!def) return { ok: false, reason: 'unknown', label: 'AXIOME INCONNU' };
    var lvl = parseInt(c.level || 0, 10) || 0;
    var targetTier = def.tier || 1;
    var requiredLvl = _tierUnlock(targetTier) || MIN_LEVEL;
    if (lvl < requiredLvl) {
      return { ok: false, reason: 'level', label: 'NIVEAU ' + requiredLvl + ' REQUIS (' + lvl + ')' };
    }
    var cur = c.axiome_current || c.axiome || null;
    if (cur === 'neophyte') cur = null;
    /* Pas d'axiome encore : seuls les T1 sont sélectionnables. */
    if (!cur) {
      if (targetTier !== 1) return { ok: false, reason: 'tier', label: 'CHOISIS UN T1 D\'ABORD' };
      return { ok: true };
    }
    /* Déjà un axiome : seul l'enfant direct (next tier) est autorisé. */
    if (def._parent === cur) return { ok: true };
    /* Tout le reste = irréversible. */
    return { ok: false, reason: 'irreversible', label: 'CHOIX IRRÉVERSIBLE · RESET REQUIS' };
  }

  function canReset(c){
    if (!c) return { ok: false, reason: 'no-char' };
    var cur = c.axiome_current || c.axiome || null;
    if (!cur || cur === 'neophyte') return { ok: false, reason: 'nothing-to-reset' };
    if (STATE.axium < SWITCH_COST) return { ok: false, reason: 'axium', label: SWITCH_COST + ' AXIUM REQUIS (' + STATE.axium + ')' };
    return { ok: true };
  }

  /* ═══════════════════════════════════════════════════════════════════
     DATA LOADERS
     ═══════════════════════════════════════════════════════════════════ */
  function loadAxiomes(){
    return fetch('data/axiomes.json?v=2')
      .then(function(r){ if (!r.ok) throw new Error('axiomes HTTP ' + r.status); return r.json(); })
      .then(function(j){
        STATE.data = j;
        STATE.progression = j._progression || null;
        STATE.secretRates = j._secret_rates || null;
        STATE.statLabels = j._stat_labels || {};
        if (j._tier_unlock_levels) STATE.tierUnlockLevels = j._tier_unlock_levels;
        var axiomes = {};
        Object.keys(j).forEach(function(k){ if (k.charAt(0) !== '_') axiomes[k] = j[k]; });
        STATE.axiomes = axiomes;
        /* Si la vue néophyte est déjà affichée, on remplit la grille maintenant */
        if (STATE.activeChar) fillNeophytePreview(STATE.activeChar);
        return axiomes;
      });
  }

  /* ─── Tier helpers ─── */
  function _tierUnlock(tier){
    var lvl = STATE.tierUnlockLevels && STATE.tierUnlockLevels[String(tier)];
    return typeof lvl === 'number' ? lvl : null;
  }

  /* Renvoie les axiomes enfants (tier+1) d'un parent donné. */
  function childrenOf(parentId){
    if (!STATE.axiomes || !parentId) return [];
    return Object.keys(STATE.axiomes).filter(function(id){
      var d = STATE.axiomes[id];
      return d && d._parent === parentId;
    });
  }

  /* Remonte la chaîne T1→T2→... pour un axiome donné. */
  function lineageOf(axId){
    var out = [];
    var cur = axId;
    var safety = 10;
    while (cur && safety-- > 0) {
      out.unshift(cur);
      var d = STATE.axiomes[cur];
      cur = d && d._parent;
    }
    return out;
  }

  function _getDb(){
    if (window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(_) {}
    }
    return null;
  }

  function _getSess(){
    try {
      var raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s._exp && Date.now() > s._exp) return null;
      return s;
    } catch (_) { return null; }
  }

  function _getUid(){
    if (window.UID) return String(window.UID);
    var s = _getSess();
    if (s && s.id) { window.UID = String(s.id); return window.UID; }
    return null;
  }

  async function loadCharacters(){
    var dbref = _getDb();
    var uid = _getUid();
    STATE.noSession = !uid;
    if (!dbref || !uid) { STATE.chars = []; return []; }
    try {
      var snap = await dbref.collection('characters').where('user_id', '==', String(uid)).get();
      var out = [];
      snap.forEach(function(d){
        var data = d.data() || {};
        if (data._init) return;
        out.push(Object.assign({ _id: d.id, id: d.id }, data));
      });
      STATE.chars = out;
      return out;
    } catch (e) {
      console.warn('[axiomes] character fetch failed:', e);
      STATE.chars = [];
      STATE.fetchError = e && e.message ? e.message : 'Erreur réseau';
      return [];
    }
  }

  async function loadAxium(){
    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid) { STATE.axium = 0; return 0; }
    try {
      var snap = await dbref.collection('players').doc(String(uid)).get();
      if (!snap.exists) { STATE.axium = 0; return 0; }
      var data = snap.data() || {};
      var n = parseInt(data.axium, 10);
      STATE.axium = isFinite(n) && n > 0 ? n : 0;
      return STATE.axium;
    } catch (e) {
      console.warn('[axiomes] player fetch failed:', e);
      STATE.axium = 0;
      return 0;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW ROUTER
     ═══════════════════════════════════════════════════════════════════ */
  var PANELS = ['state-loading','state-no-session','state-no-chars','view-neophyte','view-pick','view-chosen'];
  function showView(id){
    PANELS.forEach(function(p){
      var el = document.getElementById(p);
      if (el) el.hidden = (p !== id);
    });
  }

  function routeView(){
    var c = STATE.activeChar;
    if (!c) return;
    var lvl = parseInt(c.level || 0, 10) || 0;
    var cur = c.axiome_current || c.axiome || null;
    if (cur === 'neophyte') cur = null;

    if (STATE.switchMode) {
      renderPickView(c);
      showView('view-pick');
      return;
    }
    if (cur && STATE.axiomes && STATE.axiomes[cur]) {
      renderChosenView(cur);
      showView('view-chosen');
    } else if (lvl < MIN_LEVEL) {
      renderNeophyteView(c);
      showView('view-neophyte');
    } else {
      renderPickView(c);
      showView('view-pick');
    }
  }

  function activateChar(c){
    STATE.activeChar = c;
    STATE.switchMode = false;
    updateCharChip(c);
    routeView();
  }

  /* ─── Char chip ─── */
  function updateCharChip(c){
    var chip = $('#ax-char-chip');
    if (!chip) return;
    if (!c) { chip.hidden = true; return; }
    chip.hidden = false;
    var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Personnage';
    var lvl = parseInt(c.level || 0, 10) || 0;
    var race = c.class || c.race_specific || '—';
    $('#ax-chip-name').textContent = name;
    $('#ax-chip-meta').textContent = 'LVL ' + lvl + ' · ' + race;
    var caret = $('#ax-chip-caret');
    if (caret) caret.style.visibility = (STATE.chars.length > 1) ? '' : 'hidden';
  }

  function renderCharGrid(targetId){
    var grid = document.getElementById(targetId);
    if (!grid) return;
    grid.innerHTML = '';
    STATE.chars.forEach(function(c){
      var card = document.createElement('button');
      card.className = 'ax-char-card';
      card.type = 'button';
      var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Personnage';
      var lvl = parseInt(c.level || 0, 10) || 0;
      var race = c.class || c.race_specific || c.race_category || '—';
      var cur = c.axiome_current || c.axiome || null;
      if (cur === 'neophyte') cur = null;
      var axName = cur && STATE.axiomes && STATE.axiomes[cur] ? STATE.axiomes[cur].name : 'Néophyte · T0';
      var img = c.profile_image || '';
      var portrait = img
        ? '<img src="' + esc(img) + '" alt="" onerror="this.style.display=\'none\'">'
        : '👤';
      card.innerHTML =
        '<div class="ax-char-portrait">' + portrait + '</div>' +
        '<div class="ax-char-name">' + esc(name) + '</div>' +
        '<div class="ax-char-meta">LVL ' + lvl + ' · ' + esc(race) + '</div>' +
        '<div class="ax-char-axiome">' + esc(axName) + '</div>';
      card.addEventListener('click', function(){
        closeAllModals();
        activateChar(c);
      });
      grid.appendChild(card);
    });
  }

  function openCharSwitchModal(){
    if (STATE.chars.length <= 1) return;
    renderCharGrid('charswitch-grid');
    $('#charswitch-modal').hidden = false;
  }

  /* ═══════════════════════════════════════════════════════════════════
     NÉOPHYTE VIEW
     ═══════════════════════════════════════════════════════════════════ */
  function renderNeophyteView(c){
    var lvl = parseInt(c.level || 0, 10) || 0;
    var pct = Math.max(2, Math.min(100, Math.round((lvl / MIN_LEVEL) * 100)));
    $('#lvl-fill').style.width = pct + '%';
    $('#lvl-label').textContent = lvl + ' / ' + MIN_LEVEL;

    fillNeophytePreview(c);
  }

  function fillNeophytePreview(c){
    var previewGrid = document.getElementById('grid-neophyte-preview');
    if (!previewGrid) return;
    previewGrid.innerHTML = '';
    var ax = STATE.axiomes || {};
    var commonT1 = Object.keys(ax).filter(function(id){
      var d = ax[id];
      return d && d.tier === 1 && d.kind === 'common';
    });
    if (!commonT1.length) return;
    commonT1.sort(function(a, b){
      return (ax[a].name || '').localeCompare(ax[b].name || '', 'fr');
    });
    commonT1.forEach(function(id){
      var d = ax[id];
      var card = document.createElement('button');
      card.className = 'ax-card';
      card.type = 'button';
      card.dataset.id = id;
      card.innerHTML =
        '<div class="ax-card-emoji">' + esc(d.emoji || '⚜️') + '</div>' +
        '<div class="ax-card-name">' + esc(d.name || id) + '</div>' +
        '<div class="ax-card-meta">COMMUN · TIER 1</div>' +
        '<div class="ax-card-identity">' + esc(d.identity || '') + '</div>';
      card.addEventListener('click', function(){ openAxiomeModal(id); });
      previewGrid.appendChild(card);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     PICK VIEW
     ═══════════════════════════════════════════════════════════════════ */
  function renderPickView(c){
    var eyebrow = $('#pick-eyebrow');
    var title   = $('#pick-title');
    var desc    = $('#pick-desc');
    var emoji   = $('#pick-emoji');

    if (STATE.switchMode) {
      eyebrow.textContent = '// CHANGEMENT D\'AXIOME · COÛT ' + SWITCH_COST + ' AXIUM';
      title.textContent = 'Change ta voie';
      emoji.textContent = '⇄';
      var canSwitch = STATE.axium >= SWITCH_COST;
      desc.innerHTML =
        'Solde Axium : <strong>' + STATE.axium + '</strong>. ' +
        (canSwitch
          ? 'Choisir un axiome ci-dessous va dépenser <strong>1 Axium</strong>. Tu conserves ton Tier actuel.'
          : '<span style="color:var(--red)">Tu n\'as pas assez d\'Axium pour switcher.</span>') +
        ' <button type="button" id="cancel-switch" style="background:transparent;border:1px solid var(--gold-dim);color:var(--gold-2);padding:4px 12px;cursor:pointer;font-family:inherit;font-size:0.8rem;letter-spacing:0.18em;text-transform:uppercase;margin-left:10px">↩ Annuler</button>';
    } else {
      eyebrow.textContent = '// TIER 1 · CHOIX D\'AXIOME';
      title.textContent = 'Choisis ta voie';
      emoji.textContent = '◆';
      desc.innerHTML = 'Tu as atteint le niveau <strong>50</strong>. Choisis un Axiome T1 ci-dessous. Changer ensuite coûte <strong>1 Axium</strong>.';
    }

    var byKind = visibleByKind(c);

    fillGrid('grid-common',  byKind.common,      c);
    fillGrid('grid-race',    byKind.race_linked, c);
    fillGrid('grid-secret',  byKind.secret,      c);
    fillGrid('grid-special', byKind.special,     c);

    $('#section-race').hidden = !byKind.race_linked.length;
    $('#section-secret').hidden = !byKind.secret.length;
    $('#section-special').hidden = !byKind.special.length;
  }

  function fillGrid(gridId, ids, c){
    var grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    ids.sort(function(a, b){ return (STATE.axiomes[a].name || '').localeCompare(STATE.axiomes[b].name || '', 'fr'); });
    if (!ids.length) {
      grid.innerHTML = '<div class="ax-section-sub" style="grid-column:1/-1">Aucun axiome dans cette catégorie.</div>';
      return;
    }
    ids.forEach(function(id){ grid.appendChild(makeCard(id, c)); });
  }

  function makeCard(id, c){
    var d = STATE.axiomes[id];
    var card = document.createElement('button');
    card.className = 'ax-card';
    card.type = 'button';
    card.dataset.id = id;
    if (d.kind === 'secret' || d.kind === 'special') card.classList.add('is-secret');
    var cur = c && (c.axiome_current || c.axiome);
    if (cur && cur === id) card.classList.add('is-active');

    var kindTxt = d.kind === 'secret' ? 'SECRET'
                : d.kind === 'special' ? 'SPÉCIAL'
                : d.kind === 'race_linked' ? 'RACE-LOCK'
                : 'COMMUN';

    var tag = '';
    if (cur && cur === id) tag = '<span class="ax-card-tag">ACTIF</span>';
    else if (d.kind === 'special') tag = '<span class="ax-card-tag">NAME-LOCK</span>';
    else if (d.kind === 'race_linked') tag = '<span class="ax-card-tag">RACE-LOCK</span>';
    else if (d.kind === 'secret') tag = '<span class="ax-card-tag">RARE ✦</span>';

    card.innerHTML =
      tag +
      '<div class="ax-card-emoji">' + esc(d.emoji || '⚜️') + '</div>' +
      '<div class="ax-card-name">' + esc(d.name || id) + '</div>' +
      '<div class="ax-card-meta">' + kindTxt + ' · TIER ' + (d.tier || 1) + '</div>';

    card.addEventListener('click', function(){ openAxiomeModal(id); });
    return card;
  }

  /* ═══════════════════════════════════════════════════════════════════
     CHOSEN VIEW
     ═══════════════════════════════════════════════════════════════════ */
  function renderChosenView(curId){
    var c = STATE.activeChar;
    var d = STATE.axiomes[curId];
    if (!d) return;

    var tier = d.tier || 1;
    var mults = getMultipliers(d, tier);

    /* Lineage breadcrumb : T1 > T2 > ... */
    var lin = lineageOf(curId);
    var lineageTxt = lin.length > 1
      ? lin.map(function(lid){ var ld = STATE.axiomes[lid]; return (ld && ld.name) || lid; }).join(' › ')
      : null;

    $('#active-eyebrow').textContent = '// AXIOME ACTIF · TIER ' + tier
      + (lineageTxt ? ' · ' + lineageTxt.toUpperCase() : '');
    $('#active-emoji').textContent = d.emoji || '⚜️';
    $('#active-name').textContent = d.name || curId;

    /* Kind hérité du parent si T2+ */
    var rootDef = STATE.axiomes[lin[0]] || d;
    var k = d.kind || rootDef.kind;
    var kindTxt = k === 'secret' ? 'SECRET'
                : k === 'special' ? 'SPÉCIAL'
                : k === 'race_linked' ? 'RACE-LOCK'
                : 'COMMUN';
    var raceLock = d.race_lock || rootDef.race_lock || [];
    var raceLockTxt = raceLock.length ? ' · ' + raceLock.join(' / ') : '';
    $('#active-meta').textContent = kindTxt + ' · ' + (d.identity || '') + raceLockTxt;
    $('#active-desc').textContent = d.description || '';

    /* Buff / malus display */
    var modsEl = $('#active-mods');
    if (d.buff_stat && d.malus_stat) {
      modsEl.hidden = false;
      $('#active-buff-stat').textContent = (STATE.statLabels[d.buff_stat] || d.buff_stat).toUpperCase();
      $('#active-buff-value').textContent = '×' + mults.buff.toFixed(2);
      $('#active-malus-stat').textContent = (STATE.statLabels[d.malus_stat] || d.malus_stat).toUpperCase();
      $('#active-malus-value').textContent = '×' + mults.malus.toFixed(2);
    } else {
      modsEl.hidden = true;
    }

    /* Forge button : URL avec ?char=<id> pour aligner la forge sur le char actif
       de cette page (pas forcément l'active_characters global). */
    var forgeBtn = $('#active-forge-btn');
    var cid = c && (c._id || c.id);
    if (forgeBtn) {
      forgeBtn.setAttribute('href', cid ? 'forge.html?char=' + encodeURIComponent(cid) : 'forge.html');
    }

    /* DarkNexusNet button : visible uniquement si Hacker ou Encodeur */
    var darknetBtn = $('#active-darknet-btn');
    if (darknetBtn) {
      var isHackerOrEncodeur = curId === 'hacker' || curId === 'encodeur';
      darknetBtn.hidden = !isHackerOrEncodeur;
      if (isHackerOrEncodeur) {
        darknetBtn.setAttribute('href', cid ? 'darknexusnet.html?char=' + encodeURIComponent(cid) : 'darknexusnet.html');
      }
    }

    /* Brassage button : visible si Potionniste ou Druide */
    var brassageBtn = $('#active-brassage-btn');
    if (brassageBtn) {
      var hasBrassage = curId === 'potionniste' || curId === 'druide';
      brassageBtn.hidden = !hasBrassage;
      if (hasBrassage) {
        brassageBtn.setAttribute('href', cid ? 'brassage.html?char=' + encodeURIComponent(cid) : 'brassage.html');
      }
    }

    /* Sanctuaire button : visible pour tous (chacun peut prier) */
    var sanctuaireBtn = $('#active-sanctuaire-btn');
    if (sanctuaireBtn) {
      sanctuaireBtn.setAttribute('href', cid ? 'sanctuaire.html?char=' + encodeURIComponent(cid) : 'sanctuaire.html');
    }

    /* Singularité button : visible pour tous (cap = 3 ou illimité selon axiome) */
    var singBtn = $('#active-singularite-btn');
    if (singBtn) {
      singBtn.setAttribute('href', cid ? 'singularite.html?char=' + encodeURIComponent(cid) : 'singularite.html');
    }

    /* Switch / Reset button (gated on axium) */
    var switchBtn = $('#active-switch-btn');
    var switchLabel = $('#active-switch-label');
    if (STATE.axium >= SWITCH_COST) {
      switchBtn.disabled = false;
      switchLabel.textContent = 'Réinitialiser au Tier 0 · ' + SWITCH_COST + ' Axium (solde : ' + STATE.axium + ')';
    } else {
      switchBtn.disabled = true;
      switchLabel.textContent = '🔒 Reset requiert ' + SWITCH_COST + ' Axium (solde : ' + STATE.axium + ')';
    }

    /* Tree section */
    renderTreeSection(curId, d);

    /* Progression vers tier suivant */
    renderProgressionSection(c, curId, d);
  }

  /* Affiche la section "Évolue vers Tier X+1" si applicable. */
  function renderProgressionSection(c, curId, def){
    /* Cleanup ancien container progression */
    var oldEl = document.getElementById('section-progression');
    if (oldEl) oldEl.remove();

    var lvl = parseInt(c.level || 0, 10) || 0;
    var curTier = def.tier || 1;
    var nextTier = curTier + 1;
    var requiredLvl = _tierUnlock(nextTier);
    if (!requiredLvl) return; /* tier max atteint */

    var children = childrenOf(curId);
    if (!children.length) return; /* pas de T+1 défini pour cet axiome */

    /* Crée la section */
    var section = document.createElement('section');
    section.className = 'ax-section';
    section.id = 'section-progression';

    var head = '<header class="ax-section-head">' +
      '<span class="ax-section-line"></span>' +
      '<h3 class="ax-section-title">Évolue vers Tier ' + nextTier + '</h3>' +
      '<span class="ax-section-line"></span></header>';

    var canProgress = lvl >= requiredLvl;
    var sub = canProgress
      ? '<p class="ax-section-sub">Choisis une branche (irréversible — reset 1 Axium pour changer).</p>'
      : '<p class="ax-section-sub">Niveau ' + requiredLvl + ' requis (actuel : ' + lvl + ').</p>';

    section.innerHTML = head + sub + '<div class="ax-grid" id="grid-progression"></div>';

    /* Insère après la section tree */
    var anchor = document.getElementById('section-tree');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(section, anchor.nextSibling);
    } else {
      $('#view-chosen').appendChild(section);
    }

    var grid = section.querySelector('#grid-progression');
    children.forEach(function(childId){
      grid.appendChild(makeProgressionCard(childId, c, canProgress));
    });
  }

  function makeProgressionCard(id, c, enabled){
    var d = STATE.axiomes[id];
    var card = document.createElement('button');
    card.className = 'ax-card';
    card.type = 'button';
    card.dataset.id = id;
    if (!enabled) card.classList.add('is-locked');

    var card_meta = 'TIER ' + (d.tier || 2);
    if (d._special_effect) card_meta += ' · SPÉCIAL';

    card.innerHTML =
      '<div class="ax-card-emoji">' + esc(d.emoji || '⚜️') + '</div>' +
      '<div class="ax-card-name">' + esc(d.name || id) + '</div>' +
      '<div class="ax-card-meta">' + card_meta + '</div>';
    card.addEventListener('click', function(){
      if (!enabled) return;
      openAxiomeModal(id);
    });
    return card;
  }

  /* ═══════════════════════════════════════════════════════════════════
     TREE RENDER + UNLOCK
     ═══════════════════════════════════════════════════════════════════ */
  function _getUnlockedSet(c){
    var u = (c && c.axiome_tree_unlocked) || {};
    return new Set(Object.keys(u).filter(function(k){ return u[k]; }));
  }

  function _nodeState(node, unlockedSet){
    if (unlockedSet.has(node.id)) return 'unlocked';
    var reqs = node.requires || [];
    if (!reqs.length) return 'available';
    /* `requires_mode: "any"` autorise le déblocage dès qu'UN prérequis est satisfait
       (ex: avant_garde.sacrifice-calibre requires taunt OU brace). Sinon = tous (AND). */
    var mode = node.requires_mode || 'all';
    var ok = mode === 'any'
      ? reqs.some(function(r){ return unlockedSet.has(r); })
      : reqs.every(function(r){ return unlockedSet.has(r); });
    return ok ? 'available' : 'locked';
  }

  function renderTreeSection(axId, def){
    var c = STATE.activeChar;
    var grid = $('#tree-grid');
    var emptyEl = $('#tree-empty');
    var emptyDetail = $('#tree-empty-detail');
    var paValue = $('#ax-pa-value');

    var pa = parseInt((c && c.axiome_pa) || 0, 10) || 0;
    paValue.textContent = pa;

    /* Clean previous extra-tier subsections */
    document.querySelectorAll('.ax-tree-tier-extra').forEach(function(el){ el.remove(); });

    /* Construit l'ordre d'affichage : tier courant en HAUT, parents en dessous. */
    var lineage = lineageOf(axId);      /* [T1, T2, ...] */
    var displayOrder = lineage.slice().reverse(); /* [T2, T1] = courant -> parents */

    /* Cas no-tree pour l'axiome COURANT seulement */
    var hasAnyTree = displayOrder.some(function(id){
      var dd = STATE.axiomes[id];
      return dd && dd.tree && dd.tree.nodes && dd.tree.nodes.length;
    });

    if (!hasAnyTree) {
      grid.innerHTML = '';
      grid.hidden = true;
      emptyEl.hidden = false;
      var detail = def._special_effect || (def._narrative ? 'Effets narratifs uniquement.' : '');
      var detailMap = {
        'unlock_stat_aura': 'Effet spécial : débloque la stat Aura.',
        'sell_golden_eggs_in_shop': 'Effet spécial : peut vendre ses Golden Eggs dans son shop.',
        'special_slots_+2': 'Effet spécial : +2 slots items Spécial via tree.',
        'unlock_benediction_menu': 'Effet spécial : accès au menu Bénédiction.',
        'unlock_forge_menu': 'Effet spécial : accès au menu Forge.',
        'unlock_brassage_menu': 'Effet spécial : accès au menu Brassage (Potions).',
        'unlock_darknexusnet_hacker': 'Effet spécial : accès au DarkNexusNet + hacking bancaire.',
        'unlock_darknexusnet_encodeur': 'Effet spécial : accès au DarkNexusNet + craft Puce anti-hack.',
        'unlock_amelioration_runique': 'Effet spécial : Amélioration Runique (ajoute une stat à un item).',
        'companions_active_2': 'Effet spécial : 2 compagnons synchronisés simultanément.',
        'companions_unlimited_no_items': 'Effet spécial : compagnons illimités, items équipables verrouillés.',
        'companion_buffs_x2': 'Effet spécial : buffs des compagnons appliqués ×2.',
        'hands_slots_+2': 'Effet spécial : +2 slots Mains.'
      };
      emptyDetail.textContent = detailMap[detail] || (def._narrative ? 'Axiome narratif — pas d\'arbre de compétences.' : 'Cet axiome ne dispose pas encore d\'un Axiome Tree défini.');
      return;
    }

    grid.hidden = false;
    emptyEl.hidden = true;

    /* Rend le tree de l'axiome courant dans #tree-grid (slot principal) */
    grid.innerHTML = '';
    var currentId = displayOrder[0];
    var currentDef = STATE.axiomes[currentId];
    if (currentDef && currentDef.tree && currentDef.tree.nodes && currentDef.tree.nodes.length) {
      _renderNodesInto(grid, currentId, currentDef, c);
    } else {
      grid.innerHTML = '<div class="ax-section-sub" style="grid-column:1/-1">Axiome courant sans tree — capacité spéciale.</div>';
    }

    /* Pour chaque tier parent (T2 puis T1...), crée un sous-bloc "Tier précédent" */
    var section = $('#section-tree');
    displayOrder.slice(1).forEach(function(parentId){
      var pDef = STATE.axiomes[parentId];
      if (!pDef || !pDef.tree || !pDef.tree.nodes || !pDef.tree.nodes.length) return;

      var sub = document.createElement('div');
      sub.className = 'ax-tree-tier-extra';
      sub.innerHTML =
        '<header class="ax-tree-tier-head">' +
          '<span class="ax-tree-tier-line"></span>' +
          '<h4 class="ax-tree-tier-title">Tier ' + (pDef.tier || 1) + ' · ' + esc(pDef.name) + '</h4>' +
          '<span class="ax-tree-tier-line"></span>' +
        '</header>' +
        '<p class="ax-tree-tier-sub">Tiers précédents — toujours débloquables.</p>' +
        '<div class="ax-tree-grid" data-tier-grid="' + esc(parentId) + '"></div>';
      section.appendChild(sub);

      var subGrid = sub.querySelector('[data-tier-grid="' + parentId + '"]');
      _renderNodesInto(subGrid, parentId, pDef, c);
    });
  }

  /* Rend les nodes d'un tier donné dans un container. */
  function _renderNodesInto(grid, axId, def, c){
    var nodes = def.tree.nodes;
    var unlockedSet = _getUnlockedSet(c);
    var nodesById = {};
    nodes.forEach(function(n){ nodesById[n.id] = n; });

    nodes.forEach(function(node){
      var state = _nodeState(node, unlockedSet);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ax-tree-node is-' + state;
      btn.dataset.id = node.id;

      var stateLabel = state === 'unlocked' ? '✓ DÉBLOQUÉ'
                    : state === 'available' ? 'DISPONIBLE'
                    : '🔒 VERROUILLÉ';

      var reqText = (node.requires || []).length
        ? (node.requires || []).map(function(r){ return (nodesById[r] && nodesById[r].name) || r; }).join(' · ')
        : '—';

      var costText = node.cost === 0 ? 'GRATUIT' : (node.cost + ' PA');

      btn.innerHTML =
        '<div class="ax-tree-node-head">' +
          '<span class="ax-tree-node-glyph">◆</span>' +
          '<span class="ax-tree-node-name">' + esc(node.name) + '</span>' +
          '<span class="ax-tree-node-state">' + stateLabel + '</span>' +
        '</div>' +
        '<div class="ax-tree-node-effect">' + renderEffectsCompact(node) + '</div>' +
        '<div class="ax-tree-node-foot">' +
          '<span class="ax-tree-node-cost">' + costText + '</span>' +
          '<span class="ax-tree-node-req" title="' + esc(reqText) + '">Req : ' + esc(reqText) + '</span>' +
        '</div>';

      btn.addEventListener('click', function(){ openNodeModal(axId, node); });
      grid.appendChild(btn);
    });
  }

  function openNodeModal(axId, node){
    var c = STATE.activeChar;
    var pa = parseInt((c && c.axiome_pa) || 0, 10) || 0;
    var unlockedSet = _getUnlockedSet(c);
    var state = _nodeState(node, unlockedSet);

    STATE.modalNodeId = node.id;

    $('#n-eyebrow').textContent = '// ARBRE D\'AXIOME · NOEUD';
    $('#n-emoji').textContent = state === 'unlocked' ? '✓' : '◆';
    $('#n-title').textContent = node.name;
    $('#n-state').textContent = state === 'unlocked' ? 'DÉBLOQUÉ'
                              : state === 'available' ? 'DISPONIBLE'
                              : 'VERROUILLÉ';
    /* Multi-effets + flavor text — innerHTML car renderEffectsDetailed renvoie du HTML déjà escapé */
    var effHtml = renderEffectsDetailed(node);
    if (node.flavor) {
      effHtml += '<div class="ax-eff-flavor"><em>' + esc(node.flavor) + '</em></div>';
    }
    $('#n-effect').innerHTML = effHtml;

    $('#n-cost').textContent = node.cost === 0 ? 'Gratuit' : (node.cost + ' PA');
    $('#n-pa').textContent = pa + ' PA';

    var nodesById = {};
    var ax = STATE.axiomes[axId];
    if (ax && ax.tree) ax.tree.nodes.forEach(function(n){ nodesById[n.id] = n; });
    var reqText = (node.requires || []).length
      ? (node.requires || []).map(function(r){ return (nodesById[r] && nodesById[r].name) || r; }).join(' · ')
      : '—';
    $('#n-req').textContent = reqText;

    var btn = $('#n-unlock-btn');
    var lbl = $('#n-unlock-label');
    if (state === 'unlocked') {
      lbl.textContent = '✓ Déjà débloqué';
      btn.disabled = true;
    } else if (state === 'locked') {
      lbl.textContent = '🔒 Prérequis manquant';
      btn.disabled = true;
    } else if (pa < node.cost) {
      lbl.textContent = '🔒 PA insuffisants (' + pa + '/' + node.cost + ')';
      btn.disabled = true;
    } else {
      lbl.textContent = 'Débloquer (' + node.cost + ' PA)';
      btn.disabled = false;
    }

    $('#node-modal').hidden = false;
  }

  async function unlockNode(){
    var c = STATE.activeChar;
    var nodeId = STATE.modalNodeId;
    if (!c || !nodeId) { closeAllModals(); return; }

    /* Le node peut appartenir à n'importe quel tier du lineage (tiers précédents
       restent débloquables). On cherche le node dans tout le lineage. */
    var curId = c.axiome_current;
    var lineage = lineageOf(curId);
    var node = null;
    for (var i = 0; i < lineage.length; i++) {
      var dd = STATE.axiomes[lineage[i]];
      if (!dd || !dd.tree) continue;
      var found = dd.tree.nodes.find(function(n){ return n.id === nodeId; });
      if (found) { node = found; break; }
    }
    if (!node) { closeAllModals(); return; }

    /* Re-check state server-side semantics */
    var unlockedSet = _getUnlockedSet(c);
    var state = _nodeState(node, unlockedSet);
    var pa = parseInt(c.axiome_pa || 0, 10) || 0;
    if (state !== 'available' || pa < node.cost) {
      console.warn('[axiomes] unlock blocked', { state: state, pa: pa, cost: node.cost });
      closeAllModals();
      return;
    }

    var dbref = _getDb();
    var charId = c._id || c.id;
    if (!dbref || !charId) { closeAllModals(); return; }

    /* Optimistic update */
    var prevPa = c.axiome_pa || 0;
    var prevUnlocked = Object.assign({}, c.axiome_tree_unlocked || {});
    var prevStats = Object.assign({}, c.stats || {});
    var prevAuraEnabled = c.aura_enabled;
    c.axiome_pa = pa - node.cost;
    c.axiome_tree_unlocked = Object.assign({}, prevUnlocked);
    c.axiome_tree_unlocked[node.id] = true;

    /* Build update payload */
    var updates = {
      axiome_pa: c.axiome_pa,
      axiome_tree_unlocked: c.axiome_tree_unlocked,
      updated_at: new Date().toISOString()
    };

    /* ── Cas spéciaux : effets immédiats au déblocage ──
       Cultivator root : débloque la stat AURA (init à 1 si pas déjà active). */
    if (node.id === 'cultivator.root') {
      var curStats = c.stats || {};
      var curAura = parseInt(curStats.aura || 0, 10) || 0;
      if (curAura <= 0) {
        c.stats = Object.assign({}, curStats, { aura: 1 });
        updates.stats = c.stats;
      }
      c.aura_enabled = true;
      updates.aura_enabled = true;
    }

    closeAllModals();
    routeView();

    try {
      await dbref.collection('characters').doc(String(charId)).update(updates);
    } catch (e) {
      console.error('[axiomes] unlock persist failed, rollback', e);
      c.axiome_pa = prevPa;
      c.axiome_tree_unlocked = prevUnlocked;
      c.stats = prevStats;
      c.aura_enabled = prevAuraEnabled;
      routeView();
      flashToast('⚠ Déblocage refusé : ' + (e.message || 'erreur'), 'error');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     AXIOME MODAL
     ═══════════════════════════════════════════════════════════════════ */
  function openAxiomeModal(id){
    var d = STATE.axiomes && STATE.axiomes[id];
    if (!d) return;
    var c = STATE.activeChar;
    STATE.modalAxId = id;

    var tier = d.tier || 1;
    var mults = getMultipliers(d, tier);

    var kindTxt = d.kind === 'secret' ? 'SECRET'
                : d.kind === 'special' ? 'SPÉCIAL'
                : d.kind === 'race_linked' ? 'RACE-LOCK'
                : 'COMMUN';

    $('#m-eyebrow').textContent = '// AXIOME · TIER ' + tier;
    $('#m-emoji').textContent = d.emoji || '⚜️';
    $('#m-title').textContent = d.name || id;
    $('#m-kind').textContent = kindTxt;
    $('#m-desc').textContent = (d.identity || '') + (d.description ? ' — ' + d.description : '');

    $('#m-buff').textContent  = d.buff_stat  ? (STATE.statLabels[d.buff_stat]  || d.buff_stat).toUpperCase()  + ' ×' + mults.buff.toFixed(2)  : '—';
    $('#m-malus').textContent = d.malus_stat ? (STATE.statLabels[d.malus_stat] || d.malus_stat).toUpperCase() + ' ×' + mults.malus.toFixed(2) : '—';
    var raceText = (d.race_lock || []).join(' · ');
    if (!raceText && d._name_lock && d._name_lock.length) raceText = 'NAME-LOCK';
    else if (!raceText && d._prob_secret) raceText = 'PROBABILISTE';
    $('#m-race').textContent = raceText || '—';

    /* Choose button — label dépend du contexte (initial pick vs progression vs blocked) */
    var chooseBtn = $('#m-choose-btn');
    var chooseLabel = $('#m-choose-label');
    var alreadyChosen = c && (c.axiome_current === id || c.axiome === id);
    var cur = c && (c.axiome_current || c.axiome);
    if (cur === 'neophyte') cur = null;
    if (alreadyChosen) {
      chooseLabel.textContent = '✓ Déjà actif';
      chooseBtn.disabled = true;
    } else {
      var gate = canChooseAxiome(c, id);
      if (!gate.ok) {
        chooseLabel.textContent = '🔒 ' + gate.label;
        chooseBtn.disabled = true;
      } else {
        var isProgression = cur && d._parent === cur;
        if (isProgression) {
          chooseLabel.textContent = 'Évoluer vers ' + (d.name || id) + ' · gratuit';
        } else {
          chooseLabel.textContent = 'Choisir cet axiome';
        }
        chooseBtn.disabled = false;
      }
    }

    $('#ax-modal').hidden = false;
  }

  function closeAllModals(){
    $$('.ax-modal').forEach(function(m){ m.hidden = true; });
    STATE.modalAxId = null;
  }

  /* ═══════════════════════════════════════════════════════════════════
     CHOOSE / PERSIST
     ═══════════════════════════════════════════════════════════════════ */
  async function chooseAxiome(id){
    var c = STATE.activeChar;
    if (!c) { closeAllModals(); return; }

    var gate = canChooseAxiome(c, id);
    if (!gate.ok) { console.warn('[axiomes] choose blocked:', gate); closeAllModals(); return; }

    var dbref = _getDb();
    var charId = c._id || c.id;
    if (!dbref || !charId) { console.warn('[axiomes] no db/charId'); closeAllModals(); return; }

    var def = STATE.axiomes[id];
    var cur = c.axiome_current || null;
    var isProgression = cur && def && def._parent === cur;

    /* Progression T1 → T2 : on conserve axiome_tree_unlocked (les nodes du parent restent).
       Initial pick (T1) : tree_unlocked reset à {} (rien à conserver). */
    var prev = c.axiome_current || null;
    var prevUnlocked = c.axiome_tree_unlocked || {};
    c.axiome_current = id;
    if (!isProgression) c.axiome_tree_unlocked = {};
    closeAllModals();
    routeView();

    try {
      var update = {
        axiome_current: id,
        updated_at: new Date().toISOString()
      };
      if (!isProgression) update.axiome_tree_unlocked = {};
      await dbref.collection('characters').doc(String(charId)).update(update);
    } catch (e) {
      console.error('[axiomes] persist failed, rollback', e);
      c.axiome_current = prev;
      c.axiome_tree_unlocked = prevUnlocked;
      routeView();
      flashToast('⚠ Sauvegarde refusée : ' + (e.message || 'erreur'), 'error');
    }
  }

  /* RESET : 1 Axium = retour au T0 (Néophyte). Tree complet réinitialisé. */
  async function resetAxiome(){
    var c = STATE.activeChar;
    if (!c) { closeAllModals(); return; }
    var gate = canReset(c);
    if (!gate.ok) {
      flashToast(gate.label || '⚠ Reset impossible', 'error');
      closeAllModals();
      return;
    }
    var dbref = _getDb();
    var charId = c._id || c.id;
    if (!dbref || !charId) { closeAllModals(); return; }

    /* Optimistic */
    var prev = c.axiome_current;
    var prevUnlocked = c.axiome_tree_unlocked || {};
    c.axiome_current = null;
    c.axiome_tree_unlocked = {};
    closeAllModals();
    routeView();

    try {
      await dbref.collection('characters').doc(String(charId)).update({
        axiome_current: null,
        axiome_tree_unlocked: {},
        updated_at: new Date().toISOString()
      });
      /* Note : débit Axium côté bot (à implémenter dans la routine Discord). */
      flashToast('Axiome réinitialisé au Tier 0.', 'info');
    } catch (e) {
      console.error('[axiomes] reset failed, rollback', e);
      c.axiome_current = prev;
      c.axiome_tree_unlocked = prevUnlocked;
      routeView();
      flashToast('⚠ Reset refusé : ' + (e.message || 'erreur'), 'error');
    }
  }

  function flashToast(msg, kind){
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);' +
      'padding:12px 22px;font-family:Rajdhani,sans-serif;font-weight:600;font-size:0.85rem;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'background:rgba(7,9,15,0.95);border:1px solid ' + (kind === 'error' ? '#e7484b' : '#c9a961') +
      ';color:' + (kind === 'error' ? '#e7484b' : '#e8c876') +
      ';z-index:2000;box-shadow:0 10px 30px rgba(0,0,0,0.6);';
    document.body.appendChild(t);
    setTimeout(function(){ try { t.remove(); } catch(_){} }, 4500);
  }

  /* ═══════════════════════════════════════════════════════════════════
     CODEX — accordéon T1 → T2 → T3
     ═══════════════════════════════════════════════════════════════════ */
  function openCodex(){
    var modal = document.getElementById('codex-modal');
    if (!modal) return;
    var body = document.getElementById('codex-body');
    if (!body) return;
    if (!STATE.axiomes || !Object.keys(STATE.axiomes).length) {
      body.innerHTML = '<div class="ax-codex-empty">Chargement…</div>';
      modal.hidden = false;
      loadAxiomes().then(function(){ _buildCodex(body, ''); });
      return;
    }
    _buildCodex(body, '');
    modal.hidden = false;
    var search = document.getElementById('codex-search');
    if (search) {
      search.value = '';
      search.oninput = function(){ _buildCodex(body, search.value.trim().toLowerCase()); };
      setTimeout(function(){ search.focus(); }, 80);
    }
  }

  function _buildCodex(body, filter){
    var ax = STATE.axiomes || {};
    var labels = STATE.statLabels || {};
    var groups = { common: [], race_linked: [], secret: [], special: [] };
    var neo = ax['neophyte'];
    Object.keys(ax).forEach(function(id){
      var d = ax[id];
      if (!d || d.tier !== 1) return;
      var k = d.kind || 'common';
      if (groups[k]) groups[k].push(id);
    });
    ['common','race_linked','secret','special'].forEach(function(g){
      groups[g].sort(function(a,b){ return (ax[a].name||'').localeCompare(ax[b].name||'','fr'); });
    });
    var LABELS = { common:'AXIOMES COMMUNS', race_linked:'AXIOMES RACE-LINKED', secret:'AXIOMES SECRETS ✦', special:'AXIOMES SPÉCIAUX ◆' };
    var h = '';
    /* Néophyte — pas de clic, pas d'enfants */
    if (neo && _cdxMatch('neophyte', neo, filter)){
      h += '<div class="ax-codex-card ax-cdx-t0">' + _cdxInner('neophyte', neo, 0, labels, false) + '</div>';
    }
    Object.keys(groups).forEach(function(g){
      var ids = groups[g];
      if (!ids.length) return;
      var sec = '';
      ids.forEach(function(t1Id){ sec += _cdxT1(t1Id, ax, labels, filter); });
      if (!sec) return;
      h += '<div class="ax-codex-section"><span>' + LABELS[g] + '</span></div>' + sec;
    });
    body.innerHTML = h || '<div class="ax-codex-empty">Aucun axiome trouvé.</div>';
  }

  function _cdxT1(t1Id, ax, labels, filter){
    var d = ax[t1Id];
    if (!d) return '';
    var t2s = childrenOf(t1Id).sort(function(a,b){ return (ax[a].name||'').localeCompare(ax[b].name||'','fr'); });
    /* Build T2 children */
    var t2Html = '';
    t2s.forEach(function(t2Id){ t2Html += _cdxT2(t2Id, ax, labels, filter); });
    /* Filter: include if T1 itself matches OR any T2/T3 child matches */
    if (!_cdxMatch(t1Id, d, filter) && !t2Html) return '';
    var open = filter ? ' open' : '';
    var childrenBlock = t2Html
      ? ('<div class="ax-cdx-children">' + t2Html + '</div>')
      : '<div class="ax-cdx-children ax-cdx-leaf"><span>Aucune évolution T2 définie.</span></div>';
    return '<details class="ax-cdx-details"' + open + '>'
      + '<summary class="ax-codex-card ax-cdx-t1">' + _cdxInner(t1Id, d, 1, labels, true) + '</summary>'
      + childrenBlock
      + '</details>';
  }

  function _cdxT2(t2Id, ax, labels, filter){
    var d = ax[t2Id];
    if (!d) return '';
    var t3s = childrenOf(t2Id).sort(function(a,b){ return (ax[a].name||'').localeCompare(ax[b].name||'','fr'); });
    /* Build T3 children (plain divs — pas cliquables) */
    var t3Html = '';
    t3s.forEach(function(t3Id){
      var d3 = ax[t3Id];
      if (!d3 || !_cdxMatch(t3Id, d3, filter)) return;
      t3Html += '<div class="ax-codex-card ax-cdx-t3">' + _cdxInner(t3Id, d3, 3, labels, false) + '</div>';
    });
    if (!_cdxMatch(t2Id, d, filter) && !t3Html) return '';
    var open = filter ? ' open' : '';
    /* T2 avec enfants T3 → details/summary ; sans enfants → div simple */
    if (t3s.length) {
      return '<details class="ax-cdx-details ax-cdx-t2-details"' + open + '>'
        + '<summary class="ax-codex-card ax-cdx-t2">' + _cdxInner(t2Id, d, 2, labels, true) + '</summary>'
        + (t3Html ? '<div class="ax-cdx-children">' + t3Html + '</div>' : '')
        + '</details>';
    }
    return '<div class="ax-codex-card ax-cdx-t2 ax-cdx-leaf-card">' + _cdxInner(t2Id, d, 2, labels, false) + '</div>';
  }

  function _cdxMatch(id, d, filter){
    if (!filter) return true;
    if (!d) return false;
    return (d.name||'').toLowerCase().indexOf(filter) >= 0
        || (d.identity||'').toLowerCase().indexOf(filter) >= 0
        || id.toLowerCase().indexOf(filter) >= 0;
  }

  /* Contenu interne d'une carte (utilisé dans summary ET dans div) */
  function _cdxInner(id, d, tier, labels, hasChevron){
    var kind = d.kind || 'common';
    var tierLabel = tier === 0 ? 'T0' : 'T' + tier;

    /* Badge kind — T1 uniquement (T2/T3 ne sont pas floqués COMMUN) */
    var kindBadge = '';
    if (tier <= 1) {
      var kindMap = { common:'COMMUN', race_linked:'RACE-LOCK', secret:'SECRET', special:'SPÉCIAL', neophyte:'TRONC COMMUN' };
      var kindCls = { common:'ax-ckind-common', race_linked:'ax-ckind-race', secret:'ax-ckind-secret', special:'ax-ckind-special', neophyte:'ax-ckind-common' };
      kindBadge = '<span class="ax-codex-kind-badge ' + (kindCls[kind]||'ax-ckind-common') + '">'
                + (kindMap[kind]||'COMMUN') + '</span>';
    }

    /* Stats buff/malus */
    var statHtml = '';
    if (d.buff_stat || d.malus_stat) {
      statHtml = '<div class="ax-codex-stats">'
        + (d.buff_stat ? '<span class="ax-codex-buff">↑ ' + esc((labels[d.buff_stat]||d.buff_stat).toUpperCase()) + '</span>' : '')
        + (d.malus_stat ? '<span class="ax-codex-malus">↓ ' + esc((labels[d.malus_stat]||d.malus_stat).toUpperCase()) + '</span>' : '')
        + '</div>';
    }

    /* Contrainte d'accès — JAMAIS les noms pour name_lock */
    var lockHtml = '';
    if (d.race_lock && d.race_lock.length)
      lockHtml = '<div class="ax-codex-lock">◈ ' + esc(d.race_lock.join(' · ')) + '</div>';
    else if (d._name_lock)
      lockHtml = '<div class="ax-codex-lock">◈ Réservé · accès sur sélection manuelle</div>';
    else if (d._prob_secret)
      lockHtml = '<div class="ax-codex-lock">✦ Probabiliste · ' + Math.round((d._prob_rate||0.10)*100) + '% de chance</div>';

    var chevron = hasChevron ? '<span class="ax-cdx-chevron">▸</span>' : '';

    return '<div class="ax-codex-emoji">' + esc(d.emoji||'◆') + '</div>'
      + '<div class="ax-cdx-info">'
        + '<div class="ax-codex-meta-row">'
          + '<span class="ax-codex-name">' + esc(d.name||id) + '</span>'
          + '<span class="ax-codex-tier-badge">' + tierLabel + '</span>'
          + kindBadge + statHtml + chevron
        + '</div>'
        + (d.identity ? '<div class="ax-codex-identity">' + esc(d.identity) + '</div>' : '')
        + (d.description ? '<div class="ax-codex-desc">' + esc(d.description) + '</div>' : '')
        + lockHtml
      + '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════════
     WIRE
     ═══════════════════════════════════════════════════════════════════ */
  function wire(){
    var chip = $('#ax-char-chip');
    if (chip) chip.addEventListener('click', openCharSwitchModal);

    var codexBtn = document.getElementById('ax-codex-btn');
    if (codexBtn) codexBtn.addEventListener('click', openCodex);

    $$('.ax-modal').forEach(function(m){
      m.addEventListener('click', function(e){
        var t = e.target;
        if (t && (t.dataset.close !== undefined || t.classList.contains('ax-modal-close') || t.classList.contains('ax-modal-bg'))) {
          m.hidden = true;
        }
      });
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeAllModals();
    });

    /* Bouton "Réinitialiser au T0" — déclenche directement le reset (avec confirm).
       Plus de switchMode (sémantique irréversible). */
    var switchBtn = $('#active-switch-btn');
    if (switchBtn) switchBtn.addEventListener('click', function(){
      if (switchBtn.disabled) return;
      if (!confirm('Réinitialiser ton axiome au Tier 0 ? Tu perdras tout l\'arbre débloqué. Coûte 1 Axium.')) return;
      resetAxiome();
    });

    /* Legacy hook conservé au cas où */
    document.body.addEventListener('click', function(e){
      var t = e.target;
      if (t && t.id === 'cancel-switch') { STATE.switchMode = false; routeView(); }
    });

    var chooseBtn = $('#m-choose-btn');
    if (chooseBtn) chooseBtn.addEventListener('click', function(){
      if (chooseBtn.disabled) return;
      if (STATE.modalAxId) chooseAxiome(STATE.modalAxId);
    });

    var unlockBtn = $('#n-unlock-btn');
    if (unlockBtn) unlockBtn.addEventListener('click', function(){
      if (unlockBtn.disabled) return;
      unlockNode();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════ */
  async function init(){
    wire();
    showView('state-loading');

    await Promise.all([loadAxiomes(), loadCharacters(), loadAxium()])
      .catch(function(e){ console.error('[axiomes] init failed', e); });

    if (STATE.noSession) { showView('state-no-session'); return; }
    if (!STATE.chars.length) {
      if (STATE.fetchError) {
        showView('state-no-session');
        $('#state-no-session .ax-state-title').textContent = 'Erreur de chargement';
        $('#state-no-session .ax-state-text').textContent = STATE.fetchError;
      } else {
        showView('state-no-chars');
      }
      return;
    }

    activateChar(STATE.chars[0]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

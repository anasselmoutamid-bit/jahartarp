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
    data: null,            /* tout le contenu de data/axiomes.json */
    axiomes: null,         /* uniquement les axiomes (sans _meta etc.) */
    progression: null,
    secretRates: null,
    statLabels: null,
    axium: 0,
    noSession: false,
    fetchError: null,
    modalAxId: null,
    modalNodeId: null,     /* node sélectionné dans le node-modal */
    switchMode: false
  };

  var MIN_LEVEL = 50;
  var SWITCH_COST = 1;

  /* ─── Utils ─── */
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

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

  /* ─── Visibility ─── */
  function isVisible(axId, def, c){
    var k = def.kind;
    if (k === 'neophyte') return false; /* jamais dans le picker */
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
      if (!def._prob_secret) return true; /* secret non-prob = toujours visible si défini ailleurs */
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
  function canChooseAxiome(c, id){
    if (!c) return { ok: false, reason: 'no-char', label: 'PAS DE PERSO' };
    var lvl = parseInt(c.level || 0, 10) || 0;
    if (lvl < MIN_LEVEL) return { ok: false, reason: 'level', label: 'NIVEAU ' + MIN_LEVEL + ' REQUIS (' + lvl + ')' };
    var cur = c.axiome_current || c.axiome || null;
    var isSwitch = cur && cur !== id && cur !== 'neophyte';
    if (isSwitch && STATE.axium < SWITCH_COST) {
      return { ok: false, reason: 'axium', label: SWITCH_COST + ' AXIUM REQUIS (' + STATE.axium + ')' };
    }
    return { ok: true };
  }

  /* ═══════════════════════════════════════════════════════════════════
     DATA LOADERS
     ═══════════════════════════════════════════════════════════════════ */
  function loadAxiomes(){
    return fetch('data/axiomes.json?v=1')
      .then(function(r){ if (!r.ok) throw new Error('axiomes HTTP ' + r.status); return r.json(); })
      .then(function(j){
        STATE.data = j;
        STATE.progression = j._progression || null;
        STATE.secretRates = j._secret_rates || null;
        STATE.statLabels = j._stat_labels || {};
        var axiomes = {};
        Object.keys(j).forEach(function(k){ if (k.charAt(0) !== '_') axiomes[k] = j[k]; });
        STATE.axiomes = axiomes;
        return axiomes;
      });
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

    $('#active-eyebrow').textContent = '// AXIOME ACTIF · TIER ' + tier;
    $('#active-emoji').textContent = d.emoji || '⚜️';
    $('#active-name').textContent = d.name || curId;

    var kindTxt = d.kind === 'secret' ? 'SECRET'
                : d.kind === 'special' ? 'SPÉCIAL'
                : d.kind === 'race_linked' ? 'RACE-LOCK'
                : 'COMMUN';
    var raceLockTxt = (d.race_lock && d.race_lock.length) ? ' · ' + d.race_lock.join(' / ') : '';
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

    /* Switch button (gated on axium) */
    var switchBtn = $('#active-switch-btn');
    var switchLabel = $('#active-switch-label');
    if (STATE.axium >= SWITCH_COST) {
      switchBtn.disabled = false;
      switchLabel.textContent = 'Changer d\'axiome · ' + SWITCH_COST + ' Axium (solde : ' + STATE.axium + ')';
    } else {
      switchBtn.disabled = true;
      switchLabel.textContent = '🔒 Switch requiert ' + SWITCH_COST + ' Axium (solde : ' + STATE.axium + ')';
    }

    /* Tree section */
    renderTreeSection(curId, d);
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
    var allReqsOk = reqs.every(function(r){ return unlockedSet.has(r); });
    return allReqsOk ? 'available' : 'locked';
  }

  function renderTreeSection(axId, def){
    var c = STATE.activeChar;
    var grid = $('#tree-grid');
    var emptyEl = $('#tree-empty');
    var emptyDetail = $('#tree-empty-detail');
    var paValue = $('#ax-pa-value');

    var pa = parseInt((c && c.axiome_pa) || 0, 10) || 0;
    paValue.textContent = pa;

    /* No-tree case (Dompteur, Cultivator, Regressor, Prime) */
    if (!def.tree || !def.tree.nodes || !def.tree.nodes.length) {
      grid.innerHTML = '';
      grid.hidden = true;
      emptyEl.hidden = false;
      var detail = def._special_effect || (def._narrative ? 'Effets narratifs uniquement.' : '');
      var detailMap = {
        'unlock_stat_aura': 'Effet spécial : débloque la stat Aura.',
        'sell_golden_eggs_in_shop': 'Effet spécial : peut vendre ses Golden Eggs dans son shop.',
        'special_slots_+2': 'Effet spécial : +2 slots items Spécial via tree.',
        'unlock_benediction_menu': 'Effet spécial : accès au menu Bénédiction.',
        'unlock_forge_menu': 'Effet spécial : accès au menu Forge.'
      };
      emptyDetail.textContent = detailMap[detail] || (def._narrative ? 'Axiome narratif — pas d\'arbre de compétences.' : 'Cet axiome ne dispose pas encore d\'un Axiome Tree défini.');
      return;
    }

    grid.hidden = false;
    emptyEl.hidden = true;

    var nodes = def.tree.nodes;
    var unlockedSet = _getUnlockedSet(c);

    /* Lookup name by id for prereq display */
    var nodesById = {};
    nodes.forEach(function(n){ nodesById[n.id] = n; });

    grid.innerHTML = '';
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
        '<div class="ax-tree-node-effect">' + esc(node.effect || '') + '</div>' +
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
    $('#n-effect').textContent = node.effect || '—';

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

    var curId = c.axiome_current;
    var def = STATE.axiomes[curId];
    if (!def || !def.tree) { closeAllModals(); return; }
    var node = def.tree.nodes.find(function(n){ return n.id === nodeId; });
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
    c.axiome_pa = pa - node.cost;
    c.axiome_tree_unlocked = Object.assign({}, prevUnlocked);
    c.axiome_tree_unlocked[node.id] = true;
    closeAllModals();
    routeView();

    try {
      await dbref.collection('characters').doc(String(charId)).update({
        axiome_pa: c.axiome_pa,
        axiome_tree_unlocked: c.axiome_tree_unlocked,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('[axiomes] unlock persist failed, rollback', e);
      c.axiome_pa = prevPa;
      c.axiome_tree_unlocked = prevUnlocked;
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

    /* Choose button */
    var chooseBtn = $('#m-choose-btn');
    var chooseLabel = $('#m-choose-label');
    var alreadyChosen = c && (c.axiome_current === id || c.axiome === id);
    var cur = c && (c.axiome_current || c.axiome);
    if (alreadyChosen) {
      chooseLabel.textContent = '✓ Déjà actif';
      chooseBtn.disabled = true;
    } else {
      var gate = canChooseAxiome(c, id);
      if (!gate.ok) {
        chooseLabel.textContent = '🔒 ' + gate.label;
        chooseBtn.disabled = true;
      } else {
        var isSwitch = cur && cur !== id && cur !== 'neophyte';
        chooseLabel.textContent = isSwitch
          ? ('Switch · ' + SWITCH_COST + ' Axium')
          : 'Choisir cet axiome';
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

    /* Spec : "il perd toute progression dans les anciens Axiome Trees".
       On reset axiome_tree_unlocked au choix (initial ou switch). PA conservé. */
    var prev = c.axiome_current || null;
    var prevUnlocked = c.axiome_tree_unlocked || {};
    c.axiome_current = id;
    c.axiome_tree_unlocked = {};
    STATE.switchMode = false;
    closeAllModals();
    routeView();

    try {
      await dbref.collection('characters').doc(String(charId)).update({
        axiome_current: id,
        axiome_tree_unlocked: {},
        updated_at: new Date().toISOString()
      });
      /* Note : le débit Axium reste à la charge du bot (commande owner). */
    } catch (e) {
      console.error('[axiomes] persist failed, rollback', e);
      c.axiome_current = prev;
      c.axiome_tree_unlocked = prevUnlocked;
      routeView();
      flashToast('⚠ Sauvegarde refusée : ' + (e.message || 'erreur'), 'error');
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
     BOOT TERMINAL
     ═══════════════════════════════════════════════════════════════════ */
  function bootSequence(){
    var out = $('#ax-boot-out');
    var cursor = $('#ax-boot-cursor');
    var bootEl = $('#ax-boot');
    var innerEl = $('#ax-boot-inner');
    var welcomeEl = $('#ax-boot-welcome');
    if (!out || !bootEl || !innerEl || !welcomeEl) return Promise.resolve();

    var lines = [
      { t: '//[SYSTEM] > Jaharta.exe Loading...', delay: 360 },
      { t: '> Negotiating with NEXUS::CORE',     delay: 300 },
      { t: '> Handshake OK · session=0x5AFE',    delay: 300 },
      { t: '> Booting AXIOM-RUNTIME v2.0',       delay: 260 },
      { t: '> [████░░░░░░░░░░░░░░░░] 20%',       delay: 180 },
      { t: '> [████████░░░░░░░░░░░░] 40%',       delay: 180 },
      { t: '> [████████████░░░░░░░░] 60%',       delay: 180 },
      { t: '> [████████████████░░░░] 80%',       delay: 180 },
      { t: '> [████████████████████] 100%',      delay: 320 },
      { t: '> Mounting USER.GATE…',              delay: 240 },
      { t: '> AUTH OK · welcome, voyageur',      delay: 400 }
    ];

    return new Promise(function(resolve){
      var i = 0;
      function step(){
        if (i >= lines.length) { revealWelcome(); return; }
        var ln = lines[i];
        out.textContent += (i === 0 ? '' : '\n') + ln.t;
        i++;
        setTimeout(step, ln.delay);
      }
      function revealWelcome(){
        if (cursor) cursor.style.display = 'none';
        innerEl.classList.add('is-fading');
        setTimeout(function(){
          innerEl.style.display = 'none';
          welcomeEl.classList.add('is-in');
          setTimeout(function(){
            bootEl.classList.add('is-done');
            setTimeout(function(){
              try { bootEl.remove(); } catch(_){}
              resolve();
            }, 700);
          }, 2400);
        }, 520);
      }
      step();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     WIRE
     ═══════════════════════════════════════════════════════════════════ */
  function wire(){
    var chip = $('#ax-char-chip');
    if (chip) chip.addEventListener('click', openCharSwitchModal);

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

    var switchBtn = $('#active-switch-btn');
    if (switchBtn) switchBtn.addEventListener('click', function(){
      if (switchBtn.disabled) return;
      STATE.switchMode = true;
      routeView();
    });

    document.body.addEventListener('click', function(e){
      var t = e.target;
      if (t && t.id === 'cancel-switch') {
        STATE.switchMode = false;
        routeView();
      }
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

    var bootDone = bootSequence();
    var dataDone = Promise.all([loadAxiomes(), loadCharacters(), loadAxium()])
      .catch(function(e){ console.error('[axiomes] init failed', e); });

    await Promise.all([bootDone, dataDone]);

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

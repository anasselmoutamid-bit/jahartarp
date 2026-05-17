/* ═══════════════════════════════════════════════════════════════════════
   axiomes-page.js — Page Axiomes (Node Guardians · navy + or)
   Vues :
     · state-loading  → spinner pendant fetch
     · state-no-session / state-no-chars → gates explicites
     · state-pick-char (multi-char) → grid de personnages
     · view-neophyte (lvl < 50)     → hero + browse preview-only
     · view-pick     (lvl 50+, sans axiome) → catalogue Voies/Métiers/Secrets
     · view-chosen   (axiome actif) → hero + actions + T2 stubs
   Persistance : characters.{id}.axiome_current via worker D1 (compat-shim Firebase)
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── State ─── */
  var STATE = {
    chars: [],
    activeChar: null,
    axiomes: null,
    axium: 0,
    noSession: false,
    fetchError: null,
    modalAxId: null,
    switchMode: false   // true = active char veut changer d'axiome
  };

  var MIN_LEVEL = 50;
  var SWITCH_COST = 1;

  /* T2 evolutions par T1 (display only — skill trees T2 pas encore implémentés). */
  var T2_MAP = {
    soldat:            ["Soldat d'Elite", "Soldat Arcanique", "Soldat de l'Ombre"],
    assassin:          ["Silence Ombragé", "Assassin Arcanique", "Éclaireur"],
    tank:              ["Mur de Fer", "Tank Arcanique", "Tank de Front"],
    mage:              ["Moine (Mage de Combat)", "TechnoMage", "Archimage"],
    soigneur:          ["Druide", "Mage Soigneur", "Occultiste"],
    orateur:           ["Charmeur", "Négociateur", "Voleur"],
    erudit:            ["Scientifique", "ArcanoChercheur", "OccultoChercheur", "TechnoChercheur"],
    eleveur:           ["Ami des Bêtes", "Chef de Meute", "Limit Breaker", "Soutien Animalier"],
    sniper:            ["Sniper d'Elite", "Sniper Furtif", "Sniper Arcanique"],
    fast_gunner:       ["DeadShot", "DeadEye", "Triple Gunner"],
    hacker:            ["Décodeur", "Virus", "Phisher", "NetWarrior"],
    forgeron:          ["ArcanoForgeron"],
    mage_favori_nexus: ["ArchiMage Favori du Nexus"],
    berserker:         ["Death Knight", "Earth Crusher", "Deep Berserker", "Controlled Berserker"],
    enforcer:          ["Oblivion", "DoomSlayer", "Superior Entity", "Reverso"],
    forgeron_divin:    ["Marteau de Baldun"],
    cultivator:        ["Aura Master"],
    fast_sniper:       ["Death Bringer", "Bullet Rainer", "Gun Master"],
    regressor:         ["Regressor II"]
  };

  var EMOJI = {
    soldat: "⚔️", assassin: "🗡️", tank: "🛡️", mage: "🔮",
    soigneur: "🍶", orateur: "💋", erudit: "📚", eleveur: "🐾",
    sniper: "🎯", fast_gunner: "🔫",
    hacker: "💻", forgeron: "🔨", mage_favori_nexus: "✨",
    berserker: "🩸", enforcer: "👑",
    forgeron_divin: "⚒️", cultivator: "🌟", fast_sniper: "🌠", regressor: "⏳",
    prime: "◈"
  };

  var METIER_PAGE = {
    soigneur: 'brassage.html',
    hacker: 'nexusnet.html',
    eleveur: 'elevage.html',
    erudit: 'recherche.html',
    forgeron: 'forge.html',
    mage_favori_nexus: 'rituels.html',
    forgeron_divin: 'forge.html'
  };

  /* Secrets probabilistes — tirage déterministe par char. */
  var PROB_SECRETS = ['forgeron_divin', 'cultivator', 'fast_sniper', 'regressor'];
  var PROB_RATES = {
    forgeron_divin: 0.10,
    cultivator:     0.10,
    fast_sniper:    0.10,
    regressor:      0.01
  };

  /* ─── Utils ─── */
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

  function kindOf(def){
    var k = def && def.kind ? def.kind : '';
    if (k.indexOf('secret') >= 0) return 'secret';
    if (k.indexOf('metier') >= 0) return 'metier';
    return 'voie';
  }
  function kindLabel(k){
    if (k === 'secret') return 'SECRET';
    if (k === 'metier') return 'MÉTIER';
    return 'VOIE DE COMBAT';
  }

  /* Hash FNV-1a 32-bit — fraction [0,1) déterministe. */
  function hashFraction(seed, salt){
    var s = String(seed) + '|' + String(salt);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h / 0x100000000;
  }
  function rolledSecrets(c){
    if (!c) return [];
    var lvl = parseInt(c.level || 0, 10) || 0;
    if (lvl < MIN_LEVEL) return [];
    var cid = c._id || c.id;
    if (!cid) return [];
    return PROB_SECRETS.filter(function(id){
      return hashFraction(cid, id) < (PROB_RATES[id] || 0);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     DATA LOADERS
     ═══════════════════════════════════════════════════════════════════ */
  function loadAxiomes(){
    return fetch('data/axiome_skills.json?v=2')
      .then(function(r){ if (!r.ok) throw new Error('axiome_skills HTTP ' + r.status); return r.json(); })
      .then(function(j){
        var out = {};
        Object.keys(j).forEach(function(k){
          if (k.charAt(0) === '_') return;
          out[k] = j[k];
        });
        STATE.axiomes = out;
        return out;
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
     GATES
     ═══════════════════════════════════════════════════════════════════ */
  function canChooseAxiome(c, id){
    var lvl = parseInt(c.level || 0, 10) || 0;
    if (lvl < MIN_LEVEL) {
      return { ok: false, reason: 'level', label: 'NIVEAU ' + MIN_LEVEL + ' REQUIS (' + lvl + ')' };
    }
    var cur = c.axiome_current || c.axiome || null;
    var isSwitch = cur && cur !== id;
    if (isSwitch && STATE.axium < SWITCH_COST) {
      return { ok: false, reason: 'axium', label: SWITCH_COST + ' AXIUM REQUIS (' + STATE.axium + ')' };
    }
    return { ok: true };
  }

  function isAxiomeVisibleFor(axId, def, c){
    var k = kindOf(def);
    if (k !== 'secret') return true;
    /* Name-lock (Prime) */
    var nameLock = def._name_lock;
    if (nameLock && nameLock.length) {
      var fullName = ((c.first_name || '') + ' ' + (c.last_name || '')).trim().toLowerCase();
      return nameLock.some(function(n){ return String(n).trim().toLowerCase() === fullName; });
    }
    /* Probabiliste */
    if (PROB_SECRETS.indexOf(axId) >= 0) {
      return rolledSecrets(c).indexOf(axId) >= 0;
    }
    /* Race-lock */
    var race = (c.class || c.race_specific || '').toLowerCase();
    var raceCat = (c.race_category || '').toLowerCase();
    var lock = (def.race_lock || []).map(function(r){ return String(r).toLowerCase(); });
    if (!lock.length) return false;
    return lock.indexOf(race) >= 0 || lock.indexOf(raceCat) >= 0;
  }

  /* Liste des ids d'axiomes visibles pour ce char. */
  function visibleAxiomes(c){
    var ax = STATE.axiomes || {};
    return Object.keys(ax).filter(function(id){
      var d = ax[id];
      if (!d) return false;
      return isAxiomeVisibleFor(id, d, c);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     VIEW ROUTER
     ═══════════════════════════════════════════════════════════════════ */
  var ALL_PANELS = [
    'state-loading','state-no-session','state-no-chars','state-pick-char',
    'view-neophyte','view-pick','view-chosen'
  ];
  function showView(id){
    ALL_PANELS.forEach(function(p){
      var el = document.getElementById(p);
      if (el) el.hidden = (p !== id);
    });
  }

  function routeView(){
    var c = STATE.activeChar;
    if (!c) {
      renderCharGrid('char-grid');
      showView('state-pick-char');
      return;
    }
    var lvl = parseInt(c.level || 0, 10) || 0;
    var cur = c.axiome_current || c.axiome || null;

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

  /* ═══════════════════════════════════════════════════════════════════
     CHAR CHIP + SWITCH MODAL
     ═══════════════════════════════════════════════════════════════════ */
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

    var grid = $('#grid-preview');
    grid.innerHTML = '';
    var ids = visibleAxiomes(c);
    /* Tri stable : voie → metier → secret */
    ids.sort(_sortByKind);
    ids.forEach(function(id){ grid.appendChild(makeCard(id, c, /*previewLocked*/ true)); });
  }

  function _sortByKind(a, b){
    var ka = kindOf(STATE.axiomes[a]);
    var kb = kindOf(STATE.axiomes[b]);
    var order = { voie: 0, metier: 1, secret: 2 };
    if (order[ka] !== order[kb]) return order[ka] - order[kb];
    return (STATE.axiomes[a].name || '').localeCompare(STATE.axiomes[b].name || '', 'fr');
  }

  /* ═══════════════════════════════════════════════════════════════════
     PICK VIEW (lvl 50+ sans axiome OU switch mode)
     ═══════════════════════════════════════════════════════════════════ */
  function renderPickView(c){
    var hero = $('#view-pick .ax-hero');
    if (!hero) return;
    var eyebrow = hero.querySelector('.ax-hero-eyebrow');
    var title   = hero.querySelector('.ax-hero-title');
    var desc    = hero.querySelector('.ax-hero-desc');
    var emoji   = hero.querySelector('.ax-hero-emoji');

    if (STATE.switchMode) {
      eyebrow.textContent = '// CHANGEMENT D\'AXIOME · COÛT ' + SWITCH_COST + ' AXIUM';
      title.textContent = 'Change ta voie';
      emoji.textContent = '⇄';
      desc.innerHTML = 'Solde Axium : <strong>' + STATE.axium + '</strong>. ' +
        (STATE.axium >= SWITCH_COST
          ? 'Choisir un axiome ci-dessous va dépenser <strong>1 Axium</strong>.'
          : '<span style="color:var(--red)">Tu n\'as pas assez d\'Axium pour switcher.</span>') +
        ' <button type="button" class="ax-cancel-link" id="cancel-switch">↩ Annuler</button>';
    } else {
      eyebrow.textContent = '// TIER 1 · CHOIX D\'AXIOME';
      title.textContent = 'Choisis ta voie';
      emoji.textContent = '◆';
      desc.innerHTML = 'Tu as atteint le niveau <strong>50</strong>. Choisis un Axiome T1 ci-dessous. Changer ensuite coûte <strong>1 Axium</strong>.';
    }

    var ids = visibleAxiomes(c);
    var byKind = { voie: [], metier: [], secret: [] };
    ids.forEach(function(id){ byKind[kindOf(STATE.axiomes[id])].push(id); });

    fillGrid('grid-voies',   byKind.voie,   c);
    fillGrid('grid-metiers', byKind.metier, c);
    fillGrid('grid-secrets', byKind.secret, c);
    $('#section-secrets').hidden = !byKind.secret.length;
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
    ids.forEach(function(id){ grid.appendChild(makeCard(id, c, false)); });
  }

  /* Carte d'axiome cliquable */
  function makeCard(id, c, previewLocked){
    var d = STATE.axiomes[id];
    var card = document.createElement('button');
    card.className = 'ax-card';
    card.type = 'button';
    card.dataset.id = id;

    var k = kindOf(d);
    if (k === 'secret') card.classList.add('is-secret');
    if (previewLocked) card.classList.add('is-locked');
    var cur = c && (c.axiome_current || c.axiome);
    if (cur && cur === id) card.classList.add('is-active');

    var skillCount = (d.skills || []).length;
    var kindTxt = k === 'secret' ? 'SECRET' : k === 'metier' ? 'MÉTIER' : 'VOIE';
    var meta = kindTxt + ' · ' + skillCount + ' SKILL' + (skillCount > 1 ? 'S' : '');

    var tag = '';
    if (cur && cur === id) tag = '<span class="ax-card-tag">ACTIF</span>';
    else if (k === 'secret' && d._name_lock && d._name_lock.length) tag = '<span class="ax-card-tag">NAME-LOCK</span>';
    else if (k === 'secret' && (d.race_lock || []).length) tag = '<span class="ax-card-tag">RACE-LOCK</span>';
    else if (k === 'secret' && PROB_SECRETS.indexOf(id) >= 0) tag = '<span class="ax-card-tag">RARE ✦</span>';

    card.innerHTML =
      tag +
      '<div class="ax-card-emoji">' + esc(EMOJI[id] || '⚜️') + '</div>' +
      '<div class="ax-card-name">' + esc(d.name || id) + '</div>' +
      '<div class="ax-card-meta">' + meta + '</div>';

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

    var k = kindOf(d);
    $('#active-emoji').textContent = EMOJI[curId] || '⚜️';
    $('#active-name').textContent = d.name || curId;

    var skillCount = (d.skills || []).length;
    var branchCount = (d.branches || []).length;
    var raceLock = (d.race_lock || []).join(' / ');
    var metaParts = [kindLabel(k), skillCount + ' SKILLS'];
    if (branchCount) metaParts.push(branchCount + ' BRANCHES');
    if (raceLock) metaParts.push('RACE-LOCK · ' + raceLock.toUpperCase());
    $('#active-meta').textContent = metaParts.join(' · ');

    var rootSkill = (d.skills || []).find(function(s){ return s.tier === 0; });
    var desc = rootSkill && rootSkill.effect
      ? rootSkill.effect
      : 'Voie de spécialisation T1. Chaque skill coûte des PA (1 PA tous les 7 jours).';
    $('#active-desc').textContent = desc;

    /* Tree button (avec char_id pour le gate unlock) */
    var charId = c._id || c.id;
    var treeUrl = 'axiome-skills-preview.html?ax=' + encodeURIComponent(curId);
    if (charId) treeUrl += '&char=' + encodeURIComponent(charId);
    $('#active-tree-btn').setAttribute('href', treeUrl);

    /* Metier button : visible uniquement si axiome metier ET actif */
    var metierBtn = $('#active-metier-btn');
    var metierPage = METIER_PAGE[curId];
    if (k === 'metier' && metierPage) {
      metierBtn.hidden = false;
      metierBtn.setAttribute('href', metierPage);
    } else {
      metierBtn.hidden = true;
      metierBtn.removeAttribute('href');
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

    /* T2 grid */
    var t2Grid = $('#grid-t2');
    t2Grid.innerHTML = '';
    var t2List = T2_MAP[curId] || [];
    if (!t2List.length) {
      t2Grid.innerHTML = '<div class="ax-section-sub" style="grid-column:1/-1">Aucune évolution T2 enregistrée pour cet axiome.</div>';
    } else {
      t2List.forEach(function(name){
        var card = document.createElement('div');
        card.className = 'ax-card is-stub';
        card.innerHTML =
          '<div class="ax-card-emoji">◇</div>' +
          '<div class="ax-card-name">' + esc(name) + '</div>' +
          '<div class="ax-card-meta">T2 · ARBRE WIP</div>';
        t2Grid.appendChild(card);
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     AXIOME MODAL (détails + choisir)
     ═══════════════════════════════════════════════════════════════════ */
  function openAxiomeModal(id){
    var d = STATE.axiomes && STATE.axiomes[id];
    if (!d) return;
    var c = STATE.activeChar;
    STATE.modalAxId = id;
    var k = kindOf(d);

    $('#m-eyebrow').textContent = '// AXIOME · TIER 1';
    $('#m-emoji').textContent = EMOJI[id] || '⚜️';
    $('#m-title').textContent = d.name || id;
    $('#m-kind').textContent = kindLabel(k);

    var rootSkill = (d.skills || []).find(function(s){ return s.tier === 0; });
    var desc = rootSkill && rootSkill.effect
      ? rootSkill.effect
      : 'Voie de spécialisation T1. 4 branches · skills coûtant des PA (1 PA / 7j).';
    $('#m-desc').textContent = desc;

    $('#m-skills').textContent   = (d.skills || []).length;
    $('#m-branches').textContent = (d.branches || []).length;
    var raceText = (d.race_lock || []).join(' · ');
    if (!raceText && d._name_lock && d._name_lock.length) raceText = 'NAME-LOCK';
    else if (!raceText && PROB_SECRETS.indexOf(id) >= 0) raceText = 'PROBABILISTE';
    $('#m-race').textContent = raceText || '—';

    /* Tree button */
    var charId = c && (c._id || c.id);
    var treeUrl = 'axiome-skills-preview.html?ax=' + encodeURIComponent(id);
    if (charId) treeUrl += '&char=' + encodeURIComponent(charId);
    $('#m-tree-btn').setAttribute('href', treeUrl);

    /* Metier button (réservé à l'axiome actif) */
    var metierBtn = $('#m-metier-btn');
    var metierPage = METIER_PAGE[id];
    var cur = c && (c.axiome_current || c.axiome);
    if (k === 'metier' && metierPage && cur === id) {
      metierBtn.hidden = false;
      metierBtn.setAttribute('href', metierPage);
    } else {
      metierBtn.hidden = true;
      metierBtn.removeAttribute('href');
    }

    /* Choose button */
    var chooseBtn = $('#m-choose-btn');
    var chooseLabel = $('#m-choose-label');
    var alreadyChosen = c && (c.axiome_current === id || c.axiome === id);
    if (alreadyChosen) {
      chooseLabel.textContent = '✓ Déjà actif';
      chooseBtn.disabled = true;
    } else if (!c) {
      chooseLabel.textContent = 'Pas de perso sélectionné';
      chooseBtn.disabled = true;
    } else {
      var gate = canChooseAxiome(c, id);
      if (!gate.ok) {
        chooseLabel.textContent = '🔒 ' + gate.label;
        chooseBtn.disabled = true;
      } else {
        var isSwitch = cur && cur !== id;
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
     CHOOSE AXIOME — Persistance D1
     ═══════════════════════════════════════════════════════════════════ */
  async function chooseAxiome(id){
    var c = STATE.activeChar;
    if (!c) { closeAllModals(); return; }

    var gate = canChooseAxiome(c, id);
    if (!gate.ok) {
      console.warn('[axiomes] choose blocked:', gate);
      closeAllModals();
      return;
    }

    var dbref = _getDb();
    var charId = c._id || c.id;
    if (!dbref || !charId) {
      console.warn('[axiomes] no db or charId — abort write');
      closeAllModals();
      return;
    }

    /* Optimistic update */
    var prev = c.axiome_current || null;
    c.axiome_current = id;
    STATE.switchMode = false;
    closeAllModals();
    routeView();

    try {
      await dbref.collection('characters').doc(String(charId)).update({
        axiome_current: id,
        updated_at: new Date().toISOString()
      });
      /* Note : le débit Axium est géré par le bot Discord. */
    } catch (e) {
      console.error('[axiomes] persist failed, rollback', e);
      c.axiome_current = prev;
      routeView();
      flashToast('⚠ Sauvegarde refusée : ' + (e.message || 'erreur réseau'), 'error');
    }
  }

  /* Mini-toast volatile (5s) */
  function flashToast(msg, kind){
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);' +
      'padding:10px 18px;font-family:JetBrains Mono,monospace;font-size:0.7rem;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'background:rgba(7,9,15,0.95);border:1px solid ' + (kind === 'error' ? '#e7484b' : '#c9a961') +
      ';color:' + (kind === 'error' ? '#e7484b' : '#e8c876') +
      ';z-index:2000;box-shadow:0 10px 30px rgba(0,0,0,0.6);';
    document.body.appendChild(t);
    setTimeout(function(){ try { t.remove(); } catch(_){} }, 4500);
  }

  /* ═══════════════════════════════════════════════════════════════════
     WIRE EVENTS
     ═══════════════════════════════════════════════════════════════════ */
  function wire(){
    /* Char chip → ouvre le switcher de perso */
    var chip = $('#ax-char-chip');
    if (chip) chip.addEventListener('click', openCharSwitchModal);

    /* Modal close handlers (délégation : click sur bg ou close, ou Escape) */
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

    /* Switch button → enter switch mode */
    var switchBtn = $('#active-switch-btn');
    if (switchBtn) switchBtn.addEventListener('click', function(){
      if (switchBtn.disabled) return;
      STATE.switchMode = true;
      routeView();
    });

    /* Cancel switch (link inside hero desc) — délégation body */
    document.body.addEventListener('click', function(e){
      var t = e.target;
      if (t && t.id === 'cancel-switch') {
        STATE.switchMode = false;
        routeView();
      }
    });

    /* Modal choose button */
    var chooseBtn = $('#m-choose-btn');
    if (chooseBtn) chooseBtn.addEventListener('click', function(){
      if (chooseBtn.disabled) return;
      if (STATE.modalAxId) chooseAxiome(STATE.modalAxId);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     BOOT TERMINAL — séquence d'intro
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
      { t: '> Booting AXIOM-RUNTIME v1.0',       delay: 260 },
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
              try { bootEl.remove(); } catch(_) {}
              resolve();
            }, 700);
          }, 2400);
        }, 520);
      }
      step();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════ */
  async function init(){
    wire();
    showView('state-loading');

    /* Lance le boot terminal ET le data fetch en parallèle.
       Quand les deux sont terminés, on route vers la bonne vue. */
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

    if (STATE.chars.length === 1) {
      activateChar(STATE.chars[0]);
    } else {
      activateChar(STATE.chars[0]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

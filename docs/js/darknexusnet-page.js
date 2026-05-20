/* ═══════════════════════════════════════════════════════════════════════
   darknexusnet-page.js — Page DarkNexusNet v1
   ─ Phase 1 : Boot terminal (samouraï)
   ─ Phase 2 : Glitch title reveal
   ─ Phase 3 : Minijeu d'entrée (pattern matching)
   ─ Phase 4 : Menu principal (Marché Noir + Hack [WIP] + Anti-Hack)
   Accès gated : Hacker / Encodeur uniquement
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STATE = {
    activeChar: null,
    activeCharId: null,
    inventory: null,
    inventoryKey: null,
    chars: [],
    itemsCfg: null,
    noSession: false,
    activeSection: 'market',
    /* minijeu entrée */
    gameSequence: [],
    gamePlayer: [],
    gameAttempts: 3,
    gameAttemptCurrent: 0,
    gameAllowInput: false,
    /* hack bancaire */
    hackTargets: [],
    hackTargetsLoaded: false,
    hackCurrentTarget: null,
    hackCurrentTargetId: null,
    hackCode: '',
    hackCodeTimer: null,
    hackCodeStart: 0,
    hackBusy: false
  };

  /* Constantes Hack */
  var HACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; /* 7 jours */
  var HACK_BASE_CHANCE = 20;          /* % */
  var HACK_MINIGAME_BONUS = 20;       /* % si réussi */
  var HACK_MINIGAME_MALUS = 5;        /* % si raté */
  var HACK_CODE_DURATION = 8000;      /* 8s pour taper le code */
  var HACK_TRANSFER_RATE = 0.15;      /* 15% des fonds */
  var HACK_CURRENCIES = ['platinum_kanite','silver_kanite','bronze_kanite'];

  var DARKNET_ITEMS = [
    /* Items du Marché Noir : ID dans config/items + prix HRP */
    'puce_antihack',
    'fragment_darknexus',
    /* Singularité — noyaux + outils */
    'noyau_brut',
    'fragment_origine',
    'coeur_instable',
    'encre_renommage'
    /* Tu peux ajouter d'autres item ids ici */
  ];

  /* Pour l'anti-hack craft (Encodeur) */
  var ANTIHACK_RECIPE = [
    { id: 'fragment_darknexus', qty: 2 },
    { id: 'circuit_haute_precision', qty: 3 },
    { id: 'cristal_mana_brise', qty: 2 }
  ];

  /* ─── Utils ─── */
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

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
  function _getCharParam(){
    try { var m = location.search.match(/[?&]char=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; }
    catch(_) { return null; }
  }
  function _invKey(uid, charId){ return uid + '_' + charId; }

  function _hasDarknetAccess(c){
    if (!c) return false;
    var cur = c.axiome_current || c.axiome || null;
    return cur === 'hacker' || cur === 'encodeur';
  }
  function _isHacker(c){ return c && (c.axiome_current === 'hacker'); }
  function _isEncodeur(c){ return c && (c.axiome_current === 'encodeur'); }

  /* ═══════════════════════════════════════════════════════════════════
     DATA LOADERS
     ═══════════════════════════════════════════════════════════════════ */
  function loadItemsConfig(){
    var dbref = _getDb();
    if (!dbref) return Promise.resolve(null);
    return dbref.collection('config').doc('items').get().then(function(snap){
      if (!snap.exists) return null;
      var data = snap.data() || {};
      var merged = {};
      ['items','equipment','food_items','consumable_items'].forEach(function(sec){
        if (data[sec] && typeof data[sec] === 'object') {
          Object.entries(data[sec]).forEach(function(kv){ merged[kv[0]] = kv[1]; });
        }
      });
      STATE.itemsCfg = merged;
      return merged;
    }).catch(function(e){ console.warn('[dnn] items load failed:', e); return null; });
  }

  async function loadActiveChar(){
    var dbref = _getDb();
    var uid = _getUid();
    STATE.noSession = !uid;
    if (!dbref || !uid) return null;
    var paramId = _getCharParam();
    if (paramId) {
      try {
        var cs = await dbref.collection('characters').doc(String(paramId)).get();
        if (cs.exists) {
          var data = cs.data() || {};
          if (String(data.user_id) === String(uid)) {
            STATE.activeCharId = paramId;
            STATE.activeChar = Object.assign({ _id: paramId, id: paramId }, data);
            return STATE.activeChar;
          }
        }
      } catch (e) {}
    }
    try {
      var snap = await dbref.collection('active_characters').doc(String(uid)).get();
      if (snap.exists) {
        var charId = (snap.data() || {}).character_id;
        if (charId) {
          var cs2 = await dbref.collection('characters').doc(String(charId)).get();
          if (cs2.exists) {
            STATE.activeCharId = charId;
            STATE.activeChar = Object.assign({ _id: charId, id: charId }, cs2.data() || {});
            return STATE.activeChar;
          }
        }
      }
    } catch (e) {}
    /* Fallback : load all chars du user */
    try {
      var qs = await dbref.collection('characters').where('user_id','==',String(uid)).get();
      var out = [];
      qs.forEach(function(d){ if (d.data() && !d.data()._init) out.push(Object.assign({_id:d.id,id:d.id}, d.data())); });
      STATE.chars = out;
      /* Cherche un Hacker/Encodeur en priorité */
      var pref = out.find(function(c){ return _hasDarknetAccess(c); }) || out[0];
      if (pref) {
        STATE.activeCharId = pref._id || pref.id;
        STATE.activeChar = pref;
        return pref;
      }
    } catch (e) {}
    return null;
  }

  async function loadInventory(){
    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid || !STATE.activeCharId) return null;
    var key = _invKey(uid, STATE.activeCharId);
    STATE.inventoryKey = key;
    try {
      var snap = await dbref.collection('inventories').doc(key).get();
      STATE.inventory = snap.exists ? (snap.data() || {}) : { items: {}, equipped_assets: [] };
      if (!STATE.inventory.items) STATE.inventory.items = {};
      return STATE.inventory;
    } catch (e) {
      console.warn('[dnn] inv load failed:', e);
      STATE.inventory = { items: {}, equipped_assets: [] };
      return STATE.inventory;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     PHASE 1 : BOOT
     ═══════════════════════════════════════════════════════════════════ */
  var BOOT_LINES = [
    { t: '//[SAMURAI] Initializing NIEIS Cyberdeck...', d: 220 },
    { t: '> Connecting to NEXUS::DARK relay 0xAD4F', d: 200 },
    { t: '> Handshake OK · port 666 · TLS-OFF', d: 200 },
    { t: '> Loading BREACH_PROTOCOL.104.008', d: 280 },
    { t: '> [████░░░░░░░░░░░░] 25%', d: 180 },
    { t: '> [████████░░░░░░░░] 50%', d: 180 },
    { t: '> [████████████░░░░] 75%', d: 180 },
    { t: '> [████████████████] 100% · OUT_GATE PASS', d: 240 },
    { t: '> Scanning SOCKET_SYS C9BA35...', d: 220 },
    { t: '> Bypassing kernel sentinels...', d: 220 },
    { t: '> WARNING : OUTSIDE LINK CONNECTED', d: 280 },
    { t: '> Mounting USER.DARKNET...', d: 220 },
    { t: '> AUTH OK · welcome, runner', d: 300 }
  ];

  function runBoot(){
    var out = $('#boot-out');
    var bar = $('#boot-bar-fill');
    if (!out || !bar) return Promise.resolve();
    return new Promise(function(resolve){
      var i = 0;
      function tick(){
        if (i >= BOOT_LINES.length) { resolve(); return; }
        var ln = BOOT_LINES[i];
        out.textContent += (i === 0 ? '' : '\n') + ln.t;
        var pct = Math.round(((i + 1) / BOOT_LINES.length) * 100);
        bar.style.width = pct + '%';
        i++;
        setTimeout(tick, ln.d);
      }
      tick();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     PHASE 2 : GLITCH TITLE
     ═══════════════════════════════════════════════════════════════════ */
  function showGlitchTitle(){
    $('#phase-boot').hidden = true;
    $('#phase-glitch').hidden = false;
    return new Promise(function(resolve){ setTimeout(resolve, 3500); });
  }

  /* ═══════════════════════════════════════════════════════════════════
     PHASE 3 : MINIJEU
     ═══════════════════════════════════════════════════════════════════ */
  var GAME_GLYPHS = ['◆','◇','▲','▼','◢','◣','◤','◥','✦','✧','◈','◉'];
  var GAME_CELLS = 16; /* 4x4 grid */
  var GAME_SEQUENCE_LEN = 5;

  function buildGameGrid(){
    var grid = $('#game-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var glyphs = GAME_GLYPHS.slice().sort(function(){ return Math.random() - 0.5; });
    for (var i = 0; i < GAME_CELLS; i++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dnn-game-cell is-disabled';
      cell.dataset.idx = i;
      cell.textContent = glyphs[i % glyphs.length];
      cell.addEventListener('click', function(e){
        if (!STATE.gameAllowInput) return;
        onGameCellClick(parseInt(e.currentTarget.dataset.idx, 10), e.currentTarget);
      });
      grid.appendChild(cell);
    }
  }

  function showGameStatus(txt, color){
    var el = $('#game-status');
    if (!el) return;
    el.textContent = txt;
    el.style.color = color || '';
  }

  async function startGame(){
    STATE.gameAttemptCurrent++;
    $('#game-attempt').textContent = 'Tentative ' + STATE.gameAttemptCurrent + ' / ' + STATE.gameAttempts;
    if (STATE.gameAttemptCurrent > STATE.gameAttempts) {
      /* Échec définitif → retour au boot */
      showGameStatus('▼ ÉCHEC — Reboot en cours...', '#ff1a3a');
      setTimeout(function(){
        location.reload();
      }, 2500);
      return;
    }
    STATE.gameSequence = [];
    STATE.gamePlayer = [];
    for (var i = 0; i < GAME_SEQUENCE_LEN; i++) {
      STATE.gameSequence.push(Math.floor(Math.random() * GAME_CELLS));
    }
    showGameStatus('▶ Mémorise la séquence...', '#ff3050');
    $('#game-start').disabled = true;
    $$('.dnn-game-cell').forEach(function(c){ c.classList.add('is-disabled'); c.classList.remove('is-clicked'); });

    /* Flash la séquence */
    for (var j = 0; j < STATE.gameSequence.length; j++) {
      await new Promise(function(r){ setTimeout(r, 600); });
      var cell = $('.dnn-game-cell[data-idx="' + STATE.gameSequence[j] + '"]');
      if (cell) {
        cell.classList.add('is-flash');
        await new Promise(function(r){ setTimeout(r, 450); });
        cell.classList.remove('is-flash');
      }
    }
    await new Promise(function(r){ setTimeout(r, 400); });
    showGameStatus('▶ À toi — reproduis la séquence', '#ff3050');
    STATE.gameAllowInput = true;
    $$('.dnn-game-cell').forEach(function(c){ c.classList.remove('is-disabled'); });
  }

  function onGameCellClick(idx, cellEl){
    STATE.gamePlayer.push(idx);
    cellEl.classList.add('is-clicked');
    var step = STATE.gamePlayer.length - 1;
    if (STATE.gameSequence[step] !== idx) {
      /* Erreur */
      STATE.gameAllowInput = false;
      showGameStatus('✕ Mauvaise séquence', '#ff1a3a');
      $$('.dnn-game-cell').forEach(function(c){ c.classList.add('is-disabled'); });
      setTimeout(function(){
        $('#game-start').disabled = false;
        showGameStatus('▶ Réessaye', '#ff3050');
      }, 1500);
      return;
    }
    if (STATE.gamePlayer.length === STATE.gameSequence.length) {
      /* Succès ! */
      STATE.gameAllowInput = false;
      showGameStatus('✓ ACCÈS OCTROYÉ', '#5fb878');
      setTimeout(function(){ enterMenu(); }, 1200);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     PHASE 4 : MENU
     ═══════════════════════════════════════════════════════════════════ */
  function enterMenu(){
    $('#phase-game').hidden = true;
    $('#phase-menu').hidden = false;
    var c = STATE.activeChar;
    var name = c ? (((c.first_name||'') + ' ' + (c.last_name||'')).trim() || 'Voyageur') : 'Voyageur';
    var statusLabel = _isHacker(c) ? 'HACKER' : _isEncodeur(c) ? 'ENCODEUR' : 'RUNNER';
    $('#menu-user').textContent = name.toUpperCase() + ' · ' + statusLabel;

    /* Lock sections selon axiome */
    var hack = $('#side-hack');
    var anti = $('#side-antihack');
    if (!_isHacker(c)) hack.classList.add('is-locked');
    if (!_isEncodeur(c)) anti.classList.add('is-locked');

    wireMenu();
    wireHackModal();
    renderMarket();
    renderAntiHack();
    renderHackTab();
  }

  function wireMenu(){
    $$('.dnn-side-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var section = btn.dataset.section;
        if (section === 'logout') {
          if (confirm('Déconnexion du DarkNexusNet ? Tu devras refaire le minijeu pour revenir.')) {
            location.href = 'axiomes.html';
          }
          return;
        }
        if (btn.classList.contains('is-locked')) {
          var c = STATE.activeChar;
          if (section === 'hack') alert("Réservé aux Hackers (axiome Hacker actif).");
          else if (section === 'antihack') alert("Réservé aux Encodeurs (axiome Encodeur actif).");
          return;
        }
        STATE.activeSection = section;
        $$('.dnn-side-btn').forEach(function(b){ b.classList.toggle('is-active', b === btn && !b.classList.contains('is-locked')); });
        $$('.dnn-section').forEach(function(s){
          var active = s.id === 'section-' + section;
          s.classList.toggle('is-active', active);
          s.hidden = !active;
        });
      });
    });
  }

  /* ─── Marché Noir ─── */
  function renderMarket(){
    var grid = $('#market-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var items = STATE.itemsCfg || {};
    DARKNET_ITEMS.forEach(function(itemId){
      var def = items[itemId];
      if (!def) return;
      var card = document.createElement('div');
      card.className = 'dnn-market-card';
      var rarity = (def.rarity || 'common').toLowerCase();
      var priceAmount = (def.price && def.price.amount) || 0;
      var priceCur = (def.price && def.price.currency) || 'bronze_kanite';
      var priceLabel = priceCur.replace('_kanite','').toUpperCase() + ' K';
      card.innerHTML =
        '<div class="dnn-market-head">' +
          '<span class="dnn-market-icon">' + esc(def.icon || '◈') + '</span>' +
          '<span class="dnn-market-name">' + esc(def.name || itemId) + '</span>' +
          '<span class="dnn-market-rarity">' + esc(rarity) + '</span>' +
        '</div>' +
        '<div class="dnn-market-desc">' + esc(def.description || '—') + '</div>' +
        '<div class="dnn-market-foot">' +
          '<span class="dnn-market-price">' + priceAmount.toLocaleString() + ' ' + priceLabel + '</span>' +
          '<button class="dnn-market-buy" type="button" data-id="' + esc(itemId) + '">Acheter</button>' +
        '</div>';
      card.querySelector('.dnn-market-buy').addEventListener('click', function(){ buyMarketItem(itemId); });
      grid.appendChild(card);
    });
  }

  async function buyMarketItem(itemId){
    var def = (STATE.itemsCfg || {})[itemId];
    if (!def || !STATE.activeChar) return;
    var price = (def.price && def.price.amount) || 0;
    var currency = (def.price && def.price.currency) || 'bronze_kanite';

    /* Read player economy */
    var dbref = _getDb();
    var uid = _getUid();
    var ecoKey = _invKey(uid, STATE.activeCharId);
    try {
      var snap = await dbref.collection('economy').doc(ecoKey).get();
      var eco = snap.exists ? (snap.data() || {}) : { personal: {} };
      var bal = (eco.personal && parseInt(eco.personal[currency] || 0, 10)) || 0;
      if (bal < price) {
        alert('Solde insuffisant. Besoin : ' + price + ' ' + currency + ' (actuel : ' + bal + ')');
        return;
      }
      /* Déduire monnaie */
      var newPersonal = Object.assign({}, eco.personal || {});
      newPersonal[currency] = bal - price;
      /* Ajouter item à inventaire */
      var newItems = Object.assign({}, (STATE.inventory && STATE.inventory.items) || {});
      newItems[itemId] = (parseInt(newItems[itemId] || 0, 10) || 0) + 1;

      await dbref.collection('economy').doc(ecoKey).set({ personal: newPersonal }, { merge: true });
      await dbref.collection('inventories').doc(STATE.inventoryKey).set({ items: newItems }, { merge: true });

      if (!STATE.inventory) STATE.inventory = {};
      STATE.inventory.items = newItems;
      flashToast('✓ ' + (def.name || itemId) + ' acheté !', 'success');
    } catch (e) {
      console.error('[dnn] buy failed', e);
      flashToast('⚠ Achat refusé : ' + (e.message || 'erreur'), 'error');
    }
  }

  /* ─── Anti-Hack craft ─── */
  function renderAntiHack(){
    var host = $('#antihack-content');
    if (!host) return;
    host.innerHTML = '';

    if (!_isEncodeur(STATE.activeChar)) {
      host.innerHTML =
        '<div class="dnn-empty">' +
          '<div class="dnn-empty-glyph">🔒</div>' +
          '<p>Réservé aux <strong>Encodeurs</strong>.</p>' +
          '<p class="dnn-empty-sub">Statut actuel : ' +
            esc(STATE.activeChar && STATE.activeChar.axiome_current || 'Néophyte') +
          '</p>' +
        '</div>';
      return;
    }

    var items = STATE.itemsCfg || {};
    var puceDef = items['puce_antihack'] || {};
    var inv = (STATE.inventory && STATE.inventory.items) || {};
    var owned = parseInt(inv['puce_antihack'] || 0, 10) || 0;

    var matsHtml = ANTIHACK_RECIPE.map(function(m){
      var have = parseInt(inv[m.id] || 0, 10) || 0;
      var ok = have >= m.qty;
      var matName = (items[m.id] && items[m.id].name) || m.id;
      return '<div class="dnn-anti-mat ' + (ok ? 'is-ok' : 'is-missing') + '">' +
        '<span>' + esc(matName) + '</span>' +
        '<span>' + have + ' / ' + m.qty + '</span>' +
      '</div>';
    }).join('');

    var canCraft = ANTIHACK_RECIPE.every(function(m){
      return (parseInt(inv[m.id] || 0, 10) || 0) >= m.qty;
    });

    host.innerHTML =
      '<div class="dnn-market-card" style="max-width:520px;margin:0 auto">' +
        '<div class="dnn-market-head">' +
          '<span class="dnn-market-icon">' + esc(puceDef.icon || '◆') + '</span>' +
          '<span class="dnn-market-name">' + esc(puceDef.name || 'Puce Anti-Hack') + '</span>' +
          '<span class="dnn-market-rarity">rare</span>' +
        '</div>' +
        '<div class="dnn-market-desc">' + esc(puceDef.description || '') + '</div>' +
        '<div style="font-family:Rajdhani;font-weight:600;font-size:0.8rem;letter-spacing:0.18em;text-transform:uppercase;color:#8a606c;margin:14px 0 8px">Matériaux requis :</div>' +
        '<div class="dnn-anti-mats">' + matsHtml + '</div>' +
        '<div class="dnn-market-foot">' +
          '<span class="dnn-market-price">En stock : ' + owned + '</span>' +
          '<button class="dnn-market-buy" id="craft-puce-btn" type="button"' + (canCraft ? '' : ' disabled') + '>Forger</button>' +
        '</div>' +
      '</div>';

    var btn = $('#craft-puce-btn');
    if (btn && canCraft) btn.addEventListener('click', craftPuceAntihack);
  }

  async function craftPuceAntihack(){
    var inv = STATE.inventory || { items: {} };
    var newItems = Object.assign({}, inv.items || {});
    for (var i = 0; i < ANTIHACK_RECIPE.length; i++) {
      var m = ANTIHACK_RECIPE[i];
      var have = parseInt(newItems[m.id] || 0, 10) || 0;
      if (have < m.qty) { flashToast('⚠ Matériaux manquants', 'error'); return; }
      newItems[m.id] = have - m.qty;
      if (newItems[m.id] <= 0) delete newItems[m.id];
    }
    newItems['puce_antihack'] = (parseInt(newItems['puce_antihack'] || 0, 10) || 0) + 1;

    var dbref = _getDb();
    try {
      await dbref.collection('inventories').doc(STATE.inventoryKey).set({ items: newItems }, { merge: true });
      inv.items = newItems;
      STATE.inventory = inv;
      renderAntiHack();
      flashToast('✓ Puce Anti-Hack forgée !', 'success');
    } catch (e) {
      console.error('[dnn] craft puce failed', e);
      flashToast('⚠ ' + (e.message || 'erreur'), 'error');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     HACK BANCAIRE
     ═══════════════════════════════════════════════════════════════════ */

  function _fmtRemaining(ms){
    if (ms <= 0) return 'Prêt';
    var days = Math.floor(ms / (24*3600*1000));
    var hours = Math.floor((ms % (24*3600*1000)) / (3600*1000));
    var mins = Math.floor((ms % (3600*1000)) / 60000);
    if (days > 0) return days + 'j ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + mins + 'm';
    if (mins > 0) return mins + 'm';
    return '< 1m';
  }

  function _hackCooldownRemaining(){
    var c = STATE.activeChar;
    var last = (c && parseInt(c.last_hack_attempt || 0, 10)) || 0;
    var elapsed = Date.now() - last;
    if (elapsed >= HACK_COOLDOWN_MS) return 0;
    return HACK_COOLDOWN_MS - elapsed;
  }

  async function loadHackTargets(){
    if (STATE.hackTargetsLoaded) return STATE.hackTargets;
    var dbref = _getDb();
    if (!dbref) return [];
    try {
      var snap = await dbref.collection('characters').get();
      var out = [];
      var myId = String(STATE.activeCharId || '');
      var myUid = _getUid();
      snap.forEach(function(d){
        var data = d.data() || {};
        if (!data || data._init) return;
        var id = d.id;
        if (String(id) === myId) return;
        /* On ne cible pas ses propres personnages */
        if (myUid && String(data.user_id) === String(myUid)) return;
        var name = ((data.first_name||'') + ' ' + (data.last_name||'')).trim();
        if (!name) name = String(id);
        out.push({
          id: id,
          name: name,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          class: data.class || '',
          race: data.race || data.race_category || '',
          level: parseInt(data.level || 0, 10) || 0,
          user_id: data.user_id
        });
      });
      out.sort(function(a, b){ return a.name.localeCompare(b.name, 'fr'); });
      STATE.hackTargets = out;
      STATE.hackTargetsLoaded = true;
      return out;
    } catch (e) {
      console.warn('[dnn] hack targets load failed:', e);
      return [];
    }
  }

  function renderHackTab(){
    var host = $('#hack-content');
    if (!host) return;

    if (!_isHacker(STATE.activeChar)) {
      host.innerHTML =
        '<div class="dnn-empty">' +
          '<div class="dnn-empty-glyph">🔒</div>' +
          '<p>Réservé aux <strong>Hackers</strong>.</p>' +
          '<p class="dnn-empty-sub">Axiome actuel : ' +
            esc(STATE.activeChar && STATE.activeChar.axiome_current || 'Néophyte') +
          '</p>' +
        '</div>';
      return;
    }

    var remaining = _hackCooldownRemaining();
    var ready = remaining === 0;
    var cdHtml =
      '<div class="dnn-hack-cooldown ' + (ready ? 'is-ready' : '') + '">' +
        '<div class="dnn-hack-cd-glyph">' + (ready ? '✓' : '⏳') + '</div>' +
        '<div class="dnn-hack-cd-info">' +
          '<div class="dnn-hack-cd-title">' + (ready ? 'Système prêt' : 'Cooldown actif') + '</div>' +
          '<div class="dnn-hack-cd-sub">' +
            (ready
              ? 'Tu peux lancer une tentative. <strong>1 hack tous les 7 jours.</strong>'
              : 'Prochaine tentative dans : <strong>' + _fmtRemaining(remaining) + '</strong>') +
          '</div>' +
        '</div>' +
      '</div>';

    var searchHtml =
      '<div class="dnn-hack-search">' +
        '<span class="dnn-hack-search-icon">▶ TARGET</span>' +
        '<input class="dnn-hack-search-input" id="hack-search-input" type="text" placeholder="Rechercher un personnage par nom..." autocomplete="off" />' +
      '</div>';

    host.innerHTML = cdHtml + searchHtml + '<div class="dnn-hack-targets" id="hack-targets-list"><div class="dnn-hack-empty">Chargement des cibles...</div></div>';

    /* Wire search */
    var input = $('#hack-search-input');
    if (input) {
      var deb = null;
      input.addEventListener('input', function(){
        clearTimeout(deb);
        deb = setTimeout(function(){ renderHackTargetsList(input.value || ''); }, 120);
      });
    }

    loadHackTargets().then(function(){
      renderHackTargetsList('');
    });
  }

  function renderHackTargetsList(query){
    var list = $('#hack-targets-list');
    if (!list) return;
    var q = (query || '').toLowerCase().trim();
    var ready = _hackCooldownRemaining() === 0;
    var filtered = STATE.hackTargets.filter(function(t){
      if (!q) return true;
      return t.name.toLowerCase().indexOf(q) !== -1 ||
             (t.class && t.class.toLowerCase().indexOf(q) !== -1);
    });
    if (filtered.length === 0) {
      list.innerHTML = '<div class="dnn-hack-empty">Aucune cible trouvée.</div>';
      return;
    }
    /* Limite à 60 résultats pour pas surcharger le DOM */
    filtered = filtered.slice(0, 60);
    var html = filtered.map(function(t){
      var disabled = !ready ? ' style="opacity:0.5;cursor:not-allowed;pointer-events:none"' : '';
      var meta = [];
      if (t.class) meta.push('<span><strong>' + esc(t.class) + '</strong></span>');
      if (t.race) meta.push('<span>' + esc(t.race) + '</span>');
      if (t.level) meta.push('<span>Niv. <strong>' + t.level + '</strong></span>');
      return '<div class="dnn-hack-target" data-id="' + esc(t.id) + '"' + disabled + '>' +
        '<div class="dnn-hack-target-head">' +
          '<span class="dnn-hack-target-name">' + esc(t.name) + '</span>' +
          '<span class="dnn-hack-target-id">#' + esc(String(t.id).slice(-6)) + '</span>' +
        '</div>' +
        '<div class="dnn-hack-target-meta">' + meta.join('') + '</div>' +
      '</div>';
    }).join('');
    list.innerHTML = html;
    list.querySelectorAll('.dnn-hack-target').forEach(function(el){
      el.addEventListener('click', function(){
        if (!ready) return;
        var id = el.dataset.id;
        var target = STATE.hackTargets.find(function(x){ return String(x.id) === String(id); });
        if (target) openHackModal(target);
      });
    });
  }

  /* ─── Modal Hack ─── */
  function wireHackModal(){
    var close = $('#hack-modal-close');
    var bg = $('#hack-modal-bg');
    if (close) close.addEventListener('click', closeHackModal);
    if (bg) bg.addEventListener('click', closeHackModal);
  }

  function openHackModal(target){
    STATE.hackCurrentTarget = target;
    STATE.hackCurrentTargetId = target.id;
    $('#hack-modal').hidden = false;
    renderHackStepConfirm();
  }

  function closeHackModal(){
    if (STATE.hackCodeTimer) {
      clearInterval(STATE.hackCodeTimer);
      STATE.hackCodeTimer = null;
    }
    $('#hack-modal').hidden = true;
    STATE.hackCurrentTarget = null;
    STATE.hackCurrentTargetId = null;
    STATE.hackBusy = false;
  }

  function renderHackStepConfirm(){
    var t = STATE.hackCurrentTarget;
    if (!t) return;
    var host = $('#hack-modal-content');
    host.innerHTML =
      '<div class="dnn-hack-step-head">' +
        '<div class="dnn-hack-step-kanji">武士</div>' +
        '<div class="dnn-hack-step-title">CIBLE VERROUILLÉE</div>' +
        '<div class="dnn-hack-step-sub">Vérifie les informations avant breach</div>' +
      '</div>' +
      '<div class="dnn-hack-target-card">' +
        '<div class="dnn-hack-target-card-row"><span>Identité</span><span>' + esc(t.name) + '</span></div>' +
        (t.class ? '<div class="dnn-hack-target-card-row"><span>Classe</span><span>' + esc(t.class) + '</span></div>' : '') +
        (t.race ? '<div class="dnn-hack-target-card-row"><span>Race</span><span>' + esc(t.race) + '</span></div>' : '') +
        '<div class="dnn-hack-target-card-row"><span>ID Compte</span><span style="font-family:Courier New,monospace">#' + esc(String(t.id).slice(-8)) + '</span></div>' +
      '</div>' +
      '<div class="dnn-hack-roll">' +
        '<div class="dnn-hack-roll-line"><span>Chance de base</span><span>' + HACK_BASE_CHANCE + '%</span></div>' +
        '<div class="dnn-hack-roll-line"><span>Bonus minijeu (réussite)</span><span>+' + HACK_MINIGAME_BONUS + '%</span></div>' +
        '<div class="dnn-hack-roll-line"><span>Malus minijeu (échec)</span><span>-' + HACK_MINIGAME_MALUS + '%</span></div>' +
        '<div class="dnn-hack-roll-line"><span>Transfert en cas de succès</span><span>' + Math.round(HACK_TRANSFER_RATE * 100) + '% des fonds</span></div>' +
      '</div>' +
      '<div class="dnn-hack-actions">' +
        '<button class="dnn-hack-btn dnn-hack-btn-ghost" id="hack-cancel-btn" type="button">Annuler</button>' +
        '<button class="dnn-hack-btn" id="hack-start-btn" type="button">▶ Lancer le breach</button>' +
      '</div>';
    $('#hack-cancel-btn').addEventListener('click', closeHackModal);
    $('#hack-start-btn').addEventListener('click', renderHackStepCode);
  }

  function _randomHexCode(len){
    var chars = '0123456789ABCDEF';
    var out = '';
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function renderHackStepCode(){
    STATE.hackCode = _randomHexCode(6);
    STATE.hackCodeStart = Date.now();
    var host = $('#hack-modal-content');
    host.innerHTML =
      '<div class="dnn-hack-step-head">' +
        '<div class="dnn-hack-step-kanji">武士</div>' +
        '<div class="dnn-hack-step-title">BREACH PROTOCOL</div>' +
        '<div class="dnn-hack-step-sub">Reproduis le code en moins de ' + (HACK_CODE_DURATION/1000) + 's</div>' +
      '</div>' +
      '<div class="dnn-hack-code-zone">' +
        '<div class="dnn-hack-code-label">Code de bypass</div>' +
        '<div class="dnn-hack-code-display">' + STATE.hackCode + '</div>' +
        '<input class="dnn-hack-code-input" id="hack-code-input" type="text" maxlength="6" autocomplete="off" spellcheck="false" />' +
        '<div class="dnn-hack-timer">' +
          '<span>⏱</span>' +
          '<div class="dnn-hack-timer-bar"><div class="dnn-hack-timer-bar-fill" id="hack-timer-fill" style="width:100%"></div></div>' +
          '<span id="hack-timer-text">' + (HACK_CODE_DURATION/1000).toFixed(1) + 's</span>' +
        '</div>' +
      '</div>' +
      '<div class="dnn-hack-actions">' +
        '<button class="dnn-hack-btn dnn-hack-btn-ghost" id="hack-cancel2-btn" type="button">Abandonner</button>' +
      '</div>';

    $('#hack-cancel2-btn').addEventListener('click', closeHackModal);

    var input = $('#hack-code-input');
    input.focus();
    input.addEventListener('input', function(){
      input.value = input.value.toUpperCase().replace(/[^0-9A-F]/g, '');
      if (input.value.length === STATE.hackCode.length) {
        var ok = (input.value === STATE.hackCode);
        if (STATE.hackCodeTimer) { clearInterval(STATE.hackCodeTimer); STATE.hackCodeTimer = null; }
        input.disabled = true;
        input.classList.add(ok ? 'is-ok' : 'is-bad');
        setTimeout(function(){ executeHack(ok); }, 700);
      }
    });

    /* Timer */
    STATE.hackCodeTimer = setInterval(function(){
      var elapsed = Date.now() - STATE.hackCodeStart;
      var remaining = Math.max(0, HACK_CODE_DURATION - elapsed);
      var pct = (remaining / HACK_CODE_DURATION) * 100;
      var fill = $('#hack-timer-fill');
      var txt = $('#hack-timer-text');
      if (fill) fill.style.width = pct + '%';
      if (txt) txt.textContent = (remaining/1000).toFixed(1) + 's';
      if (remaining <= 0) {
        clearInterval(STATE.hackCodeTimer);
        STATE.hackCodeTimer = null;
        var inp = $('#hack-code-input');
        if (inp) {
          inp.disabled = true;
          inp.classList.add('is-bad');
        }
        setTimeout(function(){ executeHack(false); }, 600);
      }
    }, 80);
  }

  /* ─── Exécution du hack ─── */
  async function executeHack(minigameSuccess){
    if (STATE.hackBusy) return;
    STATE.hackBusy = true;

    var host = $('#hack-modal-content');
    host.innerHTML =
      '<div class="dnn-hack-step-head">' +
        '<div class="dnn-hack-step-kanji">武士</div>' +
        '<div class="dnn-hack-step-title">EXÉCUTION...</div>' +
        '<div class="dnn-hack-step-sub">Injection du payload dans le compte cible</div>' +
      '</div>' +
      '<div style="text-align:center;padding:40px 0;color:#ff3050;font-family:Orbitron;letter-spacing:0.3em">[ BREACHING ]</div>';

    var dbref = _getDb();
    var target = STATE.hackCurrentTarget;
    var targetId = STATE.hackCurrentTargetId;
    var myCharId = STATE.activeCharId;
    var myUid = _getUid();

    try {
      /* 1) Re-fetch target & target inventory + economy pour avoir l'état frais */
      var [tCharSnap, tInvSnap, tEcoSnap] = await Promise.all([
        dbref.collection('characters').doc(String(targetId)).get(),
        dbref.collection('inventories').doc(target.user_id + '_' + targetId).get(),
        dbref.collection('economy').doc(target.user_id + '_' + targetId).get()
      ]);

      if (!tCharSnap.exists) {
        await _renderHackResult('fail', 'Cible introuvable', 'La cible n\'existe plus.');
        return;
      }
      var tChar = tCharSnap.data() || {};
      var tInv = tInvSnap.exists ? (tInvSnap.data() || {}) : {};
      var tEco = tEcoSnap.exists ? (tEcoSnap.data() || {}) : { personal: {} };
      var tInvItems = tInv.items || {};

      /* 2) Calcul de la chance finale */
      var chance = HACK_BASE_CHANCE;
      chance += minigameSuccess ? HACK_MINIGAME_BONUS : -HACK_MINIGAME_MALUS;
      chance = Math.max(0, Math.min(100, chance));
      var roll = Math.random() * 100;
      var hackWorked = roll < chance;

      /* 3) Anti-Hack chip auto-consume — bloque toute tentative (même réussie) */
      var hasPuce = (parseInt(tInvItems['puce_antihack'] || 0, 10) || 0) > 0;
      var blocked = false;
      if (hasPuce) {
        blocked = true;
        /* Consommer la puce */
        var newTInvItems = Object.assign({}, tInvItems);
        newTInvItems['puce_antihack'] = (newTInvItems['puce_antihack'] || 1) - 1;
        if (newTInvItems['puce_antihack'] <= 0) delete newTInvItems['puce_antihack'];
        await dbref.collection('inventories').doc(target.user_id + '_' + targetId)
          .set({ items: newTInvItems }, { merge: true });
      }

      /* 4) Update cooldown du hacker (toujours, même blocked) */
      await dbref.collection('characters').doc(String(myCharId)).set({
        last_hack_attempt: Date.now(),
        updated_at: Date.now()
      }, { merge: true });
      if (STATE.activeChar) {
        STATE.activeChar.last_hack_attempt = Date.now();
      }

      /* 5) Alerte cible (toujours envoyée, sauf si bloquée ET hack aurait raté de toute façon ? Non : on prévient toujours) */
      var hackerName = STATE.activeChar ?
        (((STATE.activeChar.first_name||'') + ' ' + (STATE.activeChar.last_name||'')).trim() || 'Inconnu') :
        'Inconnu';

      var existingAlerts = Array.isArray(tChar.hack_alerts) ? tChar.hack_alerts : [];

      /* 6) Branches */
      if (blocked) {
        var alertBlocked = {
          at: Date.now(),
          outcome: 'blocked',
          hacker_id: String(myCharId),
          hacker_name: hackerName,
          msg: 'Une tentative de hack a été bloquée par ta Puce Anti-Hack.'
        };
        existingAlerts.push(alertBlocked);
        await dbref.collection('characters').doc(String(targetId)).set({
          hack_alerts: existingAlerts
        }, { merge: true });
        await _renderHackResult('blocked',
          'Bloqué',
          'La cible possédait une <strong>Puce Anti-Hack</strong>. Elle a absorbé l\'attaque.<br><br>' +
          '<em style="color:#8a606c">Roll : ' + Math.round(roll) + ' / ' + chance + '% — sans importance, la puce a tout bloqué.</em>'
        );
        return;
      }

      if (!hackWorked) {
        var alertFail = {
          at: Date.now(),
          outcome: 'fail',
          hacker_id: String(myCharId),
          hacker_name: hackerName,
          msg: 'Une tentative de hack a échoué, mais ton identité a été révélée à la cible.'
        };
        existingAlerts.push(alertFail);
        await dbref.collection('characters').doc(String(targetId)).set({
          hack_alerts: existingAlerts
        }, { merge: true });
        await _renderHackResult('fail',
          'Échec',
          'Le système a détecté l\'intrusion. Ton identité est révélée à la cible.<br><br>' +
          '<em style="color:#8a606c">Roll : ' + Math.round(roll) + ' / ' + chance + '%</em>'
        );
        return;
      }

      /* SUCCESS — transfert des fonds */
      var personal = tEco.personal || {};
      var transferred = {};
      var newTPersonal = Object.assign({}, personal);
      HACK_CURRENCIES.forEach(function(cur){
        var bal = parseInt(personal[cur] || 0, 10) || 0;
        var take = Math.floor(bal * HACK_TRANSFER_RATE);
        if (take > 0) {
          transferred[cur] = take;
          newTPersonal[cur] = bal - take;
        }
      });

      /* Update target economy */
      await dbref.collection('economy').doc(target.user_id + '_' + targetId)
        .set({ personal: newTPersonal }, { merge: true });

      /* Read hacker economy + credit */
      var myEcoKey = _invKey(myUid, myCharId);
      var myEcoSnap = await dbref.collection('economy').doc(myEcoKey).get();
      var myEco = myEcoSnap.exists ? (myEcoSnap.data() || {}) : { personal: {} };
      var myPersonal = Object.assign({}, myEco.personal || {});
      Object.keys(transferred).forEach(function(cur){
        var have = parseInt(myPersonal[cur] || 0, 10) || 0;
        myPersonal[cur] = have + transferred[cur];
      });
      await dbref.collection('economy').doc(myEcoKey)
        .set({ personal: myPersonal }, { merge: true });

      /* Alerte cible — succès (cible voit qu'elle a été volée + montant + hacker) */
      var alertWin = {
        at: Date.now(),
        outcome: 'success',
        hacker_id: String(myCharId),
        hacker_name: hackerName,
        transferred: transferred,
        msg: 'Ton compte a été piraté. Une partie de tes fonds a été dérobée.'
      };
      existingAlerts.push(alertWin);
      await dbref.collection('characters').doc(String(targetId)).set({
        hack_alerts: existingAlerts
      }, { merge: true });

      await _renderHackResult('success',
        'Breach réussi',
        'Les fonds ont été transférés sur ton compte personnel.<br><br>' +
        '<em style="color:#8a606c">Roll : ' + Math.round(roll) + ' / ' + chance + '%</em>',
        transferred
      );

    } catch (e) {
      console.error('[dnn] hack execution failed', e);
      await _renderHackResult('fail', 'Erreur Système',
        'Le breach a planté côté serveur : ' + esc(e.message || 'erreur inconnue') + '<br><br>' +
        '<em style="color:#8a606c">Aucun fonds transféré.</em>');
    } finally {
      STATE.hackBusy = false;
    }
  }

  function _formatCurrency(cur){
    return cur.replace('_kanite','').toUpperCase() + ' K';
  }

  function _renderHackResult(kind, title, htmlText, transferred){
    var host = $('#hack-modal-content');
    var glyph = kind === 'success' ? '✓' : (kind === 'blocked' ? '◆' : '✕');
    var lootHtml = '';
    if (kind === 'success' && transferred && Object.keys(transferred).length > 0) {
      var rows = Object.keys(transferred).map(function(cur){
        return '<div class="dnn-hack-loot-row">' +
          '<span>' + esc(_formatCurrency(cur)) + '</span>' +
          '<strong>+' + transferred[cur].toLocaleString() + '</strong>' +
        '</div>';
      }).join('');
      lootHtml = '<div class="dnn-hack-loot">' + rows + '</div>';
    } else if (kind === 'success') {
      lootHtml = '<div class="dnn-hack-loot"><div class="dnn-hack-loot-row"><span>—</span><strong>Compte vide</strong></div></div>';
    }
    host.innerHTML =
      '<div class="dnn-hack-result is-' + kind + '">' +
        '<div class="dnn-hack-result-glyph">' + glyph + '</div>' +
        '<div class="dnn-hack-result-title">' + esc(title) + '</div>' +
        '<div class="dnn-hack-result-text">' + htmlText + '</div>' +
        lootHtml +
      '</div>' +
      '<div class="dnn-hack-actions">' +
        '<button class="dnn-hack-btn" id="hack-done-btn" type="button">Fermer</button>' +
      '</div>';
    $('#hack-done-btn').addEventListener('click', function(){
      closeHackModal();
      renderHackTab();  /* Refresh cooldown */
    });
    return Promise.resolve();
  }

  /* ─── Toast ─── */
  function flashToast(msg, kind){
    var t = document.createElement('div');
    t.textContent = msg;
    var color = kind === 'error' ? '#ff1a3a' : (kind === 'success' ? '#5fb878' : '#ff3050');
    t.style.cssText =
      'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);' +
      'padding:12px 22px;font-family:Rajdhani,sans-serif;font-weight:600;font-size:0.9rem;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'background:rgba(8,2,10,0.95);border:1px solid ' + color +
      ';color:' + color +
      ';z-index:2000;box-shadow:0 10px 30px rgba(0,0,0,0.6);';
    document.body.appendChild(t);
    setTimeout(function(){ try { t.remove(); } catch(_){} }, 4500);
  }

  /* ═══════════════════════════════════════════════════════════════════
     STATES (gate / no-session / no-char)
     ═══════════════════════════════════════════════════════════════════ */
  function showState(glyph, title, text){
    ['phase-boot','phase-glitch','phase-game','phase-menu'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    $('#state-glyph').textContent = glyph;
    $('#state-title').textContent = title;
    $('#state-text').innerHTML = text;
    $('#phase-state').hidden = false;
  }

  /* ═══════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════ */
  async function init(){
    /* Charge data en parallèle du boot */
    var dataPromise = (async function(){
      await Promise.all([loadItemsConfig(), loadActiveChar()]);
      if (STATE.activeChar) await loadInventory();
    })();

    /* Wire start button du minijeu */
    var startBtn = $('#game-start');
    if (startBtn) startBtn.addEventListener('click', startGame);

    /* Run boot ~2.6s */
    await runBoot();
    await dataPromise;

    /* Gate check */
    if (STATE.noSession) {
      showState('⚠', 'Session Expirée',
        'Connecte-toi via <code>/link</code> sur Discord puis ouvre le <a href="hub.html">Hub</a>.');
      return;
    }
    if (!STATE.activeChar) {
      showState('◇', 'Aucun Personnage', 'Crée un personnage via Discord d\'abord.');
      return;
    }
    if (!_hasDarknetAccess(STATE.activeChar)) {
      showState('⚠', 'Accès Refusé',
        'Le DarkNexusNet est réservé aux <strong>Hackers</strong> (T2 Décrypteur, Android) et <strong>Encodeurs</strong> (T2 Décrypteur, Android).<br><br>' +
        'Axiome actuel : <strong>' + esc(STATE.activeChar.axiome_current || 'Néophyte') + '</strong>');
      return;
    }

    /* Glitch title (3.5s) puis minijeu */
    await showGlitchTitle();
    $('#phase-glitch').hidden = true;
    $('#phase-game').hidden = false;
    buildGameGrid();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

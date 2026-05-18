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
    /* minijeu */
    gameSequence: [],
    gamePlayer: [],
    gameAttempts: 3,
    gameAttemptCurrent: 0,
    gameAllowInput: false
  };

  var DARKNET_ITEMS = [
    /* Items du Marché Noir : ID dans config/items + prix HRP */
    'puce_antihack',
    'fragment_darknexus'
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
    renderMarket();
    renderAntiHack();
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

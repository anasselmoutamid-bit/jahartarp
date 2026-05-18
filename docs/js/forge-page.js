/* ═══════════════════════════════════════════════════════════════════════
   forge-page.js — Page Forge v1 (Créer tab fonctionnel)
   - Lit data/forge_recipes.json + config/items + char + inventory
   - Détermine rareté max forgeable selon axiome_current
   - Render recipes accessibles + matériaux dispo
   - Craft : consume materials → add item to inventory
   Améliorer + Runique : tabs présentes, logique en attente.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STATE = {
    activeChar: null,
    activeCharId: null,
    recipes: null,
    rarityOrder: [],
    tierRarityMax: {},
    forgeronStatus: {},
    itemsCfg: null,        /* config/items.items + .equipment + ... */
    inventory: null,       /* inventory pour activeChar */
    inventoryKey: null,
    noSession: false,
    fetchError: null,
    activeTab: 'create',
    pendingRecipe: null    /* recipe target id for confirm modal */
  };

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

  /* ─── Helpers session/DB ─── */
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

  /* ─── Forge status (rareté max selon axiome) ─── */
  function _forgeronStatus(c){
    /* Renvoie { tier, label, code } selon l'axiome courant.
       code utilisé pour lookup _tier_rarity_max. */
    if (!c) return { code: 'base', label: 'Non-Forgeron', tier: 0 };
    var cur = c.axiome_current || c.axiome || null;
    if (!cur || cur === 'neophyte') return { code: 'base', label: 'Néophyte', tier: 0 };
    var info = STATE.forgeronStatus[cur];
    if (!info) {
      /* Non-Forgeron mais avec un axiome quelconque : base = Epic */
      return { code: 'base', label: 'Base', tier: 0 };
    }
    /* T1 Forgeron / Héritier Baldun → code forgeron_t1
       T2 ArcanoForgeron / Initié Baldun → code forgeron_t2
       (Tier supérieur quand T3+ sera défini) */
    var code = 'forgeron_t' + (info.tier || 1);
    return { code: code, label: info.label, tier: info.tier || 1 };
  }

  function _maxRarityIndex(statusCode){
    var maxR = STATE.tierRarityMax[statusCode];
    if (!maxR) maxR = STATE.tierRarityMax.base || 'epic';
    var i = STATE.rarityOrder.indexOf(maxR);
    return i < 0 ? STATE.rarityOrder.length - 1 : i;
  }

  function _rarityIndex(r){
    return STATE.rarityOrder.indexOf(String(r || '').toLowerCase());
  }

  /* ─── Data loaders ─── */
  function loadRecipes(){
    return fetch('data/forge_recipes.json?v=1')
      .then(function(r){ if (!r.ok) throw new Error('forge_recipes ' + r.status); return r.json(); })
      .then(function(j){
        STATE.recipes = j.recipes || {};
        STATE.rarityOrder = j._rarity_order || [];
        STATE.tierRarityMax = j._tier_rarity_max || {};
        STATE.forgeronStatus = j._forgeron_status || {};
        return j;
      });
  }

  function loadItemsConfig(){
    var dbref = _getDb();
    if (!dbref) return Promise.resolve(null);
    return dbref.collection('config').doc('items').get().then(function(snap){
      if (!snap.exists) return null;
      var data = snap.data() || {};
      /* Fusionne items + equipment + food_items + consumable_items dans un seul map. */
      var merged = {};
      ['items','equipment','food_items','consumable_items'].forEach(function(sec){
        if (data[sec] && typeof data[sec] === 'object') {
          Object.entries(data[sec]).forEach(function(kv){ merged[kv[0]] = kv[1]; });
        }
      });
      STATE.itemsCfg = merged;
      return merged;
    }).catch(function(e){
      console.warn('[forge] items config load failed:', e);
      return null;
    });
  }

  /* Lit ?char=<id> de l'URL pour overrider l'active_characters. */
  function _getCharParam(){
    try {
      var m = location.search.match(/[?&]char=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch(_) { return null; }
  }

  /* Charge tous les chars du user pour le switcher. */
  async function loadAllChars(){
    var dbref = _getDb();
    var uid = _getUid();
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
      console.warn('[forge] chars list fetch failed:', e);
      STATE.chars = [];
      return [];
    }
  }

  /* Charge le char actif : priorité au ?char=<id> URL, sinon active_characters,
     sinon premier char du user en fallback. */
  async function loadActiveChar(){
    var dbref = _getDb();
    var uid = _getUid();
    STATE.noSession = !uid;
    if (!dbref || !uid) return null;

    /* 1. Override URL ?char=<id> */
    var paramId = _getCharParam();
    if (paramId) {
      try {
        var cs = await dbref.collection('characters').doc(String(paramId)).get();
        if (cs.exists) {
          var data = cs.data() || {};
          if (String(data.user_id) === String(uid)) { /* sécurité : pas un char d'un autre user */
            STATE.activeCharId = paramId;
            STATE.activeChar = Object.assign({ _id: paramId, id: paramId }, data);
            return STATE.activeChar;
          }
        }
      } catch (e) { console.warn('[forge] ?char= load failed:', e); }
    }

    /* 2. active_characters/{uid} */
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
    } catch (e) { console.warn('[forge] active_characters load failed:', e); }

    /* 3. Fallback : premier char du user */
    var allChars = await loadAllChars();
    if (allChars && allChars.length) {
      var first = allChars[0];
      STATE.activeCharId = first._id || first.id;
      STATE.activeChar = first;
      return first;
    }

    return null;
  }

  function _invKey(uid, charId){ return uid + '_' + charId; }

  function loadInventory(){
    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid || !STATE.activeCharId) return Promise.resolve(null);
    var key = _invKey(uid, STATE.activeCharId);
    STATE.inventoryKey = key;
    return dbref.collection('inventories').doc(key).get().then(function(snap){
      STATE.inventory = snap.exists ? (snap.data() || {}) : { items: {}, equipped_assets: [] };
      if (!STATE.inventory.items) STATE.inventory.items = {};
      if (!STATE.inventory.item_upgrades) STATE.inventory.item_upgrades = {};
      if (!STATE.inventory.item_runes) STATE.inventory.item_runes = {};
      return STATE.inventory;
    }).catch(function(e){
      console.warn('[forge] inventory load failed:', e);
      STATE.inventory = { items: {}, equipped_assets: [], item_upgrades: {}, item_runes: {} };
      return STATE.inventory;
    });
  }

  /* ─── Helpers items / stats ─── */
  function _itemEquipment(itemId){
    var item = (STATE.itemsCfg || {})[itemId];
    if (!item) return null;
    var t = (item.type || '').toLowerCase();
    if (t === 'equipment' || t === 'weapon' || item.slot) return item;
    return null;
  }

  function _itemHighestStat(item){
    var effs = item && item.stat_effects;
    if (!effs || typeof effs !== 'object') return 0;
    var max = 0;
    Object.values(effs).forEach(function(v){
      var n = parseInt(String(v).replace(/[^\-0-9]/g, ''), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return max;
  }

  function _hasRuniqueAccess(c){
    if (!c) return false;
    var cur = c.axiome_current || c.axiome || null;
    return cur === 'arcano_forgeron' || cur === 'initie_baldun';
  }
  /* Accès Améliorer : Forgerons (T1+) + Héritiers de Baldun (T1+). */
  function _hasAmeliorationAccess(c){
    if (!c) return false;
    var cur = c.axiome_current || c.axiome || null;
    return cur === 'forgeron' || cur === 'arcano_forgeron'
        || cur === 'heritier_baldun' || cur === 'initie_baldun';
  }

  function STAR(filled){ return filled ? '★' : '☆'; }
  function _stars(n){
    var s = '';
    for (var i = 0; i < 5; i++) s += STAR(i < (n || 0));
    return s;
  }
  function _starsHtml(n){
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<span class="forge-star ' + (i < n ? 'is-filled' : '') + '">' + (i < n ? '★' : '☆') + '</span>';
    }
    return html;
  }

  function _STATS_LABEL(){
    return {
      strength: 'Force', agility: 'Agilité', speed: 'Vitesse',
      intelligence: 'Intelligence', mana: 'Mana', resistance: 'Résistance',
      charisma: 'Charisme', aura: 'Aura'
    };
  }

  /* ─── View routing ─── */
  function showState(id){
    ['state-loading','state-no-session','state-no-chars'].forEach(function(s){
      var el = document.getElementById(s);
      if (el) el.hidden = (s !== id);
    });
    var main = $('#view-main');
    if (main) main.hidden = true;
  }

  function showMain(){
    ['state-loading','state-no-session','state-no-chars'].forEach(function(s){
      var el = document.getElementById(s);
      if (el) el.hidden = true;
    });
    $('#view-main').hidden = false;
  }

  /* ─── Char chip + switcher ─── */
  function updateCharChip(){
    var chip = $('#forge-char-chip');
    var c = STATE.activeChar;
    if (!chip || !c) { if (chip) chip.hidden = true; return; }
    chip.hidden = false;
    var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Personnage';
    var lvl = parseInt(c.level || 0, 10) || 0;
    var race = c.class || c.race_specific || '—';
    $('#forge-chip-name').textContent = name;
    $('#forge-chip-meta').textContent = 'LVL ' + lvl + ' · ' + race;
    var caret = $('#forge-chip-caret');
    if (caret) caret.style.visibility = (STATE.chars && STATE.chars.length > 1) ? '' : 'hidden';
  }

  function renderCharSwitchGrid(){
    var grid = $('#charswitch-grid');
    if (!grid) return;
    grid.innerHTML = '';
    (STATE.chars || []).forEach(function(c){
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'forge-char-card';
      var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Personnage';
      var lvl = parseInt(c.level || 0, 10) || 0;
      var race = c.class || c.race_specific || '—';
      var cur = c.axiome_current || c.axiome || null;
      var status = cur && cur !== 'neophyte'
        ? (STATE.forgeronStatus[cur] ? STATE.forgeronStatus[cur].label : 'Non-Forgeron')
        : 'Néophyte';
      var img = c.profile_image || '';
      var portrait = img
        ? '<img src="' + esc(img) + '" alt="" onerror="this.style.display=\'none\'">'
        : '👤';
      card.innerHTML =
        '<div class="forge-char-portrait">' + portrait + '</div>' +
        '<div class="forge-char-name">' + esc(name) + '</div>' +
        '<div class="forge-char-meta">LVL ' + lvl + ' · ' + esc(race) + '</div>' +
        '<div class="forge-char-status">' + esc(status) + '</div>';
      card.addEventListener('click', function(){
        /* Recharge la page avec ?char=<id> pour que loadActiveChar le picke. */
        var id = c._id || c.id;
        if (!id) return;
        var url = new URL(location.href);
        url.searchParams.set('char', id);
        location.href = url.toString();
      });
      grid.appendChild(card);
    });
  }

  function openCharSwitchModal(){
    if (!STATE.chars || STATE.chars.length <= 1) return;
    renderCharSwitchGrid();
    $('#charswitch-modal').hidden = false;
  }

  /* ─── Status banner + rareté max ─── */
  function renderStatusBanner(){
    var c = STATE.activeChar;
    var status = _forgeronStatus(c);
    $('#forge-status-value').textContent = status.label;

    var maxR = STATE.tierRarityMax[status.code] || 'epic';
    var capEl = $('#forge-cap-value');
    capEl.textContent = maxR.toUpperCase();
    capEl.className = 'forge-cap-value r-' + maxR;
  }

  /* ─── Tabs ─── */
  function wireTabs(){
    $$('.forge-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        var tab = btn.dataset.tab;
        if (!tab) return;
        STATE.activeTab = tab;
        $$('.forge-tab').forEach(function(b){ b.classList.toggle('is-active', b === btn); });
        $$('.forge-tab-content').forEach(function(c){
          c.classList.toggle('is-active', c.id === 'tab-' + tab);
          c.hidden = (c.id !== 'tab-' + tab);
        });
        /* Render le tab actif (au cas où l'inventaire a changé) */
        if (tab === 'improve') renderImproveTab();
        else if (tab === 'runic') renderRunicTab();
      });
    });
  }

  /* ─── Recipes grid (Créer tab) ─── */
  function renderRecipes(){
    var grid = $('#recipes-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var status = _forgeronStatus(STATE.activeChar);
    var maxIdx = _maxRarityIndex(status.code);
    var inventory = (STATE.inventory && STATE.inventory.items) || {};
    var items = STATE.itemsCfg || {};

    var recipeIds = Object.keys(STATE.recipes || {});
    if (!recipeIds.length) {
      grid.innerHTML = '<div class="forge-coming-soon"><div class="forge-coming-glyph">⚒</div><p>Aucune recette définie.</p></div>';
      return;
    }

    /* Tri par rareté croissante */
    recipeIds.sort(function(a, b){
      var ra = _rarityIndex(items[a] && items[a].rarity);
      var rb = _rarityIndex(items[b] && items[b].rarity);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });

    recipeIds.forEach(function(targetId){
      var recipe = STATE.recipes[targetId];
      var target = items[targetId];
      var targetRarity = (target && target.rarity) || 'common';
      var rarityIdx = _rarityIndex(targetRarity);
      var locked = rarityIdx > maxIdx;

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'forge-recipe-card';
      card.dataset.id = targetId;
      if (locked) card.classList.add('is-locked');

      var icon = (target && target.icon) || '⚒';
      var name = (target && target.name) || targetId;

      var matsHtml = recipe.materials.map(function(m){
        var have = parseInt(inventory[m.id] || 0, 10) || 0;
        var ok = have >= m.qty;
        var matName = (items[m.id] && items[m.id].name) || m.id;
        return '<div class="forge-mat-line ' + (ok ? 'is-ok' : 'is-missing') + '">' +
          '<span class="forge-mat-name">' + esc(matName) + '</span>' +
          '<span class="forge-mat-qty">' + have + ' / ' + m.qty + '</span>' +
        '</div>';
      }).join('');

      var canCraft = !locked && recipe.materials.every(function(m){
        return (parseInt(inventory[m.id] || 0, 10) || 0) >= m.qty;
      });
      if (canCraft) card.classList.add('can-craft');

      var statusTxt = locked
        ? '🔒 Rareté ' + targetRarity.toUpperCase() + ' verrouillée (statut : ' + status.label + ')'
        : (canCraft ? '✓ Matériaux OK · clique pour forger' : 'Matériaux manquants');

      card.innerHTML =
        '<div class="forge-recipe-head">' +
          '<span class="forge-recipe-icon">' + esc(icon) + '</span>' +
          '<span class="forge-recipe-name">' + esc(name) + '</span>' +
          '<span class="forge-recipe-rarity r-' + esc(targetRarity) + '">' + esc(targetRarity) + '</span>' +
        '</div>' +
        '<div class="forge-recipe-mats">' + matsHtml + '</div>' +
        '<div class="forge-recipe-status">' + statusTxt + '</div>';

      card.addEventListener('click', function(){
        if (locked) return;
        openCraftModal(targetId);
      });
      grid.appendChild(card);
    });
  }

  /* ─── Craft modal ─── */
  function openCraftModal(targetId){
    var recipe = STATE.recipes[targetId];
    var target = (STATE.itemsCfg || {})[targetId] || {};
    if (!recipe) return;
    STATE.pendingRecipe = targetId;

    $('#craft-icon').textContent = target.icon || '⚒';
    $('#craft-title').textContent = target.name || targetId;
    var rarity = target.rarity || 'common';
    var kindEl = $('#craft-rarity');
    kindEl.textContent = rarity.toUpperCase();
    kindEl.className = 'forge-modal-kind r-' + rarity;
    $('#craft-desc').textContent = target.description || 'Item à forger.';

    var inventory = (STATE.inventory && STATE.inventory.items) || {};
    var items = STATE.itemsCfg || {};
    var matsEl = $('#craft-mats');
    matsEl.innerHTML = recipe.materials.map(function(m){
      var have = parseInt(inventory[m.id] || 0, 10) || 0;
      var ok = have >= m.qty;
      var matName = (items[m.id] && items[m.id].name) || m.id;
      return '<div class="forge-mat-line ' + (ok ? 'is-ok' : 'is-missing') + '">' +
        '<span class="forge-mat-name">' + esc(matName) + '</span>' +
        '<span class="forge-mat-qty">' + have + ' / ' + m.qty + '</span>' +
      '</div>';
    }).join('');

    var canCraft = recipe.materials.every(function(m){
      return (parseInt(inventory[m.id] || 0, 10) || 0) >= m.qty;
    });
    var btn = $('#craft-confirm-btn');
    var lbl = $('#craft-confirm-label');
    if (canCraft) {
      lbl.textContent = 'Forger';
      btn.disabled = false;
    } else {
      lbl.textContent = '🔒 Matériaux manquants';
      btn.disabled = true;
    }

    $('#craft-modal').hidden = false;
  }

  function closeAllModals(){
    $$('.forge-modal').forEach(function(m){ m.hidden = true; });
    STATE.pendingRecipe = null;
  }

  /* ─── Craft action ─── */
  async function craftItem(){
    var targetId = STATE.pendingRecipe;
    if (!targetId) { closeAllModals(); return; }
    var recipe = STATE.recipes[targetId];
    if (!recipe) { closeAllModals(); return; }

    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid || !STATE.activeCharId) { closeAllModals(); return; }

    /* Re-check materials */
    var inv = STATE.inventory || { items: {} };
    var ok = recipe.materials.every(function(m){
      return (parseInt((inv.items || {})[m.id] || 0, 10) || 0) >= m.qty;
    });
    if (!ok) { flashToast('⚠ Matériaux insuffisants', 'error'); closeAllModals(); return; }

    /* Vérifier rareté max */
    var status = _forgeronStatus(STATE.activeChar);
    var maxIdx = _maxRarityIndex(status.code);
    var targetItem = (STATE.itemsCfg || {})[targetId];
    var rIdx = _rarityIndex(targetItem && targetItem.rarity);
    if (rIdx > maxIdx) { flashToast('🔒 Rareté trop haute pour ton statut Forge', 'error'); closeAllModals(); return; }

    /* Optimistic update */
    var newItems = Object.assign({}, inv.items || {});
    recipe.materials.forEach(function(m){
      newItems[m.id] = (parseInt(newItems[m.id] || 0, 10) || 0) - m.qty;
      if (newItems[m.id] <= 0) delete newItems[m.id];
    });
    newItems[targetId] = (parseInt(newItems[targetId] || 0, 10) || 0) + 1;

    var prevItems = inv.items;
    inv.items = newItems;
    STATE.inventory = inv;
    closeAllModals();
    renderRecipes();

    try {
      await dbref.collection('inventories').doc(STATE.inventoryKey).update({
        items: newItems
      });
      flashToast('✓ ' + (targetItem && targetItem.name || targetId) + ' forgé !', 'success');
    } catch (e) {
      console.error('[forge] craft persist failed, rollback', e);
      inv.items = prevItems;
      renderRecipes();
      flashToast('⚠ Forge refusée : ' + (e.message || 'erreur'), 'error');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     AMÉLIORER TAB
     ═══════════════════════════════════════════════════════════════════ */
  function _inventoryEquipmentItems(){
    /* Renvoie [{ id, def, qty }] pour chaque item équipable possédé. */
    var inv = (STATE.inventory && STATE.inventory.items) || {};
    var out = [];
    Object.keys(inv).forEach(function(id){
      var qty = parseInt(inv[id] || 0, 10) || 0;
      if (qty <= 0) return;
      var def = _itemEquipment(id);
      if (def) out.push({ id: id, def: def, qty: qty });
    });
    out.sort(function(a, b){ return (a.def.name || a.id).localeCompare(b.def.name || b.id, 'fr'); });
    return out;
  }

  function renderImproveTab(){
    var grid = $('#improve-grid');
    var empty = $('#improve-empty');
    if (!grid) return;
    grid.innerHTML = '';
    /* Gate : Forgerons T1+ et Héritiers de Baldun T1+ uniquement. */
    if (!_hasAmeliorationAccess(STATE.activeChar)) {
      grid.hidden = true;
      empty.hidden = false;
      empty.innerHTML =
        '<div class="forge-coming-glyph">🔒</div>' +
        '<p>Réservé aux <strong>Forgerons</strong> (Dwarf) et <strong>Héritiers de Baldun</strong> (T1 minimum).<br>' +
        'Statut actuel : ' + esc(_forgeronStatus(STATE.activeChar).label) + '</p>';
      return;
    }
    var list = _inventoryEquipmentItems();
    if (!list.length) {
      grid.hidden = true;
      empty.hidden = false;
      empty.innerHTML =
        '<div class="forge-coming-glyph">◇</div>' +
        '<p>Aucun item équipable dans ton inventaire.</p>';
      return;
    }
    grid.hidden = false; empty.hidden = true;

    var upgrades = (STATE.inventory && STATE.inventory.item_upgrades) || {};

    list.forEach(function(entry){
      var def = entry.def;
      var up = upgrades[entry.id] || { stars: 0, bonuses_pct: [] };
      var stars = up.stars || 0;
      var totalPct = (up.bonuses_pct || []).reduce(function(s, v){ return s + (v || 0); }, 0);
      var rarity = (def.rarity || 'common').toLowerCase();

      var card = document.createElement('div');
      card.className = 'forge-recipe-card';
      card.dataset.id = entry.id;

      var statusTxt = stars >= 5
        ? '✓ Max atteint (5 étoiles)'
        : 'Clique pour ajouter une étoile · roll [+2% → +10%]';
      if (stars >= 5) card.classList.add('is-locked');

      card.innerHTML =
        '<div class="forge-recipe-head">' +
          '<span class="forge-recipe-icon">' + esc(def.icon || '🔹') + '</span>' +
          '<span class="forge-recipe-name">' + esc(def.name || entry.id) + '</span>' +
          '<span class="forge-recipe-rarity r-' + esc(rarity) + '">' + esc(rarity) + '</span>' +
        '</div>' +
        '<div class="forge-stars-row">' + _starsHtml(stars) + '</div>' +
        (totalPct > 0
          ? '<div class="forge-upgrade-total">Bonus cumulé : +' + (totalPct * 100).toFixed(1) + '% sur toutes les stats</div>'
          : '<div class="forge-upgrade-total forge-upgrade-empty">Aucun bonus encore</div>') +
        '<div class="forge-recipe-status">' + statusTxt + '</div>';

      card.addEventListener('click', function(){
        if (stars >= 5) return;
        addStar(entry.id);
      });
      grid.appendChild(card);
    });
  }

  async function addStar(itemId){
    var inv = STATE.inventory || {};
    if (!inv.item_upgrades) inv.item_upgrades = {};
    var up = inv.item_upgrades[itemId] || { stars: 0, bonuses_pct: [] };
    if ((up.stars || 0) >= 5) return;

    /* Roll random [0.02, 0.10] */
    var pct = 0.02 + Math.random() * 0.08;
    pct = Math.round(pct * 1000) / 1000; /* 3 décimales (0.023 = 2.3%) */

    var prevUp = JSON.parse(JSON.stringify(up));
    var newUpgrades = Object.assign({}, inv.item_upgrades);
    var newUp = { stars: (up.stars || 0) + 1, bonuses_pct: (up.bonuses_pct || []).concat([pct]) };
    newUpgrades[itemId] = newUp;
    inv.item_upgrades = newUpgrades;
    renderImproveTab();

    var dbref = _getDb();
    if (!dbref || !STATE.inventoryKey) {
      flashToast('Sauvegarde indisponible', 'error');
      return;
    }
    try {
      await dbref.collection('inventories').doc(STATE.inventoryKey).update({
        item_upgrades: newUpgrades
      });
      flashToast('✨ +' + (pct * 100).toFixed(1) + '% sur toutes les stats !', 'success');
    } catch (e) {
      console.error('[forge] addStar persist failed, rollback', e);
      var rb = Object.assign({}, inv.item_upgrades);
      rb[itemId] = prevUp;
      inv.item_upgrades = rb;
      renderImproveTab();
      flashToast('⚠ ' + (e.message || 'Échec sauvegarde'), 'error');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     RUNIQUE TAB
     ═══════════════════════════════════════════════════════════════════ */
  function renderRunicTab(){
    var host = $('#runic-content');
    if (!host) return;
    host.innerHTML = '';

    if (!_hasRuniqueAccess(STATE.activeChar)) {
      host.innerHTML =
        '<div class="forge-coming-soon">' +
          '<div class="forge-coming-glyph">🔒</div>' +
          '<p>Réservé aux <strong>ArcanoForgerons</strong> et <strong>Initiés de Baldun</strong>.<br>' +
          'Statut actuel : ' + esc(_forgeronStatus(STATE.activeChar).label) + '</p>' +
        '</div>';
      return;
    }

    var list = _inventoryEquipmentItems();
    if (!list.length) {
      host.innerHTML = '<div class="forge-coming-soon"><div class="forge-coming-glyph">◇</div><p>Aucun item équipable dans ton inventaire.</p></div>';
      return;
    }

    var runes = (STATE.inventory && STATE.inventory.item_runes) || {};
    var inv = (STATE.inventory && STATE.inventory.items) || {};
    var arcanaeQty = parseInt(inv['arcanae'] || 0, 10) || 0;

    /* Bandeau solde Arcanae */
    host.innerHTML =
      '<div class="forge-arcanae-banner">' +
        '<span class="forge-arcanae-icon">◈</span>' +
        '<span class="forge-arcanae-label">Solde Arcanae :</span>' +
        '<span class="forge-arcanae-value' + (arcanaeQty < 1 ? ' is-empty' : '') + '">' + arcanaeQty + '</span>' +
      '</div>' +
      '<div class="forge-recipes-grid" id="runic-grid"></div>';

    var grid = host.querySelector('#runic-grid');
    list.forEach(function(entry){
      var def = entry.def;
      var rune = runes[entry.id];
      var rarity = (def.rarity || 'common').toLowerCase();
      var highest = _itemHighestStat(def);

      var card = document.createElement('div');
      card.className = 'forge-recipe-card';
      card.dataset.id = entry.id;

      var statusTxt;
      var locked = false;
      if (rune) {
        statusTxt = '✓ Rune appliquée : +' + rune.value + ' ' + ((_STATS_LABEL()[rune.stat] || rune.stat).toUpperCase());
        locked = true;
      } else if (highest === 0) {
        statusTxt = '⚠ Item sans stat de base — runique inapplicable';
        locked = true;
      } else if (arcanaeQty < 1) {
        statusTxt = '🔒 1 Arcanae requis';
        locked = true;
      } else {
        statusTxt = 'Clique pour appliquer une rune (+' + highest + ' sur stat choisie)';
      }
      if (locked) card.classList.add('is-locked');

      card.innerHTML =
        '<div class="forge-recipe-head">' +
          '<span class="forge-recipe-icon">' + esc(def.icon || '🔹') + '</span>' +
          '<span class="forge-recipe-name">' + esc(def.name || entry.id) + '</span>' +
          '<span class="forge-recipe-rarity r-' + esc(rarity) + '">' + esc(rarity) + '</span>' +
        '</div>' +
        '<div class="forge-rune-current">' +
          'Stat la plus haute : <strong>' + highest + '</strong>' +
        '</div>' +
        '<div class="forge-recipe-status">' + statusTxt + '</div>';

      if (!locked) {
        card.addEventListener('click', function(){ openRuneModal(entry.id); });
      }
      grid.appendChild(card);
    });
  }

  function openRuneModal(itemId){
    var def = _itemEquipment(itemId);
    if (!def) return;
    var inv = (STATE.inventory && STATE.inventory.items) || {};
    var arcanaeQty = parseInt(inv['arcanae'] || 0, 10) || 0;
    var highest = _itemHighestStat(def);
    STATE.pendingRune = { itemId: itemId, highest: highest };

    $('#rune-icon').textContent = def.icon || '◈';
    $('#rune-title').textContent = def.name || itemId;
    var rarity = (def.rarity || 'common').toLowerCase();
    var rEl = $('#rune-rarity');
    rEl.textContent = rarity.toUpperCase();
    rEl.className = 'forge-modal-kind r-' + rarity;
    $('#rune-highest').textContent = '+' + highest;
    $('#rune-cost-label').textContent = '1 Arcanae (dispo : ' + arcanaeQty + ')';

    /* Stat picker — toutes les 8 stats sauf celles déjà présentes (sinon doublon douteux) */
    var labels = _STATS_LABEL();
    var existingStats = Object.keys(def.stat_effects || {});
    var picker = $('#rune-stat-picker');
    picker.innerHTML = '';
    Object.keys(labels).forEach(function(stat){
      if (existingStats.indexOf(stat) >= 0) return; /* skip stats déjà sur l'item */
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'forge-stat-btn';
      btn.dataset.stat = stat;
      btn.textContent = labels[stat].toUpperCase();
      btn.addEventListener('click', function(){
        $$('.forge-stat-btn', picker).forEach(function(b){ b.classList.remove('is-selected'); });
        btn.classList.add('is-selected');
        STATE.pendingRune.stat = stat;
        $('#rune-confirm-label').textContent = 'Appliquer +' + highest + ' ' + labels[stat];
      });
      picker.appendChild(btn);
    });

    $('#rune-confirm-btn').disabled = true; /* tant qu'aucune stat sélectionnée */
    $('#rune-modal').hidden = false;
  }

  async function applyRune(){
    var pending = STATE.pendingRune;
    if (!pending || !pending.stat) return;
    var itemId = pending.itemId;
    var stat = pending.stat;
    var inv = STATE.inventory || {};
    var arcanaeQty = parseInt((inv.items || {}).arcanae || 0, 10) || 0;
    if (arcanaeQty < 1) { flashToast('🔒 1 Arcanae requis', 'error'); closeAllModals(); return; }
    if ((inv.item_runes || {})[itemId]) { flashToast('⚠ Rune déjà appliquée', 'error'); closeAllModals(); return; }

    var def = _itemEquipment(itemId);
    var highest = _itemHighestStat(def);
    if (highest === 0) { flashToast('⚠ Item sans stat de base', 'error'); closeAllModals(); return; }

    /* Optimistic */
    var prevItems = Object.assign({}, inv.items || {});
    var prevRunes = Object.assign({}, inv.item_runes || {});
    var newItems = Object.assign({}, prevItems);
    newItems.arcanae = arcanaeQty - 1;
    if (newItems.arcanae <= 0) delete newItems.arcanae;
    var newRunes = Object.assign({}, prevRunes);
    newRunes[itemId] = { stat: stat, value: highest };
    inv.items = newItems;
    inv.item_runes = newRunes;
    closeAllModals();
    renderRunicTab();

    var dbref = _getDb();
    if (!dbref || !STATE.inventoryKey) { flashToast('Sauvegarde indisponible', 'error'); return; }
    try {
      await dbref.collection('inventories').doc(STATE.inventoryKey).update({
        items: newItems,
        item_runes: newRunes
      });
      flashToast('✓ Rune +' + highest + ' ' + (_STATS_LABEL()[stat] || stat) + ' appliquée !', 'success');
    } catch (e) {
      console.error('[forge] applyRune failed, rollback', e);
      inv.items = prevItems;
      inv.item_runes = prevRunes;
      renderRunicTab();
      flashToast('⚠ ' + (e.message || 'Échec sauvegarde'), 'error');
    }
  }

  function flashToast(msg, kind){
    var t = document.createElement('div');
    t.textContent = msg;
    var color = kind === 'error' ? '#e7484b' : (kind === 'success' ? '#5fb878' : '#e8c876');
    t.style.cssText =
      'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);' +
      'padding:12px 22px;font-family:Rajdhani,sans-serif;font-weight:600;font-size:0.9rem;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'background:rgba(7,9,15,0.95);border:1px solid ' + color +
      ';color:' + color +
      ';z-index:2000;box-shadow:0 10px 30px rgba(0,0,0,0.6);';
    document.body.appendChild(t);
    setTimeout(function(){ try { t.remove(); } catch(_){} }, 4500);
  }

  /* ─── Wire ─── */
  function wire(){
    wireTabs();

    var chip = $('#forge-char-chip');
    if (chip) chip.addEventListener('click', openCharSwitchModal);

    $$('.forge-modal').forEach(function(m){
      m.addEventListener('click', function(e){
        var t = e.target;
        if (t && (t.dataset.close !== undefined || t.classList.contains('forge-modal-close') || t.classList.contains('forge-modal-bg'))) {
          m.hidden = true;
        }
      });
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeAllModals();
    });

    var cb = $('#craft-confirm-btn');
    if (cb) cb.addEventListener('click', function(){
      if (cb.disabled) return;
      craftItem();
    });

    var rb = $('#rune-confirm-btn');
    if (rb) rb.addEventListener('click', function(){
      if (rb.disabled) return;
      applyRune();
    });

    /* Le bouton runique est enabled dès qu'une stat est sélectionnée (handled by openRuneModal) */
    /* On observe le changement via délégation sur les .forge-stat-btn */
    document.body.addEventListener('click', function(e){
      if (e.target && e.target.classList && e.target.classList.contains('forge-stat-btn')) {
        var rbtn = $('#rune-confirm-btn');
        if (rbtn) rbtn.disabled = false;
      }
    });
  }

  /* ─── Init ─── */
  async function init(){
    wire();
    showState('state-loading');

    try {
      await Promise.all([loadRecipes(), loadItemsConfig(), loadActiveChar(), loadAllChars()]);
    } catch (e) { console.error('[forge] init failed', e); }

    if (STATE.noSession) { showState('state-no-session'); return; }
    if (!STATE.activeChar) { showState('state-no-chars'); return; }

    await loadInventory();

    showMain();
    updateCharChip();
    renderStatusBanner();
    renderRecipes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

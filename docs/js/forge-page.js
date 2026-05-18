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

  function loadActiveChar(){
    var dbref = _getDb();
    var uid = _getUid();
    STATE.noSession = !uid;
    if (!dbref || !uid) return Promise.resolve(null);
    /* Lit active_characters/{uid} pour trouver le char actif */
    return dbref.collection('active_characters').doc(String(uid)).get().then(function(snap){
      if (!snap.exists) return null;
      var data = snap.data() || {};
      var charId = data.character_id;
      if (!charId) return null;
      STATE.activeCharId = charId;
      return dbref.collection('characters').doc(String(charId)).get().then(function(cs){
        if (!cs.exists) return null;
        STATE.activeChar = Object.assign({ _id: charId, id: charId }, cs.data() || {});
        return STATE.activeChar;
      });
    }).catch(function(e){
      console.warn('[forge] char load failed:', e);
      STATE.fetchError = e && e.message;
      return null;
    });
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
      return STATE.inventory;
    }).catch(function(e){
      console.warn('[forge] inventory load failed:', e);
      STATE.inventory = { items: {}, equipped_assets: [] };
      return STATE.inventory;
    });
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

  /* ─── Char chip ─── */
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
  }

  /* ─── Init ─── */
  async function init(){
    wire();
    showState('state-loading');

    try {
      await Promise.all([loadRecipes(), loadItemsConfig(), loadActiveChar()]);
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

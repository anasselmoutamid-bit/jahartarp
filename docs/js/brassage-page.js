/* ═══════════════════════════════════════════════════════════════════════
   brassage-page.js — Page Brassage v1
   - Lit data/brassage_recipes.json (potions + materials + recettes)
   - Détermine rareté max selon axiome_current (potionniste / druide → T2)
   - Render recettes accessibles avec filtres par catégorie
   - Brew : consume materials → add potion to inventory
   Accès : Potionniste OU Druide uniquement.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STATE = {
    activeChar: null,
    activeCharId: null,
    chars: [],
    recipes: null,
    materials: null,
    potions: null,
    categories: null,
    rarityOrder: [],
    tierRarityMax: {},
    brasseurStatus: {},
    inventory: null,
    inventoryKey: null,
    noSession: false,
    activeCategory: 'all',
    pendingRecipe: null
  };

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

  /* ─── Session / DB ─── */
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

  /* ─── Access ─── */
  function _brassageScope(c){
    /* 'full' (Potionniste — toutes recettes) | 'healing_only' (Druide) | 'none' */
    if (!c) return 'none';
    if (window.AxiomeSkills && typeof window.AxiomeSkills.getBrassageScope === 'function') {
      var sc = window.AxiomeSkills.getBrassageScope(c);
      if (sc && sc !== 'none') return sc;
    }
    /* Fallback : ancien check par axiome_current */
    var cur = c.axiome_current || c.axiome || null;
    if (cur === 'potionniste') return 'full';
    if (cur === 'druide') return 'healing_only';
    return 'none';
  }
  function _hasBrassageAccess(c){
    return _brassageScope(c) !== 'none';
  }
  function _canBrewMythic(c){
    if (!c) return false;
    if (window.AxiomeSkills && typeof window.AxiomeSkills.canBrewMythic === 'function') {
      return !!window.AxiomeSkills.canBrewMythic(c);
    }
    /* Fallback : skill direct */
    var tree = c.axiome_tree_unlocked || {};
    return !!tree['potionniste.elixir'];
  }

  function _brasseurStatus(c){
    if (!c) return { code: 'base', label: 'Non-Brasseur', tier: 0 };
    var cur = c.axiome_current || c.axiome || null;
    if (!cur) return { code: 'base', label: 'Base', tier: 0 };
    var info = STATE.brasseurStatus[cur];
    if (!info) return { code: 'base', label: 'Base', tier: 0 };
    var code = 'brasseur_t' + (info.tier || 1);
    return { code: code, label: info.label, tier: info.tier || 1 };
  }

  function _maxRarityIndex(statusCode){
    var maxR = STATE.tierRarityMax[statusCode];
    if (!maxR) maxR = STATE.tierRarityMax.base || 'uncommon';
    var i = STATE.rarityOrder.indexOf(maxR);
    return i < 0 ? STATE.rarityOrder.length - 1 : i;
  }
  function _rarityIndex(r){
    return STATE.rarityOrder.indexOf(String(r || '').toLowerCase());
  }

  /* ─── Data loaders ─── */
  function loadRecipes(){
    return fetch('data/brassage_recipes.json?v=1')
      .then(function(r){ if (!r.ok) throw new Error('brassage_recipes ' + r.status); return r.json(); })
      .then(function(j){
        STATE.recipes = j.recipes || {};
        STATE.materials = j.materials || {};
        STATE.potions = j.potions || {};
        STATE.categories = j._categories || {};
        STATE.rarityOrder = j._rarity_order || [];
        STATE.tierRarityMax = j._tier_rarity_max || {};
        STATE.brasseurStatus = j._brasseur_status || {};
        return j;
      });
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
    /* Fallback : tous les chars du user */
    try {
      var qs = await dbref.collection('characters').where('user_id','==',String(uid)).get();
      var out = [];
      qs.forEach(function(d){ if (d.data() && !d.data()._init) out.push(Object.assign({_id:d.id,id:d.id}, d.data())); });
      STATE.chars = out;
      var pref = out.find(function(c){ return _hasBrassageAccess(c); }) || out[0];
      if (pref) {
        STATE.activeCharId = pref._id || pref.id;
        STATE.activeChar = pref;
        return pref;
      }
    } catch (e) {}
    return null;
  }

  async function loadAllChars(){
    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid) return [];
    try {
      var qs = await dbref.collection('characters').where('user_id','==',String(uid)).get();
      var out = [];
      qs.forEach(function(d){ if (d.data() && !d.data()._init) out.push(Object.assign({_id:d.id,id:d.id}, d.data())); });
      STATE.chars = out;
      return out;
    } catch (e) { return []; }
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
      console.warn('[brassage] inv load failed:', e);
      STATE.inventory = { items: {}, equipped_assets: [] };
      return STATE.inventory;
    }
  }

  /* ─── Rendering ─── */
  function showState(id){
    ['state-loading','state-no-session','state-no-chars','state-no-access','view-main'].forEach(function(s){
      var el = document.getElementById(s);
      if (el) el.hidden = (s !== id);
    });
  }

  function renderHeader(){
    var c = STATE.activeChar;
    if (!c) return;
    var chip = $('#br-char-chip');
    var name = ((c.first_name||'') + ' ' + (c.last_name||'')).trim() || 'Voyageur';
    var axLabel = (c.axiome_current === 'potionniste') ? 'POTIONNISTE'
                : (c.axiome_current === 'druide') ? 'DRUIDE'
                : (c.axiome_current || 'NÉOPHYTE').toUpperCase();
    $('#br-chip-name').textContent = name;
    $('#br-chip-meta').textContent = axLabel;
    chip.hidden = false;

    var status = _brasseurStatus(c);
    $('#br-status-value').textContent = status.label + ' · T' + status.tier;
    var maxIdx = _maxRarityIndex(status.code);
    var maxR = STATE.rarityOrder[maxIdx] || 'epic';
    $('#br-cap-value').textContent = maxR.toUpperCase();
  }

  function renderRecipes(){
    var grid = $('#br-recipes-grid');
    var empty = $('#br-empty');
    if (!grid) return;
    var status = _brasseurStatus(STATE.activeChar);
    var maxIdx = _maxRarityIndex(status.code);

    /* Tri : par catégorie puis rareté */
    var entries = Object.keys(STATE.recipes).map(function(id){
      var potDef = STATE.potions[id] || {};
      return {
        id: id,
        potion: potDef,
        recipe: STATE.recipes[id],
        rarityIdx: _rarityIndex(potDef.rarity || 'common'),
        category: potDef.category || 'misc'
      };
    });

    /* Filter par scope axiome (Druide = healing_only) */
    var scope = _brassageScope(STATE.activeChar);
    if (scope === 'healing_only') {
      entries = entries.filter(function(e){
        var cat = String(e.category || '').toLowerCase();
        return cat === 'healing' || cat === 'soin' || cat === 'soins';
      });
    }

    /* Gate Mythic : caché tant que potionniste.elixir n'est pas débloqué */
    var canMythic = _canBrewMythic(STATE.activeChar);
    if (!canMythic) {
      entries = entries.filter(function(e){
        var rar = String((e.potion && e.potion.rarity) || '').toLowerCase();
        return rar !== 'mythic';
      });
    }

    /* Filter par catégorie */
    if (STATE.activeCategory !== 'all') {
      entries = entries.filter(function(e){ return e.category === STATE.activeCategory; });
    }

    entries.sort(function(a, b){
      if (a.rarityIdx !== b.rarityIdx) return a.rarityIdx - b.rarityIdx;
      return (a.potion.name || a.id).localeCompare(b.potion.name || b.id, 'fr');
    });

    if (entries.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    var inv = (STATE.inventory && STATE.inventory.items) || {};

    var html = entries.map(function(e){
      var p = e.potion;
      var r = e.recipe;
      var rarity = (p.rarity || 'common').toLowerCase();
      var locked = e.rarityIdx > maxIdx;
      var owned = parseInt(inv[e.id] || 0, 10) || 0;

      var matsHtml = (r.materials || []).map(function(m){
        var have = parseInt(inv[m.id] || 0, 10) || 0;
        var ok = have >= m.qty;
        var mat = STATE.materials[m.id] || {};
        var matName = mat.name || m.id;
        var matIconHtml = typeof getItemIcon==='function'?getItemIcon(mat,16):esc(mat.icon||'◈');
        return '<div class="br-mat-row ' + (ok ? 'is-ok' : 'is-missing') + '">' +
          '<span class="br-mat-name"><span class="br-mat-icon">' + matIconHtml + '</span>' + esc(matName) + '</span>' +
          '<span class="br-mat-qty">' + have + ' / ' + m.qty + '</span>' +
        '</div>';
      }).join('');

      var canBrew = !locked && (r.materials || []).every(function(m){
        return (parseInt(inv[m.id] || 0, 10) || 0) >= m.qty;
      });

      return '<div class="br-recipe ' + (locked ? 'is-locked' : '') + '">' +
        '<div class="br-recipe-head">' +
          '<span class="br-recipe-icon">' + (typeof getItemIcon==='function'?getItemIcon(p,28):esc(p.icon||'🧪')) + '</span>' +
          '<span class="br-recipe-title">' + esc(p.name || e.id) + '</span>' +
          '<span class="br-recipe-rarity br-rarity-' + esc(rarity) + '">' + esc(rarity) + '</span>' +
        '</div>' +
        '<div class="br-recipe-desc">' + esc(p.description || '—') + '</div>' +
        '<div class="br-recipe-effect">' + esc(p.effect || '—') + '</div>' +
        '<div class="br-recipe-mats">' + matsHtml + '</div>' +
        '<div class="br-recipe-foot">' +
          '<span class="br-recipe-owned">En stock : <strong>' + owned + '</strong></span>' +
          (locked
            ? '<button class="br-btn" type="button" disabled>🔒 ' + esc(rarity).toUpperCase() + '</button>'
            : '<button class="br-btn" type="button" data-id="' + esc(e.id) + '"' + (canBrew ? '' : ' disabled') + '>Brasser <span class="br-arrow">→</span></button>'
          ) +
        '</div>' +
      '</div>';
    }).join('');

    grid.innerHTML = html;

    grid.querySelectorAll('.br-btn[data-id]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.dataset.id;
        if (id) openBrewModal(id);
      });
    });
  }

  /* ─── Modal Brew ─── */
  function openBrewModal(id){
    STATE.pendingRecipe = id;
    var p = STATE.potions[id] || {};
    var r = STATE.recipes[id] || { materials: [] };
    var inv = (STATE.inventory && STATE.inventory.items) || {};
    var rarity = (p.rarity || 'common').toLowerCase();

    if(typeof getItemIcon==='function'){$('#brew-icon').innerHTML=getItemIcon(p,36);}else{$('#brew-icon').textContent=p.icon||'🧪';}
    $('#brew-title').textContent = p.name || id;
    var rarityEl = $('#brew-rarity');
    rarityEl.textContent = rarity.toUpperCase();
    rarityEl.className = 'br-modal-rarity br-rarity-' + rarity;
    $('#brew-desc').innerHTML = esc(p.description || '') +
      '<br><em style="color:var(--br-amber-2);font-size:0.85rem">' + esc(p.effect || '') + '</em>';

    var matsHtml = (r.materials || []).map(function(m){
      var have = parseInt(inv[m.id] || 0, 10) || 0;
      var ok = have >= m.qty;
      var mat = STATE.materials[m.id] || {};
      return '<div class="br-mat-row ' + (ok ? 'is-ok' : 'is-missing') + '">' +
        '<span class="br-mat-name"><span class="br-mat-icon">' + (typeof getItemIcon==='function'?getItemIcon(mat,16):esc(mat.icon||'◈')) + '</span>' + esc(mat.name || m.id) + '</span>' +
        '<span class="br-mat-qty">' + have + ' / ' + m.qty + '</span>' +
      '</div>';
    }).join('');
    $('#brew-mats').innerHTML = matsHtml;

    var canBrew = (r.materials || []).every(function(m){
      return (parseInt(inv[m.id] || 0, 10) || 0) >= m.qty;
    });
    var confirmBtn = $('#brew-confirm-btn');
    confirmBtn.disabled = !canBrew;
    $('#brew-confirm-label').textContent = canBrew ? 'Brasser' : 'Matériaux manquants';

    $('#brew-modal').hidden = false;
  }

  function closeBrewModal(){
    $('#brew-modal').hidden = true;
    STATE.pendingRecipe = null;
  }

  async function executeBrew(){
    var id = STATE.pendingRecipe;
    if (!id) return;
    /* Defense-in-depth : revérifie l'accès à chaque brassage, au cas où
       le caller aurait été atteint via une voie détournée (console, etc.).
       L'UI est déjà gatée par init(), c'est une seconde barrière. */
    if (!_hasBrassageAccess(STATE.activeChar)) {
      flashToast('⚠ Accès refusé : axiome inadéquat', 'error');
      closeBrewModal();
      return;
    }
    var r = STATE.recipes[id];
    if (!r) return;
    var inv = STATE.inventory || { items: {} };
    var newItems = Object.assign({}, inv.items || {});

    /* Vérifie + déduit les matériaux */
    for (var i = 0; i < r.materials.length; i++) {
      var m = r.materials[i];
      var have = parseInt(newItems[m.id] || 0, 10) || 0;
      if (have < m.qty) {
        flashToast('⚠ Matériaux manquants', 'error');
        return;
      }
      newItems[m.id] = have - m.qty;
      if (newItems[m.id] <= 0) delete newItems[m.id];
    }
    /* Ajoute la potion */
    newItems[id] = (parseInt(newItems[id] || 0, 10) || 0) + 1;

    var dbref = _getDb();
    try {
      $('#brew-confirm-btn').disabled = true;
      await dbref.collection('inventories').doc(STATE.inventoryKey).set({ items: newItems }, { merge: true });
      inv.items = newItems;
      STATE.inventory = inv;
      var p = STATE.potions[id] || {};
      flashToast('✓ ' + (p.name || id) + ' brassée !', 'success');
      closeBrewModal();
      renderRecipes();
    } catch (e) {
      console.error('[brassage] brew failed', e);
      flashToast('⚠ ' + (e.message || 'erreur'), 'error');
      $('#brew-confirm-btn').disabled = false;
    }
  }

  /* ─── Char switcher ─── */
  function openCharSwitcher(){
    var grid = $('#charswitch-grid');
    grid.innerHTML = '';
    var chars = STATE.chars && STATE.chars.length > 0 ? STATE.chars : [STATE.activeChar].filter(Boolean);
    chars.forEach(function(c){
      var name = ((c.first_name||'') + ' ' + (c.last_name||'')).trim() || c._id || c.id;
      var ax = c.axiome_current || 'néophyte';
      var hasAcc = _hasBrassageAccess(c);
      var card = document.createElement('div');
      card.className = 'br-char-card';
      card.style.cursor = hasAcc ? 'pointer' : 'not-allowed';
      if (!hasAcc) card.style.opacity = '0.4';
      card.innerHTML =
        '<div class="br-char-name">' + esc(name) + '</div>' +
        '<div class="br-char-meta">' + esc(ax.toUpperCase()) + (hasAcc ? '' : ' · 🔒') + '</div>';
      if (hasAcc) {
        card.addEventListener('click', function(){
          var cid = c._id || c.id;
          location.href = 'brassage.html?char=' + encodeURIComponent(cid);
        });
      }
      grid.appendChild(card);
    });
    $('#charswitch-modal').hidden = false;
  }

  /* ─── Wire modals ─── */
  function wireModals(){
    document.querySelectorAll('[data-close]').forEach(function(el){
      el.addEventListener('click', function(){
        var modal = el.closest('.br-modal');
        if (modal) modal.hidden = true;
      });
    });
    $('#brew-confirm-btn').addEventListener('click', executeBrew);
    $('#br-char-chip').addEventListener('click', openCharSwitcher);

    $$('#br-filters .br-filter').forEach(function(btn){
      btn.addEventListener('click', function(){
        $$('#br-filters .br-filter').forEach(function(b){ b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        STATE.activeCategory = btn.dataset.cat || 'all';
        renderRecipes();
      });
    });
  }

  /* ─── Toast ─── */
  function flashToast(msg, kind){
    var t = document.createElement('div');
    t.className = 'br-toast ' + (kind === 'error' ? 'is-error' : 'is-success');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ try { t.remove(); } catch(_){} }, 3800);
  }

  /* ─── INIT ─── */
  async function init(){
    try {
      await loadRecipes();
    } catch (e) {
      console.error('[brassage] recipes load failed', e);
      showState('state-loading');
      $('#state-loading').innerHTML =
        '<div class="br-state-glyph">⚠</div>' +
        '<h2 class="br-state-title">Erreur</h2>' +
        '<p class="br-state-text">Impossible de charger les recettes : ' + esc(e.message) + '</p>';
      return;
    }

    await Promise.all([loadActiveChar(), loadAllChars()]);

    if (STATE.noSession) {
      showState('state-no-session');
      return;
    }
    if (!STATE.activeChar) {
      showState('state-no-chars');
      return;
    }
    if (!_hasBrassageAccess(STATE.activeChar)) {
      $('#no-access-text').innerHTML =
        'Le brassage est réservé aux <strong>Potionnistes</strong> et aux <strong>Druides</strong>.<br><br>' +
        'Axiome actuel : <strong>' + esc(STATE.activeChar.axiome_current || 'Néophyte') + '</strong>';
      showState('state-no-access');
      renderHeader(); /* on affiche quand même le chip pour permettre le switch */
      return;
    }

    /* Si Druide (healing_only), on log l'info — l'UI le rendra évident via le filtre */
    if (_brassageScope(STATE.activeChar) === 'healing_only') {
      window._dbg && window._dbg.info && window._dbg.info('[brassage] Druide → soins uniquement');
    }

    await loadInventory();

    showState('view-main');
    renderHeader();
    wireModals();
    renderRecipes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

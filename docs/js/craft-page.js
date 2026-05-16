/* ═══════════════════════════════════════════════════════════════════════
   craft-page.js — Catalogue Craft (lecture seule)
   ═══════════════════════════════════════════════════════════════════════
   Charge config/craft_recipes + config/craft_materials + config/items
   depuis D1. Affiche, filtre par rareté/access. Le craft se fait via
   /craft recipe:<id> sur Discord.
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var RARITY_COLORS = {
    common:      '#9aa0b8',
    uncommon:    '#44ff88',
    rare:        '#4DA3FF',
    epic:        '#8B5CF6',
    legendary:   '#ffd60a',
    mythic:      '#ff8800',
    unique:      '#00ffcc',
    artifact:    '#ff006e',
    signature:   '#ffd60a',
    mastercraft: '#ffffff',
    pandemonium: '#9d00ff',
    racial:      '#14b8a6',
    forgeflamme: '#ff4500'
  };

  var STATE = {
    recipes: {},
    materials: {},
    items: {},
    rarity: 'all',
    access: 'all',
    search: ''
  };

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function _getDb(){
    if (window.db) return window.db;
    if (typeof db !== 'undefined') return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(e){}
    }
    return null;
  }

  async function loadConfigs(){
    var dbref = _getDb();
    if (!dbref) throw new Error('Connexion D1 indisponible');

    var [rSnap, mSnap, iSnap] = await Promise.all([
      dbref.collection('config').doc('craft_recipes').get(),
      dbref.collection('config').doc('craft_materials').get(),
      dbref.collection('config').doc('items').get()
    ]);

    STATE.recipes = rSnap.exists ? (rSnap.data() || {}) : {};
    STATE.materials = mSnap.exists ? (mSnap.data() || {}) : {};
    var idata = iSnap.exists ? (iSnap.data() || {}) : {};
    STATE.items = {};
    ['items', 'equipment', 'signatures'].forEach(function(root){
      var sub = idata[root];
      if (sub && typeof sub === 'object') {
        Object.keys(sub).forEach(function(k){
          if (!k.startsWith('_')) STATE.items[k] = sub[k];
        });
      }
    });
  }

  function _matchesFilter(recipeId, recipe){
    if (recipeId.startsWith('_') || !recipe || typeof recipe !== 'object') return false;
    if (STATE.rarity !== 'all' && recipe.rarity !== STATE.rarity) return false;
    if (STATE.access !== 'all') {
      var a = recipe.access || 'public';
      if (STATE.access === 'public' && a !== 'public') return false;
      if (STATE.access === 'metier' && a.indexOf('metier') !== 0) return false;
    }
    if (STATE.search) {
      var s = STATE.search.toLowerCase();
      var prod = STATE.items[recipe.product_id];
      var name = (prod && prod.name ? prod.name : recipe.product_id).toLowerCase();
      if (name.indexOf(s) < 0 && recipe.product_id.toLowerCase().indexOf(s) < 0) return false;
    }
    return true;
  }

  function _renderIngredient(ing){
    var mat = STATE.materials[ing.id] || {};
    var name = mat.name || ing.id;
    var emoji = mat.emoji || '◆';
    var rar = (mat.rarity || 'common').toLowerCase();
    var col = RARITY_COLORS[rar] || '#9aa0b8';
    return (
      '<div class="cr-ing" style="--rc:'+col+'">' +
        '<span class="cr-ing-emoji">'+emoji+'</span>' +
        '<span class="cr-ing-name">'+esc(name)+'</span>' +
        '<span class="cr-ing-qty">×'+ing.qty+'</span>' +
      '</div>'
    );
  }

  function _renderRecipe(recipeId, recipe){
    var product = STATE.items[recipe.product_id] || {};
    var pname = product.name || recipe.product_id;
    var rar = (recipe.rarity || 'common').toLowerCase();
    var col = RARITY_COLORS[rar] || '#9aa0b8';
    var access = recipe.access || 'public';
    var accessLabel, accessClass;
    if (access === 'public') {
      accessLabel = 'PUBLIQUE';
      accessClass = 'cr-access-public';
    } else if (access.indexOf('metier:forge') === 0) {
      accessLabel = access === 'metier:forge:t5' ? 'FORGERON T5' : 'FORGERON';
      accessClass = 'cr-access-forge';
    } else if (access.indexOf('metier:') === 0) {
      accessLabel = 'MÉTIER · ' + access.split(':')[1].toUpperCase();
      accessClass = 'cr-access-metier';
    } else if (access === 'race_lock') {
      accessLabel = 'RACE-LOCK';
      accessClass = 'cr-access-race';
    } else {
      accessLabel = access.toUpperCase();
      accessClass = 'cr-access-other';
    }

    var ingredients = (recipe.ingredients || []).map(_renderIngredient).join('');
    var totalCount = (recipe.ingredients || []).reduce(function(s,i){return s + (i.qty || 1);}, 0);

    return (
      '<div class="cr-card" style="--cc:'+col+'" data-rarity="'+rar+'">' +
        '<div class="cr-card-head">' +
          '<div class="cr-card-rarity-bar"></div>' +
          '<div class="cr-card-title-row">' +
            '<div class="cr-card-name">'+esc(pname)+'</div>' +
            '<div class="cr-card-rarity">'+rar.toUpperCase()+'</div>' +
          '</div>' +
          '<div class="cr-card-id">'+esc(recipeId)+'</div>' +
          '<div class="cr-card-access '+accessClass+'">'+accessLabel+'</div>' +
        '</div>' +
        '<div class="cr-card-body">' +
          '<div class="cr-ing-label">'+totalCount+' ingrédient'+(totalCount>1?'s':'')+'</div>' +
          '<div class="cr-ing-list">'+ingredients+'</div>' +
          '<div class="cr-card-cmd">Pour crafter : <code>/craft recipe:'+esc(recipeId)+'</code></div>' +
        '</div>' +
      '</div>'
    );
  }

  function render(){
    var grid = document.getElementById('cr-grid');
    var count = document.getElementById('cr-count');
    if (!grid) return;

    var ids = Object.keys(STATE.recipes).filter(function(rid){
      return _matchesFilter(rid, STATE.recipes[rid]);
    });
    // Order : by rarity tier (asc), then by name
    var rarityOrder = ['common','uncommon','rare','epic','legendary','mythic','unique','artifact','signature','mastercraft','pandemonium','racial','forgeflamme'];
    ids.sort(function(a,b){
      var ra = STATE.recipes[a].rarity || '';
      var rb = STATE.recipes[b].rarity || '';
      var ia = rarityOrder.indexOf(ra); if(ia<0) ia=999;
      var ib = rarityOrder.indexOf(rb); if(ib<0) ib=999;
      if (ia !== ib) return ia - ib;
      var na = (STATE.items[STATE.recipes[a].product_id] || {}).name || STATE.recipes[a].product_id;
      var nb = (STATE.items[STATE.recipes[b].product_id] || {}).name || STATE.recipes[b].product_id;
      return String(na).localeCompare(String(nb), 'fr');
    });

    if (count) count.textContent = ids.length + ' recette' + (ids.length>1?'s':'');

    if (ids.length === 0) {
      grid.innerHTML = '<div class="cr-empty">Aucune recette ne correspond aux filtres.</div>';
      return;
    }
    grid.innerHTML = ids.map(function(rid){ return _renderRecipe(rid, STATE.recipes[rid]); }).join('');
  }

  function wireUI(){
    var search = document.getElementById('cr-search');
    if (search) {
      var t;
      search.addEventListener('input', function(){
        clearTimeout(t);
        t = setTimeout(function(){
          STATE.search = search.value.trim();
          render();
        }, 200);
      });
    }
    document.querySelectorAll('.cr-filter').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.cr-filter').forEach(function(b){b.classList.remove('cr-filter-active');});
        btn.classList.add('cr-filter-active');
        STATE.rarity = btn.dataset.rarity;
        render();
      });
    });
    document.querySelectorAll('.cr-access').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.cr-access').forEach(function(b){b.classList.remove('cr-access-active');});
        btn.classList.add('cr-access-active');
        STATE.access = btn.dataset.access;
        render();
      });
    });
  }

  async function main(){
    wireUI();
    try {
      await loadConfigs();
      render();
    } catch (e) {
      console.error('[craft-page]', e);
      var grid = document.getElementById('cr-grid');
      if (grid) grid.innerHTML = '<div class="cr-empty cr-error">⚠ Erreur de chargement : '+esc(e.message||'')+'</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();

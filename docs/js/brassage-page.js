/* ═══════════════════════════════════════════════════════════════════════
   brassage-page.js — Catalogue Brassage (lecture)
   ═════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var FAMILY_COLORS = { soins:'#ff6b6b', buffs:'#4DA3FF', nature:'#44ff88' };
  var RARITY_COLORS = { common:'#9aa0b8', uncommon:'#44ff88', rare:'#4DA3FF', epic:'#8B5CF6', legendary:'#ffd60a' };

  var STATE = { recipes: {}, family: 'all' };

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function _getDb(){
    if (window.db) return window.db;
    if (typeof db !== 'undefined') return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(e){}
    }
    return null;
  }

  async function load(){
    var dbref = _getDb();
    if (!dbref) {
      document.getElementById('mp-grid').innerHTML = '<div class="mp-error">⚠ Connexion D1 indisponible.</div>';
      return;
    }
    try {
      var snap = await dbref.collection('config').doc('brewing_recipes').get();
      STATE.recipes = snap.exists ? (snap.data() || {}) : {};
      Object.keys(STATE.recipes).forEach(function(k){ if(k.startsWith('_')) delete STATE.recipes[k]; });
      render();
    } catch (e) {
      document.getElementById('mp-grid').innerHTML = '<div class="mp-error">⚠ '+esc(e.message||'')+'</div>';
    }
  }

  function render(){
    var grid = document.getElementById('mp-grid');
    if (!grid) return;
    var entries = Object.entries(STATE.recipes)
      .filter(function([id,r]){
        if (STATE.family !== 'all' && (r.family || '') !== STATE.family) return false;
        return true;
      })
      .sort(function(a,b){
        var rarOrder = ['common','uncommon','rare','epic','legendary'];
        var ai = rarOrder.indexOf((a[1].rarity || '').toLowerCase());
        var bi = rarOrder.indexOf((b[1].rarity || '').toLowerCase());
        if (ai !== bi) return ai - bi;
        return (a[1].name||'').localeCompare(b[1].name||'', 'fr');
      });
    if (!entries.length) {
      grid.innerHTML = '<div class="mp-empty">Aucune potion dans cette famille.</div>';
      return;
    }
    grid.innerHTML = entries.map(function([id, r]){
      var fam = (r.family || 'soins').toLowerCase();
      var rar = (r.rarity || 'common').toLowerCase();
      var fc = FAMILY_COLORS[fam] || '#9aa0b8';
      var rc = RARITY_COLORS[rar] || '#9aa0b8';
      return (
        '<div class="mp-card" style="--fc:'+fc+';--rc:'+rc+'">' +
          '<div class="mp-card-head">' +
            '<span class="mp-card-emoji">'+(r.icon || '🧪')+'</span>' +
            '<div class="mp-card-titles">' +
              '<div class="mp-card-name">'+esc(r.name || id)+'</div>' +
              '<div class="mp-card-meta">T'+(r.tier_req||1)+' min · '+esc(rar)+' · '+esc(fam)+'</div>' +
            '</div>' +
          '</div>' +
          '<div class="mp-card-effect">'+esc(r.effect || '')+'</div>' +
          '<div class="mp-card-id"><code>/brewing_claim recipe:'+esc(id)+'</code></div>' +
        '</div>'
      );
    }).join('');
  }

  function wire(){
    document.querySelectorAll('.mp-filter').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.mp-filter').forEach(function(b){b.classList.remove('mp-filter-active');});
        btn.classList.add('mp-filter-active');
        STATE.family = btn.dataset.family;
        render();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){wire(); load();});
  else { wire(); load(); }
})();

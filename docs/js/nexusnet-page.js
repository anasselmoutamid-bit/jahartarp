/* ═══════════════════════════════════════════════════════════════════════
   nexusnet-page.js — Catalogue Marché Noir (lecture)
   ═════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var RARITY_COLORS = { common:'#9aa0b8', uncommon:'#44ff88', rare:'#4DA3FF', epic:'#8B5CF6', legendary:'#ffd60a', unique:'#00ffcc' };

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function _getDb(){
    if (window.db) return window.db;
    if (typeof db !== 'undefined') return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(e){}
    }
    return null;
  }

  function _formatPrice(price){
    if (!price) return '';
    return Object.entries(price).map(function([k, v]){
      return v + ' ' + k.replace('_kanite', '').replace(/^./, function(c){return c.toUpperCase();});
    }).join(' + ');
  }

  async function load(){
    var dbref = _getDb();
    if (!dbref) {
      document.getElementById('mp-grid').innerHTML = '<div class="mp-error">⚠ Connexion D1 indisponible.</div>';
      return;
    }
    try {
      var snap = await dbref.collection('config').doc('black_market').get();
      var market = snap.exists ? (snap.data() || {}) : {};
      Object.keys(market).forEach(function(k){ if(k.startsWith('_')) delete market[k]; });

      var rarOrder = ['common','uncommon','rare','epic','legendary','unique'];
      var entries = Object.entries(market).sort(function(a,b){
        var ai = rarOrder.indexOf((a[1].rarity || '').toLowerCase());
        var bi = rarOrder.indexOf((b[1].rarity || '').toLowerCase());
        if (ai !== bi) return ai - bi;
        return (a[1].name||'').localeCompare(b[1].name||'', 'fr');
      });

      var html = entries.map(function([id, idef]){
        var rar = (idef.rarity || 'common').toLowerCase();
        var rc = RARITY_COLORS[rar] || '#9aa0b8';
        return (
          '<div class="mp-card" style="--rc:'+rc+';--fc:'+rc+'">' +
            '<div class="mp-card-head">' +
              '<span class="mp-card-emoji">'+(idef.icon || '◆')+'</span>' +
              '<div class="mp-card-titles">' +
                '<div class="mp-card-name">'+esc(idef.name || id)+'</div>' +
                '<div class="mp-card-meta">'+esc(rar)+'</div>' +
              '</div>' +
            '</div>' +
            '<div class="mp-card-effect">'+esc(idef.description || '')+'</div>' +
            '<div class="mp-card-effect" style="font-style:normal;color:#ffd60a">💰 '+esc(_formatPrice(idef.price))+'</div>' +
            '<div class="mp-card-id"><code>/black_market_buy item:'+esc(id)+'</code></div>' +
          '</div>'
        );
      }).join('');
      document.getElementById('mp-grid').innerHTML = html || '<div class="mp-empty">Aucun item au marché noir.</div>';
    } catch (e) {
      document.getElementById('mp-grid').innerHTML = '<div class="mp-error">⚠ '+esc(e.message||'')+'</div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();

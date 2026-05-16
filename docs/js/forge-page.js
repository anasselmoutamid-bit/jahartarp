/* ═══════════════════════════════════════════════════════════════════════
   forge-page.js — Page Forge dédiée. Affiche les sets Forgeflamme avec
   leurs items et stats.
   ═════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  /* Définition statique des 3 sets — mirror de utils/item_sets.py */
  var SETS = [
    {
      id: 'forgeflamme_volcan',
      name: 'Forgeflamme du Volcan',
      emoji: '🌋',
      color: '#ff4500',
      stat_main: 'STR / RES',
      items: ['ff_volcan_heaume','ff_volcan_cuirasse','ff_volcan_brassards','ff_volcan_greves','ff_volcan_bottes','ff_volcan_marteau'],
      bonus_6: '+150 STR · +100 RES · buff_mult STR ×1.4 · RES ×1.3',
      desc: 'Voie de la force brute. Armure massive, marteau écrasant.'
    },
    {
      id: 'forgeflamme_aurore',
      name: "Forgeflamme de l'Aurore",
      emoji: '☀️',
      color: '#ffd60a',
      stat_main: 'INT / MAN',
      items: ['ff_aurore_diademe','ff_aurore_robe','ff_aurore_gantelets','ff_aurore_sandales','ff_aurore_cape','ff_aurore_baton'],
      bonus_6: '+150 INT · +100 MAN · buff_mult INT ×1.4 · MAN ×1.3',
      desc: 'Voie arcanique. Robe lumineuse, bâton conducteur d\'aurores.'
    },
    {
      id: 'forgeflamme_crepuscule',
      name: 'Forgeflamme du Crépuscule',
      emoji: '🌒',
      color: '#8B5CF6',
      stat_main: 'AGI / SPD',
      items: ['ff_crepuscule_capuche','ff_crepuscule_justaucorps','ff_crepuscule_gants','ff_crepuscule_bottes','ff_crepuscule_cape','ff_crepuscule_lames'],
      bonus_6: '+150 AGI · +100 SPD · buff_mult AGI ×1.4 · SPD ×1.3',
      desc: 'Voie de l\'ombre. Tenue furtive, lames doubles silencieuses.'
    }
  ];

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function _getDb(){
    if (window.db) return window.db;
    if (typeof db !== 'undefined') return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(e){}
    }
    return null;
  }

  function _renderStats(effects){
    if (!effects) return '';
    return Object.keys(effects).map(function(k){
      return '<span class="fg-item-stat">+' + esc(String(effects[k]).replace(/\+/g,'')) + ' ' + k.toUpperCase().slice(0,3) + '</span>';
    }).join(' ');
  }

  function renderSets(items){
    var grid = document.getElementById('fg-sets-grid');
    if (!grid) return;
    grid.innerHTML = SETS.map(function(set){
      var pieces = set.items.map(function(iid){
        var it = items[iid] || {};
        return (
          '<div class="fg-item-row">' +
            '<span class="fg-item-emoji">'+(it.icon || set.emoji)+'</span>' +
            '<span class="fg-item-name">'+esc(it.name || iid)+'</span>' +
            '<span class="fg-item-stats">'+_renderStats(it.stat_effects)+'</span>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="fg-set-card" style="--sc:'+set.color+'">' +
          '<div class="fg-set-head">' +
            '<span class="fg-set-emoji">'+set.emoji+'</span>' +
            '<div class="fg-set-titles">' +
              '<div class="fg-set-name">'+esc(set.name)+'</div>' +
              '<div class="fg-set-stat">'+set.stat_main+' · 6 pièces</div>' +
            '</div>' +
            '<span class="fg-set-rarity">FORGEFLAMME</span>' +
          '</div>' +
          '<div class="fg-set-desc">'+esc(set.desc)+'</div>' +
          '<div class="fg-set-pieces">'+pieces+'</div>' +
          '<div class="fg-set-bonus">' +
            '<div class="fg-set-bonus-label">BONUS SET COMPLET (6/6)</div>' +
            '<div class="fg-set-bonus-val">'+esc(set.bonus_6)+'</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  async function load(){
    try {
      var dbref = _getDb();
      if (!dbref) {
        document.getElementById('fg-sets-grid').innerHTML = '<div class="fg-error">⚠ Connexion D1 indisponible.</div>';
        return;
      }
      var snap = await dbref.collection('config').doc('items').get();
      var data = snap.exists ? (snap.data() || {}) : {};
      var items = {};
      ['items','equipment','signatures'].forEach(function(root){
        var sub = data[root];
        if (sub && typeof sub === 'object') {
          Object.keys(sub).forEach(function(k){ if(!k.startsWith('_')) items[k] = sub[k]; });
        }
      });
      renderSets(items);
    } catch (e) {
      console.error('[forge-page]', e);
      var grid = document.getElementById('fg-sets-grid');
      if (grid) grid.innerHTML = '<div class="fg-error">⚠ Erreur de chargement : '+esc(e.message||'')+'</div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();

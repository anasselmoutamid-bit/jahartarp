/* rituels-page.js — Catalogue bénédictions (lecture) */
(function(){
  'use strict';

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
      var snap = await dbref.collection('config').doc('blessings').get();
      var blessings = snap.exists ? (snap.data() || {}) : {};
      Object.keys(blessings).forEach(function(k){ if(k.startsWith('_')) delete blessings[k]; });

      var entries = Object.entries(blessings);
      if (!entries.length) {
        document.getElementById('mp-grid').innerHTML = '<div class="mp-empty">Aucune bénédiction.</div>';
        return;
      }

      var html = entries.map(function([id, bdef]){
        var effect = bdef.effect || {};
        var details = '';
        if (effect.type === 'stat_buff')        details = '+' + Object.values(effect.stats||{})[0] + ' stats martiales · ' + (effect.duration_hours||24) + 'h';
        else if (effect.type === 'golden_eggs') details = '+' + (effect.amount||1) + ' Golden Egg(s)';
        else if (effect.type === 'passive_kanite_boost') details = '×' + (effect.mult||1.5) + ' Kanite passif · ' + (effect.duration_days||7) + 'j';
        else if (effect.type === 'xp_boost')    details = '×' + (effect.mult||1.5) + ' XP · ' + (effect.duration_hours||24) + 'h';
        else if (effect.type === 'rp_heal_full') details = 'Soin RP complet · narratif';

        return (
          '<div class="mp-card" style="--rc:#ffd60a;--fc:#ffd60a">' +
            '<div class="mp-card-head">' +
              '<span class="mp-card-emoji">'+(bdef.icon || '✨')+'</span>' +
              '<div class="mp-card-titles">' +
                '<div class="mp-card-name">'+esc(bdef.name || id)+'</div>' +
                '<div class="mp-card-meta">'+esc(details)+'</div>' +
              '</div>' +
            '</div>' +
            '<div class="mp-card-effect">'+esc(bdef.description || '')+'</div>' +
            '<div class="mp-card-id"><code>/rituel_invoke blessing:'+esc(id)+'</code></div>' +
          '</div>'
        );
      }).join('');
      document.getElementById('mp-grid').innerHTML = html;
    } catch (e) {
      document.getElementById('mp-grid').innerHTML = '<div class="mp-error">⚠ '+esc(e.message||'')+'</div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();

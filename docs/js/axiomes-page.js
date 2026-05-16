/* ═══════════════════════════════════════════════════════════════════════
   axiomes-page.js — Page catalogue Axiomes (lecture seule)
   ═══════════════════════════════════════════════════════════════════════
   Charge config/axiomes depuis D1 et affiche l'arbre T0 → T1 → T2.
   T3-T5 viendront quand les données sont définies.
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var EMOJI = {
    soldat: "⚔️", mage: "🔮", soigneur: "🍶", hacker: "💻", assassin: "🗡️",
    sniper: "🎯", tireur_rapide: "🔫", eleveur: "🐾", tank: "🛡️", erudit: "📚",
    berserker: "🩸", forgeron: "🔨", mage_favori_nexus: "✨", enforcer: "👑",
    ensorceleur: "💋", decodeur: "📡"
  };
  /* T2 inherits the emoji of its parent unless overridden */
  var T2_OVERRIDE = {
    moine: "🧘", mage_arcaniste: "🔮", mage_soigneur: "💉",
    healer_superieur: "💉", potionniste: "🧪", druide: "🌿",
    pirate_nexusnet: "🏴‍☠️", marche_noir_initie: "🕴️", encodeur: "🔐",
    initie_ombres: "🌑", spadassin_furtif: "🗡️", mage_ombres: "🌒",
    sniper_elite: "🎯", sniper_ombres: "👁️", sniper_arcanique: "✨",
    deadeye: "💀", tireur_ombres: "🌑", tireur_support: "🤝",
    ami_betes: "🐺", chef_meute: "🐻", support_monstres: "🐉", limit_breaker: "💥",
    mur_fer: "🛡️", tank_front: "⚔️", tank_arcanique: "🌟",
    scientifique: "🧬", analyste_nexus: "📊", occultiste: "🕯️",
    rager: "🩸", death_knight: "💀", arcanoberserker: "🌀",
    unleashed: "⛓️‍💥", controled_berserker: "🧠",
    arcanoforgeron: "⚒️", archimage_nexus: "✨",
    oblivion: "🌌", doomslayer: "👹", reverso: "🔄",
    maitre_manipulateur: "🎭", arcanensorceleur: "💫",
    artiste_courtisan: "🎨", orateur: "🎤",
    heraut_nexus: "📡"
  };

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function emojiFor(id, parentId){
    return T2_OVERRIDE[id] || EMOJI[id] || EMOJI[parentId] || "⚜️";
  }

  function kindClass(k){
    if (!k) return 'ax-card-voie';
    if (k.indexOf('secret') >= 0) return 'ax-card-secret';
    if (k.indexOf('metier') >= 0) return 'ax-card-metier';
    return 'ax-card-voie';
  }

  function formatMult(m){
    if (!m) return '';
    var parts = [];
    Object.keys(m).forEach(function(k){
      parts.push('× ' + m[k] + ' ' + k.toUpperCase().slice(0,3));
    });
    return parts.join(' · ');
  }
  function formatCap(c){
    if (!c) return '';
    var parts = [];
    Object.keys(c).forEach(function(k){
      parts.push(k.toUpperCase().slice(0,3) + ' ≤ ' + c[k]);
    });
    return parts.join(' · ');
  }

  function renderCard(id, def){
    var emoji = emojiFor(id, def.parent);
    var kindCls = kindClass(def.kind);
    var raceLine = (def.race_lock && def.race_lock.length)
      ? '<div class="ax-card-race">🔒 ' + esc(def.race_lock.join(' · ')) + '</div>'
      : '';
    var passif = def.passif_silver ? def.passif_silver + ' silver/j' : '';
    var metier = def.metier_system ? '⚙ ' + def.metier_system : '';
    return (
      '<div class="ax-card ' + kindCls + '" data-id="' + esc(id) + '" data-tier="' + def.tier + '">' +
        '<div class="ax-card-emoji">' + emoji + '</div>' +
        '<div class="ax-card-name">' + esc(def.name) + '</div>' +
        '<div class="ax-card-meta">T' + def.tier + ' · ' + esc((def.kind||'').replace(/_/g,' ')) + '</div>' +
        raceLine +
        (def.description ? '<div class="ax-card-desc">' + esc(def.description) + '</div>' : '') +
        '<div class="ax-card-stats">' +
          (formatMult(def.stats_mult) ? '<div class="ax-card-mult">' + formatMult(def.stats_mult) + '</div>' : '') +
          (formatCap(def.stats_cap_max) ? '<div class="ax-card-cap">' + formatCap(def.stats_cap_max) + '</div>' : '') +
        '</div>' +
        (passif ? '<div class="ax-card-passif">💰 ' + passif + '</div>' : '') +
        (metier ? '<div class="ax-card-metier-tag">' + esc(metier) + '</div>' : '') +
      '</div>'
    );
  }

  function renderT1Grid(axiomes){
    var grid = document.getElementById('ax-t1-grid');
    if (!grid) return;
    var ids = Object.keys(axiomes).filter(function(id){
      var d = axiomes[id];
      return d && d.tier === 1;
    });
    /* Order: standards first (no race_lock), then secrets */
    ids.sort(function(a,b){
      var da = axiomes[a], db = axiomes[b];
      var aSec = da.kind && da.kind.indexOf('secret') >= 0 ? 1 : 0;
      var bSec = db.kind && db.kind.indexOf('secret') >= 0 ? 1 : 0;
      if (aSec !== bSec) return aSec - bSec;
      return (da.name || '').localeCompare(db.name || '', 'fr');
    });
    grid.innerHTML = ids.map(function(id){ return renderCard(id, axiomes[id]); }).join('');
  }

  function renderT2Trees(axiomes){
    var container = document.getElementById('ax-t2-trees');
    if (!container) return;
    /* Group T2 by parent T1 */
    var trees = {};
    Object.keys(axiomes).forEach(function(id){
      var d = axiomes[id];
      if (!d || d.tier !== 2) return;
      var parent = d.parent;
      if (!parent) return;
      if (!trees[parent]) trees[parent] = [];
      trees[parent].push(id);
    });
    /* Render each parent T1 with its T2 children */
    var t1Order = Object.keys(axiomes).filter(function(id){
      return axiomes[id] && axiomes[id].tier === 1;
    }).sort(function(a,b){
      var da = axiomes[a], db = axiomes[b];
      var aSec = da.kind && da.kind.indexOf('secret') >= 0 ? 1 : 0;
      var bSec = db.kind && db.kind.indexOf('secret') >= 0 ? 1 : 0;
      if (aSec !== bSec) return aSec - bSec;
      return (da.name || '').localeCompare(db.name || '', 'fr');
    });

    var html = t1Order.map(function(t1Id){
      var t1Def = axiomes[t1Id];
      var children = (trees[t1Id] || []).sort(function(a,b){
        return (axiomes[a].name || '').localeCompare(axiomes[b].name || '', 'fr');
      });
      var sectionKind = kindClass(t1Def.kind);
      return (
        '<div class="ax-t2-tree ' + sectionKind + '">' +
          '<div class="ax-t2-root">' +
            '<span class="ax-t2-root-emoji">' + emojiFor(t1Id) + '</span>' +
            '<span class="ax-t2-root-name">' + esc(t1Def.name) + '</span>' +
            '<span class="ax-t2-root-meta">T1 · ' + (children.length || 0) + ' évolution' + (children.length > 1 ? 's' : '') + '</span>' +
          '</div>' +
          '<div class="ax-t2-children">' +
            (children.length === 0
              ? '<div class="ax-t2-empty">Aucune évolution T2 définie.</div>'
              : children.map(function(c2){ return renderCard(c2, axiomes[c2]); }).join('')
            ) +
          '</div>' +
        '</div>'
      );
    }).join('');

    container.innerHTML = html;
  }

  function _getDb(){
    if (window.db) return window.db;
    if (typeof db !== 'undefined') return db;
    /* Init D1 client if firebase shim is loaded */
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(e){}
    }
    return null;
  }

  async function load(){
    try {
      var dbref = _getDb();
      if (!dbref) {
        document.getElementById('ax-t1-grid').innerHTML = '<div class="ax-error">⚠ Connexion D1 indisponible.</div>';
        return;
      }
      var snap = await dbref.collection('config').doc('axiomes').get();
      if (!snap.exists) {
        document.getElementById('ax-t1-grid').innerHTML = '<div class="ax-error">⚠ Configuration Axiomes introuvable.</div>';
        return;
      }
      var axiomes = snap.data() || {};
      /* Strip meta keys */
      Object.keys(axiomes).forEach(function(k){ if (k.indexOf('_') === 0) delete axiomes[k]; });
      renderT1Grid(axiomes);
      renderT2Trees(axiomes);
    } catch (e) {
      console.error('[axiomes-page]', e);
      document.getElementById('ax-t1-grid').innerHTML = '<div class="ax-error">⚠ Erreur de chargement : ' + esc(e.message || '') + '</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

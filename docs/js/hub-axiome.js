/* ═══════════════════════════════════════════════════════════════════════
   hub-axiome.js — Onglet Axiome (Phase 1)
   ═══════════════════════════════════════════════════════════════════════
   Lecture seule pour Phase 1. Affiche l'axiome actuel + évolutions
   disponibles + solde Axium. La page complète (axiomes.html) viendra
   en Phase 2 avec l'arbre visualisé.
   ═════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  /* Catalogue minimal (mirror de data/axiomes.json côté bot, T1 only pour
     l'instant — Phase 2 ajoutera les évolutions complètes en lecture depuis
     une collection Firestore config/axiomes). */
  var AXIOMES_T1 = {
    soldat:           {name:"Soldat",                tier:1, kind:"voie",         emoji:"⚔️", race:null},
    mage:             {name:"Mage",                  tier:1, kind:"voie",         emoji:"🔮", race:null},
    soigneur:         {name:"Soigneur",              tier:1, kind:"metier",       emoji:"🍶", race:null},
    hacker:           {name:"Hacker",                tier:1, kind:"metier",       emoji:"💻", race:null},
    assassin:         {name:"Assassin",              tier:1, kind:"voie",         emoji:"🗡️", race:null},
    sniper:           {name:"Sniper",                tier:1, kind:"voie",         emoji:"🎯", race:null},
    tireur_rapide:    {name:"Tireur Rapide",         tier:1, kind:"voie",         emoji:"🔫", race:null},
    eleveur:          {name:"Éleveur",               tier:1, kind:"metier",       emoji:"🐾", race:null},
    tank:             {name:"Tank",                  tier:1, kind:"voie",         emoji:"🛡️", race:null},
    erudit:           {name:"Érudit",                tier:1, kind:"metier",       emoji:"📚", race:null},
    berserker:        {name:"Berserker",             tier:1, kind:"voie_secret",  emoji:"🩸", race:"Orc/Oni/Minotaure/Jinko/Garran"},
    forgeron:         {name:"Forgeron",              tier:1, kind:"metier_secret",emoji:"🔨", race:"Dwarf"},
    mage_favori_nexus:{name:"Mage Favori du Nexus",  tier:1, kind:"metier_secret",emoji:"✨", race:"Elf/Drow/Qilin"},
    enforcer:         {name:"Enforcer",              tier:1, kind:"voie_secret",  emoji:"👑", race:"Dragon/Aberration Ancestrale"},
    ensorceleur:      {name:"Ensorceleur",           tier:1, kind:"metier_secret",emoji:"💋", race:"Kitsune/Moth/Succubus/Devil/Archdevil"},
    decodeur:         {name:"Décodeur",              tier:1, kind:"metier_secret",emoji:"📡", race:"Android"}
  };

  function _esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _currentChar(){
    /* Prefer window.CHAR (set by hub-core after loadCharacter) ; fallback sur la
       binding lexicale, qui peut être null tant que hub-core n'a pas chargé. */
    if (window.CHAR) return window.CHAR;
    try { if (typeof CHAR !== 'undefined' && CHAR) return CHAR; } catch(_) {}
    return null;
  }

  function _renderNoChar(container){
    container.innerHTML =
      '<div class="axiome-empty">' +
        '<div class="axiome-empty-icon">⚜️</div>' +
        '<div class="axiome-empty-title">Aucun personnage actif</div>' +
        '<div class="axiome-empty-text">Sélectionne un personnage actif pour gérer son Axiome.</div>' +
      '</div>';
  }

  function _renderPanel(container, char){
    var axiomeId = (char.axiome || 'neophyte');
    var level = parseInt(char.level||1)||1;
    var def = AXIOMES_T1[axiomeId];
    var isNeophyte = (axiomeId === 'neophyte' || !def);

    /* Section principale : axiome actuel */
    var current;
    if(isNeophyte){
      current =
        '<div class="axiome-card axiome-card-neophyte">' +
          '<div class="axiome-card-emoji">⚜️</div>' +
          '<div class="axiome-card-body">' +
            '<div class="axiome-card-name">Néophyte</div>' +
            '<div class="axiome-card-meta">Tier 0 · aucune voie choisie</div>' +
            '<div class="axiome-card-desc">À partir du niveau 50, tu peux choisir une voie ou un métier. Le switch coûte 1 Axium (monnaie HRP donnée par l\'owner).</div>' +
          '</div>' +
        '</div>';
    } else {
      current =
        '<div class="axiome-card" data-kind="'+_esc(def.kind)+'">' +
          '<div class="axiome-card-emoji">'+def.emoji+'</div>' +
          '<div class="axiome-card-body">' +
            '<div class="axiome-card-name">'+_esc(def.name)+'</div>' +
            '<div class="axiome-card-meta">Tier '+def.tier+' · '+_esc(def.kind.replace(/_/g,' '))+'</div>' +
            (def.race ? '<div class="axiome-card-race">🔒 Race-lock : '+_esc(def.race)+'</div>' : '') +
          '</div>' +
        '</div>';
    }

    /* Section catalogue : tous les axiomes T1 disponibles (visualisation) */
    var canT1 = (level >= 50);
    var cards = Object.keys(AXIOMES_T1).map(function(id){
      var a = AXIOMES_T1[id];
      var locked = !canT1;
      var current = (id === axiomeId);
      var raceLockClass = a.race ? 'axiome-tile-secret' : 'axiome-tile-std';
      return (
        '<div class="axiome-tile '+raceLockClass+(current?' is-current':'')+(locked?' is-locked':'')+'" data-id="'+_esc(id)+'">' +
          '<div class="axiome-tile-emoji">'+a.emoji+'</div>' +
          '<div class="axiome-tile-name">'+_esc(a.name)+'</div>' +
          '<div class="axiome-tile-meta">'+(a.kind.indexOf('secret')>=0?'Secret · race-lock':'Standard')+'</div>' +
          (current ? '<div class="axiome-tile-tag">ACTUEL</div>' : '') +
          (a.race ? '<div class="axiome-tile-race">'+_esc(a.race)+'</div>' : '') +
        '</div>'
      );
    }).join('');

    var levelGate = canT1 ? '' :
      '<div class="axiome-gate">⚠ Niveau 50 requis pour choisir un Axiome T1. Tu es niveau <strong>'+level+'</strong>.</div>';

    container.innerHTML =
      '<div class="axiome-current">' + current + '</div>' +
      levelGate +
      '<div class="axiome-catalog-title">Catalogue T1 — 10 voies standards + 6 voies secrètes (race-locked)</div>' +
      '<div class="axiome-tiles">' + cards + '</div>' +
      '<div class="axiome-hint">⚙ Pour changer d\'Axiome : utilise <code>/switch_axiome key:&lt;id&gt;</code> sur Discord (coûte 1 Axium).<br>L\'arbre d\'évolution complet (T2-T5) sera disponible sur la page <code>axiomes.html</code> dédiée (en cours).</div>';
  }

  async function loadAxiome(){
    var container = document.getElementById('axiome-content');
    if(!container) return;
    var char = _currentChar();
    if(!char){
      _renderNoChar(container);
      return;
    }
    _renderPanel(container, char);
  }

  window._loadAxiome = loadAxiome;
})();

/* ══════════════════════════════════════════════════════════════
   item-icons.js  —  SVG icons pour les items, par slot / type
   Remplace les emojis (📦 etc.) partout dans l'UI inventaire.
   Expose : window.getItemIcon(item, sizePx?)  → string HTML
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     PATHS  (viewBox 0 0 24 24 · stroke-based · Lucide-style)
     ───────────────────────────────────────────────────────────── */
  var P = {

    /* ── TÊTE ── casque / heaume */
    tete: 'M4 12 C4 7.58 7.58 4 12 4 16.42 4 20 7.58 20 12 L20 14 Q20 15 19 15 L5 15 Q4 15 4 14 Z M8 15 L8 18 M16 15 L16 18 M8 18 L16 18',

    /* ── COU ── collier / chaîne */
    cou: 'M8 5 A4 4 0 0 1 16 5 M16 5 C18 6 19 8 19 10 C19 13 17 15 14 16 L12 17 L10 16 C7 15 5 13 5 10 C5 8 6 6 8 5 M12 14 L12 19 M10 19 L14 19',

    /* ── OREILLES ── boucle d'oreille */
    oreilles: 'M12 3 L14 8 L12 10 L10 8 Z M12 10 L11 14 L13 14 Z M11 14 L10 18 M13 14 L14 18 M10 18 L14 18',

    /* ── VISAGE ── masque / visière */
    visage: 'M5 8 Q5 5 8 5 L16 5 Q19 5 19 8 L19 14 Q19 17 16 17 L8 17 Q5 17 5 14 Z M8 10 L11 10 M13 10 L16 10 M9 13 Q12 15 15 13',

    /* ── TORSE ── plastron / armure */
    torse: 'M7 4 L3 7 L3 13 L8 13 L8 20 L16 20 L16 13 L21 13 L21 7 L17 4 Z M8 4 L8 13 M16 4 L16 13',

    /* ── DOS ── cape / manteau */
    dos: 'M12 4 C8 4 5 7 5 11 L5 19 L7 19 L7 15 C7 12 9 11 12 11 C15 11 17 12 17 15 L17 19 L19 19 L19 11 C19 7 16 4 12 4 Z',

    /* ── BRAS ── brassard / épaulière */
    bras: 'M5 9 Q5 7 7 7 L17 7 Q19 7 19 9 L19 15 Q19 17 17 17 L7 17 Q5 17 5 15 Z M9 7 L9 17 M15 7 L15 17',

    /* ── MAINS ── gant / gantelet */
    mains: 'M8 11 L8 6 Q8 5 9 5 Q10 5 10 6 L10 4 Q10 3 11 3 Q12 3 12 4 L12 3 Q12 2 13 2 Q14 2 14 3 L14 5 Q14 4 15 4 Q16 4 16 5 L16 11 Q16 15 12 17 Q10 17 8 15 Z M8 11 L6 13 Q5 15 7 16 L8 15',

    /* ── POIGNETS ── bracelet / manchette */
    poignets: 'M5 10 Q5 8 7 8 L17 8 Q19 8 19 10 L19 14 Q19 16 17 16 L7 16 Q5 16 5 14 Z M9 8 L9 16 M15 8 L15 16 M8 12 L16 12',

    /* ── DOIGTS ── bague */
    doigts: 'M12 7 A5 5 0 1 0 12 17 A5 5 0 0 0 12 7 M12 7 A3 3 0 1 1 12 13 A3 3 0 0 1 12 7 M12 4 L12 7 M12 3 A1 1 0 1 1 12 3',

    /* ── JAMBES ── jambières / cuissardes */
    jambes: 'M8 4 L16 4 L16 12 L14 20 L10 20 L8 12 Z M12 4 L12 12',

    /* ── PIEDS ── bottes / chaussures */
    pieds: 'M6 8 L18 8 L18 15 Q18 17 16 17 L7 17 Q6 17 6 16 Z M6 15 L18 15 M10 17 L9 20 L15 20 L14 17',

    /* ── ARMES LOURDES ── épée / marteau */
    armes_h: 'M5 19 L15 9 M14 5 L19 5 L19 10 L14 10 Z M15 9 L14 10 M5 19 L5 14 L7 14',

    /* ── ARMES LÉGÈRES ── dague / pistolet */
    armes_l: 'M7 17 L17 7 M16 6 L18 4 L20 6 L18 8 Z M7 17 L5 18 L6 16 Z M13 10 L15 8',

    /* ── SPÉCIAUX ── étoile / relique */
    special: 'M12 2 L14.5 9 L22 9 L16 13.5 L18.5 21 L12 16.5 L5.5 21 L8 13.5 L2 9 L9.5 9 Z',

    /* ── ERP (IRP) ── empreinte / marque runique */
    erp: 'M12 3 L3 8 L3 16 L12 21 L21 16 L21 8 Z M12 3 L12 21 M3 8 L12 12.5 L21 8 M3 16 L12 12.5 L21 16',

    /* ── DOMINION (IRP) ── couronne de domination */
    dominion: 'M3 17 L3 10 L7 14 L12 7 L17 14 L21 10 L21 17 Z M2 17 L22 17',

    /* ── SEIGNEURIE / LORD (IRP) ── sceptre royal */
    lord: 'M12 2 L12 20 M9 5 L15 5 L13 9 L11 9 Z M10 20 L14 20 M8 14 L16 14',

    /* ── CONSOMMABLE ── fiole / potion */
    consumable: 'M9 3 L15 3 L16 8 Q19 11 19 15 A7 7 0 0 1 5 15 Q5 11 8 8 Z M9 3 L9 6 M15 3 L15 6 M8 8 L16 8 M9 13 L9 13',

    /* ── NOURRITURE ── pomme / repas */
    food: 'M12 7 C10 7 7 9 7 13 C7 17 9 20 12 20 C15 20 17 17 17 13 C17 9 14 7 12 7 M12 7 C12 5 13 3 15 3 M12 7 C10 5 11 3 12 3',

    /* ── AUTRE / DÉFAUT ── boite / colis */
    other: 'M3 9 L12 4 L21 9 L21 20 L3 20 Z M3 9 L12 14 L21 9 M12 14 L12 20',

    /* ── FRAGMENT / NOYAU ── sphère */
    fragment: 'M12 4 A8 8 0 1 0 12 20 A8 8 0 0 0 12 4 M4 12 L20 12 M12 4 Q18 8 18 12 Q18 16 12 20 M12 4 Q6 8 6 12 Q6 16 12 20',

    /* ── RESSOURCE ── cristal hexagonal */
    resource: 'M8 3 L16 3 L21 11 L16 19 L8 19 L3 11 Z M12 7 L12 17 M7 9 L17 13 M17 9 L7 13',

  };

  /* ─────────────────────────────────────────────────────────────
     Mapping type → icône par défaut
     ───────────────────────────────────────────────────────────── */
  var TYPE_FALLBACK = {
    equipment:  'other',
    weapon:     'armes_h',
    consumable: 'consumable',
    food:       'food',
    usable:     'consumable',
    resource:   'resource',
    fragment:   'fragment',
    material:   'resource',
  };

  /* ─────────────────────────────────────────────────────────────
     getItemIcon(item, sizePx?)
     item : { slot?, type?, image? }
     retourne un string HTML complet (svg ou img si item.image)
     ───────────────────────────────────────────────────────────── */
  function getItemIcon(item, sizePx) {
    if (!item) item = {};
    var sz = sizePx || 28;

    /* Si l'item a une image définie et non-vide, on la privilégie */
    if (item.image && String(item.image).trim()) {
      return '<img src="' + _esc(item.image) + '" alt="' + _esc(item.name || '') + '" style="width:' + sz + 'px;height:' + sz + 'px;object-fit:contain;border-radius:3px;display:block" onerror="this.style.display=\'none\'">';
    }

    /* Résolution slot → path */
    var slot = (item.slot || '').toLowerCase();
    var type = (item.type || '').toLowerCase();

    var key = P[slot]
      ? slot
      : (TYPE_FALLBACK[type] ? TYPE_FALLBACK[type] : null);

    var path = key ? P[key] : P.other;

    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'
      + ' width="' + sz + '" height="' + sz + '"'
      + ' style="display:block;flex-shrink:0">'
      + '<path d="' + path + '"/>'
      + '</svg>';
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  /* Export global */
  global.getItemIcon = getItemIcon;

})(window);

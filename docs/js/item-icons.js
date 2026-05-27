/* ══════════════════════════════════════════════════════════════
   item-icons.js  —  Icône SVG uniforme (boite) pour tous les items
   Expose : window.getItemIcon(item, sizePx?)  → string HTML
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* Chemin SVG — boite/colis générique (viewBox 0 0 24 24) */
  var BOX_PATH = 'M3 9 L12 4 L21 9 L21 20 L3 20 Z M3 9 L12 14 L21 9 M12 14 L12 20';

  /* ─────────────────────────────────────────────────────────────
     getItemIcon(item, sizePx?)
     item : { image?, name? }
     retourne un string HTML complet (svg ou img si item.image)
     ───────────────────────────────────────────────────────────── */
  function getItemIcon(item, sizePx) {
    if (!item) item = {};
    var sz = sizePx || 28;

    /* Si l'item a une image définie et non-vide, on la privilégie */
    if (item.image && String(item.image).trim()) {
      return '<img src="' + _esc(item.image) + '" alt="' + _esc(item.name || '') + '" style="width:' + sz + 'px;height:' + sz + 'px;object-fit:contain;border-radius:3px;display:block" onerror="this.style.display=\'none\'">';
    }

    /* Sinon : boite SVG uniforme */
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'
      + ' width="' + sz + '" height="' + sz + '"'
      + ' style="display:block;flex-shrink:0">'
      + '<path d="' + BOX_PATH + '"/>'
      + '</svg>';
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  /* Export global */
  global.getItemIcon = getItemIcon;

})(window);

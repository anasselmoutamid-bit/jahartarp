/* ══════════════════════════════════════════════════════════════════════
   hub-benedictions.js — Affiche les bénédictions actives du perso sur
   le dashboard Hub, et applique les multiplicateurs aux stats affichées.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function _injectCss(){
    if (document.getElementById('hub-benedictions-css')) return;
    var st = document.createElement('style');
    st.id = 'hub-benedictions-css';
    st.textContent = [
      '.hub-bened-card{background:linear-gradient(135deg,rgba(139,92,246,0.06),transparent 60%),rgba(12,7,28,0.55);',
      '  border:1px solid rgba(139,92,246,0.25);padding:14px 16px;border-radius:10px;margin-top:14px}',
      '.hub-bened-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;',
      '  font-family:Orbitron,sans-serif;font-weight:700;letter-spacing:0.18em;',
      '  text-transform:uppercase;color:#b48cff;font-size:0.7rem}',
      '.hub-bened-head .glyph{font-size:1.1rem;filter:drop-shadow(0 0 6px rgba(180,140,255,0.6))}',
      '.hub-bened-head .count{margin-left:auto;color:#FFD60A;font-family:Rajdhani;font-weight:600}',
      '.hub-bened-list{display:flex;flex-direction:column;gap:8px}',
      '.hub-bened-row{display:flex;align-items:center;gap:10px;padding:8px 10px;',
      '  background:rgba(8,5,18,0.6);border:1px solid rgba(139,92,246,0.18);border-radius:6px;',
      '  font-family:Rajdhani,sans-serif;font-size:0.84rem}',
      '.hub-bened-row .ico{font-size:1.2rem}',
      '.hub-bened-row .name{flex:1;color:#ece4ff;font-weight:600;letter-spacing:0.04em}',
      '.hub-bened-row .eff{color:#FFD60A;font-family:"Courier New",monospace;font-size:0.78rem}',
      '.hub-bened-row .exp{color:#7a6da3;font-family:"Courier New",monospace;font-size:0.7rem;min-width:64px;text-align:right}',
      '.hub-bened-empty{padding:14px 8px;text-align:center;color:#5a4d80;font-family:Rajdhani;',
      '  font-style:italic;font-size:0.82rem}',
      '.hub-bened-link{display:block;margin-top:10px;text-align:center;',
      '  font-family:Orbitron,sans-serif;font-weight:600;font-size:0.66rem;',
      '  letter-spacing:0.2em;text-transform:uppercase;color:#b48cff;',
      '  text-decoration:none;padding:6px 0;border-top:1px dashed rgba(139,92,246,0.18)}',
      '.hub-bened-link:hover{color:#FFD60A}'
    ].join('');
    document.head.appendChild(st);
  }

  function _fmtRemaining(ms){
    if (ms <= 0) return 'expirée';
    var days = Math.floor(ms / (24*3600*1000));
    var hours = Math.floor((ms % (24*3600*1000)) / (3600*1000));
    var mins = Math.floor((ms % (3600*1000)) / 60000);
    if (days > 0) return days + 'j ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + mins + 'm';
    if (mins > 0) return mins + 'm';
    return '< 1m';
  }

  function _escape(s){
    return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _active(c){
    if (!c || !Array.isArray(c.benedictions)) return [];
    var now = Date.now();
    return c.benedictions.filter(function(b){
      return b && b.expires_at && b.expires_at > now;
    }).sort(function(a,b){ return (b.obtained_at||0)-(a.obtained_at||0); });
  }

  /**
   * Combine les bénédictions actives en multiplicateurs de stats.
   * Retourne un objet { strength: 1.12, mana: 1.08, ... } à passer au pipeline
   * de calcul de stats du hub (hub-dashboard.js applique déjà des mults).
   */
  function _statMultipliers(c){
    var out = {};
    var active = _active(c);
    active.forEach(function(b){
      if (b.kind === 'stat_mult' || b.kind === 'stat_mult_random') {
        (b.stats||[]).forEach(function(s){
          out[s] = (out[s] || 1) * (b.mult || 1);
        });
      } else if (b.kind === 'stat_mult_all') {
        var statsAll = ['strength','agility','speed','intelligence','mana','resistance','charisma','aura'];
        statsAll.forEach(function(s){
          out[s] = (out[s] || 1) * (b.mult || 1);
        });
      }
      /* xp_boost, kanite_boost, reroll_token : pas d'impact sur stats. */
    });
    return out;
  }

  function _render(){
    if (typeof CHAR === 'undefined' || !CHAR) return;
    var host = document.querySelector('#panel-dashboard .dash-right');
    if (!host) return;
    var existing = host.querySelector('.hub-bened-card');

    var active = _active(CHAR);
    if (active.length === 0) {
      /* Ne rien afficher si pas de bénéd. — moins de bruit visuel */
      if (existing) existing.remove();
      return;
    }

    var card = existing || document.createElement('div');
    card.className = 'hub-bened-card';

    var rows = active.map(function(b){
      var ico = '✦';
      if (b.kind === 'xp_boost') ico = '★';
      else if (b.kind === 'kanite_boost') ico = '◈';
      else if (b.kind === 'reroll_token') ico = '♾';
      var remaining = b.expires_at - Date.now();
      var eff = '';
      if (b.kind === 'stat_mult' || b.kind === 'stat_mult_random' || b.kind === 'stat_mult_all') {
        eff = '×' + (b.mult || 1).toFixed(2);
      } else if (b.kind === 'xp_boost') {
        eff = '+' + Math.round((b.boost_pct||0)*100) + '% XP';
      } else if (b.kind === 'kanite_boost') {
        eff = '+' + Math.round((b.boost_pct||0)*100) + '% Kanite';
      } else if (b.kind === 'reroll_token') {
        eff = 'Re-roll';
      }
      return '<div class="hub-bened-row">' +
        '<span class="ico">' + ico + '</span>' +
        '<span class="name">' + _escape(b.label || 'Bénédiction') + '</span>' +
        '<span class="eff">' + _escape(eff) + '</span>' +
        '<span class="exp">' + _fmtRemaining(remaining) + '</span>' +
      '</div>';
    }).join('');

    card.innerHTML =
      '<div class="hub-bened-head">' +
        '<span class="glyph">✦</span>' +
        '<span>Bénédictions actives</span>' +
        '<span class="count">' + active.length + '</span>' +
      '</div>' +
      '<div class="hub-bened-list">' + rows + '</div>' +
      '<a href="sanctuaire.html?char=' + encodeURIComponent(CHAR_ID || '') + '" class="hub-bened-link">Sanctuaire des Principes →</a>';

    if (!existing) {
      host.appendChild(card);
    }
  }

  function _tryRender(){
    _injectCss();
    if (typeof CHAR !== 'undefined' && CHAR) {
      _render();
      return true;
    }
    return false;
  }

  function _waitChar(){
    if (_tryRender()) return;
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if (_tryRender() || tries > 60) { clearInterval(iv); }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitChar);
  } else {
    _waitChar();
  }

  /* Re-render périodique pour mettre à jour les compteurs d'expiration */
  setInterval(function(){
    if (typeof CHAR !== 'undefined' && CHAR) _render();
  }, 60000);

  /* Exposes for stat pipeline integration */
  window.getBenedictionStatMultipliers = _statMultipliers;
  window.refreshBenedictionsWidget = _render;
})();

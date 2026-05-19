/* ══════════════════════════════════════════════════════════════════════
   hub-hack-alerts.js — Surface des alertes de hack sur le dashboard.
   Lit CHAR.hack_alerts, affiche une bannière, permet de marquer comme lu.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* Css */
  function _injectCss(){
    if (document.getElementById('hack-alerts-css')) return;
    var st = document.createElement('style');
    st.id = 'hack-alerts-css';
    st.textContent = [
      '.hack-alerts-banner{margin:0 0 18px;padding:14px 18px;',
      '  background:linear-gradient(90deg,rgba(255,26,58,0.12),transparent 80%),rgba(20,6,12,0.7);',
      '  border:1px solid rgba(255,26,58,0.45);border-left:3px solid #ff1a3a;',
      '  position:relative}',
      '.hack-alerts-banner-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;',
      '  font-family:Orbitron,sans-serif;font-weight:700;letter-spacing:0.2em;',
      '  text-transform:uppercase;color:#ff3050;font-size:0.85rem}',
      '.hack-alerts-banner-head .glyph{font-size:1.4rem;filter:drop-shadow(0 0 6px rgba(255,48,80,0.5))}',
      '.hack-alerts-banner-head .count{margin-left:auto;font-family:Rajdhani,sans-serif;',
      '  background:#ff1a3a;color:#fff;padding:2px 10px;font-size:0.75rem}',
      '.hack-alerts-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}',
      '.hack-alerts-item{padding:10px 12px;background:rgba(8,2,10,0.6);',
      '  border:1px solid rgba(255,26,58,0.25);font-family:Rajdhani,sans-serif;',
      '  font-size:0.92rem;color:#ffb0bd;line-height:1.45}',
      '.hack-alerts-item .h{display:flex;align-items:center;gap:8px;margin-bottom:4px;',
      '  font-weight:700;letter-spacing:0.06em;color:#ffd9e0}',
      '.hack-alerts-item .h .o{font-family:Orbitron;font-size:0.65rem;letter-spacing:0.2em;',
      '  text-transform:uppercase;padding:1px 8px;border:1px solid currentColor}',
      '.hack-alerts-item .h .o.success{color:#ff1a3a}',
      '.hack-alerts-item .h .o.fail{color:#5fb878}',
      '.hack-alerts-item .h .o.blocked{color:#c98c2c}',
      '.hack-alerts-item .h .dt{margin-left:auto;font-family:Rajdhani;font-weight:500;',
      '  font-size:0.75rem;color:#8a606c}',
      '.hack-alerts-item .body{font-size:0.88rem;color:#ffb0bd}',
      '.hack-alerts-item .body strong{color:#ff3050}',
      '.hack-alerts-loot{margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;',
      '  font-family:"Courier New",monospace;font-size:0.85rem;color:#ff3050}',
      '.hack-alerts-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.hack-alerts-btn{padding:6px 14px;background:transparent;color:#ff3050;',
      '  border:1px solid #8a0d22;font-family:Orbitron,sans-serif;font-weight:600;',
      '  font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;',
      '  transition:all 0.2s}',
      '.hack-alerts-btn:hover{background:#ff1a3a;color:#fff;border-color:#ff1a3a}'
    ].join('');
    document.head.appendChild(st);
  }

  function _fmtDate(ts){
    if (!ts) return '';
    try {
      var d = new Date(ts);
      var pad = function(n){ return n<10?'0'+n:''+n; };
      return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+
             ' '+pad(d.getHours())+':'+pad(d.getMinutes());
    } catch(_) { return ''; }
  }

  function _escape(s){
    return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _curLabel(cur){
    return String(cur||'').replace('_kanite','').toUpperCase()+' K';
  }

  function _outcomeLabel(o){
    if (o==='success') return 'PIRATÉ';
    if (o==='blocked') return 'BLOQUÉ';
    return 'TENTATIVE';
  }

  async function _dismissAlerts(){
    try {
      if (typeof CHAR === 'undefined' || !CHAR || typeof CHAR_ID === 'undefined') return;
      CHAR.hack_alerts = [];
      await db.collection('characters').doc(String(CHAR_ID)).set({
        hack_alerts: [],
        updated_at: Date.now()
      }, { merge: true });
      _render();
    } catch (e) {
      console.warn('[hack-alerts] dismiss failed', e);
      alert('Impossible de marquer comme lu : ' + (e.message || e));
    }
  }

  function _render(){
    if (typeof CHAR === 'undefined' || !CHAR) return;
    var alerts = Array.isArray(CHAR.hack_alerts) ? CHAR.hack_alerts.slice() : [];
    var host = document.querySelector('#panel-dashboard');
    if (!host) return;

    /* Remove existing banner */
    var existing = host.querySelector('.hack-alerts-banner');
    if (existing) existing.remove();

    if (alerts.length === 0) return;

    /* Plus récent en premier */
    alerts.sort(function(a,b){ return (b.at||0) - (a.at||0); });

    var itemsHtml = alerts.map(function(a){
      var outcome = a.outcome || 'fail';
      var label = _outcomeLabel(outcome);
      var body;
      if (outcome === 'success') {
        var lootBits = [];
        var t = a.transferred || {};
        Object.keys(t).forEach(function(cur){
          lootBits.push('<span>-' + Number(t[cur]).toLocaleString() + ' ' + _curLabel(cur) + '</span>');
        });
        var loot = lootBits.length ? '<div class="hack-alerts-loot">' + lootBits.join('') + '</div>' : '';
        body = 'Ton compte a été piraté par <strong>' + _escape(a.hacker_name || 'Inconnu') + '</strong>.' + loot;
      } else if (outcome === 'blocked') {
        body = 'Ta <strong>Puce Anti-Hack</strong> a bloqué une tentative de <strong>' + _escape(a.hacker_name || 'Inconnu') + '</strong>. La puce a été consommée.';
      } else {
        body = '<strong>' + _escape(a.hacker_name || 'Inconnu') + '</strong> a échoué à pirater ton compte. Son identité est connue.';
      }
      return '<div class="hack-alerts-item">' +
        '<div class="h">' +
          '<span class="o ' + outcome + '">' + label + '</span>' +
          '<span class="dt">' + _fmtDate(a.at) + '</span>' +
        '</div>' +
        '<div class="body">' + body + '</div>' +
      '</div>';
    }).join('');

    var banner = document.createElement('div');
    banner.className = 'hack-alerts-banner';
    banner.innerHTML =
      '<div class="hack-alerts-banner-head">' +
        '<span class="glyph">⚠</span>' +
        '<span>Alertes DarkNexusNet</span>' +
        '<span class="count">' + alerts.length + '</span>' +
      '</div>' +
      '<div class="hack-alerts-list">' + itemsHtml + '</div>' +
      '<div class="hack-alerts-actions">' +
        '<button type="button" class="hack-alerts-btn" id="hack-alerts-dismiss">Marquer comme lu</button>' +
      '</div>';

    /* Inject after the section header `sh`, before dash-grid */
    var grid = host.querySelector('.dash-grid');
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(banner, grid);
    } else {
      host.appendChild(banner);
    }

    var btn = banner.querySelector('#hack-alerts-dismiss');
    if (btn) btn.addEventListener('click', _dismissAlerts);
  }

  function _tryRender(){
    _injectCss();
    if (typeof CHAR !== 'undefined' && CHAR) {
      _render();
      return true;
    }
    return false;
  }

  /* Poll jusqu'à ce que CHAR soit chargé (Hub charge en async) */
  function _waitChar(){
    if (_tryRender()) return;
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if (_tryRender() || tries > 60) {  /* ~30s max */
        clearInterval(iv);
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitChar);
  } else {
    _waitChar();
  }

  /* Expose pour refresh manuel après modification de CHAR */
  window.refreshHackAlerts = _render;
})();

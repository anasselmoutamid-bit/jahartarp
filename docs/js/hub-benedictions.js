/* ══════════════════════════════════════════════════════════════════════
   hub-benedictions.js — Affiche les bénédictions actives du perso sur
   le dashboard Hub, et applique les multiplicateurs aux stats affichées.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ── Axiome Favori du Nexus : prière dédiée ───────────────────────────
     Le cooldown 3 jours et le taux 75/85/95% sont gérés via
     character.prayer_log.axiome_last_at (timestamp ms) — distinct du
     prayer_log.count utilisé au Sanctuaire.                              */
  var AX_PRAYER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

  function _axBenedRate(c){
    if (window.AxiomeSkills && typeof window.AxiomeSkills.getBenedictionRate === 'function') {
      return window.AxiomeSkills.getBenedictionRate(c) || 0;
    }
    var t = (c && c.axiome_tree_unlocked) || {};
    if (t['favori_nexus_ii.benediction-supreme']) return 0.95;
    if (t['favori_nexus.benediction-renforcee']) return 0.85;
    if (t['favori_nexus.pacte-de-priere']) return 0.75;
    return 0;
  }
  function _axPrayerCooldownLeft(c){
    var last = (c && c.prayer_log && c.prayer_log.axiome_last_at) || 0;
    return Math.max(0, AX_PRAYER_COOLDOWN_MS - (Date.now() - last));
  }
  function _axCanPray(c){
    return _axBenedRate(c) > 0 && _axPrayerCooldownLeft(c) <= 0;
  }

  /* Exécute une prière axiome : roll vs taux, écrit la bénédiction si
     succès, met à jour prayer_log.axiome_last_at dans tous les cas.
     Retourne { success: bool, rate: 0..1, benediction: {...}|null }     */
  async function _axExecutePray(c, charId){
    var rate = _axBenedRate(c);
    if (rate <= 0) throw new Error('Pacte de Prière non débloqué');
    if (_axPrayerCooldownLeft(c) > 0) throw new Error('Cooldown 3 jours');

    var success = Math.random() < rate;
    var dbref = (window.db) ||
                (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore());
    if (!dbref) throw new Error('DB indisponible');

    var benedictionsNew = (Array.isArray(c.benedictions) ? c.benedictions.slice() : [])
      .filter(function(b){ return b && b.expires_at && b.expires_at > Date.now(); });

    var newBened = null;
    if (success) {
      /* Bénédiction simple : stat_mult_all ×1.05 pour 7 jours (fallback) */
      newBened = {
        id: 'axiome_bened_' + Date.now(),
        kind: 'stat_mult_all',
        mult: 1.05,
        label: 'Faveur du Nexus',
        obtained_at: Date.now(),
        expires_at: Date.now() + 7 * 24 * 3600 * 1000,
        source: 'axiome_favori_nexus'
      };
      benedictionsNew.push(newBened);
    }

    var plOld = (c && c.prayer_log) || {};
    var newLog = Object.assign({}, plOld, { axiome_last_at: Date.now() });

    await dbref.collection('characters').doc(String(charId)).set({
      benedictions: benedictionsNew,
      prayer_log: newLog,
      updated_at: Date.now()
    }, { merge: true });

    /* Sync local */
    c.benedictions = benedictionsNew;
    c.prayer_log = newLog;

    return { success: success, rate: rate, benediction: newBened };
  }

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
      '.hub-bened-link:hover{color:#FFD60A}',
      /* Pacte axiome (Favori du Nexus) */
      '.hub-bened-pacte{margin-top:10px;padding:10px;border-top:1px dashed rgba(139,92,246,0.25);',
      '  display:flex;align-items:center;gap:10px;font-family:Rajdhani,sans-serif;font-size:0.8rem;color:#ece4ff}',
      '.hub-bened-pacte .rate{color:#FFD60A;font-family:Orbitron;font-weight:700}',
      '.hub-bened-pacte .cd{color:#7a6da3;font-family:"Courier New",monospace;font-size:0.72rem;margin-left:auto}',
      '.hub-bened-pacte button{padding:6px 14px;background:linear-gradient(135deg,#7e3cff,#b48cff);',
      '  color:#0c071c;border:none;border-radius:4px;font-family:Orbitron;font-weight:700;',
      '  font-size:0.72rem;letter-spacing:0.12em;cursor:pointer;text-transform:uppercase}',
      '.hub-bened-pacte button:disabled{opacity:0.5;cursor:not-allowed}'
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
    var axRate = _axBenedRate(CHAR);
    /* Si pas de bénéd. active ET pas de Pacte axiome débloqué → cacher */
    if (active.length === 0 && axRate <= 0) {
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

    /* Pacte axiome Favori du Nexus : prière dédiée 75/85/95% cooldown 3j */
    var pacteHtml = '';
    if (axRate > 0) {
      var cdLeft = _axPrayerCooldownLeft(CHAR);
      var canPray = cdLeft <= 0;
      var cdText = canPray ? 'Disponible' : _fmtRemaining(cdLeft) + ' restant';
      pacteHtml =
        '<div class="hub-bened-pacte">' +
          '<span class="glyph">✦</span>' +
          '<span>Pacte de Prière <span class="rate">' + Math.round(axRate*100) + '%</span></span>' +
          '<span class="cd">' + cdText + '</span>' +
          '<button type="button" id="hub-bened-pray-btn"' + (canPray ? '' : ' disabled') + '>Prier</button>' +
        '</div>';
    }

    card.innerHTML =
      '<div class="hub-bened-head">' +
        '<span class="glyph">✦</span>' +
        '<span>Bénédictions actives</span>' +
        '<span class="count">' + active.length + '</span>' +
      '</div>' +
      '<div class="hub-bened-list">' + rows + '</div>' +
      pacteHtml +
      '<a href="sanctuaire.html?char=' + encodeURIComponent(CHAR_ID || '') + '" class="hub-bened-link">Sanctuaire des Principes →</a>';

    if (!existing) {
      host.appendChild(card);
    }

    /* Wire bouton Prier */
    var prayBtn = card.querySelector('#hub-bened-pray-btn');
    if (prayBtn && !prayBtn._wired) {
      prayBtn._wired = true;
      prayBtn.addEventListener('click', async function(){
        prayBtn.disabled = true;
        var orig = prayBtn.textContent;
        prayBtn.textContent = '…';
        try {
          var res = await _axExecutePray(CHAR, CHAR_ID);
          prayBtn.textContent = res.success ? '✓ Succès' : '✕ Échec';
          /* re-render après 2s */
          setTimeout(function(){ _render(); }, 2000);
        } catch (e) {
          prayBtn.textContent = orig;
          prayBtn.disabled = false;
          alert('Erreur : ' + (e.message || e));
        }
      });
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

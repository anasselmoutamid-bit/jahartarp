/* ═══════════════════════════════════════════════════════════════════════
   nexushack-minigame.js — Mini-jeu de mémorisation séquence
   ═══════════════════════════════════════════════════════════════════════
   Mécanique :
     - Une séquence aléatoire de 6-10 symboles s'affiche brièvement (3s).
     - Le joueur doit la reproduire en cliquant les symboles dans l'ordre.
     - Timer global selon tier : T1=60s, T2=90s, T3=120s, T4=150s, T5=180s.
     - À la fin : résultat (succès ou échec). Affiche un message invitant
       à lancer /nexushack target:@user sur Discord.

   Le résultat ici est purement cosmétique — le hack effectif reste résolu
   par le bot Discord. C'est une UI complémentaire pour le RP / l'immersion.
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var SYMBOLS = ['◆','◇','◈','◊','▲','△','▽','▼','●','○','◉','◎','◐','◑','◒','◓'];
  var TIER_TIME = {1: 60, 2: 90, 3: 120, 4: 150, 5: 180};
  var TIER_LEN  = {1: 6,  2: 7,  3: 8,   4: 9,   5: 10};

  var STATE = {
    tier: 3,
    sequence: [],
    input: [],
    started_at: 0,
    time_left: 0,
    phase: 'idle',  // idle | showing | input | done
    timer_id: null,
  };

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function _shuffle(a){
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function _randomSequence(len){
    var out = [];
    for (var i = 0; i < len; i++) out.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    return out;
  }

  function _stopTimer(){
    if (STATE.timer_id) { clearInterval(STATE.timer_id); STATE.timer_id = null; }
  }

  function _updateTimerDisplay(){
    var el = document.getElementById('hk-timer');
    if (el) el.textContent = STATE.time_left + 's';
  }

  function _renderHud(){
    var hud = document.getElementById('hk-hud');
    if (!hud) return;
    hud.innerHTML = (
      '<div class="hk-hud-row">' +
        '<span class="hk-hud-label">TIER</span>' +
        '<select id="hk-tier-sel" class="hk-tier-sel">' +
          [1,2,3,4,5].map(function(t){return '<option value="'+t+'"'+(t===STATE.tier?' selected':'')+'>T'+t+' · '+TIER_TIME[t]+'s · '+TIER_LEN[t]+' symboles</option>';}).join('') +
        '</select>' +
      '</div>' +
      '<div class="hk-hud-row">' +
        '<span class="hk-hud-label">TIMER</span>' +
        '<span id="hk-timer" class="hk-timer">'+STATE.time_left+'s</span>' +
      '</div>'
    );
    var sel = document.getElementById('hk-tier-sel');
    if (sel) sel.addEventListener('change', function(){
      STATE.tier = parseInt(sel.value, 10) || 3;
      if (STATE.phase === 'idle') { STATE.time_left = TIER_TIME[STATE.tier]; _updateTimerDisplay(); }
    });
  }

  function _renderSequence(reveal){
    var seqEl = document.getElementById('hk-seq');
    if (!seqEl) return;
    if (!reveal) {
      seqEl.innerHTML = STATE.sequence.map(function(){return '<span class="hk-seq-cell hk-seq-hidden">?</span>';}).join('');
      return;
    }
    seqEl.innerHTML = STATE.sequence.map(function(s){return '<span class="hk-seq-cell">'+s+'</span>';}).join('');
  }

  function _renderPad(){
    var pad = document.getElementById('hk-pad');
    if (!pad) return;
    var pool = _shuffle(SYMBOLS);
    pad.innerHTML = pool.map(function(s){
      return '<button class="hk-pad-btn" data-sym="'+s+'">'+s+'</button>';
    }).join('');
    Array.from(pad.querySelectorAll('.hk-pad-btn')).forEach(function(btn){
      btn.addEventListener('click', function(){
        if (STATE.phase !== 'input') return;
        var s = btn.dataset.sym;
        STATE.input.push(s);
        _renderInput();
        if (STATE.input.length >= STATE.sequence.length) _check();
      });
    });
  }

  function _renderInput(){
    var input = document.getElementById('hk-input');
    if (!input) return;
    input.innerHTML = STATE.input.map(function(s, i){
      var expected = STATE.sequence[i];
      var cls = s === expected ? 'hk-input-ok' : 'hk-input-err';
      return '<span class="hk-input-cell '+cls+'">'+s+'</span>';
    }).join('') + STATE.sequence.slice(STATE.input.length).map(function(){return '<span class="hk-input-cell hk-input-empty">_</span>';}).join('');
  }

  function _setStatus(msg, cls){
    var s = document.getElementById('hk-status');
    if (!s) return;
    s.className = 'hk-status ' + (cls || '');
    s.textContent = msg;
  }

  function _check(){
    _stopTimer();
    STATE.phase = 'done';
    var ok = STATE.input.length === STATE.sequence.length &&
             STATE.input.every(function(s, i){return s === STATE.sequence[i];});
    if (ok) {
      _setStatus('✓ Hack réussi côté UI ! Lance /nexushack target:@user sur Discord pour résoudre.', 'hk-ok');
    } else {
      _setStatus('✗ Séquence incorrecte. Réessaye avec « Démarrer ».', 'hk-err');
    }
  }

  function _timeout(){
    _stopTimer();
    STATE.phase = 'done';
    _setStatus('⏱ Temps écoulé. Hack échoué.', 'hk-err');
  }

  function start(){
    _stopTimer();
    STATE.sequence = _randomSequence(TIER_LEN[STATE.tier]);
    STATE.input = [];
    STATE.time_left = TIER_TIME[STATE.tier];
    STATE.phase = 'showing';
    _setStatus('Mémorise la séquence !', 'hk-info');
    _renderSequence(true);
    _renderPad();
    _renderInput();
    _updateTimerDisplay();
    // After 3s, hide and start input phase + timer
    setTimeout(function(){
      _renderSequence(false);
      STATE.phase = 'input';
      _setStatus('Reproduis la séquence dans l\'ordre.', 'hk-info');
      STATE.timer_id = setInterval(function(){
        STATE.time_left--;
        _updateTimerDisplay();
        if (STATE.time_left <= 0) _timeout();
      }, 1000);
    }, 3000);
  }

  function init(){
    var startBtn = document.getElementById('hk-start');
    if (startBtn) startBtn.addEventListener('click', start);
    STATE.time_left = TIER_TIME[STATE.tier];
    _renderHud();
    _renderSequence(false);
    _renderPad();
    _setStatus('Configure ton tier et clique « Démarrer ».', 'hk-info');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

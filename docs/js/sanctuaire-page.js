/* ═══════════════════════════════════════════════════════════════════════
   sanctuaire-page.js — Sanctuaire des 10 Principes
   - Lit data/benedictions.json (pool + rates + 10 principes)
   - Gère slots actifs (3 normal / 5 bénis) avec expiration 7 jours
   - 3 prières/jour normal · 5 prières/jour bénis (compteur quotidien)
   - Gacha pondéré → passif/XP/Kanite/Navarites/GoldenEgg/Item LEG
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STATE = {
    activeChar: null,
    activeCharId: null,
    chars: [],
    player: null,
    config: null,
    legendaryPool: null,    /* array of legendary item ids for drop */
    noSession: false,
    pendingPrincipe: null,
    rolling: false,
    adminRevealAll: false,  /* override admin local-only */
    scrambleTimer: null,
  };

  /* ─── Bug #6 — Scramble permanent pour Principes non-découverts ─── */
  var SCRAMBLE_CHARS = '☆✦✧⟁⟐⌬⏣◈◊✶✷✸◇◆▣▤△▽◐◑✺ψφθΩΨΦΞΛ░▒▓█';
  function scrambleText(srcText) {
    var arr = String(srcText || '').split('');
    return arr.map(function (ch) {
      if (ch === ' ' || ch === "'" || ch === '-') return ch;
      return SCRAMBLE_CHARS.charAt(Math.floor(Math.random() * SCRAMBLE_CHARS.length));
    }).join('');
  }
  function isPrincipeDiscovered(char, principeId) {
    if (STATE.adminRevealAll) return true;
    if (!char) return false;
    var disc = char.principes_discovered || {};
    return disc[principeId] === true || (typeof disc[principeId] === 'number' && disc[principeId] > 0);
  }
  function startScrambleTimer() {
    if (STATE.scrambleTimer) return;
    STATE.scrambleTimer = setInterval(function () {
      document.querySelectorAll('.sc-principe.is-locked').forEach(function (el) {
        var nm = el.querySelector('.sc-principe-name');
        var dm = el.querySelector('.sc-principe-domain');
        var ps = el.querySelector('.sc-principe-passif');
        if (nm) nm.textContent = scrambleText(nm.dataset.scrambleSrc || 'XXXXXXXX');
        if (dm) dm.textContent = scrambleText(dm.dataset.scrambleSrc || 'XXXXXXXXXXXXXX');
        if (ps) ps.textContent = scrambleText(ps.dataset.scrambleSrc || 'XXXXXXXXXXXXXXXXXX');
      });
    }, 110);
  }

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

  /* ─── DB/Session ─── */
  function _getDb(){
    if (window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(_) {}
    }
    return null;
  }
  function _getSess(){
    try {
      var raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s._exp && Date.now() > s._exp) return null;
      return s;
    } catch (_) { return null; }
  }
  function _getUid(){
    if (window.UID) return String(window.UID);
    var s = _getSess();
    if (s && s.id) { window.UID = String(s.id); return window.UID; }
    return null;
  }
  function _getCharParam(){
    try { var m = location.search.match(/[?&]char=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; }
    catch(_) { return null; }
  }

  /* ─── Helpers ─── */
  function _todayStr(){
    var d = new Date();
    var pad = function(n){ return n<10?'0'+n:''+n; };
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  }
  function _uuid(){
    return 'b_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function _isBlessed(c){
    if (!c || !STATE.config) return false;
    var cur = c.axiome_current || c.axiome || null;
    return (STATE.config._blessed_axiomes || []).indexOf(cur) !== -1;
  }
  function _capFor(c){
    if (!STATE.config) return { max_slots: 3, prayers_per_day: 3 };
    return _isBlessed(c) ? STATE.config._caps.blessed : STATE.config._caps.normal;
  }
  function _activeBenedictions(c){
    var arr = Array.isArray(c && c.benedictions) ? c.benedictions : [];
    var now = Date.now();
    return arr.filter(function(b){
      if (!b || !b.expires_at) return false;
      return b.expires_at > now;
    });
  }
  function _prayerLog(c){
    var pl = c && c.prayer_log;
    if (!pl || pl.day !== _todayStr()) return { day: _todayStr(), count: 0 };
    return { day: pl.day, count: parseInt(pl.count || 0, 10) || 0 };
  }
  function _statLabel(stat){
    return ({
      strength: 'Force', agility: 'Agilité', speed: 'Vitesse',
      intelligence: 'Intelligence', mana: 'Mana', resistance: 'Résistance',
      charisma: 'Charisme', aura: 'Aura'
    })[stat] || stat;
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

  /* ─── Data loaders ─── */
  function loadConfig(){
    return fetch('data/benedictions.json?v=1')
      .then(function(r){ if (!r.ok) throw new Error('benedictions ' + r.status); return r.json(); })
      .then(function(j){ STATE.config = j; return j; });
  }

  async function loadLegendaryPool(){
    /* Charge la liste des équipements légendaires depuis config/items
       pour servir de pool sur drop "item_leg". On charge en lazy : seulement
       à la première utilisation. Ici on précharge en parallèle pour la perf. */
    if (STATE.legendaryPool !== null) return STATE.legendaryPool;
    var dbref = _getDb();
    if (!dbref) { STATE.legendaryPool = []; return []; }
    try {
      var snap = await dbref.collection('config').doc('items').get();
      if (!snap.exists) { STATE.legendaryPool = []; return []; }
      var data = snap.data() || {};
      var pool = [];
      ['items','equipment','food_items','consumable_items'].forEach(function(sec){
        if (data[sec] && typeof data[sec] === 'object') {
          Object.entries(data[sec]).forEach(function(kv){
            var id = kv[0], it = kv[1] || {};
            if (!it || (it.type||'').toLowerCase()==='material') return;
            if ((it.rarity||'').toLowerCase() !== 'legendary') return;
            /* Skip catégories non-équipement (potions etc.) */
            if ((it.category||'').toLowerCase() === 'potion') return;
            if (!it.slot) return; /* on veut de l'équipement avec slot */
            pool.push(id);
          });
        }
      });
      STATE.legendaryPool = pool;
      return pool;
    } catch (e) {
      console.warn('[sanctuaire] legendary pool load failed:', e);
      STATE.legendaryPool = [];
      return [];
    }
  }

  async function loadActiveChar(){
    var dbref = _getDb();
    var uid = _getUid();
    STATE.noSession = !uid;
    if (!dbref || !uid) return null;
    var paramId = _getCharParam();
    if (paramId) {
      try {
        var cs = await dbref.collection('characters').doc(String(paramId)).get();
        if (cs.exists) {
          var data = cs.data() || {};
          if (String(data.user_id) === String(uid)) {
            STATE.activeCharId = paramId;
            STATE.activeChar = Object.assign({ _id: paramId, id: paramId }, data);
            return STATE.activeChar;
          }
        }
      } catch (e) {}
    }
    try {
      var snap = await dbref.collection('active_characters').doc(String(uid)).get();
      if (snap.exists) {
        var charId = (snap.data() || {}).character_id;
        if (charId) {
          var cs2 = await dbref.collection('characters').doc(String(charId)).get();
          if (cs2.exists) {
            STATE.activeCharId = charId;
            STATE.activeChar = Object.assign({ _id: charId, id: charId }, cs2.data() || {});
            return STATE.activeChar;
          }
        }
      }
    } catch (e) {}
    try {
      var qs = await dbref.collection('characters').where('user_id','==',String(uid)).get();
      var out = [];
      qs.forEach(function(d){ if (d.data() && !d.data()._init) out.push(Object.assign({_id:d.id,id:d.id}, d.data())); });
      STATE.chars = out;
      if (out.length > 0) {
        STATE.activeCharId = out[0]._id || out[0].id;
        STATE.activeChar = out[0];
        return out[0];
      }
    } catch (e) {}
    return null;
  }

  async function loadAllChars(){
    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid) return [];
    try {
      var qs = await dbref.collection('characters').where('user_id','==',String(uid)).get();
      var out = [];
      qs.forEach(function(d){ if (d.data() && !d.data()._init) out.push(Object.assign({_id:d.id,id:d.id}, d.data())); });
      STATE.chars = out;
      return out;
    } catch (e) { return []; }
  }

  async function loadPlayer(){
    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid) return null;
    try {
      var snap = await dbref.collection('players').doc(String(uid)).get();
      STATE.player = snap.exists ? (snap.data() || {}) : {};
      return STATE.player;
    } catch (e) {
      console.warn('[sanctuaire] player load failed:', e);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDERING
     ═══════════════════════════════════════════════════════════════════ */
  function showState(id){
    ['state-loading','state-no-session','state-no-chars','view-main'].forEach(function(s){
      var el = document.getElementById(s);
      if (el) el.hidden = (s !== id);
    });
  }

  function renderHeader(){
    var c = STATE.activeChar;
    if (!c) return;
    var chip = $('#sc-char-chip');
    var name = ((c.first_name||'') + ' ' + (c.last_name||'')).trim() || 'Voyageur';
    var ax = (c.axiome_current || 'néophyte').toUpperCase();
    $('#sc-chip-name').textContent = name;
    $('#sc-chip-meta').textContent = ax + (_isBlessed(c) ? ' · ✦ BÉNI' : '');
    chip.hidden = false;

    var cap = _capFor(c);
    var pl = _prayerLog(c);
    var active = _activeBenedictions(c);
    $('#sc-status-value').textContent = (_isBlessed(c) ? 'Béni du Nexus · ' : 'Mortel · ') +
      active.length + '/' + cap.max_slots + ' bénéd.';
    $('#sc-status-prayers').textContent = pl.count + ' / ' + cap.prayers_per_day;
  }

  function renderSlots(){
    var c = STATE.activeChar;
    var grid = $('#sc-slots-grid');
    if (!grid || !c) return;
    var cap = _capFor(c);
    var active = _activeBenedictions(c).sort(function(a, b){ return (b.obtained_at||0) - (a.obtained_at||0); });

    var html = '';
    for (var i = 0; i < cap.max_slots; i++) {
      var b = active[i];
      if (!b) {
        html += '<div class="sc-slot is-empty"><div class="sc-slot-body">Slot libre</div></div>';
        continue;
      }
      var principe = (STATE.config.principes || {})[b.principe] || {};
      var color = principe.color || '#8B5CF6';
      var ico = principe.ico || '✦';
      var remaining = b.expires_at - Date.now();
      html += '<div class="sc-slot" style="--principe-color:' + color + '">' +
        '<div class="sc-slot-head">' +
          '<span class="sc-slot-ico">' + ico + '</span>' +
          '<span class="sc-slot-title">' + esc(b.label || principe.name || b.principe) + '</span>' +
        '</div>' +
        '<div class="sc-slot-effect">' + esc(b.effect_text || '—') + '</div>' +
        '<div class="sc-slot-meta">' +
          '<span>' + esc(principe.name || '—') + '</span>' +
          '<span class="sc-slot-time">' + _fmtRemaining(remaining) + '</span>' +
        '</div>' +
      '</div>';
    }
    grid.innerHTML = html;
  }

  function renderPrincipes(){
    var grid = $('#sc-principes-grid');
    if (!grid) return;
    var c = STATE.activeChar;
    var pl = _prayerLog(c);
    var cap = _capFor(c);
    var prayersLeft = Math.max(0, cap.prayers_per_day - pl.count);
    var canPray = prayersLeft > 0;

    var html = Object.entries(STATE.config.principes).map(function(kv){
      var id = kv[0], p = kv[1];
      var passifLabel = p.passif.label || 'Passif spécial';
      var passifDesc = '';
      var passif = p.passif;
      if (passif.kind === 'stat_mult' && passif.stats && passif.stats.length === 1) {
        passifDesc = _statLabel(passif.stats[0]) + ' ×' + passif.mult_min.toFixed(2) + '-' + passif.mult_max.toFixed(2);
      } else if (passif.kind === 'stat_mult' && passif.stats && passif.stats.length > 1) {
        passifDesc = passif.stats.map(_statLabel).join(' + ') + ' ×' + passif.mult_min.toFixed(2) + '-' + passif.mult_max.toFixed(2);
      } else if (passif.kind === 'stat_mult_all') {
        passifDesc = 'Toutes stats ×' + passif.mult_min.toFixed(2) + '-' + passif.mult_max.toFixed(2);
      } else if (passif.kind === 'stat_mult_random') {
        passifDesc = 'Stat aléatoire ×' + passif.mult_min.toFixed(2) + '-' + passif.mult_max.toFixed(2);
      } else if (passif.kind === 'reroll_token') {
        passifDesc = 'Token de re-roll';
      }
      /* Bug #6 — locked = non-découvert : nom/domain/passif scramble permanent.
         L'icône reste blurrée mais visible. Cliquer reste autorisé (prière = découverte). */
      var locked = !isPrincipeDiscovered(c, id);
      var displayName   = locked ? scrambleText(p.name)         : esc(p.name);
      var displayDomain = locked ? scrambleText(p.domain)       : esc(p.domain);
      var displayPassif = locked ? scrambleText(passifLabel + ' · ' + passifDesc) : esc(passifLabel) + ' · ' + esc(passifDesc);
      var cls = 'sc-principe' + (canPray ? '' : ' is-disabled') + (locked ? ' is-locked' : '');
      var nameDataAttr   = locked ? ' data-scramble-src="' + esc(p.name) + '"' : '';
      var domainDataAttr = locked ? ' data-scramble-src="' + esc(p.domain) + '"' : '';
      var passifDataAttr = locked ? ' data-scramble-src="' + esc(passifLabel + ' · ' + passifDesc) + '"' : '';
      return '<div class="' + cls + '" data-id="' + esc(id) + '"' +
        ' style="--principe-color:' + p.color + ';--principe-glow:' + p.color + '55">' +
        '<div class="sc-principe-ico">' + p.ico + '</div>' +
        '<div class="sc-principe-name"' + nameDataAttr + '>' + displayName + '</div>' +
        '<div class="sc-principe-domain"' + domainDataAttr + '>' + displayDomain + '</div>' +
        '<div class="sc-principe-passif"' + passifDataAttr + '>' + displayPassif + '</div>' +
      '</div>';
    }).join('');
    grid.innerHTML = html;
    /* (Re)démarre le timer scramble (no-op si déjà actif) */
    startScrambleTimer();

    grid.querySelectorAll('.sc-principe').forEach(function(el){
      el.addEventListener('click', function(){
        if (el.classList.contains('is-disabled')) {
          flashToast('⚠ Plus de prières aujourd\'hui (reset à minuit)', 'error');
          return;
        }
        openPrayModal(el.dataset.id);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     PRAY FLOW
     ═══════════════════════════════════════════════════════════════════ */
  function openPrayModal(principeId){
    var p = (STATE.config.principes || {})[principeId];
    if (!p) return;
    STATE.pendingPrincipe = principeId;
    $('#pray-icon').textContent = p.ico;
    $('#pray-icon').style.setProperty('--principe-glow', p.color + '88');
    $('#pray-title').textContent = p.name;
    $('#pray-domain').textContent = p.domain;
    $('#pray-desc').innerHTML =
      'Tu invoques <strong>' + esc(p.name) + '</strong>. Le tirage qui suit déterminera la nature de Sa bienveillance.<br><br>' +
      '<em style="color:var(--sc-text-dim)">Si tu tombes sur un passif, c\'est <strong style="color:var(--sc-purple-2)">' + esc(p.passif.label) + '</strong> qui sera accordé.</em>';
    $('#pray-modal').hidden = false;
  }

  function closePrayModal(){
    $('#pray-modal').hidden = true;
    STATE.pendingPrincipe = null;
  }

  async function executePrayer(){
    if (STATE.rolling) return;
    var principeId = STATE.pendingPrincipe;
    if (!principeId) return;
    var p = (STATE.config.principes || {})[principeId];
    if (!p) return;
    var c = STATE.activeChar;
    var cap = _capFor(c);
    var pl = _prayerLog(c);
    if (pl.count >= cap.prayers_per_day) {
      flashToast('⚠ Plus de prières aujourd\'hui', 'error');
      closePrayModal();
      return;
    }

    STATE.rolling = true;
    closePrayModal();
    showPrayAnimation(p);

    /* Charge le pool LEG en parallèle (au cas où on tomberait dessus) */
    var poolPromise = loadLegendaryPool();

    /* Animation 2.4s minimum pour la prière */
    await new Promise(function(r){ setTimeout(r, 2400); });

    /* Roll */
    var roll = Math.random();
    var cum = 0;
    var rates = STATE.config._rates;
    var category = null;
    var orderedRates = [
      ['passif',           rates.passif],
      ['xp_boost',         rates.xp_boost],
      ['kanite_boost',     rates.kanite_boost],
      ['navarites',        rates.navarites],
      ['golden_egg',       rates.golden_egg],
      ['item_leg',         rates.item_leg],
      ['singularity_core', rates.singularity_core || 0]
    ];
    for (var i = 0; i < orderedRates.length; i++) {
      cum += orderedRates[i][1];
      if (roll < cum) { category = orderedRates[i][0]; break; }
    }
    if (!category) category = orderedRates[0][0];

    /* Construit le résultat */
    var result;
    if (category === 'passif') {
      result = _buildPassif(principeId, p);
    } else if (category === 'xp_boost') {
      result = _buildXpBoost();
    } else if (category === 'kanite_boost') {
      result = _buildKaniteBoost();
    } else if (category === 'navarites') {
      result = _buildNavarites();
    } else if (category === 'golden_egg') {
      result = _buildGoldenEgg();
    } else if (category === 'singularity_core') {
      result = _buildSingularityCore();
    } else {
      var pool = await poolPromise;
      result = _buildItemLeg(pool);
    }

    try {
      await applyResult(result, principeId, p);
    } catch (e) {
      console.error('[sanctuaire] apply failed', e);
      flashToast('⚠ Échec côté serveur : ' + (e.message || 'erreur'), 'error');
      STATE.rolling = false;
      closeResultModal();
      return;
    }

    showResultScreen(result, p);
    STATE.rolling = false;
  }

  function _randBetween(min, max){
    return min + Math.random() * (max - min);
  }
  function _randIntInclusive(min, max){
    return Math.floor(min + Math.random() * (max - min + 1));
  }
  function _round(v, dec){ var f = Math.pow(10, dec||2); return Math.round(v*f)/f; }

  function _buildPassif(principeId, p){
    var passif = p.passif;
    var mult = _round(_randBetween(passif.mult_min, passif.mult_max), 2);
    var stats = passif.stats || [];
    var effectStat = stats.slice();
    var statKind = passif.kind;
    var label = passif.label;
    var effectText = '';
    if (statKind === 'stat_mult') {
      effectText = stats.map(_statLabel).join(' + ') + ' ×' + mult.toFixed(2);
    } else if (statKind === 'stat_mult_all') {
      effectText = 'Toutes stats ×' + mult.toFixed(2);
    } else if (statKind === 'stat_mult_random') {
      var pool = passif.stats.slice();
      var pick = pool[Math.floor(Math.random()*pool.length)];
      effectStat = [pick];
      effectText = _statLabel(pick) + ' ×' + mult.toFixed(2) + ' (aléatoire)';
    } else if (statKind === 'reroll_token') {
      mult = 0;
      effectText = 'Te permet de re-roll 1 bénédiction du slot.';
      effectStat = [];
    }
    return {
      category: 'passif',
      slot: true,
      benediction: {
        id: _uuid(),
        principe: principeId,
        kind: statKind,
        stats: effectStat,
        mult: mult,
        label: label,
        effect_text: effectText,
        obtained_at: Date.now(),
        expires_at: Date.now() + STATE.config._duration_ms
      },
      title: label,
      text: effectText
    };
  }
  function _buildXpBoost(){
    var pct = _round(_randBetween(STATE.config._xp_boost.min_pct, STATE.config._xp_boost.max_pct), 2);
    return {
      category: 'xp_boost',
      slot: true,
      benediction: {
        id: _uuid(),
        principe: null,
        kind: 'xp_boost',
        boost_pct: pct,
        label: 'Bénédiction de Sagesse',
        effect_text: '+' + Math.round(pct*100) + '% XP gagnée',
        obtained_at: Date.now(),
        expires_at: Date.now() + STATE.config._duration_ms
      },
      title: 'Bénédiction de Sagesse',
      text: '+' + Math.round(pct*100) + '% sur toute XP gagnée pendant 7 jours.'
    };
  }
  function _buildKaniteBoost(){
    var pct = _round(_randBetween(STATE.config._kanite_boost.min_pct, STATE.config._kanite_boost.max_pct), 2);
    return {
      category: 'kanite_boost',
      slot: true,
      benediction: {
        id: _uuid(),
        principe: null,
        kind: 'kanite_boost',
        boost_pct: pct,
        label: 'Bénédiction de Fortune',
        effect_text: '+' + Math.round(pct*100) + '% Kanite obtenu',
        obtained_at: Date.now(),
        expires_at: Date.now() + STATE.config._duration_ms
      },
      title: 'Bénédiction de Fortune',
      text: '+' + Math.round(pct*100) + '% sur tout gain de Kanite pendant 7 jours.'
    };
  }
  function _buildNavarites(){
    var nv = _randIntInclusive(STATE.config._navarites_drop.min, STATE.config._navarites_drop.max);
    return {
      category: 'navarites',
      slot: false,
      navarites: nv,
      title: 'Larmes des Principes',
      text: '+' + nv.toLocaleString() + ' Navarites ajoutées à ton solde.'
    };
  }
  function _buildGoldenEgg(){
    var qty = parseInt(STATE.config._golden_egg_amount || 1, 10) || 1;
    return {
      category: 'golden_egg',
      slot: false,
      golden_eggs: qty,
      title: 'Œuf d\'Or Légendaire',
      text: 'Un Golden Egg ×' + qty + ' rejoint ton inventaire.'
    };
  }
  function _buildSingularityCore(){
    /* Tirage pondéré dans _singularity_core_pool */
    var pool = STATE.config._singularity_core_pool || {};
    var entries = Object.entries(pool);
    if (entries.length === 0) {
      /* Fallback : si pool vide, on convertit en gros gain navarites */
      return { category: 'navarites', slot: false, navarites: 500,
               title: 'Don du Sanctuaire',
               text: 'Le Sanctuaire reste muet sur les noyaux. +500 Navarites.' };
    }
    var r = Math.random(); var cum = 0; var pick = entries[0][0];
    for (var i = 0; i < entries.length; i++) {
      cum += entries[i][1];
      if (r < cum) { pick = entries[i][0]; break; }
    }
    var coreName = ({
      'matrice_zero':      'Matrice Zéro',
      'ame_synthetique':   'Âme Synthétique',
      'noyau_singularite': 'Noyau de Singularité'
    })[pick] || pick;
    return {
      category: 'singularity_core',
      slot: false,
      core_id: pick,
      core_name: coreName,
      title: 'Noyau Cosmique',
      text: 'Un <strong>' + esc(coreName) + '</strong> t\'est confié — utilise-le dans la <a href="singularite.html">Singularité</a> pour forger un artefact unique.'
    };
  }

  function _buildItemLeg(pool){
    if (!pool || pool.length === 0) {
      /* Fallback : si pas de pool, on transforme en gros lot navarites */
      var fallbackNv = 300;
      return {
        category: 'navarites',
        slot: false,
        navarites: fallbackNv,
        title: 'Larmes des Principes (compensation)',
        text: 'Le pool légendaire est vide. Compensation : +' + fallbackNv + ' Navarites.'
      };
    }
    var pick = pool[Math.floor(Math.random()*pool.length)];
    return {
      category: 'item_leg',
      slot: false,
      item_id: pick,
      title: 'Relique Légendaire',
      text: 'Un objet légendaire t\'est confié : <strong id="leg-item-name">' + esc(pick) + '</strong>'
    };
  }

  /* ─── Apply result to D1 ─── */
  async function applyResult(result, principeId, p){
    var dbref = _getDb();
    var uid = _getUid();
    var c = STATE.activeChar;
    var nowDay = _todayStr();
    var pl = _prayerLog(c);

    /* Mise à jour de la liste benedictions + prayer_log */
    var benedictionsNew = (Array.isArray(c.benedictions) ? c.benedictions.slice() : [])
      .filter(function(b){ return b && b.expires_at && b.expires_at > Date.now(); });

    if (result.slot && result.benediction) {
      benedictionsNew.push(result.benediction);
      /* NB: si on dépasse cap, le UI proposera de remplacer plus tard.
         Ici on tolère un dépassement temporaire — il sera affiché et le user
         pourra retirer manuellement (feature ultérieure). */
    }

    /* Bug #6 — Discovery : marquer ce Principe comme découvert.
       Forme : principes_discovered: { shinamea: true, avalan: true, ... } */
    var disc = Object.assign({}, (c.principes_discovered || {}));
    disc[principeId] = true;

    var update = {
      benedictions: benedictionsNew,
      prayer_log: { day: nowDay, count: pl.count + 1 },
      principes_discovered: disc,
      updated_at: Date.now()
    };

    /* Drops one-shot : appliquent une mutation séparée */
    if (result.category === 'golden_egg') {
      update.golden_eggs = (parseInt(c.golden_eggs || 0, 10) || 0) + (result.golden_eggs || 1);
    }

    await dbref.collection('characters').doc(String(STATE.activeCharId)).set(update, { merge: true });

    /* Sync local state */
    Object.assign(c, update);

    if (result.category === 'navarites') {
      /* Navarites sur le player */
      var curNv = parseInt((STATE.player && STATE.player.navarites) || 0, 10) || 0;
      var newNv = curNv + (result.navarites || 0);
      await dbref.collection('players').doc(String(uid)).set({ navarites: newNv }, { merge: true });
      if (!STATE.player) STATE.player = {};
      STATE.player.navarites = newNv;
    }

    if (result.category === 'singularity_core' && result.core_id) {
      /* Ajout du noyau dans l'inventaire (items[]). Le noyau est un material standard. */
      var invKeySg = uid + '_' + STATE.activeCharId;
      var invSnapSg = await dbref.collection('inventories').doc(invKeySg).get();
      var invSg = invSnapSg.exists ? (invSnapSg.data() || {}) : {};
      var itemsSg = Object.assign({}, invSg.items || {});
      itemsSg[result.core_id] = (parseInt(itemsSg[result.core_id] || 0, 10) || 0) + 1;
      await dbref.collection('inventories').doc(invKeySg).set({ items: itemsSg }, { merge: true });
    }

    if (result.category === 'item_leg' && result.item_id) {
      /* Ajout dans l'inventaire du perso */
      var invKey = uid + '_' + STATE.activeCharId;
      var invSnap = await dbref.collection('inventories').doc(invKey).get();
      var inv = invSnap.exists ? (invSnap.data() || {}) : {};
      var items = inv.items || {};
      var newItems = Object.assign({}, items);
      newItems[result.item_id] = (parseInt(newItems[result.item_id] || 0, 10) || 0) + 1;
      await dbref.collection('inventories').doc(invKey).set({ items: newItems }, { merge: true });

      /* Résout le nom propre pour l'affichage */
      try {
        var cfgSnap = await dbref.collection('config').doc('items').get();
        if (cfgSnap.exists) {
          var cfg = cfgSnap.data() || {};
          var allItems = Object.assign({}, cfg.items || {}, cfg.equipment || {});
          var def = allItems[result.item_id];
          if (def && def.name) result._displayName = def.name;
        }
      } catch (_) {}
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     ANIMATIONS / RESULT MODAL
     ═══════════════════════════════════════════════════════════════════ */
  function showPrayAnimation(p){
    var c = $('#result-content');
    c.innerHTML =
      '<div class="sc-pray-altar">' +
        '<div class="sc-pray-icon" style="--principe-glow:' + p.color + 'aa">' + p.ico + '</div>' +
        '<div class="sc-pray-text">Prière en cours…</div>' +
      '</div>';
    $('#result-modal').hidden = false;
  }

  function showResultScreen(result, p){
    var c = $('#result-content');
    var tierClass = ({
      passif: 'is-passif',
      xp_boost: 'is-xp',
      kanite_boost: 'is-kanite',
      navarites: 'is-navarites',
      golden_egg: 'is-egg',
      item_leg: 'is-leg',
      singularity_core: 'is-leg'
    })[result.category] || 'is-passif';
    var tierLabel = ({
      passif: 'Passif Accordé',
      xp_boost: 'Bénédiction XP',
      kanite_boost: 'Bénédiction Kanite',
      navarites: 'Don de Navarites',
      golden_egg: 'Œuf d\'Or',
      item_leg: 'Relique Légendaire',
      singularity_core: 'Noyau Singularité'
    })[result.category] || '—';
    var glyph = ({
      passif: '✦',
      xp_boost: '★',
      kanite_boost: '◈',
      navarites: '💧',
      golden_egg: '🥚',
      item_leg: '🗡',
      singularity_core: '✺'
    })[result.category] || '✦';
    var glow = p ? p.color : '#FFD60A';

    var textHtml = result.text;
    if (result.category === 'item_leg' && result._displayName) {
      textHtml = textHtml.replace(esc(result.item_id), esc(result._displayName));
    }

    c.innerHTML =
      '<div class="sc-result" style="--principe-glow:' + glow + 'aa">' +
        '<div class="sc-result-glyph">' + glyph + '</div>' +
        '<div class="sc-result-tier ' + tierClass + '">' + tierLabel + '</div>' +
        '<div class="sc-result-title">' + esc(result.title) + '</div>' +
        '<div class="sc-result-text">' + textHtml + '</div>' +
        '<div class="sc-modal-actions">' +
          '<button class="sc-btn sc-btn-gold" id="result-close-btn" type="button">' +
            '<span>Recevoir</span><span class="sc-arrow">✦</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    $('#result-close-btn').addEventListener('click', function(){
      closeResultModal();
      renderHeader();
      renderSlots();
      renderPrincipes();
    });
  }

  function closeResultModal(){ $('#result-modal').hidden = true; }

  /* ═══════════════════════════════════════════════════════════════════
     CHAR SWITCHER + MODALS WIRING
     ═══════════════════════════════════════════════════════════════════ */
  function openCharSwitcher(){
    var grid = $('#charswitch-grid');
    grid.innerHTML = '';
    var chars = STATE.chars && STATE.chars.length > 0 ? STATE.chars : [STATE.activeChar].filter(Boolean);
    chars.forEach(function(c){
      var name = ((c.first_name||'') + ' ' + (c.last_name||'')).trim() || c._id || c.id;
      var ax = c.axiome_current || 'néophyte';
      var blessed = _isBlessed(c);
      var card = document.createElement('div');
      card.className = 'sc-char-card';
      card.innerHTML =
        '<div class="sc-char-name">' + esc(name) + '</div>' +
        '<div class="sc-char-meta' + (blessed ? ' is-blessed' : '') + '">' +
          esc(ax.toUpperCase()) + (blessed ? ' · ✦ BÉNI (5 slots)' : ' · 3 slots') +
        '</div>';
      card.addEventListener('click', function(){
        var cid = c._id || c.id;
        location.href = 'sanctuaire.html?char=' + encodeURIComponent(cid);
      });
      grid.appendChild(card);
    });
    $('#charswitch-modal').hidden = false;
  }

  function wireModals(){
    document.querySelectorAll('[data-close]').forEach(function(el){
      el.addEventListener('click', function(){
        var modal = el.closest('.sc-modal');
        if (modal) modal.hidden = true;
      });
    });
    $('#pray-confirm-btn').addEventListener('click', executePrayer);
    $('#sc-char-chip').addEventListener('click', openCharSwitcher);
  }

  /* ─── Toast ─── */
  function flashToast(msg, kind){
    var t = document.createElement('div');
    t.className = 'sc-toast ' + (kind === 'error' ? 'is-error' : 'is-success');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ try { t.remove(); } catch(_){} }, 3800);
  }

  /* ═══════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════ */
  async function init(){
    try {
      await loadConfig();
    } catch (e) {
      console.error('[sanctuaire] config load failed', e);
      showState('state-loading');
      $('#state-loading').innerHTML =
        '<div class="sc-state-glyph">⚠</div>' +
        '<h2 class="sc-state-title">Erreur</h2>' +
        '<p class="sc-state-text">Impossible de charger la config : ' + esc(e.message) + '</p>';
      return;
    }

    await Promise.all([loadActiveChar(), loadAllChars(), loadPlayer()]);

    if (STATE.noSession) { showState('state-no-session'); return; }
    if (!STATE.activeChar) { showState('state-no-chars'); return; }

    showState('view-main');
    renderHeader();
    renderSlots();
    renderPrincipes();
    wireModals();
    wireAdminBar();
  }

  /* Bug #6 — admin-only "Reveal all" toggle (visuel local uniquement). */
  function wireAdminBar() {
    var bar = $('#sc-admin-bar');
    var chk = $('#sc-admin-reveal-all');
    if (!bar || !chk) return;
    /* Attendre auth-badge.js qui set window._isAdmin asynchronement */
    var checkAdmin = function () {
      if (window._isAdmin === true) {
        bar.hidden = false;
      } else if (window._isAdmin === undefined) {
        setTimeout(checkAdmin, 250);
      }
    };
    checkAdmin();
    chk.addEventListener('change', function () {
      STATE.adminRevealAll = chk.checked;
      renderPrincipes();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

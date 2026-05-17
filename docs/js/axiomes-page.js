/* ═══════════════════════════════════════════════════════════════════════
   axiomes-page.js — NEO KITSCH page Axiomes
   ─ Boot animation → Character selection → Axiome browsing → Popup
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── State ─── */
  var STATE = {
    chars: [],           /* user characters */
    activeChar: null,    /* selected character */
    axiomes: null,       /* data/axiome_skills.json */
    filter: 'all',       /* all | voie | metier | secret */
    pendingPop: null,    /* axiome id awaiting popup confirm */
    showOthers: false    /* if true, show locked-out axiomes when char has T1 */
  };

  /* ─── Emoji map ─── */
  var EMOJI = {
    soldat: "⚔️", mage: "🔮", soigneur: "🍶", hacker: "💻", assassin: "🗡️",
    sniper: "🎯", tireur_rapide: "🔫", eleveur: "🐾", tank: "🛡️", erudit: "📚",
    berserker: "🩸", forgeron: "🔨", mage_favori_nexus: "✨", enforcer: "👑",
    ensorceleur: "💋", decodeur: "📡"
  };

  /* Map kind → metier page */
  var METIER_PAGE = {
    soigneur: 'brassage.html',
    hacker: 'nexusnet.html',
    eleveur: 'elevage.html',
    erudit: 'recherche.html',
    forgeron: 'forge.html',
    mage_favori_nexus: 'rituels.html',
    ensorceleur: 'craft.html',
    decodeur: 'nexusnet.html'
  };

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

  function kindOf(def){
    var k = def && def.kind ? def.kind : '';
    if (k.indexOf('secret') >= 0) return 'secret';
    if (k.indexOf('metier') >= 0) return 'metier';
    return 'voie';
  }
  function kindLabel(k){
    if (k === 'secret') return 'SECRET (RACE-LOCK)';
    if (k === 'metier') return 'MÉTIER';
    return 'VOIE DE COMBAT';
  }

  /* ═══════════════════════════════════════════════════════════════════
     BOOT ANIMATION
     ═══════════════════════════════════════════════════════════════════ */
  function bootSequence(){
    var out = $('#ax-boot-out');
    var cursor = $('#ax-boot-cursor');
    var bootEl = $('#ax-boot');
    var innerEl = $('#ax-boot-inner');
    var welcomeEl = $('#ax-boot-welcome');
    var page = $('#ax-page');
    var lines = [
      { t: '//[SYSTEM] > Jaharta.exe Loading...', delay: 380 },
      { t: '> Negotiating with NEXUS::CORE', delay: 320 },
      { t: '> Handshake OK · session=0x5AFE', delay: 320 },
      { t: '> Booting AXIOM-RUNTIME v1.0', delay: 260 },
      { t: '> [████░░░░░░░░░░░░░░░░] 20%', delay: 200 },
      { t: '> [████████░░░░░░░░░░░░] 40%', delay: 200 },
      { t: '> [████████████░░░░░░░░] 60%', delay: 200 },
      { t: '> [████████████████░░░░] 80%', delay: 200 },
      { t: '> [████████████████████] 100%', delay: 360 },
      { t: '> Mounting USER.GATE…', delay: 260 },
      { t: '> AUTH OK · welcome, voyageur', delay: 420 }
    ];

    var i = 0;
    function step(){
      if (i >= lines.length) { revealWelcome(); return; }
      var ln = lines[i];
      out.textContent += (i === 0 ? '' : '\n') + ln.t;
      i++;
      setTimeout(step, ln.delay);
    }
    function revealWelcome(){
      cursor.style.display = 'none';
      /* Hide loading panel first */
      innerEl.classList.add('is-fading');
      /* Once it's gone, show the welcome title */
      setTimeout(function(){
        innerEl.style.display = 'none';
        welcomeEl.classList.add('is-in');
        /* After the title has been visible for a moment, fade everything out */
        setTimeout(function(){
          bootEl.classList.add('is-done');
          page.hidden = false;
          setTimeout(function(){ if (bootEl && bootEl.remove) bootEl.remove(); }, 700);
        }, 2600);
      }, 520);
    }
    step();
  }

  /* ═══════════════════════════════════════════════════════════════════
     DATA LOADERS
     ═══════════════════════════════════════════════════════════════════ */
  function loadAxiomes(){
    return fetch('data/axiome_skills.json')
      .then(function(r){ if (!r.ok) throw new Error('axiome_skills HTTP ' + r.status); return r.json(); })
      .then(function(j){
        var out = {};
        Object.keys(j).forEach(function(k){
          if (k.charAt(0) === '_') return;
          out[k] = j[k];
        });
        STATE.axiomes = out;
        return out;
      });
  }

  function _getDb(){
    if (window.db) return window.db;
    if (typeof db !== 'undefined') return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(e){}
    }
    return null;
  }

  /* Try fetching user characters; if no db / no auth → return mock list */
  async function loadCharacters(){
    var mock = [
      { id: 'mock-1', _id: 'mock-1', first_name: 'Démo', last_name: 'Voyageur', level: 10,  race_category: 'Humanoids',  class: '—', _race_specific: 'Human',    axiome_current: null },
      { id: 'mock-2', _id: 'mock-2', first_name: 'Test', last_name: 'Dragon',   level: 80,  race_category: 'MythZooids', class: '—', _race_specific: 'Dragon',   axiome_current: null },
      { id: 'mock-3', _id: 'mock-3', first_name: 'Forge', last_name: 'Stein',   level: 120, race_category: 'Humanoids',  class: '—', _race_specific: 'Dwarf',    axiome_current: 'forgeron' },
      { id: 'mock-4', _id: 'mock-4', first_name: 'Kira', last_name: 'Bot',      level: 65,  race_category: 'Artificial', class: '—', _race_specific: 'Android',  axiome_current: null }
    ];

    var dbref = _getDb();
    var uid = window.UID;
    if (!dbref || !uid) {
      STATE.chars = mock;
      return mock;
    }
    try {
      var snap = await dbref.collection('characters').where('user_id', '==', String(uid)).get();
      var out = [];
      snap.forEach(function(d){
        var data = d.data() || {};
        if (data._init) return;
        out.push(Object.assign({ _id: d.id, id: d.id }, data));
      });
      if (!out.length) {
        STATE.chars = mock;
        return mock;
      }
      STATE.chars = out;
      return out;
    } catch (e) {
      console.warn('[axiomes] character fetch failed, using mock:', e);
      STATE.chars = mock;
      return mock;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     CHARACTER LIST RENDER
     ═══════════════════════════════════════════════════════════════════ */
  function renderCharList(){
    var head = $('#ax-list-head');
    var items = $('#ax-list-items');
    head.textContent = 'PERSONNAGES';
    items.innerHTML = '';
    if (!STATE.chars.length) {
      items.innerHTML = '<div class="ax-loading-line">Aucun personnage trouvé.</div>';
      return;
    }
    STATE.chars.forEach(function(c){
      var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Personnage';
      var lvl = parseInt(c.level || 0, 10) || 0;
      var race = c._race_specific || c.race_specific || c.race_category || '—';
      var cur  = c.axiome_current || c.axiome || null;
      var axName = cur && STATE.axiomes && STATE.axiomes[cur] ? STATE.axiomes[cur].name : 'T0 · Néophyte';
      var btn = document.createElement('button');
      btn.className = 'ax-li';
      btn.dataset.id = c._id || c.id;
      btn.innerHTML =
        '<span class="ax-li-emoji">👤</span>' +
        '<span class="ax-li-body">' +
          '<span class="ax-li-name">' + esc(name) + '</span>' +
          '<span class="ax-li-meta">LVL ' + lvl + ' · ' + esc(race) + ' · ' + esc(axName) + '</span>' +
        '</span>' +
        '<span class="ax-li-icon">→</span>';
      btn.addEventListener('click', function(){ selectChar(c._id || c.id); });
      items.appendChild(btn);
    });
  }

  function selectChar(id){
    var c = STATE.chars.find(function(x){ return String(x._id || x.id) === String(id); });
    if (!c) return;
    STATE.activeChar = c;
    STATE.showOthers = false;
    /* Mark active */
    $$('.ax-li', $('#ax-list-items')).forEach(function(li){
      li.classList.toggle('is-active', li.dataset.id === String(id));
    });
    /* Switch to axiome browsing */
    renderAxiomeList();
    renderDetailEmpty();
    $('#ax-bottom-tabs').hidden = false;
    updateToolbar();
  }

  /* ═══════════════════════════════════════════════════════════════════
     AXIOME LIST RENDER (after a char is picked)
     ═══════════════════════════════════════════════════════════════════ */
  function isAxiomeVisibleFor(axId, def, c){
    var k = kindOf(def);
    var cur = c.axiome_current || c.axiome || null;
    if (cur && !STATE.showOthers) {
      /* T1 verrouillé — affiche seulement l'axiome courant (les évolutions T2/T3 viennent du skill tree de cet axiome) */
      return axId === cur;
    }
    /* Standards toujours visibles */
    if (k !== 'secret') return true;
    /* Secret race-locked → comparer race_specific du char */
    var race = (c._race_specific || c.race_specific || c.race_category || '').toLowerCase();
    var raceCat = (c.race_category || '').toLowerCase();
    var lock = (def.race_lock || []).map(function(r){ return String(r).toLowerCase(); });
    return lock.indexOf(race) >= 0 || lock.indexOf(raceCat) >= 0;
  }

  function renderAxiomeList(){
    var head = $('#ax-list-head');
    var items = $('#ax-list-items');
    var c = STATE.activeChar;
    var ax = STATE.axiomes;
    if (!c || !ax) return;

    var cName = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Personnage';
    var cur = c.axiome_current || c.axiome || null;
    var headTxt = (cur && !STATE.showOthers)
      ? 'AXIOME ACTIF · <span style="color:var(--ax-amber)">' + esc((ax[cur] && ax[cur].name) || cur) + '</span>'
      : 'AXIOMES DISPONIBLES';
    head.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<span>' + headTxt + '</span>' +
        '<button class="ax-switch-char-btn" id="ax-switch-char-btn" title="Changer de personnage">' +
          '⤺ ' + esc(cName.toUpperCase()) +
        '</button>' +
      '</div>';
    /* Wire switch-char */
    var sb = $('#ax-switch-char-btn');
    if (sb) sb.onclick = function(e){ e.stopPropagation(); STATE.activeChar = null; STATE.showOthers = false; renderCharList(); renderDetailEmpty(); $('#ax-bottom-tabs').hidden = true; $('#ax-toolbar').hidden = true; };

    /* Visible axiomes filtered by char & filter */
    var ids = Object.keys(ax).filter(function(id){
      var d = ax[id];
      if (!d || !d.skills) return false;
      if (!isAxiomeVisibleFor(id, d, c)) return false;
      if (STATE.filter !== 'all' && kindOf(d) !== STATE.filter) return false;
      return true;
    });

    /* Sort: standards first, secrets last; metier in middle */
    ids.sort(function(a, b){
      var ka = kindOf(ax[a]);
      var kb = kindOf(ax[b]);
      var order = { voie: 0, metier: 1, secret: 2 };
      if (order[ka] !== order[kb]) return order[ka] - order[kb];
      return (ax[a].name || '').localeCompare(ax[b].name || '', 'fr');
    });

    items.innerHTML = '';
    if (!ids.length) {
      items.innerHTML = '<div class="ax-loading-line">Aucun axiome disponible pour ce personnage / filtre.</div>';
      return;
    }
    ids.forEach(function(id){
      var d = ax[id];
      var k = kindOf(d);
      var emoji = EMOJI[id] || '⚜️';
      var label = d.name || id;
      var meta = (k === 'secret' ? 'SECRET · ' : (k === 'metier' ? 'MÉTIER · ' : 'VOIE · '))
               + ((d.skills && d.skills.length) || 0) + ' SKILLS';
      var lockedTag = (k === 'secret' && (d.race_lock || []).length)
        ? '<span class="ax-li-tag-locked">RACE-LOCK</span>'
        : '';
      var btn = document.createElement('button');
      btn.className = 'ax-li';
      btn.dataset.id = id;
      btn.innerHTML =
        '<span class="ax-li-emoji">' + esc(emoji) + '</span>' +
        '<span class="ax-li-body">' +
          '<span class="ax-li-name">' + esc(label) + '</span>' +
          '<span class="ax-li-meta">' + esc(meta) + '</span>' +
        '</span>' +
        lockedTag +
        '<span class="ax-li-icon">→</span>';
      btn.addEventListener('click', function(){
        $$('.ax-li', $('#ax-list-items')).forEach(function(li){ li.classList.toggle('is-active', li.dataset.id === id); });
        openPopup(id);
      });
      items.appendChild(btn);
    });

    /* Page slot counter */
    $('#ax-page-num').textContent = ids.length.toString().padStart(2, '0');
    var maxVisible = Object.keys(ax).length;
    $('#ax-progress-fill').style.width = Math.max(8, Math.round((ids.length / maxVisible) * 100)) + '%';
  }

  function renderDetailEmpty(){
    $('#ax-detail-empty').hidden = false;
    $('#ax-detail-content').hidden = true;
    if (STATE.activeChar) {
      $('#ax-detail-empty .ax-detail-empty-title').textContent = 'SÉLECTIONNE UN AXIOME';
      $('#ax-detail-empty .ax-detail-empty-sub').textContent = 'Clique sur un axiome à gauche pour ouvrir sa fiche.';
    }
  }

  function updateToolbar(){
    var tb = $('#ax-toolbar');
    var c = STATE.activeChar;
    var cur = c ? (c.axiome_current || c.axiome) : null;
    if (cur) {
      tb.hidden = false;
      var btn = $('#ax-show-others-btn');
      var hint = $('#ax-toolbar-hint');
      if (STATE.showOthers) {
        btn.querySelector('.ax-toolbar-label').textContent = 'RECENTRER · ' + ((STATE.axiomes && STATE.axiomes[cur] && STATE.axiomes[cur].name) || cur).toUpperCase();
        hint.textContent = 'Voir uniquement l\'axiome actif';
      } else {
        btn.querySelector('.ax-toolbar-label').textContent = 'AUTRES AXIOMES';
        hint.textContent = 'Switch coûte 1 Axium · /axiome switch';
      }
    } else {
      tb.hidden = true;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     POPUP
     ═══════════════════════════════════════════════════════════════════ */
  function openPopup(id){
    var d = STATE.axiomes && STATE.axiomes[id];
    if (!d) return;
    STATE.pendingPop = id;
    var k = kindOf(d);
    $('#ax-pop-eyebrow').textContent = '// AXIOME · TIER 1';
    $('#ax-pop-emoji').textContent = EMOJI[id] || '⚜️';
    $('#ax-pop-title').textContent = d.name || id;
    $('#ax-pop-kind').textContent = kindLabel(k);
    $('#ax-pop-skills').textContent = (d.skills && d.skills.length) || 0;
    $('#ax-pop-branches').textContent = (d.branches && d.branches.length) || 0;
    $('#ax-pop-racelock').textContent = (d.race_lock && d.race_lock.length)
      ? d.race_lock.join(' · ')
      : '—';

    /* Description fallback : take the root skill's effect or a generic line */
    var rootSkill = (d.skills || []).find(function(s){ return s.tier === 0; });
    var desc = rootSkill && rootSkill.effect ? rootSkill.effect : 'Voie de spécialisation. Chaque skill coûte des PA (1 PA / 7 jours).';
    var first = (d.skills || [])[1];
    if (first && first.name) desc += ' Premier skill : ' + first.name + ' — ' + (first.effect || '');
    $('#ax-pop-desc').textContent = desc;

    /* Metier button visibility + page */
    var metierBtn = $('#ax-pop-metier-btn');
    var metierPage = METIER_PAGE[id];
    if (k === 'metier' && metierPage) {
      metierBtn.hidden = false;
      metierBtn.onclick = function(){ window.location.href = metierPage; };
    } else {
      metierBtn.hidden = true;
      metierBtn.onclick = null;
    }

    /* Tree button */
    $('#ax-pop-tree-btn').onclick = function(){
      window.location.href = 'axiome-skills-preview.html?ax=' + encodeURIComponent(id);
    };

    /* Choose button */
    var chooseBtn = $('#ax-pop-choose-btn');
    var c = STATE.activeChar;
    var alreadyChosen = c && (c.axiome_current === id || c.axiome === id);
    if (alreadyChosen) {
      chooseBtn.querySelector('.ax-popup-btn-label').textContent = '✓ DÉJÀ ACTIF';
      chooseBtn.disabled = true;
      chooseBtn.style.opacity = 0.55;
      chooseBtn.style.cursor = 'default';
    } else {
      chooseBtn.querySelector('.ax-popup-btn-label').textContent = 'CHOISIR CET AXIOME';
      chooseBtn.disabled = false;
      chooseBtn.style.opacity = 1;
      chooseBtn.style.cursor = 'pointer';
      chooseBtn.onclick = function(){ chooseAxiome(id); };
    }

    $('#ax-popup').hidden = false;

    /* Also render the right-pane detail */
    renderDetailFor(id);
  }

  function closePopup(){
    $('#ax-popup').hidden = true;
    STATE.pendingPop = null;
  }

  function chooseAxiome(id){
    var c = STATE.activeChar;
    if (!c) { closePopup(); return; }
    /* Local-only switch (Discord /axiome switch is the real path) */
    c.axiome_current = id;
    closePopup();
    STATE.showOthers = false;
    renderAxiomeList();
    updateToolbar();
    /* Show success in detail pane */
    renderDetailFor(id, /* withSuccess */ true);
  }

  /* ═══════════════════════════════════════════════════════════════════
     RIGHT-PANE DETAIL
     ═══════════════════════════════════════════════════════════════════ */
  function renderDetailFor(id, withSuccess){
    var d = STATE.axiomes && STATE.axiomes[id];
    if (!d) return;
    var k = kindOf(d);
    var emoji = EMOJI[id] || '⚜️';
    var raceLock = (d.race_lock && d.race_lock.length) ? d.race_lock.join(' · ') : '—';
    var firstSkills = (d.skills || []).filter(function(s){ return s.tier === 1; });
    var branches = d.branches || [];

    var html =
      '<div class="ax-detail-eyebrow">// AXIOME · TIER 1 · ' + esc(kindLabel(k)) + '</div>' +
      '<div class="ax-detail-title">' + esc(emoji) + ' ' + esc(d.name || id) + '</div>' +
      '<div class="ax-detail-subtitle">' + (d.skills.length) + ' SKILLS · ' + branches.length + ' BRANCHES</div>' +
      (withSuccess ? '<div class="ax-detail-success" style="margin-bottom:14px;padding:10px 14px;background:rgba(245,184,0,0.1);border:1px solid var(--ax-amber);font-family:var(--ax-font-m);font-size:0.7rem;letter-spacing:0.16em;color:var(--ax-amber)">✓ AXIOME SÉLECTIONNÉ POUR CE PERSONNAGE</div>' : '') +
      '<p class="ax-detail-desc">' +
        'Voie de spécialisation T1 — 4 branches, 12 skills + Apex. Chaque skill coûte des PA (1 PA tous les 7 jours).' +
      '</p>' +
      '<div class="ax-detail-grid">' +
        '<div class="ax-detail-stat"><div class="ax-detail-stat-label">SKILLS</div><div class="ax-detail-stat-value">' + d.skills.length + '</div></div>' +
        '<div class="ax-detail-stat"><div class="ax-detail-stat-label">BRANCHES</div><div class="ax-detail-stat-value">' + branches.length + '</div></div>' +
        '<div class="ax-detail-stat"><div class="ax-detail-stat-label">RACE-LOCK</div><div class="ax-detail-stat-value" style="font-size:0.6rem;line-height:1.4">' + esc(raceLock) + '</div></div>' +
      '</div>' +
      '<button class="ax-detail-cta" onclick="window.location.href=\'axiome-skills-preview.html?ax=' + esc(id) + '\'">' +
        '<span>VOIR L\'ARBRE</span><span class="ax-arrow">→</span>' +
      '</button>';

    $('#ax-detail-content').innerHTML = html;
    $('#ax-detail-empty').hidden = true;
    $('#ax-detail-content').hidden = false;
  }

  /* ═══════════════════════════════════════════════════════════════════
     WIRE EVENTS
     ═══════════════════════════════════════════════════════════════════ */
  function wire(){
    /* Close popup */
    $('#ax-popup').addEventListener('click', function(e){
      if (e.target && e.target.dataset && e.target.dataset.close === '1') closePopup();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && !$('#ax-popup').hidden) closePopup();
    });

    /* Filter tabs */
    $$('.ax-bottom-tab').forEach(function(b){
      b.addEventListener('click', function(){
        $$('.ax-bottom-tab').forEach(function(x){ x.classList.remove('is-active'); });
        b.classList.add('is-active');
        STATE.filter = b.dataset.filter;
        if (STATE.activeChar) renderAxiomeList();
      });
    });

    /* Tier tabs (decorative — only T1 is functional) */
    $$('.ax-tier-btn').forEach(function(b){
      b.addEventListener('click', function(){
        if (b.classList.contains('is-locked')) return;
        $$('.ax-tier-btn').forEach(function(x){ x.classList.remove('is-active'); });
        b.classList.add('is-active');
      });
    });

    /* Show others button */
    $('#ax-show-others-btn').addEventListener('click', function(){
      STATE.showOthers = !STATE.showOthers;
      renderAxiomeList();
      updateToolbar();
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════════ */
  async function init(){
    wire();
    bootSequence();
    try {
      await Promise.all([loadAxiomes(), loadCharacters()]);
      renderCharList();
    } catch (e) {
      console.error('[axiomes] init failed', e);
      $('#ax-list-items').innerHTML = '<div class="ax-loading-line" style="color:var(--ax-red)">⚠ ' + esc(e.message || 'Erreur') + '</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

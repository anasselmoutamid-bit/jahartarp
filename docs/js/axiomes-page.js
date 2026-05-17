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
    showOthers: false,   /* if true, show locked-out axiomes when char has T1 */
    axium: 0             /* solde Axium du joueur (lecture seule depuis players.{uid}) */
  };

  var MIN_LEVEL = 50;
  var SWITCH_COST = 1;

  /* T2 evolutions par T1 — noms d'affichage. Les skill trees T2 ne sont pas
     encore dans axiome_skills.json ; ces cartes sont décoratives pour l'instant.
     Les clés correspondent aux IDs de axiome_skills.json (avec fast_gunner
     mappé sur tireur_rapide pour compat). */
  var T2_MAP = {
    soldat:            ["Soldat d'Elite", "Soldat Arcanique", "Soldat de l'Ombre"],
    assassin:          ["Silence Ombragé", "Assassin Arcanique", "Éclaireur"],
    tank:              ["Mur de Fer", "Tank Arcanique", "Tank de Front"],
    mage:              ["Moine (Mage de Combat)", "TechnoMage", "Archimage"],
    soigneur:          ["Druide", "Mage Soigneur", "Occultiste"],
    orateur:           ["Charmeur", "Négociateur", "Voleur"],
    erudit:            ["Scientifique", "ArcanoChercheur", "OccultoChercheur", "TechnoChercheur"],
    eleveur:           ["Ami des Bêtes", "Chef de Meute", "Limit Breaker", "Soutien Animalier"],
    sniper:            ["Sniper d'Elite", "Sniper Furtif", "Sniper Arcanique"],
    fast_gunner:       ["DeadShot", "DeadEye", "Triple Gunner"],
    hacker:            ["Décodeur", "Virus", "Phisher", "NetWarrior"],
    forgeron:          ["ArcanoForgeron"],
    mage_favori_nexus: ["ArchiMage Favori du Nexus"],
    berserker:         ["Death Knight", "Earth Crusher", "Deep Berserker", "Controlled Berserker"],
    enforcer:          ["Oblivion", "DoomSlayer", "Superior Entity", "Reverso"],
    forgeron_divin:    ["Marteau de Baldun"],
    cultivator:        ["Aura Master"],
    fast_sniper:       ["Death Bringer", "Bullet Rainer", "Gun Master"],
    regressor:         ["Regressor II"]
  };

  /* ─── Emoji map ─── */
  var EMOJI = {
    soldat: "⚔️", mage: "🔮", soigneur: "🍶", hacker: "💻", assassin: "🗡️",
    sniper: "🎯", fast_gunner: "🔫", eleveur: "🐾", tank: "🛡️", erudit: "📚",
    orateur: "💋",
    berserker: "🩸", forgeron: "🔨", mage_favori_nexus: "✨", enforcer: "👑",
    forgeron_divin: "⚒️", cultivator: "🌟", fast_sniper: "🌠", regressor: "⏳",
    prime: "◈"
  };

  /* Map kind → metier page */
  var METIER_PAGE = {
    soigneur: 'brassage.html',
    hacker: 'nexusnet.html',
    eleveur: 'elevage.html',
    erudit: 'recherche.html',
    forgeron: 'forge.html',
    mage_favori_nexus: 'rituels.html',
    forgeron_divin: 'forge.html'
  };

  /* Liste des axiomes secrets probabilistes (visibilité tirée par char). */
  var PROB_SECRETS = ['forgeron_divin', 'cultivator', 'fast_sniper', 'regressor'];
  var PROB_RATES = {
    forgeron_divin: 0.10,
    cultivator:     0.10,
    fast_sniper:    0.10,
    regressor:      0.01
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

  /* Hash FNV-1a 32-bit → fraction [0,1). Déterministe : même (seed, salt) →
     même résultat. Chaque char a "sa séquence" via son id. */
  function hashFraction(seed, salt){
    var s = String(seed) + '|' + String(salt);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h / 0x100000000;
  }

  /* Renvoie la liste des secrets T1 visibles pour ce char. Seuls les chars
     niveau 50+ déclenchent la séquence. Tirages indépendants. */
  function rolledSecrets(c){
    if (!c) return [];
    var lvl = parseInt(c.level || 0, 10) || 0;
    if (lvl < MIN_LEVEL) return [];
    var cid = c._id || c.id;
    if (!cid) return [];
    return PROB_SECRETS.filter(function(id){
      return hashFraction(cid, id) < (PROB_RATES[id] || 0);
    });
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

  /* Session partagée hub/gacha — TTL 7j géré côté hub-core */
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
    if (s && s.id) {
      window.UID = String(s.id);
      return window.UID;
    }
    return null;
  }

  /* Fetch real characters of the connected player */
  async function loadCharacters(){
    var dbref = _getDb();
    var uid = _getUid();
    STATE.noSession = !uid;
    if (!dbref || !uid) {
      STATE.chars = [];
      return [];
    }
    try {
      var snap = await dbref.collection('characters').where('user_id', '==', String(uid)).get();
      var out = [];
      snap.forEach(function(d){
        var data = d.data() || {};
        if (data._init) return;
        out.push(Object.assign({ _id: d.id, id: d.id }, data));
      });
      STATE.chars = out;
      return out;
    } catch (e) {
      console.warn('[axiomes] character fetch failed:', e);
      STATE.chars = [];
      STATE.fetchError = e && e.message ? e.message : 'Erreur réseau';
      return [];
    }
  }

  /* Lecture du solde Axium dans players/{uid}. Lecture seule — le bot gère le débit. */
  async function loadAxium(){
    var dbref = _getDb();
    var uid = _getUid();
    if (!dbref || !uid) { STATE.axium = 0; return 0; }
    try {
      var snap = await dbref.collection('players').doc(String(uid)).get();
      if (!snap.exists) { STATE.axium = 0; return 0; }
      var data = snap.data() || {};
      var n = parseInt(data.axium, 10);
      STATE.axium = isFinite(n) && n > 0 ? n : 0;
      return STATE.axium;
    } catch (e) {
      console.warn('[axiomes] player fetch failed:', e);
      STATE.axium = 0;
      return 0;
    }
  }

  /* Gate logic — renvoie {ok, reason?} pour expliquer le blocage à l'UI. */
  function canChooseAxiome(c, id){
    var lvl = parseInt(c.level || 0, 10) || 0;
    if (lvl < MIN_LEVEL) {
      return { ok: false, reason: 'level', label: 'NIVEAU ' + MIN_LEVEL + ' REQUIS (' + lvl + ')' };
    }
    var cur = c.axiome_current || c.axiome || null;
    var isSwitch = cur && cur !== id;
    if (isSwitch && STATE.axium < SWITCH_COST) {
      return { ok: false, reason: 'axium', label: SWITCH_COST + ' AXIUM REQUIS (' + STATE.axium + ')' };
    }
    return { ok: true };
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
      if (STATE.noSession) {
        items.innerHTML =
          '<div class="ax-loading-line">⚠ Session expirée ou absente.</div>' +
          '<div class="ax-loading-line" style="margin-top:8px">Connecte-toi via <code>/link</code> sur Discord puis ouvre le <a href="hub.html" style="color:var(--ax-amber);text-decoration:underline">Hub</a>.</div>';
      } else if (STATE.fetchError) {
        items.innerHTML = '<div class="ax-loading-line" style="color:var(--ax-red)">⚠ ' + esc(STATE.fetchError) + '</div>';
      } else {
        items.innerHTML = '<div class="ax-loading-line">Aucun personnage trouvé sur ce compte.</div>';
      }
      return;
    }
    STATE.chars.forEach(function(c){
      var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Personnage';
      var lvl = parseInt(c.level || 0, 10) || 0;
      var race = c.class || c.race_specific || c.race_category || '—';
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
    /* Secret name-locked (Prime) → match exact sur "first_name last_name", insensible
       à la casse et aux espaces. Pas de check niveau (visible dès qu'identifié). */
    var nameLock = def._name_lock;
    if (nameLock && nameLock.length) {
      var fullName = ((c.first_name || '') + ' ' + (c.last_name || '')).trim().toLowerCase();
      return nameLock.some(function(n){ return String(n).trim().toLowerCase() === fullName; });
    }
    /* Secret probabiliste (Forgeron Divin, Cultivator, Fast Sniper, Regressor)
       → tirage déterministe par char ; visible uniquement si rolled. */
    if (PROB_SECRETS.indexOf(axId) >= 0) {
      return rolledSecrets(c).indexOf(axId) >= 0;
    }
    /* Secret race-locked → compare la race jouable (champ class) */
    var race = (c.class || c.race_specific || '').toLowerCase();
    var raceCat = (c.race_category || '').toLowerCase();
    var lock = (def.race_lock || []).map(function(r){ return String(r).toLowerCase(); });
    if (!lock.length) return false;  // race_lock vide = invisible (ex: decodeur deprecated)
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

    /* T2 evolutions — affichées sous le T1 verrouillé. Skill trees pas encore
       implémentés ; les cartes sont décoratives (data-stub="1"). */
    if (cur && !STATE.showOthers) {
      var t2List = T2_MAP[cur] || [];
      if (t2List.length) {
        var sep = document.createElement('div');
        sep.className = 'ax-loading-line';
        sep.style.cssText = 'margin-top:14px;color:var(--ax-amber);letter-spacing:0.18em;font-size:0.65rem;border-top:1px dashed rgba(245,184,0,0.35);padding-top:10px';
        sep.textContent = '— T2 · ÉVOLUTIONS (' + t2List.length + ') —';
        items.appendChild(sep);
        t2List.forEach(function(name){
          var t2btn = document.createElement('button');
          t2btn.className = 'ax-li';
          t2btn.dataset.stub = '1';
          t2btn.disabled = true;
          t2btn.style.opacity = 0.7;
          t2btn.style.cursor = 'not-allowed';
          t2btn.innerHTML =
            '<span class="ax-li-emoji">◇</span>' +
            '<span class="ax-li-body">' +
              '<span class="ax-li-name">' + esc(name) + '</span>' +
              '<span class="ax-li-meta">T2 · ARBRE WIP</span>' +
            '</span>' +
            '<span class="ax-li-icon" style="opacity:0.4">·</span>';
          items.appendChild(t2btn);
        });
      }
    }

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
        hint.textContent = 'Switch coûte ' + SWITCH_COST + ' Axium · solde : ' + STATE.axium;
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

    /* Metier button visibility — uniquement si l'axiome métier est l'axiome
       ACTIF du perso (validation requise). */
    var metierBtn = $('#ax-pop-metier-btn');
    var metierPage = METIER_PAGE[id];
    var charCur = STATE.activeChar && (STATE.activeChar.axiome_current || STATE.activeChar.axiome);
    if (k === 'metier' && metierPage && charCur === id) {
      metierBtn.hidden = false;
      metierBtn.onclick = function(){ window.location.href = metierPage; };
    } else {
      metierBtn.hidden = true;
      metierBtn.onclick = null;
    }

    /* Tree button — passe l'ID du char pour que le skill tree puisse appliquer
       le gate "unlock seulement si choisi". */
    $('#ax-pop-tree-btn').onclick = function(){
      var cid = STATE.activeChar && (STATE.activeChar._id || STATE.activeChar.id);
      var url = 'axiome-skills-preview.html?ax=' + encodeURIComponent(id);
      if (cid) url += '&char=' + encodeURIComponent(cid);
      window.location.href = url;
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
      chooseBtn.onclick = null;
    } else {
      var gate = canChooseAxiome(c, id);
      if (!gate.ok) {
        chooseBtn.querySelector('.ax-popup-btn-label').textContent = '🔒 ' + gate.label;
        chooseBtn.disabled = true;
        chooseBtn.style.opacity = 0.55;
        chooseBtn.style.cursor = 'not-allowed';
        chooseBtn.onclick = null;
      } else {
        var cur = c && (c.axiome_current || c.axiome);
        var isSwitch = cur && cur !== id;
        chooseBtn.querySelector('.ax-popup-btn-label').textContent =
          isSwitch ? ('SWITCH · COÛT ' + SWITCH_COST + ' AXIUM') : 'CHOISIR CET AXIOME';
        chooseBtn.disabled = false;
        chooseBtn.style.opacity = 1;
        chooseBtn.style.cursor = 'pointer';
        chooseBtn.onclick = function(){ chooseAxiome(id); };
      }
    }

    $('#ax-popup').hidden = false;

    /* Also render the right-pane detail */
    renderDetailFor(id);
  }

  function closePopup(){
    $('#ax-popup').hidden = true;
    STATE.pendingPop = null;
  }

  async function chooseAxiome(id){
    var c = STATE.activeChar;
    if (!c) { closePopup(); return; }

    /* Re-check gate au cas où le state local serait stale. */
    var gate = canChooseAxiome(c, id);
    if (!gate.ok) {
      console.warn('[axiomes] choose blocked:', gate);
      closePopup();
      return;
    }

    var charId = c._id || c.id;
    var dbref = _getDb();
    if (!dbref || !charId) {
      console.warn('[axiomes] no db or charId — abort write');
      closePopup();
      return;
    }

    /* Optimistic UI : update local, render, then persist. Rollback en cas d'échec. */
    var prev = c.axiome_current || null;
    c.axiome_current = id;
    closePopup();
    STATE.showOthers = false;
    renderAxiomeList();
    updateToolbar();
    renderDetailFor(id, /* withSuccess */ true);

    try {
      await dbref.collection('characters').doc(String(charId)).update({
        axiome_current: id,
        updated_at: new Date().toISOString()
      });
      /* Note : le débit de l'Axium (1 pour un switch) est géré par le bot
         Discord via /axiome switch. La page ne décrémente pas players.axium
         (interdit côté rules pour les non-admins). */
    } catch (e) {
      console.error('[axiomes] persist failed, rollback', e);
      c.axiome_current = prev;
      renderAxiomeList();
      updateToolbar();
      renderDetailEmpty();
      /* Toast minimal */
      var head = $('#ax-list-head');
      if (head) {
        var msg = document.createElement('div');
        msg.style.cssText = 'color:var(--ax-red);font-size:0.65rem;margin-top:6px;letter-spacing:0.1em';
        msg.textContent = '⚠ Sauvegarde refusée : ' + (e.message || 'erreur réseau');
        head.appendChild(msg);
        setTimeout(function(){ try { head.removeChild(msg); } catch(_){} }, 5000);
      }
    }
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
      await Promise.all([loadAxiomes(), loadCharacters(), loadAxium()]);
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

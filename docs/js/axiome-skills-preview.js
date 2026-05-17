/* ═══════════════════════════════════════════════════════════════════════
   axiome-skills-preview.js — Skill tree d'un Axiome (data-driven)
   ═══════════════════════════════════════════════════════════════════════
   URL : axiome-skills-preview.html?ax=<id>   (défaut : soldat)
   Charge data/axiome_skills.json et rend l'arbre :
     · Root au centre bas (50%, 640)
     · 4 branches en colonnes (T1 → T2 → T3, x=200/400/600/800)
     · Apex au centre haut (50%, 80)
   ═════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ─── State ─── */
  var STATE = {
    axId: null,
    axDef: null,
    skillsById: {},
    pa: 3,
    unlocked: new Set(),
    pending: null,
    nodes: {},
    /* Gate : true si le personnage a réellement choisi cet axiome.
       Sans choix, l'arbre est visitable mais les unlocks sont bloqués. */
    canUnlock: false,
    gateReason: 'preview'   // 'preview' | 'no-session' | 'wrong-axiome' | 'ok'
  };

  /* Glyphs by branch key (fallback ◆) */
  var BRANCH_GLYPH = {
    FORCE: '💪', DEF: '🛡', TACT: '🎯', LAME: '🗡',
    ARC: '🔮', ERU: '📚', CORPS: '🧘', CHANT: '🎵',
    ANA: '🩺', PHARMA: '🧪', COMPA: '💗', DIAG: '🔍',
    INTR: '⚡', SOCIAL: '🗣', CRYPTO: '🔐', STEALTH: '👤',
    OMBRE: '🌑', POISON: '☠', INF: '🗝',
    PREC: '🎯', PAT: '🧘', OPT: '🔭', CAL: '💥',
    CAD: '⚡', REF: '⚡', DOUB: '🔫', MOB: '💨',
    LIEN: '🐾', DRES: '📜', COM: '💰', MEUTE: '🐺',
    BLI: '🛡', PROV: '📣', END: '💪', IMP: '⚔',
    LEC: '📖', GRI: '📜', MEM: '🧠',
    RAGE: '🩸', INST: '👁', CHAOS: '🌀', SANG: '🩸',
    ART: '🔨', MET: '⛏', RUNE: '🔥',
    SAV: '✨', BENE: '🌟',
    DOM: '👑', DEST: '💥', LOI: '⚖', PRES: '👁',
    CHARM: '💋', ILL: '🌑', PACTE: '🩸',
    CODE: '⌨', INT: '📡', TRANS: '⚙'
  };

  function $(sel, parent) { return (parent || document).querySelector(sel); }
  function $$(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function getParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }

  /* ─── Layout calculator (radial / polar) ─────────────────────────────────
     Root au centre, apex au sommet (12h), branches en spokes radiaux.
     T1 = anneau intérieur, T2 = milieu, T3 = extérieur.
     N spokes répartis uniformément avec un offset pour éviter le sommet
     (réservé à l'apex). */
  var CENTER_X = 500, CENTER_Y = 380;
  var APEX_Y = 50;
  var RING_R = { 1: 130, 2: 220, 3: 310 };
  function posFor(skill, branchKeys) {
    if (skill.tier === 0) return { x: CENTER_X, y: CENTER_Y };
    if (skill.tier === 4) return { x: CENTER_X, y: APEX_Y };
    var n = Math.max(1, branchKeys.length);
    var bi = branchKeys.indexOf(skill.branch);
    if (bi < 0) bi = 0;
    /* Décalage : premier spoke à -π/2 + π/n (juste en bas-droit du sommet),
       pour que l'apex (-π/2) reste seul au 12 heures. */
    var step = (2 * Math.PI) / n;
    var angle = -Math.PI / 2 + step * (bi + 0.5);
    var r = RING_R[skill.tier] || 200;
    return {
      x: CENTER_X + r * Math.cos(angle),
      y: CENTER_Y + r * Math.sin(angle)
    };
  }

  function glyphFor(skill) {
    if (skill.tier === 0) return '⚔';
    if (skill.tier === 4) return '👑';
    return BRANCH_GLYPH[skill.branch] || '◆';
  }

  /* ─── Page DOM template ─── */
  function createPageEl(pageDef, idx) {
    var el = document.createElement('div');
    el.className = 'tree-page';
    el.dataset.idx = String(idx);
    el.dataset.source = pageDef._sourceId || '';
    el.innerHTML =
      '<svg class="tree-arcs" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true">' +
        '<circle cx="500" cy="380" r="130" class="arc-strong"/>' +
        '<circle cx="500" cy="380" r="220" class="arc-strong"/>' +
        '<circle cx="500" cy="380" r="310" class="arc-strong"/>' +
        '<circle cx="500" cy="380" r="60"/>' +
        '<circle cx="500" cy="380" r="90"/>' +
        '<circle cx="500" cy="380" r="170"/>' +
        '<circle cx="500" cy="380" r="260"/>' +
      '</svg>' +
      '<div class="tree-center-glow" aria-hidden="true"></div>' +
      '<svg class="tree-lines" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true"></svg>';
    if (STATE.pages.length > 1) {
      var lbl = document.createElement('div');
      lbl.className = 'tree-page-label';
      lbl.textContent = pageDef.name || '';
      el.appendChild(lbl);
    }
    return el;
  }

  /* ─── Render une page (1 axiome source) ─── */
  function renderPage(pageEl, pageDef) {
    var skills = pageDef.skills || [];
    var branchKeys = (pageDef.branches || []).map(function(b){ return b.key; });

    skills.forEach(function(s){ STATE.skillsById[s.id] = s; });
    var rootSkill = skills.find(function(s){ return s.tier === 0; });
    if (rootSkill) STATE.unlocked.add(rootSkill.id);

    var posById = {};
    skills.forEach(function(s){ posById[s.id] = posFor(s, branchKeys); });

    var svg = pageEl.querySelector('.tree-lines');
    skills.forEach(function(s){
      (s.requires || []).forEach(function(reqId){
        var from = posById[reqId];
        var to   = posById[s.id];
        if (!from || !to || !svg) return;
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', 'M ' + from.x + ',' + from.y + ' L ' + to.x + ',' + to.y);
        p.setAttribute('class', 'ln');
        p.dataset.link = reqId + '|' + s.id;
        svg.appendChild(p);
      });
    });

    skills.forEach(function(s){
      var pos = posById[s.id];
      var state = 'locked';
      if (s.tier === 0) state = 'unlocked';
      else if (s.tier === 1) state = 'available';
      var cls = 'node';
      if (s.tier === 0) cls += ' node-root';
      if (s.tier === 4) cls += ' node-apex';

      var btn = document.createElement('button');
      btn.className = cls;
      btn.setAttribute('data-id', s.id);
      btn.setAttribute('data-state', state);
      btn.style.left = (s.tier === 0 || s.tier === 4) ? '50%' : pos.x + 'px';
      btn.style.top  = pos.y + 'px';
      btn.setAttribute('aria-label', s.name);
      btn.innerHTML =
        '<span class="node-inner"><span class="node-glyph">' + esc(glyphFor(s)) + '</span></span>' +
        '<span class="node-ring"></span>' +
        '<span class="node-label">' + esc(s.name) + '</span>';
      btn.addEventListener('click', function(){ openModal(s.id); });
      pageEl.appendChild(btn);
      STATE.nodes[s.id] = btn;
    });
  }

  /* ─── Build all pages + wire navigation ─── */
  function buildPages() {
    var ax = STATE.axDef;
    /* Header */
    $('#i-axiome').textContent = (ax.name || STATE.axId).toUpperCase() + ' · T1';
    var bannerText = document.querySelector('.banner-text');
    if (bannerText) bannerText.textContent = (ax.name || STATE.axId).toUpperCase();
    document.title = 'JAHARTA — Skill Tree ' + (ax.name || STATE.axId);

    /* Reset state */
    STATE.skillsById = {};
    STATE.nodes = {};

    /* Build pages */
    var track = $('#tree-track');
    if (!track) return;
    track.innerHTML = '';
    STATE.pages.forEach(function(pageDef, idx){
      var pageEl = createPageEl(pageDef, idx);
      renderPage(pageEl, pageDef);
      track.appendChild(pageEl);
    });

    /* Subtitle = total skills across all pages */
    var totalSkills = STATE.pages.reduce(function(n, p){ return n + ((p.skills || []).length); }, 0);
    var subEl = document.querySelector('.tree-subtitle');
    if (subEl) {
      subEl.textContent = totalSkills + ' micro-skills' +
        (STATE.pages.length > 1 ? ' · ' + STATE.pages.length + ' branches sources' : '') +
        ' · 1 PA tous les 7 jours · Reset au switch d\'Axiome';
    }

    wirePagination();
    STATE.currentPage = 0;
    setPage(0);
    updateUI();
  }

  /* ─── Navigation entre pages ─── */
  function setPage(idx) {
    var track = $('#tree-track');
    if (!track) return;
    if (idx < 0) idx = 0;
    if (idx >= STATE.pages.length) idx = STATE.pages.length - 1;
    STATE.currentPage = idx;
    track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    var prev = $('#nav-prev'), next = $('#nav-next');
    if (prev) prev.classList.toggle('is-disabled', idx === 0);
    if (next) next.classList.toggle('is-disabled', idx === STATE.pages.length - 1);
    $$('.page-dot').forEach(function(d, i){ d.classList.toggle('is-active', i === idx); });
  }

  function wirePagination() {
    var dotsHost = $('#tree-page-dots');
    if (dotsHost) {
      dotsHost.innerHTML = '';
      STATE.pages.forEach(function(p, i){
        var dot = document.createElement('button');
        dot.className = 'page-dot';
        dot.setAttribute('aria-label', 'Page ' + (i + 1));
        dot.title = p.name || '';
        dot.addEventListener('click', function(){ setPage(i); });
        dotsHost.appendChild(dot);
      });
    }
    var ctrls = $('#tree-controls');
    if (ctrls) ctrls.style.display = (STATE.pages.length > 1) ? '' : 'none';
    var prev = $('#nav-prev');
    var next = $('#nav-next');
    if (prev && !prev.dataset.wired) { prev.dataset.wired = '1';
      prev.addEventListener('click', function(){ setPage(STATE.currentPage - 1); });
    }
    if (next && !next.dataset.wired) { next.dataset.wired = '1';
      next.addEventListener('click', function(){ setPage(STATE.currentPage + 1); });
    }
    if (!STATE._kbWired) {
      STATE._kbWired = true;
      document.addEventListener('keydown', function(e){
        var modal = $('#modal-overlay');
        if (modal && !modal.hidden) return;
        if (e.key === 'ArrowLeft') setPage(STATE.currentPage - 1);
        else if (e.key === 'ArrowRight') setPage(STATE.currentPage + 1);
      });
    }
  }

  function updateUI() {
    $('#i-pa').textContent = STATE.pa;
    var unlockedCount = Math.max(0, STATE.unlocked.size - (STATE.pages || [STATE.axDef]).length);
    var total = (STATE.pages || []).reduce(function(n, p){
      return n + Math.max(0, ((p.skills || []).length) - 1);  // exclude root
    }, 0);
    $('#i-unlocked').textContent = unlockedCount;
    var dim = document.querySelector('#i-unlocked + .dim');
    if (dim) dim.textContent = ' / ' + total;

    $$('.ln').forEach(function(ln){
      var parts = (ln.dataset.link || '').split('|');
      if (parts.length !== 2) return;
      var startU = STATE.unlocked.has(parts[0]);
      var endU   = STATE.unlocked.has(parts[1]);
      if (startU && endU) ln.classList.add('is-active');
      else ln.classList.remove('is-active');
    });
  }

  function isAvailable(skill) {
    if (STATE.unlocked.has(skill.id)) return false;
    if (skill.tier === 0) return false;
    if (!skill.requires || skill.requires.length === 0) return true;
    if (skill.tier === 4) {
      return skill.requires.every(function(r){ return STATE.unlocked.has(r); });
    }
    return skill.requires.some(function(r){ return STATE.unlocked.has(r); });
  }

  function recomputeAvailability() {
    var allSkills = (STATE.pages || []).reduce(function(acc, p){
      return acc.concat(p.skills || []);
    }, []);
    allSkills.forEach(function(s){
      var node = STATE.nodes[s.id];
      if (!node) return;
      if (STATE.unlocked.has(s.id)) node.dataset.state = 'unlocked';
      else if (isAvailable(s)) node.dataset.state = 'available';
      else node.dataset.state = 'locked';
    });
  }

  /* ─── Modal ─── */
  function openModal(id) {
    var s = STATE.skillsById[id];
    if (!s) return;
    STATE.pending = id;
    var unlocked = STATE.unlocked.has(id);
    var available = isAvailable(s);

    var rank = s.tier === 4 ? 'APEX · TIER 4' : (s.tier === 0 ? 'ORIGINE · TIER 0' : 'TIER ' + s.tier);
    $('#modal-rank').textContent = rank;
    $('#modal-glyph').textContent = glyphFor(s);
    $('#modal-title').textContent = s.name;
    $('#modal-desc').textContent = s.effect || '';
    $('#modal-effect').textContent = s.effect || '—';
    $('#modal-cost').textContent = s.cost;
    var reqText = '—';
    if (s.requires && s.requires.length) {
      reqText = s.requires.map(function(r){
        var rs = STATE.skillsById[r];
        return rs ? rs.name : r;
      }).join(' · ');
    }
    $('#modal-req').textContent = reqText;

    var btn = $('#modal-confirm');
    var lbl = btn.querySelector('.btn-label');
    if (unlocked) {
      lbl.textContent = '✓ DÉJÀ DÉBLOQUÉ';
      btn.disabled = true;
      btn.style.opacity = 0.55;
      btn.style.cursor = 'default';
    } else if (!available) {
      lbl.textContent = 'PRÉREQUIS MANQUANT';
      btn.disabled = true;
      btn.style.opacity = 0.55;
      btn.style.cursor = 'not-allowed';
    } else if (!STATE.canUnlock) {
      var lockMsg = '🔒 ';
      if (STATE.gateReason === 'no-session')   lockMsg += 'CONNECTE-TOI VIA /link';
      else if (STATE.gateReason === 'wrong-axiome') lockMsg += 'CHOISIS CET AXIOME D\'ABORD';
      else                                     lockMsg += 'PREVIEW · CHOISIS UN PERSO';
      lbl.textContent = lockMsg;
      btn.disabled = true;
      btn.style.opacity = 0.55;
      btn.style.cursor = 'not-allowed';
    } else if (STATE.pa < s.cost) {
      lbl.textContent = 'PA INSUFFISANTS';
      btn.disabled = true;
      btn.style.opacity = 0.55;
      btn.style.cursor = 'not-allowed';
    } else {
      lbl.textContent = "VALIDER L'APPRENTISSAGE";
      btn.disabled = false;
      btn.style.opacity = 1;
      btn.style.cursor = 'pointer';
    }
    $('#modal-overlay').hidden = false;
  }

  function closeModal() {
    $('#modal-overlay').hidden = true;
    STATE.pending = null;
  }

  function confirmUnlock() {
    var id = STATE.pending;
    if (!id) return;
    var s = STATE.skillsById[id];
    if (!s || STATE.unlocked.has(id)) return;
    if (!isAvailable(s)) return;
    if (!STATE.canUnlock) return;
    if (STATE.pa < s.cost) return;
    STATE.pa -= s.cost;
    STATE.unlocked.add(id);
    recomputeAvailability();
    updateUI();
    closeModal();
  }

  /* ─── Gate : vérifie que le perso `?char=...` a bien choisi cet axiome ─── */
  function _getDb(){
    if (window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(_) {}
    }
    return null;
  }

  async function resolveGate(){
    var charId = getParam('char');
    if (!charId) {
      STATE.canUnlock = false;
      STATE.gateReason = 'preview';
      return;
    }
    var dbref = _getDb();
    if (!dbref) {
      STATE.canUnlock = false;
      STATE.gateReason = 'no-session';
      return;
    }
    try {
      var snap = await dbref.collection('characters').doc(String(charId)).get();
      if (!snap.exists) {
        STATE.canUnlock = false;
        STATE.gateReason = 'preview';
        return;
      }
      var data = snap.data() || {};
      var cur = data.axiome_current || data.axiome || null;
      if (cur && cur === STATE.axId) {
        STATE.canUnlock = true;
        STATE.gateReason = 'ok';
      } else {
        STATE.canUnlock = false;
        STATE.gateReason = 'wrong-axiome';
      }
    } catch (e) {
      console.warn('[axiome-skills-preview] gate check failed:', e);
      STATE.canUnlock = false;
      STATE.gateReason = 'no-session';
    }
  }

  function renderGateBanner(){
    var host = $('.tree-subtitle');
    if (!host) return;
    var existing = document.getElementById('gate-banner');
    if (existing) existing.remove();
    if (STATE.canUnlock) return;
    var msg;
    if (STATE.gateReason === 'no-session')        msg = '👁 Mode preview · connecte-toi via /link pour débloquer';
    else if (STATE.gateReason === 'wrong-axiome') msg = '👁 Mode preview · ce perso n\'a pas choisi cet axiome';
    else                                          msg = '👁 Mode preview · choisis un perso depuis la page Axiomes';
    var b = document.createElement('div');
    b.id = 'gate-banner';
    b.style.cssText = 'margin-top:10px;padding:6px 14px;border:1px solid rgba(245,184,0,0.45);background:rgba(245,184,0,0.08);color:#facc15;font-family:Share Tech Mono,monospace;font-size:0.7rem;letter-spacing:0.14em;display:inline-block';
    b.textContent = msg;
    host.parentNode.insertBefore(b, host.nextSibling);
  }

  /* Merge cumulatif : les axiomes avec `_inherits_from` agrègent les skills
     + branches des axiomes sources. Préfixe les branch keys par l'axiome
     d'origine pour éviter les collisions (ex: berserker:RAGE). */
  function mergeInheritance(j, def) {
    var sources = def._inherits_from || [];
    if (!sources.length) return def;
    var mergedSkills = [];
    var mergedBranches = [];
    var seenBranchKeys = {};
    sources.forEach(function(srcId){
      var src = j[srcId];
      if (!src) { console.warn('[skill-preview] inherit unknown source:', srcId); return; }
      (src.branches || []).forEach(function(b){
        var newKey = srcId.toUpperCase() + ':' + b.key;
        if (seenBranchKeys[newKey]) return;
        seenBranchKeys[newKey] = true;
        mergedBranches.push({
          key: newKey,
          label: (src.name ? src.name.toUpperCase() + ' · ' : '') + b.label,
          color: b.color,
          _source: srcId
        });
      });
      (src.skills || []).forEach(function(s){
        var copy = Object.assign({}, s);
        if (copy.branch) copy.branch = srcId.toUpperCase() + ':' + copy.branch;
        copy._source = srcId;
        mergedSkills.push(copy);
      });
    });
    /* Concat avec les skills propres de l'axiome (généralement vides pour les cumulatifs) */
    (def.skills || []).forEach(function(s){ mergedSkills.push(s); });
    (def.branches || []).forEach(function(b){ mergedBranches.push(b); });
    return Object.assign({}, def, {
      skills: mergedSkills,
      branches: mergedBranches,
      _merged: true,
      _sources: sources
    });
  }

  /* ─── Data load ─── */
  async function loadData() {
    var ax = (getParam('ax') || 'soldat').toLowerCase();
    STATE.axId = ax;
    try {
      var r = await fetch('data/axiome_skills.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json();
      if (!j[ax]) throw new Error("Axiome inconnu : " + ax);
      STATE.axDef = j[ax];
      /* Pagination : une page par source pour les axiomes cumulatifs,
         sinon une page unique avec l'axiome lui-même. */
      var inherits = Array.isArray(STATE.axDef._inherits_from) ? STATE.axDef._inherits_from : [];
      if (inherits.length) {
        STATE.pages = inherits
          .map(function(srcId){
            var src = j[srcId];
            if (!src) { console.warn('[skill-preview] source inconnue:', srcId); return null; }
            return Object.assign({ _sourceId: srcId }, src);
          })
          .filter(Boolean);
        /* Si l'axiome cumulatif a aussi ses propres skills (rare), on les met
           en dernière page. */
        if ((STATE.axDef.skills || []).length) {
          STATE.pages.push(Object.assign({ _sourceId: ax }, STATE.axDef));
        }
      } else {
        STATE.pages = [Object.assign({ _sourceId: ax }, STATE.axDef)];
      }
      await resolveGate();
      buildPages();
      renderGateBanner();
    } catch (e) {
      console.error('[axiome-skills-preview]', e);
      var tree = $('#tree');
      if (tree) {
        var msg = document.createElement('div');
        msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff4757;font-family:Share Tech Mono,monospace;font-size:.8rem;letter-spacing:.1em;text-align:center;padding:20px;';
        msg.textContent = '⚠ ' + (e.message || 'Erreur de chargement');
        tree.appendChild(msg);
      }
    }
  }

  function wireUI() {
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-cancel').addEventListener('click', closeModal);
    $('#modal-overlay').addEventListener('click', function(e){
      if (e.target === e.currentTarget) closeModal();
    });
    $('#modal-confirm').addEventListener('click', confirmUnlock);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && !$('#modal-overlay').hidden) closeModal();
    });
  }

  /* ─── Background particles canvas — golden dust ─── */
  (function(){
    var c = document.getElementById('bg-particles');
    if (!c) return;
    var ctx = c.getContext('2d');
    var w = 0, h = 0, parts = [];
    function resize(){ w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
    function spawn(n){
      parts = [];
      for (var i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 0.4 + Math.random() * 1.2,
          vy: 0.06 + Math.random() * 0.12,
          vx: (Math.random() - 0.5) * 0.06,
          a: 0.1 + Math.random() * 0.55
        });
      }
    }
    function step(){
      ctx.clearRect(0, 0, w, h);
      parts.forEach(function(p){
        p.y += p.vy; p.x += p.vx;
        if (p.y > h) { p.y = -2; p.x = Math.random() * w; }
        if (p.x < 0 || p.x > w) p.vx *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(250, 204, 21, ' + p.a + ')';
        ctx.fill();
      });
      requestAnimationFrame(step);
    }
    resize();
    window.addEventListener('resize', function(){ resize(); spawn(60); });
    spawn(60);
    step();
  })();

  wireUI();
  loadData();
})();

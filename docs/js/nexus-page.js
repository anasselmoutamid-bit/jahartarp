/* ═══════════════════════════════════════════════════════════════════════
   nexus-page.js — Système Nexus
   • Boot terminal typewriter
   • Welcome reveal : "Bienvenue sur le Système Nexus, Néophyte"
   • HUD micro-interactions (scan %, loading %, binary streams)
   • Gates accordion
   • Particles canvas (subtle blue dust)
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (sel, p) { return (p || document).querySelector(sel); };
  var $$ = function (sel, p) { return Array.from((p || document).querySelectorAll(sel)); };

  /* ── Skip-intro flag (drawer toggle) ── */
  var SKIP_INTRO_KEY = 'nx_skip_intro';
  var skipIntro = false;
  try { skipIntro = localStorage.getItem(SKIP_INTRO_KEY) === '1'; } catch (e) {}

  /* ═══════════════════════════════════════════════════════
     BOOT TERMINAL SEQUENCE
     ═══════════════════════════════════════════════════════ */
  function bootSequence(){
    var out      = $('#nx-boot-out');
    var cursor   = $('#nx-boot-cursor');
    var bootEl   = $('#nx-boot');
    var frameEl  = $('#nx-boot-frame');
    var welcEl   = $('#nx-boot-welcome');
    if (!out || !bootEl || !frameEl || !welcEl) return Promise.resolve();

    if (skipIntro) {
      bootEl.classList.add('is-disabled');
      return Promise.resolve();
    }

    var lines = [
      { t: '//[NEXUS] > Loading mainframe protocol…',     d: 320 },
      { t: '> Negotiating with NEXUS::CORE',              d: 260 },
      { t: '> Handshake OK · session=0x5AFE',             d: 240 },
      { t: '> Mounting USER.GATE…',                       d: 220 },
      { t: '> Loading sub-systems',                       d: 220 },
      { t: '> [████░░░░░░░░░░░░░░░░] axiome.dll',          d: 180 },
      { t: '> [████████░░░░░░░░░░░░] forge.bin',           d: 180 },
      { t: '> [████████████░░░░░░░░] sanctuaire.scp',      d: 180 },
      { t: '> [████████████████░░░░] darknexus.lnk',       d: 180 },
      { t: '> [████████████████████] messagerie.proto',    d: 260 },
      { t: '> Bypassing legacy auth · OK',                d: 240 },
      { t: '> Initializing neural sync',                  d: 240 },
      { t: '> AUTH OK · Welcome, Néophyte',               d: 380 }
    ];

    return new Promise(function (resolve) {
      var i = 0;
      function step(){
        if (i >= lines.length) { revealWelcome(); return; }
        var ln = lines[i];
        out.textContent += (i === 0 ? '' : '\n') + ln.t;
        i++;
        setTimeout(step, ln.d);
      }
      function revealWelcome(){
        if (cursor) cursor.style.display = 'none';
        frameEl.classList.add('is-fading');
        setTimeout(function () {
          frameEl.style.display = 'none';
          welcEl.classList.add('is-in');
          setTimeout(function () {
            bootEl.classList.add('is-done');
            setTimeout(function () {
              try { bootEl.remove(); } catch (_) {}
              resolve();
            }, 700);
          }, 2600);
        }, 520);
      }
      step();
    });
  }

  /* ═══════════════════════════════════════════════════════
     HUD ANIMATIONS (scan%, loading%, files)
     ═══════════════════════════════════════════════════════ */
  function animateScanAndLoad(){
    var scanPct = $('#nx-scan-pct');
    var scanBar = $('#nx-scan-bar');
    var files   = $('#nx-scan-files');
    var loadPct = $('#nx-load-pct');

    var target  = 79;
    var p = 0;
    var start = performance.now();
    var duration = 2600;

    function tick(t){
      var k = Math.min(1, (t - start) / duration);
      var eased = 1 - Math.pow(1 - k, 2.4);
      p = Math.round(eased * target);
      if (scanPct) scanPct.textContent = (p < 10 ? '0' + p : p) + '%';
      if (loadPct) loadPct.textContent = (p < 10 ? '0' + p : p) + '%';
      if (scanBar) scanBar.style.width = p + '%';
      if (files)   files.textContent = Math.floor((p / 100) * 1440).toString().padStart(3, '0');
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ═══════════════════════════════════════════════════════
     EVENT CHIP (date dynamique)
     ═══════════════════════════════════════════════════════ */
  function fillEventChip(){
    var d = new Date();
    var dayNum = d.getDate();
    var weekday = ['DIMANCHE','LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI'][d.getDay()];
    var month   = ['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'][d.getMonth()];
    var dayEl = $('#nx-event-day');
    var dateEl = $('#nx-event-date');
    if (dayEl)  dayEl.textContent  = dayNum;
    if (dateEl) dateEl.textContent = weekday + ' · ' + dayNum + ' ' + month + ' ' + d.getFullYear();
  }

  /* ═══════════════════════════════════════════════════════
     BINARY STREAMS (background + breach)
     ═══════════════════════════════════════════════════════ */
  function genBinaryBlock(rows, cols){
    var out = '';
    for (var r = 0; r < rows; r++){
      var row = '';
      for (var c = 0; c < cols; c++) row += (Math.random() < 0.5 ? '0' : '1');
      out += row + '\n';
    }
    return out.trim();
  }

  function paintBinary(){
    var tl = $('#nx-binary-tl');
    var tr = $('#nx-binary-tr');
    if (tl) tl.textContent = genBinaryBlock(2, 8);
    if (tr) tr.textContent = genBinaryBlock(8, 8);

    var stream = $('#nx-attn-stream');
    if (stream) {
      var row = '';
      for (var i = 0; i < 90; i++) row += (Math.random() < 0.5 ? '0' : '1') + ' ';
      stream.textContent = row.trim();
    }

    var breach = $('#nx-binary-stream');
    if (breach) breach.textContent = genBinaryBlock(22, 10);
  }

  function cycleBinary(){
    setInterval(paintBinary, 1800);
  }

  /* ═══════════════════════════════════════════════════════
     GATES ACCORDION
     ═══════════════════════════════════════════════════════ */
  function initGates(){
    var gates = $$('.nx-gate');
    /* Wrap each panel's children inside a single .nx-gate-panel-content
       div so the CSS grid trick (grid-template-rows: 0fr → 1fr) works. */
    $$('.nx-gate-panel').forEach(function (panel) {
      if (panel.firstElementChild && panel.firstElementChild.classList.contains('nx-gate-panel-content')) return;
      var wrap = document.createElement('div');
      wrap.className = 'nx-gate-panel-content';
      while (panel.firstChild) wrap.appendChild(panel.firstChild);
      panel.appendChild(wrap);
    });

    gates.forEach(function (gate) {
      gate.addEventListener('click', function () {
        var key = gate.getAttribute('data-gate');
        var panel = document.querySelector('.nx-gate-panel[data-panel="' + key + '"]');
        var willOpen = !gate.classList.contains('is-open');

        /* Optional : close others (single-open accordion). */
        gates.forEach(function (g) {
          if (g === gate) return;
          g.classList.remove('is-open');
          var p = document.querySelector('.nx-gate-panel[data-panel="' + g.getAttribute('data-gate') + '"]');
          if (p) p.classList.remove('is-open');
        });

        gate.classList.toggle('is-open', willOpen);
        if (panel) panel.classList.toggle('is-open', willOpen);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════
     SETTINGS DRAWER (cog)
     ═══════════════════════════════════════════════════════ */
  function initDrawer(){
    var cog  = $('#nx-h-cog');
    var drw  = $('#nx-drawer');
    if (!cog || !drw) return;
    cog.addEventListener('click', function () { drw.hidden = false; });

    drw.addEventListener('click', function (e) {
      var t = e.target;
      if (t && (t.dataset.close !== undefined || t.classList.contains('nx-drawer-bg') || t.classList.contains('nx-drawer-close'))) {
        drw.hidden = true;
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drw.hidden) drw.hidden = true;
    });

    var skipBtn = $('#nx-skip-intro');
    if (skipBtn) skipBtn.addEventListener('click', function () {
      try { localStorage.setItem(SKIP_INTRO_KEY, '1'); } catch (e) {}
      toast('Intro Nexus désactivée pour les prochaines visites.');
    });
    var replayBtn = $('#nx-replay-intro');
    if (replayBtn) replayBtn.addEventListener('click', function () {
      try { localStorage.removeItem(SKIP_INTRO_KEY); } catch (e) {}
      location.reload();
    });
  }

  /* ═══════════════════════════════════════════════════════
     PARTICLES (subtle blue dust)
     ═══════════════════════════════════════════════════════ */
  function initParticles(){
    var c = $('#nx-particles');
    if (!c || !c.getContext) return;
    var ctx = c.getContext('2d');
    var w = c.width  = window.innerWidth;
    var h = c.height = window.innerHeight;
    var N = Math.min(80, Math.floor((w * h) / 22000));
    var dots = [];
    for (var i = 0; i < N; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.08 - Math.random() * 0.18,
        r: 0.6 + Math.random() * 1.6,
        a: 0.18 + Math.random() * 0.32,
        hue: Math.random() < 0.3 ? 'burgundy' : 'blue'
      });
    }
    window.addEventListener('resize', function () {
      w = c.width  = window.innerWidth;
      h = c.height = window.innerHeight;
    });

    function draw(){
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.vx;
        d.y += d.vy;
        if (d.y < -10) { d.y = h + 10; d.x = Math.random() * w; }
        if (d.x < -10 || d.x > w + 10) d.x = Math.random() * w;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        if (d.hue === 'burgundy') {
          ctx.fillStyle = 'rgba(180, 50, 80, ' + (d.a * 0.5) + ')';
        } else {
          ctx.fillStyle = 'rgba(120, 210, 255, ' + d.a + ')';
        }
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ═══════════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════════ */
  function toast(msg){
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);' +
      'padding:12px 22px;font-family:Rajdhani,sans-serif;font-weight:600;font-size:0.85rem;' +
      'letter-spacing:0.18em;text-transform:uppercase;' +
      'background:rgba(8,14,28,0.95);border:1px solid #6cc6ff;color:#a4dfff;' +
      'z-index:9500;box-shadow:0 10px 30px rgba(0,0,0,0.6);';
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 3500);
  }

  /* ═══════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════ */
  function init(){
    fillEventChip();
    paintBinary();
    initGates();
    initDrawer();
    initParticles();

    bootSequence().then(function () {
      animateScanAndLoad();
      cycleBinary();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

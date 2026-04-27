/* ═══════════════════════════════════════════════════════════════════════
   docs/js/jaharta-motion.js — Micro-interactions globales JahartaRP
   ═══════════════════════════════════════════════════════════════════════
   Inclure en fin de <body> APRÈS page-transition.js.
   Aucune dépendance — vanilla JS pur.

   CONTENU :
     1. Ripple         → lueur au clic sur éléments interactifs
     2. Reveal         → IntersectionObserver pour .jh-reveal → .revealed
     3. ScrollProgress → barre de progression de lecture (si .scroll-line présent)
     4. PressHint      → retour haptique CSS sur boutons/cards
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const PRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. RIPPLE ────────────────────────────────────────────────────────
     Injecte une onde radiale au clic. S'applique automatiquement aux
     éléments correspondant à RIPPLE_SEL ou portant la classe .jh-ripple.
     ─────────────────────────────────────────────────────────────────── */

  const RIPPLE_SEL = [
    'button:not([disabled]):not(.no-ripple)',
    'a.nav-cta',
    '.hero-cta',
    '.gacha-btn',
    '.hub-tab',
    '.inv-cat',
    '.rp-card',
    '.pnj-card',
    '.explore-card',
    '.lore-card',
    '.race-card',
    '.jh-ripple',
  ].join(',');

  function spawnRipple(e) {
    if (PRM) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const d = Math.max(rect.width, rect.height) * 1.4;
    const x = e.clientX - rect.left  - d / 2;
    const y = e.clientY - rect.top   - d / 2;

    const wave = document.createElement('span');
    wave.className = 'jh-ripple-wave';
    wave.style.cssText =
      'position:absolute;border-radius:50%;pointer-events:none;' +
      'width:' + d + 'px;height:' + d + 'px;' +
      'left:' + x + 'px;top:' + y + 'px;';

    /* Garantit un contexte de positionnement sans casser l'existing layout */
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    if (getComputedStyle(el).overflow === 'visible') el.style.overflow = 'hidden';

    el.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  }

  function attachRipple(el) {
    if (el._jhRipple) return;  /* évite les doublons */
    el._jhRipple = true;
    el.addEventListener('click', spawnRipple);
  }

  function initRipple() {
    document.querySelectorAll(RIPPLE_SEL).forEach(attachRipple);

    /* Observateur pour éléments injectés dynamiquement (Firestore, etc.) */
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches(RIPPLE_SEL)) attachRipple(node);
          if (node.querySelectorAll) {
            node.querySelectorAll(RIPPLE_SEL).forEach(attachRipple);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ── 2. REVEAL ────────────────────────────────────────────────────────
     IntersectionObserver : ajoute .revealed quand un .jh-reveal entre
     dans le viewport (threshold 12 %, marge basse −40 px).
     En prefers-reduced-motion : révèle tout immédiatement.
     ─────────────────────────────────────────────────────────────────── */

  function initReveal() {
    var els = document.querySelectorAll('.jh-reveal');
    if (!els.length) return;

    if (PRM) {
      els.forEach(function (el) { el.classList.add('revealed'); });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el) { obs.observe(el); });

    /* Observer les éléments ajoutés dynamiquement */
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('jh-reveal')) obs.observe(node);
          if (node.querySelectorAll) {
            node.querySelectorAll('.jh-reveal').forEach(function (el) { obs.observe(el); });
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ── 3. SCROLL PROGRESS ───────────────────────────────────────────────
     Met à jour la barre .scroll-line (si présente sur la page) en fonction
     de la position de scroll. Utilise RAF pour limiter les calculs.
     ─────────────────────────────────────────────────────────────────── */

  function initScrollProgress() {
    var line = document.querySelector('.scroll-line');
    if (!line) return;

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) { line.style.width = '0%'; return; }
        line.style.width = (window.scrollY / total * 100).toFixed(2) + '%';
      });
    }, { passive: true });
  }

  /* ── 4. PRESS HINT ────────────────────────────────────────────────────
     Applique la classe .jh-press aux boutons principaux qui n'ont pas
     encore de feedback visuel de pression (scale:0.95 au clic, CSS pur).
     ─────────────────────────────────────────────────────────────────── */

  const PRESS_SEL = [
    'button:not([disabled]):not(.no-press)',
    '.nav-cta',
    '.hero-cta',
    '.hub-tab',
    '.inv-cat',
    '.gacha-btn',
    '.jh-press',
  ].join(',');

  function initPress() {
    document.querySelectorAll(PRESS_SEL).forEach(function (el) {
      if (!el.classList.contains('jh-press')) el.classList.add('jh-press');
    });
  }

  /* ── INIT ─────────────────────────────────────────────────────────── */

  function boot() {
    initRipple();
    initReveal();
    initScrollProgress();
    if (!PRM) initPress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

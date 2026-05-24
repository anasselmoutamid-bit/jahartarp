/* ── Navbar Jaharta v6 — HUD Unified ── */
/* Logo · Discord · HUD Burger (always visible) · Full-screen HUD Menu */
(function () {
  var PAGES_NORMAL = [
    { href: 'index.html',          label: 'Accueil',   num: '01' },
    { href: 'nexus.html',          label: 'Nexus',     num: '02' },
    { href: 'fiches.html',         label: 'Fiches RP', num: '03' },
    { href: 'pnj.html',            label: 'PNJ',       num: '04' },
    { href: 'portail.html',        label: 'Portail',   num: '05' },
    { href: 'racesjouables.html',  label: 'Races',     num: '06' },
    { href: 'bestiaire.html',      label: 'Bestiaire', num: '07' },
    { href: 'lore.html',           label: 'Lore',      num: '08' },
    { href: 'gacha.html',          label: 'Gacha',     num: '09' },
    { href: 'casino.html',         label: 'Casino',    num: '10' }
  ];

  var PAGES_IRP = [
    { href: 'index-irp.html',  label: 'Accueil IRP', num: '01' },
    { href: 'fiches-irp.html', label: 'Fiches IRP',  num: '02' },
    { href: 'gacha-irp.html',  label: 'Gacha IRP',   num: '03' },
    { href: 'hub-irp.html',    label: 'Hub IRP',     num: '04' }
  ];

  var current = window.location.pathname.split('/').pop() || 'index.html';

  var DISCORD_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.863 19.863 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>';

  function getPages() {
    return localStorage.getItem('jaharta_irp_mode') === 'true' ? PAGES_IRP : PAGES_NORMAL;
  }

  function buildNav(pages) {
    var isIRP  = localStorage.getItem('jaharta_irp_mode') === 'true';
    var logoText = isIRP ? 'JAHARTA IRP' : 'JAHARTA';
    var logoHref = isIRP ? 'index-irp.html' : 'index.html';

    /* HUD menu links */
    var menuLinks = pages.map(function (p) {
      var cls = 'hm-link' + (p.href === current ? ' active' : '');
      return (
        '<a href="' + p.href + '" class="' + cls + '">' +
          '<span class="hm-idx">' + p.num + '</span>' +
          '<span class="hm-name">' + p.label + '</span>' +
          '<span class="hm-arrow">→</span>' +
        '</a>'
      );
    }).join('');

    if (isIRP) {
      menuLinks += (
        '<a href="index.html" class="hm-link hm-link--back" onclick="localStorage.removeItem(\'jaharta_irp_mode\')">' +
          '<span class="hm-idx" style="opacity:.4">↩</span>' +
          '<span class="hm-name" style="opacity:.45">Site Normal</span>' +
          '<span class="hm-arrow">→</span>' +
        '</a>'
      );
    }

    return (
      /* ── NAV BAR ── */
      '<nav class="nav" id="nav">' +
        '<a href="' + logoHref + '" class="nav-logo">' +
          '<img src="img/logo-jaharta.png" alt="Logo Jaharta" class="nav-logo-img">' +
          '<span class="nav-logo-text">' + logoText + '</span>' +
        '</a>' +
        '<div class="nav-spacer"></div>' +
        '<div class="nav-right">' +
          '<a href="https://discord.gg/Jaharta" class="nav-discord" target="_blank" rel="noopener" aria-label="Discord">' +
            DISCORD_ICON +
            '<span>Discord</span>' +
          '</a>' +
          '<button class="hud-burger" id="burger" aria-label="Menu" aria-expanded="false">' +
            '<span class="hb-c tl"></span>' +
            '<span class="hb-c tr"></span>' +
            '<span class="hb-c bl"></span>' +
            '<span class="hb-c br"></span>' +
            '<span class="hb-b"></span>' +
            '<span class="hb-b hb-b2"></span>' +
            '<span class="hb-b"></span>' +
          '</button>' +
        '</div>' +
      '</nav>' +

      /* ── HUD MENU ── */
      '<div class="hud-menu" id="mobile-menu">' +
        /* Corner brackets */
        '<div class="hm-corner tl"></div>' +
        '<div class="hm-corner tr"></div>' +
        '<div class="hm-corner bl"></div>' +
        '<div class="hm-corner br"></div>' +
        /* Header */
        '<div class="hm-head">' +
          '<div class="hm-sys">' +
            '<span class="hm-sys-dot"></span>' +
            'SYS::NAV_ACTIVE' +
          '</div>' +
          '<button class="hm-close" id="hm-close-btn" aria-label="Fermer">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        /* Neon sweep line */
        '<div class="hm-neon-line"></div>' +
        /* Navigation links */
        '<div class="hm-nav">' +
          '<div class="hm-nav-label">// NAVIGATION MATRIX</div>' +
          menuLinks +
        '</div>' +
        /* Footer */
        '<div class="hm-footer">' +
          '<a href="https://discord.gg/Jaharta" class="hm-discord" target="_blank" rel="noopener">' +
            DISCORD_ICON + '<span>DISCORD</span>' +
          '</a>' +
          '<span class="hm-version">JAHARTA · NEXUS</span>' +
        '</div>' +
      '</div>'
    );
  }

  /* ── Injection ── */
  var pages       = getPages();
  var html        = buildNav(pages);
  var placeholder = document.getElementById('jaharta-nav');
  if (placeholder) placeholder.outerHTML = html;

  /* ── Rebuild (appelée par irp-mode.js) ── */
  window._rebuildNav = function () {
    var nav = document.getElementById('nav');
    var mm  = document.getElementById('mobile-menu');
    if (!nav || !mm) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = buildNav(getPages());
    nav.replaceWith(tmp.querySelector('.nav'));
    mm.replaceWith(tmp.querySelector('.hud-menu'));
  };

  /* ── Open / Close helpers ── */
  function openMenu() {
    var burger = document.getElementById('burger');
    var mm     = document.getElementById('mobile-menu');
    if (!burger || !mm) return;
    mm.classList.add('open');
    burger.classList.add('active');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    var burger = document.getElementById('burger');
    var mm     = document.getElementById('mobile-menu');
    if (burger) { burger.classList.remove('active'); burger.setAttribute('aria-expanded', 'false'); }
    if (mm)     { mm.classList.remove('open'); }
    document.body.style.overflow = '';
  }

  /* ── Event delegation (survit aux rebuilds) ── */
  if (!window.__jhNavDelegated) {
    window.__jhNavDelegated = true;

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;

      /* Burger toggle */
      if (t.closest && t.closest('#burger')) {
        var mm = document.getElementById('mobile-menu');
        if (mm && mm.classList.contains('open')) closeMenu();
        else openMenu();
        return;
      }
      /* Close button */
      if (t.closest && t.closest('#hm-close-btn')) {
        closeMenu();
        return;
      }
      /* Click on a nav link inside the HUD menu */
      if (t.closest && t.closest('.hud-menu .hm-link')) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', function (e) {
      var mm = document.getElementById('mobile-menu');
      if (e.key === 'Escape' && mm && mm.classList.contains('open')) closeMenu();
    });
  }

  /* ── Scroll: .scrolled on nav ── */
  if (!window.__jhNavScroll) {
    window.__jhNavScroll = true;
    function onScroll() {
      var nav = document.getElementById('nav');
      if (!nav) return;
      if (window.scrollY > 30) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();

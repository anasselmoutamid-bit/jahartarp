/* ── Navbar partagée Jaharta v5 — Redesign HUD ── */
/* Logo · Divider · Links (active underline) · Discord CTA · Burger */
(function () {
  var PAGES_NORMAL = [
    { href: 'index.html',          label: 'Accueil',   short: 'Accueil',   num: '01' },
    { href: 'nexus.html',          label: 'Nexus',     short: 'Nexus',     num: '02' },
    { href: 'fiches.html',         label: 'Fiches RP', short: 'Fiches',    num: '03' },
    { href: 'pnj.html',            label: 'PNJ',       short: 'PNJ',       num: '04' },
    { href: 'portail.html',        label: 'Portail',   short: 'Portail',   num: '05' },
    { href: 'racesjouables.html',  label: 'Races',     short: 'Races',     num: '06' },
    { href: 'bestiaire.html',      label: 'Bestiaire', short: 'Bestiaire', num: '07' },
    { href: 'lore.html',           label: 'Lore',      short: 'Lore',      num: '08' },
    { href: 'gacha.html',          label: 'Gacha',     short: 'Gacha',     num: '09' },
    { href: 'casino.html',         label: 'Casino',    short: 'Casino',    num: '10' }
  ];

  var PAGES_IRP = [
    { href: 'index-irp.html',  label: 'Accueil IRP', short: 'Accueil', num: '01' },
    { href: 'fiches-irp.html', label: 'Fiches IRP',  short: 'Fiches',  num: '02' },
    { href: 'gacha-irp.html',  label: 'Gacha IRP',   short: 'Gacha',   num: '03' },
    { href: 'hub-irp.html',    label: 'Hub IRP',     short: 'Hub',     num: '04' }
  ];

  var current = window.location.pathname.split('/').pop() || 'index.html';

  var DISCORD_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.863 19.863 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>';

  function getPages() {
    return localStorage.getItem('jaharta_irp_mode') === 'true' ? PAGES_IRP : PAGES_NORMAL;
  }

  function buildNav(pages) {
    var isIRP = localStorage.getItem('jaharta_irp_mode') === 'true';
    var logoText = isIRP ? 'JAHARTA IRP' : 'JAHARTA';
    var logoHref = isIRP ? 'index-irp.html' : 'index.html';

    /* ── Desktop links ── */
    var navLinks = pages.map(function (p) {
      var cls = 'nav-link' + (p.href === current ? ' active' : '');
      return '<a href="' + p.href + '" class="' + cls + '">' + p.label + '</a>';
    }).join('');

    if (isIRP) {
      navLinks += '<a href="index.html" class="nav-link nav-link--back" onclick="localStorage.removeItem(\'jaharta_irp_mode\')">↩ Normal</a>';
    }

    /* ── Mobile menu links ── */
    var menuLinks = pages.map(function (p) {
      var cls = 'menu-link' + (p.href === current ? ' active' : '');
      return '<a href="' + p.href + '" class="' + cls + '">' +
        '<span class="menu-link-index">' + p.num + '</span>' +
        '<span class="menu-link-text">' + p.short + '</span>' +
        '<span class="menu-link-arrow">→</span>' +
        '</a>';
    }).join('');

    if (isIRP) {
      menuLinks += '<a href="index.html" class="menu-link menu-link--back" onclick="localStorage.removeItem(\'jaharta_irp_mode\')" style="opacity:.55;border-top:1px solid rgba(220,20,60,0.15);margin-top:8px;padding-top:12px">' +
        '<span class="menu-link-index">↩</span>' +
        '<span class="menu-link-text">Site Normal</span>' +
        '<span class="menu-link-arrow">→</span>' +
        '</a>';
    }

    return (
      '<nav class="nav" id="nav">' +
        /* LEFT: logo + divider */
        '<div class="nav-left">' +
          '<a href="' + logoHref + '" class="nav-logo">' +
            '<img src="img/logo-jaharta.png" alt="Logo Jaharta" class="nav-logo-img">' +
            '<span class="nav-logo-text">' + logoText + '</span>' +
          '</a>' +
          '<div class="nav-logo-div"></div>' +
        '</div>' +
        /* CENTER: links */
        '<div class="nav-links" id="nav-links">' + navLinks + '</div>' +
        /* RIGHT: Discord + burger */
        '<div class="nav-right">' +
          '<a href="https://discord.gg/Jaharta" class="nav-discord" target="_blank" rel="noopener" aria-label="Discord">' +
            DISCORD_ICON +
            '<span>Discord</span>' +
          '</a>' +
          '<button class="burger" id="burger" aria-label="Menu" aria-expanded="false">' +
            '<span class="burger-line"></span>' +
            '<span class="burger-line"></span>' +
            '<span class="burger-line"></span>' +
          '</button>' +
        '</div>' +
      '</nav>' +
      '<div class="mobile-menu" id="mobile-menu">' +
        '<div class="menu-inner">' +
          '<div class="menu-header-label">// NAVIGATION</div>' +
          menuLinks +
          '<a href="https://discord.gg/Jaharta" class="menu-discord-link" target="_blank" rel="noopener">' +
            DISCORD_ICON + ' Discord' +
          '</a>' +
        '</div>' +
        '<div class="menu-deco"></div>' +
      '</div>'
    );
  }

  /* ── Injection initiale ── */
  var pages = getPages();
  var html  = buildNav(pages);
  var placeholder = document.getElementById('jaharta-nav');
  if (placeholder) placeholder.outerHTML = html;

  /* ── Rebuild (appelée par irp-mode.js quand le mode change) ── */
  window._rebuildNav = function () {
    var nav = document.getElementById('nav');
    var mm  = document.getElementById('mobile-menu');
    if (!nav || !mm) return;
    var newHtml = buildNav(getPages());
    var tmp = document.createElement('div');
    tmp.innerHTML = newHtml;
    nav.replaceWith(tmp.querySelector('.nav'));
    mm.replaceWith(tmp.querySelector('.mobile-menu'));
  };

  /* ── Burger — event-delegation (survit aux rebuilds) ── */
  function closeMenu() {
    var burger = document.getElementById('burger');
    var mm = document.getElementById('mobile-menu');
    if (burger) { burger.classList.remove('active'); burger.setAttribute('aria-expanded','false'); }
    if (mm) mm.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (!window.__jhNavDelegated) {
    window.__jhNavDelegated = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.closest && t.closest('#burger')) {
        var burger = document.getElementById('burger');
        var mm = document.getElementById('mobile-menu');
        if (!burger || !mm) return;
        var isOpen = burger.classList.toggle('active');
        mm.classList.toggle('open');
        burger.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return;
      }
      if (t.closest && t.closest('#mobile-menu .menu-link')) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      var mm = document.getElementById('mobile-menu');
      if (e.key === 'Escape' && mm && mm.classList.contains('open')) closeMenu();
    });
  }

  /* ── Scroll: add .scrolled class ── */
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

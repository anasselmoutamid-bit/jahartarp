/* ── Navbar partagée Jaharta ── */
/* Injecte nav + mobile-menu, détecte la page active, init le burger */
/* Supporte le mode IRP : nav réduite (Index, Fiches, PNJ, Bestiaire, Gacha, Hub) */
(function () {
  var PAGES_NORMAL = [
    { href: 'index.html',          label: 'Accueil',   short: 'Accueil',  num: '01' },
    { href: 'fiches.html',         label: 'Fiches RP', short: 'Fiches',   num: '02' },
    { href: 'pnj.html',            label: 'PNJ',       short: 'PNJ',      num: '03' },
    { href: 'portail.html',        label: 'Portail',   short: 'Portail',  num: '04' },
    { href: 'racesjouables.html',  label: 'Races',     short: 'Races',    num: '05' },
    { href: 'bestiaire.html',      label: 'Bestiaire', short: 'Bestiaire',num: '06' },
    { href: 'lore.html',           label: 'Lore',      short: 'Lore',     num: '07' },
    { href: 'gacha.html',          label: 'Gacha',     short: 'Gacha',    num: '08' },
    { href: 'hub.html',            label: 'Hub',       short: 'Hub',      num: '09' },
    { href: 'casino.html',         label: 'Casino',    short: 'Casino',   num: '10' }
  ];

  var PAGES_IRP = [
    { href: 'index-irp.html',      label: 'Accueil IRP',    short: 'Accueil',    num: '01' },
    { href: 'fiches-irp.html',      label: 'Fiches IRP',     short: 'Fiches',     num: '02' },
    { href: 'gacha-irp.html',      label: 'Gacha IRP',      short: 'Gacha',      num: '03' },
    { href: 'hub-irp.html',        label: 'Hub IRP',        short: 'Hub',        num: '04' }
  ];

  var current = window.location.pathname.split('/').pop() || 'index.html';

  function getPages() {
    return localStorage.getItem('jaharta_irp_mode') === 'true' ? PAGES_IRP : PAGES_NORMAL;
  }

  function buildNav(pages) {
    var isIRP = localStorage.getItem('jaharta_irp_mode') === 'true';
    var logoText = isIRP ? 'JAHARTA IRP' : 'JAHARTA';
    var logoHref = isIRP ? 'index-irp.html' : 'index.html';

    var navLinks = pages.map(function (p) {
      var active = p.href === current ? ' class="active"' : '';
      return '<a href="' + p.href + '"' + active + '>' + p.label + '</a>';
    }).join('');

    // Ajouter lien retour au site normal si on est en IRP
    var returnLink = '';
    var returnMenuLink = '';
    if (isIRP) {
      returnLink = '<a href="index.html" onclick="localStorage.removeItem(\'jaharta_irp_mode\')" style="opacity:.55;font-size:.6rem">\u21A9 Site Normal</a>';
      returnMenuLink = '<a href="index.html" class="menu-link" onclick="localStorage.removeItem(\'jaharta_irp_mode\')" style="opacity:.5;border-top:1px solid rgba(220,20,60,0.15);margin-top:8px;padding-top:12px">' +
        '<span class="menu-link-index">\u21A9</span>' +
        '<span class="menu-link-text">Site Normal</span>' +
        '<span class="menu-link-arrow">\u2192</span>' +
        '</a>';
    }

    var menuLinks = pages.map(function (p) {
      var cls = 'menu-link' + (p.href === current ? ' active' : '');
      return '<a href="' + p.href + '" class="' + cls + '">' +
        '<span class="menu-link-index">' + p.num + '</span>' +
        '<span class="menu-link-text">' + p.short + '</span>' +
        '<span class="menu-link-arrow">\u2192</span>' +
        '</a>';
    }).join('');

    return '<nav class="nav" id="nav">' +
        '<a href="' + logoHref + '" class="nav-logo">' +
          '<img src="img/logo-jaharta.png" alt="Logo Jaharta">' + logoText +
        '</a>' +
        '<div class="nav-links" id="nav-links">' + navLinks + returnLink + '</div>' +
        '<button class="burger" id="burger" aria-label="Menu" aria-expanded="false">' +
          '<span class="burger-line"></span>' +
          '<span class="burger-line"></span>' +
          '<span class="burger-line"></span>' +
        '</button>' +
      '</nav>' +
      '<div class="mobile-menu" id="mobile-menu">' +
        '<div class="menu-inner">' +
          '<div class="menu-header-label">// NAVIGATION</div>' +
          menuLinks + returnMenuLink +
        '</div>' +
        '<div class="menu-deco"></div>' +
      '</div>';
  }

  /* ── Injection initiale ── */
  var pages = getPages();
  var html = buildNav(pages);
  var placeholder = document.getElementById('jaharta-nav');
  if (placeholder) placeholder.outerHTML = html;

  /* ── Rebuild (appelée par irp-mode.js quand le mode change) ── */
  window._rebuildNav = function () {
    var nav = document.getElementById('nav');
    var mm = document.getElementById('mobile-menu');
    if (!nav || !mm) return;
    var newPages = getPages();
    var newHtml = buildNav(newPages);
    var tmp = document.createElement('div');
    tmp.innerHTML = newHtml;
    nav.replaceWith(tmp.querySelector('.nav'));
    mm.replaceWith(tmp.querySelector('.mobile-menu'));
    initBurger();
  };

  /* ── Burger init ── */
  function initBurger() {
    var burger = document.getElementById('burger');
    var mm = document.getElementById('mobile-menu');
    if (!burger || !mm) return;

    burger.addEventListener('click', function () {
      var isOpen = burger.classList.toggle('active');
      mm.classList.toggle('open');
      burger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mm.querySelectorAll('.menu-link').forEach(function (link) {
      link.addEventListener('click', function () {
        burger.classList.remove('active');
        mm.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mm.classList.contains('open')) {
        burger.classList.remove('active');
        mm.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBurger);
  } else {
    initBurger();
  }
})();

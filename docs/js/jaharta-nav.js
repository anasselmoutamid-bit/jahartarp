/* ── Navbar Jaharta v6 — HUD Unified ── */
/* Auto-injects its own CSS · Works on any page regardless of stylesheet */
(function () {

  /* ════════════════════════════════════════════════════════════
     CSS SELF-INJECTION
     The nav is self-contained — no dependency on jaharta.css.
     Guard: skip if already injected (e.g. jaharta.css loaded it).
     We check by testing a computed property on a dummy element.
  ════════════════════════════════════════════════════════════ */
  if (!document.getElementById('jh-nav-style')) {
    var _s = document.createElement('style');
    _s.id = 'jh-nav-style';
    _s.textContent = [
      /* ── Nav shell ── */
      '.nav{position:fixed;top:0;left:0;right:0;z-index:1000;height:64px;padding:0 clamp(1.2rem,3vw,2.5rem);display:flex;align-items:center;background:rgba(2,7,19,0);transition:background .4s,backdrop-filter .4s}',
      ".nav::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(77,163,255,.18) 30%,rgba(139,92,246,.18) 70%,transparent);opacity:0;transition:opacity .4s}",
      '.nav.scrolled{background:rgba(2,7,19,.92);backdrop-filter:blur(24px) saturate(1.4)}',
      '.nav.scrolled::after{opacity:1}',
      /* ── Logo ── */
      '.nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff;transition:opacity .25s;flex-shrink:0}',
      '.nav-logo:hover{opacity:.85}',
      '.nav-logo-img{width:28px;height:28px;object-fit:contain;flex-shrink:0}',
      ".nav-logo-text{font-family:'Orbitron',sans-serif;font-size:1rem;font-weight:400;letter-spacing:.26em;white-space:nowrap}",
      /* ── Spacer & right zone ── */
      '.nav-spacer{flex:1}',
      '.nav-right{display:flex;align-items:center;gap:10px;flex-shrink:0}',
      /* ── Discord btn ── */
      '.nav-discord{display:inline-flex;align-items:center;gap:7px;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;color:#c8d4e8;padding:6px 14px;border:1px solid rgba(88,101,242,.3);border-radius:5px;background:rgba(88,101,242,.06);transition:color .25s,border-color .25s,background .25s,box-shadow .25s}',
      '.nav-discord:hover{color:#fff;border-color:rgba(88,101,242,.7);background:rgba(88,101,242,.14);box-shadow:0 0 18px rgba(88,101,242,.25)}',
      '.nav-discord svg{flex-shrink:0}',
      '.nav-discord span{display:none}',
      '@media(min-width:960px){.nav-discord span{display:inline}}',
      '@media(max-width:480px){.nav-discord{display:none}}',
      /* ── HUD Burger ── */
      '.hud-burger{position:relative;width:44px;height:44px;background:rgba(77,163,255,.04);border:1px solid rgba(77,163,255,.14);border-radius:4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4.5px;padding:0;transition:background .3s,border-color .3s,box-shadow .3s;flex-shrink:0;z-index:1001}',
      '.hud-burger:hover{background:rgba(77,163,255,.1);border-color:rgba(77,163,255,.38);box-shadow:0 0 16px rgba(77,163,255,.2),inset 0 0 8px rgba(77,163,255,.04)}',
      '.hud-burger.active{background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.45);box-shadow:0 0 20px rgba(139,92,246,.25)}',
      /* Corner brackets on burger */
      '.hb-c{position:absolute;width:9px;height:9px;pointer-events:none}',
      ".hb-c::before,.hb-c::after{content:'';position:absolute;background:rgba(77,163,255,.55);transition:background .3s}",
      '.hb-c::before{width:1.5px;height:100%}',
      '.hb-c::after{width:100%;height:1.5px}',
      '.hb-c.tl{top:4px;left:4px}',
      '.hb-c.tl::before{top:0;left:0}.hb-c.tl::after{top:0;left:0}',
      '.hb-c.tr{top:4px;right:4px}',
      '.hb-c.tr::before{top:0;right:0;left:auto}.hb-c.tr::after{top:0;right:0;left:auto}',
      '.hb-c.bl{bottom:4px;left:4px}',
      '.hb-c.bl::before{bottom:0;top:auto;left:0}.hb-c.bl::after{bottom:0;top:auto;left:0}',
      '.hb-c.br{bottom:4px;right:4px}',
      '.hb-c.br::before{bottom:0;top:auto;right:0;left:auto}.hb-c.br::after{bottom:0;top:auto;right:0;left:auto}',
      '.hud-burger:hover .hb-c::before,.hud-burger:hover .hb-c::after{background:rgba(77,163,255,.9)}',
      '.hud-burger.active .hb-c::before,.hud-burger.active .hb-c::after{background:rgba(139,92,246,.8)}',
      /* Bars */
      '.hb-b{display:block;width:18px;height:1.5px;border-radius:1px;background:rgba(200,212,232,.65);transition:transform .4s cubic-bezier(.16,1,.3,1),opacity .4s,width .4s cubic-bezier(.16,1,.3,1),background .3s;transform-origin:center;position:relative;z-index:1}',
      '.hb-b2{width:11px}',
      '.hud-burger.active .hb-b:nth-child(5){transform:translateY(6px) rotate(45deg);background:#fff;width:18px}',
      '.hud-burger.active .hb-b:nth-child(6){opacity:0;transform:scaleX(0)}',
      '.hud-burger.active .hb-b:nth-child(7){transform:translateY(-6px) rotate(-45deg);background:#fff;width:18px}',
      /* ── HUD Menu overlay ── */
      '.hud-menu{position:fixed;inset:0;z-index:999;background:rgba(2,7,19,.97);backdrop-filter:blur(40px);display:flex;flex-direction:column;opacity:0;visibility:hidden;transition:opacity .4s cubic-bezier(.16,1,.3,1),visibility .4s;overflow:hidden}',
      ".hud-menu::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(77,163,255,.01) 3px,rgba(77,163,255,.01) 4px)}",
      ".hud-menu::after{content:'';position:absolute;top:0;left:0;width:1px;height:0%;background:linear-gradient(to bottom,transparent,rgba(77,163,255,.5) 20%,rgba(139,92,246,.4) 80%,transparent);z-index:1;transition:height .65s .05s cubic-bezier(.16,1,.3,1)}",
      '.hud-menu.open{opacity:1;visibility:visible}',
      '.hud-menu.open::after{height:100%}',
      /* Corner brackets on menu */
      '.hm-corner{position:absolute;width:22px;height:22px;z-index:2;pointer-events:none;opacity:0;transition:opacity .3s .3s}',
      '.hud-menu.open .hm-corner{opacity:1}',
      ".hm-corner::before,.hm-corner::after{content:'';position:absolute;background:rgba(77,163,255,.28)}",
      '.hm-corner::before{width:1.5px;height:100%}',
      '.hm-corner::after{width:100%;height:1.5px}',
      '.hm-corner.tl{top:14px;left:14px}',
      '.hm-corner.tl::before{top:0;left:0}.hm-corner.tl::after{top:0;left:0}',
      '.hm-corner.tr{top:14px;right:14px}',
      '.hm-corner.tr::before{top:0;right:0;left:auto}.hm-corner.tr::after{top:0;right:0;left:auto}',
      '.hm-corner.bl{bottom:14px;left:14px}',
      '.hm-corner.bl::before{bottom:0;top:auto;left:0}.hm-corner.bl::after{bottom:0;top:auto;left:0}',
      '.hm-corner.br{bottom:14px;right:14px}',
      '.hm-corner.br::before{bottom:0;top:auto;right:0;left:auto}.hm-corner.br::after{bottom:0;top:auto;right:0;left:auto}',
      /* Menu header */
      '.hm-head{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(2rem,6vw,5rem);height:64px;border-bottom:1px solid rgba(77,163,255,.07);flex-shrink:0}',
      ".hm-sys{display:flex;align-items:center;gap:8px;font-family:'Share Tech Mono',monospace;font-size:.44rem;letter-spacing:.4em;color:rgba(77,163,255,.4);text-transform:uppercase}",
      '.hm-sys-dot{width:5px;height:5px;border-radius:50%;background:#44ff88;box-shadow:0 0 7px #44ff88;animation:hmBlink 2s infinite;flex-shrink:0}',
      '@keyframes hmBlink{0%,100%{opacity:1}50%{opacity:.15}}',
      '.hm-close{display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:transparent;border:1px solid rgba(255,255,255,.08);border-radius:3px;cursor:pointer;color:rgba(200,212,232,.4);transition:color .2s,border-color .2s,background .2s}',
      '.hm-close:hover{color:#ff006e;border-color:rgba(255,0,110,.4);background:rgba(255,0,110,.06)}',
      /* Neon sweep line */
      '.hm-neon-line{width:0%;height:1px;flex-shrink:0;background:linear-gradient(90deg,rgba(77,163,255,.7) 0%,rgba(139,92,246,.4) 60%,transparent 100%);transition:width .85s .12s cubic-bezier(.16,1,.3,1);position:relative;z-index:2}',
      '.hud-menu.open .hm-neon-line{width:100%}',
      /* Nav links container */
      '.hm-nav{flex:1;position:relative;z-index:2;display:flex;flex-direction:column;justify-content:center;padding:2rem clamp(2rem,6vw,5rem);overflow:hidden}',
      ".hm-nav-label{font-family:'Share Tech Mono',monospace;font-size:.42rem;letter-spacing:.5em;color:rgba(77,163,255,.22);text-transform:uppercase;margin-bottom:1rem}",
      /* Link rows */
      '.hm-link{display:flex;align-items:center;gap:20px;text-decoration:none;padding:10px 0;border-bottom:1px solid rgba(77,163,255,.04);transform:translateX(-60px);opacity:0;transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .5s,border-color .3s;position:relative;overflow:hidden;cursor:pointer}',
      '.hud-menu.open .hm-link{transform:translateX(0);opacity:1}',
      '.hud-menu.open .hm-link:nth-child(1){transition-delay:.12s}',
      '.hud-menu.open .hm-link:nth-child(2){transition-delay:.17s}',
      '.hud-menu.open .hm-link:nth-child(3){transition-delay:.22s}',
      '.hud-menu.open .hm-link:nth-child(4){transition-delay:.27s}',
      '.hud-menu.open .hm-link:nth-child(5){transition-delay:.32s}',
      '.hud-menu.open .hm-link:nth-child(6){transition-delay:.37s}',
      '.hud-menu.open .hm-link:nth-child(7){transition-delay:.42s}',
      '.hud-menu.open .hm-link:nth-child(8){transition-delay:.47s}',
      '.hud-menu.open .hm-link:nth-child(9){transition-delay:.52s}',
      '.hud-menu.open .hm-link:nth-child(10){transition-delay:.57s}',
      '.hm-link:hover{border-bottom-color:rgba(77,163,255,.12)}',
      ".hm-link::after{content:'';position:absolute;inset:0;background:rgba(77,163,255,.04);transform:scaleX(0);transform-origin:left;transition:transform .3s cubic-bezier(.16,1,.3,1)}",
      '.hm-link:hover::after{transform:scaleX(1)}',
      ".hm-idx{font-family:'Share Tech Mono',monospace;font-size:.44rem;letter-spacing:.2em;color:rgba(77,163,255,.25);min-width:22px;transition:color .3s;position:relative;z-index:1}",
      '.hm-link:hover .hm-idx,.hm-link.active .hm-idx{color:rgba(77,163,255,.65)}',
      ".hm-name{font-family:'Orbitron',sans-serif;font-size:clamp(.95rem,2.5vw,1.35rem);font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:rgba(200,212,232,.62);transition:color .3s;position:relative;z-index:1}",
      '.hm-link:hover .hm-name{color:#fff}',
      '.hm-link.active .hm-name{background:linear-gradient(90deg,#4DA3FF,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}',
      ".hm-arrow{margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:.65rem;color:rgba(77,163,255,.2);transition:color .3s,transform .3s;position:relative;z-index:1}",
      '.hm-link:hover .hm-arrow{color:#4DA3FF;transform:translateX(5px)}',
      '.hm-link.active .hm-arrow{color:#8B5CF6}',
      /* Footer */
      '.hm-footer{position:relative;z-index:2;padding:1.2rem clamp(2rem,6vw,5rem);border-top:1px solid rgba(77,163,255,.06);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-shrink:0}',
      ".hm-discord{display:inline-flex;align-items:center;gap:8px;font-family:'Share Tech Mono',monospace;font-size:.48rem;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;color:rgba(200,212,232,.4);transition:color .3s}",
      '.hm-discord:hover{color:#fff}',
      '.hm-discord svg{flex-shrink:0}',
      ".hm-version{font-family:'Share Tech Mono',monospace;font-size:.38rem;letter-spacing:.18em;color:rgba(77,163,255,.18);text-transform:uppercase}"
    ].join('\n');
    document.head.appendChild(_s);
  }

  /* ════════════════════════════════════════════════════════════
     PAGE DEFINITIONS
  ════════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════════ */
  function getPages() {
    return localStorage.getItem('jaharta_irp_mode') === 'true' ? PAGES_IRP : PAGES_NORMAL;
  }

  /* ════════════════════════════════════════════════════════════
     BUILD NAV HTML
  ════════════════════════════════════════════════════════════ */
  function buildNav(pages) {
    var isIRP    = localStorage.getItem('jaharta_irp_mode') === 'true';
    var logoText = isIRP ? 'JAHARTA IRP' : 'JAHARTA';
    var logoHref = isIRP ? 'index-irp.html' : 'index.html';

    /* HUD menu link rows */
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
      '<div class="hud-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation">' +
        '<div class="hm-corner tl"></div>' +
        '<div class="hm-corner tr"></div>' +
        '<div class="hm-corner bl"></div>' +
        '<div class="hm-corner br"></div>' +
        '<div class="hm-head">' +
          '<div class="hm-sys">' +
            '<span class="hm-sys-dot"></span>' +
            'SYS::NAV_ACTIVE' +
          '</div>' +
          '<button class="hm-close" id="hm-close-btn" aria-label="Fermer le menu">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="hm-neon-line"></div>' +
        '<div class="hm-nav">' +
          '<div class="hm-nav-label">// NAVIGATION MATRIX</div>' +
          menuLinks +
        '</div>' +
        '<div class="hm-footer">' +
          '<a href="https://discord.gg/Jaharta" class="hm-discord" target="_blank" rel="noopener">' +
            DISCORD_ICON + '<span>DISCORD</span>' +
          '</a>' +
          '<span class="hm-version">JAHARTA · NEXUS</span>' +
        '</div>' +
      '</div>'
    );
  }

  /* ════════════════════════════════════════════════════════════
     INJECTION
  ════════════════════════════════════════════════════════════ */
  var pages       = getPages();
  var html        = buildNav(pages);
  var placeholder = document.getElementById('jaharta-nav');
  if (placeholder) placeholder.outerHTML = html;

  /* ════════════════════════════════════════════════════════════
     REBUILD (called by irp-mode.js after toggling IRP mode)
  ════════════════════════════════════════════════════════════ */
  window._rebuildNav = function () {
    var nav = document.getElementById('nav');
    var mm  = document.getElementById('mobile-menu');
    if (!nav || !mm) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = buildNav(getPages());
    nav.replaceWith(tmp.querySelector('.nav'));
    mm.replaceWith(tmp.querySelector('.hud-menu'));
  };

  /* ════════════════════════════════════════════════════════════
     OPEN / CLOSE
  ════════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════════
     EVENT DELEGATION
     Single listener on document — survives rebuilds.
     Guard prevents duplicate listeners across page re-inits.
  ════════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════════
     SCROLL — add .scrolled to nav
  ════════════════════════════════════════════════════════════ */
  if (!window.__jhNavScroll) {
    window.__jhNavScroll = true;

    function onScroll() {
      var nav = document.getElementById('nav');
      if (!nav) return;
      if (window.scrollY > 30) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); /* run immediately for pages loaded mid-scroll */
  }

})();

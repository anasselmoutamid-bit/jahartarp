/* ── IRP Mode — Système d'accès secret au mode IRP ── */
/* Gère : code d'accès, thème violine/écarlate, chargement des données IRP */
(function () {
  'use strict';

  var IRP_CODE = 'JAHARTA02irp';
  var STORAGE_KEY = 'jaharta_irp_mode';

  /* ── State ── */
  /* IRP mode: set by force-script on dedicated IRP pages, or read here */
  var _isIRPPage = /irp\.html/.test(location.pathname);
  if (!window._irpMode) window._irpMode = _isIRPPage;

  /* ── CSS du mode IRP (injecté dynamiquement) ── */
  var IRP_THEME_CSS = [
    /* ── Palette complète IRP : violine / rouge écarlate / violet sombre ── */
    ':root.irp-mode {',
    /* Fonds — tons sombres violacés */
    '  --bg:       #0a0410;',        /* fond principal — violet très sombre */
    '  --bg2:      #100818;',        /* fond secondaire */
    '  --surface:  #1a0c28;',        /* surface carte */
    '  --surface2: #140a20;',        /* surface secondaire */
    '  --border:   rgba(220,20,60,0.12);',
    /* Accents — tout en rouge/violine/violet */
    '  --cyan:     #dc143c;',        /* Scarlet (remplace cyan partout) */
    '  --blue:     #8B008B;',        /* Violine */
    '  --violet:   #800020;',        /* Burgundy */
    '  --magenta:  #dc143c;',        /* Scarlet */
    '  --purple:   #6A0DAD;',        /* Violet profond */
    '  --gold:     #c41e3a;',        /* Cardinal */
    '  --green:    #cc3366;',        /* Rose foncé (remplace vert) */
    '  --orange:   #b8336a;',        /* Mauve-rose */
    '  --red:      #ff1744;',        /* Rouge vif */
    /* RGB channels */
    '  --cyan-rgb:       220,20,60;',
    '  --blue-rgb:       139,0,139;',
    '  --violet-rgb:     128,0,32;',
    '  --red-rgb:        255,23,68;',
    '  --green-rgb:      204,51,102;',
    '  --gold-rgb:       196,30,58;',
    '  --surface-dk-rgb: 20,10,32;',
    '  --bg-dk-rgb:      10,4,16;',
    /* Lueurs — tout en rouge/violine */
    '  --cyan-dim:    #8B0000;',
    '  --cyan-glow:   rgba(220,20,60,0.38);',
    '  --violet-glow: rgba(139,0,139,0.3);',
    '  --glow-sm:     0 0 8px rgba(220,20,60,0.38);',
    '  --glow-md:     0 0 20px rgba(220,20,60,0.38), 0 0 40px rgba(139,0,139,0.15);',
    '  --glow-lg:     0 0 30px rgba(220,20,60,0.35), 0 0 80px rgba(139,0,139,0.1), 0 0 120px rgba(106,13,173,0.06);',
    '  --glow-violet: 0 0 20px rgba(139,0,139,0.3), 0 0 50px rgba(106,13,173,0.1);',
    '  --glow-blue:   rgba(220,20,60,0.35);',
    '  --glow-gold:   rgba(139,0,139,0.4);',
    /* Texte — légèrement rosé */
    '  --text:  #e8dce6;',
    '  --text2: #8a7090;',
    '  --text3: #4a3060;',
    '  --muted: #6a4070;',
    '}',
    /* Background html & body */
    '.irp-mode, .irp-mode body { background: #0a0410 !important; }',
    'html.irp-mode { background: #0a0410 !important; }',
    /* Scrollbar */
    '.irp-mode body { scrollbar-color: #8B0000 #0a0410; }',
    '.irp-mode ::-webkit-scrollbar-track { background: #100818; }',
    '.irp-mode ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #8B0000, #6A0DAD); }',
    '.irp-mode ::-webkit-scrollbar-thumb:hover { box-shadow: 0 0 6px rgba(220,20,60,0.38); }',
    /* Nav */
    '.irp-mode .nav { background: rgba(10,4,16,0.92) !important; border-bottom-color: rgba(220,20,60,0.1) !important; }',
    '.irp-mode .nav-links a { color: #8a7090 !important; }',
    '.irp-mode .nav-links a:hover, .irp-mode .nav-links a.active { color: #dc143c !important; }',
    '.irp-mode .nav-logo { color: #dc143c !important; }',
    '.irp-mode .nav-logo img { filter: hue-rotate(280deg) saturate(1.5) brightness(0.9); }',
    /* Burger / mobile menu */
    '.irp-mode .burger { background: rgba(220,20,60,0.06) !important; border-color: rgba(220,20,60,0.15) !important; }',
    '.irp-mode .burger-line { background: #dc143c !important; }',
    '.irp-mode .mobile-menu { background: rgba(10,4,16,0.97) !important; }',
    '.irp-mode .menu-link { color: #8a7090 !important; border-bottom-color: rgba(220,20,60,0.08) !important; }',
    '.irp-mode .menu-link:hover, .irp-mode .menu-link.active { color: #dc143c !important; }',
    '.irp-mode .menu-link-index { color: #dc143c !important; }',
    /* Footer */
    '.irp-mode .footer { border-top-color: rgba(220,20,60,0.08) !important; }',
    '.irp-mode .footer-brand { color: #dc143c !important; }',
    '.irp-mode .footer-links a { color: #8a7090 !important; }',
    '.irp-mode .footer-links a:hover { color: #dc143c !important; }',
    '.irp-mode .footer-copy { color: #4a3060 !important; }',
    /* Titres et textes — couleur fixe pour éviter le flou du text-fill transparent */
    '.irp-mode .hero-title,',
    '.irp-mode .hero-title em,',
    '.irp-mode .section-title,',
    '.irp-mode .glitch-title,',
    '.irp-mode .sh-title,',
    '.irp-mode .gate-logo,',
    '.irp-mode .footer-brand {',
    '  color: #dc143c !important;',
    '  -webkit-text-fill-color: #dc143c !important;',
    '  background: none !important;',
    '  background-clip: unset !important;',
    '  -webkit-background-clip: unset !important;',
    '  text-shadow: 0 0 14px rgba(220,20,60,0.18);',
    '}',

    /* ── VRAI GLITCH IRP : distorsion agressive ── */
    '.irp-mode .hero-title,',
    '.irp-mode .glitch-title,',
    '.irp-mode .sh-title,',
    '.irp-mode .ph-title,',
    '.irp-mode .gate-logo,',
    '.irp-mode .nav-logo {',
    '  position: relative;',
    '  animation: irpGlitchBase 6s infinite;',
    '}',

    '.irp-mode .hero-title::before,',
    '.irp-mode .glitch-title::before,',
    '.irp-mode .sh-title::before,',
    '.irp-mode .ph-title::before {',
    '  content: attr(data-text) !important;',
    '  position: absolute !important;',
    '  top: 0; left: 0;',
    '  width: 100%; height: 100%;',
    '  color: #dc143c !important;',
    '  -webkit-text-fill-color: #dc143c !important;',
    '  background: none !important;',
    '  clip-path: inset(0 0 65% 0);',
    '  animation: irpGlitchTop 3s infinite linear alternate-reverse;',
    '  text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff;',
    '  opacity: 0.85;',
    '  pointer-events: none;',
    '}',

    '.irp-mode .hero-title::after,',
    '.irp-mode .glitch-title::after,',
    '.irp-mode .sh-title::after,',
    '.irp-mode .ph-title::after {',
    '  content: attr(data-text) !important;',
    '  position: absolute !important;',
    '  top: 0; left: 0;',
    '  width: 100%; height: 100%;',
    '  color: #dc143c !important;',
    '  -webkit-text-fill-color: #dc143c !important;',
    '  background: none !important;',
    '  clip-path: inset(65% 0 0 0);',
    '  animation: irpGlitchBottom 2.5s infinite linear alternate-reverse;',
    '  text-shadow: 3px 0 #ff00ff, -3px 0 #00ffff;',
    '  opacity: 0.85;',
    '  pointer-events: none;',
    '}',

    '@keyframes irpGlitchBase {',
    '  0%, 87%, 100% { transform: translate(0); filter: none; }',
    '  88% { transform: translate(-2px, 1px) skewX(-0.5deg); filter: hue-rotate(20deg); }',
    '  89% { transform: translate(1px, -1px) skewX(0.3deg); }',
    '  90% { transform: translate(-1px, 2px); filter: hue-rotate(-15deg) saturate(1.4); }',
    '  91% { transform: translate(3px, -1px) skewX(-0.8deg); }',
    '  92% { transform: translate(0); filter: none; }',
    '  93% { transform: translate(-3px, 0) skewX(0.4deg); filter: brightness(1.3) hue-rotate(10deg); }',
    '  94% { transform: translate(2px, 1px); }',
    '  95% { transform: translate(0); filter: none; }',
    '}',

    '@keyframes irpGlitchTop {',
    '  0% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  5% { clip-path: inset(15% 0 65% 0); transform: translate(-4px, 0); }',
    '  10% { clip-path: inset(60% 0 5% 0); transform: translate(4px, 0); }',
    '  15% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  20% { clip-path: inset(40% 0 30% 0); transform: translate(-6px, 0); }',
    '  25% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  30% { clip-path: inset(25% 0 55% 0); transform: translate(3px, 1px); }',
    '  32% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  50% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  52% { clip-path: inset(10% 0 60% 0); transform: translate(-5px, 0); }',
    '  54% { clip-path: inset(50% 0 10% 0); transform: translate(5px, -1px); }',
    '  56% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  70% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  72% { clip-path: inset(30% 0 45% 0); transform: translate(7px, 0); }',
    '  74% { clip-path: inset(70% 0 5% 0); transform: translate(-3px, 0); }',
    '  76% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '  100% { clip-path: inset(0 0 85% 0); transform: translate(0); }',
    '}',

    '@keyframes irpGlitchBottom {',
    '  0% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  8% { clip-path: inset(50% 0 10% 0); transform: translate(5px, 0); }',
    '  12% { clip-path: inset(5% 0 70% 0); transform: translate(-3px, 0); }',
    '  16% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  35% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  38% { clip-path: inset(20% 0 50% 0); transform: translate(-6px, 1px); }',
    '  40% { clip-path: inset(65% 0 10% 0); transform: translate(4px, 0); }',
    '  42% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  60% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  63% { clip-path: inset(40% 0 25% 0); transform: translate(8px, 0); }',
    '  65% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  80% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  82% { clip-path: inset(10% 0 65% 0); transform: translate(-4px, -1px); }',
    '  84% { clip-path: inset(55% 0 15% 0); transform: translate(3px, 0); }',
    '  86% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '  100% { clip-path: inset(85% 0 0 0); transform: translate(0); }',
    '}',

    /* Scanline overlay sur les titres IRP */
    '.irp-mode .hero-title,',
    '.irp-mode .glitch-title {',
    '  background-image: repeating-linear-gradient(',
    '    0deg,',
    '    transparent,',
    '    transparent 2px,',
    '    rgba(220,20,60,0.03) 2px,',
    '    rgba(220,20,60,0.03) 4px',
    '  );',
    '  background-clip: text;',
    '  -webkit-background-clip: text;',
    '}',

    /* Flicker intermittent nav-logo */
    '.irp-mode .nav-logo img {',
    '  animation: irpLogoFlicker 4s infinite;',
    '}',
    '@keyframes irpLogoFlicker {',
    '  0%, 85%, 100% { opacity: 1; filter: hue-rotate(280deg) saturate(1.5) brightness(0.9); }',
    '  86% { opacity: 0.7; filter: hue-rotate(300deg) saturate(2) brightness(1.4); }',
    '  87% { opacity: 1; filter: hue-rotate(260deg) saturate(1.3) brightness(0.7); }',
    '  88% { opacity: 0.4; filter: hue-rotate(280deg) saturate(1.5) brightness(0.9); }',
    '  89% { opacity: 1; filter: hue-rotate(280deg) saturate(1.5) brightness(0.9); }',
    '  93% { opacity: 0.85; filter: hue-rotate(290deg) saturate(1.8) brightness(1.2); }',
    '  94% { opacity: 1; filter: hue-rotate(280deg) saturate(1.5) brightness(0.9); }',
    '}',
    /* Cartes / surfaces */
    '.irp-mode .rp-card, .irp-mode .pnj-card, .irp-mode .sys-card,',
    '.irp-mode .lore-card, .irp-mode .race-card {',
    '  background: #1a0c28 !important;',
    '  border-color: rgba(220,20,60,0.12) !important;',
    '}',
    '.irp-mode .rp-card:hover, .irp-mode .pnj-card:hover {',
    '  border-color: rgba(220,20,60,0.3) !important;',
    '  box-shadow: 0 0 20px rgba(220,20,60,0.15) !important;',
    '}',
    /* Boutons / filtres */
    '.irp-mode .fbtn, .irp-mode .cat-btn {',
    '  border-color: rgba(220,20,60,0.15) !important;',
    '  color: #8a7090 !important;',
    '}',
    '.irp-mode .fbtn:hover, .irp-mode .fbtn.active,',
    '.irp-mode .cat-btn:hover, .irp-mode .cat-btn.active {',
    '  border-color: rgba(220,20,60,0.4) !important;',
    '  color: #dc143c !important;',
    '  background: rgba(220,20,60,0.08) !important;',
    '}',
    /* Hero section */
    '.irp-mode .hero { background: radial-gradient(ellipse at 50% 0%, rgba(139,0,139,0.12) 0%, transparent 60%) !important; }',
    /* Scan line / grain overlay */
    '.irp-mode .scroll-line { background: linear-gradient(90deg, #8B008B, #dc143c) !important; }',
    /* Live dot */
    '.irp-mode .live-dot { background: #dc143c !important; box-shadow: 0 0 8px #dc143c !important; }',
    '.irp-mode .live-text { color: #dc143c !important; }',
    /* Stats bars */
    '.irp-mode .sb-fill { background: linear-gradient(90deg, #8B008B, #dc143c) !important; }',
    /* Rank badges — prismatic override */
    '.irp-mode [data-rank] { --rank-color: #dc143c; }',
    /* ── Glitch JAHARTA ↔ ATRAHAJ animation (Gacha Nexus style scramble) ── */
    '.irp-glitch {',
    '  position: relative;',
    '  display: inline-block;',
    '  isolation: isolate;',
    '}',
    '.irp-glitch::before, .irp-glitch::after {',
    '  content: none !important;',
    '}',
    '.irp-glitch-text {',
    '  display: inline-block;',
    '  background: none !important;',
    '  color: inherit !important;',
    '  -webkit-text-fill-color: currentColor !important;',
    '  filter: none !important;',
    '  text-shadow: inherit;',
    '  white-space: pre;',
    '}',
    '.irp-glitch-text.scrambling {',
    '  color: #dc143c !important;',
    '  -webkit-text-fill-color: #dc143c !important;',
    '  text-shadow: 0 0 8px rgba(220,20,60,0.4), 0 0 2px rgba(255,0,255,0.15);',
    '  animation: irpScrambleShake 0.08s infinite alternate;',
    '}',
    '.irp-glitch-text.resolved {',
    '  color: #dc143c !important;',
    '  -webkit-text-fill-color: #dc143c !important;',
    '  text-shadow: 0 0 12px rgba(220,20,60,0.28);',
    '}',
    '@keyframes irpScrambleShake {',
    '  0% { transform: translate(0,0) skewX(0deg); }',
    '  25% { transform: translate(-1px,0.5px) skewX(-0.5deg); }',
    '  50% { transform: translate(1px,-0.5px) skewX(0.3deg); }',
    '  75% { transform: translate(-0.5px,-0.5px) skewX(-0.2deg); }',
    '  100% { transform: translate(0.5px,0.5px) skewX(0.4deg); }',
    '}',
    /* Badge IRP flottant */
    '.irp-badge {',
    '  position: fixed; bottom: 1rem; right: 1rem;',
    '  font-family: var(--font-h); font-size: 0.55rem;',
    '  letter-spacing: 0.15em; color: #dc143c;',
    '  background: rgba(220,20,60,0.08);',
    '  border: 1px solid rgba(220,20,60,0.25);',
    '  border-radius: 6px; padding: 6px 14px;',
    '  z-index: 9999; pointer-events: none;',
    '  animation: irpPulse 2s ease-in-out infinite;',
    '}',
    '@keyframes irpPulse {',
    '  0%,100% { opacity: 0.6; }',
    '  50% { opacity: 1; }',
    '}',
    /* Modal d'accès */
    '.irp-modal-overlay {',
    '  position: fixed; inset: 0; z-index: 10000;',
    '  background: rgba(2,7,19,0.95); backdrop-filter: blur(20px);',
    '  display: flex; align-items: center; justify-content: center;',
    '  opacity: 0; transition: opacity 0.3s;',
    '}',
    '.irp-modal-overlay.visible { opacity: 1; }',
    '.irp-modal {',
    '  background: linear-gradient(145deg, #0a0f22, #120818);',
    '  border: 1px solid rgba(220,20,60,0.3);',
    '  border-radius: 16px; padding: 40px;',
    '  max-width: 400px; width: 90%; text-align: center;',
    '  box-shadow: 0 0 60px rgba(139,0,139,0.15);',
    '}',
    '.irp-modal h2 {',
    '  font-family: var(--font-h); font-size: 1rem;',
    '  letter-spacing: 0.15em; color: #dc143c;',
    '  margin-bottom: 8px;',
    '}',
    '.irp-modal p {',
    '  font-family: var(--font-m); font-size: 0.65rem;',
    '  color: var(--text2); margin-bottom: 24px;',
    '}',
    '.irp-modal input {',
    '  width: 100%; padding: 12px 16px;',
    '  background: rgba(220,20,60,0.06);',
    '  border: 1px solid rgba(220,20,60,0.2);',
    '  border-radius: 8px; color: var(--text);',
    '  font-family: var(--font-m); font-size: 0.75rem;',
    '  letter-spacing: 0.1em; text-align: center;',
    '  outline: none; transition: border-color 0.2s;',
    '}',
    '.irp-modal input:focus {',
    '  border-color: rgba(220,20,60,0.5);',
    '}',
    '.irp-modal input.error {',
    '  border-color: #ff4444; animation: shake 0.4s;',
    '}',
    '@keyframes shake {',
    '  0%,100% { transform: translateX(0); }',
    '  25% { transform: translateX(-8px); }',
    '  75% { transform: translateX(8px); }',
    '}',
    '.irp-modal .irp-submit {',
    '  margin-top: 16px; padding: 10px 32px;',
    '  background: linear-gradient(135deg, #8B008B, #dc143c);',
    '  border: none; border-radius: 8px;',
    '  color: #fff; font-family: var(--font-h);',
    '  font-size: 0.65rem; letter-spacing: 0.12em;',
    '  cursor: pointer; transition: opacity 0.2s;',
    '}',
    '.irp-modal .irp-submit:hover { opacity: 0.8; }',
    '.irp-modal .irp-cancel {',
    '  margin-top: 12px; padding: 8px 24px;',
    '  background: transparent;',
    '  border: 1px solid rgba(255,255,255,0.1);',
    '  border-radius: 8px; color: var(--text3);',
    '  font-family: var(--font-m); font-size: 0.6rem;',
    '  cursor: pointer;',
    '}',
    /* Bouton footer secret */
    '.irp-secret-btn {',
    '  color: var(--text3); text-decoration: none;',
    '  font-size: 0.42rem; letter-spacing: 0.12em;',
    '  opacity: 0.15; transition: opacity 0.2s;',
    '  margin-left: 10px; cursor: pointer;',
    '  user-select: none;',
    '}',
    '.irp-secret-btn:hover { opacity: 0.5; }',
    /* En mode IRP, le bouton devient visible */
    '.irp-mode .irp-secret-btn {',
    '  opacity: 0.6; color: #dc143c;',
    '}',
  ].join('\n');

  /* ── Inject CSS ── */
  var style = document.createElement('style');
  style.id = 'irp-theme-css';
  style.textContent = IRP_THEME_CSS;
  document.head.appendChild(style);

  /* ── Apply/Remove IRP mode ── */
  function applyIRPMode() {
    document.documentElement.classList.add('irp-mode');
    window._irpMode = true;
    localStorage.setItem(STORAGE_KEY, 'true');

    /* Modifier le logo footer */
    var footerBrand = document.querySelector('.footer-brand');
    if (footerBrand && !footerBrand.textContent.includes('IRP')) {
      footerBrand.textContent = footerBrand.textContent.replace('JAHARTA', 'JAHARTA IRP');
    }

    /* Badge flottant */
    if (!document.getElementById('irp-badge')) {
      var badge = document.createElement('div');
      badge.id = 'irp-badge';
      badge.className = 'irp-badge';
      badge.textContent = '◆ MODE IRP';
      document.body.appendChild(badge);
    }

    /* ── Glitch JAHARTA ↔ ATRAHAJ sur tous les headers/titres ── */
    applyGlitchEffect();

    /* Recharger les données si les fonctions existent */
    if (typeof window._loadIRPCards === 'function') window._loadIRPCards();
    if (typeof window._loadIRPPNJ === 'function') window._loadIRPPNJ();
    if (typeof window._loadIRPBestiaire === 'function') window._loadIRPBestiaire();

    /* Reconstruire la nav pour le mode IRP */
    if (typeof window._rebuildNav === 'function') window._rebuildNav();

    /* Appliquer le glitch aussi à la nav reconstruite */
    setTimeout(applyGlitchEffect, 100);
  }

  function removeIRPMode() {
    document.documentElement.classList.remove('irp-mode');
    window._irpMode = false;
    localStorage.removeItem(STORAGE_KEY);

    /* Restaurer le footer */
    var footerBrand = document.querySelector('.footer-brand');
    if (footerBrand) {
      footerBrand.textContent = footerBrand.textContent.replace('JAHARTA IRP', 'JAHARTA');
    }

    /* Retirer tous les effets glitch */
    removeGlitchEffect();

    /* Retirer le badge */
    var badge = document.getElementById('irp-badge');
    if (badge) badge.remove();
  }

  /* ── Modal d'accès ── */
  function openIRPModal() {
    /* Si déjà en mode IRP, on désactive */
    if (window._irpMode) {
      removeIRPMode();
      localStorage.removeItem(STORAGE_KEY);
      if (typeof showToast === 'function') showToast('Mode IRP désactivé', 'info');
      /* Redirect to normal site */
      setTimeout(function () { location.href = 'index.html'; }, 500);
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'irp-modal-overlay';
    overlay.innerHTML = [
      '<div class="irp-modal">',
      '  <h2>◆ ACCÈS RESTREINT</h2>',
      '  <p>Ce contenu est réservé. Entrez le code d\'accès.</p>',
      '  <input type="password" id="irp-code-input" placeholder="Code d\'accès..." autocomplete="off" spellcheck="false">',
      '  <br>',
      '  <button class="irp-submit" id="irp-submit-btn">ACCÉDER</button>',
      '  <br>',
      '  <button class="irp-cancel" id="irp-cancel-btn">Annuler</button>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);

    /* Fade in */
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
    });

    var input = document.getElementById('irp-code-input');
    var submitBtn = document.getElementById('irp-submit-btn');
    var cancelBtn = document.getElementById('irp-cancel-btn');

    function trySubmit() {
      var val = input.value.trim();
      if (val === IRP_CODE) {
        overlay.classList.remove('visible');
        setTimeout(function () {
          overlay.remove();
          localStorage.setItem(STORAGE_KEY, 'true');
          /* Redirect to dedicated IRP index */
          location.href = 'index-irp.html';
        }, 300);
      } else {
        input.classList.add('error');
        setTimeout(function () { input.classList.remove('error'); }, 500);
        input.value = '';
        input.placeholder = 'Code incorrect...';
      }
    }

    submitBtn.addEventListener('click', trySubmit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') trySubmit();
    });
    cancelBtn.addEventListener('click', function () {
      overlay.classList.remove('visible');
      setTimeout(function () { overlay.remove(); }, 300);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.remove('visible');
        setTimeout(function () { overlay.remove(); }, 300);
      }
    });

    setTimeout(function () { input.focus(); }, 100);
  }

  /* ── Glitch JAHARTA ↔ ATRAHAJ ── */
  function reverseWord(word) {
    /* JAHARTA → ATRAHAJ */
    return word.split('').reverse().join('');
  }

  function applyGlitchEffect() {
    /* Sélecteurs : tous les éléments susceptibles de contenir JAHARTA */
    var selectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      '.hero-title', '.section-title', '.nav-logo',
      '.footer-brand', '.footer-copy',
      '[class*="title"]', '[class*="header"]', '[class*="heading"]',
      '.irp-badge'
    ];
    var elements = document.querySelectorAll(selectors.join(','));

    elements.forEach(function (el) {
      /* Skip si déjà traité */
      if (el.dataset.irpGlitched) return;
      /* Skip si pas de JAHARTA dans le texte */
      if (!el.textContent.includes('JAHARTA')) return;

      /* Pour les éléments simples (texte seul, pas d'enfants complexes) */
      processNode(el);
    });

    /* ── Injecter data-text sur tous les titres glitch pour ::before/::after ── */
    var glitchTargets = document.querySelectorAll('.hero-title, .glitch-title, .sh-title, .ph-title');
    glitchTargets.forEach(function (el) {
      if (!el.dataset.text) {
        el.dataset.text = el.textContent.trim();
      }
    });
  }

  function processNode(el) {
    /* Parcourir les nœuds texte enfants */
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(function (node) {
      var text = node.textContent;
      if (!text.includes('JAHARTA')) return;

      /* Trouver toutes les occurrences de JAHARTA (et variantes) */
      var parts = text.split(/(JAHARTA\s*IRP|JAHARTA)/g);
      if (parts.length <= 1) return;

      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        if (part === 'JAHARTA' || part === 'JAHARTA IRP') {
          var reversed = part === 'JAHARTA IRP' ? 'ATRAHAJ IRP' : 'ATRAHAJ';
          var original = part;
          var wrapper = document.createElement('span');
          wrapper.className = 'irp-glitch';
          wrapper.dataset.original = original;
          wrapper.dataset.reversed = reversed;
          wrapper.dataset.irpGlitched = 'true';
          wrapper.style.position = 'relative';
          wrapper.style.display = 'inline-block';

          /* Texte unique géré par le scramble engine */
          var txt = document.createElement('span');
          txt.className = 'irp-glitch-text';
          txt.textContent = reversed;
          txt.dataset.state = 'reversed'; /* reversed = ATRAHAJ, original = JAHARTA */

          wrapper.appendChild(txt);
          frag.appendChild(wrapper);

          /* Lancer le cycle de scramble sur cet élément */
          _startScrambleCycle(txt, reversed, original);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });

      node.parentNode.replaceChild(frag, node);
    });

    el.dataset.irpGlitched = 'true';
  }

  /* ── Gacha Nexus–style scramble engine ── */
  var _SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';
  var _scrambleTimers = [];

  function _shuffleString(str) {
    var arr = str.replace(/\s+/g, '').split('');
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr.join('');
  }

  function _scrambleTo(el, target, duration, callback) {
    var len = target.length;
    var steps = Math.max(8, Math.floor(duration / 50));
    var stepTime = duration / steps;
    var resolved = [];
    var step = 0;

    el.classList.add('scrambling');

    var iv = setInterval(function () {
      step++;
      var progress = step / steps;
      /* Progressively lock letters from left to right */
      var lockedCount = Math.floor(progress * len);
      var display = '';
      for (var i = 0; i < len; i++) {
        if (i < lockedCount) {
          display += target[i];
        } else {
          /* Random character from the scramble pool, sometimes use letters from source/target */
          display += _SCRAMBLE_CHARS[Math.floor(Math.random() * _SCRAMBLE_CHARS.length)];
        }
      }
      el.textContent = display;

      if (step >= steps) {
        clearInterval(iv);
        el.textContent = target;
        el.classList.remove('scrambling');
        if (callback) callback();
      }
    }, stepTime);

    return iv;
  }

  function _startScrambleCycle(el, reversed, original) {
    /* Cycle: show ATRAHAJ 8.5s → scramble to JAHARTA (0.8s) → hold JAHARTA 1.5s → scramble back (0.7s) → repeat */
    var HOLD_REVERSED = 8500;  /* ATRAHAJ visible duration */
    var SCRAMBLE_IN = 800;     /* scramble ATRAHAJ → JAHARTA */
    var HOLD_ORIGINAL = 1500;  /* JAHARTA visible duration */
    var SCRAMBLE_OUT = 700;    /* scramble JAHARTA → ATRAHAJ */

    function cycle() {
      /* Phase 1: Hold ATRAHAJ */
      var t1 = setTimeout(function () {
        /* Phase 2: Scramble to JAHARTA */
        _scrambleTo(el, original, SCRAMBLE_IN, function () {
          el.classList.add('resolved');
          el.dataset.state = 'original';
          /* Phase 3: Hold JAHARTA */
          var t2 = setTimeout(function () {
            el.classList.remove('resolved');
            /* Phase 4: Scramble back to ATRAHAJ */
            _scrambleTo(el, reversed, SCRAMBLE_OUT, function () {
              el.dataset.state = 'reversed';
              /* Restart cycle */
              cycle();
            });
          }, HOLD_ORIGINAL);
          _scrambleTimers.push(t2);
        });
      }, HOLD_REVERSED);
      _scrambleTimers.push(t1);
    }

    /* Stagger start: randomize initial delay slightly so multiple elements don't all fire at once */
    var initDelay = Math.floor(Math.random() * 2000);
    var t0 = setTimeout(cycle, initDelay);
    _scrambleTimers.push(t0);
  }

  function removeGlitchEffect() {
    /* Clear all scramble timers */
    _scrambleTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    _scrambleTimers = [];
    /* Restaurer tous les spans glitch en texte normal */
    document.querySelectorAll('.irp-glitch').forEach(function (wrapper) {
      var normalSpan = wrapper.querySelector('.irp-glitch-text');
      if (normalSpan) {
        /* Restore to JAHARTA (the original text) */
        var original = wrapper.dataset.original || normalSpan.textContent;
        var text = document.createTextNode(original);
        wrapper.parentNode.replaceChild(text, wrapper);
      }
    });
    /* Retirer les flags */
    document.querySelectorAll('[data-irp-glitched]').forEach(function (el) {
      delete el.dataset.irpGlitched;
    });
  }

  /* ── Exposer pour les autres scripts ── */
  window._openIRPModal = openIRPModal;
  window._applyIRPMode = applyIRPMode;
  window._removeIRPMode = removeIRPMode;

  /* ── Injecter le bouton secret dans le footer ── */
  function injectSecretButton() {
    var footerCopy = document.querySelector('.footer-copy');
    if (!footerCopy) return;
    if (footerCopy.querySelector('.irp-secret-btn')) return;

    var btn = document.createElement('span');
    btn.className = 'irp-secret-btn';
    btn.textContent = '◆';
    btn.title = '';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openIRPModal();
    });
    footerCopy.appendChild(btn);
  }

  /* ── Auto-apply si déjà authentifié ── */
  function init() {
    injectSecretButton();
    if (window._irpMode) {
      applyIRPMode();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

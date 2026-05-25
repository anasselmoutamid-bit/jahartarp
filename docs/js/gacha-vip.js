/* ═══════════════════════════════════════════════════════════════
   GACHA VIP SYSTEM v2 — Animations spéciales + Background
   Se déclenche à CHAQUE visite de la page (pas de sessionStorage)
   ═══════════════════════════════════════════════════════════════ */
;(function(){

  /* ── Config VIP — chaque ID a son animation et ses droits ── */
  var VIP_CONFIG = {
    '372065190142803982': {
      type:     'jarvis',
      color:    '#00e5ff',
      colorRgb: '0,229,255',
      msg:      'LE NEXUS RECONNAIT SON CREATEUR\nBIENVENUE, OBSERVATEUR',
      sub:      'NEXUS SYSTEM  ·  PROTOCOLE CREATEUR ACTIF'
    },
    '213985774771765248': {
      type:     'godzilla',
      color:    '#ff00cc',
      colorRgb: '255,0,204',
      msg:      'KAIJUU SAMA DETECTED\nPROTOCOL GODZILLA STARTED',
      sub:      'THREAT LEVEL : OMEGA',
      video:    'media/video-project-1.mp4',
      bgImage:  'media/pink-godzilla.jpg'
    },
    '769193650915246131': {
      type:     'jarvis',
      color:    '#ff69b4',
      colorRgb: '255,105,180',
      msg:      'BIENVENUE A LA PARTENAIRE DU CREATEUR\nPROTOCOL CHATON ACTIF',
      sub:      'NEXUS SYSTEM  ·  PROTOCOLE PARTENAIRE ACTIF'
    },
    '424937768704147458': {
      type:     'jarvis',
      color:    '#a78bfa',
      colorRgb: '167,139,250',
      msg:      'ADMINISTRATOR DETECTE\nLE NEXUS SE PLIE A VOS DEMANDES, OBSERVATRICE',
      sub:      'NEXUS SYSTEM  ·  PROTOCOLE ADMINISTRATEUR ACTIF'
    }
  };

  /* IDs avec garantie LEG+ sur TOUS les pulls */
  window.VIP_LEG_GUARANTEED_IDS = new Set(Object.keys(VIP_CONFIG));

  /* ── Helpers ── */
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function waitClick(el){
    return new Promise(function(r){
      var h = function(){ el.removeEventListener('click',h); r(); };
      el.addEventListener('click',h);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     POINT D'ENTRÉE — appelé depuis gacha.html après loadUser()
     Se déclenche à CHAQUE arrivée sur la page, sans exception
     ═══════════════════════════════════════════════════════════ */
  window.triggerVIPIntro = async function(userId){
    var id  = String(userId);
    var cfg = VIP_CONFIG[id];
    if(!cfg) return;

    /* Pour Godzilla : appliquer le background AVANT l'animation */
    if(cfg.type === 'godzilla' && cfg.bgImage){
      window._vipGodzillaActive = true;
      _applyGodzillaBg(cfg.bgImage, cfg.color);
    }

    var ov = document.getElementById('vip-intro-overlay');
    if(!ov) return;

    ov.innerHTML = '';
    ov.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'overflow:hidden',
      'cursor:pointer',
      'opacity:0',
      'background:#000',
      'transition:opacity .35s ease'
    ].join(';');

    await sleep(40);
    ov.style.opacity = '1';

    if(cfg.type === 'godzilla'){
      await _playGodzilla(cfg, ov);
    } else {
      await _playJarvis(cfg, ov);
    }

    /* Fade out */
    ov.style.transition = 'opacity .8s ease';
    ov.style.opacity    = '0';
    await sleep(800);
    ov.style.display = 'none';
    ov.innerHTML = '';
  };

  /* ═══════════════════════════
     ANIMATION JARVIS
     ═══════════════════════════ */
  async function _playJarvis(cfg, ov){
    var c    = cfg.color;
    var crgb = cfg.colorRgb || '0,229,255';

    ov.innerHTML = [
      '<div class="vjw" style="--c:'+c+';--crgb:'+crgb+'">',

        /* Fond radial */
        '<div class="vjw-bg"></div>',

        /* Grille interface */
        '<div class="vjw-grid"></div>',

        /* Scan line horizontale */
        '<div class="vjw-scan" id="vjw-scan"></div>',

        /* 4 coins bracket */
        '<div class="vjw-c vjw-tl" id="vjw-tl"></div>',
        '<div class="vjw-c vjw-tr" id="vjw-tr"></div>',
        '<div class="vjw-c vjw-bl" id="vjw-bl"></div>',
        '<div class="vjw-c vjw-br" id="vjw-br"></div>',

        /* Lignes horizontales HUD */
        '<div class="vjw-hlines">',
          '<div class="vjw-hl" id="vjw-hl0"></div>',
          '<div class="vjw-hl" id="vjw-hl1"></div>',
          '<div class="vjw-hl" id="vjw-hl2"></div>',
        '</div>',

        /* Contenu central */
        '<div class="vjw-center">',

          /* Anneaux logo */
          '<div class="vjw-rings" id="vjw-rings">',
            '<div class="vjw-ring vjw-ring-a"></div>',
            '<div class="vjw-ring vjw-ring-b"></div>',
            '<img src="img/logo-jaharta.svg" class="vjw-logo" id="vjw-logo" alt="">',
          '</div>',

          /* Sous-titre */
          '<div class="vjw-sub" id="vjw-sub">'+esc(cfg.sub)+'</div>',

          /* Message principal (typewriter) */
          '<div class="vjw-msg" id="vjw-msg" style="color:'+c+'"></div>',

        '</div>',

        /* Data nodes */
        '<div class="vjw-data">',
          '<span>SYS&nbsp;:&nbsp;ONLINE</span>',
          '<span>NEXUS&nbsp;:&nbsp;STABLE</span>',
          '<span>AUTH&nbsp;:&nbsp;VIP</span>',
          '<span>SEC&nbsp;:&nbsp;MAX</span>',
        '</div>',

        /* Skip */
        '<div class="vjw-skip" id="vjw-skip">[ CLIQUER POUR PASSER ]</div>',

      '</div>'
    ].join('');

    var scan   = ov.querySelector('#vjw-scan');
    var tl     = ov.querySelector('#vjw-tl');
    var tr     = ov.querySelector('#vjw-tr');
    var bl     = ov.querySelector('#vjw-bl');
    var br     = ov.querySelector('#vjw-br');
    var hls    = ov.querySelectorAll('.vjw-hl');
    var rings  = ov.querySelector('#vjw-rings');
    var logo   = ov.querySelector('#vjw-logo');
    var subEl  = ov.querySelector('#vjw-sub');
    var msgEl  = ov.querySelector('#vjw-msg');
    var skipEl = ov.querySelector('#vjw-skip');

    /* P1 — Coins */
    await sleep(100);
    [tl,tr,bl,br].forEach(function(el,i){
      setTimeout(function(){ el && el.classList.add('vjw-c-on'); }, i*80);
    });

    /* P2 — Anneaux + logo */
    await sleep(350);
    if(rings) rings.classList.add('vjw-rings-on');
    if(logo)  logo.classList.add('vjw-logo-on');

    /* P3 — Scan line sweep */
    await sleep(300);
    if(scan){
      scan.style.cssText = 'opacity:1;top:0;transition:top 1.1s cubic-bezier(.4,0,.2,1)';
      await sleep(30);
      scan.style.top = '100%';
      await sleep(1100);
      scan.style.opacity = '0';
    }

    /* P4 — HUD lines */
    hls.forEach(function(el,i){
      setTimeout(function(){ el && el.classList.add('vjw-hl-on'); }, i*60);
    });

    /* P5 — Sous-titre */
    await sleep(400);
    if(subEl) subEl.classList.add('vjw-sub-on');

    /* P6 — Typewriter */
    await sleep(450);
    if(msgEl){
      msgEl.style.opacity = '1';
      await _typewriter(msgEl, cfg.msg, false);
    }

    /* P7 — Skip hint */
    await sleep(1400);
    if(skipEl) skipEl.classList.add('vjw-skip-on');

    await Promise.race([ waitClick(ov), sleep(7000) ]);
  }

  /* ═══════════════════════════
     ANIMATION GODZILLA
     ═══════════════════════════ */
  async function _playGodzilla(cfg, ov){
    var c = cfg.color;

    /* ─ Phase 1 : Vidéo plein écran ─ */
    ov.innerHTML = [
      '<div style="width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center">',
        '<video id="vgz-vid" style="width:100%;height:100%;object-fit:cover;opacity:1;transition:opacity .4s" playsinline muted></video>',
      '</div>',
      '<div class="vjw-skip" id="vjw-skip" style="opacity:.45">[ CLIQUER POUR PASSER ]</div>'
    ].join('');

    var vid    = ov.querySelector('#vgz-vid');
    var skipV  = ov.querySelector('#vjw-skip');

    if(vid && cfg.video){
      vid.src = cfg.video;
      vid.volume = 0.8;
      /* Tenter audio non muté après geste utilisateur */
      vid.muted = true;
      ov.addEventListener('click', function(){
        vid.muted = false;
        vid.volume = 0.8;
      }, {once:true});

      await new Promise(function(res){
        var done = false;
        function fin(){ if(done)return; done=true; res(); }
        vid.addEventListener('ended', fin, {once:true});
        vid.addEventListener('error', fin, {once:true});
        if(skipV) skipV.addEventListener('click', fin, {once:true});
        vid.play().catch(fin);
      });

      vid.style.opacity = '0';
      await sleep(400);
    }

    /* ─ Phase 2 : Écrans warning ─ */
    ov.innerHTML = [
      '<div id="vgz-warn" style="width:100%;height:100%;background:#000;display:flex;',
        'flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:2rem">',
        _warningLines(c),
      '</div>'
    ].join('');

    await sleep(100);
    var wlines = ov.querySelectorAll('.vgz-wl');
    for(var i=0;i<wlines.length;i++){
      wlines[i].style.opacity='1';
      await sleep(80);
      wlines[i].style.opacity='.08';
      await sleep(50);
      wlines[i].style.opacity='1';
      await sleep(60);
      wlines[i].style.opacity='.12';
      await sleep(40);
      wlines[i].style.opacity='1';
      await sleep(190);
    }

    /* Flash global */
    var bk = ov.querySelector('#vgz-warn');
    if(bk){
      bk.style.background='#3a0030'; await sleep(70);
      bk.style.background='#000';    await sleep(70);
      bk.style.background='#3a0030'; await sleep(70);
      bk.style.background='#000';    await sleep(70);
      bk.style.background='#3a0030'; await sleep(70);
      bk.style.background='#000';
    }
    await sleep(300);

    /* ─ Phase 3 : Protocole GODZILLA ─ */
    ov.innerHTML = [
      '<div class="vgz-proto" style="--c:'+c+';--crgb:'+cfg.colorRgb+'">',

        /* Bordures pulsantes — 4 coins grands */
        '<div class="vgz-bdr vgz-bdr-tl"></div>',
        '<div class="vgz-bdr vgz-bdr-tr"></div>',
        '<div class="vgz-bdr vgz-bdr-bl"></div>',
        '<div class="vgz-bdr vgz-bdr-br"></div>',

        /* Scanline vertical */
        '<div class="vgz-scanv"></div>',

        /* Fond ambiante */
        '<div class="vgz-ambient"></div>',

        /* Centre */
        '<div class="vjw-center">',
          '<div class="vgz-icon">🦖</div>',
          '<div class="vgz-label">PROTOCOL GODZILLA</div>',
          '<div class="vgz-msg" id="vgz-msg" style="opacity:0;color:'+c+'"></div>',
        '</div>',

        /* Skip */
        '<div class="vjw-skip vjw-skip-on">[ CLIQUER POUR PASSER ]</div>',

      '</div>'
    ].join('');

    await sleep(300);

    var msgEl = ov.querySelector('#vgz-msg');
    if(msgEl){
      msgEl.style.opacity = '1';
      await _typewriter(msgEl, cfg.msg, true);  /* true = Rajdhani glitch */
    }

    await sleep(1800);
    await Promise.race([ waitClick(ov), sleep(6500) ]);
  }

  function _warningLines(c){
    var lines = [
      '&#x26A0; ANOMALIE DETECTEE — SIGNATURE BIOMETRIQUE INCONNUE',
      '&#x26A0; NIVEAU DE PUISSANCE AU-DELA DU SEUIL CRITIQUE',
      '&#x26A0;&#x26A0; ALERTE MAXIMALE — CLASSE OMEGA CONFIRMEE',
      '!!!! ENTITE KAIJUU IDENTIFIEE  ·  CLASSE : GODZILLA !!!!',
      '&#x26A0;&#x26A0;&#x26A0; SYSTEME EN SURCHARGE — PROTOCOLE D\'URGENCE &#x26A0;&#x26A0;&#x26A0;',
      '[ PROTOCOL GODZILLA — INITIALISATION EN COURS... ]'
    ];
    return lines.map(function(l){
      return '<div class="vgz-wl" style="opacity:0;font-family:\'Rajdhani\',sans-serif;font-size:clamp(.75rem,2.4vw,1.35rem);font-weight:700;letter-spacing:.12em;color:'+c+';text-shadow:0 0 14px '+c+',0 0 30px '+c+'80;text-align:center">'+l+'</div>';
    }).join('');
  }

  /* ═══════════════════════════
     TYPEWRITER
     ═══════════════════════════ */
  async function _typewriter(el, text, useRajdhani){
    if(useRajdhani){
      el.style.fontFamily = "'Rajdhani', sans-serif";
      el.style.fontSize   = 'clamp(1.2rem,3.5vw,2.2rem)';
      el.style.fontWeight = '700';
    } else {
      el.style.fontFamily = "var(--font-h), 'Orbitron', sans-serif";
      el.style.fontSize   = 'clamp(1.1rem,3vw,2rem)';
      el.style.fontWeight = '900';
    }
    el.style.letterSpacing = '.1em';
    el.style.textAlign     = 'center';
    el.style.textTransform = 'uppercase';
    el.style.lineHeight    = '1.5';
    el.style.maxWidth      = '720px';
    el.style.textShadow    = '0 0 24px currentColor, 0 0 48px currentColor';

    var lines = text.split('\n');
    el.innerHTML = '';
    var cur = '<span class="vjw-cur">▋</span>';

    for(var li=0; li<lines.length; li++){
      if(li>0) el.innerHTML = el.innerHTML.replace(cur,'') + '<br>';
      var line = lines[li];
      for(var ci=0; ci<line.length; ci++){
        el.innerHTML = el.innerHTML.replace(cur,'') + esc(line[ci]) + cur;
        await sleep(Math.random()*40+16);
      }
      await sleep(110);
    }
    el.innerHTML = el.innerHTML.replace(cur,'');
  }

  /* ═══════════════════════════
     BACKGROUNDS
     ═══════════════════════════ */

  /* Background dynamique depuis les images de bannières actives */
  window.applyBannerDynBg = function(banners){
    /* Ne pas écraser le bg Godzilla */
    if(window._vipGodzillaActive) return;

    var dyn = document.getElementById('banner-dyn-bg');
    if(!dyn) return;

    var active = banners.filter(function(b){ return b.status==='live' && b.image; });
    if(!active.length) return;

    var b1 = dyn.querySelector('.bdg-1');
    var b2 = dyn.querySelector('.bdg-2');

    if(b1 && active[0]){
      b1.style.backgroundImage = "url('" + active[0].image + "')";
      b1.style.opacity = '1';
    }
    if(b2){
      var src = active[1] ? active[1].image : active[0].image;
      b2.style.backgroundImage = "url('" + src + "')";
      b2.style.opacity = '1';
    }

    dyn.classList.add('bdg-active');
  };

  /* Background Godzilla (PINK GODZILLA.jpg) */
  function _applyGodzillaBg(imgUrl, color){
    var dyn = document.getElementById('banner-dyn-bg');
    if(!dyn) return;

    var b1 = dyn.querySelector('.bdg-1');
    var b2 = dyn.querySelector('.bdg-2');

    /* Les deux layers = même image, masque diagonal supprimé */
    [b1, b2].forEach(function(el){
      if(!el) return;
      el.style.backgroundImage   = "url('" + imgUrl + "')";
      el.style.maskImage         = 'none';
      el.style.webkitMaskImage   = 'none';
      el.style.opacity           = '1';
    });

    dyn.classList.add('bdg-active');

    /* Overlay rose sur la page */
    var existing = document.getElementById('vip-pink-ov');
    if(existing) existing.remove();
    var ol = document.createElement('div');
    ol.id = 'vip-pink-ov';
    ol.setAttribute('aria-hidden','true');
    ol.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:0',
      'background:linear-gradient(135deg,rgba(255,0,120,.09),rgba(80,0,60,.12),transparent 60%)',
      'animation:gzlAmbient 5s ease-in-out infinite'
    ].join(';');
    document.body.insertBefore(ol, document.body.firstChild);

    /* Bords du body en rose pulsant */
    document.body.classList.add('vip-gzl-body');
  }

})();

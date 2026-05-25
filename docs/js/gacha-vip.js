/* ═══════════════════════════════════════════════════════════════
   GACHA VIP INTRO SYSTEM — Animations spéciales IDs VIP
   ═══════════════════════════════════════════════════════════════ */
;(function(){

  /* ── Config VIP ── */
  var VIP_CONFIG = {
    '372065190142803982': {
      type: 'jarvis',
      msg: 'LE NEXUS RECONNAIT SON CREATEUR\nBIENVENUE, OBSERVATEUR',
      subtitle: 'NEXUS SYSTEM — PROTOCOLE CREATEUR ACTIF',
      color: '#00e5ff',
      ringColor: '#00e5ff'
    },
    '213985774771765248': {
      type: 'godzilla',
      msg: 'KAIJUU SAMA DETECTED\nPROTOCOL GODZILLA STARTED',
      subtitle: 'THREAT LEVEL : OMEGA',
      color: '#ff00cc',
      video: 'media/video-project-1.mp4',
      bgImage: 'media/pink-godzilla.jpg'
    },
    '769193650915246131': {
      type: 'jarvis',
      msg: 'BIENVENUE A LA PARTENAIRE DU CREATEUR\nPROTOCOL "CHATON" ACTIVE',
      subtitle: 'NEXUS SYSTEM — PROTOCOLE PARTENAIRE ACTIF',
      color: '#ff69b4',
      ringColor: '#ff69b4'
    },
    '424937768704147458': {
      type: 'jarvis',
      msg: 'ADMINISTRATOR DETECTE\nLE NEXUS SE PLIE A VOS DEMANDES, OBSERVATRICE',
      subtitle: 'NEXUS SYSTEM — PROTOCOLE ADMINISTRATEUR ACTIF',
      color: '#a78bfa',
      ringColor: '#a78bfa'
    }
  };

  /* IDs avec LEG+ garanti sur CHAQUE pull (accessible par gacha-logic.js) */
  window.VIP_LEG_GUARANTEED_IDS = new Set(Object.keys(VIP_CONFIG));

  /* ── Helpers ── */
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

  function hasPlayed(id){
    try{ return sessionStorage.getItem('vip:'+id)==='1'; }catch(e){ return false; }
  }
  function markPlayed(id){
    try{ sessionStorage.setItem('vip:'+id,'1'); }catch(e){}
  }

  /* ── Entry point (appelé depuis gacha-logic.js après loadUser) ── */
  window.triggerVIPIntro = async function(userId){
    var id = String(userId);
    var cfg = VIP_CONFIG[id];
    if(!cfg){ return; }
    if(hasPlayed(id)){ return; }

    var overlay = document.getElementById('vip-intro-overlay');
    if(!overlay){ return; }

    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    overlay.style.transition = 'none';
    await sleep(60);
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '1';

    if(cfg.type === 'jarvis'){
      await playJarvis(cfg, overlay);
    } else if(cfg.type === 'godzilla'){
      await playGodzilla(cfg, overlay);
    }

    /* Fade out */
    overlay.style.transition = 'opacity 0.9s ease';
    overlay.style.opacity = '0';
    await sleep(900);
    overlay.style.display = 'none';
    overlay.innerHTML = '';

    /* Appliquer le background Godzilla après l'animation */
    if(cfg.type === 'godzilla' && cfg.bgImage){
      applyGodzillaBg(cfg.bgImage, cfg.color);
    }

    markPlayed(id);
  };

  /* ═══════════════════════════════════
     ANIMATION JARVIS
  ═══════════════════════════════════ */
  async function playJarvis(cfg, overlay){
    overlay.innerHTML = buildJarvisHTML(cfg);

    var corners  = overlay.querySelectorAll('.vip-corner');
    var scanLine = overlay.querySelector('.vip-scan');
    var hudLines = overlay.querySelectorAll('.vip-hud-line');
    var msgEl    = overlay.querySelector('.vip-typetext');
    var skipEl   = overlay.querySelector('.vip-skip');
    var subEl    = overlay.querySelector('.vip-subtitle-text');
    var ringEls  = overlay.querySelectorAll('.vip-ring');
    var logoEl   = overlay.querySelector('.vip-logo-img');

    /* Phase 1 — corners apparaissent */
    await sleep(150);
    corners.forEach(function(c,i){ setTimeout(function(){ c.classList.add('active'); }, i*90); });

    /* Phase 2 — logo pulse */
    if(logoEl){ logoEl.style.opacity = '0.9'; }
    ringEls.forEach(function(r,i){ setTimeout(function(){ r.classList.add('active'); }, i*200); });

    /* Phase 3 — scan sweep */
    await sleep(500);
    if(scanLine){
      scanLine.style.opacity = '1';
      scanLine.style.top     = '-4px';
      await sleep(30);
      scanLine.style.transition = 'top 1.1s cubic-bezier(.4,0,.2,1)';
      scanLine.style.top        = '100%';
      await sleep(1100);
      scanLine.style.opacity = '0';
    }

    /* Phase 4 — HUD lines */
    hudLines.forEach(function(el,i){ setTimeout(function(){ el.classList.add('active'); }, i*50); });
    await sleep(400);

    /* Phase 5 — subtitle apparait */
    if(subEl){
      subEl.style.opacity = '1';
      subEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      subEl.style.transform = 'translateY(0)';
    }
    await sleep(400);

    /* Phase 6 — typewriter message */
    if(msgEl){
      msgEl.style.opacity = '1';
      await typewriter(msgEl, cfg.msg, cfg.color);
    }

    await sleep(1800);

    /* Phase 7 — skip hint */
    if(skipEl){ skipEl.style.opacity = '1'; }

    await Promise.race([ waitClick(overlay), sleep(6000) ]);
  }

  /* ═══════════════════════════════════
     ANIMATION GODZILLA
  ═══════════════════════════════════ */
  async function playGodzilla(cfg, overlay){
    /* ─ Phase 1 : Video ─ */
    overlay.innerHTML = buildVideoHTML(cfg);
    var videoEl = overlay.querySelector('#vip-gzl-video');
    var skipV   = overlay.querySelector('.vip-skip');

    if(videoEl && cfg.video){
      videoEl.src = cfg.video;
      videoEl.style.display = 'block';
      await new Promise(function(res){
        var done = false;
        function finish(){ if(done)return; done=true; res(); }
        videoEl.addEventListener('ended',  finish, {once:true});
        videoEl.addEventListener('error',  finish, {once:true});
        overlay.addEventListener('click',  finish, {once:true});
        if(skipV){ skipV.addEventListener('click', finish, {once:true}); }
        videoEl.play().catch(finish);
      });
      /* Fade video out */
      videoEl.style.transition = 'opacity 0.4s ease';
      videoEl.style.opacity = '0';
      await sleep(400);
    }

    /* ─ Phase 2 : Warning flashes ─ */
    overlay.innerHTML = buildWarningHTML();
    await sleep(100);
    var wmsgs = overlay.querySelectorAll('.vip-wmsg');
    for(var i=0; i<wmsgs.length; i++){
      var w = wmsgs[i];
      w.style.opacity = '1';
      await sleep(90);
      w.style.opacity = '0.1';
      await sleep(60);
      w.style.opacity = '1';
      await sleep(80);
      w.style.opacity = '0.15';
      await sleep(50);
      w.style.opacity = '1';
      await sleep(200);
    }
    /* All flash simultaneously */
    overlay.style.background = '#440022';
    await sleep(80);
    overlay.style.background = '#000';
    await sleep(80);
    overlay.style.background = '#440022';
    await sleep(80);
    overlay.style.background = '#000';
    await sleep(300);

    /* ─ Phase 3 : Protocol GODZILLA ─ */
    overlay.innerHTML = buildGodzillaProtocol(cfg);
    await sleep(200);

    var msgEl  = overlay.querySelector('.vip-typetext');
    var skipEl = overlay.querySelector('.vip-skip');

    if(msgEl){
      msgEl.style.opacity = '1';
      await typewriter(msgEl, cfg.msg, cfg.color);
    }

    await sleep(2000);
    if(skipEl){ skipEl.style.opacity = '1'; }

    await Promise.race([ waitClick(overlay), sleep(6000) ]);
  }

  /* ═══════════════════════════════════
     TYPEWRITER
  ═══════════════════════════════════ */
  async function typewriter(el, text, color){
    var lines = text.split('\n');
    el.innerHTML = '';
    var cursor = '<span class="vip-cur">▋</span>';

    for(var li=0; li<lines.length; li++){
      if(li>0){
        el.innerHTML = el.innerHTML.replace(cursor,'') + '<br>';
      }
      var line = lines[li];
      for(var ci=0; ci<line.length; ci++){
        el.innerHTML = el.innerHTML.replace(cursor,'') + escHtmlChar(line[ci]) + cursor;
        await sleep(Math.random()*45+18);
      }
      await sleep(120);
    }
    /* Remove cursor */
    el.innerHTML = el.innerHTML.replace(cursor,'');
  }

  function escHtmlChar(c){
    if(c==='<') return '&lt;';
    if(c==='>') return '&gt;';
    if(c==='&') return '&amp;';
    if(c==='"') return '&quot;';
    return c;
  }

  function waitClick(el){
    return new Promise(function(r){ el.addEventListener('click',r,{once:true}); });
  }

  /* ═══════════════════════════════════
     HTML BUILDERS
  ═══════════════════════════════════ */
  function buildJarvisHTML(cfg){
    var c = cfg.color;
    var cr = cfg.ringColor || c;
    return [
      '<div class="vip-jarvis-wrap" style="--vip-c:'+c+';--vip-cr:'+cr+'">',
        /* Fond ambiante */
        '<div class="vip-ambient"></div>',
        /* Grille HUD */
        '<div class="vip-grid-overlay"></div>',
        /* Scan line */
        '<div class="vip-scan" style="opacity:0;top:-4px"></div>',
        /* Coins */
        '<div class="vip-corner vip-tl"></div>',
        '<div class="vip-corner vip-tr"></div>',
        '<div class="vip-corner vip-bl"></div>',
        '<div class="vip-corner vip-br"></div>',
        /* Lignes HUD horizontales */
        '<div class="vip-hud-lines">',
          '<div class="vip-hud-line"></div>',
          '<div class="vip-hud-line"></div>',
          '<div class="vip-hud-line"></div>',
        '</div>',
        /* Centre */
        '<div class="vip-center">',
          '<div class="vip-rings">',
            '<div class="vip-ring vip-ring-a"></div>',
            '<div class="vip-ring vip-ring-b"></div>',
            '<img src="img/logo-jaharta.svg" class="vip-logo-img" alt="" style="opacity:0.2">',
          '</div>',
          '<div class="vip-subtitle-text" style="opacity:0;transform:translateY(8px)">'+cfg.subtitle+'</div>',
          '<div class="vip-typetext" style="opacity:0;color:'+c+'"></div>',
        '</div>',
        /* Data nodes décoratifs */
        '<div class="vip-data-nodes">',
          '<span>SYS : ONLINE</span>',
          '<span>NEXUS : STABLE</span>',
          '<span>AUTH : VIP</span>',
          '<span>SEC : LEVEL MAX</span>',
        '</div>',
        /* Skip */
        '<div class="vip-skip" style="opacity:0">[ CLIQUER POUR IGNORER ]</div>',
      '</div>'
    ].join('');
  }

  function buildVideoHTML(cfg){
    return [
      '<div style="width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;position:relative">',
        '<video id="vip-gzl-video" style="width:100%;height:100%;object-fit:cover;display:none;opacity:1;transition:opacity 0.4s" playsinline></video>',
        '<div class="vip-skip" style="opacity:0.5;bottom:24px;left:50%;transform:translateX(-50%);position:absolute">[ CLIQUER POUR IGNORER ]</div>',
      '</div>'
    ].join('');
  }

  function buildWarningHTML(){
    var msgs = [
      '⚠ ANOMALIE DETEXTEE — SIGNATURE BIOMETRIQUE INCONNUE',
      '⚠ NIVEAU DE PUISSANCE DEPASSE LE SEUIL CRITIQUE',
      '⚠⚠ ALERTE PROTOCOLE SECURITE — CLASSE OMEGA',
      '!!!! ENTITE KAIJUU IDENTIFIEE !!!!',
      '⚠⚠⚠ SYSTEME EN SURCHARGE — PROTOCOLE D\'URGENCE ⚠⚠⚠',
      '[ PROTOCOL GODZILLA — INITIALISATION... ]'
    ];
    return [
      '<div style="width:100%;height:100%;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:2rem">',
        msgs.map(function(m){
          return '<div class="vip-wmsg" style="opacity:0;font-family:\'Rajdhani\',sans-serif;font-size:clamp(.8rem,2.5vw,1.4rem);font-weight:700;letter-spacing:.12em;color:#ff00cc;text-shadow:0 0 16px #ff00cc,0 0 32px #ff00cc80;text-align:center">'+m+'</div>';
        }).join(''),
      '</div>'
    ].join('');
  }

  function buildGodzillaProtocol(cfg){
    var c = cfg.color;
    return [
      '<div class="vip-gzl-protocol" style="--vip-c:'+c+'">',
        /* Fond noir avec pulsing pink borders */
        '<div class="vip-gzl-border-tl"></div>',
        '<div class="vip-gzl-border-tr"></div>',
        '<div class="vip-gzl-border-bl"></div>',
        '<div class="vip-gzl-border-br"></div>',
        '<div class="vip-gzl-scanh"></div>',
        /* Centre */
        '<div class="vip-center">',
          '<div class="vip-gzl-icon">🦎</div>',
          '<div class="vip-gzl-label">PROTOCOL GODZILLA</div>',
          '<div class="vip-typetext" style="opacity:0;font-family:\'Rajdhani\',sans-serif;color:'+c+'"></div>',
        '</div>',
        '<div class="vip-skip" style="opacity:0">[ CLIQUER POUR IGNORER ]</div>',
      '</div>'
    ].join('');
  }

  /* ═══════════════════════════════════
     DYNAMIC BACKGROUND (banner images)
  ═══════════════════════════════════ */
  window.applyBannerDynBg = function(banners){
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
    if(b2 && active[1]){
      b2.style.backgroundImage = "url('" + active[1].image + "')";
      b2.style.opacity = '1';
    }
    dyn.style.opacity = '1';
  };

  function applyGodzillaBg(imgUrl, color){
    /* Override le background dynamique avec l'image Godzilla */
    var dyn = document.getElementById('banner-dyn-bg');
    if(!dyn) return;
    var b1 = dyn.querySelector('.bdg-1');
    var b2 = dyn.querySelector('.bdg-2');
    if(b1){
      b1.style.backgroundImage = "url('"+imgUrl+"')";
      b1.style.maskImage        = 'none';
      b1.style.webkitMaskImage  = 'none';
      b1.style.opacity          = '1';
    }
    if(b2){
      b2.style.backgroundImage = "url('"+imgUrl+"')";
      b2.style.maskImage        = 'none';
      b2.style.webkitMaskImage  = 'none';
      b2.style.opacity          = '1';
    }
    dyn.style.opacity = '1';
    /* Ajouter teinte rose sur le site */
    document.body.classList.add('vip-godzilla-theme');
    /* Overlay rose dans body */
    var ol = document.createElement('div');
    ol.id = 'vip-pink-overlay';
    ol.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;background:linear-gradient(135deg,rgba(255,0,120,0.06),rgba(100,0,80,0.10),transparent 60%);animation:gzlPulse 4s ease-in-out infinite';
    document.body.insertBefore(ol, document.body.firstChild);
  }

})();

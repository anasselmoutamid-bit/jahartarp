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
  /* Override owner : le créateur peut sélectionner une autre animation
     ou désactiver l'intro pour la session courante.
     Source : localStorage.gacha_owner_anim_override valeurs :
       null / 'default'      → anim par défaut de son ID
       'off'                 → aucune intro
       autre ID VIP_CONFIG  → joue cette anim à la place */
  var OWNER_ID = '372065190142803982';

  window.triggerVIPIntro = async function(userId){
    var id  = String(userId);
    if (id === OWNER_ID) {
      var ov = null;
      try { ov = localStorage.getItem('gacha_owner_anim_override'); } catch(_){}
      if (ov === 'off') return;
      if (ov && ov !== 'default' && VIP_CONFIG[ov]) {
        id = ov;
      }
    }
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

    /* ─ Phase 2 : Pseudo-terminaux de détection ─ */
    ov.innerHTML = [
      '<div id="vgz-warn" class="vgz-termfield" style="--c:'+c+';--crgb:'+(cfg.colorRgb||'255,0,110')+'">',
        '<div class="vgz-termfield-bg"></div>',
        '<div class="vgz-termfield-scan"></div>',
        _terminalShells(c, cfg.colorRgb||'255,0,110'),
      '</div>'
    ].join('');

    await sleep(60);
    /* Animation : 17 terminaux avec cadence ACCÉLÉRÉE
       (lent au début → de plus en plus rapide vers la fin)
       + glitches partout */
    var terms = ov.querySelectorAll('.vgz-term');
    var typePromises = [];
    var isMobile = window.matchMedia('(max-width:880px)').matches;

    /* Pré-calcul des cumulative spawn times — gap décroissant linéaire
       gap 0→1 = 720ms, gap 15→16 = 25ms (accélération forte) */
    var spawnTimes = [0];
    var startGap = 720;
    var endGap   = 25;
    var N = terms.length;
    for(var s=1; s<N; s++){
      var prog = (s-1) / Math.max(1, N-2);  /* 0..1 */
      var gap  = startGap - (startGap - endGap) * prog;
      spawnTimes.push(spawnTimes[s-1] + gap);
    }

    /* Typewriter speed scales avec l'urgence : derniers panneaux tapent plus vite */
    for(var i=0;i<terms.length;i++){
      (function(term, idx){
        var urgency = idx / (N-1);  /* 0..1 */
        var charMs  = 8 - 6*urgency;  /* 8ms → 2ms */
        var lineGap = 70 - 55*urgency; /* 70ms → 15ms */
        var glitches = 3 + Math.floor(urgency * 4); /* 3 → 7 flickers */
        typePromises.push((async function(){
          await sleep(spawnTimes[idx]);
          term.classList.add('vgz-term-on');
          if(isMobile){
            try{ term.scrollIntoView({behavior:'smooth', block:'center'}); }catch(_){}
          }
          /* Glitch d'apparition (plus violent quand l'urgence monte) */
          for(var g=0;g<glitches;g++){
            term.style.opacity = '1';
            await sleep(18 + Math.random()*15);
            term.style.opacity = String(0.1 + Math.random()*0.4);
            await sleep(10 + Math.random()*15);
          }
          term.style.opacity = '1';
          /* Typewriter par ligne */
          var body = term.querySelector('.vgz-term-body');
          if(!body) return;
          var lines = body.querySelectorAll('.vgz-tl');
          for(var k=0;k<lines.length;k++){
            var ln = lines[k];
            var full = ln.getAttribute('data-text') || '';
            ln.style.opacity = '1';
            for(var ci=0;ci<full.length;ci++){
              /* Corruption aléatoire pendant la frappe (urgence haute) */
              if(urgency > 0.4 && Math.random() < 0.08){
                var noise = '▓░▒█▌▍▎▏'.charAt(Math.floor(Math.random()*8));
                ln.textContent = full.slice(0, ci) + noise;
                await sleep(charMs * 0.6);
              }
              ln.textContent = full.slice(0, ci+1);
              await sleep(charMs + Math.random()*charMs);
            }
            if(k < lines.length-1) await sleep(lineGap + Math.random()*lineGap*0.6);
          }
          var cur = term.querySelector('.vgz-term-cursor');
          if(cur) cur.style.opacity = '1';
        })());
      })(terms[i], i);
    }
    await Promise.all(typePromises);

    /* Flash global rouge-magenta */
    var bk = ov.querySelector('#vgz-warn');
    if(bk){
      var bgo = bk.querySelector('.vgz-termfield-bg');
      for(var f=0;f<4;f++){
        if(bgo) bgo.style.background = 'rgba(255,0,110,.18)';
        await sleep(60);
        if(bgo) bgo.style.background = 'transparent';
        await sleep(60);
      }
    }
    await sleep(280);

    /* ─ Phase 3 : Protocole GODZILLA (msg = glitch DarkNexusNet) ─ */
    var msgLines = String(cfg.msg||'').split('\n');
    var msgHtml = msgLines.map(function(l){
      var t = esc(l);
      return '<div class="vgz-glitch-line"><span class="vgz-glitch-text" data-text="'+t+'">'+t+'</span></div>';
    }).join('');

    ov.innerHTML = [
      '<div class="vgz-proto" style="--c:'+c+';--crgb:'+cfg.colorRgb+'">',
        '<div class="vgz-bdr vgz-bdr-tl"></div>',
        '<div class="vgz-bdr vgz-bdr-tr"></div>',
        '<div class="vgz-bdr vgz-bdr-bl"></div>',
        '<div class="vgz-bdr vgz-bdr-br"></div>',
        '<div class="vgz-scanv"></div>',
        '<div class="vgz-ambient"></div>',
        '<div class="vjw-center">',
          '<div class="vgz-icon">🦖</div>',
          '<div class="vgz-label">PROTOCOL GODZILLA</div>',
          '<div class="vgz-msg-glitch" id="vgz-msg" style="opacity:0">'+ msgHtml +'</div>',
        '</div>',
        '<div class="vjw-skip vjw-skip-on">[ CLIQUER POUR PASSER ]</div>',
      '</div>'
    ].join('');

    await sleep(300);

    var msgEl = ov.querySelector('#vgz-msg');
    if(msgEl){
      msgEl.style.opacity = '1';
    }

    await sleep(2400);
    await Promise.race([ waitClick(ov), sleep(6500) ]);
  }

  /* Pseudo-terminaux glitchés pour la phase 2 Godzilla — 17 panneaux
     Grid 4x4 + finale, sans rotation, léger chevauchement
     (vrai système d'alerte du site) */
  function _terminalShells(c, crgb){
    /* Positions : 4 colonnes × 4 rangées avec chevauchement intentionnel
       cols at 1%, 25%, 49%, 73% (chacun ~26% large = 1% chevauchement avec voisin)
       rows at 1.5%, 21%, 40.5%, 60% (chacun ~22% haut = ~2.5% chevauchement) */
    var defs = [
      /* Rang 1 */
      { pos:'top:1.5%;left:1%',  title:'sys/sensors/biometric.log', cls:'tlvl-a',
        lines:[
          {k:'cmd', t:'$ ./scan --target=anomaly'},
          {k:'info',t:'[INFO] initializing sweep...'},
          {k:'err', t:'[FAIL] signature UNKNOWN'}
        ]},
      { pos:'top:1.5%;left:25%', title:'radar/wide_sweep.log', cls:'tlvl-a',
        lines:[
          {k:'cmd', t:'$ radar --range=80km'},
          {k:'info',t:'scanning...'},
          {k:'warn',t:'[!!] mass detected @ 4.2km'},
          {k:'err', t:'[!!] mass: > 80,000 tons'}
        ]},
      { pos:'top:1.5%;left:49%', title:'core/power.dat', cls:'tlvl-b',
        lines:[
          {k:'cmd', t:'$ powermon --rt'},
          {k:'warn',t:'> 8924.31 PU  (+12%)'},
          {k:'warn',t:'> 12407.88 PU (+39%)'},
          {k:'err', t:'> OVERFLOW'}
        ]},
      { pos:'top:1.5%;left:73%', title:'thermal/heat.log', cls:'tlvl-b',
        lines:[
          {k:'cmd', t:'$ tempread --core'},
          {k:'info',t:'baseline: 21.4 C'},
          {k:'warn',t:'spike: 412 C'},
          {k:'err', t:'[!!] EXTREME HEAT'}
        ]},
      /* Rang 2 */
      { pos:'top:21%;left:1%',   title:'seismic/quake.dat', cls:'tlvl-a',
        lines:[
          {k:'cmd', t:'$ seismograph --live'},
          {k:'warn',t:'M2.4 ... M4.1 ... M6.8'},
          {k:'err', t:'[!!] pattern: BIPED'}
        ]},
      { pos:'top:21%;left:25%',  title:'ai/predict.py', cls:'tlvl-b',
        lines:[
          {k:'cmd', t:'$ python predict.py'},
          {k:'info',t:'loading model... 86%'},
          {k:'err', t:'TypeError: undefined class'},
          {k:'err', t:'  raise OmegaException'}
        ]},
      { pos:'top:21%;left:49%',  title:'kernel/threat_class.sh', cls:'tlvl-a',
        lines:[
          {k:'cmd', t:'$ classify $ENTITY'},
          {k:'warn',t:'[!!] candidate: ALPHA'},
          {k:'warn',t:'[!!] candidate: SIGMA'},
          {k:'err', t:'[!!!] CLASS OMEGA'}
        ]},
      { pos:'top:21%;left:73%',  title:'archive/mythos.db', cls:'tlvl-c',
        lines:[
          {k:'cmd', t:'$ db.query("uid=?")'},
          {k:'info',t:'fetching...'},
          {k:'err', t:'>>> KAIJUU SAMA <<<'}
        ]},
      /* Rang 3 */
      { pos:'top:40.5%;left:1%',  title:'sentinel/visual.id', cls:'tlvl-c',
        lines:[
          {k:'cmd', t:'$ visual_id --cam=07'},
          {k:'err', t:'>>> CLASS: GODZILLA <<<'}
        ]},
      { pos:'top:40.5%;left:25%', title:'network/comms.log', cls:'tlvl-b',
        lines:[
          {k:'cmd', t:'$ ping --all-nodes'},
          {k:'warn',t:'node 04 ... TIMEOUT'},
          {k:'warn',t:'node 08 ... TIMEOUT'},
          {k:'err', t:'[!!] network collapse'}
        ]},
      { pos:'top:40.5%;left:49%', title:'defense/shield.cfg', cls:'tlvl-b',
        lines:[
          {k:'cmd', t:'$ shield --status'},
          {k:'warn',t:'integrity: 74%'},
          {k:'warn',t:'integrity: 38%'},
          {k:'err', t:'[!!] SHIELD COLLAPSE'}
        ]},
      { pos:'top:40.5%;left:73%', title:'alarm/siren.sh', cls:'tlvl-c',
        lines:[
          {k:'cmd', t:'$ siren --trigger=all'},
          {k:'err', t:'!! SIREN ACTIVE !!'},
          {k:'err', t:'!! ALL DISTRICTS !!'}
        ]},
      /* Rang 4 */
      { pos:'top:60%;left:1%',   title:'backup/init.sh', cls:'tlvl-a',
        lines:[
          {k:'cmd', t:'$ backup --mode=panic'},
          {k:'info',t:'snapshotting...'},
          {k:'warn',t:'partial: 41%'}
        ]},
      { pos:'top:60%;left:25%',  title:'command/eval.txt', cls:'tlvl-b',
        lines:[
          {k:'cmd', t:'$ tail -f command.log'},
          {k:'warn',t:'cmd: HOLD POSITION'},
          {k:'err', t:'cmd: ABORT — RETREAT'}
        ]},
      { pos:'top:60%;left:49%',  title:'evac/protocol.sh', cls:'tlvl-c',
        lines:[
          {k:'cmd', t:'$ evac --district=all'},
          {k:'err', t:'>>> CIVILIAN EVAC <<<'}
        ]},
      { pos:'top:60%;left:73%',  title:'lockdown/seal.sh', cls:'tlvl-c',
        lines:[
          {k:'cmd', t:'$ lockdown --level=omega'},
          {k:'err', t:'GATES SEALED'},
          {k:'err', t:'[!!] CITY ISOLATED'}
        ]},
      /* Finale (bas, centré, large) */
      { pos:'bottom:1.5%;left:50%',
        title:'emergency/protocol.exec', cls:'tlvl-c', wide:true,
        lines:[
          {k:'cmd', t:'$ sudo activate --protocol=GODZILLA --force'},
          {k:'info',t:'requesting authorization...'},
          {k:'warn',t:'AUTHORIZATION GRANTED'},
          {k:'err', t:'[ INITIALIZING PROTOCOL GODZILLA... ]'}
        ]}
    ];

    return defs.map(function(d, i){
      var head =
        '<div class="vgz-term-head">'+
          '<div class="vgz-term-dots">'+
            '<span class="vgz-d vgz-d1"></span>'+
            '<span class="vgz-d vgz-d2"></span>'+
            '<span class="vgz-d vgz-d3"></span>'+
          '</div>'+
          '<div class="vgz-term-title">'+ esc(d.title) +'</div>'+
          '<div class="vgz-term-tag">// ALERT</div>'+
        '</div>';

      var body = d.lines.map(function(l){
        var cls = 'vgz-tl vgz-tl-'+l.k;
        return '<div class="'+cls+'" data-text="'+ esc(l.t) +'" style="opacity:0"></div>';
      }).join('');

      /* z-index croissant pour que les derniers se posent au-dessus */
      var style = d.pos + ';z-index:'+(20+i);
      var wide  = d.wide ? ' vgz-term-wide' : '';
      return (
        '<div class="vgz-term '+ d.cls + wide +'" style="'+ style +';opacity:0">'+
          head +
          '<div class="vgz-term-body">'+ body +
            '<span class="vgz-term-cursor" style="opacity:0">▋</span>'+
          '</div>'+
        '</div>'
      );
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


/* ═══════════════════════════════════════════════════════════════
   race-popup-v4.js — HUD Cyberpunk Frame + Canvas Radar + Particles
   ═══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  var DEFAULT_FIELDS = {
    name:'',plural:'',category:'',longevity:'',
    affinity:'',access:'Ouverte',description:'',imageUrl:'',
    baseStats:{str:0,agi:0,spd:0,int:0,mana:0,res:0,cha:0,aura:0},
    basePowers:[]
  };

  var racesData = {};
  var isAdmin = false;
  var db = null;
  var initialized = false;
  var _rafPortrait = null;
  var _rafDots = null;

  window.initRacePopups = function(_db, _isAdmin) {
    // Accepter une mise à jour de db même si déjà initialisé
    if (_db) db = _db;
    isAdmin = !!_isAdmin;
    if (!initialized) {
      bindRaceCards();
      initialized = true;
    }
    // Toujours (re)charger les données si on a un db — même après init
    if (db) loadRacesData();
  };

  window.updateRaceAdmin = function(v, _db) {
    isAdmin = !!v;
    if (_db) db = _db;
    // Afficher/cacher le bloc admin si un popup est déjà ouvert
    var block = document.getElementById('rp4-admin-block');
    if (block) block.style.display = v ? '' : 'none';
    // Rebinder le bouton save si maintenant admin
    if (v) {
      var saveBtn = document.querySelector('.rp4-save');
      if (saveBtn && !saveBtn._bound) {
        var ov = document.getElementById('rp-overlay');
        var nameEl = ov && ov.querySelector('.rp4-title');
        var raceName = nameEl ? nameEl.textContent.trim() : '';
        if (raceName) {
          saveBtn._bound = true;
          saveBtn.addEventListener('click', function() { doSave(raceName, ov, saveBtn); });
        }
      }
    }
  };

  function loadRacesData() {
    if (!db || !window._doc || !window._getDoc) {
      window._dbg?.warn('[races] Firebase non prêt, chargement différé.');
      return;
    }
    // Utilise le cache global JCache pour éviter les reads redondants
    (window.JCache
      ? window.JCache.getModular(window._getDoc, window._doc, db, 'config', 'races_data', 600)
      : window._getDoc(window._doc(db,'config','races_data')).then(function(snap){return snap.exists()?snap.data():null;})
    ).then(function(d) {
      if (!d) {
        window._dbg?.warn('[races] config/races_data introuvable — vérifier Firestore.');
        return;
      }
      var STAT_MAP = {strength:'str',agility:'agi',speed:'spd',intelligence:'int',mana:'mana',resistance:'res',charisma:'cha',aura:'aura'};
      Object.keys(d).forEach(function(raceName) {
        if (typeof d[raceName] !== 'object' || d[raceName] === null) return;
        var raw = d[raceName];
        var entry = Object.assign({}, raw);
        if (raw.strength !== undefined && !raw.baseStats) {
          var bs = {};
          Object.keys(STAT_MAP).forEach(function(botKey) {
            bs[STAT_MAP[botKey]] = parseInt(raw[botKey]) || 0;
          });
          entry.baseStats = bs;
        }
        if (Array.isArray(entry.affinity)) {
          entry.affinity = entry.affinity.join(', ');
        }
        if (!entry.basePowers) entry.basePowers = [];
        racesData[raceName] = entry;
      });
    }).catch(function(e) {
      window._dbg?.error('[races] Erreur chargement config/races_data :', e.code||'', e.message);
    });
  }

  function saveRaceData(name, data) {
    if (!db) return Promise.reject(new Error('Firebase non initialisé'));
    if (!window._setDoc || !window._doc) return Promise.reject(new Error('_setDoc non disponible'));
    var update = {};
    update[name] = data;
    return window._setDoc(
      window._doc(db, 'config', 'races_data'),
      update,
      { merge: true }
    ).then(function() {
    }).catch(function(e) {
      window._dbg?.error('[races] Erreur sauvegarde :', e.code, e.message);
      return Promise.reject(e);
    });
  }

  function bindRaceCards() {
    document.querySelectorAll('.race-card').forEach(function(card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function() {
        var name = card.querySelector('.race-name') && card.querySelector('.race-name').textContent.trim();
        if (name) openRacePopup(name, card.style.getPropertyValue('--rc') || '#00e5ff');
      });
    });
  }
  window.rebindRaceCards = bindRaceCards;

  /* ── Open ── */
  function openRacePopup(raceName, accent) {
    var old = document.getElementById('rp-overlay');
    if (old) { cancelAnimationFrame(_rafPortrait); clearInterval(_rafDots); old.remove(); }
    var data = Object.assign({}, DEFAULT_FIELDS, racesData[raceName] || {});
    var overlay = document.createElement('div');
    overlay.id = 'rp-overlay';
    overlay.className = 'rp-ov';
    overlay.innerHTML = buildHTML(raceName, data, accent);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { overlay.classList.add('rp-open'); });
    });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closePopup(); });
    overlay.querySelector('.rp-x').addEventListener('click', closePopup);
    var saveBtn = overlay.querySelector('.rp4-save');
    if (saveBtn) saveBtn.addEventListener('click', function() { doSave(raceName, overlay, saveBtn); });
    // Boot animations after DOM paint
    setTimeout(function() { bootCanvases(data, accent); bootDots(); }, 60);
  }

  /* ── Close ── */
  function closePopup() {
    var ov = document.getElementById('rp-overlay');
    if (!ov) return;
    cancelAnimationFrame(_rafPortrait);
    clearInterval(_rafDots);
    ov.classList.remove('rp-open');
    ov.classList.add('rp-closing');
    document.body.style.overflow = '';
    setTimeout(function() { ov.remove(); }, 450);
  }

  /* ══════════════════════════════════════════
     BUILD HTML
  ══════════════════════════════════════════ */
  function buildHTML(name, d, ac) {
    var powers = d.basePowers || [];
    var stats = d.baseStats || {};
    var SK = ['str','agi','spd','int','mana','res','cha','aura'];
    var SL = ['STR','AGI','SPD','INT','MNA','RES','CHA','AUR'];
    var SC = ['#FF4757','#00e5ff','#44ff88','#60a5fa','#b44aff','#ffd60a','#f97316','#e040fb'];
    var accessColor = d.access === 'Ouverte' ? '#00ff88' : '#ffd60a';
    var accessLabel = d.access || 'Ouverte';
    var catLabel = d.category || '';
    var idx = name.charCodeAt(0) % 99 + 1;

    /* Portrait */
    var portraitInner = d.imageUrl
      ? '<img src="'+d.imageUrl+'" style="width:100%;height:100%;object-fit:cover;object-position:top center;position:absolute;inset:0;">'
      : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Orbitron,sans-serif;font-size:64px;font-weight:900;color:'+ac+'18;z-index:1;">'+name[0]+'</div>';

    /* Powers */
    var powHTML = powers.length > 0
      ? powers.map(function(p,pi) {
          var pc = SC[pi % SC.length];
          return '<div class="rp4-pw" style="--pwc:'+pc+'">'
            +'<span class="rp4-pw-dot" style="background:'+pc+';box-shadow:0 0 6px '+pc+'"></span>'
            +'<div><span class="rp4-pw-n" style="color:'+ac+'">'+(p.name||p)+'</span>'
            +(p.desc ? '<span class="rp4-pw-d">'+p.desc+'</span>' : '')
            +'</div></div>';
        }).join('')
      : '<div class="rp4-empty">Aucun pouvoir de base enregistré.</div>';

    /* Vertical stat bars */
    var vbars = SK.map(function(k,i) {
      var v = Math.round((stats[k]||0));
      var pct = Math.round(Math.min(v,100));
      return '<div class="rp4-vb-wrap">'
        +'<span class="rp4-vb-val">'+v+'</span>'
        +'<div class="rp4-vb-track"><div class="rp4-vb-fill" data-pct="'+pct+'" style="background:linear-gradient(180deg,'+SC[i]+','+SC[i]+'44);box-shadow:0 -3px 8px '+SC[i]+'88;"></div></div>'
        +'<span class="rp4-vb-lbl">'+SL[i]+'</span>'
        +'</div>';
    }).join('');

    /* Admin */
    var adminHTML = '';
    // Toujours injecter le bloc admin dans le DOM, visible seulement si isAdmin
    {
      var adminVisible = isAdmin ? '' : 'display:none';
      adminHTML = '<div class="rp4-admin" id="rp4-admin-block" style="'+adminVisible+'">'
        +'<div class="rp4-admin-t">&#9656; MODE ADMIN</div>'
        +'<div class="rp4-admin-g">'
        +fi('rp-ed-name','Nom',d.name||name)+fi('rp-ed-plural','Pluriel',d.plural||name+'s')
        +fi('rp-ed-category','Cat\u00e9gorie',d.category||'')+fi('rp-ed-longevity','Long\u00e9vit\u00e9',d.longevity||'')
        +fi('rp-ed-affinity','Affinit\u00e9',d.affinity||'')
        +'<div class="rp4-fg"><label class="rp4-fl">Acc\u00e8s</label><select class="rp4-fi" id="rp-ed-access">'
        +'<option value="Ouverte"'+(d.access==='Ouverte'?' selected':'')+'>Ouverte</option>'
        +'<option value="Sous conditions"'+(d.access!=='Ouverte'?' selected':'')+'>Sous conditions</option>'
        +'</select></div></div>'
        +'<div class="rp4-fg"><label class="rp4-fl">Image (URL)</label><input class="rp4-fi" id="rp-ed-image" value="'+(d.imageUrl||'').replace(/"/g,'&quot;')+'" placeholder="https://..."></div>'
        +'<div class="rp4-fg"><label class="rp4-fl">Description</label><textarea class="rp4-fta" id="rp-ed-desc" placeholder="Supporte le **markdown** Discord">'+sanitize(d.description||'')+'</textarea></div>'
        +'<div class="rp4-fg"><label class="rp4-fl">Stats de base</label><div class="rp4-stats-edit" id="rp4-stats-edit">'
        +(function(){var SK=['str','agi','spd','int','mana','res','cha','aura'],SL=['STR','AGI','SPD','INT','MNA','RES','CHA','AUR'],bs=d.baseStats||{};return SK.map(function(k,i){return '<div class="rp4-stat-ed"><span class="rp4-stat-ed-lbl">'+SL[i]+'</span><input class="rp4-fi rp4-stat-input" type="number" value="'+(bs[k]||0)+'" data-stat="'+k+'"></div>'}).join('')})()
        +'</div></div>'
        +'<div class="rp4-fg"><label class="rp4-fl">Pouvoirs de base</label><div id="rp4-powers-edit">'
        +(d.basePowers||[]).map(function(p,i){return '<div class="rp4-pw-row" data-pw-idx="'+i+'"><div class="rp4-fg" style="flex:1;margin-bottom:0"><input class="rp4-fi" placeholder="Nom" value="'+((p.name||p||'').replace?((p.name||p||'').replace(/"/g,'&quot;')):'') +'" data-pk="name"></div><div class="rp4-fg" style="flex:2;margin-bottom:0"><input class="rp4-fi" placeholder="Description" value="'+((p.desc||'').replace?((p.desc||'').replace(/"/g,'&quot;')):'') +'" data-pk="desc"></div><button type="button" class="rp4-pw-rm" onclick="this.parentElement.remove()">✕</button></div>'}).join('')
        +'</div><button type="button" class="rp4-pw-add" onclick="window._addRp4Power()">+ Ajouter un pouvoir</button></div>'
        +'<button class="rp4-save">Sauvegarder</button>'
        +'</div>';
    }

    return ''
      /* Overlay inner wrapper */
      +'<div class="rp4-outer">'
      /* Corner decorations */
      +'<div class="rp4-ce tl"></div><div class="rp4-ce tr"></div>'
      +'<div class="rp4-ce bl"></div><div class="rp4-ce br"></div>'
      /* Close */
      +'<button class="rp-x">\u2715</button>'
      /* Popup */
      +'<div class="rp4-popup">'
      /* Noise overlay */
      +'<div class="rp4-noise"></div>'
      /* Scan line */
      +'<div class="rp4-scan"></div>'
      /* Top accent bar */
      +'<div class="rp4-topbar" style="background:linear-gradient(90deg,transparent,'+ac+',#ff2d78,'+ac+',transparent)"></div>'
      /* ── HEADER ── */
      +'<div class="rp4-header">'
        /* Portrait */
        +'<div class="rp4-portrait-wrap" id="rp4-portrait-wrap">'
          +portraitInner
          +'<div class="rp4-portrait-grid"></div>'
          +'<canvas id="rp4-portrait-canvas"></canvas>'
          +'<div class="rp4-portrait-ov"></div>'
          +'<svg class="rp4-reticle" viewBox="0 0 60 60" fill="none">'
            +'<circle cx="30" cy="30" r="27" stroke="'+ac+'" stroke-width="0.5" opacity="0.2"/>'
            +'<circle cx="30" cy="30" r="18" stroke="'+ac+'" stroke-width="0.5" opacity="0.15"/>'
            +'<line x1="30" y1="3" x2="30" y2="12" stroke="'+ac+'" stroke-width="0.8" opacity="0.4"/>'
            +'<line x1="30" y1="48" x2="30" y2="57" stroke="'+ac+'" stroke-width="0.8" opacity="0.4"/>'
            +'<line x1="3" y1="30" x2="12" y2="30" stroke="'+ac+'" stroke-width="0.8" opacity="0.4"/>'
            +'<line x1="48" y1="30" x2="57" y2="30" stroke="'+ac+'" stroke-width="0.8" opacity="0.4"/>'
            +'<circle cx="30" cy="30" r="2.5" fill="'+ac+'" opacity="0.5"/>'
            +'<circle cx="30" cy="30" r="5" stroke="#ff2d78" stroke-width="0.5" opacity="0.4"/>'
          +'</svg>'
          +'<div class="rp4-portrait-readout">'
            +'<span>ID: JHT-'+String(idx).padStart(3,'0')+'</span>'
            +'<span>SCAN: 98.'+Math.floor(Math.random()*9+1)+'%</span>'
            +'<span>STS: ACTIVE</span>'
          +'</div>'
        +'</div>'
        /* Center info */
        +'<div class="rp4-center">'
          +'<div class="rp4-id-row">'
            +'<span class="rp4-id" style="color:'+ac+';border-color:'+ac+'44;background:'+ac+'0a">#'+String(idx).padStart(2,'0')+'</span>'
            +(catLabel ? '<span class="rp4-cat">'+catLabel.toUpperCase()+'</span>' : '')
            +'<span class="rp4-access" style="color:'+accessColor+';border-color:'+accessColor+'33;background:'+accessColor+'08">&#9670; '+accessLabel.toUpperCase()+'</span>'
          +'</div>'
          +'<div class="rp4-title-wrap">'
            +'<div class="rp4-title-glow" style="color:'+ac+'">'+name.toUpperCase()+'</div>'
            +'<div class="rp4-title">'+name.toUpperCase()+'</div>'
          +'</div>'
          +(d.plural ? '<div class="rp4-subtitle">Pluriel : '+d.plural+'</div>' : '')
          +'<div class="rp4-meta-grid">'
            +'<div class="rp4-mc" style="--mca:'+ac+'"><span class="rp4-ml">Long\u00e9vit\u00e9</span><span class="rp4-mv" style="color:'+ac+'">'+(d.longevity||'—')+'</span></div>'
            +'<div class="rp4-mc" style="--mca:'+ac+'"><span class="rp4-ml">Affinit\u00e9</span><span class="rp4-mv" style="color:'+ac+'">'+(d.affinity||'—')+'</span></div>'
            +'<div class="rp4-mc" style="--mca:'+ac+'"><span class="rp4-ml">Acc\u00e8s</span><span class="rp4-mv" style="color:'+accessColor+'">'+accessLabel+'</span></div>'
            +'<div class="rp4-mc" style="--mca:'+ac+'"><span class="rp4-ml">Groupe</span><span class="rp4-mv" style="color:'+ac+'">'+(catLabel||'—')+'</span></div>'
          +'</div>'
        +'</div>'
        /* Radar panel */
        +'<div class="rp4-radar-panel">'
          +'<div class="rp4-rlbl">STATS DE BASE</div>'
          +'<canvas id="rp4-radar" width="164" height="164"></canvas>'
        +'</div>'
      +'</div>'
      /* ── BODY 3 cols ── */
      +'<div class="rp4-body">'
        /* Description */
        +'<div class="rp4-col">'
          +'<div class="rp4-stitle">Description</div>'
          +'<div class="rp4-desc" style="border-color:'+ac+'40">'+(window.parseDiscordMarkdown ? window.parseDiscordMarkdown(d.description||'Aucune description disponible pour cette race.', ac) : (d.description||'Aucune description disponible pour cette race.'))+'</div>'
        +'</div>'
        +'<div class="rp4-divider"></div>'
        /* Powers */
        +'<div class="rp4-col">'
          +'<div class="rp4-stitle">Pouvoirs de base</div>'
          +'<div class="rp4-powers">'+powHTML+'</div>'
        +'</div>'
        +'<div class="rp4-divider"></div>'
        /* Stat bars */
        +'<div class="rp4-col rp4-stats-col">'
          +'<div class="rp4-stitle">Statistiques</div>'
          +'<div class="rp4-vbars" id="rp4-vbars">'+vbars+'</div>'
        +'</div>'
      +'</div>'
      /* ── BOTTOMBAR ── */
      +'<div class="rp4-bottom">'
        +'<span class="rp4-bdb">JAHARTA_DB \u00b7 RACE_INDEX:'+String(idx).padStart(3,'0')+' \u00b7 v4.0</span>'
        +'<div class="rp4-bdots" id="rp4-bdots">'
          +'<div class="rp4-dot active"></div>'
          +'<div class="rp4-dot"></div><div class="rp4-dot"></div>'
          +'<div class="rp4-dot"></div><div class="rp4-dot"></div>'
        +'</div>'
        +'<div class="rp4-sig"><div style="height:8px"></div><div style="height:12px"></div><div style="height:18px"></div><div style="height:12px"></div><div style="height:8px"></div></div>'
        +'<span class="rp4-status">&#9670; ONLINE</span>'
      +'</div>'
      /* Admin */
      +adminHTML
      +'</div>' /* /.rp4-popup */
      +'</div>'; /* /.rp4-outer */
  }

  function fi(id,lbl,val){
    return '<div class="rp4-fg"><label class="rp4-fl">'+lbl+'</label><input class="rp4-fi" id="'+id+'" value="'+String(val==null?'':val).replace(/"/g,'&quot;')+'"></div>';
  }

  /* ══════════════════════════════════════════
     CANVAS ANIMATIONS
  ══════════════════════════════════════════ */
  function bootCanvases(data, ac) {
    /* — Portrait canvas — */
    var pw = document.getElementById('rp4-portrait-wrap');
    var pc = document.getElementById('rp4-portrait-canvas');
    if (pw && pc) {
      pc.width = pw.offsetWidth || 200;
      pc.height = pw.offsetHeight || 280;
      var ctx = pc.getContext('2d');
      function drawPortrait() {
        var W = pc.width, H = pc.height, t = Date.now()/1000;
        ctx.clearRect(0,0,W,H);
        var pulse = 0.5 + Math.sin(t*0.7)*0.15;
        var g = ctx.createRadialGradient(W/2,H*0.42,0,W/2,H*0.42,W*0.55);
        g.addColorStop(0,'rgba(0,229,255,'+(0.09*pulse)+')');
        g.addColorStop(0.6,'rgba(180,74,255,'+(0.04*pulse)+')');
        g.addColorStop(1,'transparent');
        ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
        /* Orbiting particles */
        for (var i=0;i<8;i++) {
          var a = t*0.5+(i/8)*Math.PI*2;
          var r = 28+Math.sin(t*0.4+i)*7;
          var px = W/2+Math.cos(a)*r, py = H*0.42+Math.sin(a)*r*0.38;
          var al = 0.3+Math.sin(t+i)*0.2;
          ctx.beginPath(); ctx.arc(px,py,1.5,0,Math.PI*2);
          ctx.fillStyle='rgba(0,229,255,'+al+')';
          ctx.shadowBlur=5; ctx.shadowColor='#00e5ff';
          ctx.fill(); ctx.shadowBlur=0;
        }
        /* Live readout */
        ctx.font='7px "Share Tech Mono",monospace'; ctx.textAlign='right';
        var freq = 850+Math.floor(Math.sin(t*2.2)*40);
        var psi  = 90+Math.floor(Math.sin(t*1.4)*4);
        var lines2 = ['FREQ: '+freq+' Hz','PSI: '+psi+'%','TRK: ON'];
        lines2.forEach(function(l,i2){
          if(Math.floor(t*2+i2)%6===0) return;
          ctx.fillStyle='rgba(0,229,255,'+(0.18+i2*0.06)+')';
          ctx.fillText(l,W-7,16+i2*12);
        });
        _rafPortrait = requestAnimationFrame(drawPortrait);
      }
      drawPortrait();
    }

    /* — Radar canvas — */
    var rc = document.getElementById('rp4-radar');
    if (!rc) return;
    var rctx = rc.getContext('2d');
    var CX=82,CY=82,R=62,N=8,A0=-Math.PI/2;
    var SK=['str','agi','spd','int','mana','res','cha','aura'];
    var SC=['#FF4757','#00e5ff','#44ff88','#60a5fa','#b44aff','#ffd60a','#f97316','#e040fb'];
    var SL=['STR','AGI','SPD','INT','MNA','RES','CHA','AUR'];
    var stats = data.baseStats||{};
    var maxV = Math.max.apply(null,SK.map(function(k){return stats[k]||0;}).concat([1]));
    var vals = SK.map(function(k){return (stats[k]||0)/maxV;});

    function rpt(i,r2){var a=A0+(i/N)*Math.PI*2;return[CX+Math.cos(a)*r2,CY+Math.sin(a)*r2];}

    var startT = null;
    function drawRadar(ts) {
      if(!startT) startT=ts;
      var prog = Math.min((ts-startT)/1000,1);
      var ease = 1-Math.pow(1-prog,3);
      rctx.clearRect(0,0,164,164);
      /* Grid */
      for(var ring=1;ring<=4;ring++){
        var rr=R*ring/4; rctx.beginPath();
        for(var i=0;i<N;i++){var p=rpt(i,rr);i===0?rctx.moveTo(p[0],p[1]):rctx.lineTo(p[0],p[1]);}
        rctx.closePath(); rctx.strokeStyle='rgba(0,229,255,0.06)'; rctx.lineWidth=0.5; rctx.stroke();
      }
      /* Axes */
      for(var i=0;i<N;i++){
        var ep=rpt(i,R); rctx.beginPath(); rctx.moveTo(CX,CY); rctx.lineTo(ep[0],ep[1]);
        rctx.strokeStyle='rgba(0,229,255,0.05)'; rctx.lineWidth=0.5; rctx.stroke();
      }
      /* Data shape */
      rctx.beginPath();
      for(var i=0;i<N;i++){
        var v=Math.max(vals[i]*ease,0.04); var p=rpt(i,R*v);
        i===0?rctx.moveTo(p[0],p[1]):rctx.lineTo(p[0],p[1]);
      }
      rctx.closePath();
      var grd=rctx.createRadialGradient(CX,CY,0,CX,CY,R);
      grd.addColorStop(0,'rgba(0,229,255,0.18)'); grd.addColorStop(1,'rgba(180,74,255,0.05)');
      rctx.fillStyle=grd; rctx.fill();
      rctx.strokeStyle='rgba(0,229,255,0.7)'; rctx.lineWidth=1.2; rctx.stroke();
      /* Dots + labels */
      for(var i=0;i<N;i++){
        var v=Math.max(vals[i]*ease,0.04); var dp=rpt(i,R*v);
        rctx.beginPath(); rctx.arc(dp[0],dp[1],2.5,0,Math.PI*2);
        rctx.fillStyle=SC[i]; rctx.shadowBlur=7; rctx.shadowColor=SC[i]; rctx.fill(); rctx.shadowBlur=0;
        var lp=rpt(i,R+14);
        rctx.font='500 7px "Share Tech Mono",monospace'; rctx.textAlign='center'; rctx.textBaseline='middle';
        rctx.fillStyle='rgba(255,255,255,0.28)'; rctx.fillText(SL[i],lp[0],lp[1]);
      }
      if(prog<1) requestAnimationFrame(drawRadar);
      else {
        setInterval(function(){
          var pulse2=1+Math.sin(Date.now()/1300)*0.012;
          /* Just redraw with full vals scaled by pulse */
          var saved=vals.map(function(v){return v*pulse2;});
          rctx.clearRect(0,0,164,164);
          for(var ring=1;ring<=4;ring++){
            var rr=R*ring/4; rctx.beginPath();
            for(var i=0;i<N;i++){var p=rpt(i,rr);i===0?rctx.moveTo(p[0],p[1]):rctx.lineTo(p[0],p[1]);}
            rctx.closePath(); rctx.strokeStyle='rgba(0,229,255,0.06)'; rctx.lineWidth=0.5; rctx.stroke();
          }
          for(var i=0;i<N;i++){
            var ep=rpt(i,R); rctx.beginPath(); rctx.moveTo(CX,CY); rctx.lineTo(ep[0],ep[1]);
            rctx.strokeStyle='rgba(0,229,255,0.05)'; rctx.lineWidth=0.5; rctx.stroke();
          }
          rctx.beginPath();
          for(var i=0;i<N;i++){
            var v2=Math.max(saved[i],0.04); var p=rpt(i,R*v2);
            i===0?rctx.moveTo(p[0],p[1]):rctx.lineTo(p[0],p[1]);
          }
          rctx.closePath();
          var grd2=rctx.createRadialGradient(CX,CY,0,CX,CY,R);
          grd2.addColorStop(0,'rgba(0,229,255,0.18)'); grd2.addColorStop(1,'rgba(180,74,255,0.05)');
          rctx.fillStyle=grd2; rctx.fill();
          rctx.strokeStyle='rgba(0,229,255,0.7)'; rctx.lineWidth=1.2; rctx.stroke();
          for(var i=0;i<N;i++){
            var v2=Math.max(saved[i],0.04); var dp=rpt(i,R*v2);
            rctx.beginPath(); rctx.arc(dp[0],dp[1],2.5,0,Math.PI*2);
            rctx.fillStyle=SC[i]; rctx.shadowBlur=7; rctx.shadowColor=SC[i]; rctx.fill(); rctx.shadowBlur=0;
            var lp=rpt(i,R+14);
            rctx.font='500 7px "Share Tech Mono",monospace'; rctx.textAlign='center'; rctx.textBaseline='middle';
            rctx.fillStyle='rgba(255,255,255,0.28)'; rctx.fillText(SL[i],lp[0],lp[1]);
          }
        },40);
      }
    }
    requestAnimationFrame(drawRadar);

    /* — Animate vertical bars — */
    var fills = document.querySelectorAll('.rp4-vb-fill');
    fills.forEach(function(f,i){
      var pct = parseInt(f.getAttribute('data-pct')||'0');
      f.style.height = '0%';
      setTimeout(function(){ f.style.height = Math.round(pct*0.9)+'%'; }, 300+i*70);
    });
  }

  /* — Dot pulse — */
  function bootDots() {
    var dots = document.querySelectorAll('#rp4-bdots .rp4-dot');
    if (!dots.length) return;
    var ai = 0;
    _rafDots = setInterval(function(){
      dots.forEach(function(d){ d.classList.remove('active'); });
      ai = (ai+1) % dots.length;
      dots[ai].classList.add('active');
    }, 550);
  }

  /* ── Save ── */
  /* ── Add power row helper ── */
  window._addRp4Power = function(){
    var c=document.getElementById('rp4-powers-edit');if(!c)return;
    var idx=c.querySelectorAll('.rp4-pw-row').length;
    c.insertAdjacentHTML('beforeend','<div class="rp4-pw-row" data-pw-idx="'+idx+'"><div class="rp4-fg" style="flex:1;margin-bottom:0"><input class="rp4-fi" placeholder="Nom" data-pk="name"></div><div class="rp4-fg" style="flex:2;margin-bottom:0"><input class="rp4-fi" placeholder="Description" data-pk="desc"></div><button type="button" class="rp4-pw-rm" onclick="this.parentElement.remove()">✕</button></div>');
  };

  function doSave(name, overlay, btn) {
    if (!db) {
      window._dbg?.error('[races] doSave : Firebase non disponible');
      btn.textContent = 'Erreur DB'; btn.style.color = '#FF4757';
      setTimeout(function(){btn.textContent='Sauvegarder';btn.style.color='';}, 3000);
      return;
    }
    btn.disabled=true; btn.textContent='Sauvegarde...';

    // Lire les champs du formulaire (format site)
    var siteData={
      name:(document.getElementById('rp-ed-name')&&document.getElementById('rp-ed-name').value||name).trim(),
      plural:(document.getElementById('rp-ed-plural')&&document.getElementById('rp-ed-plural').value||'').trim(),
      category:(document.getElementById('rp-ed-category')&&document.getElementById('rp-ed-category').value||'').trim(),
      longevity:(document.getElementById('rp-ed-longevity')&&document.getElementById('rp-ed-longevity').value||'').trim(),
      access:(document.getElementById('rp-ed-access')&&document.getElementById('rp-ed-access').value)||'Ouverte',
      description:(document.getElementById('rp-ed-desc')&&document.getElementById('rp-ed-desc').value||'').trim(),
      imageUrl:(document.getElementById('rp-ed-image')&&document.getElementById('rp-ed-image').value||'').trim()
    };

    // Affinity : string du formulaire → écrire AUSSI comme array pour le bot
    var affinityStr=(document.getElementById('rp-ed-affinity')&&document.getElementById('rp-ed-affinity').value||'').trim();
    siteData.affinity = affinityStr ? affinityStr.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];

    // baseStats : collecte depuis les inputs visuels
    var baseStats={};
    document.querySelectorAll('#rp4-stats-edit [data-stat]').forEach(function(inp){
      baseStats[inp.dataset.stat] = parseInt(inp.value) || 0;
    });
    siteData.baseStats = baseStats;

    // basePowers : collecte depuis les lignes visuelles
    var powers=[];
    document.querySelectorAll('#rp4-powers-edit .rp4-pw-row').forEach(function(row){
      var n=row.querySelector('[data-pk="name"]');
      var d=row.querySelector('[data-pk="desc"]');
      var nm=n?n.value.trim():'';
      if(nm)powers.push({name:nm,desc:d?d.value.trim():''});
    });
    siteData.basePowers=powers;

    // ── Écrire aussi les champs bot (strength, agility...) depuis baseStats ──
    // Ça garantit que le bot peut toujours lire les stats correctement.
    var STAT_RMAP = {str:'strength',agi:'agility',spd:'speed','int':'intelligence',mana:'mana',res:'resistance',cha:'charisma',aura:'aura'};
    Object.keys(STAT_RMAP).forEach(function(siteKey) {
      var botKey = STAT_RMAP[siteKey];
      siteData[botKey] = parseInt(baseStats[siteKey]) || 0;
    });

    saveRaceData(name, siteData).then(function(){
      racesData[name] = siteData;
      if(window.JCache)window.JCache.invalidate('config','races_data');
      btn.textContent='\u2713 Sauvegardé'; btn.style.color='#44ff88';
      setTimeout(function(){btn.disabled=false;btn.textContent='Sauvegarder';btn.style.color='';}, 2000);
    }).catch(function(e){
      btn.textContent='Erreur: '+(e.code||e.message||'inconnue');
      btn.style.color='#FF4757'; btn.disabled=false;
      setTimeout(function(){btn.textContent='Sauvegarder';btn.style.color='';}, 4000);
    });
  }

  /* ══════════════════════════════════════════
     CSS
  ══════════════════════════════════════════ */
  var css = document.createElement('style');
  css.textContent = `
  .rp-ov{position:fixed;inset:0;z-index:10000;background:rgba(2,5,15,0.82);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .4s;pointer-events:none}
  .rp-ov.rp-open{opacity:1;pointer-events:all}
  .rp-ov.rp-closing{opacity:0;pointer-events:none;transition:opacity .3s ease-in .12s}

  .rp4-outer{position:relative;width:820px;max-width:96vw}

  /* Corner external decorations */
  .rp4-ce{position:absolute;width:18px;height:18px;border-color:#ff2d78;border-style:solid;opacity:.55;z-index:5;pointer-events:none}
  .rp4-ce.tl{top:-4px;left:-4px;border-width:2px 0 0 2px}
  .rp4-ce.tr{top:-4px;right:-4px;border-width:2px 2px 0 0}
  .rp4-ce.bl{bottom:-4px;left:-4px;border-width:0 0 2px 2px}
  .rp4-ce.br{bottom:-4px;right:-4px;border-width:0 2px 2px 0}

  /* Close button */
  .rp-x{position:absolute;top:10px;right:10px;z-index:20;background:rgba(2,5,15,0.7);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.75rem;clip-path:polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px));transition:color .2s,border-color .2s,background .2s;backdrop-filter:blur(8px)}
  .rp-x:hover{color:#FF4757;border-color:rgba(255,71,87,.4);background:rgba(255,71,87,.08)}

  /* Main popup */
  .rp4-popup{position:relative;background:rgba(3,6,18,.97);border:1px solid rgba(0,229,255,.16);clip-path:polygon(0 0,calc(100% - 28px) 0,100% 28px,100% 100%,28px 100%,0 calc(100% - 28px));overflow:hidden;transform:scale(.93) translateY(20px);filter:blur(3px);transition:transform .45s cubic-bezier(.16,1,.3,1),filter .45s}
  .rp-open .rp4-popup{transform:scale(1) translateY(0);filter:blur(0)}
  .rp-closing .rp4-popup{animation:rp4CloseGlitch .4s ease-in forwards}
  @keyframes rp4CloseGlitch{
    0%{transform:scale(1) translateY(0);opacity:1;filter:blur(0)}
    15%{transform:scale(1) translateX(-6px);opacity:1;filter:blur(0)}
    30%{transform:scale(1) translateX(4px);opacity:.85;filter:blur(1px)}
    55%{transform:scale(.98) translateY(10px) skewX(-1deg);opacity:.5;filter:blur(3px)}
    100%{transform:scale(.88) translateY(35px);opacity:0;filter:blur(8px)}
  }

  /* Corner cut fill */
  .rp4-popup::after{content:'';position:absolute;top:0;right:0;width:28px;height:28px;background:rgba(0,229,255,.05);border-bottom:1px solid rgba(0,229,255,.2);border-left:1px solid rgba(0,229,255,.2);pointer-events:none;z-index:2}

  /* Noise */
  .rp4-noise{position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.022;pointer-events:none;z-index:0}

  /* Scan line */
  .rp4-scan{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,229,255,.4) 30%,rgba(0,229,255,.7) 50%,rgba(0,229,255,.4) 70%,transparent);animation:rp4ScanY 4s linear infinite;z-index:3;pointer-events:none}
  @keyframes rp4ScanY{0%{top:0%;opacity:0}5%{opacity:1}95%{opacity:.7}100%{top:100%;opacity:0}}

  /* Top accent */
  .rp4-topbar{height:3px;position:relative;z-index:2;opacity:.7}
  .rp4-topbar::after{content:'';position:absolute;inset:0;background:inherit;filter:blur(4px);opacity:.5}

  /* ── HEADER ── */
  .rp4-header{position:relative;z-index:2;display:flex;align-items:stretch;border-bottom:1px solid rgba(0,229,255,.07);background:linear-gradient(180deg,rgba(0,229,255,.03) 0%,transparent 100%)}

  /* Portrait */
  .rp4-portrait-wrap{width:190px;flex-shrink:0;position:relative;overflow:hidden;border-right:1px solid rgba(0,229,255,.1);min-height:250px;background:#030610}
  .rp4-portrait-grid{position:absolute;inset:0;z-index:2;background-image:linear-gradient(rgba(0,229,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.035) 1px,transparent 1px);background-size:18px 18px;pointer-events:none}
  #rp4-portrait-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}
  .rp4-portrait-ov{position:absolute;inset:0;z-index:4;background:linear-gradient(90deg,transparent 55%,rgba(3,6,18,.85) 100%),linear-gradient(180deg,transparent 50%,rgba(3,6,18,.95) 100%);pointer-events:none}
  .rp4-reticle{position:absolute;top:50%;left:50%;transform:translate(-50%,-58%);width:58px;height:58px;z-index:5;animation:rp4RetSpin 10s linear infinite;pointer-events:none}
  @keyframes rp4RetSpin{to{transform:translate(-50%,-58%) rotate(360deg)}}
  .rp4-portrait-readout{position:absolute;bottom:10px;left:8px;z-index:6;display:flex;flex-direction:column;gap:2px}
  .rp4-portrait-readout span{font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(0,229,255,.42);display:block;letter-spacing:.06em}

  /* Center */
  .rp4-center{flex:1;padding:16px 20px 14px;display:flex;flex-direction:column;gap:10px;position:relative;z-index:2;min-width:0}
  .rp4-id-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .rp4-id{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.2em;padding:3px 9px;border:1px solid;clip-path:polygon(5px 0%,100% 0%,calc(100% - 5px) 100%,0% 100%)}
  .rp4-cat{font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(255,255,255,.22);letter-spacing:.15em}
  .rp4-access{margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.15em;padding:3px 9px;border:1px solid;clip-path:polygon(0 0%,calc(100% - 5px) 0%,100% 100%,5px 100%)}
  .rp4-title-wrap{position:relative}
  .rp4-title{font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;letter-spacing:.07em;color:#fff;line-height:1;position:relative;z-index:1}
  .rp4-title-glow{position:absolute;top:0;left:0;font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;letter-spacing:.07em;filter:blur(10px);opacity:.25;z-index:0;animation:rp4TGlow 3s ease-in-out infinite}
  @keyframes rp4TGlow{0%,100%{opacity:.18}50%{opacity:.38}}
  .rp4-subtitle{font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:400;color:rgba(255,255,255,.28);letter-spacing:.1em;margin-top:-4px}
  .rp4-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:4px}
  .rp4-mc{background:rgba(0,229,255,.025);border:1px solid rgba(0,229,255,.08);padding:7px 10px;position:relative;clip-path:polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))}
  .rp4-mc::before{content:'';position:absolute;top:0;left:0;right:5px;height:1px;background:linear-gradient(90deg,var(--mca,#00e5ff),transparent);opacity:.25}
  .rp4-ml{display:block;font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(255,255,255,.22);letter-spacing:.18em;text-transform:uppercase;margin-bottom:2px}
  .rp4-mv{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600}

  /* Radar panel */
  .rp4-radar-panel{width:190px;flex-shrink:0;border-left:1px solid rgba(0,229,255,.07);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 8px;background:rgba(0,0,0,.18);position:relative;z-index:2}
  .rp4-rlbl{font-family:'Share Tech Mono',monospace;font-size:7px;letter-spacing:.28em;color:rgba(0,229,255,.25);text-transform:uppercase;margin-bottom:8px}
  #rp4-radar{width:164px;height:164px}

  /* ── BODY ── */
  .rp4-body{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1px 1fr 1px 190px;border-top:1px solid rgba(0,229,255,.05)}
  .rp4-divider{background:linear-gradient(180deg,rgba(0,229,255,.1) 0%,transparent 100%)}
  .rp4-col{padding:0 0 14px}
  .rp4-stats-col{background:rgba(0,0,0,.15);border-left:1px solid rgba(0,229,255,.05)}
  .rp4-stitle{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.28em;color:rgba(255,255,255,.18);text-transform:uppercase;padding:11px 14px 7px;display:flex;align-items:center;gap:8px}
  .rp4-stitle::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(0,229,255,.12),transparent)}
  .rp4-desc{font-family:'Rajdhani',sans-serif;font-size:12.5px;font-weight:300;color:rgba(255,255,255,.45);line-height:1.75;margin:0 14px;padding:8px 11px;border-left:2px solid;background:rgba(255,45,120,.025)}
  .rp4-powers{padding:0 12px;display:flex;flex-direction:column;gap:5px}
  .rp4-pw{display:flex;align-items:flex-start;gap:9px;padding:6px 9px;background:rgba(0,229,255,.02);border:1px solid rgba(0,229,255,.07);clip-path:polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px));transition:background .2s}
  .rp4-pw:hover{background:rgba(0,229,255,.05)}
  .rp4-pw-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;margin-top:4px}
  .rp4-pw-n{font-family:'Rajdhani',sans-serif;font-size:13px;font-weight:600;display:block;line-height:1.2}
  .rp4-pw-d{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:300;color:rgba(255,255,255,.32);display:block;margin-top:2px;line-height:1.4}
  .rp4-empty{font-family:'Rajdhani',sans-serif;font-size:12px;color:rgba(255,255,255,.2);font-style:italic;padding:0 12px}

  /* Vertical bars */
  .rp4-vbars{display:flex;gap:5px;justify-content:center;align-items:flex-end;height:110px;padding:0 12px;margin:4px 0 10px}
  .rp4-vb-wrap{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1}
  .rp4-vb-val{font-family:'Share Tech Mono',monospace;font-size:7px;color:rgba(255,255,255,.35)}
  .rp4-vb-track{width:100%;max-height:84px;flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);display:flex;align-items:flex-end;overflow:hidden}
  .rp4-vb-fill{width:100%;height:0%;transition:height 1s cubic-bezier(.16,1,.3,1)}
  .rp4-vb-lbl{font-family:'Share Tech Mono',monospace;font-size:7px;color:rgba(255,255,255,.22);letter-spacing:.04em}

  /* Bottombar */
  .rp4-bottom{position:relative;z-index:2;border-top:1px solid rgba(0,229,255,.06);display:flex;align-items:center;padding:7px 18px;gap:14px;background:rgba(0,0,0,.22)}
  .rp4-bdb{font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(0,229,255,.2);letter-spacing:.12em}
  .rp4-bdots{display:flex;gap:4px;align-items:center}
  .rp4-dot{width:4px;height:4px;border-radius:50%;background:rgba(0,229,255,.12)}
  .rp4-dot.active{background:#ff2d78;box-shadow:0 0 5px #ff2d78}
  .rp4-sig{display:flex;align-items:flex-end;gap:2px;margin-left:auto}
  .rp4-sig div{width:3px;background:rgba(0,255,136,.55);border-radius:1px}
  .rp4-status{font-family:'Share Tech Mono',monospace;font-size:8px;color:#00ff88;letter-spacing:.2em;animation:rp4Blink 2s step-end infinite}
  @keyframes rp4Blink{50%{opacity:0}}

  /* Admin */
  .rp4-admin{border-top:1px solid rgba(255,255,255,.04);padding:16px 20px 20px;position:relative;z-index:2}
  .rp4-admin-t{font-family:'Orbitron',sans-serif;font-size:8px;font-weight:600;letter-spacing:.25em;color:#4DA3FF;margin-bottom:12px}
  .rp4-admin-g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
  .rp4-fg{margin-bottom:7px}
  .rp4-fl{display:block;font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.22);margin-bottom:3px}
  .rp4-fi,.rp4-fta{width:100%;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);color:#e2e6f0;font-family:'Rajdhani',sans-serif;font-size:13px;padding:7px 9px;outline:none;transition:border-color .2s;box-sizing:border-box}
  .rp4-fi:focus,.rp4-fta:focus{border-color:#4DA3FF}
  .rp4-fta{resize:vertical;min-height:55px;font-size:12px}
  .rp4-mono{font-family:'Share Tech Mono',monospace;font-size:10px}
  .rp4-save{width:100%;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#020713;background:linear-gradient(135deg,#4DA3FF,#8B5CF6);border:none;padding:11px;cursor:pointer;transition:box-shadow .3s,transform .3s,opacity .3s;margin-top:6px;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))}
  .rp4-save:hover{box-shadow:0 0 20px rgba(77,163,255,.3);transform:translateY(-1px)}
  .rp4-save:disabled{opacity:.5;cursor:not-allowed}

  /* Stat editor grid */
  .rp4-stats-edit{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .rp4-stat-ed{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(0,229,255,0.02);border:1px solid rgba(0,229,255,0.06);border-radius:4px;padding:8px 4px}
  .rp4-stat-ed-lbl{font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:600;letter-spacing:.1em;color:rgba(255,255,255,.3)}
  .rp4-stat-input{font-family:'Orbitron',sans-serif;font-weight:700;font-size:13px;color:#4DA3FF;width:60px;text-align:center;background:rgba(0,229,255,0.03);border:1px solid rgba(0,229,255,0.12);border-radius:3px;padding:5px 3px}
  /* Power editor */
  .rp4-pw-row{display:flex;gap:8px;align-items:center;margin-bottom:6px;padding:8px 10px;background:rgba(0,229,255,0.02);border:1px solid rgba(0,229,255,0.06);border-radius:4px}
  .rp4-pw-rm{width:26px;height:26px;flex-shrink:0;border:1px solid rgba(255,71,87,.15);background:rgba(255,71,87,.04);border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,71,87,.4);transition:border-color .2s,color .2s,background .2s}
  .rp4-pw-rm:hover{border-color:rgba(255,71,87,.5);color:#FF4757;background:rgba(255,71,87,.1)}
  .rp4-pw-add{width:100%;margin-top:6px;padding:8px;border:1px dashed rgba(0,229,255,.12);border-radius:4px;background:transparent;color:rgba(255,255,255,.3);font-family:'Rajdhani',sans-serif;font-size:11px;letter-spacing:.1em;cursor:pointer;transition:border-color .2s,color .2s,background .2s}
  .rp4-pw-add:hover{border-color:rgba(77,163,255,.3);color:#4DA3FF;background:rgba(77,163,255,.02)}

  @media(max-width:700px){
    .rp4-header{flex-direction:column}
    .rp4-portrait-wrap{width:100%;min-height:180px;max-height:200px;border-right:none;border-bottom:1px solid rgba(0,229,255,.08)}
    .rp4-portrait-ov{background:linear-gradient(180deg,transparent 40%,rgba(3,6,18,.95) 100%) !important}
    .rp4-radar-panel{width:100%;border-left:none;border-top:1px solid rgba(0,229,255,.06)}
    .rp4-body{grid-template-columns:1fr}
    .rp4-divider{display:none}
    .rp4-admin-g{grid-template-columns:1fr}
  }
  `;
  document.head.appendChild(css);
})();



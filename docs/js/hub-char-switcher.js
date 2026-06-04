/* ══════════════════════════════════════════════════════════════════════
   hub-char-switcher.js — Sélecteur de personnage actif (Dashboard)
   ══════════════════════════════════════════════════════════════════════
   Expose :
     window.openCharSwitcher()   — ouvre le modal de sélection
     window.closeCharSwitcher()  — ferme le modal
   Dépend de :
     window.db, window.UID, window.CHAR_ID, window.C, loadCharacter(),
     showToast(), JCache
   Fonctionne en mode normal (characters/active_characters) et IRP
   (irp_characters/irp_active_characters) car on lit window.C.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var _modal=null, _busy=false, _chars=[], _activeId=null, _wired=false;

  function _esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  var RANK_COL={
    F:'#6b7280',E:'#9ca3af',D:'#60a5fa',C:'#34d399',B:'#fbbf24',
    A:'#f97316',S:'#ef4444',SS:'#ff006e',SSS:'#ffd60a',X:'#e040fb',
    T:'#c0f0ff',G:'#ffe680','G+':'#ffffff',Z:'#ff6060'
  };

  function _rank(lvl){
    if(window.Jaharta && Jaharta.rankFromLevel) return Jaharta.rankFromLevel(lvl||0);
    var l=parseInt(lvl||0,10)||0;
    if(l>=450)return 'Z';if(l>=400)return 'G+';if(l>=350)return 'G';if(l>=300)return 'T';
    if(l>=260)return 'X';if(l>=220)return 'SSS';if(l>=180)return 'SS';if(l>=140)return 'S';
    if(l>=100)return 'A';if(l>=80)return 'B';if(l>=60)return 'C';if(l>=40)return 'D';
    if(l>=20)return 'E';return 'F';
  }

  function _ensureModal(){
    if(_modal)return _modal;
    _modal=document.createElement('div');
    _modal.className='charswap-overlay';
    _modal.setAttribute('role','dialog');
    _modal.setAttribute('aria-modal','true');
    _modal.setAttribute('aria-label','Sélection du personnage');
    _modal.innerHTML=
      '<div class="charswap-bg" data-close="1"></div>'+
      '<div class="charswap-panel">'+
        '<div class="charswap-frame">'+
          '<div class="charswap-header">'+
            '<div class="charswap-eyebrow">// NEXUS · CHARACTER SWITCH</div>'+
            '<div class="charswap-title">SÉLECTION DU PERSONNAGE</div>'+
            '<div class="charswap-sub" id="charswap-sub">Choisis ton personnage actif</div>'+
            '<button class="charswap-close" data-close="1" aria-label="Fermer">✕</button>'+
          '</div>'+
          '<div class="charswap-grid" id="charswap-grid"></div>'+
          '<div class="charswap-footer">'+
            '<span class="charswap-foot-hint">[ESC] pour fermer</span>'+
            '<button class="charswap-cancel" data-close="1">ANNULER</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(_modal);
    _modal.addEventListener('click',function(e){
      var t=e.target;
      if(t && t.dataset && t.dataset.close==='1') closeCharSwitcher();
    });
    if(!_wired){
      document.addEventListener('keydown',function(e){
        if(e.key==='Escape' && _modal && _modal.classList.contains('open')) closeCharSwitcher();
      });
      _wired=true;
    }
    return _modal;
  }

  function _statBars(stats){
    var keys=['strength','dexterity','speed','intelligence','mana','resistance','charisma'];
    var LBL={strength:'STR',dexterity:'DEX',speed:'SPD',intelligence:'INT',mana:'MNA',resistance:'RES',charisma:'CHA'};
    var arr=keys.map(function(k){return {k:k,v:parseInt((stats||{})[k]||0)||0};});
    arr.sort(function(a,b){return b.v-a.v;});
    arr=arr.slice(0,3);
    return arr.map(function(s){
      var pct=Math.max(2,Math.min(100, Math.round((s.v/1000)*100)));
      return '<div class="cs-stat"><span class="cs-stat-lbl">'+LBL[s.k]+'</span>'+
             '<span class="cs-stat-bar"><span class="cs-stat-fill" style="--p:'+pct+'%"></span></span>'+
             '<span class="cs-stat-val">'+s.v+'</span></div>';
    }).join('');
  }

  function _cardHtml(c, idx){
    var id=c._id||c.id;
    var fn=c.first_name||'',ln=c.last_name||'';
    var name=[fn,ln].filter(Boolean).join(' ')||'Personnage';
    var lvl=parseInt(c.level||0,10)||0;
    var rk=_rank(lvl);
    var rkCol=RANK_COL[rk]||'#9aa0b8';
    var race=c.race_category||'—';
    var cls=c.class||'—';
    var img=c.profile_image||'';
    var pwCount=(Array.isArray(c.powers)?c.powers.length:0);
    var isActive=(String(id)===String(_activeId));
    var imgHtml = img
      ? '<img src="'+_esc(img)+'" alt="" onerror="this.style.display=\'none\';var f=this.parentNode.querySelector(\'.cs-portrait-fallback\');if(f)f.style.display=\'flex\'">'
      : '';
    return '<button class="cs-card'+(isActive?' is-active':'')+'" data-id="'+_esc(id)+'" type="button" style="--si:'+idx+'">'+
      '<div class="cs-card-frame">'+
        '<div class="cs-portrait">'+
          imgHtml+
          '<div class="cs-portrait-fallback"'+(img?' style="display:none"':'')+'>NO IMAGE</div>'+
          '<div class="cs-scan"></div>'+
          '<div class="cs-corner cs-corner-tl"></div>'+
          '<div class="cs-corner cs-corner-tr"></div>'+
          '<div class="cs-corner cs-corner-bl"></div>'+
          '<div class="cs-corner cs-corner-br"></div>'+
          '<span class="cs-rank" style="--rk:'+rkCol+'">'+_esc(rk)+'</span>'+
          (isActive?'<span class="cs-active-tag">● ACTIF</span>':'')+
        '</div>'+
        '<div class="cs-body">'+
          '<div class="cs-name">'+_esc(name)+'</div>'+
          '<div class="cs-meta">'+_esc(race)+' · '+_esc(cls)+'</div>'+
          '<div class="cs-lvl-row"><span class="cs-lvl-lbl">NIV.</span><span class="cs-lvl-val">'+lvl+'</span><span class="cs-pwc">'+pwCount+' POUVOIR'+(pwCount>1?'S':'')+'</span></div>'+
          '<div class="cs-stats">'+_statBars(c.stats||{})+'</div>'+
        '</div>'+
        '<div class="cs-spinner"><span></span><span></span><span></span></div>'+
      '</div>'+
      '<span class="cs-select-tag">'+(isActive?'■ PERSONNAGE ACTIF':'CLIQUER POUR ACTIVER →')+'</span>'+
    '</button>';
  }

  function _renderGrid(){
    var grid=document.getElementById('charswap-grid');
    var sub=document.getElementById('charswap-sub');
    if(!grid)return;
    if(!_chars.length){
      grid.innerHTML='<div class="cs-empty">Aucun personnage trouvé pour ce compte.<br><small>Crée-en un avec <code>/character</code> sur Discord.</small></div>';
      if(sub) sub.textContent='0 personnage trouvé';
      return;
    }
    if(sub) sub.textContent=_chars.length+' personnage'+(_chars.length>1?'s':'')+' · clique pour basculer';
    grid.innerHTML=_chars.map(function(c,i){return _cardHtml(c,i);}).join('');
    grid.querySelectorAll('.cs-card').forEach(function(b){
      b.addEventListener('click', function(){
        var id=b.dataset.id;
        if(!id||_busy) return;
        if(String(id)===String(_activeId)){ closeCharSwitcher(); return; }
        _selectChar(id,b);
      });
    });
  }

  function _renderSkeletons(){
    var grid=document.getElementById('charswap-grid');
    if(!grid)return;
    var html='';
    for(var i=0;i<6;i++){
      html+='<div class="cs-skeleton" style="--si:'+i+'">'+
        '<div class="cs-skel-portrait"></div>'+
        '<div class="cs-skel-line"></div>'+
        '<div class="cs-skel-line short"></div>'+
        '<div class="cs-skel-bars"><div></div><div></div><div></div></div>'+
      '</div>';
    }
    grid.innerHTML=html;
  }

  function _db(){ return (typeof db!=='undefined') ? db : window.db; }
  function _C(){ return (typeof C!=='undefined') ? C : window.C; }
  function _uid(){ return (typeof UID!=='undefined' && UID) ? UID : window.UID; }

  async function _fetchChars(){
    var Cobj=_C()||{};
    var COL=Cobj.CHARS || 'characters';
    var snap=await _db().collection(COL).where('user_id','==',String(_uid())).get();
    var out=[];
    snap.forEach(function(d){
      var data=d.data()||{};
      if(data._init) return; /* skip auto-seed sentinel */
      out.push(Object.assign({_id:d.id, id:d.id}, data));
    });
    var active=_activeId;
    out.sort(function(a,b){
      var ai=String(a._id||a.id), bi=String(b._id||b.id);
      if(ai===String(active)) return -1;
      if(bi===String(active)) return 1;
      var la=parseInt(a.level||0,10)||0, lb=parseInt(b.level||0,10)||0;
      if(la!==lb) return lb-la;
      var ua=(a.updated_at && (a.updated_at.seconds||0))||0;
      var ub=(b.updated_at && (b.updated_at.seconds||0))||0;
      return ub-ua;
    });
    return out;
  }

  function _invalidateCharCaches(){
    if(!window.JCache) return;
    /* cachedGet() in hub-core uses these cacheKeys */
    ['_active_char','_character','_inventory','_companions','_party_mem','_buffs','_party','_titles']
      .forEach(function(k){ try{ JCache.invalidate(k,null); }catch(_){ } });
  }

  async function _selectChar(charId, btnEl){
    if(_busy) return;
    _busy=true;
    if(btnEl) btnEl.classList.add('is-loading');
    try{
      var Cobj=_C()||{};
      var COL_A=Cobj.ACTIVE || 'active_characters';
      var uid=String(_uid());
      await _db().collection(COL_A).doc(uid).set({
        character_id: String(charId),
        user_id: uid
      });
      /* Vider tout le cache character pour garantir des données fraîches */
      if(window.JCache) window.JCache.clear();
      /* Ré-injecter immédiatement la nouvelle valeur active pour éviter un
         round-trip HTTP sur active_characters (le navigateur peut servir
         l'ancienne réponse depuis son cache HTTP max-age=3s) */
      if(window.JCache) JCache.put('_active_char', null, {character_id: String(charId), user_id: String(_uid())}, 15);
      _activeId=charId;
      if(typeof window.showToast==='function') window.showToast('Personnage actif mis à jour','success',2200);
      setTimeout(function(){
        _busy=false;
        closeCharSwitcher();
        var lc=window.loadCharacter||(typeof loadCharacter==='function'?loadCharacter:null);
        if(typeof lc==='function'){
          Promise.resolve(lc()).catch(function(err){
            if(window._dbg) window._dbg.error('[charswap] loadCharacter',err);
          });
        }else{
          location.reload();
        }
      }, 280);
    }catch(e){
      if(window._dbg && window._dbg.error) window._dbg.error('[charswap]',e);
      /* 401 = JWT absent ou expiré — session désynchronisée. Forcer reconnexion. */
      var is401=e && (String(e.message).includes('401') || String(e.message).includes('Unauthorized'));
      if(is401){
        if(typeof window.showToast==='function') window.showToast('Session expirée — reconnecte-toi avec /link','error',4000);
        setTimeout(function(){
          if(typeof clearSess==='function') clearSess();
          localStorage.removeItem('d1_jwt');
          location.reload();
        }, 2500);
      } else {
        if(typeof window.showToast==='function') window.showToast('Erreur — réessaye','error');
      }
      if(btnEl) btnEl.classList.remove('is-loading');
      _busy=false;
    }
  }

  async function openCharSwitcher(){
    var uid=_uid();
    if(!uid){
      if(typeof window.showToast==='function') window.showToast('Non connecté','error');
      return;
    }
    _ensureModal();
    _modal.classList.add('open');
    document.body.style.overflow='hidden';
    _activeId = (typeof CHAR_ID!=='undefined' && CHAR_ID) ? CHAR_ID : (window.CHAR_ID || null);
    _renderSkeletons();
    try{
      _chars = await _fetchChars();
      _renderGrid();
    }catch(e){
      if(window._dbg && window._dbg.error) window._dbg.error('[charswap] fetch',e);
      var grid=document.getElementById('charswap-grid');
      if(grid) grid.innerHTML='<div class="cs-empty cs-err">Impossible de charger les personnages.<br><small>'+_esc(e && e.message || '')+'</small></div>';
    }
  }

  function closeCharSwitcher(){
    if(!_modal) return;
    _modal.classList.remove('open');
    document.body.style.overflow='';
    if(!_busy){
      var grid=document.getElementById('charswap-grid');
      /* Clear grid after fade so re-open doesn't show stale cards instantly */
      setTimeout(function(){ if(grid && !_modal.classList.contains('open')) grid.innerHTML=''; }, 380);
    }
  }

  window.openCharSwitcher = openCharSwitcher;
  window.closeCharSwitcher = closeCharSwitcher;
})();

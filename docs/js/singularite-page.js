/* ═══════════════════════════════════════════════════════════════════════
   singularite-page.js — Forge Singularité
   - Sélection noyau (depuis inventaire)
   - Type d'item, nom, icône (galerie / URL / upload base64)
   - Insertion matériaux avec preview temps réel
   - Caps + instabilité + briseurs de limite
   - Forge avec roll instabilité (success/mutation/loss)
   - Save dans inventories.singularity_items.{uuid} + items.{uuid}=1
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── STATE ─── */
  var STATE = {
    activeChar: null,
    activeCharId: null,
    chars: [],
    inventory: null,
    inventoryKey: null,
    config: null,
    noSession: false,
    /* Current build */
    selectedNoyauId: null,
    selectedType: null,
    itemName: '',
    iconMode: 'gallery',           /* gallery | url | upload */
    iconValue: '✦',                /* emoji char OR url OR data: */
    iconIsImage: false,            /* true if URL/data:image */
    materialSlots: [],             /* indexed by slot, may be null or material object */
    pendingSlotIndex: null,
    forging: false
  };

  /* Galerie d'icônes prédéfinies (par catégorie). */
  var ICON_GALLERY = [
    '⚔','🗡','🏹','⚙','🔱','🛡','🪖','🥋',
    '💎','💍','👑','📿','🧿','🔮','🪙','⚖',
    '⚡','🔥','❄','💧','🌀','✨','🌟','☄',
    '☘','🌿','🍃','🌹','🌸','🌼','🪷','🪴',
    '👁','💀','🩸','🧠','♥','♦','♣','♠',
    '◆','◇','◈','◉','◎','✦','✧','✯',
    '♾','☯','卍','卐','卌','✺','✹','✸'
  ];

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, p){ return (p||document).querySelector(sel); }
  function $$(sel, p){ return Array.from((p||document).querySelectorAll(sel)); }

  /* ─── DB/Session ─── */
  function _getDb(){
    if (window.db) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      try { window.db = firebase.firestore(); return window.db; } catch(_){}
    }
    return null;
  }
  function _getSess(){
    try {
      var raw = localStorage.getItem('hub_session') || localStorage.getItem('gacha_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s._exp && Date.now() > s._exp) return null;
      return s;
    } catch(_){ return null; }
  }
  function _getUid(){
    if (window.UID) return String(window.UID);
    var s = _getSess();
    if (s && s.id) { window.UID = String(s.id); return window.UID; }
    return null;
  }
  function _getCharParam(){
    try { var m = location.search.match(/[?&]char=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; }
    catch(_){ return null; }
  }
  function _invKey(uid, charId){ return uid + '_' + charId; }

  /* ─── Helpers ─── */
  function _uuid(){ return 'sg_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
  function _round(v, dec){ var f = Math.pow(10, dec||2); return Math.round(v*f)/f; }
  function _randBetween(a, b){ return a + Math.random()*(b-a); }
  function _randInt(a, b){ return Math.floor(a + Math.random()*(b-a+1)); }
  function _statLabel(s){
    return ({strength:'Force',agility:'Agilité',speed:'Vitesse',intelligence:'Intelligence',
             mana:'Mana',resistance:'Résistance',charisma:'Charisme',aura:'Aura'})[s] || s;
  }

  function _isUnlimited(c){
    if (!c || !STATE.config) return false;
    var ax = c.axiome_current || c.axiome || null;
    return (STATE.config._unlimited_axiomes || []).indexOf(ax) !== -1;
  }
  function _maxItemsFor(c){
    return _isUnlimited(c) ? Infinity : (STATE.config._default_max_items || 3);
  }
  function _existingItemsCount(){
    var sg = (STATE.inventory && STATE.inventory.singularity_items) || {};
    return Object.keys(sg).length;
  }

  /* ─── Loaders ─── */
  function loadConfig(){
    return fetch('data/singularite.json?v=1')
      .then(function(r){ if(!r.ok) throw new Error('singularite '+r.status); return r.json(); })
      .then(function(j){ STATE.config = j; return j; });
  }
  async function loadActiveChar(){
    var dbref=_getDb(); var uid=_getUid();
    STATE.noSession=!uid; if(!dbref||!uid) return null;
    var paramId=_getCharParam();
    if(paramId){
      try{
        var cs=await dbref.collection('characters').doc(String(paramId)).get();
        if(cs.exists){ var data=cs.data()||{};
          if(String(data.user_id)===String(uid)){
            STATE.activeCharId=paramId;
            STATE.activeChar=Object.assign({_id:paramId,id:paramId},data);
            return STATE.activeChar;
          }
        }
      }catch(e){}
    }
    try{
      var snap=await dbref.collection('active_characters').doc(String(uid)).get();
      if(snap.exists){
        var charId=(snap.data()||{}).character_id;
        if(charId){
          var cs2=await dbref.collection('characters').doc(String(charId)).get();
          if(cs2.exists){
            STATE.activeCharId=charId;
            STATE.activeChar=Object.assign({_id:charId,id:charId},cs2.data()||{});
            return STATE.activeChar;
          }
        }
      }
    }catch(e){}
    try{
      var qs=await dbref.collection('characters').where('user_id','==',String(uid)).get();
      var out=[];
      qs.forEach(function(d){ if(d.data() && !d.data()._init) out.push(Object.assign({_id:d.id,id:d.id},d.data())); });
      STATE.chars=out;
      if(out.length>0){ STATE.activeCharId=out[0]._id||out[0].id; STATE.activeChar=out[0]; return out[0]; }
    }catch(e){}
    return null;
  }
  async function loadAllChars(){
    var dbref=_getDb(); var uid=_getUid();
    if(!dbref||!uid) return [];
    try{
      var qs=await dbref.collection('characters').where('user_id','==',String(uid)).get();
      var out=[]; qs.forEach(function(d){ if(d.data() && !d.data()._init) out.push(Object.assign({_id:d.id,id:d.id},d.data())); });
      STATE.chars=out; return out;
    }catch(e){ return []; }
  }
  async function loadInventory(){
    var dbref=_getDb(); var uid=_getUid();
    if(!dbref||!uid||!STATE.activeCharId) return null;
    var key=_invKey(uid,STATE.activeCharId); STATE.inventoryKey=key;
    try{
      var snap=await dbref.collection('inventories').doc(key).get();
      STATE.inventory=snap.exists?(snap.data()||{}):{items:{},singularity_items:{}};
      if(!STATE.inventory.items) STATE.inventory.items={};
      if(!STATE.inventory.singularity_items) STATE.inventory.singularity_items={};
      return STATE.inventory;
    }catch(e){
      console.warn('[singularite] inv load failed:',e);
      STATE.inventory={items:{},singularity_items:{}};
      return STATE.inventory;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  function showState(id){
    ['state-loading','state-no-session','state-no-chars','view-main'].forEach(function(s){
      var el=document.getElementById(s); if(el) el.hidden=(s!==id);
    });
  }

  function renderHeader(){
    var c=STATE.activeChar; if(!c) return;
    $('#sg-char-chip').hidden=false;
    var name=((c.first_name||'')+' '+(c.last_name||'')).trim()||'Voyageur';
    var ax=(c.axiome_current||'néophyte').toUpperCase();
    $('#sg-chip-name').textContent=name;
    $('#sg-chip-meta').textContent=ax + (_isUnlimited(c)?' · ✦ ILLIMITÉ':'');

    var max=_maxItemsFor(c); var cur=_existingItemsCount();
    $('#sg-status-value').textContent=name;
    $('#sg-status-count').textContent=cur+' / '+(max===Infinity?'∞':max);
    $('#sg-status-access').textContent=_isUnlimited(c)?'ILLIMITÉ':'STANDARD';
  }

  function renderNoyaux(){
    var grid=$('#sg-noyaux-grid'); grid.innerHTML='';
    var inv=(STATE.inventory&&STATE.inventory.items)||{};
    var cap=_maxItemsFor(STATE.activeChar);
    var atCap=(_existingItemsCount()>=cap);
    var noyaux=STATE.config.noyaux||{};

    var ids=Object.keys(noyaux);
    var owned=ids.filter(function(id){ return (parseInt(inv[id]||0,10)||0)>0; });
    if(owned.length===0){
      grid.innerHTML='<div class="sg-empty-preview">Aucun noyau dans ton inventaire.<br><br>Achète-en dans le <a href="darknexusnet.html?char='+encodeURIComponent(STATE.activeCharId||'')+'">Marché Noir DarkNexusNet</a> ou en obtient via le <a href="sanctuaire.html?char='+encodeURIComponent(STATE.activeCharId||'')+'">Sanctuaire</a>.</div>';
      return;
    }

    var rarityOrder=STATE.config._rarity_order||[];
    var rcol=STATE.config._rarity_colors||{};
    owned.sort(function(a,b){
      var ra=rarityOrder.indexOf(noyaux[a].rarity||'common');
      var rb=rarityOrder.indexOf(noyaux[b].rarity||'common');
      return ra-rb;
    });

    grid.innerHTML=owned.map(function(id){
      var n=noyaux[id]; var qty=parseInt(inv[id]||0,10)||0;
      var color=n.color||rcol[n.rarity]||'#888';
      var selected=(STATE.selectedNoyauId===id);
      var disabled=atCap;
      return '<div class="sg-noyau' + (selected?' is-selected':'') + (disabled?' is-disabled':'') + '"' +
        ' data-id="'+esc(id)+'" style="--noyau-color:'+color+';--noyau-glow:'+color+'88">' +
        '<span class="sg-noyau-ico">'+esc(n.ico||'◯')+'</span>' +
        '<div class="sg-noyau-body">' +
          '<div class="sg-noyau-name">'+esc(n.name)+'</div>' +
          '<div class="sg-noyau-meta">'+n.slots+' slots · max '+esc(n.max_rarity_attainable)+' · Instab. de base '+n.start_instability+'</div>' +
        '</div>' +
        '<span class="sg-noyau-rarity" style="color:'+color+'">×'+qty+'</span>' +
      '</div>';
    }).join('');

    if(atCap){
      var warn=document.createElement('div');
      warn.style.cssText='margin-top:10px;padding:10px;border:1px dashed var(--sg-magenta);color:var(--sg-magenta-2);font-family:Rajdhani;font-size:0.82rem;text-align:center';
      warn.textContent='⚠ Cap atteint : '+_existingItemsCount()+'/'+cap+' items Singularité. Détruis-en un pour libérer un slot.';
      grid.appendChild(warn);
      return;
    }

    grid.querySelectorAll('.sg-noyau').forEach(function(el){
      el.addEventListener('click', function(){
        if(el.classList.contains('is-disabled')) return;
        STATE.selectedNoyauId=el.dataset.id;
        STATE.materialSlots=[];
        var n=noyaux[STATE.selectedNoyauId];
        var slotCount=n.slots||4;
        for(var i=0;i<slotCount;i++) STATE.materialSlots.push(null);
        renderNoyaux();
        renderTypes();
        renderSlots();
        renderPreview();
        updateSteps();
      });
    });
  }

  function renderTypes(){
    var grid=$('#sg-type-grid'); grid.innerHTML='';
    var types=STATE.config._item_types||{};
    grid.innerHTML=Object.entries(types).map(function(kv){
      var id=kv[0], t=kv[1];
      var selected=(STATE.selectedType===id);
      return '<div class="sg-type'+(selected?' is-selected':'')+'" data-id="'+esc(id)+'">' +
        '<span class="sg-type-ico">'+esc(t.icon)+'</span>' +
        '<span class="sg-type-label">'+esc(t.label)+'</span>' +
      '</div>';
    }).join('');
    grid.querySelectorAll('.sg-type').forEach(function(el){
      el.addEventListener('click', function(){
        STATE.selectedType=el.dataset.id;
        renderTypes(); renderPreview(); updateSteps();
      });
    });
  }

  function renderIconGallery(){
    var grid=$('#sg-icon-gallery'); if(!grid) return;
    grid.innerHTML=ICON_GALLERY.map(function(em){
      var sel=(!STATE.iconIsImage && STATE.iconValue===em)?' is-selected':'';
      return '<div class="sg-icon-tile'+sel+'" data-icon="'+esc(em)+'">'+em+'</div>';
    }).join('');
    grid.querySelectorAll('.sg-icon-tile').forEach(function(el){
      el.addEventListener('click', function(){
        STATE.iconValue=el.dataset.icon;
        STATE.iconIsImage=false;
        renderIconGallery(); renderPreview();
      });
    });
  }

  function renderPreview(){
    var c=STATE.activeChar;
    var frame=$('#sg-preview-frame');
    var glyph=$('#sg-preview-glyph');
    var name=$('#sg-preview-name');
    var rarity=$('#sg-preview-rarity');

    /* Icône */
    if(STATE.iconIsImage){
      frame.classList.add('has-icon');
      frame.innerHTML='<img class="sg-preview-img" src="'+esc(STATE.iconValue)+'" onerror="this.outerHTML=\'<span class=sg-preview-glyph>?</span>\'"/>';
    } else {
      frame.classList.remove('has-icon');
      frame.innerHTML='<span class="sg-preview-glyph">'+esc(STATE.iconValue||'✦')+'</span>';
    }

    name.textContent=STATE.itemName||'Sans Nom';

    /* Rareté (basée sur noyau pour l'instant, modulée par mats appliqués plus tard) */
    var noyau=STATE.selectedNoyauId ? (STATE.config.noyaux||{})[STATE.selectedNoyauId] : null;
    var r=noyau?noyau.rarity:'common';
    var rcol=(STATE.config._rarity_colors||{})[r]||'#888';
    rarity.textContent=r.toUpperCase();
    rarity.style.color=rcol;
  }

  function renderSlots(){
    var slotsEl=$('#sg-slots');
    var countEl=$('#sg-slots-count');
    var noyau=STATE.selectedNoyauId ? (STATE.config.noyaux||{})[STATE.selectedNoyauId] : null;
    if(!noyau){
      slotsEl.innerHTML='<div class="sg-empty-preview" style="grid-column:1/-1">Sélectionne un noyau pour activer les slots.</div>';
      countEl.textContent='(0/0)';
      return;
    }
    var n=noyau.slots||0;
    var filled=STATE.materialSlots.filter(function(m){return m;}).length;
    countEl.textContent='('+filled+'/'+n+')';
    slotsEl.innerHTML='';
    for(var i=0;i<n;i++){
      var m=STATE.materialSlots[i];
      var div=document.createElement('div');
      if(m){
        div.className='sg-slot is-filled';
        var effTxt=_describeMaterial(m);
        div.innerHTML=
          '<span class="sg-slot-ico">'+esc(m.ico||'◆')+'</span>' +
          '<div class="sg-slot-body">' +
            '<div class="sg-slot-name">'+esc(m.name)+'</div>' +
            '<div class="sg-slot-effect">'+esc(effTxt)+'</div>' +
          '</div>' +
          '<button class="sg-slot-remove" data-idx="'+i+'" title="Retirer">✕</button>';
      } else {
        div.className='sg-slot is-empty';
        div.dataset.idx=i;
        div.innerHTML='<div class="sg-slot-body">+ Slot '+(i+1)+'</div>';
      }
      slotsEl.appendChild(div);
    }
    slotsEl.querySelectorAll('.sg-slot.is-empty').forEach(function(el){
      el.addEventListener('click', function(){
        STATE.pendingSlotIndex=parseInt(el.dataset.idx,10);
        openMaterialBrowser();
      });
    });
    slotsEl.querySelectorAll('.sg-slot-remove').forEach(function(el){
      el.addEventListener('click', function(e){
        e.stopPropagation();
        var idx=parseInt(el.dataset.idx,10);
        STATE.materialSlots[idx]=null;
        renderSlots(); renderStatsPreview(); updateForgeButton();
      });
    });
  }

  function _describeMaterial(m){
    if(m.kind==='stat_flat') return '+'+m.roll_value+' '+_statLabel(m.stat);
    if(m.kind==='stat_mult') return '×'+(1+m.roll_value).toFixed(2)+' '+_statLabel(m.stat);
    if(m.kind==='stat_mult_all') return '×'+(1+m.roll_value).toFixed(2)+' toutes stats';
    if(m.kind==='critique') return '+'+m.roll_value+'% critique';
    if(m.kind==='degats_bruts') return '+'+m.roll_value+' dégâts bruts';
    if(m.kind==='regen') return '+'+m.roll_value+'% régen';
    if(m.kind==='stabilizer') return '−'+Math.abs(m.instab)+' instabilité';
    if(m.kind==='cap_breaker_flat') return '+'+Math.round((m.pct||0)*100)+'% cap stats';
    if(m.kind==='cap_breaker_mult') return '+'+m.value+' cap multiplicateurs';
    if(m.kind==='cap_breaker_all') return '+'+Math.round((m.pct||0)*100)+'% TOUS caps';
    return m.description||'—';
  }

  /* ═══════════════════════════════════════════════════════════════════
     MATERIAL BROWSER
     ═══════════════════════════════════════════════════════════════════ */
  function _materialCompatibleWithType(matDef){
    if(!STATE.selectedType) return true;
    var t=(STATE.config._item_types||{})[STATE.selectedType];
    if(!t) return true;
    var compatStats=t.compatible_jaharta_stats||[];
    var compatSpecs=t.compatible_specials||[];

    if(matDef.kind==='stat_flat' || matDef.kind==='stat_mult'){
      return compatStats.indexOf(matDef.stat)!==-1;
    }
    if(matDef.kind==='stat_mult_all') return true;
    if(matDef.kind==='critique' || matDef.kind==='degats_bruts' || matDef.kind==='regen'){
      return compatSpecs.indexOf(matDef.kind)!==-1;
    }
    /* stabilizers + cap breakers = toujours compatibles */
    return true;
  }

  function openMaterialBrowser(){
    var browser=$('#sg-material-browser');
    var inv=(STATE.inventory&&STATE.inventory.items)||{};
    var mats=STATE.config.materiaux||{};
    var entries=Object.entries(mats);
    entries.sort(function(a,b){
      var ra=STATE.config._rarity_order.indexOf(a[1].rarity||'common');
      var rb=STATE.config._rarity_order.indexOf(b[1].rarity||'common');
      if(ra!==rb) return ra-rb;
      return a[1].name.localeCompare(b[1].name,'fr');
    });

    browser.innerHTML=entries.map(function(kv){
      var id=kv[0], m=kv[1];
      var qty=parseInt(inv[id]||0,10)||0;
      var compatible=_materialCompatibleWithType(m);
      var disabled = qty<=0 || !compatible;
      var rcol=(STATE.config._rarity_colors||{})[m.rarity]||'#888';
      var instText='';
      if(typeof m.instab==='number'){
        if(m.instab<0) instText='<div class="sg-mat-instab is-stab">Stabilise '+m.instab+'</div>';
        else if(m.instab>0) instText='<div class="sg-mat-instab">+'+m.instab+' instab.</div>';
      }
      var effTxt=_describeMaterialPreview(m);
      return '<div class="sg-mat-card'+(disabled?' is-incompatible':'')+'" data-id="'+esc(id)+'" style="border-left:3px solid '+rcol+'">' +
        '<div class="sg-mat-head">' +
          '<span class="sg-mat-ico">'+esc(m.ico||'◆')+'</span>' +
          '<span class="sg-mat-name">'+esc(m.name)+'</span>' +
          '<span class="sg-mat-qty">×'+qty+'</span>' +
        '</div>' +
        '<div class="sg-mat-effect">'+esc(effTxt)+'</div>' +
        instText +
        (!compatible && qty>0 ? '<div class="sg-mat-instab" style="color:var(--sg-text-mute);font-style:italic;margin-top:4px">Incompatible avec ce type</div>' : '') +
      '</div>';
    }).join('');

    browser.querySelectorAll('.sg-mat-card').forEach(function(el){
      el.addEventListener('click', function(){
        if(el.classList.contains('is-incompatible')) return;
        var id=el.dataset.id;
        _applyMaterialToSlot(id, STATE.pendingSlotIndex);
        $('#material-modal').hidden=true;
      });
    });

    $('#material-modal').hidden=false;
  }

  function _describeMaterialPreview(m){
    if(m.kind==='stat_flat')      return '+'+m.min+'-'+m.max+' '+_statLabel(m.stat);
    if(m.kind==='stat_mult')      return '×'+(1+m.min).toFixed(2)+'-'+(1+m.max).toFixed(2)+' '+_statLabel(m.stat);
    if(m.kind==='stat_mult_all')  return '×'+(1+m.min).toFixed(2)+'-'+(1+m.max).toFixed(2)+' toutes stats';
    if(m.kind==='critique')       return '+'+m.min+'-'+m.max+'% critique';
    if(m.kind==='degats_bruts')   return '+'+m.min+'-'+m.max+' dégâts bruts';
    if(m.kind==='regen')          return '+'+m.min+'-'+m.max+'% régénération';
    if(m.kind==='stabilizer')     return 'Stabilisateur ('+m.min+'-'+m.max+' réduction)';
    if(m.kind==='cap_breaker_flat')return 'Cap stats +'+Math.round((m.pct||0)*100)+'%';
    if(m.kind==='cap_breaker_mult')return 'Cap mults +'+m.value;
    if(m.kind==='cap_breaker_all') return 'TOUS caps +'+Math.round((m.pct||0)*100)+'%';
    return m.description||'—';
  }

  function _applyMaterialToSlot(matId, slotIdx){
    if(slotIdx==null) return;
    var matDef=(STATE.config.materiaux||{})[matId];
    if(!matDef) return;
    /* Roll the random value */
    var rollVal=0;
    if(matDef.kind==='stat_flat')           rollVal=_randInt(matDef.min, matDef.max);
    else if(matDef.kind==='stat_mult')      rollVal=_round(_randBetween(matDef.min, matDef.max),2);
    else if(matDef.kind==='stat_mult_all')  rollVal=_round(_randBetween(matDef.min, matDef.max),2);
    else if(matDef.kind==='critique')       rollVal=_randInt(matDef.min, matDef.max);
    else if(matDef.kind==='degats_bruts')   rollVal=_randInt(matDef.min, matDef.max);
    else if(matDef.kind==='regen')          rollVal=_randInt(matDef.min, matDef.max);
    else if(matDef.kind==='stabilizer')     rollVal=_randInt(matDef.min, matDef.max);

    STATE.materialSlots[slotIdx]=Object.assign({_id: matId, roll_value: rollVal}, matDef);
    renderSlots(); renderStatsPreview(); updateForgeButton();
  }

  /* ═══════════════════════════════════════════════════════════════════
     STATS PREVIEW + INSTABILITY
     ═══════════════════════════════════════════════════════════════════ */
  function _computeBuild(){
    /* Agrège les effets de tous les mats appliqués */
    var noyau=STATE.selectedNoyauId ? (STATE.config.noyaux||{})[STATE.selectedNoyauId] : null;
    if(!noyau) return null;
    var rarity=noyau.max_rarity_attainable || noyau.rarity || 'common';
    var caps=STATE.config._caps||{};
    var flatCap=caps.stat_flat[rarity] || 30;
    var multCap=caps.stat_mult[rarity] || 1.05;
    var critCap=caps.critique[rarity] || 5;
    var degCap=caps.degats_bruts[rarity] || 30;
    var regCap=caps.regen[rarity] || 3;

    var instab=noyau.start_instability||0;
    var statsFlat={}, statsMult={};
    var critique=0, degBruts=0, regen=0;

    /* Briseurs de cap globaux à pré-appliquer */
    var capBreakFlatPct=0, capBreakMultVal=0, capBreakAllPct=0;
    STATE.materialSlots.forEach(function(m){
      if(!m) return;
      if(m.kind==='cap_breaker_flat') capBreakFlatPct += (m.pct||0);
      else if(m.kind==='cap_breaker_mult') capBreakMultVal += (m.value||0);
      else if(m.kind==='cap_breaker_all') capBreakAllPct += (m.pct||0);
    });
    flatCap = Math.floor(flatCap * (1 + capBreakFlatPct + capBreakAllPct));
    multCap = _round(multCap + capBreakMultVal + (multCap * capBreakAllPct), 3);
    critCap = Math.floor(critCap * (1 + capBreakAllPct));
    degCap = Math.floor(degCap * (1 + capBreakAllPct));
    regCap = Math.floor(regCap * (1 + capBreakAllPct));

    STATE.materialSlots.forEach(function(m){
      if(!m) return;
      instab += (m.instab || 0);
      if(m.kind==='stat_flat') statsFlat[m.stat] = (statsFlat[m.stat]||0) + (m.roll_value||0);
      else if(m.kind==='stat_mult') statsMult[m.stat] = _round((statsMult[m.stat]||1) * (1 + (m.roll_value||0)), 3);
      else if(m.kind==='stat_mult_all'){
        ['strength','agility','speed','intelligence','mana','resistance','charisma','aura'].forEach(function(s){
          statsMult[s] = _round((statsMult[s]||1) * (1 + (m.roll_value||0)), 3);
        });
      }
      else if(m.kind==='critique') critique += (m.roll_value||0);
      else if(m.kind==='degats_bruts') degBruts += (m.roll_value||0);
      else if(m.kind==='regen') regen += (m.roll_value||0);
    });
    /* Capping */
    var cappedStats={};
    Object.keys(statsFlat).forEach(function(s){
      cappedStats[s]={value: Math.min(statsFlat[s], flatCap), raw: statsFlat[s], capped: statsFlat[s]>flatCap};
    });
    var cappedMults={};
    Object.keys(statsMult).forEach(function(s){
      cappedMults[s]={value: Math.min(statsMult[s], multCap), raw: statsMult[s], capped: statsMult[s]>multCap};
    });
    var cappedCrit = {value: Math.min(critique, critCap), raw: critique, capped: critique>critCap};
    var cappedDeg = {value: Math.min(degBruts, degCap), raw: degBruts, capped: degBruts>degCap};
    var cappedReg = {value: Math.min(regen, regCap), raw: regen, capped: regen>regCap};

    instab = Math.max(0, Math.min(instab, 100));

    return {
      noyau: noyau, rarity: rarity,
      stats: cappedStats, mults: cappedMults,
      critique: cappedCrit, degats_bruts: cappedDeg, regen: cappedReg,
      instab: instab,
      caps: { flat: flatCap, mult: multCap, crit: critCap, deg: degCap, reg: regCap }
    };
  }

  function renderStatsPreview(){
    var list=$('#sg-stats-list'); var instabEl=$('#sg-instab');
    var b=_computeBuild();
    if(!b){
      list.innerHTML='<div class="sg-empty-preview">Sélectionne un noyau puis insère des matériaux pour prévisualiser les stats.</div>';
      instabEl.hidden=true;
      return;
    }
    var rows=[];
    Object.keys(b.stats).forEach(function(s){
      var st=b.stats[s];
      rows.push('<div class="sg-stat-row'+(st.capped?' is-capped':'')+'">' +
        '<span class="sg-stat-label">+'+st.value+' '+_statLabel(s)+'</span>' +
        '<span class="sg-stat-value">'+(st.capped?'CAP':'OK')+'</span>' +
      '</div>');
    });
    Object.keys(b.mults).forEach(function(s){
      var mt=b.mults[s];
      rows.push('<div class="sg-stat-row is-mult'+(mt.capped?' is-capped':'')+'">' +
        '<span class="sg-stat-label">×'+mt.value.toFixed(2)+' '+_statLabel(s)+'</span>' +
        '<span class="sg-stat-value">'+(mt.capped?'CAP':'OK')+'</span>' +
      '</div>');
    });
    if(b.critique.value>0){
      rows.push('<div class="sg-stat-row is-special'+(b.critique.capped?' is-capped':'')+'">' +
        '<span class="sg-stat-label">+'+b.critique.value+'% Critique</span>' +
        '<span class="sg-stat-value">'+(b.critique.capped?'CAP':'OK')+'</span>' +
      '</div>');
    }
    if(b.degats_bruts.value>0){
      rows.push('<div class="sg-stat-row is-special'+(b.degats_bruts.capped?' is-capped':'')+'">' +
        '<span class="sg-stat-label">+'+b.degats_bruts.value+' Dégâts bruts</span>' +
        '<span class="sg-stat-value">'+(b.degats_bruts.capped?'CAP':'OK')+'</span>' +
      '</div>');
    }
    if(b.regen.value>0){
      rows.push('<div class="sg-stat-row is-special'+(b.regen.capped?' is-capped':'')+'">' +
        '<span class="sg-stat-label">+'+b.regen.value+'% Régénération</span>' +
        '<span class="sg-stat-value">'+(b.regen.capped?'CAP':'OK')+'</span>' +
      '</div>');
    }
    if(rows.length===0) list.innerHTML='<div class="sg-empty-preview">Aucun bonus accumulé.</div>';
    else list.innerHTML = rows.join('') +
      '<div class="sg-stat-cap" style="margin-top:8px">Caps : flat '+b.caps.flat+' · mult ×'+b.caps.mult+' · critique '+b.caps.crit+'% · dégâts '+b.caps.deg+' · régen '+b.caps.reg+'%</div>';

    /* Instab */
    instabEl.hidden=false;
    var paliers=STATE.config._instabilite_paliers||{};
    var palier=null;
    Object.keys(paliers).forEach(function(k){
      var p=paliers[k];
      if(b.instab>=p.min && b.instab<=p.max) palier=p;
    });
    var pct=Math.min(100, b.instab);
    $('#sg-instab-fill').style.width=pct+'%';
    $('#sg-instab-value').textContent=b.instab+' / 100';
    var label=$('#sg-instab-label');
    if(palier){
      label.textContent=palier.label+' · '+palier.effect;
      label.style.color=palier.color||'';
    } else {
      label.textContent='—';
    }
  }

  function updateForgeButton(){
    var btn=$('#sg-forge-btn');
    var b=_computeBuild();
    var ok=b && STATE.selectedType && STATE.itemName && STATE.itemName.trim().length>=2 && b.instab<100 &&
           STATE.materialSlots.filter(function(m){return m;}).length>0;
    btn.disabled=!ok;
  }

  function updateSteps(){
    var step=1;
    if(STATE.selectedNoyauId) step=2;
    if(STATE.selectedNoyauId && STATE.selectedType) step=3;
    if(step>=3 && STATE.itemName.trim().length>=2) step=4;
    if(step>=4 && STATE.materialSlots.filter(function(m){return m;}).length>0) step=5;
    $$('.sg-step').forEach(function(el){
      var s=parseInt(el.dataset.step,10);
      el.classList.toggle('is-active', s===step);
      el.classList.toggle('is-done', s<step);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     FORGE
     ═══════════════════════════════════════════════════════════════════ */
  function openConfirm(){
    var b=_computeBuild();
    if(!b) return;
    var t=(STATE.config._item_types||{})[STATE.selectedType]||{};
    var lines=[
      '<p class="sg-state-text" style="margin-bottom:18px">Tu vas forger <strong style="color:var(--sg-cyan-2)">'+esc(STATE.itemName)+'</strong> ('+esc(t.label)+'). Cette action est <strong>définitive</strong> : les matériaux seront consommés et le noyau utilisé.</p>'
    ];
    /* Risk note */
    var paliers=STATE.config._instabilite_paliers||{};
    var palier=null;
    Object.keys(paliers).forEach(function(k){
      var p=paliers[k];
      if(b.instab>=p.min && b.instab<=p.max) palier=p;
    });
    if(palier){
      lines.push('<div style="padding:10px;margin:12px 0;background:rgba(5,2,20,0.6);border-left:3px solid '+(palier.color||'#888')+'"><strong style="color:'+(palier.color||'#888')+'">'+esc(palier.label)+' ('+b.instab+'/100)</strong> · '+esc(palier.effect)+'</div>');
    }
    $('#confirm-title').textContent=STATE.itemName;
    $('#confirm-body').innerHTML=lines.join('');
    $('#confirm-modal').hidden=false;
  }
  function closeConfirm(){ $('#confirm-modal').hidden=true; }

  async function executeForge(){
    if(STATE.forging) return;
    STATE.forging=true;
    closeConfirm();

    /* Anim */
    var rm=$('#result-modal'); var rc=$('#result-content');
    rc.innerHTML='<div class="sg-forge-anim"><div class="sg-forge-core"></div><div class="sg-forge-text">Forge en cours…</div></div>';
    rm.hidden=false;
    await new Promise(function(r){ setTimeout(r, 2600); });

    var b=_computeBuild();
    var noyauId=STATE.selectedNoyauId;
    var noyau=(STATE.config.noyaux||{})[noyauId];

    /* Roll instabilité : applique les conséquences selon le palier final */
    var instab=b.instab;
    var outcome='success';
    var lossInfo=null;
    var mutationInfo=null;
    if(instab>=100){
      outcome='rupture';
    } else if(instab>=76){
      /* 30 % perte 1 stat */
      if(Math.random() < 0.30){
        outcome='loss';
        var statKeys=Object.keys(b.stats).concat(Object.keys(b.mults));
        if(statKeys.length>0){
          var lost=statKeys[_randInt(0,statKeys.length-1)];
          lossInfo=lost;
          if(b.stats[lost]) delete b.stats[lost];
          if(b.mults[lost]) delete b.mults[lost];
        }
      }
    } else if(instab>=51){
      /* 10 % mutation */
      if(Math.random() < 0.10){
        outcome='mutation';
        var jStats=['strength','agility','speed','intelligence','mana','resistance','charisma','aura'];
        var picked=jStats[_randInt(0,jStats.length-1)];
        var mutVal=_randInt(5,20);
        b.stats[picked]={value: (b.stats[picked]||{value:0}).value + mutVal, raw:0, capped:false};
        mutationInfo={stat:picked, value:mutVal};
      }
    }

    if(outcome==='rupture'){
      /* Consomme le noyau, perd les stabilisateurs/breakers */
      await _consumeMaterialsAndNoyau(true);
      _showRupture(rc);
      STATE.forging=false;
      return;
    }

    /* SUCCESS : build the item record */
    var uuid=_uuid();
    var t=(STATE.config._item_types||{})[STATE.selectedType]||{};
    /* Roll des effets spéciaux selon la rareté du noyau */
    var rolledEffects = _rollSpecialEffects(b.rarity);
    var itemRecord={
      _id: uuid,
      created_at: Date.now(),
      name: STATE.itemName,
      icon: STATE.iconValue || '✦',
      icon_is_image: !!STATE.iconIsImage,
      type: STATE.selectedType,
      type_label: t.label,
      rarity: b.rarity,
      noyau: noyauId,
      slots: STATE.materialSlots.filter(function(m){return m;}).map(function(m){
        return { id: m._id, kind: m.kind, stat: m.stat||null, value: m.roll_value||0 };
      }),
      stats_flat: Object.fromEntries(Object.entries(b.stats).map(function(kv){return [kv[0], kv[1].value];})),
      stats_mult: Object.fromEntries(Object.entries(b.mults).map(function(kv){return [kv[0], kv[1].value];})),
      critique: b.critique.value,
      degats_bruts: b.degats_bruts.value,
      regen: b.regen.value,
      instab_final: instab,
      mutation: mutationInfo,
      lost_stat: lossInfo,
      special_effects: rolledEffects
    };

    try {
      await _saveItemAndConsume(itemRecord);
    } catch(e){
      console.error('[singularite] save failed', e);
      rc.innerHTML='<div class="sg-empty-preview" style="color:var(--sg-magenta-2)">⚠ Erreur sauvegarde : '+esc(e.message||'erreur')+'</div>';
      STATE.forging=false;
      return;
    }

    _showSuccess(rc, itemRecord, outcome, mutationInfo, lossInfo);
    STATE.forging=false;
  }

  async function _saveItemAndConsume(itemRecord){
    var dbref=_getDb();
    var inv=STATE.inventory||{items:{},singularity_items:{}};
    var newItems=Object.assign({},inv.items||{});
    var newSing=Object.assign({},inv.singularity_items||{});

    /* Consomme noyau */
    var noyauId=STATE.selectedNoyauId;
    newItems[noyauId] = Math.max(0, (parseInt(newItems[noyauId]||0,10)||0) - 1);
    if(newItems[noyauId]<=0) delete newItems[noyauId];

    /* Consomme matériaux */
    var matCounts={};
    STATE.materialSlots.forEach(function(m){ if(m) matCounts[m._id] = (matCounts[m._id]||0)+1; });
    Object.keys(matCounts).forEach(function(id){
      newItems[id] = Math.max(0, (parseInt(newItems[id]||0,10)||0) - matCounts[id]);
      if(newItems[id]<=0) delete newItems[id];
    });

    /* Ajoute item Singularité */
    newSing[itemRecord._id] = itemRecord;
    /* Reflet dans items[] (compteur) pour visibilité Hub */
    newItems[itemRecord._id] = 1;

    await dbref.collection('inventories').doc(STATE.inventoryKey)
      .set({ items: newItems, singularity_items: newSing }, { merge: true });

    inv.items=newItems; inv.singularity_items=newSing;
    STATE.inventory=inv;
  }

  async function _consumeMaterialsAndNoyau(consumeAll){
    var dbref=_getDb();
    var inv=STATE.inventory||{items:{}};
    var newItems=Object.assign({},inv.items||{});

    var noyauId=STATE.selectedNoyauId;
    newItems[noyauId] = Math.max(0, (parseInt(newItems[noyauId]||0,10)||0) - 1);
    if(newItems[noyauId]<=0) delete newItems[noyauId];

    if(consumeAll){
      var matCounts={};
      STATE.materialSlots.forEach(function(m){ if(m) matCounts[m._id]=(matCounts[m._id]||0)+1; });
      Object.keys(matCounts).forEach(function(id){
        newItems[id] = Math.max(0, (parseInt(newItems[id]||0,10)||0) - matCounts[id]);
        if(newItems[id]<=0) delete newItems[id];
      });
    }
    await dbref.collection('inventories').doc(STATE.inventoryKey).set({items:newItems},{merge:true});
    inv.items=newItems;
    STATE.inventory=inv;
  }

  function _showSuccess(rc, item, outcome, mutation, loss){
    var statsHtml=Object.entries(item.stats_flat).map(function(kv){
      return '<div class="sg-stat-row"><span class="sg-stat-label">+'+kv[1]+' '+_statLabel(kv[0])+'</span></div>';
    }).join('') + Object.entries(item.stats_mult).map(function(kv){
      return '<div class="sg-stat-row is-mult"><span class="sg-stat-label">×'+kv[1].toFixed(2)+' '+_statLabel(kv[0])+'</span></div>';
    }).join('');
    var specHtml='';
    if(item.critique) specHtml += '<div class="sg-stat-row is-special"><span class="sg-stat-label">+'+item.critique+'% Critique</span></div>';
    if(item.degats_bruts) specHtml += '<div class="sg-stat-row is-special"><span class="sg-stat-label">+'+item.degats_bruts+' Dégâts bruts</span></div>';
    if(item.regen) specHtml += '<div class="sg-stat-row is-special"><span class="sg-stat-label">+'+item.regen+'% Régénération</span></div>';
    /* Effets spéciaux */
    var effHtml='';
    if(item.special_effects && item.special_effects.length > 0){
      effHtml = '<div style="margin:14px 0 6px;font-family:Orbitron;font-weight:700;font-size:0.7rem;letter-spacing:0.24em;text-transform:uppercase;color:var(--sg-magenta-2);text-align:center">// EFFETS SPÉCIAUX RÉVÉLÉS</div>';
      effHtml += item.special_effects.map(function(e){
        var rcol=(STATE.config._rarity_colors||{})[e.rarity]||'#888';
        return '<div style="padding:10px 14px;margin-bottom:6px;background:rgba(5,2,20,0.6);border-left:3px solid '+rcol+'">' +
          '<div style="font-family:Orbitron;font-weight:700;font-size:0.78rem;letter-spacing:0.06em;color:var(--sg-text-2);text-transform:uppercase">' +
            esc(e.ico||'✦')+' '+esc(e.name) +
            '<span style="float:right;font-family:Rajdhani;font-size:0.62rem;letter-spacing:0.18em;color:'+rcol+'">'+esc(e.rarity)+'</span>' +
          '</div>' +
          '<div style="font-family:Rajdhani;font-size:0.85rem;color:var(--sg-text);margin-top:4px;line-height:1.4">'+esc(e.description)+'</div>' +
        '</div>';
      }).join('');
    }

    var notes='';
    if(outcome==='mutation' && mutation){
      notes='<div style="margin:14px 0;padding:10px;background:rgba(255,107,53,0.1);border-left:3px solid #ff6b35;color:#ff6b35;font-family:Rajdhani"><strong>⚠ Mutation imprévue :</strong> +'+mutation.value+' '+_statLabel(mutation.stat)+' (instabilité élevée)</div>';
    } else if(outcome==='loss' && loss){
      notes='<div style="margin:14px 0;padding:10px;background:rgba(255,26,58,0.1);border-left:3px solid var(--sg-red);color:var(--sg-red);font-family:Rajdhani"><strong>⚠ Perte :</strong> la stat <strong>'+_statLabel(loss)+'</strong> a été perdue dans le processus (instabilité critique)</div>';
    }

    var rcol=(STATE.config._rarity_colors||{})[item.rarity]||'#888';
    var iconHtml = item.icon_is_image
      ? '<img src="'+esc(item.icon)+'" style="width:160px;height:160px;object-fit:cover;border-radius:50%;border:2px solid '+rcol+';margin:0 auto;display:block">'
      : '<div style="font-size:5rem;text-align:center;color:'+rcol+';filter:drop-shadow(0 0 18px '+rcol+'88)">'+esc(item.icon)+'</div>';

    rc.innerHTML =
      '<div style="text-align:center;margin-bottom:14px"><div style="font-family:Orbitron;font-weight:600;font-size:0.7rem;letter-spacing:0.32em;text-transform:uppercase;color:var(--sg-gold);margin-bottom:10px">// FORGE RÉUSSIE</div>' +
        iconHtml +
        '<h2 style="font-family:Orbitron;font-weight:900;font-size:1.6rem;letter-spacing:0.16em;text-transform:uppercase;margin-top:14px;background:linear-gradient(120deg,var(--sg-cyan-2),var(--sg-gold-2),var(--sg-magenta-2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">'+esc(item.name)+'</h2>' +
        '<div style="font-family:Rajdhani;font-weight:700;font-size:0.85rem;letter-spacing:0.22em;text-transform:uppercase;color:'+rcol+';margin-top:6px">'+esc(item.rarity)+' · '+esc(item.type_label)+'</div>' +
      '</div>' +
      notes +
      '<div class="sg-stats-list" style="margin:16px 0">' + statsHtml + specHtml + '</div>' +
      effHtml +
      '<div class="sg-actions">' +
        '<button class="sg-btn sg-btn-gold" id="result-close-btn" type="button"><span>Recevoir</span><span>✦</span></button>' +
      '</div>';

    $('#result-close-btn').addEventListener('click', function(){
      $('#result-modal').hidden=true;
      _resetBuild();
      renderHeader(); renderNoyaux(); renderSlots(); renderStatsPreview(); renderPreview();
    });
  }

  function _showRupture(rc){
    rc.innerHTML =
      '<div style="text-align:center">' +
        '<div style="font-family:Orbitron;font-weight:700;font-size:0.7rem;letter-spacing:0.32em;text-transform:uppercase;color:var(--sg-magenta);margin-bottom:14px">// RUPTURE DE MATRICE</div>' +
        '<div style="font-size:5rem;color:var(--sg-magenta);filter:drop-shadow(0 0 24px var(--sg-glow-m));margin-bottom:18px">💥</div>' +
        '<h2 style="font-family:Orbitron;font-weight:800;font-size:1.4rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--sg-magenta-2);margin-bottom:12px">Effondrement Total</h2>' +
        '<p style="font-family:Rajdhani;color:var(--sg-text);line-height:1.6;max-width:440px;margin:0 auto 22px">L\'instabilité a dépassé le point de non-retour. Le noyau et les matériaux ont été désintégrés. Sois plus prudent avec les stabilisateurs.</p>' +
        '<div class="sg-actions"><button class="sg-btn sg-btn-magenta" id="rupture-close-btn" type="button"><span>Recommencer</span></button></div>' +
      '</div>';
    $('#rupture-close-btn').addEventListener('click', function(){
      $('#result-modal').hidden=true;
      _resetBuild();
      renderHeader(); renderNoyaux(); renderSlots(); renderStatsPreview(); renderPreview();
    });
  }

  /* Roll d'effets spéciaux selon la rareté du noyau atteignable.
     Le nombre d'effets et la rareté minimum sont définis dans
     _effets_par_rarete. Choix uniforme dans le pool éligible. */
  function _rollSpecialEffects(itemRarity){
    var byRarity = STATE.config._effets_par_rarete || {};
    var rule = byRarity[itemRarity];
    if (!rule || !rule.count) return [];
    var rarOrder = STATE.config._rarity_order || [];
    var minIdx = rule.min_tier ? rarOrder.indexOf(rule.min_tier) : 0;
    var maxIdx = rarOrder.indexOf(itemRarity);
    var pool = [];
    Object.entries(STATE.config.effets_speciaux || {}).forEach(function(kv){
      var id = kv[0], def = kv[1];
      var idx = rarOrder.indexOf(def.rarity || 'common');
      if (idx >= minIdx && idx <= maxIdx) pool.push(Object.assign({_id: id}, def));
    });
    if (pool.length === 0) return [];
    /* Tire `count` effets DISTINCTS */
    var out = [];
    var poolCopy = pool.slice();
    var n = Math.min(rule.count, poolCopy.length);
    for (var i = 0; i < n; i++) {
      var pick = poolCopy.splice(_randInt(0, poolCopy.length - 1), 1)[0];
      out.push({
        id: pick._id,
        name: pick.name,
        ico: pick.ico,
        category: pick.category,
        rarity: pick.rarity,
        description: pick.description
      });
    }
    return out;
  }

  function _resetBuild(){
    STATE.selectedNoyauId=null;
    STATE.selectedType=null;
    STATE.itemName='';
    STATE.iconValue='✦';
    STATE.iconIsImage=false;
    STATE.materialSlots=[];
    $('#sg-name-input').value='';
    $('#sg-icon-url-input').value='';
    renderTypes(); renderIconGallery();
    updateSteps(); updateForgeButton();
  }

  /* ═══════════════════════════════════════════════════════════════════
     CHAR SWITCHER
     ═══════════════════════════════════════════════════════════════════ */
  function openCharSwitcher(){
    var grid=$('#charswitch-grid'); grid.innerHTML='';
    var chars=STATE.chars && STATE.chars.length>0 ? STATE.chars : [STATE.activeChar].filter(Boolean);
    chars.forEach(function(c){
      var name=((c.first_name||'')+' '+(c.last_name||'')).trim()||c._id||c.id;
      var ax=c.axiome_current||'néophyte';
      var unl=_isUnlimited(c);
      var card=document.createElement('div');
      card.className='sg-noyau';
      card.style.cursor='pointer';
      card.innerHTML=
        '<span class="sg-noyau-ico">👤</span>' +
        '<div class="sg-noyau-body">' +
          '<div class="sg-noyau-name">'+esc(name)+'</div>' +
          '<div class="sg-noyau-meta">'+esc(ax.toUpperCase())+(unl?' · ✦ ILLIMITÉ':'')+'</div>' +
        '</div>';
      card.addEventListener('click', function(){
        location.href='singularite.html?char='+encodeURIComponent(c._id||c.id);
      });
      grid.appendChild(card);
    });
    $('#charswitch-modal').hidden=false;
  }

  /* ═══════════════════════════════════════════════════════════════════
     WIRE
     ═══════════════════════════════════════════════════════════════════ */
  function wire(){
    document.querySelectorAll('[data-close]').forEach(function(el){
      el.addEventListener('click', function(){
        var m=el.closest('.sg-modal'); if(m) m.hidden=true;
      });
    });
    $('#sg-char-chip').addEventListener('click', openCharSwitcher);

    /* Name input */
    $('#sg-name-input').addEventListener('input', function(e){
      STATE.itemName=e.target.value.slice(0,200);
      renderPreview(); updateSteps(); updateForgeButton();
    });

    /* Icon tabs */
    $$('.sg-icon-tab').forEach(function(t){
      t.addEventListener('click', function(){
        var tab=t.dataset.tab;
        STATE.iconMode=tab;
        $$('.sg-icon-tab').forEach(function(x){ x.classList.toggle('is-active', x===t); });
        ['gallery','url','upload'].forEach(function(n){
          var el=document.getElementById('sg-icon-tab-'+n);
          if(el) el.hidden=(n!==tab);
        });
      });
    });
    /* URL input */
    $('#sg-icon-url-input').addEventListener('input', function(e){
      var url=e.target.value.trim();
      if(url && /^https?:\/\//i.test(url)){
        STATE.iconValue=url; STATE.iconIsImage=true; renderPreview();
      }
    });
    /* File drop / upload */
    var drop=$('#sg-icon-drop');
    var fileInput=$('#sg-icon-file');
    drop.addEventListener('click', function(){ fileInput.click(); });
    drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', function(){ drop.classList.remove('is-dragover'); });
    drop.addEventListener('drop', function(e){
      e.preventDefault(); drop.classList.remove('is-dragover');
      if(e.dataTransfer.files && e.dataTransfer.files[0]) _handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function(e){
      if(e.target.files && e.target.files[0]) _handleFile(e.target.files[0]);
    });

    /* Reset / Forge */
    $('#sg-reset-btn').addEventListener('click', function(){
      if(confirm('Reset complet ? Tu perdras ta sélection en cours.')){
        _resetBuild(); renderNoyaux(); renderSlots(); renderStatsPreview(); renderPreview();
      }
    });
    $('#sg-forge-btn').addEventListener('click', openConfirm);
    $('#confirm-forge-btn').addEventListener('click', executeForge);
  }

  function _handleFile(file){
    if(!file.type.startsWith('image/')){ flashToast('⚠ Doit être une image','error'); return; }
    if(file.size > 200*1024){ flashToast('⚠ Image > 200 Ko','error'); return; }
    var reader=new FileReader();
    reader.onload=function(e){
      STATE.iconValue=e.target.result;
      STATE.iconIsImage=true;
      $('#sg-icon-drop-label').textContent='✓ '+file.name+' ('+Math.round(file.size/1024)+' Ko)';
      renderPreview();
    };
    reader.readAsDataURL(file);
  }

  /* ─── Toast ─── */
  function flashToast(msg, kind){
    var t=document.createElement('div');
    t.className='sg-toast '+(kind==='error'?'is-error':'is-success');
    t.textContent=msg;
    document.body.appendChild(t);
    setTimeout(function(){ try{ t.remove(); }catch(_){} }, 3800);
  }

  /* ─── INIT ─── */
  async function init(){
    try{ await loadConfig(); }
    catch(e){
      console.error('[singularite] config load failed', e);
      $('#state-loading').innerHTML='<div class="sg-state-glyph">⚠</div><h2 class="sg-state-title">Erreur</h2><p class="sg-state-text">Impossible de charger la config Singularité.</p>';
      return;
    }
    await Promise.all([loadActiveChar(), loadAllChars()]);
    if(STATE.noSession){ showState('state-no-session'); return; }
    if(!STATE.activeChar){ showState('state-no-chars'); return; }
    await loadInventory();
    showState('view-main');
    renderHeader(); renderNoyaux(); renderTypes(); renderIconGallery();
    renderSlots(); renderPreview(); renderStatsPreview();
    wire();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

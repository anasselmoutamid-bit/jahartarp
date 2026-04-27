/* ═══════════════════════════════════════════════════════════════════════
   docs/js/hub-character.js — Onglet Personnage
   ═══════════════════════════════════════════════════════════════════════
   Fonctions : renderFullChar + calcul stats/équipements/bonus
   ═══════════════════════════════════════════════════════════════════════ */

// ── RENDER PERSONNAGE ──
function renderFullChar(){
  const c=CHAR,fn=c.first_name||'',ln=c.last_name||'';
  const name=[fn,ln].filter(Boolean).join(' ')||'Personnage';
  const stats=c.stats||{},powers=c.powers||[];
  // Image
  const imgSlot=document.getElementById('char-img-slot');
  if(imgSlot){
    if(c.profile_image){
      imgSlot.className='char-full-img-wrap';
      const _cachedCharUrl=window.JImgCache?window.JImgCache.get('char_'+CHAR_ID):null;
      imgSlot.innerHTML=`<img src="${e(_cachedCharUrl||c.profile_image)}" class="char-full-img" alt="${e(name)}" onerror="this.parentElement.innerHTML='<div class=\"char-full-placeholder\">NO IMAGE</div>'">`;
      if(window.JImgCache)window.JImgCache.set('char_'+CHAR_ID,c.profile_image);
    } else {
      imgSlot.className='char-full-placeholder';
      imgSlot.innerHTML='NO IMAGE';
    }
  }
  // Header
  document.getElementById('char-header-body').innerHTML=`
    <div class="char-fullname">${e(name)}</div>
    <div class="char-fullmeta">${e(c.race_category||'—')} · ${e(c.class||'—')} · ${c.age||'?'} ans${c.marital_status?' · '+e(c.marital_status):''}</div>
    <div class="char-tags">
      <span class="badge badge-race">${e(c.race_category||'—')}</span>
      <span class="badge badge-class">${e(c.class||'—')}</span>
      ${(c.affinity||[]).slice(0,3).map(a=>`<span class="badge badge-gold">${e(a)}</span>`).join('')}
    </div>
    <div style="display:flex;gap:20px;align-items:center;margin-top:16px">
      <div><div class="csb-val">${levelFromXp(c.xp||0).level}</div><div class="csb-label">NIVEAU</div></div>
      <div><div class="csb-val">${(c.xp||0).toLocaleString()}</div><div class="csb-label">XP</div></div>
      ${c.available_stat_points?`<div><div class="csb-val" style="color:var(--gold)">${c.available_stat_points}</div><div class="csb-label">STAT PTS</div></div>`:''}
    </div>`;
  const sp=parseInt(c.available_stat_points||0);

  /* ── Calcul bonus par catégorie ── */
  const bEquip={},bSets={},bParty={},bTitles={},bBuffs={},bComp={},bSig={},bMythic={},bAch={};
  const bonuses={}; // total
  function addTo(cat,s,v){v=parseInt(v)||0;if(!v)return;cat[s]=(cat[s]||0)+v;bonuses[s]=(bonuses[s]||0)+v;}

  // 1) Équipement direct (skip signature + equalizer)
  const eqList=(INV_DATA&&INV_DATA.equipped_assets)||[];
  eqList.forEach(id=>{
    const it=ALL_ITEMS_DATA[id]||{};
    if((it.rarity||'').toLowerCase()==='signature')return;
    if(id==='equalizer')return;
    Object.entries(it.stat_effects||it.stats||{}).forEach(([s,v])=>{
      try{addTo(bEquip,s,parseInt(String(v).replace('+','')));}catch(_){}
    });
  });
  // 2) Sets (highest threshold only — mirrors bot)
  const setResult=calculateSetBonuses(eqList);
  Object.entries(setResult.stats).forEach(([s,v])=>{addTo(bSets,s,v);});
  // 3) Party
  if(PARTY_DATA&&PARTY_DATA.members){
    const me=(PARTY_DATA.members||[]).find(m=>m.char_key===UID+'_'+CHAR_ID);
    if(me&&me.bonuses)Object.entries(me.bonuses).forEach(([s,v])=>{addTo(bParty,s,v);});
  }
  // 4) Titres
  if(TITLES_DATA&&TITLES_DEF){
    Object.entries(TITLES_DATA.titles||{}).forEach(([tid,ts])=>{
      const td=TITLES_DEF[tid];if(!td)return;
      const tier=ts.current_tier||ts.tier||1;
      const tierDef=(td.tiers||[]).find(t=>t.tier===tier);
      if(tierDef&&tierDef.stat_bonuses)Object.entries(tierDef.stat_bonuses).forEach(([s,v])=>{addTo(bTitles,s,v);});
    });
  }
  // 5) Buffs
  (BUFFS_DATA||[]).forEach(b=>{
    if(b.effects)Object.entries(b.effects).forEach(([s,v])=>{addTo(bBuffs,s,v);});
  });
  // 6) Compagnons (sync bonuses du compagnon actif)
  let activeCompName='';
  let compBuffMult={}; // {stat: multiplier} from evolved companions
  if(COMP_USER&&COMP_CFG){
    const owned=COMP_USER.owned_companions||{};
    const activeId=COMP_USER.active_companion;
    if(activeId&&owned[activeId]){
      const cd=owned[activeId];
      const form=cd.current_form||activeId;
      const allComps=COMP_CFG.companions||{};
      const allEvos=COMP_CFG.evolutions||{};
      const info=allEvos[form]||allComps[form]||allComps[activeId]||{};
      const baseEntry=allComps[activeId]||{};
      activeCompName=info.name||form||activeId;
      if(cd.synchronized){
        const syncBonuses=info.sync_bonuses||baseEntry.sync_bonuses||{};
        Object.entries(syncBonuses).forEach(([s,v])=>{addTo(bComp,s,v);});
        // Companion sync_power flat bonuses
        const spBonuses=_compSyncPowerBonuses(info.sync_power||baseEntry.sync_power||'');
        Object.entries(spBonuses).forEach(([s,v])=>{addTo(bComp,s,v);});
        // buff_mult for evolved companions
        compBuffMult=info.buff_mult||{};
      }
    }
  }
  // 7) Signature items
  const auraEnabled=parseInt(stats.aura||0)>0;
  const existingBuffsForSig={...bonuses}; // all non-sig bonuses accumulated so far
  const sigBonuses=calculateSignatureBonuses(eqList,stats,auraEnabled,existingBuffsForSig);
  Object.entries(sigBonuses).forEach(([s,v])=>{addTo(bSig,s,v);});

  // 8) Mythic+ effects (pct_base, conditional, nerf_reduction tracked in bMythic)
  const _mythicTemp={};
  const mythicResult=calculateMythicEffects(eqList,stats,_mythicTemp,auraEnabled);
  Object.entries(_mythicTemp).forEach(([s,v])=>{addTo(bMythic,s,v);});

  // 9) Apply buff multipliers (set + item) + Equalizer
  // We need a copy of bonuses to apply multipliers
  const _preMultBonuses={...bonuses};
  applyBuffMultipliersAndEqualizer(bonuses,stats,eqList,mythicResult.itemBuffMult,setResult,auraEnabled);
  // Compute the diff caused by multipliers/equalizer and add to bMythic for display
  Object.keys(bonuses).forEach(s=>{
    const diff=(bonuses[s]||0)-(_preMultBonuses[s]||0);
    if(diff>0)bMythic[s]=(bMythic[s]||0)+diff;
  });

  // 10) Achievement bonuses
  try{
    const achB=window._achGetAllBonuses?window._achGetAllBonuses():(window._achGetBonuses?window._achGetBonuses():{});
    Object.entries(achB).forEach(([s,v])=>{addTo(bAch,s,v);});
  }catch(_){}

  // ── True Self: INT locked at 10, no bonuses apply ──
  const _hasTrueSelf=(()=>{
    const pw=(c.powers||[]);
    for(const p of pw){
      const pid=(typeof p==='string'?p:(p&&p.id||'')).toLowerCase().replace(/ /g,'_');
      if(pid==='true_self')return true;
    }
    const rp=c.racial_power;
    if(rp){
      const rpid=(typeof rp==='string'?rp:(rp&&rp.id||'')).toLowerCase().replace(/ /g,'_');
      if(rpid==='true_self')return true;
    }
    return false;
  })();
  _hasTrueSelf_alloc=_hasTrueSelf; // sync to global for alloc functions
  if(_hasTrueSelf){
    stats.intelligence=10;
    bonuses.intelligence=0;
    bEquip.intelligence=0; bSets.intelligence=0; bParty.intelligence=0;
    bTitles.intelligence=0; bBuffs.intelligence=0; bComp.intelligence=0; bSig.intelligence=0; bMythic.intelligence=0;
    delete bonuses.intelligence;
    delete bEquip.intelligence; delete bSets.intelligence; delete bParty.intelligence;
    delete bTitles.intelligence; delete bBuffs.intelligence; delete bComp.intelligence; delete bSig.intelligence; delete bMythic.intelligence;
  }

  // ── Stats display (with companion buff_mult + rank cap) ──
  const _hubLevel = (typeof levelFromXp==='function' ? (levelFromXp(c.xp||0).level||1) : (c.level||1));
  const _hubRank = (window.Jaharta && Jaharta.rankFromLevel) ? Jaharta.rankFromLevel(_hubLevel) : 'F';
  document.getElementById('char-stats-grid').innerHTML=
    (sp?'<div class="sp-banner" style="grid-column:1/-1">&#9889; '+sp+' pt'+(sp>1?'s':'')+' stat dispo</div>':'')+
    SK.map(k=>{
      if(_hasTrueSelf && k==='intelligence'){
        return '<div class="stat-block"><div class="stat-block-val">10</div><div class="stat-block-bonus" style="color:#a78bfa">🔒 TRUE SELF</div><div class="stat-block-name">'+SI[k]+' '+SL[k]+'</div></div>';
      }
      const base=parseInt(stats[k]||0),bon=bonuses[k]||0;
      let total=base+bon;
      const mult=parseFloat(compBuffMult[k]||0);
      let multLabel='';
      if(mult>0 && mult!==1){
        const before=total;
        total=Math.floor(total*mult);
        const multBonus=total-before;
        if(multBonus>0) multLabel='<div class="stat-block-bonus-detail">×'+mult+' (+'+multBonus+')</div>';
      }
      // Rank cap / overflow — aura not capped
      let capLabel='';
      if(window.Jaharta && Jaharta.applyRankCap){
        const eff=Jaharta.applyRankCap(_hubRank,k,total);
        if(eff!==total){
          capLabel='<div class="stat-block-bonus-detail" style="color:#f59e0b">⚠ cap '+eff+'</div>';
          total=eff;
        }
      }
      return '<div class="stat-block"><div class="stat-block-val">'+total+'</div>'+(bon?'<div class="stat-block-bonus">+'+bon+'</div>':'')+multLabel+capLabel+'<div class="stat-block-name">'+SI[k]+' '+SL[k]+'</div></div>';
    }).join('');

  // ── Powers ──
  document.getElementById('char-powers-grid').innerHTML=powers.length
    ?powers.map(p=>`<div class="power-card"><div class="power-card-dot ${p.quality||'common'}"></div><div><div class="power-card-name">${e(p.name||p.id||'—')}</div><div class="power-card-qual ${p.quality||'common'}">${e((p.quality||'').toUpperCase())}</div></div></div>`).join('')
    :'<div class="empty">Aucun pouvoir</div>';

  // ── Bonus breakdown ──
  const bbEl=document.getElementById('char-bonus-breakdown');
  if(bbEl){
    function renderBonusSection(icon,title,cls,data,subtitle){
      const entries=Object.entries(data).filter(([,v])=>v>0);
      if(!entries.length)return '';
      return `<div class="bonus-section">
        <div class="bonus-section-header">
          <span class="bonus-section-icon">${icon}</span>
          <span class="bonus-section-title ${cls}">${title}</span>
          ${subtitle?'<span class="bonus-section-subtitle">'+subtitle+'</span>':''}
        </div>
        <div class="bonus-section-grid">${entries.map(([s,v])=>
          `<div class="bonus-mini"><div class="bonus-mini-val ${cls==='sig'?'sig-color':'positive'}">+${v}</div><div class="bonus-mini-name">${SI[s]||''} ${(SL[s]||s).substring(0,5)}</div></div>`
        ).join('')}</div></div>`;
    }
    // Signature items equipped
    const sigEquipped=eqList.filter(id=>SIGNATURE_ITEMS[id]);
    const sigTags=sigEquipped.map(id=>`<span class="sig-item-tag">${SIGNATURE_ITEMS[id].icon} ${SIGNATURE_ITEMS[id].name}</span>`).join(' ');
    const compTag=activeCompName?`<span class="comp-active-tag">🐾 ${e(activeCompName)}</span>`:'';

    let html='';
    html+=renderBonusSection('🎒','ÉQUIPEMENT','equip',bEquip,eqList.length+' items');
    html+=renderBonusSection('🧩','SETS','sets',bSets);
    if(sigEquipped.length) html+=renderBonusSection('⭐','SIGNATURE','sig',bSig,sigTags);
    html+=renderBonusSection('🔮','MYTHIC+','equip',bMythic);
    html+=renderBonusSection('🏆','SUCCÈS','ach',bAch);
    if(activeCompName) html+=renderBonusSection('🐾','COMPAGNON','comp',bComp,compTag);
    html+=renderBonusSection('👥','PARTY','party',bParty);
    html+=renderBonusSection('🏷️','TITRES','titles',bTitles);
    html+=renderBonusSection('✨','BUFFS','buffs',bBuffs);
    if(!html) html='<div class="bonus-section-empty">Aucun bonus actif</div>';
    bbEl.innerHTML=html;
  }
}


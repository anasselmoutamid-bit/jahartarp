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
  const bEquip={},bSets={},bParty={},bTitles={},bBuffs={},bComp={},bSig={},bMythic={},bAch={},bRacial={},bLoyaute={};
  const bonuses={}; // total
  function addTo(cat,s,v){v=parseInt(v)||0;if(!v)return;cat[s]=(cat[s]||0)+v;bonuses[s]=(bonuses[s]||0)+v;}

  // 1) Équipement direct (skip signature + equalizer + pandemonium)
  const eqList=(INV_DATA&&INV_DATA.equipped_assets)||[];
  eqList.forEach(id=>{
    const it=ALL_ITEMS_DATA[id]||{};
    if((it.rarity||'').toLowerCase()==='signature')return;
    if((it.rarity||'').toLowerCase()==='pandemonium')return;
    if(id==='equalizer')return;
    Object.entries(it.stat_effects||it.stats||{}).forEach(([s,v])=>{
      try{addTo(bEquip,s,parseInt(String(v).replace('+','')));}catch(_){}
    });
  });
  // 1c) Pandemonium (party-conditional)
  if(typeof calculatePandemoniumBonuses==='function' && typeof PANDEMONIUM_ITEMS_HC!=='undefined'){
    if(eqList.some(id=>PANDEMONIUM_ITEMS_HC[id])){
      let synergy=false;
      try{
        const myKey=(UID&&CHAR_ID)?(UID+'_'+CHAR_ID):'';
        const members=(PARTY_DATA&&PARTY_DATA.members)||[];
        for(const m of members){
          const mck=m&&m.char_key;
          if(!mck||mck===myKey)continue;
          const mEq=(m.equipped_assets||m.equipped||[]);
          if(mEq.some(eid=>PANDEMONIUM_ITEMS_HC[eid])){synergy=true;break;}
        }
      }catch(_){}
      const pdmB=calculatePandemoniumBonuses(eqList,synergy);
      Object.entries(pdmB).forEach(([s,v])=>{addTo(bEquip,s,v);});
    }
  }
  // 2) Sets (highest threshold only — mirrors bot) — passe la race
  const _charBaseRace=(CHAR&&(CHAR.race||CHAR.race_category))||'';
  const setResult=calculateSetBonuses(eqList,_charBaseRace);
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
  // 5) Buffs — IGNORE les sources racial_passive_* / axiome_passive_*, recalculées
  //    en dérivé après l'étape 9. Cf. docs/js/racial-passives.js.
  const _isManagedSrc = (window.RacialPassives && window.RacialPassives.isManagedPassiveSource)
    ? window.RacialPassives.isManagedPassiveSource
    : function(s){ s=String(s||''); return s.indexOf('racial_passive_')===0 || s.indexOf('axiome_passive_')===0; };
  (BUFFS_DATA||[]).forEach(b=>{
    if(_isManagedSrc(b&&b.source)) return;
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

  // 9b) Passifs raciaux (dérivé, parité avec utils/racial_passives.py côté bot).
  //     buffScope = bonuses - bParty (le bot n'inclut pas la party dans son
  //     _eq_buffs + _other_buffs). Les achievements ne sont pas non plus dedans,
  //     mais ils ne sont ajoutés qu'à l'étape 10 → pas besoin de les retirer ici.
  //     Voir docs/js/racial-passives.js pour la liste des passifs gérés.
  if (window.RacialPassives){
    const _scope = {};
    Object.keys(bonuses).forEach(k => { _scope[k] = (bonuses[k]||0) - (bParty[k]||0); });
    const _rpBuffs = window.RacialPassives.computeRacialPassiveBuffs(c, _scope);
    for (const b of _rpBuffs){
      const eff = (b && b.effects) || {};
      for (const k in eff){
        const v = parseInt(eff[k])||0;
        if (v) addTo(bRacial, k, v);
      }
    }
  }

  // 10) Achievement bonuses
  try{
    const achB=window._achGetAllBonuses?window._achGetAllBonuses():(window._achGetBonuses?window._achGetBonuses():{});
    Object.entries(achB).forEach(([s,v])=>{addTo(bAch,s,v);});
  }catch(_){}

  // 11) Loyauté passive (Doggo · Voie de la Meute)
  // Appliqué après tous les autres bonus : +15% stat totale si même party, +1% sinon.
  try{
    const _bond=LOYAUTE_BONDS_DATA&&LOYAUTE_BONDS_DATA[CHAR_ID];
    if(_bond&&_bond.status==='active'){
      const _tBond=LOYAUTE_BONDS_DATA[_bond.target_char_id];
      const _mutual=_tBond&&_tBond.status==='active'&&String(_tBond.target_char_id)===String(CHAR_ID);
      if(_mutual){
        const _tKey=`${_bond.target_user_id}_${_bond.target_char_id}`;
        const _inParty=PARTY_DATA&&(PARTY_DATA.members||[]).some(m=>m.char_key===_tKey);
        const _mult=_inParty?0.15:0.01;
        SK.forEach(s=>{
          const _tot=(stats[s]||0)+(bonuses[s]||0);
          if(_tot>0)addTo(bLoyaute,s,Math.floor(_tot*_mult));
        });
      }
    }
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
  // Supreme Privilege désormais géré DANS l'étape 9b (window.RacialPassives),
  // en parité avec utils/racial_passives.py côté bot.
  /* Axiome + Bénédiction + Singularité multipliers, partagés avec le dashboard. */
  const _axMults  = (typeof window._axiomeMultsFor==='function') ? (window._axiomeMultsFor(c) || null) : null;
  const _benMults = (typeof window._benedictionMultsFor==='function') ? (window._benedictionMultsFor(c) || {}) : {};
  const _sgBon    = (typeof window._singularityBonusesFor==='function') ? (window._singularityBonusesFor() || {flat:{},mult:{}}) : {flat:{},mult:{}};
  _hasTrueSelf_alloc=_hasTrueSelf; // sync to global for alloc functions
  if(_hasTrueSelf){
    stats.intelligence=10;
    bonuses.intelligence=0;
    bEquip.intelligence=0; bSets.intelligence=0; bParty.intelligence=0;
    bTitles.intelligence=0; bBuffs.intelligence=0; bComp.intelligence=0; bSig.intelligence=0; bMythic.intelligence=0; bRacial.intelligence=0; bLoyaute.intelligence=0;
    delete bonuses.intelligence;
    delete bEquip.intelligence; delete bSets.intelligence; delete bParty.intelligence;
    delete bTitles.intelligence; delete bBuffs.intelligence; delete bComp.intelligence; delete bSig.intelligence; delete bMythic.intelligence; delete bRacial.intelligence; delete bLoyaute.intelligence;
  }

  // ── Stats display (with companion buff_mult + rank cap) ──
  const _hubLevel = (typeof levelFromXp==='function' ? (levelFromXp(c.xp||0).level||1) : (c.level||1));
  const _hubRank = (window.Jaharta && Jaharta.rankFromLevel) ? Jaharta.rankFromLevel(_hubLevel) : 'F';
  /* Map des totaux effectifs collectés pendant le rendu — sert à l'analyse
     palier + spécialisation (renderCharacterAnalysis plus bas). */
  const _effectiveStats = {};
  document.getElementById('char-stats-grid').innerHTML=
    (sp?'<div class="sp-banner" style="grid-column:1/-1">&#9889; '+sp+' pt'+(sp>1?'s':'')+' stat dispo</div>':'')+
    SK.map(k=>{
      if(_hasTrueSelf && k==='intelligence'){
        _effectiveStats[k]=10;
        return '<div class="stat-block"><div class="stat-block-val">10</div><div class="stat-block-bonus" style="color:#a78bfa">🔒 TRUE SELF</div><div class="stat-block-name">'+SI[k]+' '+SL[k]+'</div></div>';
      }
      const base=parseInt(stats[k]||0);
      const sgFlat=parseInt(_sgBon.flat[k]||0)||0;
      const bon=(bonuses[k]||0) + sgFlat;
      let total=base+bon;
      /* Tableaux de breakdown pour le mode expanded.
         _flats : contributions plates par catégorie (chaque ligne = +X)
         _steps : multiplicateurs appliqués séquentiellement (before/after/delta) */
      const _flats = [
        { label: 'Base (allocation)',  val: base, kind: 'base' },
        { label: 'Équipement',        val: parseInt(bEquip[k]||0)  },
        { label: 'Sets',              val: parseInt(bSets[k]||0)   },
        { label: 'Compagnon',         val: parseInt(bComp[k]||0)   },
        { label: 'Signature',         val: parseInt(bSig[k]||0)    },
        { label: 'Mythic+',           val: parseInt(bMythic[k]||0) },
        { label: 'Succès',            val: parseInt(bAch[k]||0)    },
        { label: 'Buffs',             val: parseInt(bBuffs[k]||0)  },
        { label: 'Passifs raciaux',   val: parseInt(bRacial[k]||0) },
        { label: 'Titres',            val: parseInt(bTitles[k]||0) },
        { label: 'Party',             val: parseInt(bParty[k]||0)   },
        { label: 'Loyauté',          val: parseInt(bLoyaute[k]||0) },
        { label: 'Singularité (flat)',val: sgFlat                  },
      ];
      const _steps = [];

      const mult=parseFloat(compBuffMult[k]||0);
      let multLabel='';
      if(mult>0 && mult!==1){
        const before=total;
        total=Math.floor(total*mult);
        const multBonus=total-before;
        if(multBonus>0) multLabel='<div class="stat-block-bonus-detail">×'+mult+' (+'+multBonus+')</div>';
        _steps.push({ label: 'Compagnon sync ×'+mult.toFixed(2), before, after: total, delta: multBonus, color: '#fff' });
      }
      // Axiome buff/malus (T1 ±3%, T2 ±6%, etc.) — appliqué après bonus flats et compBuffMult
      let axLabel='';
      if(_axMults){
        if(_axMults.buffStat===k && _axMults.buffMult!==1){
          const before=total;
          total=Math.floor(total*_axMults.buffMult);
          const axBonus=total-before;
          if(axBonus!==0) axLabel='<div class="stat-block-bonus-detail" style="color:#5fb878">⚜ ×'+_axMults.buffMult.toFixed(2)+' ('+(axBonus>=0?'+':'')+axBonus+')</div>';
          _steps.push({ label: '⚜ Axiome buff ×'+_axMults.buffMult.toFixed(2), before, after: total, delta: axBonus, color: '#5fb878' });
        } else if(_axMults.malusStat===k && _axMults.malusMult!==1){
          const before=total;
          total=Math.floor(total*_axMults.malusMult);
          const axBonus=total-before;
          axLabel='<div class="stat-block-bonus-detail" style="color:#d36b6b">⚜ ×'+_axMults.malusMult.toFixed(2)+' ('+axBonus+')</div>';
          _steps.push({ label: '⚜ Axiome malus ×'+_axMults.malusMult.toFixed(2), before, after: total, delta: axBonus, color: '#d36b6b' });
        }
      }
      let axSkillLabel='';
      if(window.AxiomeSkills && typeof window.AxiomeSkills.getStatBonusTotal==='function'){
        let _axSkillPct=window.AxiomeSkills.getStatBonusTotal(c,k);
        if(typeof window.AxiomeSkills.getConditionalStatBonusTotalApplied==='function'){
          const _equippedNow=(typeof INV_DATA!=='undefined' && INV_DATA && INV_DATA.equipped_assets) || [];
          const _allItems=(typeof ALL_ITEMS_DATA!=='undefined' && ALL_ITEMS_DATA) || {};
          _axSkillPct+=window.AxiomeSkills.getConditionalStatBonusTotalApplied(c,k,_equippedNow,_allItems);
        }
        if(_axSkillPct && Math.abs(_axSkillPct)>0.0001){
          const before=total;
          total=Math.floor(total*(1+_axSkillPct));
          const skBon=total-before;
          if(skBon!==0){
            const pctTxt=((_axSkillPct>=0?'+':'')+(Math.round(_axSkillPct*1000)/10))+'%';
            axSkillLabel='<div class="stat-block-bonus-detail" style="color:#7ec8ff">⚙ '+pctTxt+' (skills) ('+(skBon>=0?'+':'')+skBon+')</div>';
            _steps.push({ label: '⚙ Skills axiome '+pctTxt, before, after: total, delta: skBon, color: '#7ec8ff' });
          }
        }
      }
      let starLabel='';
      if(typeof window._forgeStarsTotalPctFor==='function'){
        const _starsPct=window._forgeStarsTotalPctFor(typeof INV_DATA!=='undefined'?INV_DATA:null, c) || 0;
        if(_starsPct && Math.abs(_starsPct)>0.0001){
          const before=total;
          total=Math.floor(total*(1+_starsPct));
          const stBon=total-before;
          if(stBon!==0){
            const pctTxt=((_starsPct>=0?'+':'')+(Math.round(_starsPct*1000)/10))+'%';
            starLabel='<div class="stat-block-bonus-detail" style="color:#ffd60a">★ '+pctTxt+' (forge) ('+(stBon>=0?'+':'')+stBon+')</div>';
            _steps.push({ label: '★ Forge stars '+pctTxt, before, after: total, delta: stBon, color: '#ffd60a' });
          }
        }
      }
      let benLabel='';
      const benM=parseFloat(_benMults[k]||0);
      if(benM>0 && benM!==1){
        const before=total;
        total=Math.floor(total*benM);
        const benBonus=total-before;
        if(benBonus!==0) benLabel='<div class="stat-block-bonus-detail" style="color:#b48cff">✦ ×'+benM.toFixed(2)+' (+'+benBonus+')</div>';
        _steps.push({ label: '✦ Bénédiction ×'+benM.toFixed(2), before, after: total, delta: benBonus, color: '#b48cff' });
      }
      let sgLabel='';
      const sgM=parseFloat(_sgBon.mult[k]||0);
      if(sgM>0 && sgM!==1){
        const before=total;
        total=Math.floor(total*sgM);
        const sgBonus=total-before;
        if(sgBonus!==0) sgLabel='<div class="stat-block-bonus-detail" style="color:#00e5cc">✺ ×'+sgM.toFixed(2)+' (+'+sgBonus+')</div>';
        _steps.push({ label: '✺ Singularité ×'+sgM.toFixed(2), before, after: total, delta: sgBonus, color: '#00e5cc' });
      }
      let spLabel='';
      let capLabel='';
      if(window.Jaharta && Jaharta.applyRankCap){
        const eff=Jaharta.applyRankCap(_hubRank,k,total);
        if(eff!==total){
          capLabel='<div class="stat-block-bonus-detail" style="color:#f59e0b">⚠ cap '+eff+'</div>';
          _steps.push({ label: '⚠ Cap rang '+_hubRank, before: total, after: eff, delta: eff - total, color: '#f59e0b' });
          total=eff;
        }
      }
      _effectiveStats[k]=total;

      /* ── Build expanded panel : flats détaillés + multiplicateurs séquentiels ── */
      const flatsLines = _flats.filter(f => f.kind === 'base' || f.val).map(f => {
        const cls = f.kind === 'base' ? 'sde-base' : '';
        return '<div class="sde-line '+cls+'"><span>'+f.label+'</span><span class="sde-val">'+(f.kind==='base'?'':(f.val>=0?'+':''))+f.val+'</span></div>';
      }).join('');
      const sumFlat = base + bon;
      const flatsTotalLine = '<div class="sde-line sde-subtotal"><span>Sous-total flat</span><span class="sde-val">'+sumFlat+'</span></div>';
      const stepsLines = _steps.map(s => {
        const sign = s.delta >= 0 ? '+' : '';
        return '<div class="sde-line sde-step" style="--rc:'+s.color+'">'
          + '<span>'+s.label+'</span>'
          + '<span class="sde-val">'+sign+s.delta+' → <b>'+s.after+'</b></span>'
          + '</div>';
      }).join('');
      const expandedHtml = ''
        + '<div class="stat-block-expanded">'
        +   '<div class="sde-section">'
        +     '<div class="sde-section-title">Contributions plates</div>'
        +     flatsLines
        +     flatsTotalLine
        +   '</div>'
        +   (stepsLines ? '<div class="sde-section"><div class="sde-section-title">Multiplicateurs</div>'+stepsLines+'</div>' : '')
        +   '<div class="sde-final">Total effectif <b>'+total+'</b></div>'
        + '</div>';

      return '<div class="stat-block stat-block-clickable" onclick="this.classList.toggle(\'expanded\')">'
        + '<div class="stat-block-compact">'
        +   '<div class="stat-block-val">'+total+'</div>'
        +   (bon?'<div class="stat-block-bonus">+'+bon+'</div>':'')
        +   multLabel+axLabel+axSkillLabel+starLabel+benLabel+sgLabel+spLabel+capLabel
        +   '<div class="stat-block-name">'+SI[k]+' '+SL[k]+'</div>'
        +   '<div class="stat-block-toggle" title="Click pour le détail">▼</div>'
        + '</div>'
        + expandedHtml
        + '</div>';
    }).join('');

  // ── Analyse globale (palier + spécialisation) ──
  if (typeof renderCharacterAnalysis === 'function') {
    try { renderCharacterAnalysis(_effectiveStats, c); } catch(e){ window._dbg?.error('[ANALYSIS]', e); }
  }

  // ── Powers (enrichis : name + qualité + description + effets) ──
  function _powerRow(p){
    if(typeof p === 'string') p = { id: p };
    /* Enrichissement depuis le registre des pouvoirs (généré depuis le bot) :
       CHAR.powers ne stocke que {id,name} → on récupère la vraie rareté
       (quality) + description par id. Les valeurs explicites sur p priment. */
    const reg = (window.POWERS_REGISTRY && p.id) ? window.POWERS_REGISTRY[p.id] : null;
    const name = p.name || (reg && reg.name) || p.id || '—';
    const quality = String(p.quality || (reg && reg.quality) || p.tier || 'common').toLowerCase();
    const desc = p.desc || p.description || (reg && reg.description) || '';
    const effects = p.effects || p.stat_effects || null;
    let effHtml = '';
    if (effects && typeof effects === 'object') {
      const eff = Object.entries(effects).filter(kv=>kv[1]!==0&&kv[1]!=null);
      if (eff.length) {
        effHtml = '<div class="power-card-eff">' + eff.map(kv=>{
          const s = (SL[kv[0]] || kv[0]);
          const ic = SI[kv[0]] || '';
          const v = kv[1];
          return '<span class="power-card-eff-chip">'+ic+' '+e(s)+' '+(v>=0?'+':'')+v+'</span>';
        }).join('') + '</div>';
      }
    }
    return '<div class="power-card power-card-full">'
      + '<div class="power-card-head">'
      +   '<div class="power-card-dot '+e(quality)+'"></div>'
      +   '<div class="power-card-name">'+e(name)+'</div>'
      +   '<div class="power-card-qual '+e(quality)+'">'+e(quality.toUpperCase())+'</div>'
      + '</div>'
      + (desc ? '<div class="power-card-desc">'+e(desc)+'</div>' : '<div class="power-card-desc power-card-desc-empty">Pas de description</div>')
      + effHtml
      + '</div>';
  }
  let powersHtml = powers.length ? powers.map(_powerRow).join('') : '';
  /* Pouvoir racial : champ char.racial_power, distinct du tableau powers */
  if (c.racial_power) {
    const rp = c.racial_power;
    const rpRow = (typeof rp === 'string') ? { name: rp, quality: 'racial' } : Object.assign({ quality: 'racial' }, rp);
    powersHtml = '<div class="power-section-label">🧬 Pouvoir racial</div>' + _powerRow(rpRow) + (powersHtml ? '<div class="power-section-label">⚡ Pouvoirs acquis</div>' + powersHtml : '');
  }
  document.getElementById('char-powers-grid').innerHTML = powersHtml || '<div class="empty">Aucun pouvoir</div>';

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
    if(Object.values(bLoyaute).some(v=>v>0)) html+=renderBonusSection('💛','LOYAUTÉ','party',bLoyaute);
    html+=renderBonusSection('🏷️','TITRES','titles',bTitles);
    html+=renderBonusSection('✨','BUFFS','buffs',bBuffs);
    html+=renderBonusSection('🧬','PASSIFS RACIAUX','buffs',bRacial);
    if(!html) html='<div class="bonus-section-empty">Aucun bonus actif</div>';
    bbEl.innerHTML=html;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   ANALYSE GLOBALE — palier + spécialisation
   Échelle de palier basée sur la somme des 7 stats principales (str, agi,
   spd, int, mana, res, cha — AURA exclue car débloquée seulement via
   Cultivator et son scaling est différent). Seuils calibrés sur les
   gains potentiels réalistes :
     - lvl 1 starter : ~70 sum    → Mortel
     - lvl 50 décent  : ~500-800   → Compétent
     - lvl 100 leg eq : ~1.5-2.5k  → Aguerri / Expérimenté
     - lvl 200 stack  : ~5-8k      → Maître / Champion
     - lvl 300+ end   : ~10-15k    → Légende / Mythique
     - lvl 500 max    : ~30k+      → Transcendant / Divin

   Spécialisation : ratio top-stats / moyenne. Donne un archétype RP
   (Berserker, Archimage, Paladin, etc.) selon la combinaison dominante.
   ══════════════════════════════════════════════════════════════════════ */
/* Seuils ×7 — calibrés sur la SOMME des 7 stats (et non par stat). */
const PALIER_THRESHOLDS = [
  { min: 0,      name: 'Mortel',       tier: 'F',   color: '#6b7280', desc: 'À peine éveillé. Premiers pas dans un monde immense.' },
  { min: 1400,   name: 'Apprenti',     tier: 'E',   color: '#9ca3af', desc: 'Compétences de base acquises. Capable de survivre.' },
  { min: 3500,   name: 'Compétent',    tier: 'D',   color: '#60a5fa', desc: 'Tient tête aux menaces communes. Reconnu localement.' },
  { min: 7000,   name: 'Aguerri',      tier: 'C',   color: '#34d399', desc: 'Combattant rodé. Respecté dans son cercle.' },
  { min: 14000,  name: 'Expérimenté',  tier: 'B',   color: '#fbbf24', desc: 'Force d\'élite régionale. Une réputation qui précède.' },
  { min: 24500,  name: 'Élite',        tier: 'A',   color: '#f97316', desc: 'Référence dans son domaine. Maîtrise indiscutable.' },
  { min: 38500,  name: 'Maître',       tier: 'S',   color: '#ef4444', desc: 'Capacités exceptionnelles. Légende montante.' },
  { min: 56000,  name: 'Champion',     tier: 'SS',  color: '#ff006e', desc: 'Pilier dont l\'ombre couvre des nations entières.' },
  { min: 84000,  name: 'Légende',      tier: 'SSS', color: '#ffd60a', desc: 'Nom gravé dans l\'Histoire du Nexus.' },
  { min: 126000, name: 'Mythique',     tier: 'X',   color: '#e040fb', desc: 'Au-delà des limites mortelles. Forces de la nature.' },
  { min: 182000, name: 'Transcendant', tier: 'T',   color: '#a0f4ff', desc: 'Réécrit les lois du réel autour de lui.' },
  { min: 280000, name: 'Divin',        tier: 'G',   color: '#ffe680', desc: 'Présence cosmique. Conscience étendue.' },
  { min: 420000, name: 'Apothéose',    tier: 'Z',   color: '#ffffff', desc: 'Au sommet absolu de toute existence.' },
];

const SPEC_MONO = {
  strength:     { archetype: 'Berserker',  tone: 'Force brute incarnée. Frappes décisives, présence physique écrasante.', color:'#ef4444' },
  agility:      { archetype: 'Assassin',   tone: 'Précision et esquive parfaites. Frappe avant qu\'on ne le voie.',     color:'#34d399' },
  speed:        { archetype: 'Sprinter',   tone: 'Vitesse impossible à suivre. Engage et désengage à volonté.',         color:'#60a5fa' },
  intelligence: { archetype: 'Stratège',   tone: 'Lit le combat trois coups d\'avance. Manipule les variables.',         color:'#a78bfa' },
  mana:         { archetype: 'Arcaniste',  tone: 'Réservoir magique titanesque. Sort majeur après sort majeur.',         color:'#8b5cf6' },
  resistance:   { archetype: 'Forteresse', tone: 'Encaisse l\'incassable. Posture immuable, défense absolue.',           color:'#f59e0b' },
  charisma:     { archetype: 'Charmeur',   tone: 'Présence magnétique. Plie les volontés sans frapper.',                 color:'#ec4899' },
  aura:         { archetype: 'Mystique',   tone: 'Aura palpable. Rayonne une essence indéfinissable.',                   color:'#00e5ff' },
};

/* Dual archetypes — clé : "a+b" en ordre alpha (str < agi < spd...) */
const SPEC_DUAL = {
  'agility+strength':       { archetype: 'Berserker rapide',  tone: 'Bourrasque de coups bruts et précis.' },
  'resistance+strength':    { archetype: 'Juggernaut',        tone: 'Charge inarrêtable. Mur en mouvement.' },
  'speed+strength':         { archetype: 'Charge Brutale',    tone: 'Vitesse + impact. L\'élan détruit la cible.' },
  'intelligence+strength':  { archetype: 'Tacticien armé',    tone: 'Force calculée. Chaque coup est un piège.' },
  'mana+strength':          { archetype: 'Battle-Mage',       tone: 'Sort imprégné dans la lame. Devastation.' },
  'charisma+strength':      { archetype: 'Champion',          tone: 'Force et prestance. Inspire les alliés.' },
  'aura+strength':          { archetype: 'Avatar martial',    tone: 'Présence physique et mystique combinées.' },
  'agility+speed':          { archetype: 'Phantom',           tone: 'Insaisissable. Trois temps d\'avance, partout.' },
  'agility+intelligence':   { archetype: 'Trickster',         tone: 'Ruse et précision. Frappe l\'imprévisible.' },
  'agility+mana':           { archetype: 'Spell-Blade',       tone: 'Sorts à courte portée. Esquive et riposte arcaniques.' },
  'agility+resistance':     { archetype: 'Esquive Tenace',    tone: 'Évite tout, encaisse l\'inévitable.' },
  'agility+charisma':       { archetype: 'Séducteur',         tone: 'Grâce et présence. Manipule par le geste.' },
  'agility+aura':           { archetype: 'Danseur Mystique',  tone: 'Mouvement et essence intriqués.' },
  'intelligence+speed':     { archetype: 'Coup Foudroyant',   tone: 'Vitesse de réaction démentielle.' },
  'mana+speed':             { archetype: 'Lance-Sort Véloce', tone: 'Sort lancé avant que l\'adversaire respire.' },
  'resistance+speed':       { archetype: 'Hoplite',           tone: 'Charge défensive. Mur véloce.' },
  'charisma+speed':         { archetype: 'Maître de Cérémonie', tone: 'Commande la scène. Manipule le tempo social.' },
  'aura+speed':             { archetype: 'Souffle d\'Aube',   tone: 'Présence fugace mais indélébile.' },
  'intelligence+mana':      { archetype: 'Archimage',         tone: 'Pure puissance arcanique. Maître de l\'invisible.' },
  'intelligence+resistance':{ archetype: 'Gardien',           tone: 'Sagesse et endurance. Pierre angulaire.' },
  'charisma+intelligence':  { archetype: 'Manipulateur',      tone: 'Influence et calcul. Échiquier social.' },
  'aura+intelligence':      { archetype: 'Voyant',            tone: 'Conscience étendue. Voit au-delà.' },
  'mana+resistance':        { archetype: 'Hiérophante',       tone: 'Réserve magique inébranlable.' },
  'charisma+mana':          { archetype: 'Enchanteur',        tone: 'Charme magique. Façonne les esprits.' },
  'aura+mana':              { archetype: 'Canalisateur',      tone: 'Pont vivant entre les forces invisibles.' },
  'charisma+resistance':    { archetype: 'Paladin',           tone: 'Foi et défense. Bouclier des innocents.' },
  'aura+resistance':        { archetype: 'Inquisiteur',       tone: 'Présence implacable. Témoigne pour le réel.' },
  'aura+charisma':          { archetype: 'Prophète',          tone: 'Voix de l\'au-delà. Rassemble par la révélation.' },
};

function _palierFor(sumStats){
  let chosen = PALIER_THRESHOLDS[0];
  for (let i = PALIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (sumStats >= PALIER_THRESHOLDS[i].min) { chosen = PALIER_THRESHOLDS[i]; break; }
  }
  return chosen;
}

function _specFor(effective){
  const KEYS = ['strength','agility','speed','intelligence','mana','resistance','charisma'];
  const arr = KEYS.map(k => ({ stat: k, val: parseInt(effective[k]||0)||0 }));
  const sum = arr.reduce((a,b)=>a+b.val,0);
  const avg = sum / arr.length;
  arr.sort((a,b)=>b.val-a.val);
  const r = arr.map(x => x.val / Math.max(1,avg));
  const top = arr.slice(0,4);

  /* Seuils : 1 stat ≥ 1.6× moyenne → mono; 2 ≥ 1.3× → dual; 3 ≥ 1.2× → triple. */
  if (r[0] >= 1.6 && r[1] < 1.3) {
    const cfg = SPEC_MONO[top[0].stat] || {};
    return { type:'mono', stats:[top[0].stat], archetype: cfg.archetype || 'Spécialiste', tone: cfg.tone || '', color: cfg.color || '#fff', avg, sum };
  }
  if (r[0] >= 1.3 && r[1] >= 1.2 && r[2] < 1.2) {
    const key = [top[0].stat, top[1].stat].sort().join('+');
    const cfg = SPEC_DUAL[key] || { archetype: 'Hybride ' + (SL[top[0].stat]||top[0].stat).substring(0,4) + '/' + (SL[top[1].stat]||top[1].stat).substring(0,4), tone: 'Double affinité dominante.' };
    return { type:'dual', stats:[top[0].stat, top[1].stat], archetype: cfg.archetype, tone: cfg.tone, color: '#ffd60a', avg, sum };
  }
  if (r[0] >= 1.2 && r[2] >= 1.1 && r[3] < 1.1) {
    const labels = top.slice(0,3).map(x => (SL[x.stat]||x.stat));
    return { type:'triple', stats:top.slice(0,3).map(x=>x.stat), archetype: 'Polyvalent ' + labels.join('/'), tone: 'Triple affinité dominante — adaptable.', color: '#34d399', avg, sum };
  }
  return { type:'balanced', stats:[], archetype: 'Équilibré', tone: 'Aucune stat dominante. Polyvalent total, sans faille majeure.', color: '#a0a0c0', avg, sum };
}

function renderCharacterAnalysis(effectiveStats, c){
  const el = document.getElementById('char-analysis');
  if (!el) return;
  const sum = ['strength','agility','speed','intelligence','mana','resistance','charisma']
    .reduce((a,k)=>a+(parseInt(effectiveStats[k]||0)||0), 0);
  const auraVal = parseInt(effectiveStats.aura||0)||0;
  const palier = _palierFor(sum);
  const spec = _specFor(effectiveStats);
  /* Index de palier pour la progression */
  const pIdx = PALIER_THRESHOLDS.indexOf(palier);
  const nextP = PALIER_THRESHOLDS[pIdx+1];
  const progress = nextP ? Math.min(100, Math.floor((sum - palier.min) / (nextP.min - palier.min) * 100)) : 100;

  const specStatsHtml = spec.stats.map(s => {
    const ic = SI[s]||'';
    const lbl = SL[s]||s;
    const v = parseInt(effectiveStats[s]||0);
    return '<span class="ca-spec-stat" style="--rc:'+spec.color+'">'+ic+' '+e(lbl)+' <b>'+v+'</b></span>';
  }).join('');

  el.innerHTML = ''
    + '<div class="ca-grid">'
    +   '<div class="ca-palier" style="--rc:'+palier.color+'">'
    +     '<div class="ca-palier-hdr">'
    +       '<div class="ca-palier-tier">'+e(palier.tier)+'</div>'
    +       '<div class="ca-palier-meta">'
    +         '<div class="ca-palier-label">Palier de puissance</div>'
    +         '<div class="ca-palier-name">'+e(palier.name)+'</div>'
    +       '</div>'
    +     '</div>'
    +     '<div class="ca-palier-desc">'+e(palier.desc)+'</div>'
    +     '<div class="ca-palier-stats">'
    +       '<span>Σ stats <b>'+sum.toLocaleString()+'</b></span>'
    +       (auraVal > 0 ? '<span>Aura <b>'+auraVal.toLocaleString()+'</b></span>' : '')
    +     '</div>'
    +     (nextP
        ? '<div class="ca-palier-prog"><div class="ca-palier-prog-bar"><div class="ca-palier-prog-fill" style="width:'+progress+'%;background:'+palier.color+'"></div></div><div class="ca-palier-prog-txt">'+progress+'% vers <b>'+e(nextP.name)+'</b> ('+(nextP.min-sum).toLocaleString()+' restants)</div></div>'
        : '<div class="ca-palier-prog-txt" style="color:'+palier.color+'">Palier maximal atteint</div>')
    +   '</div>'
    +   '<div class="ca-spec" style="--rc:'+spec.color+'">'
    +     '<div class="ca-spec-hdr">'
    +       '<div class="ca-spec-type">'+(spec.type === 'mono' ? 'Mono-spé' : spec.type === 'dual' ? 'Dual-spé' : spec.type === 'triple' ? 'Tri-spé' : 'Équilibré')+'</div>'
    +       '<div class="ca-spec-arch">'+e(spec.archetype)+'</div>'
    +     '</div>'
    +     '<div class="ca-spec-desc">'+e(spec.tone)+'</div>'
    +     (specStatsHtml ? '<div class="ca-spec-stats">'+specStatsHtml+'</div>' : '')
    +     '<div class="ca-spec-meta">Moyenne effective : <b>'+Math.round(spec.avg).toLocaleString()+'</b></div>'
    +   '</div>'
    + '</div>';
}


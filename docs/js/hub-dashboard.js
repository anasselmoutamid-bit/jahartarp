/* ═══════════════════════════════════════════════════════════════════════
   docs/js/hub-dashboard.js — Onglet Dashboard
   ═══════════════════════════════════════════════════════════════════════
   Fonctions : renderDashChar, renderNoChar, renderPlayerWidgets,
               loadWallet, _compSyncPowerBonuses
   ═══════════════════════════════════════════════════════════════════════ */

/* ─── Axiome config preload ────────────────────────────────────────────
   Charge data/axiomes.json une fois et stocke sur window._AXIOME_CFG.
   Permet à renderDashChar d'appliquer buff/malus multiplicatifs sur les
   stats du char en fonction de c.axiome_current + tier. */
(function(){
  if (window._AXIOME_CFG || window._AXIOME_CFG_PROMISE) return;
  window._AXIOME_CFG_PROMISE = fetch('data/axiomes.json?v=1')
    .then(function(r){ if (!r.ok) throw new Error('axiomes ' + r.status); return r.json(); })
    .then(function(j){ window._AXIOME_CFG = j; return j; })
    .catch(function(e){ console.warn('[hub-dashboard] axiomes config load failed:', e); return null; });
  /* Re-render le dashboard une fois la config dispo (au cas où le dashboard
     a déjà été rendu sans elle). */
  window._AXIOME_CFG_PROMISE.then(function(j){
    if (j && typeof renderDashChar === 'function' && typeof CHAR !== 'undefined' && CHAR) {
      try { renderDashChar(); } catch(_) {}
    }
  });
})();

/* Retourne { buffMult, malusMult, buffStat, malusStat } pour le char actif, ou null. */
function _axiomeMultsFor(c){
  var cfg = window._AXIOME_CFG;
  if (!cfg || !c) return null;
  var curId = c.axiome_current || c.axiome || null;
  if (!curId || curId === 'neophyte') return null;
  var def = cfg[curId];
  if (!def) return null;
  var tier = def.tier || 1;
  var prog = (cfg._progression || {})[String(tier)];
  if (!prog) return null;
  return {
    buffStat: def.buff_stat || null,
    malusStat: def.malus_stat || null,
    buffMult: prog.buff || 1,
    malusMult: prog.malus || 1
  };
}

/* Retourne { strength: 1.12, mana: 1.05, ... } pour les bénédictions actives. */
function _benedictionMultsFor(c){
  if (typeof window.getBenedictionStatMultipliers === 'function') {
    try { return window.getBenedictionStatMultipliers(c) || {}; }
    catch(_) { return {}; }
  }
  return {};
}

/* Items Singularité ÉQUIPÉS pour le perso actif. Lit inventories.singularity_items
   et croise avec equipped_assets. Retourne {flat: {stat: total}, mult: {stat: prod}}.
   Note : seuls les items présents dans equipped_assets contribuent — comme la forge. */
function _singularityBonusesFor(){
  var out = { flat: {}, mult: {} };
  try {
    if (typeof INV_DATA === 'undefined' || !INV_DATA) return out;
    var sg = INV_DATA.singularity_items || {};
    var eq = INV_DATA.equipped_assets || [];
    eq.forEach(function(id){
      var sgItem = sg[id];
      if (!sgItem) return;
      /* Flat additions */
      Object.entries(sgItem.stats_flat || {}).forEach(function(kv){
        out.flat[kv[0]] = (out.flat[kv[0]] || 0) + (parseInt(kv[1],10)||0);
      });
      /* Multipliers stacking */
      Object.entries(sgItem.stats_mult || {}).forEach(function(kv){
        var m = parseFloat(kv[1])||1;
        out.mult[kv[0]] = (out.mult[kv[0]] || 1) * m;
      });
    });
  } catch(_){}
  return out;
}

/* Somme des bonus % étoiles forge sur les items ÉQUIPÉS, toutes stats.
   Lit inventory.item_upgrades[id] = { stars, bonuses_pct: [0.05, 0.04, ...] }.
   Retourne un % cumulé (ex: 0.18 = +18%) à appliquer comme mult sur le total.
   Fallback legacy : CHAR.forge_stars (ancien format direct sur char doc). */
function _forgeStarsTotalPctFor(invData, charObj){
  var total = 0;
  try {
    var inv = invData || (typeof INV_DATA !== 'undefined' ? INV_DATA : null);
    if (!inv) return 0;
    var eq = inv.equipped_assets || [];
    var ups = inv.item_upgrades || {};
    eq.forEach(function(id){
      var up = ups[id];
      if (up && Array.isArray(up.bonuses_pct)) {
        up.bonuses_pct.forEach(function(p){
          if (typeof p === 'number') total += p;
        });
        return;
      }
      /* Legacy : CHAR.forge_stars[id] = [0.05, 0.04, ...] */
      var c = charObj || (typeof CHAR !== 'undefined' ? CHAR : null);
      var leg = c && c.forge_stars && c.forge_stars[id];
      if (Array.isArray(leg)) {
        leg.forEach(function(p){
          if (typeof p === 'number') total += p;
        });
      }
    });
  } catch(_){}
  return total;
}

/* Expose pour partage avec hub-character.js + fiches */
window._axiomeMultsFor = _axiomeMultsFor;
window._benedictionMultsFor = _benedictionMultsFor;
window._singularityBonusesFor = _singularityBonusesFor;
window._forgeStarsTotalPctFor = _forgeStarsTotalPctFor;

// ── RENDER DASHBOARD ──
function renderDashChar(){
  const c=CHAR,fn=c.first_name||'',ln=c.last_name||'';
  const name=[fn,ln].filter(Boolean).join(' ')||'Personnage';
  const {level:lvl,cur:cxpDash,need:nxpDash}=levelFromXp(c.xp||0);
  const xp=c.xp||0;const pct=Math.min(100,nxpDash>0?Math.round(cxpDash/nxpDash*100):100);
  const stats=c.stats||{};
  document.getElementById('dash-char-card').innerHTML=`
    ${c.profile_image?(()=>{const _cu=window.JImgCache?window.JImgCache.get('char_'+CHAR_ID):null;if(window.JImgCache)window.JImgCache.set('char_'+CHAR_ID,c.profile_image);return `<img src="${e(_cu||c.profile_image)}" class="char-card-img" alt="${e(name)}" onerror="this.outerHTML='<div class=&quot;char-card-placeholder&quot;>NO IMAGE</div>'">`;})():`<div class="char-card-placeholder">NO IMAGE</div>`}
    <div class="card-body">
      <div class="char-name">${e(name)}</div>
      <div class="char-meta">${e(c.race_category||'—')} · ${e(c.class||'—')} · ${c.age||'?'} ans</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="badge badge-race">${e(c.race_category||'—')}</span>
        <span class="badge badge-class">${e(c.class||'—')}</span>
      </div>
      <div class="char-lvl-row"><span class="char-lvl-label">Niveau</span><span class="char-lvl-val">${lvl}</span></div>
      <div class="xp-labels"><span>XP</span><span>${cxpDash.toLocaleString()} / ${nxpDash.toLocaleString()}</span></div>
      <div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>
      <div class="dash-switch-row">
        <button type="button" class="btn-switch-char" onclick="if(window.openCharSwitcher)openCharSwitcher()" title="Changer de personnage actif">
          <span class="btn-switch-char-ico">⇄</span>
          <span class="btn-switch-char-lbl">Changer de personnage</span>
          <span class="btn-switch-char-arrow">›</span>
        </button>
      </div>
    </div>`;
  // ── Calcul bonus items pour affichage dashboard ──
  const _dashBonuses={};
  try{
    const eqList=(INV_DATA&&INV_DATA.equipped_assets)||[];
    if(eqList.length>0){
      // 1) Equipment direct
      eqList.forEach(id=>{
        const it=ALL_ITEMS_DATA[id]||{};
        if((it.rarity||'').toLowerCase()==='signature')return;
        if((it.rarity||'').toLowerCase()==='pandemonium')return;
        if(id==='equalizer')return;
        Object.entries(it.stat_effects||it.stats||{}).forEach(([s,v])=>{
          try{const n=parseInt(String(v).replace('+',''));if(n)_dashBonuses[s]=(_dashBonuses[s]||0)+n;}catch(_){}
        });
      });
      // 2) Signature
      const aura=parseInt(stats.aura||0)>0;
      const sigB=calculateSignatureBonuses(eqList,stats,aura,{..._dashBonuses});
      Object.entries(sigB).forEach(([s,v])=>{if(!s.startsWith('_'))_dashBonuses[s]=(_dashBonuses[s]||0)+Math.floor(v);});
      // 2c) Pandemonium (party-conditional)
      if(typeof calculatePandemoniumBonuses==='function' && typeof PANDEMONIUM_ITEMS_HC!=='undefined'){
        if(eqList.some(id=>PANDEMONIUM_ITEMS_HC[id])){
          let synergy=false;
          try{
            const myKey=(typeof UID!=='undefined'&&typeof CHAR_ID!=='undefined')?(UID+'_'+CHAR_ID):'';
            const members=(typeof PARTY_DATA!=='undefined'&&PARTY_DATA&&PARTY_DATA.members)||[];
            for(const m of members){
              const mck=m&&m.char_key;
              if(!mck||mck===myKey)continue;
              const mEq=(m.equipped_assets||m.equipped||[]);
              if(mEq.some(eid=>PANDEMONIUM_ITEMS_HC[eid])){synergy=true;break;}
            }
          }catch(_){}
          const pdmB=calculatePandemoniumBonuses(eqList,synergy);
          Object.entries(pdmB).forEach(([s,v])=>{_dashBonuses[s]=(_dashBonuses[s]||0)+v;});
        }
      }
      // 3) Sets — passe la race pour race_bonus
      if(typeof calculateSetBonuses==='function'){
        const _dashRace=(typeof CHAR!=='undefined'&&CHAR&&(CHAR.race||CHAR.race_category))||'';
        const setR=calculateSetBonuses(eqList,_dashRace);
        Object.entries(setR.stats||{}).forEach(([s,v])=>{_dashBonuses[s]=(_dashBonuses[s]||0)+v;});
      }
    }
    // 4) Party bonuses
    if(typeof PARTY_DATA!=='undefined'&&PARTY_DATA&&PARTY_DATA.members){
      const me=(PARTY_DATA.members||[]).find(m=>m.char_key===UID+'_'+CHAR_ID);
      if(me&&me.bonuses)Object.entries(me.bonuses).forEach(([s,v])=>{_dashBonuses[s]=(_dashBonuses[s]||0)+(parseInt(v)||0);});
    }
    // 5) Titles
    if(typeof TITLES_DATA!=='undefined'&&TITLES_DATA&&typeof TITLES_DEF!=='undefined'&&TITLES_DEF){
      Object.entries(TITLES_DATA.titles||{}).forEach(([tid,ts])=>{
        const td=TITLES_DEF[tid];if(!td)return;
        const tier=ts.current_tier||ts.tier||1;
        const tierDef=(td.tiers||[]).find(t=>t.tier===tier);
        if(tierDef&&tierDef.stat_bonuses)Object.entries(tierDef.stat_bonuses).forEach(([s,v])=>{_dashBonuses[s]=(_dashBonuses[s]||0)+(parseInt(v)||0);});
      });
    }
    // 6) Buffs
    if(typeof BUFFS_DATA!=='undefined'&&BUFFS_DATA){
      (BUFFS_DATA||[]).forEach(b=>{
        if(b.effects)Object.entries(b.effects).forEach(([s,v])=>{_dashBonuses[s]=(_dashBonuses[s]||0)+(parseInt(v)||0);});
      });
    }
    // 7) Companion sync bonuses (1 actif par défaut — multi-actif sera réintégré
    //    quand le nouveau système d'Axiomes définira les règles Dompteur).
    if(typeof COMP_USER!=='undefined'&&COMP_USER&&typeof COMP_CFG!=='undefined'&&COMP_CFG){
      const owned=COMP_USER.owned_companions||{};
      let activeIds=[];
      try{
        const charActiveList=(CHAR&&Array.isArray(CHAR.active_companions))?CHAR.active_companions:null;
        if(charActiveList&&charActiveList.length){
          activeIds=charActiveList.slice(0,1).map(String);
        } else if(COMP_USER.active_companion){
          activeIds=[String(COMP_USER.active_companion)];
        }
      }catch(_){
        if(COMP_USER.active_companion) activeIds=[String(COMP_USER.active_companion)];
      }
      activeIds.forEach(activeId=>{
        if(!activeId||!owned[activeId]) return;
        const cd=owned[activeId];
        if(!cd.synchronized) return;
        const form=cd.current_form||activeId;
        const allComps=COMP_CFG.companions||{};
        const allEvos=COMP_CFG.evolutions||{};
        const info=allEvos[form]||allComps[form]||allComps[activeId]||{};
        const baseEntry=allComps[activeId]||{};
        const syncBonuses=info.sync_bonuses||baseEntry.sync_bonuses||{};
        Object.entries(syncBonuses).forEach(([s,v])=>{_dashBonuses[s]=(_dashBonuses[s]||0)+(parseInt(v)||0);});
        const spBonuses=_compSyncPowerBonuses(info.sync_power||baseEntry.sync_power||'');
        Object.entries(spBonuses).forEach(([s,v])=>{_dashBonuses[s]=(_dashBonuses[s]||0)+(parseInt(v)||0);});
      });
    }
  }catch(_){}
  // 8) Achievement bonuses
  const _dashAchBonuses={};
  try{
    const ab=window._achGetAllBonuses?window._achGetAllBonuses():(window._achGetBonuses?window._achGetBonuses():{});
    Object.entries(ab).forEach(([s,v])=>{
      _dashAchBonuses[s]=(v||0);
      _dashBonuses[s]=(_dashBonuses[s]||0)+(v||0);
    });
  }catch(_){}
  const _dashRank=(window.Jaharta&&Jaharta.rankFromLevel)?Jaharta.rankFromLevel(lvl):'F';
  // Supreme Privilege (Dragon — voie Arrogance) : ×1.3 toutes les stats, avant rank cap
  const _dashHasSP=(()=>{
    const pw=(c.powers||[]);
    for(const p of pw){
      const pid=(typeof p==='string'?p:(p&&p.id||'')).toLowerCase().replace(/ /g,'_');
      if(pid==='dragon_supreme_privilege')return true;
    }
    return false;
  })();
  const _dashSpMult=_dashHasSP?1.3:1;
  const _dashAxiomeMults=_axiomeMultsFor(c);
  const _dashBenedictionMults=_benedictionMultsFor(c);
  const _dashSgBon=_singularityBonusesFor();
  if(typeof renderSpStats==='function'){
    const eqIds=(INV_DATA&&INV_DATA.equipped_assets)||[];
    renderSpStats(computeSpStats(eqIds,ALL_ITEMS_DATA),'dash-sp-stats');
  }

  document.getElementById('dash-stats-grid').innerHTML=SK.map(k=>{
    const base=parseInt(stats[k]||0);
    const bon=(_dashBonuses[k]||0) + (_dashSgBon.flat[k]||0);
    const achBon=_dashAchBonuses[k]||0;
    let total=base+bon;
    /* Axiome multiplier (buff/malus selon stat clé + tier de l'axiome courant) */
    let axMultApplied=null; /* {kind:'buff'|'malus', mult, before, after} */
    if(_dashAxiomeMults){
      if(_dashAxiomeMults.buffStat===k && _dashAxiomeMults.buffMult!==1){
        const before=total;
        total=Math.floor(total*_dashAxiomeMults.buffMult);
        axMultApplied={kind:'buff',mult:_dashAxiomeMults.buffMult,before,after:total};
      } else if(_dashAxiomeMults.malusStat===k && _dashAxiomeMults.malusMult!==1){
        const before=total;
        total=Math.floor(total*_dashAxiomeMults.malusMult);
        axMultApplied={kind:'malus',mult:_dashAxiomeMults.malusMult,before,after:total};
      }
    }
    /* Axiome skills débloqués (somme des stat_bonus permanents + conditionnels actifs) — additif */
    let axSkillApplied=null;
    if(window.AxiomeSkills && typeof window.AxiomeSkills.getStatBonusTotal==='function'){
      let _pct=window.AxiomeSkills.getStatBonusTotal(c,k);
      if(typeof window.AxiomeSkills.getConditionalStatBonusTotalApplied==='function'){
        const _eq=(typeof INV_DATA!=='undefined' && INV_DATA && INV_DATA.equipped_assets) || [];
        const _items=(typeof ALL_ITEMS_DATA!=='undefined' && ALL_ITEMS_DATA) || {};
        _pct+=window.AxiomeSkills.getConditionalStatBonusTotalApplied(c,k,_eq,_items);
      }
      if(_pct && Math.abs(_pct)>0.0001){
        const before=total;
        total=Math.floor(total*(1+_pct));
        if(total!==before) axSkillApplied={pct:_pct,before,after:total};
      }
    }
    /* Étoiles forge — bonus % cumul sur toutes stats des items équipés (cf.
       INV_DATA.item_upgrades[id].bonuses_pct sommés). */
    let starApplied=null;
    {
      const _starsPct=(typeof window._forgeStarsTotalPctFor==='function')
        ? (window._forgeStarsTotalPctFor(typeof INV_DATA!=='undefined'?INV_DATA:null, c) || 0)
        : 0;
      if(_starsPct && Math.abs(_starsPct)>0.0001){
        const before=total;
        total=Math.floor(total*(1+_starsPct));
        if(total!==before) starApplied={pct:_starsPct,before,after:total};
      }
    }
    /* Bénédiction multiplier (stat-specific, stacking, applied after axiome) */
    let benMultApplied=null; /* {mult, before, after} */
    const benMult=parseFloat(_dashBenedictionMults[k]||0);
    if(benMult>0 && benMult!==1){
      const before=total;
      total=Math.floor(total*benMult);
      benMultApplied={mult:benMult,before,after:total};
    }
    /* Singularité multiplier (items équipés, stacking) */
    let sgMultApplied=null;
    const sgMult=parseFloat(_dashSgBon.mult[k]||0);
    if(sgMult>0 && sgMult!==1){
      const before=total;
      total=Math.floor(total*sgMult);
      sgMultApplied={mult:sgMult,before,after:total};
    }
    if(_dashSpMult!==1) total=Math.floor(total*_dashSpMult);
    if(window.Jaharta&&Jaharta.applyRankCap){
      total=Jaharta.applyRankCap(_dashRank,k,total);
    }
    const maxStat=1000;
    const pct=Math.min(100,Math.round(total/maxStat*100));
    /* Bonus breakdown tooltip */
    const eqBon=bon-achBon;
    let detailParts=[];
    if(base>0)detailParts.push(`Base: ${base}`);
    if(eqBon>0)detailParts.push(`Équip: +${eqBon}`);
    if(achBon>0)detailParts.push(`Succès: +${achBon}`);
    if(axMultApplied){
      const sign=axMultApplied.kind==='buff'?'+':'';
      const pctDiff=Math.round((axMultApplied.mult-1)*100);
      detailParts.push(`Axiome: ${sign}${pctDiff}% (×${axMultApplied.mult.toFixed(2)})`);
    }
    if(axSkillApplied){
      const pctDiff=Math.round(axSkillApplied.pct*1000)/10;
      detailParts.push(`Skills axiome: ${pctDiff>=0?'+':''}${pctDiff}%`);
    }
    if(starApplied){
      const pctDiff=Math.round(starApplied.pct*1000)/10;
      detailParts.push(`Forge ★: +${pctDiff}%`);
    }
    if(benMultApplied){
      const pctDiff=Math.round((benMultApplied.mult-1)*100);
      detailParts.push(`Bénéd.: +${pctDiff}% (×${benMultApplied.mult.toFixed(2)})`);
    }
    if(sgMultApplied){
      const pctDiff=Math.round((sgMultApplied.mult-1)*100);
      detailParts.push(`Singu.: +${pctDiff}% (×${sgMultApplied.mult.toFixed(2)})`);
    }
    const detailText=detailParts.join(' · ');
    let bonHtml='';
    /* Affichage : Singu > Bénéd > Axiome > flat */
    if(sgMultApplied){
      const pctDiff=Math.round((sgMultApplied.mult-1)*100);
      bonHtml=`<span class="stat-bonus-tag positive" title="Singularité +${pctDiff}%">✺+${pctDiff}%</span>`;
    } else if(benMultApplied){
      const pctDiff=Math.round((benMultApplied.mult-1)*100);
      bonHtml=`<span class="stat-bonus-tag positive" title="Bénédiction +${pctDiff}%">✦+${pctDiff}%</span>`;
    } else if(axMultApplied){
      const cls=axMultApplied.kind==='buff'?'positive':'negative';
      const pctDiff=Math.round((axMultApplied.mult-1)*100);
      const sign=axMultApplied.kind==='buff'?'+':'';
      bonHtml=`<span class="stat-bonus-tag ${cls}" title="Axiome ${axMultApplied.kind}">${sign}${pctDiff}%</span>`;
    } else if(bon>0)bonHtml=`<span class="stat-bonus-tag positive">+${bon}</span>`;
    else if(bon<0)bonHtml=`<span class="stat-bonus-tag negative">${bon}</span>`;
    return `<div class="stat-card-v2" title="${detailText}">
      <div class="stat-card-header"><span class="stat-card-icon">${SI[k]}</span><span class="stat-card-name">${SL[k]}</span></div>
      <div class="stat-card-value-row"><span class="stat-card-total">${total}</span>${bonHtml}</div>
      <div class="stat-card-bar"><div class="stat-card-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
  const powers=c.powers||[];
  document.getElementById('dash-powers-list').innerHTML=powers.length
    ?powers.slice(0,5).map(p=>`<div class="power-item"><div class="pq ${p.quality||'common'}"></div><span class="power-name">${e(p.name||p.id||'—')}</span><span class="power-qual-tag">${e((p.quality||'').toUpperCase())}</span></div>`).join('')+(powers.length>5?`<div class="empty">+${powers.length-5} autres</div>`:'')
    :'<div class="empty">Aucun pouvoir</div>';
}

function renderNoChar(){
  document.getElementById('dash-char-card').innerHTML='<div class="char-card-placeholder" style="background:#050910">AUCUN PERSO ACTIF</div>'+
    '<div class="card-body"><div class="empty">Aucun personnage actif</div>'+
    '<div class="dash-switch-row">'+
      '<button type="button" class="btn-switch-char" onclick="if(window.openCharSwitcher)openCharSwitcher()" title="Sélectionner un personnage">'+
        '<span class="btn-switch-char-ico">⇄</span>'+
        '<span class="btn-switch-char-lbl">Sélectionner un personnage</span>'+
        '<span class="btn-switch-char-arrow">›</span>'+
      '</button>'+
    '</div></div>';
  document.getElementById('dash-stats-grid').innerHTML='<div class="empty" style="grid-column:1/-1">—</div>';
  document.getElementById('dash-powers-list').innerHTML='<div class="empty">—</div>';
}

function renderPlayerWidgets(){
  /* En IRP, utiliser le solde de jahartites — JAMAIS PLAYER.navarites en fallback */
  const isIRP = window._irpMode;
  const irpP = window._irpPlayer;
  let nav, streak, isBooster;
  if(isIRP){
    /* Si _irpPlayer n'est pas encore chargé, afficher 0 et relancer le chargement */
    nav = irpP ? (irpP.jahartites || 0) : 0;
    streak = irpP ? (irpP.consecutive_days || 0) : 0;
    isBooster = false; /* IRP: pas de gate booster */
    if(!irpP && typeof db !== 'undefined' && typeof UID !== 'undefined' && UID){
      /* Chargement async des jahartites si pas encore fait */
      db.collection('irp_players').doc(String(UID)).get().then(function(snap){
        if(snap.exists){
          window._irpPlayer = snap.data();
          if(window.PLAYER) window.PLAYER.navarites = window._irpPlayer.jahartites || 0;
          renderPlayerWidgets(); /* re-render avec les bonnes données */
        }
      }).catch(function(){});
    }
  } else {
    nav = (PLAYER.navarites || 0);
    streak = (PLAYER.consecutive_days || 0);
    isBooster = !!PLAYER.booster;
  }
  const unit = isIRP ? 'JAH' : 'NAV';
  document.getElementById('dash-nav-val').innerHTML=`<span>${nav.toLocaleString()}</span><span class="nav-unit">${unit}</span>`;

  // Streak label: in IRP we keep the legacy raw count; in NAV we surface the gate state.
  let streakHTML;
  if(isIRP){
    streakHTML = streak ? `<span>${streak}</span> jour${streak>1?'s':''} consécutifs` : 'Pas encore de série active';
  } else if(isBooster){
    streakHTML = `<span style="color:var(--gold)">✓ BOOSTER</span> · gains actifs (${streak} jour${streak>1?'s':''})`;
  } else if(streak >= 3){
    streakHTML = `<span>${streak}</span> jour${streak>1?'s':''} consécutifs · <span style="color:var(--green)">gains actifs</span>`;
  } else if(streak > 0){
    streakHTML = `<span>${streak}</span>/3 jour${streak>1?'s':''} · <span style="color:var(--text3)">gains verrouillés</span>`;
  } else {
    streakHTML = 'Pas encore de série active';
  }
  document.getElementById('dash-nav-streak').innerHTML = streakHTML;
  // Load wallet after player data is ready
  loadWallet();
}

async function loadWallet(){
  const walletEl=document.getElementById('dash-wallet');
  if(!walletEl)return;
  // Gather all currency data
  const isIRP = window._irpMode;
  const irpP = window._irpPlayer;
  const nav = isIRP ? (irpP ? (irpP.jahartites || 0) : 0) : (PLAYER.navarites || 0);
  const navLabel = isIRP ? 'Jahartites' : 'Navarites';
  const navIcon = isIRP
    ? 'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_29_56.png?alt=media&token=dd11325b-c47a-447b-ab63-e2df99fd64af'
    : 'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_31_13.png?alt=media&token=985f12bb-c24e-4222-b17b-e220dab56ba8';
  const notoriety=PLAYER.notoriety||0;
  const _ge=PLAYER.golden_eggs;
  const goldenEggs=typeof _ge==='number'?_ge:(typeof _ge==='object'&&_ge!==null?(Object.values(_ge).find(v=>typeof v==='number')||0):(parseInt(_ge)||0));
  // Load economy data for kanite currencies
  let bronze=0,silver=0,gold=0,platinum=0;
  if(UID&&CHAR_ID){
    try{
      const charKey=`${UID}_${CHAR_ID}`;
      const snap=await db.collection(C.ECONOMY).doc(charKey).get();
      if(snap.exists){
        const rawPersonal=snap.data().personal||{};
        // Compress to highest denomination for display (uses helper from hub-shops.js)
        const personal=(typeof autoConvertUp==='function')?autoConvertUp(rawPersonal):rawPersonal;
        bronze=personal.bronze_kanite||0;
        silver=personal.silver_kanite||0;
        gold=personal.gold_kanite||0;
        platinum=personal.platinum_kanite||0;
      }
    }catch(e){window._dbg?.error('[WALLET]',e)}
  }
  // Build wallet items — always show navarites and golden eggs, show kanites if > 0
  let html='';
  // Currency icon URLs
  const IC={
    nav:'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_31_13.png?alt=media&token=985f12bb-c24e-4222-b17b-e220dab56ba8',
    egg:'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_31_03.png?alt=media&token=16a6e486-eec4-493d-8539-0f0d39d36aa1',
    bronze:'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_31_42.png?alt=media&token=0940354e-8c4e-4e53-8ae6-101f7fcaca12',
    silver:'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_31_34.png?alt=media&token=1f371159-46fb-4f50-b169-3f023c0b52b3',
    gold:'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_31_29.png?alt=media&token=1b9282e3-efc8-4dbf-8de5-5bab1b7f5f75',
    platinum:'https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_31_22.png?alt=media&token=86ae38a6-bb6e-4f1e-a81d-fec4c0d4e010'
  };
  function wimg(url){return `<img src="${url}" alt="" style="width:28px;height:28px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(255,214,10,0.3))">`;}
  html+=`<div class="wallet-item wi-navarite"><span class="wi-icon">${wimg(isIRP ? navIcon : IC.nav)}</span><div><div class="wi-val">${nav.toLocaleString()}</div><div class="wi-label">${navLabel}</div></div></div>`;
  html+=`<div class="wallet-item wi-golden-egg"><span class="wi-icon">${wimg(IC.egg)}</span><div><div class="wi-val">${goldenEggs.toLocaleString()}</div><div class="wi-label">Golden Egg</div></div></div>`;
  if(platinum>0)html+=`<div class="wallet-item wi-platinum"><span class="wi-icon">${wimg(IC.platinum)}</span><div><div class="wi-val">${platinum.toLocaleString()}</div><div class="wi-label">Platinum K</div></div></div>`;
  if(gold>0)html+=`<div class="wallet-item wi-gold"><span class="wi-icon">${wimg(IC.gold)}</span><div><div class="wi-val">${gold.toLocaleString()}</div><div class="wi-label">Gold K</div></div></div>`;
  if(silver>0)html+=`<div class="wallet-item wi-silver"><span class="wi-icon">${wimg(IC.silver)}</span><div><div class="wi-val">${silver.toLocaleString()}</div><div class="wi-label">Silver K</div></div></div>`;
  if(bronze>0)html+=`<div class="wallet-item wi-bronze"><span class="wi-icon">${wimg(IC.bronze)}</span><div><div class="wi-val">${bronze.toLocaleString()}</div><div class="wi-label">Bronze K</div></div></div>`;
  if(notoriety>0)html+=`<div class="wallet-item wi-notoriety"><span class="wi-icon">⚡</span><div><div class="wi-val">${notoriety.toLocaleString()}</div><div class="wi-label">Notoriété</div></div></div>`;
  walletEl.innerHTML=html||'<div class="empty">Portefeuille vide</div>';
}

// ── Companion sync_power → flat stat bonuses map ──
function _compSyncPowerBonuses(power){
  const p=(power||'').toLowerCase().trim();
  const ALL=['strength','dexterity','speed','intelligence','mana','resistance','charisma'];
  const MAP={
    'royalty presence':{charisma:100},
    "hunter's dominion":{dexterity:100},
    'lost knowledge':{intelligence:100},
    'old tenacity':{resistance:200},
    'thunderclap':Object.fromEntries(ALL.map(s=>[s,20])),
    'thunder strikes twice':Object.fromEntries(ALL.map(s=>[s,30])),
    'challenger':Object.fromEntries(ALL.map(s=>[s,55])),
    'killer instinct':{strength:25,resistance:25,mana:25},
    'unextinguishable':{strength:150,resistance:150,mana:150},
    'strategist':{dexterity:25,intelligence:25,mana:25},
    'unfathomable':{dexterity:150,intelligence:150,mana:150},
    'assassin':{dexterity:45,intelligence:45,mana:45},
    'unavoidable':{dexterity:200,intelligence:200,mana:200},
    'sturdy':{strength:23,resistance:23,dexterity:23,charisma:23},
    'unchained':{strength:130,resistance:130,dexterity:130,charisma:130},
    'blessing':Object.fromEntries(ALL.map(s=>[s,23])),
    'the one':Object.fromEntries(ALL.map(s=>[s,300])),
    'curse':{strength:46,intelligence:46,dexterity:46,charisma:46,speed:-23,mana:-23,resistance:-23},
    'the last':Object.fromEntries(ALL.map(s=>[s,300])),
  };
  return MAP[p]||{};
}


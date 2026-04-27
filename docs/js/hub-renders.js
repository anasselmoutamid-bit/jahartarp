/* ═══════════════════════════════════════════════════════════════════════
   docs/js/hub-renders.js — Rendus des onglets mineurs
   ═══════════════════════════════════════════════════════════════════════
   Fonctions : renderGacha, renderParty, ppShopBuy, renderProgression,
               renderTitles, tCol, tLbl, renderCompanions, compLvl,
               renderShop, renderSettings, setTheme
   ═══════════════════════════════════════════════════════════════════════ */

// ── RENDER GACHA ──
function renderGacha(){
  const nav=PLAYER.navarites||0;
  document.getElementById('gacha-nav-val').textContent=nav.toLocaleString();
  const se=Math.round(PITY.navarites_spent_epic||0),sl=Math.round(PITY.navarites_spent_leg||0),streak=(PLAYER.consecutive_days||0)%3;
  document.getElementById('pity-grid').innerHTML=`
    <div class="pity-card">
      <div class="pity-val" style="color:var(--violet)">${se}<span style="font-size:.7rem;color:var(--text3)">/${PITY_T.epic}</span></div>
      <div class="pity-label">PITY ÉPIQUE</div>
      <div class="pity-bar"><div class="pity-fill" style="width:${Math.min(100,Math.round(se/PITY_T.epic*100))}%;background:var(--violet)"></div></div>
    </div>
    <div class="pity-card">
      <div class="pity-val" style="color:var(--gold)">${sl}<span style="font-size:.7rem;color:var(--text3)">/${PITY_T.leg}</span></div>
      <div class="pity-label">PITY LÉGENDAIRE</div>
      <div class="pity-bar"><div class="pity-fill" style="width:${Math.min(100,Math.round(sl/PITY_T.leg*100))}%;background:var(--gold)"></div></div>
    </div>
    <div class="pity-card">
      <div class="pity-val" style="color:var(--green)">${streak}<span style="font-size:.7rem;color:var(--text3)">/3</span></div>
      <div class="pity-label">JOURS STREAK</div>
      <div class="pity-bar"><div class="pity-fill" style="width:${Math.round(streak/3*100)}%;background:var(--green)"></div></div>
    </div>`;
}

// ── RENDER PARTY ──
function renderParty(p){
  const members=p.members||[],leader=p.leader_char_key||'';
  const maxSz=parseInt(p.max_size)||3,pp=parseInt(p.pp)||0;
  const threshold=parseInt(p.msg_threshold)||25,statGain=parseInt(p.stat_gain)||1;
  const msgCounter=parseInt(p.msg_counter)||0;
  const purchased=p.purchased_powers||[];
  const status=p.status||'ACTIVE';
  const myKey=CHAR_ID?`${UID}_${CHAR_ID}`:'';
  const isLeader=myKey===leader;
  const statusColors={ACTIVE:'var(--green)',REPOS:'var(--gold)',MISSION:'var(--violet)'};

  // Build member cards — then fetch char data async to enrich
  const el=document.getElementById('party-content');
  let html=`
    <div class="party-header-card">
      <div class="party-name">${e(p.name||'Party sans nom')}</div>
      <div class="party-meta"><span style="color:${statusColors[status]||'var(--text3)'}">${status}</span> · ${members.length}/${maxSz} membres · PP : ${pp}</div>
      <div class="party-stats-row">
        <div class="party-stat-chip"><div class="party-stat-val">${pp}</div><div class="party-stat-label">PARTY POINTS</div></div>
        <div class="party-stat-chip"><div class="party-stat-val">${msgCounter}/${threshold}</div><div class="party-stat-label">MSG COUNTER</div></div>
        <div class="party-stat-chip"><div class="party-stat-val">+${statGain}</div><div class="party-stat-label">STAT GAIN</div></div>
        <div class="party-stat-chip"><div class="party-stat-val">${maxSz}</div><div class="party-stat-label">MAX SLOTS</div></div>
      </div>
      ${purchased.length?`<div style="display:flex;gap:6px;flex-wrap:wrap">${purchased.map(pid=>`<span style="font-family:var(--font-m);font-size:.42rem;padding:4px 10px;border-radius:4px;border:1px solid rgba(139,92,246,0.3);color:var(--violet);background:rgba(139,92,246,0.06)">⚡ ${pid.replace(/_/g,' ').replace(/\\b\\w/g,c=>c.toUpperCase())}</span>`).join('')}</div>`:''}
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card-body">
      <div class="sh" style="margin-bottom:12px"><span class="sh-num">—</span><span class="sh-title">Membres</span><div class="sh-line"></div></div>
      <div id="party-members-list">${members.map(m=>`<div class="party-member-card${m.char_key===leader?' leader':''}" id="pm-${(m.char_key||'').replace(/[^a-zA-Z0-9_]/g,'')}">
        <div class="party-member-name">${e(m.char_name||'—')}</div>
        <div class="party-member-role" style="color:${m.char_key===leader?'var(--gold)':'var(--text3)'}">${m.char_key===leader?'👑 LEADER':'MEMBRE'}${m.hidden&&m.char_key!==myKey?' · <span class="party-private-tag">🔒 PRIVÉ</span>':''}</div>
        <div class="party-member-info" id="pm-info-${(m.char_key||'').replace(/[^a-zA-Z0-9_]/g,'')}"><span class="sk" style="height:12px;width:60%;display:inline-block"></span></div>
      </div>`).join('')}</div>
    </div></div>
    <!-- PP Shop -->
    <div class="card" style="margin-bottom:16px"><div class="card-body">
      <div class="sh" style="margin-bottom:12px"><span class="sh-num">—</span><span class="sh-title">🏪 PP Shop</span><div class="sh-line"></div></div>
      <div style="font-family:var(--font-m);font-size:.48rem;color:var(--gold);margin-bottom:14px">PP disponibles : <strong>${pp}</strong>${!isLeader?' — <span style="color:var(--text3)">Seul le leader peut acheter</span>':''}</div>
      <div class="pp-shop-grid">
        <div class="pp-shop-item${maxSz>=12?' maxed':''}"><div class="pp-shop-item-title">⬆️ SLOT</div><div class="pp-shop-item-desc">+1 place (${maxSz}/12)</div><div class="pp-shop-item-cost">${maxSz>=12?'MAX':'30 PP'}</div><button class="pp-shop-buy-btn" ${!isLeader||pp<30||maxSz>=12?'disabled':''} onclick="ppShopBuy('slot')">Acheter</button></div>
        <div class="pp-shop-item${statGain>=5?' maxed':''}"><div class="pp-shop-item-title">⬆️ STAT GAIN</div><div class="pp-shop-item-desc">+1 stat/tick (+${statGain}/+5)</div><div class="pp-shop-item-cost">${statGain>=5?'MAX':'75 PP'}</div><button class="pp-shop-buy-btn" ${!isLeader||pp<75||statGain>=5?'disabled':''} onclick="ppShopBuy('stat')">Acheter</button></div>
        <div class="pp-shop-item${threshold<=15?' maxed':''}"><div class="pp-shop-item-title">⬇️ SEUIL MSG</div><div class="pp-shop-item-desc">-1 message (${threshold} → ${Math.max(15,threshold-1)}, min 15)</div><div class="pp-shop-item-cost">${threshold<=15?'MIN':'75 PP'}</div><button class="pp-shop-buy-btn" ${!isLeader||pp<75||threshold<=15?'disabled':''} onclick="ppShopBuy('threshold')">Acheter</button></div>
        <div class="pp-shop-item${purchased.includes('neural_party_chat')?' maxed':''}"><div class="pp-shop-item-title">⚡ NEURAL PARTY CHAT</div><div class="pp-shop-item-desc">Communication instantanée. +20 INT constant.</div><div class="pp-shop-item-cost">${purchased.includes('neural_party_chat')?'✅ ACQUIS':'150 PP'}</div><button class="pp-shop-buy-btn" ${!isLeader||pp<150||purchased.includes('neural_party_chat')?'disabled':''} onclick="ppShopBuy('neural_party_chat')">Acheter</button></div>
        <div class="pp-shop-item${purchased.includes('party_recall')?' maxed':''}"><div class="pp-shop-item-title">⚡ PARTY RECALL</div><div class="pp-shop-item-desc">Téléportation. -40% MAN 15 msgs.</div><div class="pp-shop-item-cost">${purchased.includes('party_recall')?'✅ ACQUIS':'150 PP'}</div><button class="pp-shop-buy-btn" ${!isLeader||pp<150||purchased.includes('party_recall')?'disabled':''} onclick="ppShopBuy('party_recall')">Acheter</button></div>
      </div>
    </div></div>
    ${p.log&&p.log.length?`<div class="card"><div class="card-body"><div class="sh" style="margin-bottom:12px"><span class="sh-num">—</span><span class="sh-title">Journal</span><div class="sh-line"></div></div><div style="display:flex;flex-direction:column;gap:6px">${p.log.slice(-5).reverse().map(l=>`<div class="party-log-entry">${e(l)}</div>`).join('')}</div></div></div>`:''}`;
  el.innerHTML=html;

  // Async: fetch each member's character data to show panels A-E (respecting hidden)
  members.forEach(async(m)=>{
    const infoEl=document.getElementById('pm-info-'+(m.char_key||'').replace(/[^a-zA-Z0-9_]/g,''));
    if(!infoEl)return;
    const isMe=m.char_key===myKey;
    const hidden=m.hidden&&!isMe;
    // Panel A is always shown — need char data from characters collection
    const uid=m.user_id||'';
    const charId=(m.char_key||'').includes('_')?(m.char_key.split('_').slice(1).join('_')):'';
    if(!charId){infoEl.innerHTML='<span style="color:var(--text3)">Données indisponibles</span>';return;}
    try{
      const charData=await cachedGet(C.CHARS,charId,'_party_char_'+charId,120);
      if(!charData){infoEl.innerHTML='<span style="color:var(--text3)">Personnage hors-ligne</span>';return;}
      const {level:lvl}=levelFromXp(charData.xp||0);
      const race=charData.race_category||'—';const cls=charData.class||'—';
      const aff=Array.isArray(charData.affinity)?charData.affinity.join(', '):(charData.affinity||'—');
      // Panel A — always visible
      let info=`<div style="margin-bottom:4px"><strong>Rang</strong> Niv.${lvl} · <strong>Race</strong> ${e(race)} · <strong>Classe</strong> ${e(cls)} · <strong>Affinité</strong> ${e(aff)}</div>`;
      if(hidden){
        info+=`<div class="party-private-tag" style="margin-top:6px">🔒 Infos masquées par le joueur</div>`;
        infoEl.innerHTML=info;return;
      }
      // Panel B-D — stats, bonuses, etc.
      const stats=charData.stats||{};
      const bonuses=m.bonuses||{};
      const statKeys=['strength','agility','speed','intelligence','mana','resistance','charisma'];
      const sLabels={strength:'STR',agility:'AGI',speed:'SPD',intelligence:'INT',mana:'MAN',resistance:'RES',charisma:'CHA'};
      info+=`<div class="stat-line" style="margin-top:6px">${statKeys.filter(k=>stats[k]).map(k=>{
        const base=parseInt(stats[k])||0;const bonus=parseInt(bonuses[k])||0;
        return`<span class="stat-tag">${sLabels[k]} ${base}${bonus>0?`<span style="color:var(--gold)">+${bonus}</span>`:''}</span>`;
      }).join('')}</div>`;
      // Powers preview
      const powers=charData.powers||[];
      if(powers.length){
        const QCOL={common:'var(--text3)',uncommon:'#22c55e',rare:'#3b82f6',epic:'#a855f7',legendary:'var(--gold)',mythic:'var(--red)',unique:'var(--cyan)',ultimate:'#aa44ff',ender:'#ff3232',sync:'#00ffee'};
        info+=`<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${powers.slice(0,4).map(p=>{
          const q=(typeof p==='string'?'common':(p.quality||'common')).toLowerCase();
          const nm=typeof p==='string'?p.replace(/_/g,' '):(p.name||p.id||'?');
          return`<span style="font-family:var(--font-m);font-size:.36rem;padding:2px 5px;border-radius:3px;border:1px solid ${QCOL[q]||'var(--text3)'}44;color:${QCOL[q]||'var(--text3)'}">${e(nm)}</span>`;
        }).join('')}</div>`;
      }
      infoEl.innerHTML=info;
    }catch(err){infoEl.innerHTML='<span style="color:var(--text3)">Erreur chargement</span>';}
  });
}

// ── PP SHOP BUY ──
async function ppShopBuy(type){
  if(!PARTY_DATA||!UID||!CHAR_ID)return;
  const myKey=`${UID}_${CHAR_ID}`;
  if(myKey!==PARTY_DATA.leader_char_key){showToast('Seul le leader peut acheter','error');return;}
  try{
    const memSnap=await db.collection(C.PARTY_MEM).doc(myKey).get();
    if(!memSnap.exists){showToast('Party introuvable','error');return;}
    const partyId=memSnap.data().party_id;
    const partySnap=await db.collection(C.PARTIES).doc(partyId).get();
    if(!partySnap.exists){showToast('Party introuvable','error');return;}
    const party=partySnap.data();
    const pp=parseInt(party.pp)||0,maxSz=parseInt(party.max_size)||3;
    const statGain=parseInt(party.stat_gain)||1,threshold=parseInt(party.msg_threshold)||25;
    const purchased=party.purchased_powers||[],log=party.log||[];
    let update={};
    if(type==='slot'){if(pp<30||maxSz>=12)return;update={pp:pp-30,max_size:maxSz+1,log:[...log,`PP Shop: +1 slot (${maxSz+1})`].slice(-20)};}
    else if(type==='stat'){if(pp<75||statGain>=5)return;update={pp:pp-75,stat_gain:statGain+1,log:[...log,`PP Shop: stat gain → +${statGain+1}`].slice(-20)};}
    else if(type==='threshold'){if(pp<75||threshold<=15)return;update={pp:pp-75,msg_threshold:threshold-1,log:[...log,`PP Shop: seuil → ${threshold-1} msgs`].slice(-20)};}
    else if(type==='neural_party_chat'||type==='party_recall'){if(pp<150||purchased.includes(type))return;update={pp:pp-150,purchased_powers:[...purchased,type],log:[...log,`PP Shop: ${type.replace(/_/g,' ')} débloqué!`].slice(-20)};}
    else return;
    await db.collection(C.PARTIES).doc(partyId).update(update);
    cacheInvalidate('_party');showToast('Achat effectué !','success');
    const fresh=await cachedGet(C.PARTIES,partyId,'_party',2);PARTY_DATA=fresh;renderParty(fresh);
  }catch(err){window._dbg?.error('[PP SHOP]',err);showToast('Erreur: '+err.message,'error');}
}

// ── RENDER PROGRESSION ──
function renderProgression(){
  if(!CHAR)return;
  const totalXp=CHAR.xp||0;
  const{level:lvl,cur:curXp,need:nextXp}=levelFromXp(totalXp);
  const pct=Math.min(100,nextXp>0?Math.round(curXp/nextXp*100):100);
  document.getElementById('prog-lvl').textContent=lvl;
  document.getElementById('prog-xp').textContent=curXp.toLocaleString()+' / '+nextXp.toLocaleString()+' XP';
  document.getElementById('prog-xp-labels').innerHTML=`<span>Niveau ${lvl}</span><span>${curXp.toLocaleString()} / ${nextXp.toLocaleString()} XP</span>`;
  document.getElementById('prog-xp-fill').style.width=pct+'%';
  document.getElementById('prog-xp-needed').textContent=lvl>=500?'Niveau maximum atteint':`Il reste ${Math.max(0,nextXp-curXp).toLocaleString()} XP pour le niveau ${lvl+1}`;
  const sp=CHAR.available_stat_points||0;
  document.getElementById('prog-sp-content').innerHTML=sp
    ?`<div class="sp-banner">⚡ ${sp} point${sp>1?'s':''} de stat disponible${sp>1?'s':''}</div>`
    :'<div class="empty">Aucun point de stat disponible pour le moment</div>';
}

// ── RENDER TITRES ──
function renderTitles(d, defs){
  const titles=d.titles||{},entries=Object.entries(titles);
  const el=document.getElementById('titles-grid');
  if(!el)return;
  if(!entries.length){el.innerHTML='<div class="empty">Aucun titre obtenu</div>';return;}
  el.innerHTML=entries.map(([id,t])=>{
    const tier=t.current_tier||t.tier||0;
    const def=defs&&defs[id];
    // Chercher le nom dans la définition du tier actuel ou du set
    const tierDef=def&&def.tiers&&def.tiers[tier];
    const name=(tierDef&&tierDef.name)||(def&&def.name)||id.replace(/_/g,' ');
    const desc=(tierDef&&tierDef.description)||(def&&def.description)||'';
    return`<div class="title-card">
      <div class="title-name">${e(name)}</div>
      ${desc?`<div class="title-desc">${e(desc)}</div>`:''}
      <div class="title-tier" style="color:${tCol(tier)}">Tier ${tier} — ${tLbl(tier)}</div>
    </div>`;
  }).join('');
}
function tCol(t){return['#6b7280','#60a5fa','#a78bfa','#fbbf24','#ef4444'][Math.min(t,4)]}
function tLbl(t){return['Commun','Peu Commun','Rare','Épique','Légendaire'][Math.min(t,4)]||'?'}

// ── RENDER COMPAGNONS ──
function renderCompanions(cu,cfg){
  const owned=cu.owned_companions||{},active=cu.active_companion;
  const entries=Object.entries(owned);
  const allComps=cfg.companions||{},allEvos=cfg.evolutions||{};
  const el=document.getElementById('comp-content');
  function resolveInfo(form,baseId){return allEvos[form]||allComps[form]||allComps[baseId]||{};}
  function compLvlFull(xp){let l=1,t=0;while(l<100&&t+300*l<=xp){t+=300*l;l++;}return{level:l,cur:xp-t,need:l<100?300*l:0};}
  let html='';
  if(entries.length){
    html+=`<div class="comp-section-title">🐾 Mes Compagnons</div>`;
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:24px">`;
    entries.forEach(([id,cd])=>{
      const form=cd.current_form||id;
      const info=resolveInfo(form,id);const baseEntry=allComps[id]||{};
      const{level:lvl,cur:curXp,need:nextXp}=compLvlFull(cd.xp||0);
      const isAct=id===active;const pct=nextXp>0?Math.min(100,Math.round(curXp/nextXp*100)):100;
      const syncBonuses=info.sync_bonuses||baseEntry.sync_bonuses||{};
      const syncPower=info.sync_power||baseEntry.sync_power||'';
      const imageUrl=info.image||info.base_image||baseEntry.base_image||'';
      const evolutions=baseEntry.evolutions||[];
      let evoHtml='';
      if(evolutions.length){evoHtml=`<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">${evolutions.map(evo=>{
        const reached=lvl>=evo.level;const isCurrent=form===evo.id;
        return`<span style="font-family:var(--font-m);font-size:.38rem;padding:2px 6px;border-radius:3px;border:1px solid ${isCurrent?'rgba(139,92,246,0.5)':reached?'rgba(68,255,136,0.2)':'rgba(255,255,255,0.06)'};color:${isCurrent?'var(--violet)':reached?'var(--green)':'var(--text3)'}">${e(evo.name)} (Niv.${evo.level})</span>`;
      }).join('')}</div>`;}
      html+=`<div class="comp-card-enhanced${isAct?' active':''}">
        ${imageUrl?`<img src="${e(imageUrl)}" class="comp-card-img" alt="${e(info.name||id)}" onerror="this.outerHTML='<div class=comp-card-img-placeholder>🐾</div>'">`:'<div class="comp-card-img-placeholder">🐾</div>'}
        <div class="comp-card-body">
          ${isAct?'<span class="badge badge-green" style="display:inline-block;margin-bottom:8px;font-family:var(--font-m);font-size:.4rem">⭐ ACTIF</span>':''}
          <div class="comp-card-name">${e(info.name||form||id)}</div>
          <div class="comp-card-ability">${e(baseEntry.unique_ability||info.unique_ability||'')}</div>
          <div class="comp-card-stats-row"><div class="comp-card-stat">Niv. ${lvl}</div><div class="comp-card-stat">${(cd.xp||0).toLocaleString()} XP</div></div>
          <div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-family:var(--font-m);font-size:.38rem;color:var(--text3);margin-bottom:3px"><span>XP</span><span>${curXp}/${nextXp||'MAX'}</span></div><div style="height:4px;background:rgba(0,229,255,0.08);border-radius:2px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--cyan);border-radius:2px;transition:width .5s"></div></div></div>
          <div class="comp-card-sync ${cd.synchronized?'synced':'unsynced'}">${cd.synchronized?'✅ Synchronisé':'💤 Non synchronisé'}</div>
          ${Object.keys(syncBonuses).length?`<div style="font-family:var(--font-m);font-size:.4rem;color:var(--text3);margin-bottom:4px">Bonus sync :</div><div class="comp-card-stats-row">${Object.entries(syncBonuses).map(([s,v])=>`<div class="comp-card-stat" style="color:var(--green)">+${v} ${s.substring(0,3).toUpperCase()}</div>`).join('')}</div>`:''}
          ${syncPower?`<div style="font-family:var(--font-m);font-size:.42rem;color:var(--violet);margin-top:4px">⚡ ${e(syncPower)}</div>`:''}
          ${evoHtml}
        </div></div>`;
    });
    html+=`</div>`;
  }else{html+=`<div class="empty" style="margin-bottom:20px">Aucun compagnon possédé</div>`;}
  // Shop
  const shopEntries=Object.entries(allComps).filter(([cid])=>!owned[cid]);
  html+=`<div class="comp-section-title">🏪 Compagnons disponibles</div>`;
  if(shopEntries.length){
    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">`;
    shopEntries.forEach(([cid,comp])=>{
      const imageUrl=comp.base_image||'';const syncBonuses=comp.sync_bonuses||{};
      const eggCost=comp.egg_cost||1;const evolutions=comp.evolutions||[];
      html+=`<div class="comp-card-enhanced">
        ${imageUrl?`<img src="${e(imageUrl)}" class="comp-card-img" alt="${e(comp.name||cid)}" onerror="this.outerHTML='<div class=comp-card-img-placeholder>🥚</div>'">`:'<div class="comp-card-img-placeholder">🥚</div>'}
        <div class="comp-card-body">
          <div class="comp-card-name">${e(comp.name||cid)}</div>
          <div class="comp-card-ability">${e(comp.unique_ability||'')}</div>
          ${Object.keys(syncBonuses).length?`<div class="comp-card-stats-row" style="margin-top:6px">${Object.entries(syncBonuses).map(([s,v])=>`<div class="comp-card-stat" style="color:var(--green)">+${v} ${s.substring(0,3).toUpperCase()}</div>`).join('')}</div>`:''}
          ${comp.sync_power?`<div style="font-family:var(--font-m);font-size:.42rem;color:var(--violet);margin-top:4px">⚡ ${e(comp.sync_power)}</div>`:''}
          ${evolutions.length?`<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${evolutions.map(evo=>`<span style="font-family:var(--font-m);font-size:.36rem;padding:2px 5px;border-radius:3px;border:1px solid rgba(139,92,246,0.15);color:var(--text3)">${e(evo.name)} (Niv.${evo.level})</span>`).join('')}</div>`:''}
          <div class="comp-shop-price">🥚 ${eggCost} Golden Egg${eggCost>1?'s':''}</div>
          <button class="comp-shop-buy-btn" disabled title="Achats via Discord (/companion)">Acheter via Discord</button>
        </div></div>`;
    });
    html+=`</div>`;
  }else{html+=`<div class="empty">Tous les compagnons sont possédés !</div>`;}
  el.innerHTML=html;
}
function compLvl(xp){let l=1,t=0;while(t+300*l<=xp){t+=300*l;l++}return l}

// ── RENDER SHOP ──
function renderShop(shop){
  const el=document.getElementById('shop-content');
  if(!shop||!shop.name){el.innerHTML=`<div class="empty">Tu n'as pas de boutique.</div>`;return}
  const open=shop.open!==false,items=Object.entries(shop.items||{});
  el.innerHTML=`<div class="card"><div class="card-body">
    <div class="shop-name">${e(shop.name)}</div>
    ${shop.tagline?`<div class="shop-tagline">${e(shop.tagline)}</div>`:''}
    <div style="display:inline-flex;align-items:center;gap:6px;font-family:var(--font-m);font-size:.48rem;letter-spacing:.1em;margin-bottom:16px">
      <div style="width:7px;height:7px;border-radius:50%;background:${open?'var(--green)':'var(--red)'}"></div>
      <span style="color:${open?'var(--green)':'var(--red)'}">${open?'OUVERTE':'FERMÉE'}</span>
    </div>
    ${items.length?`<div class="sh" style="margin-bottom:12px"><span class="sh-num">—</span><span class="sh-title">Items en vente (${items.length})</span><div class="sh-line"></div></div>
      <div class="shop-items-grid">${items.map(([id,it])=>`<div class="shop-item"><span class="shop-item-icon">${it.emoji||'📦'}</span><div class="shop-item-name">${e(it.name||id)}</div><div class="shop-item-price">${it.price||0} Nav</div></div>`).join('')}</div>`
      :'<div class="empty">Aucun item en vente</div>'}
  </div></div>`;
}

// ── RENDER PARAMETRES ──
function renderSettings(){
  try{
    const s=getSess()||{};
    const infoEl=document.getElementById('settings-user-info');
    const themeEl=document.getElementById('theme-current');
    if(infoEl)infoEl.innerHTML=`ID Discord : <span style="color:var(--blue)">${s.id||'—'}</span><br>Username : <span style="color:var(--text)">${s.username||'—'}</span>`;
    const theme=(PLAYER&&PLAYER.display_theme)||'purple';
    if(themeEl)themeEl.textContent=theme;
    document.querySelectorAll('.theme-opt').forEach(el=>el.classList.toggle('selected',el.dataset.theme===theme));
  }catch(err){window._dbg?.error('[SETTINGS]',err);}
}

async function setTheme(theme){
  try{
    await db.collection(C.PLAYERS).doc(UID).set({display_theme:theme},{merge:true});
    PLAYER.display_theme=theme;cacheInvalidate('_player');renderSettings();
    showToast('Thème mis à jour','success');
  }catch(err){showToast('Erreur lors de la mise à jour','error')}
}


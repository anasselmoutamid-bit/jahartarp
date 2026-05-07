/* ══════════════════════════════════════════════════════════════════════
   hub-core.js — Noyau du Hub Jaharta
   Firebase init · constantes · cache · session · auth · state · loaders · tabs · utils
   ══════════════════════════════════════════════════════════════════════ */

// ── CONFIG FIREBASE ──
const FB={apiKey:"AIzaSyCqv3yxMVWsLSsOstpkkkTFg0Qg4H2xBcA",authDomain:"jahartarp.firebaseapp.com",projectId:"jahartarp",storageBucket:"jahartarp.firebasestorage.app",messagingSenderId:"834848086593",appId:"1:834848086593:web:c5cddc894f04feb61cc4c0"};
if(!firebase.apps.length)firebase.initializeApp(FB);
const db=firebase.firestore();

// ── COLLECTIONS (noms exacts du bot) ──
const C={
  ACTIVE:'active_characters',   // {discord_id} → {character_id, user_id}
  CHARS:'characters',           // {char_uuid}  → perso complet
  PLAYERS:'players',            // {discord_id} → {navarites, notoriety, display_theme, consecutive_days...}
  INV:'inventories',            // {discord_id}_{char_uuid} → {items:{}, equipped_assets:[]}
  COMP:'companions_user',       // {discord_id}_{char_uuid} → {owned_companions, active_companion}
  TITLES:'titles_user',         // {discord_id} → {titles:{}, tp:0}
  PARTIES:'parties',            // {party_id}   → {name, members[], leader_char_key...}
  PARTY_MEM:'party_membership', // {discord_id}_{char_uuid} → {party_id}
  PITY:'gacha_pity',            // {discord_id} → {navarites_spent_epic, navarites_spent_leg}
  SHOPS:'shops',                // {discord_id}_{char_uuid} → {name, open, items{}}
  ECONOMY:'economy',             // {discord_id}_{char_uuid} → {personal:{}}
  LINK:'gacha_link_codes',      // {code} → {discord_id, username, avatar_url, expires_at}
  CFG:'config',                 // items, companions_data, etc.
};

const SI={strength:'⚔️',agility:'💨',speed:'🏃',intelligence:'🧠',mana:'✨',resistance:'🛡️',charisma:'👑',aura:'🌟'};
const SL={strength:'Force',agility:'Agilité',speed:'Vitesse',intelligence:'Intel.',mana:'Mana',resistance:'Rés.',charisma:'Charisme',aura:'Aura'};
const SK=['strength','agility','speed','intelligence','mana','resistance','charisma','aura'];
const PITY_T={epic:30,leg:150};

// ══════════════════════════════════════════════
// CACHE — utilise JCache (js/jaharta-cache.js) partagé avec tout le site
// Wrappers pour compatibilité avec le code hub existant
// ══════════════════════════════════════════════
function cacheInvalidate(key){JCache.invalidate(key,null);}
// Raccourci : get un doc Firestore avec cache (compat SDK)
// Utilise cacheKey comme clé de cache (au lieu de collection/docId)
// pour que cacheInvalidate(cacheKey) fonctionne correctement
async function cachedGet(collection,docId,cacheKey,ttl){
  var cached=JCache.peek(cacheKey,null);
  if(cached!==null) return cached;
  var snap=await db.collection(collection).doc(docId).get();
  var data=snap.exists?snap.data():null;
  JCache.put(cacheKey,null,data,ttl);
  return data;
}
// Raccourci : get toute une collection avec cache
async function cachedCollection(collection,cacheKey,ttl){
  var cached=JCache.peek(cacheKey,null);
  if(cached!==null) return cached;
  var snap=await db.collection(collection).get();
  var docs=[];
  snap.forEach(function(d){docs.push({_key:d.id,...d.data()});});
  JCache.put(cacheKey,null,docs,ttl);
  return docs;
}

// ── SESSION (partagée gacha ↔ hub) — TTL 7 jours ──
const SESSION_TTL=7*24*60*60*1000;
function getSess(){
  try{
    const raw=localStorage.getItem('hub_session')||localStorage.getItem('gacha_session');
    if(!raw)return null;
    const s=JSON.parse(raw);
    /* Vérifier l'expiration de la session */
    if(s._exp&&Date.now()>s._exp){clearSess();return null;}
    return s;
  }catch(e){return null}
}
function setSess(s){
  const payload={...s,_exp:Date.now()+SESSION_TTL};
  localStorage.setItem('hub_session',JSON.stringify(payload));
  localStorage.setItem('gacha_session',JSON.stringify(payload));
}
function clearSess(){localStorage.removeItem('hub_session');localStorage.removeItem('gacha_session')}

// ── AUTH ──
async function verifyCode(){
  const inp=document.getElementById('link-code'),err=document.getElementById('code-error'),btn=document.getElementById('verify-btn');
  err.style.display='none';
  const code=inp.value.trim().toUpperCase();
  if(!code||code.length<4){showErr('Entre un code valide');return}
  btn.disabled=true;btn.textContent='VÉRIFICATION...';
  function showErr(m){err.textContent=m;err.style.display='block'}
  function done(){btn.disabled=false;btn.textContent='CONNEXION AU NEXUS'}
  try{
    /* ── Transaction atomique : lecture + suppression en une seule opération ──
       Empêche la réutilisation du même code par deux onglets simultanés (TOCTOU). */
    const codeRef=db.collection(C.LINK).doc(code);
    let sessionData=null;
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(codeRef);
      if(!snap.exists)throw Object.assign(new Error('Code invalide ou déjà utilisé'),{_userMsg:true});
      const d=snap.data();
      if(d.expires_at&&new Date(d.expires_at)<new Date()){
        tx.delete(codeRef);
        throw Object.assign(new Error('Code expiré — utilise /link'),{_userMsg:true});
      }
      /* Marquer utilisé dans la transaction AVANT de retourner les données */
      tx.delete(codeRef);
      sessionData={id:d.discord_id,username:d.username,avatar:d.avatar_url};
    });
    setSess(sessionData);
    await loadHub();
  }catch(e){
    const msg=e._userMsg?e.message:'Erreur de connexion — réessaye';
    showErr(msg);done();
  }
}
document.addEventListener('DOMContentLoaded',function(){
  const lc=document.getElementById('link-code');
  const vb=document.getElementById('verify-btn');
  if(lc)lc.addEventListener('keydown',e=>{if(e.key==='Enter')verifyCode();});
  if(vb)vb.addEventListener('click',verifyCode);
  init();
});

function logout(){
  clearSess();
  document.getElementById('hub-main').classList.remove('active');
  document.getElementById('main-nav').style.display='none';
  document.getElementById('login-gate').style.display='flex';
  showToast('Déconnecté','info');
}

// ── ACCESSIBILITÉ ──
const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;

// ── STATE ──
let CHAR=null,PLAYER=null,PITY=null,INV_DATA=null,CHAR_ID=null,UID=null,ALL_ITEMS_DATA={};
let PARTY_DATA=null,TITLES_DATA=null,TITLES_DEF=null,BUFFS_DATA=null;
let COMP_USER=null,COMP_CFG=null; // compagnon data for stats
let CURRENT_TAB='dashboard'; // onglet actif — lazy render

/* ── SIGNATURE ITEMS (port from signature_items.py) ── */
const SIGNATURE_ITEMS={
  cyclo_arcana:{name:"Cyclo-Arcana",icon:"⚔️",emoji:"⚔️",slot:"armes_h",type:"equipment",rarity:"signature",description:"Un Grand Espadon lié à son utilisateur. Les runes frappées sur son pommeau indique que la lame serait capable de trancher à même le temps."},
  fake_twins:{name:"Fake Twins",icon:"🔫",emoji:"🔫",slot:"armes_h",type:"equipment",rarity:"signature",description:"Un duo surprenant. Un pistolet et un fusil sniper métamorphes, changeant de forme pour respectivement une dague et un sabre.",image:"https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2Fsniper_lourd_x_pistolet_transparent.png?alt=media&token=262a58f0-71ff-463e-bcff-8d7c9ae65fed"},
  kings_jewel:{name:"King's Jewel",icon:"💎",emoji:"💎",slot:"mains",type:"equipment",rarity:"signature",description:"Une arme basique en apparence, mais qui est en réalité le B.A. Ba d'un roi digne de ce nom.",image:"https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2003_34_26.png?alt=media&token=1bcc7bbd-2967-40ab-b0b8-d46abbb18d9b"},
  real_twins:{name:"Real Twins",icon:"🧤",emoji:"🧤",slot:"armes_h",type:"equipment",rarity:"signature",description:"Une paire de gants forgée d'un tissu si léger qu'il semble irréel et pourtant, il est plus dur que du titane."},
  diademe_du_nexus:{name:"Diadème du Nexus",icon:"👑",emoji:"👑",slot:"cou",type:"equipment",rarity:"signature",description:"Une coiffe si translucide qu'elle semble faite de données."},
  faux_modele_0:{name:"Faux, Modèle 0",icon:"🪓",emoji:"🪓",slot:"armes_h",type:"equipment",rarity:"signature",description:"D'après la base de données, il s'agit de la première faux jamais créée.",image:"https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2Ffaux_tactique_sci_fi_transparente.png?alt=media&token=f721ea57-7afc-48ac-b46b-af6718ff7bc8"},
  epee_de_damocles:{name:"Épée de Damoclès",icon:"🗡️",emoji:"🗡️",slot:"armes_h",type:"equipment",rarity:"signature",description:"Une arme étrangère à ce monde."},
  blitz_runners:{name:"Blitz Runners",icon:"👟",emoji:"👟",slot:"pieds",type:"equipment",rarity:"signature",description:"Des bottines plus rapides que le mot lui même."},
  survivai_kit:{name:"Survivai Kit, Premium Edition",icon:"🧰",emoji:"🧰",slot:"mains",type:"equipment",rarity:"signature",description:"Riez tant que vous le voulez, cet item vous le fera regretter."},
  riviere_dopalines:{name:"Rivière d'Opalines",icon:"📿",emoji:"📿",slot:"cou",type:"equipment",rarity:"signature",description:"Le collier le plus prisé de tous les temps. Pour les bonnes et les mauvaises raisons."},
  faux_ongles_tisserand:{name:"Faux-Ongles du Tisserand de Rêves",icon:"💅",emoji:"💅",slot:"cou",type:"equipment",rarity:"signature",description:"Les rêves et la réalité ne font qu'un. C'est ce qu'il disait, en tout cas."},
  cape_sombre_xiii:{name:"Cape Sombre, Modèle XIII",icon:"🧥",emoji:"🧥",slot:"dos",type:"equipment",rarity:"signature",description:"Une cape d'un noir absolu, modèle XIII. Ses effets se renforcent lorsque plusieurs membres d'une même party la portent.",image:"https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/icons%2F205.png?alt=media&token=aad4f798-3e58-4a69-a608-34f858e49aa9"},
  lame_sang_sushel:{name:"Lame-Sang de Sushel",icon:"🗡️",emoji:"🗡️",slot:"armes_h",type:"equipment",rarity:"signature",description:"Une lame maudite liée au sang de son porteur. Elle grandit avec le temps, dévorant l'essence vitale du monde autour d'elle.",image:"https://firebasestorage.googleapis.com/v0/b/jahartarp.firebasestorage.app/o/icons%2FChatGPT%20Image%203%20mai%202026%2C%2000_29_40.png?alt=media&token=d8444616-2ce2-43b3-8b14-6b64e4ca9d60"},
  lust_incarnate:{name:"Lust Incarnate",icon:"💜",emoji:"💜",slot:"special",type:"equipment",rarity:"signature",description:"L'incarnation même du désir. Ceux qui la portent deviennent irrésistibles — et irrémédiablement transformés."}
};
const SIG_ALL_STATS=["strength","agility","speed","intelligence","mana","resistance","charisma"];

function calculateSignatureBonuses(equippedIds,charStats,auraEnabled,existingBuffs){
  const b={};
  function add(s,v){b[s]=(b[s]||0)+Math.floor(v);}
  function base(s){return parseInt((charStats||{})[s]||0)||0;}
  const sigIds=equippedIds.filter(id=>SIGNATURE_ITEMS[id]);
  for(const id of sigIds){
    if(id==='cyclo_arcana'){
      const spdTotal=base('speed')+(existingBuffs||{}).speed||0;
      add('speed',spdTotal*0.50);
    }else if(id==='fake_twins'){
      add('agility',20);add('charisma',50);
      if(auraEnabled){SIG_ALL_STATS.forEach(s=>add(s,50));add('aura',100);}
    }else if(id==='kings_jewel'){
      add('mana',50);
      if(auraEnabled){add('mana',50);}
    }else if(id==='real_twins'){
      Object.entries(existingBuffs||{}).forEach(([s,v])=>{if(v>0)add(s,v*0.75);});
    }else if(id==='diademe_du_nexus'){
      add('agility',50);add('intelligence',50);
      if(base('mana')>300)add('mana',100);
    }else if(id==='faux_modele_0'){
      add('intelligence',75);
      if(base('mana')>300)add('mana',100);
    }else if(id==='epee_de_damocles'){
      add('agility',50);
    }else if(id==='blitz_runners'){
      add('agility',75);add('speed',75);add('mana',75);
    }else if(id==='survivai_kit'){
      if(charStats){
        const highest=SIG_ALL_STATS.reduce((a,s)=>base(s)>base(a)?s:a,SIG_ALL_STATS[0]);
        SIG_ALL_STATS.forEach(s=>add(s,s===highest?75:50));
      }
      if(base('agility')>600){
        Object.entries(existingBuffs||{}).forEach(([s,v])=>{if(v>0)add(s,v*0.5);});
      }
    }else if(id==='riviere_dopalines'){
      SIG_ALL_STATS.forEach(s=>add(s,50));
      if(base('mana')>300){SIG_ALL_STATS.forEach(s=>add(s,25));add('mana',100);}
    }else if(id==='faux_ongles_tisserand'){
      add('mana',150);
      if(base('mana')>700){SIG_ALL_STATS.forEach(s=>add(s,150));}
    }else if(id==='cape_sombre_xiii'){
      add('resistance',45);
    }else if(id==='lame_sang_sushel'){
      SIG_ALL_STATS.forEach(s=>add(s,65));
    }else if(id==='lust_incarnate'){
      add('mana',100);add('charisma',100);add('agility',100);add('intelligence',100);
    }
  }
  return b;
}

/* ══════════════════════════════════════════════════════════════════════
   Mythic+ / Unique / Artifact / Mastercraft special item effects
   Port from bot inventory_system.py → mythic_effects dict
   ══════════════════════════════════════════════════════════════════════ */
const MYTHIC_EFFECTS={
  // Mythic
  diademe_eveil_primordial:       {buff_mult:{mana:1.5}},
  heaume_jugement_final:          {pct_base:{resistance:0.15}},
  manteau_neant_absolu:           {nerf_reduction:0.30},
  anneau_apocalypse:              {buff_mult:{strength:1.5}},
  bague_eternel_retour:           {pct_base:{speed:0.20}},
  anneau_unique_systeme:          {conditional:(bs,eq)=>bs('mana')>500?{mana:100}:{}},
  poignes_destructeur_code:       {buff_mult:{strength:2.0}},
  bracelets_horizon_evenements:   {conditional:(bs,eq)=>bs('speed')>300?{speed:50}:{}},
  bottes_transcendance:           {buff_mult:{speed:1.5}},
  manteau_gravite_zero:           {buff_mult:{agility:1.5}},
  coeur_supernova:                {buff_mult:{mana:2.0}},
  excalibur_neon:                 {buff_mult:{strength:1.5},pct_base:{charisma:0.05}},
  auroras_mythril_hammer:         {conditional:(bs,eq)=>bs('strength')>400?{strength:50}:{}},
  dagues_fin_temps:               {buff_mult:{agility:1.5}},
  pistolet_singularite:           {conditional:(bs,eq)=>bs('intelligence')>300?{mana:50}:{}},
  ia_conscience_gaia:             {nerf_reduction:0.20},
  original_fragment_core_nexus:   {conditional:(bs,eq)=>['fragment_of_reality','birth_of_the_imaginary','ia_conscience_gaia'].some(i=>eq.has(i))?{mana:100}:{}},
  // Unique
  ethereal_halo:                  {buff_mult:{intelligence:1.5,mana:1.25}},
  quantum_mirror_coat:            {nerf_reduction:0.40},
  time_paradox_ring:              {pct_base_all:0.10},
  silver_ring_nexus:              {conditional:(bs,eq)=>bs('agility')>400?{agility:50}:{}},
  silver_tear_nexus:              {conditional:(bs,eq)=>({mana:100})},
  wings_principle_speed:          {buff_mult:{speed:2.0}},
  kang_soos_great_sword:          {buff_mult:{strength:2.0}},
  dagger_principle_reality:       {buff_mult:{agility:1.75}},
  destinys_cuffs:                 {conditional:(bs,eq)=>bs('resistance')>bs('strength')?{strength:Math.floor(bs('strength')*0.5)}:{}},
  omega_nexus:                    {pct_base_all:0.15},
  invisi_gloves:                  {conditional:(bs,eq)=>bs('charisma')>300?{agility:75}:{}},
  // Artifact
  old_chaos_mask:                 {buff_mult:{intelligence:2.0}},
  forgotten_kings_crown:          {conditional:(bs,eq)=>bs('charisma')>500?{charisma:100}:{}},
  origins_chestplate:             {nerf_reduction:0.50},
  old_chaos_ring:                 {buff_mult:{strength:2.0}},
  origins_ring:                   {buff_mult:{mana:2.0}},
  destinys_gauntelet:             {buff_mult:{agility:2.0}},
  destinys_chains:                {conditional:(bs,eq)=>bs('speed')>500?{speed:100}:{}},
  stars_devourer:                 {conditional:(bs,eq)=>bs('mana')>300?{strength:100}:{}},
  the_betrayer:                   {conditional:(bs,eq)=>bs('strength')<bs('agility')?{agility:100}:{}},
  inertia_bracelets:              {buff_mult:{resistance:2.0}},
  lost_entitys_core:              {pct_base_all:0.15},
  // Mastercraft Baldun
  balduns_crown:                  {buff_mult:{intelligence:3.0}},
  balduns_chivalery:              {buff_mult:{agility:3.0}},
  balduns_gauntelet:              {buff_mult:{charisma:3.0}},
  balduns_chains:                 {pct_base_all:0.25},
  balduns_cape:                   {conditional:(bs,eq)=>eq.has('balduns_chestplate')?{resistance:600}:{}},
  balduns_executionner:           {buff_mult:{strength:3.0}},
  balduns_claws:                  {buff_mult:{strength:3.0}},
  balduns_bracelet:               {buff_mult:{mana:3.0}},
  balduns_god_shoes:              {buff_mult:{speed:3.0}},
  balduns_ring:                   {conditional:(bs,eq,aura)=>{if(!aura)return {};const r={};SIG_ALL_STATS.forEach(s=>{r[s]=bs(s)*2;});return r;}},
};

/**
 * Calculate Mythic+ item special effects (buff_mult, pct_base, conditional, nerf_reduction).
 * Mirrors bot inventory_system.py lines 687-783.
 * @param {string[]} equippedIds
 * @param {object} charStats - base character stats
 * @param {object} totalBonuses - accumulated bonuses so far (will be mutated for pct_base/conditional)
 * @param {boolean} auraEnabled
 * @returns {{itemBuffMult:object, itemNerfReduction:number}}
 */
function calculateMythicEffects(equippedIds,charStats,totalBonuses,auraEnabled){
  const ALL=SIG_ALL_STATS;
  const bs=s=>parseInt((charStats||{})[s]||0)||0;
  const eqSet=new Set(equippedIds);
  const itemBuffMult={};
  let itemNerfReduction=0;
  for(const id of equippedIds){
    const fx=MYTHIC_EFFECTS[id];
    if(!fx)continue;
    // buff_mult
    if(fx.buff_mult){
      for(const[s,m] of Object.entries(fx.buff_mult)){
        itemBuffMult[s]=Math.max(itemBuffMult[s]||1,m);
      }
    }
    // pct_base
    if(fx.pct_base){
      for(const[s,pct] of Object.entries(fx.pct_base)){
        totalBonuses[s]=(totalBonuses[s]||0)+Math.floor(bs(s)*pct);
      }
    }
    // pct_base_all
    if(fx.pct_base_all){
      ALL.forEach(s=>{totalBonuses[s]=(totalBonuses[s]||0)+Math.floor(bs(s)*fx.pct_base_all);});
    }
    // conditional
    if(fx.conditional){
      try{
        const cb=fx.conditional(bs,eqSet,auraEnabled);
        if(cb){for(const[s,v] of Object.entries(cb)){totalBonuses[s]=(totalBonuses[s]||0)+Math.floor(v);}}
      }catch(_){}
    }
    // nerf_reduction
    if(fx.nerf_reduction){itemNerfReduction=Math.max(itemNerfReduction,fx.nerf_reduction);}
  }
  return {itemBuffMult,itemNerfReduction};
}

/**
 * Calculate set bonuses — applies ONLY the highest threshold met per set (like the bot).
 * Mirrors bot item_sets.py calculate_set_bonuses().
 * @param {string[]} equippedIds
 * @returns {{stats:object, buffMult:object, buffMultAll:number, nerfReduction:number, special:string|null}}
 */
function calculateSetBonuses(equippedIds){
  const ALL=SIG_ALL_STATS;
  const result={stats:{},buffMult:{},buffMultAll:1.0,nerfReduction:0,special:null};
  const eqSet=new Set(equippedIds);
  for(const[,setDef] of Object.entries(ITEM_SETS)){
    const count=setDef.items.filter(i=>eqSet.has(i)).length;
    if(count<2)continue;
    const thresholds=Object.keys(setDef.bonuses).map(Number).sort((a,b)=>b-a); // descending
    for(const t of thresholds){
      if(count>=t){
        const bonus=setDef.bonuses[String(t)]||setDef.bonuses[t]||{};
        if(bonus.stats)for(const[s,v] of Object.entries(bonus.stats)){result.stats[s]=(result.stats[s]||0)+v;}
        if(bonus.stats_all)ALL.forEach(s=>{result.stats[s]=(result.stats[s]||0)+bonus.stats_all;});
        if(bonus.buff_mult)for(const[s,m] of Object.entries(bonus.buff_mult)){result.buffMult[s]=Math.max(result.buffMult[s]||1,m);}
        if(bonus.buff_mult_all)result.buffMultAll=Math.max(result.buffMultAll,bonus.buff_mult_all);
        if(bonus.nerf_reduction)result.nerfReduction=Math.max(result.nerfReduction,bonus.nerf_reduction);
        if(bonus.special)result.special=bonus.special;
        break; // only highest threshold per set
      }
    }
  }
  return result;
}

/**
 * Apply buff multipliers to total bonuses + Equalizer logic.
 * Mirrors bot inventory_system.py lines 784-828.
 */
function applyBuffMultipliersAndEqualizer(totalBonuses,charStats,equippedIds,itemBuffMult,setResult,auraEnabled){
  const ALL=SIG_ALL_STATS;
  const bs=s=>parseInt((charStats||{})[s]||0)||0;
  // Merge item + set buff_mult (take max per stat)
  const finalBuffMult={};
  for(const s of new Set([...Object.keys(itemBuffMult),...Object.keys(setResult.buffMult)])){
    finalBuffMult[s]=Math.max(itemBuffMult[s]||1,setResult.buffMult[s]||1);
  }
  // Apply global buff_mult_all from sets
  if(setResult.buffMultAll>1){
    ALL.forEach(s=>{if(!finalBuffMult[s]||finalBuffMult[s]<setResult.buffMultAll)finalBuffMult[s]=setResult.buffMultAll;});
  }
  // Apply multipliers to equipment bonuses (positive only)
  for(const[s,mult] of Object.entries(finalBuffMult)){
    if(mult>1 && (totalBonuses[s]||0)>0){
      totalBonuses[s]=Math.floor(totalBonuses[s]*mult);
    }
  }
  // Equalizer
  const eqSet=new Set(equippedIds);
  if(eqSet.has('equalizer')&&charStats){
    const baseVals=ALL.map(s=>bs(s)).sort((a,b)=>b-a);
    let target;
    if(setResult.special==='equalize_to_highest_plus_10pct'){
      target=Math.floor(baseVals[0]*1.10);
    }else if(setResult.special==='equalize_to_highest'){
      target=baseVals[0];
    }else{
      target=baseVals.length>=4?Math.floor(baseVals.slice(0,4).reduce((a,b)=>a+b,0)/4):Math.floor(baseVals.reduce((a,b)=>a+b,0)/Math.max(1,baseVals.length));
    }
    ALL.forEach(s=>{
      const current=bs(s)+(totalBonuses[s]||0);
      if(current<target)totalBonuses[s]=(totalBonuses[s]||0)+(target-current);
    });
  }
}

// ── INIT ──
async function init(){
  const s=getSess();
  if(s&&s.id){
    try{ await loadHub(); }
    catch(err){ window._dbg?.error('[HUB] loadHub failed',err); }
  } else {
    document.getElementById('login-gate').style.display='flex';
  }
}

async function loadHub(){
  const s=getSess();
  if(!s||!s.id){
    window._dbg?.warn('[HUB]','loadHub: pas de session valide');
    document.getElementById('login-gate').style.display='flex';
    return;
  }
  UID=s.id;
  window.UID=UID; // expose pour hub-achievements.js / hub-irp.js
  // Afficher l'interface immédiatement
  document.getElementById('login-gate').style.display='none';
  document.getElementById('main-nav').style.display='flex';
  document.getElementById('hub-main').classList.add('active');
  document.getElementById('nav-username').textContent=s.username||'—';try{document.getElementById('menu-username').textContent=s.username||'—';}catch(e){}
  if(s.avatar){const av=document.getElementById('nav-avatar');av.src=s.avatar;av.style.display='block'}
  // Charger les données en parallèle — les erreurs n'empêchent pas l'affichage
  try{ await Promise.all([loadCharacter(),loadPlayer()]); }
  catch(err){ window._dbg?.error('[HUB] chargement données',err); }
}

async function loadCharacter(){
  try{
    const acData=await cachedGet(C.ACTIVE,UID,'_active_char',15);
    if(!acData){renderNoChar();return}
    CHAR_ID=acData.character_id;
    window.CHAR_ID=CHAR_ID;
    if(!CHAR_ID){renderNoChar();return}
    const cData=await cachedGet(C.CHARS,CHAR_ID,'_character',30);
    if(!cData){renderNoChar();return}
    CHAR={_id:CHAR_ID,...cData};
    window.CHAR=CHAR;
    const charKey=(window._resolveIRPInventoryKey && window._irpMode)
      ? await window._resolveIRPInventoryKey(UID, CHAR_ID, cData)
      : `${UID}_${CHAR_ID}`;
    window._inventoryKeyResolved = charKey;
    // Charger en parallèle avec cache
    const[invData,cfgData,bufData,pmData]=await Promise.all([
      cachedGet(C.INV,charKey,'_inventory',15),
      cachedGet(C.CFG,'items','config/items',600),
      cachedGet('buffs',UID,'_buffs',30),
      cachedGet(C.PARTY_MEM,charKey,'_party_mem',60)
    ]);
    INV_DATA=invData||{items:{},equipped_assets:[]};
    if(cfgData){
      ALL_ITEMS_DATA={...cfgData.items||{},...cfgData.equipment||{},...cfgData.food_items||{},...cfgData.consumable_items||{}};
      // Merge signature items (defined in code, not in Firestore config)
      for(const[sid,sdata] of Object.entries(SIGNATURE_ITEMS)){if(!ALL_ITEMS_DATA[sid])ALL_ITEMS_DATA[sid]=sdata;}
    }
    // Merge IRP items from Firestore (irp_items_config) so prices/IRP-specific items are available
    if(window._irpMode){
      try{
        const irpCfgSnap=await db.collection('config').doc('irp_items').get();
        if(irpCfgSnap.exists){
          const irpItems=(irpCfgSnap.data()||{}).items||{};
          Object.entries(irpItems).forEach(([k,v])=>{if(!k.startsWith('__'))ALL_ITEMS_DATA[k]=v;});
        }
      }catch(_){}
    }
    BUFFS_DATA=bufData?(bufData.buffs||[]):[];
    // Charger compagnons pour bonus stats (Personnage tab)
    try{
      const[compUser,compCfg]=await Promise.all([
        cachedGet(C.COMP,charKey,'_companions',60),
        cachedGet(C.CFG,'companions_data','config/companions_data',600)
      ]);
      COMP_USER=compUser||{};
      COMP_CFG=compCfg||{companions:{},evolutions:{}};
    }catch(_){COMP_USER={};COMP_CFG={companions:{},evolutions:{}};}
    if(pmData&&pmData.party_id){
      const pData=await cachedGet(C.PARTIES,pmData.party_id,'_party',60);
      PARTY_DATA=pData||null;
    }
    renderDashChar();
    _refreshCurrentTab();
  }catch(e){window._dbg?.error('[CHAR]',e);renderNoChar()}
}

async function loadPlayer(){
  try{
    const[pData,pityData]=await Promise.all([
      cachedGet(C.PLAYERS,UID,'_player',30),
      cachedGet(C.PITY,UID,'_pity',30)
    ]);
    PLAYER=pData||{};
    window.PLAYER=PLAYER;
    PITY=pityData||{};
    renderPlayerWidgets();
    _refreshCurrentTab();
  }catch(e){window._dbg?.error('[PLAYER]',e);}
}

// ── LOADERS PARESSEUX (au clic de l'onglet) ──
async function loadInventory(){
  const grid=document.getElementById('inv-grid');
  if(!CHAR_ID){grid.innerHTML='<div class="empty">Aucun personnage actif</div>';return}
  if(window.Skeleton) window.Skeleton.show('inv-grid',6);
  try{
    const key=(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
    const[invData,cfgData]=await Promise.all([
      cachedGet(C.INV,key,'_inventory',15),
      cachedGet(C.CFG,'items','config/items',600)
    ]);
    INV_DATA=invData||{items:{},equipped_assets:[]};
    if(cfgData) ALL_ITEMS_DATA={...cfgData.items||{},...cfgData.equipment||{},...cfgData.food_items||{},...cfgData.consumable_items||{}};
    // Merge signature items (defined in code, not in Firestore config)
    for(const[sid,sdata] of Object.entries(SIGNATURE_ITEMS)){if(!ALL_ITEMS_DATA[sid])ALL_ITEMS_DATA[sid]=sdata;}
    // Merge IRP items from Firestore
    if(window._irpMode){
      try{
        const irpCfgSnap=await db.collection('config').doc('irp_items').get();
        if(irpCfgSnap.exists){
          const irpItems=(irpCfgSnap.data()||{}).items||{};
          Object.entries(irpItems).forEach(([k,v])=>{if(!k.startsWith('__'))ALL_ITEMS_DATA[k]=v;});
        }
      }catch(_){}
    }
    if(window.Skeleton) window.Skeleton.hide('inv-grid');
    renderInventory();
  }catch(e){window._dbg?.error('[INV]',e);if(window.Skeleton) window.Skeleton.hide('inv-grid');grid.innerHTML='<div class="empty">Erreur de chargement</div>'}
}

async function loadParty(){
  if(!CHAR_ID){document.getElementById('party-content').innerHTML='<div class="empty">Aucun personnage actif</div>';return}
  try{
    const key=`${UID}_${CHAR_ID}`;
    const mData=await cachedGet(C.PARTY_MEM,key,'_party_mem',60);
    if(!mData||!mData.party_id){document.getElementById('party-content').innerHTML='<div class="empty">Tu n\'es dans aucune party.</div>';return}
    const pData=await cachedGet(C.PARTIES,String(mData.party_id),'_party',60);
    if(!pData){document.getElementById('party-content').innerHTML='<div class="empty">Party introuvable.</div>';return}
    renderParty(pData);
  }catch(e){document.getElementById('party-content').innerHTML='<div class="empty">Erreur de chargement</div>'}
}

async function loadTitles(){
  const el=document.getElementById('titles-grid');if(!el)return;
  if(!UID){el.innerHTML='<div class="empty">Non connecté — utilise /link</div>';return;}
  el.innerHTML='<div class="empty">Chargement...</div>';
  try{
    const[tData,cfgData]=await Promise.all([
      cachedGet(C.TITLES,UID,'_titles',60),
      cachedGet(C.CFG,'titles_data','config/titles_data',600)
    ]);
    const defs=cfgData?(cfgData.titles||cfgData||{}):{};
    TITLES_DATA=tData||{};
    TITLES_DEF=defs;
    renderTitles(TITLES_DATA,defs);
  }catch(e){window._dbg?.error('[TITLES]',e);el.innerHTML='<div class="empty">Erreur de chargement</div>'}
}

async function loadCompanions(){
  if(!CHAR_ID){document.getElementById('comp-content').innerHTML='<div class="empty">Aucun personnage actif</div>';return}
  try{
    const key=`${UID}_${CHAR_ID}`;
    const[cData,cfgData]=await Promise.all([
      cachedGet(C.COMP,key,'_companions',60),
      cachedGet(C.CFG,'companions_data','config/companions_data',600)
    ]);
    renderCompanions(cData||{},cfgData||{companions:{},evolutions:{}});
  }catch(e){window._dbg?.error('[COMP]',e);document.getElementById('comp-content').innerHTML='<div class="empty">Erreur de chargement</div>'}
}

async function loadShop(){
  if(!CHAR_ID){document.getElementById('shop-content').innerHTML='<div class="empty">Aucun personnage actif</div>';return}
  try{
    const snap=await db.collection(C.SHOPS).doc(`${UID}_${CHAR_ID}`).get();
    renderShop(snap.exists?snap.data():null);
  }catch(e){document.getElementById('shop-content').innerHTML='<div class="empty">Erreur</div>'}
}

// ── TABS ──
const LAZY={
  personnage:()=>{if(CHAR)renderFullChar();},
  inventaire:()=>{if(INV_DATA&&Object.keys(ALL_ITEMS_DATA).length){renderInventory();}else{loadInventory();}},
  gacha:()=>{if(PLAYER)renderGacha();},
  party:loadParty,
  progression:()=>{if(CHAR)renderProgression();initAlloc();},
  skilltree:()=>{if(typeof renderSkillTree==='function')renderSkillTree();},
  titres:loadTitles,
  compagnons:loadCompanions,
  monshop:()=>{if(_monshopLoaded){renderMonShop();}else{loadMonShop();}},
  shops:loadShops,
  succes:()=>{if(window._achRefresh)window._achRefresh();},
  ushop:loadUshop,
  parametres:renderSettings,
};
function showTab(id){
  if(CURRENT_TAB===id)return; /* évite re-render si déjà actif */
  CURRENT_TAB=id;

  /* ── Transition fade entre les panels ── */
  const prevPanel=document.querySelector('.tab-panel.active');
  const panel=document.getElementById('panel-'+id);
  const btn=document.getElementById('tab-'+id);
  if(!panel){window._dbg?.warn('[TAB]','panel-'+id+' introuvable !');return;}

  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');

  const doSwitch=()=>{
    if(prevPanel&&prevPanel!==panel)prevPanel.classList.remove('active');
    panel.classList.add('active');
    /* Animation d'entrée du panel */
    if(!prefersReducedMotion){
      panel.style.animation='none';
      panel.offsetHeight; /* force reflow pour relancer */
      panel.style.animation='';
      panel.classList.add('jh-tab-panel');
      panel.addEventListener('animationend',()=>panel.classList.remove('jh-tab-panel'),{once:true});
    }
    if(LAZY[id]){
      try{
        const result=LAZY[id]();
        if(result&&result.catch)result.catch(err=>window._dbg?.error('[TAB] '+id,err));
      }catch(err){window._dbg?.error('[TAB] '+id+' sync',err);}
    }
  };

  if(prevPanel&&prevPanel!==panel&&!prefersReducedMotion){
    prevPanel.style.transition='opacity 0.12s ease';
    prevPanel.style.opacity='0';
    setTimeout(()=>{
      prevPanel.style.opacity='';
      prevPanel.style.transition='';
      doSwitch();
    },120);
  }else{
    doSwitch();
  }
}
function _refreshCurrentTab(){
  if(CURRENT_TAB==='dashboard')return;
  if(!LAZY[CURRENT_TAB])return;
  try{const r=LAZY[CURRENT_TAB]();if(r&&r.catch)r.catch(()=>{});}catch(_){}
}

// ── UTILS ──
// Formule XP exacte du bot (stats_common.py)
// xp_needed_for_next_level(level) = 500 * level
// total_xp_required_for_level(level) = 500 * (n*(n+1)/2) avec n=level-1
function totalXpForLevel(lvl){
  const n=Math.max(0,Math.floor(lvl)-1);
  return 500*(n*(n+1)/2);
}
function xpForNextLevel(lvl){return 500*Math.max(1,Math.floor(lvl));}
function levelFromXp(totalXp){
  let xp=Math.max(0,totalXp),level=1;
  while(level<500){
    const need=xpForNextLevel(level);
    if(xp<need)return{level,cur:xp,need};
    xp-=need;level++;
  }
  return{level:500,cur:0,need:0};
}
// Legacy alias
function lvlXP(lvl){return totalXpForLevel(lvl);}
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

window.addEventListener('scroll',()=>{const max=document.body.scrollHeight-window.innerHeight;document.getElementById('scroll-line').style.width=(max>0?(window.scrollY/max*100):0)+'%'});

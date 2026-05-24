/* ══════════════════════════════════════════════════════════════════════
   hub-irp-core.js — Noyau STANDALONE du Hub IRP
   ══════════════════════════════════════════════════════════════════════
   Remplace hub-core.js + hub-irp.js en un seul fichier unifié.
   Zéro dépendance vers le hub normal. Collections IRP dès le départ.
   ══════════════════════════════════════════════════════════════════════ */

// ── Force IRP mode ──
window._irpMode = true;
localStorage.setItem("jaharta_irp_mode","true");

// ── CONFIG FIREBASE ──
const FB={apiKey:"AIzaSyCqv3yxMVWsLSsOstpkkkTFg0Qg4H2xBcA",authDomain:"jahartarp.firebaseapp.com",projectId:"jahartarp",storageBucket:"jahartarp.firebasestorage.app",messagingSenderId:"834848086593",appId:"1:834848086593:web:c5cddc894f04feb61cc4c0"};
if(!firebase.apps.length)firebase.initializeApp(FB);
const db=firebase.firestore();
window._db=db; // expose for cross-file access

// ── COLLECTIONS IRP (directement, pas d'override) ──
const C={
  ACTIVE:'irp_active_characters',
  CHARS:'irp_characters',
  PLAYERS:'players',
  INV:'inventories',
  COMP:'companions_user',
  TITLES:'titles_user',
  PARTIES:'parties',
  PARTY_MEM:'party_membership',
  PITY:'irp_gacha_pity',
  SHOPS:'shops',
  ECONOMY:'economy',
  LINK:'gacha_link_codes',
  CFG:'config',
};

const SI={strength:'⚔️',agility:'💨',speed:'🏃',intelligence:'🧠',mana:'✨',resistance:'🛡️',charisma:'👑',aura:'🌟'};
const SL={strength:'Force',agility:'Agilité',speed:'Vitesse',intelligence:'Intel.',mana:'Mana',resistance:'Rés.',charisma:'Charisme',aura:'Aura'};
const SK=['strength','agility','speed','intelligence','mana','resistance','charisma','aura'];
const PITY_T={epic:60,leg:180}; // IRP pity thresholds

// ── CACHE (via JCache) ──
function cacheInvalidate(key){JCache.invalidate(key,null);}
async function cachedGet(collection,docId,cacheKey,ttl){
  var cached=JCache.peek(cacheKey,null);
  if(cached!==null) return cached;
  var snap=await db.collection(collection).doc(docId).get();
  var data=snap.exists?snap.data():null;
  JCache.put(cacheKey,null,data,ttl);
  return data;
}
async function cachedCollection(collection,cacheKey,ttl){
  var cached=JCache.peek(cacheKey,null);
  if(cached!==null) return cached;
  var snap=await db.collection(collection).get();
  var docs=[];
  snap.forEach(function(d){docs.push({_key:d.id,...d.data()});});
  JCache.put(cacheKey,null,docs,ttl);
  return docs;
}

// ── SESSION ──
const SESSION_TTL=7*24*60*60*1000;
function getSess(){
  try{
    const raw=localStorage.getItem('hub_session')||localStorage.getItem('gacha_session');
    if(!raw)return null;
    const s=JSON.parse(raw);
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
    const codeRef=db.collection(C.LINK).doc(code);
    if(typeof window.d1LinkSignIn!=='function'){
      throw Object.assign(new Error('Système d’authentification non chargé (recharge la page)'),{_userMsg:true});
    }
    const _u=await window.d1LinkSignIn(code);
    setSess({id:_u.discord_id,username:_u.username,avatar:_u.avatar_url});
    await loadHub();
  }catch(e){
    const msg=e._userMsg?e.message:'Erreur de connexion — réessaye';
    showErr(msg);done();
  }
}

function logout(){
  clearSess();
  document.getElementById('hub-main').classList.remove('active');
  document.getElementById('main-nav').style.display='none';
  document.getElementById('login-gate').style.display='flex';
  showToast('Déconnecté','info');
}

// ── ACCESSIBILITY ──
const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;

// ── STATE (var pour hoisting — init() peut être appelé avant cette ligne) ──
var CHAR=null,PLAYER=null,PITY=null,INV_DATA=null,CHAR_ID=null,UID=null,ALL_ITEMS_DATA={};
var PARTY_DATA=null,TITLES_DATA=null,TITLES_DEF=null,BUFFS_DATA=null;
var COMP_USER=null,COMP_CFG=null;
var CURRENT_TAB='dashboard';

// ── IRP State ──
window._irpPlayer = null;
window._irpGachaPity = null;
window._irpBonds = [];
window._irpSeal = null;
window._irpSealTargets = [];
window._irpCourt = null;
window._irpFleshMarks = [];
window._irpCharNames = {};
window._irpBanners = null;

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
  lust_incarnate:{name:"Lust Incarnate",icon:"💜",emoji:"💜",slot:"special",type:"equipment",rarity:"signature",description:"L'incarnation même du désir. Ceux qui la portent deviennent irrésistibles — et irrémédiablement transformés."},
  kings_mantle:{name:"King's Mantle",icon:"👑",emoji:"👑",slot:"dos",type:"equipment",rarity:"signature",description:"Le manteau d'un roi. Toutes les stats du porteur sont multipliées par 1.2. Le roi gagne aussi +1 point de stat à allouer toutes les 24h."}
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
    }else if(id==='kings_mantle'){
      // Toutes les stats x1.2 (dynamique : +20% sur base + buffs courants)
      SIG_ALL_STATS.forEach(s=>{
        const total=base(s)+(parseInt((existingBuffs||{})[s]||0)||0);
        if(total>0)add(s,Math.round(total*0.20));
      });
    }
  }
  return b;
}

/* ── Pandemonium items (port from utils/pandemonium_items.py) ── */
const PANDEMONIUM_ITEMS_HC={
  pandemonium_scyth:{stats:["charisma","mana","intelligence","agility"]},
  pandemonium_double_dagger:{stats:["speed","agility","intelligence","mana"]},
  pandemonium_aegis:{stats:["resistance","strength","charisma","mana"]},
  pandemonium_double_revolvers:{stats:["agility","intelligence","charisma","mana"]},
  pandemonium_heavy_sword:{stats:["strength","agility","charisma","mana"]}
};
const PANDEMONIUM_SOLO=310;
const PANDEMONIUM_PARTY=540;

function calculatePandemoniumBonuses(equippedIds, partySynergy){
  const out={};
  const own=(equippedIds||[]).filter(i=>PANDEMONIUM_ITEMS_HC[i]);
  if(!own.length)return out;
  const per=partySynergy?PANDEMONIUM_PARTY:PANDEMONIUM_SOLO;
  for(const id of own){
    for(const s of PANDEMONIUM_ITEMS_HC[id].stats){
      out[s]=(out[s]||0)+per;
    }
  }
  return out;
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
function calculateSetBonuses(equippedIds, characterRace){
  const ALL=SIG_ALL_STATS;
  const result={stats:{},buffMult:{},buffMultAll:1.0,nerfReduction:0,special:null};
  const eqSet=new Set(equippedIds);
  const normRace=(characterRace||'').toString().trim().toLowerCase();
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
        if(bonus.race_bonus && normRace){
          const tgt=(bonus.race_bonus.race||'').toString().trim().toLowerCase();
          if(tgt && tgt===normRace){
            if(bonus.race_bonus.stats)for(const[s,v] of Object.entries(bonus.race_bonus.stats)){result.stats[s]=(result.stats[s]||0)+v;}
            if(bonus.race_bonus.stats_all)ALL.forEach(s=>{result.stats[s]=(result.stats[s]||0)+bonus.race_bonus.stats_all;});
          }
        }
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

// ══════════════════════════════════════════════════════════════════════
// IRP INVENTORY KEY RESOLUTION
// ══════════════════════════════════════════════════════════════════════
async function _resolveIRPInventoryKey(uid, irpCharId, irpCharData) {
  try {
    var linkSnap = await db.collection('irp_links').doc(String(uid)).get();
    if (linkSnap.exists) {
      var linkData = linkSnap.data() || {};
      if ((!linkData.irp_char_id || linkData.irp_char_id === String(irpCharId)) && linkData.main_char_id) {
        return String(uid) + '_' + String(linkData.main_char_id);
      }
    }
    var charData = irpCharData || {};
    var fallback = charData.linked_to || charData.synced_from || null;
    if (!fallback) {
      try {
        var charSnap = await db.collection('irp_characters').doc(String(irpCharId)).get();
        if (charSnap.exists) {
          var c = charSnap.data() || {};
          fallback = c.linked_to || c.synced_from || null;
        }
      } catch (_) {}
    }
    return String(uid) + '_' + String(fallback || irpCharId);
  } catch (e) {
    return String(uid) + '_' + String(irpCharId);
  }
}
window._resolveIRPInventoryKey = _resolveIRPInventoryKey;
window._getInventoryKey = function () {
  if (window._inventoryKeyResolved) return window._inventoryKeyResolved;
  return String(UID) + '_' + String(CHAR_ID);
};

// ══════════════════════════════════════════════════════════════════════
// INIT + LOAD
// ══════════════════════════════════════════════════════════════════════
async function init(){
  window._dbg?.log('[HUB-IRP] init() called, readyState:', document.readyState);
  const s=getSess();
  window._dbg?.log('[HUB-IRP] session:', s ? ('id='+s.id+' user='+s.username) : 'NULL');
  if(s&&s.id){
    try{ await loadHub(); }
    catch(err){ window._dbg?.error('[HUB-IRP] loadHub failed:',err); }
  } else {
    window._dbg?.log('[HUB-IRP] No session — showing login gate');
    document.getElementById('login-gate').style.display='flex';
  }
}

async function loadHub(){
  window._dbg?.log('[HUB-IRP] loadHub() start');
  const s=getSess();
  if(!s||!s.id){
    document.getElementById('login-gate').style.display='flex';
    return;
  }
  UID=s.id;
  window.UID=UID;
  var loginGate=document.getElementById('login-gate');
  var mainNav=document.getElementById('main-nav');
  var hubMain=document.getElementById('hub-main');
  window._dbg?.log('[HUB-IRP] DOM elements — gate:',!!loginGate,'nav:',!!mainNav,'hub:',!!hubMain);
  if(loginGate)loginGate.style.display='none';
  if(mainNav)mainNav.style.display='flex';
  if(hubMain)hubMain.classList.add('active');
  try{document.getElementById('nav-username').textContent=s.username||'—';}catch(_){}
  try{document.getElementById('menu-username').textContent=s.username||'—';}catch(_){}
  if(s.avatar){try{var av=document.getElementById('nav-avatar');if(av){av.src=s.avatar;av.style.display='block';}}catch(_){}}
  window._dbg?.log('[HUB-IRP] UI shown, loading data for UID:', UID);
  try{ await Promise.all([loadCharacter(),loadPlayer(),loadIRPData()]); }
  catch(err){ window._dbg?.error('[HUB-IRP] data load error:',err); }
  window._dbg?.log('[HUB-IRP] loadHub() complete — CHAR_ID:', CHAR_ID, 'CHAR:', !!CHAR);
}

async function loadCharacter(){
  window._dbg?.log('[HUB-IRP] loadCharacter() — C.ACTIVE:', C.ACTIVE, 'UID:', UID);
  try{
    const acData=await cachedGet(C.ACTIVE,UID,'_active_char',15);
    window._dbg?.log('[HUB-IRP] active_char data:', acData);
    if(!acData){renderNoChar();return}
    CHAR_ID=acData.character_id;
    window.CHAR_ID=CHAR_ID;
    if(!CHAR_ID){renderNoChar();return}
    window._dbg?.log('[HUB-IRP] loading char:', CHAR_ID, 'from', C.CHARS);
    const cData=await cachedGet(C.CHARS,CHAR_ID,'_character',30);
    window._dbg?.log('[HUB-IRP] char data:', cData ? 'OK ('+((cData.first_name||'')+' '+(cData.last_name||'')).trim()+')' : 'NULL');
    if(!cData){renderNoChar();return}
    CHAR={_id:CHAR_ID,...cData};
    window.CHAR=CHAR;
    const charKey=await _resolveIRPInventoryKey(UID, CHAR_ID, cData);
    window._inventoryKeyResolved = charKey;
    const[invData,cfgData,bufData,pmData]=await Promise.all([
      cachedGet(C.INV,charKey,'_inventory',15),
      cachedGet(C.CFG,'items','config/items',600),
      cachedGet('buffs',UID,'_buffs',30),
      cachedGet(C.PARTY_MEM,charKey,'_party_mem',60)
    ]);
    INV_DATA=invData||{items:{},equipped_assets:[]};
    if(cfgData){
      ALL_ITEMS_DATA={...cfgData.items||{},...cfgData.equipment||{},...cfgData.food_items||{},...cfgData.consumable_items||{}};
      for(const[sid,sdata] of Object.entries(SIGNATURE_ITEMS)){if(!ALL_ITEMS_DATA[sid])ALL_ITEMS_DATA[sid]=sdata;}
    }
    // Merge IRP items
    try{
      const irpCfgSnap=await db.collection('config').doc('irp_items').get();
      if(irpCfgSnap.exists){
        const irpItems=(irpCfgSnap.data()||{}).items||{};
        Object.entries(irpItems).forEach(([k,v])=>{if(!k.startsWith('__'))ALL_ITEMS_DATA[k]=v;});
      }
    }catch(_){}
    BUFFS_DATA=bufData?(bufData.buffs||[]):[];
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
      // Enrichit avec equipped_assets des autres membres (synergie Pandemonium)
      if(pData&&Array.isArray(pData.members)){
        try{
          const myKey=`${UID}_${CHAR_ID}`;
          const others=pData.members.filter(m=>m&&m.char_key&&m.char_key!==myKey);
          const fetched=await Promise.all(others.map(m=>cachedGet(C.INV,m.char_key,`_inv_${m.char_key}`,60).catch(()=>null)));
          others.forEach((m,i)=>{
            const inv=fetched[i];
            if(inv && Array.isArray(inv.equipped_assets)) m.equipped_assets=inv.equipped_assets;
          });
        }catch(_){}
      }
      PARTY_DATA=pData||null;
    }
    renderDashChar();
    _refreshCurrentTab();
  }catch(e){window._dbg?.error('[CHAR-IRP]',e);renderNoChar()}
}

async function loadPlayer(){
  try{
    // Load IRP player data for Jahartites
    const[pData,irpData,pityData]=await Promise.all([
      cachedGet(C.PLAYERS,UID,'_player',30),
      cachedGet('irp_players',UID,'_irp_player',30),
      cachedGet(C.PITY,UID,'_pity',30)
    ]);
    PLAYER=pData||{};
    window.PLAYER=PLAYER;
    window._irpPlayer=irpData||{jahartites:0,consecutive_days:0};
    window._irpGachaPity=pityData||{jahartites_spent_leg:0,jahartites_spent_myth:0};
    // Override navarites with jahartites for display
    PLAYER.navarites=window._irpPlayer.jahartites||0;
    PLAYER.consecutive_days=window._irpPlayer.consecutive_days||0;
    PITY=pityData||{};
    renderPlayerWidgets();
    _refreshCurrentTab();
  }catch(e){window._dbg?.error('[PLAYER-IRP]',e);}
}

// ── IRP DATA (bonds, seal, court, flesh marks) ──
async function loadIRPData() {
  if (!UID) return;
  try {
    // Wait for character to be loaded
    await new Promise(r => { let c=0; const iv=setInterval(()=>{if(CHAR_ID||++c>40){clearInterval(iv);r();}},100); });

    if (!CHAR_ID) return;

    var [bondsSnap, sealSnap, courtSnap, marksSnap] = await Promise.all([
      db.collection('irp_bonds').where('source_char_id','==',CHAR_ID).get(),
      db.collection('irp_seals').doc(CHAR_ID).get(),
      db.collection('irp_courts').doc(CHAR_ID).get(),
      db.collection('irp_flesh_marks').doc(CHAR_ID).get(),
    ]);

    window._irpBonds = [];
    bondsSnap.forEach(function(d){ window._irpBonds.push({_id:d.id,...d.data()}); });
    window._irpSeal = sealSnap.exists ? {_id:sealSnap.id,...sealSnap.data()} : null;
    window._irpCourt = courtSnap.exists ? {_id:courtSnap.id,...courtSnap.data()} : null;
    window._irpFleshMarks = marksSnap.exists ? (marksSnap.data().marks||[]) : [];

    // Seal targets
    if (window._irpSeal) {
      var tgtSnap = await db.collection('irp_seal_targets').where('owner_char_id','==',CHAR_ID).get();
      window._irpSealTargets = [];
      tgtSnap.forEach(function(d){ window._irpSealTargets.push({_id:d.id,...d.data()}); });
    }

    // Resolve character names
    window._irpCharNames = {};
    var allBondTargets = (window._irpBonds||[]).map(b=>b.target_char_id).filter(Boolean);
    var courtMembers = (window._irpCourt||{}).members||[];
    var allIds = [...new Set([...allBondTargets,...courtMembers])];
    for (var cid of allIds) {
      try {
        var snap = await db.collection('irp_characters').doc(cid).get();
        if (snap.exists) {
          var d = snap.data();
          window._irpCharNames[cid] = ((d.first_name||'')+ ' '+(d.last_name||'')).trim() || cid.substring(0,8);
        } else {
          var snap2 = await db.collection('characters').doc(cid).get();
          if (snap2.exists) {
            var d2 = snap2.data();
            window._irpCharNames[cid] = ((d2.first_name||'')+ ' '+(d2.last_name||'')).trim() || cid.substring(0,8);
          }
        }
      } catch(_) {}
    }

    _refreshCurrentTab();
  } catch(e) {
    window._dbg?.warn('[IRP DATA]', e.message);
  }
}

function _charName(cid) {
  return (window._irpCharNames||{})[cid] || (cid||'').substring(0,10)+'…';
}

// ══════════════════════════════════════════════════════════════════════
// LAZY LOADERS
// ══════════════════════════════════════════════════════════════════════
async function loadInventory(){
  const grid=document.getElementById('inv-grid');
  if(!CHAR_ID){grid.innerHTML='<div class="empty">Aucun personnage actif</div>';return}
  if(window.Skeleton) window.Skeleton.show('inv-grid',6);
  try{
    const key=window._getInventoryKey();
    const[invData,cfgData]=await Promise.all([
      cachedGet(C.INV,key,'_inventory',15),
      cachedGet(C.CFG,'items','config/items',600)
    ]);
    INV_DATA=invData||{items:{},equipped_assets:[]};
    if(cfgData) ALL_ITEMS_DATA={...cfgData.items||{},...cfgData.equipment||{},...cfgData.food_items||{},...cfgData.consumable_items||{}};
    for(const[sid,sdata] of Object.entries(SIGNATURE_ITEMS)){if(!ALL_ITEMS_DATA[sid])ALL_ITEMS_DATA[sid]=sdata;}
    try{
      const irpCfgSnap=await db.collection('config').doc('irp_items').get();
      if(irpCfgSnap.exists){
        const irpItems=(irpCfgSnap.data()||{}).items||{};
        Object.entries(irpItems).forEach(([k,v])=>{if(!k.startsWith('__'))ALL_ITEMS_DATA[k]=v;});
      }
    }catch(_){}
    if(window.Skeleton) window.Skeleton.hide('inv-grid');
    renderInventory();
  }catch(e){window._dbg?.error('[INV-IRP]',e);if(window.Skeleton) window.Skeleton.hide('inv-grid');grid.innerHTML='<div class="empty">Erreur de chargement</div>'}
}

async function loadParty(){
  var el=document.getElementById('party-content');
  if(el) el.innerHTML='<div class="empty">Non disponible en mode IRP</div>';
}
async function loadTitles(){
  const el=document.getElementById('titles-grid');if(!el)return;
  if(!UID){el.innerHTML='<div class="empty">Non connecté</div>';return;}
  el.innerHTML='<div class="empty">Chargement...</div>';
  try{
    const[tData,cfgData]=await Promise.all([
      cachedGet(C.TITLES,UID,'_titles',60),
      cachedGet(C.CFG,'titles_data','config/titles_data',600)
    ]);
    TITLES_DATA=tData||{};
    TITLES_DEF=cfgData?(cfgData.titles||cfgData||{}):{};
    renderTitles(TITLES_DATA,TITLES_DEF);
  }catch(e){el.innerHTML='<div class="empty">Erreur</div>'}
}
async function loadCompanions(){
  var el=document.getElementById('comp-content');
  if(el) el.innerHTML='<div class="empty">Non disponible en mode IRP</div>';
}
async function loadShop(){
  var el=document.getElementById('shop-content');
  if(el) el.innerHTML='<div class="empty">Non disponible en mode IRP</div>';
}

// ══════════════════════════════════════════════════════════════════════
// TABS — IRP-specific tabs natively defined
// ══════════════════════════════════════════════════════════════════════
const LAZY={
  personnage:()=>{if(CHAR && typeof renderFullChar==='function')renderFullChar();},
  inventaire:()=>{if(INV_DATA&&Object.keys(ALL_ITEMS_DATA).length){if(typeof renderInventory==='function')renderInventory();}else{loadInventory();}},
  gacha:()=>{ renderIRPGacha(); },
  liens:()=>{ renderIRPLiens(); },
  corruption:()=>{ renderIRPCorruption(); },
  seal:()=>{ renderIRPSeal(); },
  cour:()=>{ renderIRPCour(); },
  succes_irp:()=>{if(window._achRefresh)window._achRefresh();},
  ushop:()=>{if(typeof loadUshop==='function')loadUshop();},
  parametres:()=>{if(typeof renderSettings==='function')renderSettings();},
};

function showTab(id){
  if(CURRENT_TAB===id)return;
  CURRENT_TAB=id;
  const prevPanel=document.querySelector('.tab-panel.active');
  const panel=document.getElementById('panel-'+id);
  const btn=document.getElementById('tab-'+id);
  if(!panel){window._dbg?.warn('[TAB]','panel-'+id+' introuvable !');return;}
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const doSwitch=()=>{
    if(prevPanel&&prevPanel!==panel)prevPanel.classList.remove('active');
    panel.classList.add('active');
    if(!prefersReducedMotion){
      panel.style.animation='none';
      panel.offsetHeight;
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
    setTimeout(()=>{prevPanel.style.opacity='';prevPanel.style.transition='';doSwitch();},120);
  }else{
    doSwitch();
  }
}
function _refreshCurrentTab(){
  if(CURRENT_TAB==='dashboard')return;
  if(!LAZY[CURRENT_TAB])return;
  try{const r=LAZY[CURRENT_TAB]();if(r&&r.catch)r.catch(()=>{});}catch(_){}
}

// ══════════════════════════════════════════════════════════════════════
// IRP RENDERERS (Liens, Corruption, Seal, Cour, Gacha IRP)
// ══════════════════════════════════════════════════════════════════════
var GL={affection:'Affection',desire:'Désir',hostility:'Hostilité',ascendant:'Ascendant',fixation:'Fixation'};
var GC={affection:'#44BB77',desire:'#E91E8C',hostility:'#CC2222',ascendant:'#8A2E8D',fixation:'#3B3B98'};
var GS=['affection','desire','hostility','ascendant','fixation'];

function renderIRPLiens(){
  var c=document.getElementById('irp-liens-container');
  if(!c)return;
  var bonds=window._irpBonds||[];
  if(!bonds.length){c.innerHTML='<p style="color:var(--text2);text-align:center;padding:40px">Aucun lien. Utilise le bot IRP.</p>';return;}
  var h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">';
  bonds.forEach(function(b){
    var tn=_charName(b.target_char_id);
    h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px">';
    h+='<div style="font-family:var(--font-h);font-size:0.7rem;letter-spacing:0.08em;color:var(--text);margin-bottom:12px">→ '+tn+'</div>';
    GS.forEach(function(g){
      var v=b[g]||0;var pct=Math.min(100,v/10);
      var lk=(b.locks||{})[g]?' 🔒':'';
      h+='<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:0.55rem;color:var(--text2);margin-bottom:2px"><span>'+GL[g]+lk+'</span><span>'+v+'/1000</span></div>';
      h+='<div style="height:4px;background:var(--bg2);border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+GC[g]+';border-radius:2px;transition:width .3s"></div></div></div>';
    });
    if((b.corruption||0)>0) h+='<div style="margin-top:4px;font-size:0.5rem;color:#8B008B">☠️ Corruption: '+b.corruption+'</div>';
    h+='</div>';
  });
  h+='</div>';
  c.innerHTML=h;
}

function renderIRPCorruption(){
  var c=document.getElementById('irp-corruption-container');if(!c)return;
  var bonds=window._irpBonds||[];var maxCorr=0;
  bonds.forEach(function(b){maxCorr=Math.max(maxCorr,b.corruption||0);});
  var pct=Math.min(100,maxCorr/10);
  var TRAITS=[{t:200,n:'Impitoyable',c:'#cc5555'},{t:400,n:'Cruel',c:'#aa2222'},{t:600,n:'Obsédé par le contrôle',c:'#8B008B'},{t:800,n:'Dépravé',c:'#4B0000'}];
  var h='<div style="max-width:600px;margin:24px auto;padding:24px">';
  h+='<div style="text-align:center;margin-bottom:24px"><div style="font-family:var(--font-h);font-size:1.2rem;color:#dc143c;letter-spacing:0.15em;margin-bottom:8px">☠️ CORRUPTION</div>';
  h+='<div style="font-family:var(--font-m);font-size:2rem;color:var(--text)">'+maxCorr+' / 1000</div></div>';
  h+='<div style="height:12px;background:var(--bg2);border-radius:6px;overflow:hidden;margin-bottom:24px;border:1px solid rgba(220,20,60,0.15)"><div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,#8B008B,#dc143c);border-radius:6px"></div></div>';
  TRAITS.forEach(function(t){
    var on=maxCorr>=t.t;
    h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);opacity:'+(on?'1':'.3')+'"><span style="color:'+t.c+';font-size:1rem">'+(on?'◆':'◇')+'</span><span style="font-family:var(--font-b);font-size:.85rem;color:var(--text)">'+t.n+'</span><span style="margin-left:auto;font-family:var(--font-m);font-size:.65rem;color:var(--text3)">'+t.t+'+</span></div>';
  });
  h+='</div>';
  c.innerHTML=h;
}

function renderIRPSeal(){
  var c=document.getElementById('irp-seal-container');if(!c)return;
  var seal=window._irpSeal;var targets=window._irpSealTargets||[];var marks=window._irpFleshMarks||[];
  var level=(window.CHAR||{}).level||0;
  var h='<div style="max-width:700px;margin:24px auto;padding:16px">';
  if(level<50){
    h+='<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:2rem;margin-bottom:12px">👁️</div><div style="font-family:var(--font-h);font-size:.8rem;letter-spacing:.12em">SEAL OF DOMINION</div><div style="font-family:var(--font-m);font-size:.7rem;margin-top:8px">Niveau 50 requis · Actuellement niveau '+level+'</div></div>';
  }else if(!seal){
    h+='<div style="text-align:center;padding:40px"><div style="font-size:2rem;margin-bottom:12px">👁️</div><div style="font-family:var(--font-h);font-size:.8rem;color:#dc143c;letter-spacing:.12em">SEAL OF DOMINION</div><div style="font-family:var(--font-m);font-size:.7rem;color:var(--text2);margin-top:8px">Aucun sceau créé. Utilise le bot IRP.</div></div>';
  }else{
    h+='<div style="text-align:center;margin-bottom:24px"><div style="font-family:var(--font-h);font-size:1rem;color:#dc143c;letter-spacing:.12em">👁️ '+(seal.name||'Sceau')+'</div>';
    if(seal.description) h+='<div style="font-family:var(--font-body);font-size:.7rem;color:var(--text2);margin-top:4px;font-style:italic">'+seal.description+'</div>';
    h+='</div>';
    if(targets.length>0){
      h+='<div style="font-family:var(--font-b);font-size:.75rem;color:var(--text);margin-bottom:12px;letter-spacing:.08em">CIBLES MARQUÉES</div>';
      targets.forEach(function(t){
        var se={active:'🟢',inactive:'🟡',revoked:'🔴'}[t.state]||'⚪';
        h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><span>'+se+'</span><div style="flex:1"><div style="font-family:var(--font-b);font-size:.75rem;color:var(--text)">'+_charName(t.target_char_id)+'</div><div style="font-size:.6rem;color:var(--text3)">'+(t.state||'?')+'</div></div></div>';
      });
    }
  }
  if(marks.length>0){
    h+='<div style="margin-top:24px;font-family:var(--font-b);font-size:.75rem;color:#dc143c;margin-bottom:12px;letter-spacing:.08em">🔥 MARQUES SUR MOI</div>';
    marks.forEach(function(m){
      h+='<div style="background:rgba(220,20,60,0.06);border:1px solid rgba(220,20,60,0.15);border-radius:8px;padding:10px;margin-bottom:6px"><span style="font-family:var(--font-b);color:var(--text);font-size:.7rem">🔥 '+(m.name||'?')+'</span><span style="color:var(--text3);font-size:.6rem;margin-left:8px">'+(m.location||'')+' — par '+(m.owner_name||'?')+'</span></div>';
    });
  }
  h+='</div>';
  c.innerHTML=h;
}

function renderIRPCour(){
  var c=document.getElementById('irp-cour-container');if(!c)return;
  var court=window._irpCourt;
  var h='<div style="max-width:600px;margin:24px auto;padding:16px">';
  if(!court){
    h+='<div style="text-align:center;padding:40px;color:var(--text3)"><div style="font-size:2rem;margin-bottom:12px">👑</div><div style="font-family:var(--font-h);font-size:.8rem;letter-spacing:.12em">COUR</div><div style="font-family:var(--font-m);font-size:.7rem;margin-top:8px">Aucune cour. Ascendant ≥ 700 sur 3+ cibles requis.</div></div>';
  }else{
    h+='<div style="text-align:center;margin-bottom:24px"><div style="font-family:var(--font-h);font-size:1rem;color:#dc143c;letter-spacing:.12em">👑 '+(court.name||'Cour')+'</div></div>';
    (court.members||[]).forEach(function(mcid,i){
      var rank=['🥇','🥈','🥉'][i]||'#'+(i+1);
      var title=(court.titles||{})[mcid]||'';
      h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><span style="font-size:1.2rem">'+rank+'</span><div style="flex:1"><div style="font-family:var(--font-b);font-size:.75rem;color:var(--text)">'+_charName(mcid)+(title?' — '+title:'')+'</div></div></div>';
    });
  }
  h+='</div>';
  c.innerHTML=h;
}

async function renderIRPGacha(){
  var panel=document.getElementById('panel-gacha');if(!panel)return;
  var jah=(window._irpPlayer||{}).jahartites||0;
  // Load IRP banners
  if(!window._irpBanners){
    try{
      var snap=await db.collection('irp_gacha_banners').get();
      window._irpBanners=[];
      snap.forEach(function(d){var data=d.data();if(data.active!==false)window._irpBanners.push({_id:d.id,...data});});
    }catch(_){window._irpBanners=[];}
  }
  var banners=window._irpBanners||[];
  var h='';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;padding:16px;background:var(--surface);border:1px solid rgba(220,20,60,0.15);border-radius:12px;flex-wrap:wrap">';
  h+='<div style="display:flex;align-items:center;gap:12px"><div style="font-family:var(--font-h);font-size:1.4rem;color:var(--text)">'+jah.toLocaleString()+'</div>';
  h+='<div style="font-family:var(--font-m);font-size:0.55rem;color:var(--text3);letter-spacing:0.08em">JAHARTITES</div></div>';
  h+='<a href="gacha-irp.html" style="padding:10px 14px;border-radius:10px;border:1px solid rgba(220,20,60,.25);background:linear-gradient(135deg,rgba(220,20,60,.18),rgba(139,0,0,.18));color:#fff;font-family:var(--font-h);font-size:.55rem;letter-spacing:.1em;cursor:pointer;text-decoration:none">OUVRIR LE GACHA IRP</a>';
  h+='</div>';
  if(!banners.length){
    h+='<div style="text-align:center;padding:60px 20px"><div style="font-size:2.5rem;margin-bottom:16px;opacity:0.3">🎰</div><div style="font-family:var(--font-h);font-size:0.8rem;color:var(--text3);letter-spacing:0.12em">AUCUNE BANNIÈRE IRP ACTIVE</div></div>';
  }else{
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';
    banners.forEach(function(b){
      var name=b.name||'Bannière IRP';var img=b.image_url||b.image||'';
      h+='<div style="background:var(--surface);border:1px solid rgba(220,20,60,0.2);border-radius:12px;overflow:hidden">';
      if(img) h+='<div style="height:140px;background:url('+img+') center/cover;border-bottom:1px solid rgba(220,20,60,0.15)"></div>';
      else h+='<div style="height:140px;background:linear-gradient(135deg,rgba(220,20,60,.08),rgba(139,0,0,.04));display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:0.3">🎰</div>';
      h+='<div style="padding:16px"><div style="font-family:var(--font-h);font-size:0.75rem;color:var(--text);letter-spacing:0.06em">'+name+'</div>';
      if(b.description) h+='<div style="font-family:var(--font-m);font-size:0.55rem;color:var(--text3);margin-top:4px">'+b.description+'</div>';
      h+='</div></div>';
    });
    h+='</div>';
  }
  // Pity
  var pity=window._irpGachaPity||{};
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:24px">';
  h+='<div style="padding:14px;border:1px solid rgba(220,20,60,.15);border-radius:12px;background:var(--surface)"><div style="font-family:var(--font-m);font-size:.5rem;color:var(--text3);letter-spacing:.08em">PITY LEG+</div><div style="font-family:var(--font-h);font-size:1rem;color:var(--text);margin-top:6px">'+Math.floor(pity.jahartites_spent_leg||0)+' / 60</div></div>';
  h+='<div style="padding:14px;border:1px solid rgba(220,20,60,.15);border-radius:12px;background:var(--surface)"><div style="font-family:var(--font-m);font-size:.5rem;color:var(--text3);letter-spacing:.08em">PITY MYTH+</div><div style="font-family:var(--font-h);font-size:1rem;color:var(--text);margin-top:6px">'+Math.floor(pity.jahartites_spent_myth||0)+' / 180</div></div>';
  h+='<div style="padding:14px;border:1px solid rgba(220,20,60,.15);border-radius:12px;background:var(--surface)"><div style="font-family:var(--font-m);font-size:.5rem;color:var(--text3);letter-spacing:.08em">STREAK</div><div style="font-family:var(--font-h);font-size:1rem;color:var(--text);margin-top:6px">'+(((window._irpPlayer||{}).consecutive_days)||0)+' jour(s)</div></div>';
  h+='</div>';
  var sh=panel.querySelector('.sh');
  var shHTML=sh?sh.outerHTML:'<div class="sh"><span class="sh-num">04</span><span class="sh-title">Gacha IRP</span><div class="sh-line"></div></div>';
  panel.innerHTML=shHTML+'<div style="padding:0 4px">'+h+'</div>';
}

// ── UTILS ──
function totalXpForLevel(lvl){const n=Math.max(0,Math.floor(lvl)-1);return 500*(n*(n+1)/2);}
function xpForNextLevel(lvl){return 500*Math.max(1,Math.floor(lvl));}
function levelFromXp(totalXp){let xp=Math.max(0,totalXp),level=1;while(level<500){const need=xpForNextLevel(level);if(xp<need)return{level,cur:xp,need};xp-=need;level++;}return{level:500,cur:0,need:0};}
function lvlXP(lvl){return totalXpForLevel(lvl);}
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

// Scroll line
window.addEventListener('scroll',()=>{const max=document.body.scrollHeight-window.innerHeight;const el=document.getElementById('scroll-line');if(el)el.style.width=(max>0?(window.scrollY/max*100):0)+'%';});

// ── Jahartite balance injection (appelé après loadPlayer + re-render dashboard) ──
function _irpInjectJahartiteBalance(){
  if(!window._irpPlayer)return;
  var jah=window._irpPlayer.jahartites||0;
  ['.wi-navarite .wi-val','.wallet-item:first-child .wi-val','#dash-nav-val span:first-child'].forEach(function(sel){
    var el=document.querySelector(sel);if(el&&!isNaN(jah))el.textContent=jah.toLocaleString();
  });
  var unit=document.querySelector('#dash-nav-val .nav-unit');
  if(unit&&unit.textContent==='NAV')unit.textContent='JAH';
}
window._irpInjectJahartiteBalance=_irpInjectJahartiteBalance;

// ══════════════════════════════════════════════════════════════════════
// BOOT — must be at the very end so all const/let/var are initialized
// ══════════════════════════════════════════════════════════════════════
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){
    const lc=document.getElementById('link-code');
    const vb=document.getElementById('verify-btn');
    if(lc)lc.addEventListener('keydown',e=>{if(e.key==='Enter')verifyCode();});
    if(vb)vb.addEventListener('click',verifyCode);
    init();
  });
}else{
  // DOMContentLoaded already fired — run immediately
  const lc=document.getElementById('link-code');
  const vb=document.getElementById('verify-btn');
  if(lc)lc.addEventListener('keydown',e=>{if(e.key==='Enter')verifyCode();});
  if(vb)vb.addEventListener('click',verifyCode);
  init();

}

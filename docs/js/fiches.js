/* ── Firebase ── */
import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getFirestore,initializeFirestore,persistentLocalCache,collection,addDoc,onSnapshot,doc,getDoc,getDocs,updateDoc,deleteDoc,serverTimestamp,query,where}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import{getAuth,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import{getStorage,ref,uploadBytes,getDownloadURL}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const cfg={apiKey:"AIzaSyCqv3yxMVWsLSsOstpkkkTFg0Qg4H2xBcA",authDomain:"jahartarp.firebaseapp.com",projectId:"jahartarp",storageBucket:"jahartarp.firebasestorage.app",messagingSenderId:"834848086593",appId:"1:834848086593:web:c5cddc894f04feb61cc4c0"};
const app=getApps().length?getApps()[0]:initializeApp(cfg);
let db;try{db=initializeFirestore(app,{localCache:persistentLocalCache()});}catch(e){db=getFirestore(app);}
const auth=getAuth(app);
const storage=getStorage(app);

/* Expose Firebase utils for admin functions */
window._db=db;window._storage=storage;
window._doc=doc;window._getDoc=getDoc;window._updateDoc=updateDoc;
window._deleteDoc=deleteDoc;window._addDoc=addDoc;window._collection=collection;
window._serverTimestamp=serverTimestamp;
window._ref=ref;window._uploadBytes=uploadBytes;window._getDownloadURL=getDownloadURL;
window._isAdmin=false;

onAuthStateChanged(auth,async user=>{
  /* Vérification whitelist — _isAdmin = true seulement si l'UID est dans admins/{uid} */
  let isAdmin=false;
  if(user){
    try{
      const snap=await getDoc(doc(db,'admins',user.uid));
      isAdmin=snap.exists();
    }catch{isAdmin=false;}
  }
  window._isAdmin=isAdmin;
  document.querySelectorAll('.card-admin-row').forEach(el=>el.style.display=isAdmin?'flex':'none');
  const btn=document.getElementById('add-char-btn');
  if(btn)btn.style.display=isAdmin?'inline-flex':'none';
});

/* ── Constants ── */
const HIGH_RANKS=['S','SS','SSS','X','T','G','G+','Z'];
const GOLD_RANKS=['A','S','SS','SSS','X'];   /* reflet doré */
const PRISM_RANKS=['T','G','G+','Z'];         /* reflet prismatique */
const RARITY_COLORS={Common:'#8a8fa8',Uncommon:'#44ff88',Rare:'#4DA3FF',Epic:'#8B5CF6',Legendary:'#ffd60a',Mythic:'#ff8800',Unique:'#00ffcc',Artifact:'#ff006e',Mastercraft:'#ffffff'};
const STATS=[{k:'str',l:'STR',c:'sb-str'},{k:'agi',l:'AGI',c:'sb-agi'},{k:'spd',l:'SPD',c:'sb-spd'},{k:'int',l:'INT',c:'sb-int'},{k:'mana',l:'MNA',c:'sb-mana'},{k:'res',l:'RES',c:'sb-res'},{k:'cha',l:'CHA',c:'sb-cha'},{k:'aura',l:'AUR',c:'sb-aura'}];

/* ── Mapping short → long stat keys ── */
const SMAP={str:'strength',agi:'agility',spd:'speed',int:'intelligence',mana:'mana',res:'resistance',cha:'charisma',aura:'aura'};

/* ── Signature Items (port from signature_items.py) ── */
const SIGNATURE_ITEMS_F={
  cyclo_arcana:{name:"Cyclo-Arcana"},fake_twins:{name:"Fake Twins"},kings_jewel:{name:"King's Jewel"},
  real_twins:{name:"Real Twins"},diademe_du_nexus:{name:"Diadème du Nexus"},faux_modele_0:{name:"Faux, Modèle 0"},
  epee_de_damocles:{name:"Épée de Damoclès"},blitz_runners:{name:"Blitz Runners"},
  survivai_kit:{name:"Survivai Kit"},riviere_dopalines:{name:"Rivière d'Opalines"},
  faux_ongles_tisserand:{name:"Faux-Ongles du Tisserand"},
  cape_sombre_xiii:{name:"Cape Sombre, Modèle XIII"},
  lame_sang_sushel:{name:"Lame-Sang de Sushel"}
};
const SIG_ALL=["strength","agility","speed","intelligence","mana","resistance","charisma"];
function calcSigBonuses(eqIds,cs,aura,eb){
  const b={};
  function a(s,v){b[s]=(b[s]||0)+Math.floor(v);}
  function bs(s){return parseInt((cs||{})[s]||0)||0;}
  for(const id of eqIds.filter(i=>SIGNATURE_ITEMS_F[i])){
    if(id==='cyclo_arcana'){a('speed',(bs('speed')+(eb.speed||0))*0.5);}
    else if(id==='fake_twins'){a('agility',20);a('charisma',50);if(aura){SIG_ALL.forEach(s=>a(s,50));a('aura',100);}}
    else if(id==='kings_jewel'){a('mana',50);if(aura)a('mana',50);}
    else if(id==='real_twins'){Object.entries(eb).forEach(([s,v])=>{if(v>0)a(s,v*0.75);});}
    else if(id==='diademe_du_nexus'){a('agility',50);a('intelligence',50);if(bs('mana')>300)a('mana',100);}
    else if(id==='faux_modele_0'){a('intelligence',75);if(bs('mana')>300)a('mana',100);}
    else if(id==='epee_de_damocles'){a('agility',50);}
    else if(id==='blitz_runners'){a('agility',75);a('speed',75);a('mana',75);}
    else if(id==='survivai_kit'){
      if(cs){const h=SIG_ALL.reduce((x,s)=>bs(s)>bs(x)?s:x,SIG_ALL[0]);SIG_ALL.forEach(s=>a(s,s===h?75:50));}
      if(bs('agility')>600)Object.entries(eb).forEach(([s,v])=>{if(v>0)a(s,v*0.5);});
    }
    else if(id==='riviere_dopalines'){SIG_ALL.forEach(s=>a(s,50));if(bs('mana')>300){SIG_ALL.forEach(s=>a(s,25));a('mana',100);}}
    else if(id==='faux_ongles_tisserand'){a('mana',150);if(bs('mana')>700)SIG_ALL.forEach(s=>a(s,150));}
    else if(id==='cape_sombre_xiii'){a('resistance',45);}
    else if(id==='lame_sang_sushel'){SIG_ALL.forEach(s=>a(s,65));}
  }
  return b;
}

/* ── Bonus data cache (loaded once) ── */
let _bonusDataLoaded=false;
let _allItemsDef={};   // config/items → merged items/equipment/food/consumable
let _allInvs={};       // inventories/{discordId_charId} → {items,equipped_assets}
let _allActives={};    // active_characters/{discordId} → {character_id}
let _allBuffs={};      // buffs/{discordId} → {buffs:[]}
let _allCompUsers={};  // companions_user/{discordId_charId} → {owned_companions,active_companion}
let _compCfg={companions:{},evolutions:{}};
let _itemSets={};

async function loadBonusData(){
  if(_bonusDataLoaded)return;
  _bonusDataLoaded=true;
  try{
    const [itemsCfgSnap,activesSnap,invsSnap,buffsSnap,compUsersSnap,compCfgSnap,setsCfgSnap]=await Promise.all([
      getDoc(doc(db,'config','items')),
      getDocs(collection(db,'active_characters')),
      getDocs(collection(db,'inventories')),
      getDocs(collection(db,'buffs')),
      getDocs(collection(db,'companions_user')),
      getDoc(doc(db,'config','companions_data')),
      getDoc(doc(db,'config','item_sets'))
    ]);
    if(itemsCfgSnap.exists()){
      const d=itemsCfgSnap.data();
      _allItemsDef={...d.items||{},...d.equipment||{},...d.food_items||{},...d.consumable_items||{}};
      // Merge signature items (defined in code, not in Firestore config)
      for(const[sid,sdata] of Object.entries(SIGNATURE_ITEMS_F)){if(!_allItemsDef[sid])_allItemsDef[sid]={...sdata,type:'equipment',rarity:'signature'};}
    }
    activesSnap.forEach(d=>{_allActives[d.id]=d.data();});
    invsSnap.forEach(d=>{_allInvs[d.id]=d.data();});
    buffsSnap.forEach(d=>{_allBuffs[d.id]=d.data();});
    compUsersSnap.forEach(d=>{_allCompUsers[d.id]=d.data();});
    if(compCfgSnap.exists())_compCfg=compCfgSnap.data();
    if(setsCfgSnap.exists())_itemSets=setsCfgSnap.data();
  }catch(err){window._dbg?.warn('[Fiches] bonus data load:',err.message);}
}

/* ── Companion sync_power → flat stat bonuses map ── */
function _ficheSyncPowerBonuses(power){
  const p=(power||'').toLowerCase().trim();
  const ALL=['strength','agility','speed','intelligence','mana','resistance','charisma'];
  const MAP={
    'royalty presence':{charisma:100},
    "hunter's dominion":{agility:100},
    'lost knowledge':{intelligence:100},
    'old tenacity':{resistance:200},
    'thunderclap':Object.fromEntries(ALL.map(s=>[s,20])),
    'thunder strikes twice':Object.fromEntries(ALL.map(s=>[s,30])),
    'challenger':Object.fromEntries(ALL.map(s=>[s,55])),
    'killer instinct':{strength:25,resistance:25,mana:25},
    'unextinguishable':{strength:150,resistance:150,mana:150},
    'strategist':{agility:25,intelligence:25,mana:25},
    'unfathomable':{agility:150,intelligence:150,mana:150},
    'assassin':{agility:45,intelligence:45,mana:45},
    'unavoidable':{agility:200,intelligence:200,mana:200},
    'sturdy':{strength:23,resistance:23,agility:23,charisma:23},
    'unchained':{strength:130,resistance:130,agility:130,charisma:130},
    'blessing':Object.fromEntries(ALL.map(s=>[s,23])),
    'the one':Object.fromEntries(ALL.map(s=>[s,300])),
    'curse':{strength:46,intelligence:46,agility:46,charisma:46,speed:-23,mana:-23,resistance:-23},
    'the last':Object.fromEntries(ALL.map(s=>[s,300])),
  };
  return MAP[p]||{};
}

/* ── Compute total bonuses for a character ── */
function computeCharBonuses(charId,charStats){
  // Find discord_id for this char
  let discordId=null;
  for(const[did,ad] of Object.entries(_allActives)){
    if(ad.character_id===charId){discordId=did;break;}
  }
  if(!discordId)return {};
  const key=discordId+'_'+charId;
  const inv=_allInvs[key]||{};
  const eqList=inv.equipped_assets||[];
  const bufData=_allBuffs[discordId]||{};
  const compUser=_allCompUsers[key]||{};
  const bonuses={};
  function add(s,v){v=parseInt(v)||0;if(v)bonuses[s]=(bonuses[s]||0)+v;}

  // 1) Equipment stats (skip signature + equalizer)
  eqList.forEach(id=>{
    const it=_allItemsDef[id]||{};
    if((it.rarity||'').toLowerCase()==='signature')return;
    if(id==='equalizer')return;
    Object.entries(it.stat_effects||it.stats||{}).forEach(([s,v])=>{
      try{add(s,parseInt(String(v).replace('+','')));}catch(_){}
    });
  });
  // 2) Sets — highest threshold only (mirrors bot)
  const sets=_itemSets&&Object.keys(_itemSets).length?_itemSets:(window._ITEM_SETS_FALLBACK||{});
  const eqSet=new Set(eqList);
  const SK8=['strength','agility','speed','intelligence','mana','resistance','charisma'];
  let _ficheSetSpecial=null;
  const _ficheSetBuffMult={};
  let _ficheSetBuffMultAll=1;
  Object.values(sets).forEach(sd=>{
    if(!sd||!sd.items||!sd.bonuses)return;
    const cnt=sd.items.filter(i=>eqSet.has(i)).length;
    if(cnt<2)return;
    const thresholds=Object.keys(sd.bonuses).map(Number).sort((a,b)=>b-a); // descending
    for(const t of thresholds){
      if(cnt>=t){
        const b=sd.bonuses[String(t)]||sd.bonuses[t]||{};
        if(b.stats)Object.entries(b.stats).forEach(([s,v])=>add(s,v));
        if(b.stats_all)SK8.forEach(s=>add(s,b.stats_all));
        if(b.buff_mult)Object.entries(b.buff_mult).forEach(([s,m])=>{_ficheSetBuffMult[s]=Math.max(_ficheSetBuffMult[s]||1,m);});
        if(b.buff_mult_all)_ficheSetBuffMultAll=Math.max(_ficheSetBuffMultAll,b.buff_mult_all);
        if(b.special)_ficheSetSpecial=b.special;
        break; // only highest threshold per set
      }
    }
  });
  // 3) Buffs
  (bufData.buffs||[]).forEach(b=>{
    if(b.effects)Object.entries(b.effects).forEach(([s,v])=>add(s,v));
  });
  // 4) Companion (active + synchronized)
  const owned=compUser.owned_companions||{};
  const activeComp=compUser.active_companion;
  let _compBuffMult={};
  if(activeComp&&owned[activeComp]){
    const cd=owned[activeComp];
    if(cd.synchronized){
      const form=cd.current_form||activeComp;
      const allC=_compCfg.companions||{};
      const allE=_compCfg.evolutions||{};
      const info=allE[form]||allC[form]||allC[activeComp]||{};
      const baseE=allC[activeComp]||{};
      const sync=info.sync_bonuses||baseE.sync_bonuses||{};
      Object.entries(sync).forEach(([s,v])=>add(s,v));
      // Sync power flat bonuses
      const spB=_ficheSyncPowerBonuses(info.sync_power||baseE.sync_power||'');
      Object.entries(spB).forEach(([s,v])=>add(s,v));
      // buff_mult
      _compBuffMult=info.buff_mult||{};
    }
  }
  // 5) Signature items
  const aura=parseInt(charStats.aura||0)>0;
  const existBuf={...bonuses};
  const sigB=calcSigBonuses(eqList,charStats,aura,existBuf);
  Object.entries(sigB).forEach(([s,v])=>add(s,v));

  // 6) Mythic+ effects
  const _ficheBS=s=>parseInt((charStats||{})[s]||0)||0;
  const _ficheMythicBuffMult={};
  let _ficheMythicNerfRed=0;
  const MYTHIC_FX={
    diademe_eveil_primordial:{buff_mult:{mana:1.5}},heaume_jugement_final:{pct_base:{resistance:0.15}},
    manteau_neant_absolu:{nerf_reduction:0.30},anneau_apocalypse:{buff_mult:{strength:1.5}},
    bague_eternel_retour:{pct_base:{speed:0.20}},
    anneau_unique_systeme:{conditional:()=>_ficheBS('mana')>500?{mana:100}:{}},
    poignes_destructeur_code:{buff_mult:{strength:2.0}},
    bracelets_horizon_evenements:{conditional:()=>_ficheBS('speed')>300?{speed:50}:{}},
    bottes_transcendance:{buff_mult:{speed:1.5}},manteau_gravite_zero:{buff_mult:{agility:1.5}},
    coeur_supernova:{buff_mult:{mana:2.0}},
    excalibur_neon:{buff_mult:{strength:1.5},pct_base:{charisma:0.05}},
    auroras_mythril_hammer:{conditional:()=>_ficheBS('strength')>400?{strength:50}:{}},
    dagues_fin_temps:{buff_mult:{agility:1.5}},
    pistolet_singularite:{conditional:()=>_ficheBS('intelligence')>300?{mana:50}:{}},
    ia_conscience_gaia:{nerf_reduction:0.20},
    original_fragment_core_nexus:{conditional:()=>['fragment_of_reality','birth_of_the_imaginary','ia_conscience_gaia'].some(i=>eqSet.has(i))?{mana:100}:{}},
    ethereal_halo:{buff_mult:{intelligence:1.5,mana:1.25}},quantum_mirror_coat:{nerf_reduction:0.40},
    time_paradox_ring:{pct_base_all:0.10},
    silver_ring_nexus:{conditional:()=>_ficheBS('agility')>400?{agility:50}:{}},
    silver_tear_nexus:{conditional:()=>({mana:100})},
    wings_principle_speed:{buff_mult:{speed:2.0}},kang_soos_great_sword:{buff_mult:{strength:2.0}},
    dagger_principle_reality:{buff_mult:{agility:1.75}},
    destinys_cuffs:{conditional:()=>_ficheBS('resistance')>_ficheBS('strength')?{strength:Math.floor(_ficheBS('strength')*0.5)}:{}},
    omega_nexus:{pct_base_all:0.15},
    invisi_gloves:{conditional:()=>_ficheBS('charisma')>300?{agility:75}:{}},
    old_chaos_mask:{buff_mult:{intelligence:2.0}},
    forgotten_kings_crown:{conditional:()=>_ficheBS('charisma')>500?{charisma:100}:{}},
    origins_chestplate:{nerf_reduction:0.50},old_chaos_ring:{buff_mult:{strength:2.0}},
    origins_ring:{buff_mult:{mana:2.0}},destinys_gauntelet:{buff_mult:{agility:2.0}},
    destinys_chains:{conditional:()=>_ficheBS('speed')>500?{speed:100}:{}},
    stars_devourer:{conditional:()=>_ficheBS('mana')>300?{strength:100}:{}},
    the_betrayer:{conditional:()=>_ficheBS('strength')<_ficheBS('agility')?{agility:100}:{}},
    inertia_bracelets:{buff_mult:{resistance:2.0}},lost_entitys_core:{pct_base_all:0.15},
    balduns_crown:{buff_mult:{intelligence:3.0}},balduns_chivalery:{buff_mult:{agility:3.0}},
    balduns_gauntelet:{buff_mult:{charisma:3.0}},balduns_chains:{pct_base_all:0.25},
    balduns_cape:{conditional:()=>eqSet.has('balduns_chestplate')?{resistance:600}:{}},
    balduns_executionner:{buff_mult:{strength:3.0}},balduns_claws:{buff_mult:{strength:3.0}},
    balduns_bracelet:{buff_mult:{mana:3.0}},balduns_god_shoes:{buff_mult:{speed:3.0}},
    balduns_ring:{conditional:()=>{if(!aura)return {};const r={};SK8.forEach(s=>{r[s]=_ficheBS(s)*2;});return r;}},
  };
  for(const id of eqList){
    const fx=MYTHIC_FX[id];if(!fx)continue;
    if(fx.buff_mult)Object.entries(fx.buff_mult).forEach(([s,m])=>{_ficheMythicBuffMult[s]=Math.max(_ficheMythicBuffMult[s]||1,m);});
    if(fx.pct_base)Object.entries(fx.pct_base).forEach(([s,pct])=>{add(s,Math.floor(_ficheBS(s)*pct));});
    if(fx.pct_base_all)SK8.forEach(s=>{add(s,Math.floor(_ficheBS(s)*fx.pct_base_all));});
    if(fx.conditional){try{const cb=fx.conditional();if(cb)Object.entries(cb).forEach(([s,v])=>{add(s,Math.floor(v));});}catch(_){}}
    if(fx.nerf_reduction)_ficheMythicNerfRed=Math.max(_ficheMythicNerfRed,fx.nerf_reduction);
  }

  // 7) Apply buff multipliers (set + item, take max per stat)
  const finalMult={};
  for(const s of new Set([...Object.keys(_ficheMythicBuffMult),...Object.keys(_ficheSetBuffMult)])){
    finalMult[s]=Math.max(_ficheMythicBuffMult[s]||1,_ficheSetBuffMult[s]||1);
  }
  if(_ficheSetBuffMultAll>1)SK8.forEach(s=>{if(!finalMult[s]||finalMult[s]<_ficheSetBuffMultAll)finalMult[s]=_ficheSetBuffMultAll;});
  Object.entries(finalMult).forEach(([s,mult])=>{
    if(mult>1&&(bonuses[s]||0)>0)bonuses[s]=Math.floor(bonuses[s]*mult);
  });

  // 8) Equalizer
  if(eqSet.has('equalizer')&&charStats){
    const baseVals=SK8.map(s=>_ficheBS(s)).sort((a,b)=>b-a);
    let target;
    if(_ficheSetSpecial==='equalize_to_highest_plus_10pct')target=Math.floor(baseVals[0]*1.10);
    else if(_ficheSetSpecial==='equalize_to_highest')target=baseVals[0];
    else target=baseVals.length>=4?Math.floor(baseVals.slice(0,4).reduce((a,b)=>a+b,0)/4):Math.floor(baseVals.reduce((a,b)=>a+b,0)/Math.max(1,baseVals.length));
    SK8.forEach(s=>{
      const current=_ficheBS(s)+(bonuses[s]||0);
      if(current<target)bonuses[s]=(bonuses[s]||0)+(target-current);
    });
  }

  return {bonuses, buff_mult:_compBuffMult};
}

/* ── Rank from level (mirrors bot stats_common.py) ── */
function rankFromLevel(lvl){
  lvl=parseInt(lvl)||0;
  if(lvl>=450)return'Z';if(lvl>=400)return'G+';if(lvl>=350)return'G';
  if(lvl>=300)return'T';if(lvl>=260)return'X';if(lvl>=220)return'SSS';
  if(lvl>=180)return'SS';if(lvl>=140)return'S';if(lvl>=100)return'A';
  if(lvl>=80)return'B';if(lvl>=60)return'C';if(lvl>=40)return'D';
  if(lvl>=20)return'E';return'F';
}

/* ── Map bot character → fiche card format ── */
function charToFiche(id,c,source){
  source=source||'characters';
  const s=c.stats||{};
  const baseStats={
    str:s.strength||0,agi:s.agility||0,spd:s.speed||0,
    int:s.intelligence||0,mana:s.mana||0,res:s.resistance||0,
    cha:s.charisma||0,aura:s.aura||0
  };
  // Compute bonuses from equipment, companions, signature items, buffs
  const longStats={strength:s.strength||0,agility:s.agility||0,speed:s.speed||0,intelligence:s.intelligence||0,mana:s.mana||0,resistance:s.resistance||0,charisma:s.charisma||0,aura:s.aura||0};
  const bonResult=computeCharBonuses(id,longStats);
  const bon=bonResult.bonuses||bonResult; // backward compat
  const compBuffMult=bonResult.buff_mult||{};
  // Merge bonuses into stats (short keys)
  const totalStats={...baseStats};
  Object.entries(bon).forEach(([longK,v])=>{
    // Find short key
    const sk=Object.entries(SMAP).find(([,lk])=>lk===longK);
    if(sk)totalStats[sk[0]]=(totalStats[sk[0]]||0)+v;
  });
  // Apply companion buff_mult to total stats
  Object.entries(compBuffMult).forEach(([longK,mult])=>{
    const sk=Object.entries(SMAP).find(([,lk])=>lk===longK);
    if(sk && mult>0 && mult!==1){
      totalStats[sk[0]]=Math.floor((totalStats[sk[0]]||0)*mult);
    }
  });
  // Store bonus amounts per short key for display
  const bonusStats={};
  Object.entries(bon).forEach(([longK,v])=>{
    const sk=Object.entries(SMAP).find(([,lk])=>lk===longK);
    if(sk&&v)bonusStats[sk[0]]=v;
  });

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
  if(_hasTrueSelf){
    totalStats.int=10;
    baseStats.int=10;
    delete bonusStats.int;
  }

  // ── Rank-based cap / overflow bonus (aura never capped) ──
  const _fRank = rankFromLevel(c.level||0);
  if(window.Jaharta && Jaharta.applyRankCap){
    Object.keys(totalStats).forEach(shortK=>{
      const longK = SMAP[shortK] || shortK;
      totalStats[shortK] = Jaharta.applyRankCap(_fRank, longK, totalStats[shortK]);
    });
  }

  /* Map race_category du bot vers les clés de filtre du site */
  const _raceMap={'Mythical Zooids':'MythZooids'};
  const _mappedRace=_raceMap[c.race_category]||c.race_category||'';

  return{
    id:id,
    _source:source,
    firstname:c.first_name||'',
    lastname:c.last_name||'',
    age:c.age||'',
    race:_mappedRace,
    raceSpecific:c.class||'',
    rank:rankFromLevel(c.level||0),
    level:c.level||0,
    stats:totalStats,
    baseStats:baseStats,
    bonusStats:bonusStats,
    powers:(c.powers||[]).map(p=>typeof p==='string'?{name:p}:p),
    desc:c.bio||c.description||'',
    photoUrl:c.profile_image||'',
    links:Array.isArray(c.links)?c.links:[],
    status:'validee',
    createdAt:c.created_at?{toMillis:()=>new Date(c.created_at).getTime()}:null,
  };
}

/* Expose helpers for admin edit modal (fiches.html) */
window._rankFromLevel=rankFromLevel;




/* ── Tilt 3D + ligne diagonale ──
   Une ligne à 45° traverse la carte, sa position suit le tilt :
   - tilt droite → ligne vers la droite
   - tilt gauche → ligne vers la gauche
   - tilt haut/bas → ligne monte/descend
   Gold (A-X) : ligne dorée. Prismatic (T-Z) : ligne irisée.
*/
const TILT_MAX = 6;

function makeDiagLine(nx, ny, tier) {
  /* Position de la ligne : combine nx et ny pour donner un offset diagonal */
  /* 0% = coin haut-gauche, 100% = coin bas-droite */
  const offset = 50 + nx * 38 - ny * 38;  /* -1..1 → 12%..88% */

  /* Largeur de la bande lumineuse */
  const half = 4;
  const p0 = Math.max(0,   offset - half - 4);
  const p1 = Math.max(0,   offset - half);
  const p2 = Math.min(100, offset + half);
  const p3 = Math.min(100, offset + half + 4);

  /* Intensité selon l'éloignement du centre */
  const dist = Math.min(1, Math.sqrt(nx*nx + ny*ny) * 1.3);

  if (tier === 'prismatic') {
    return `linear-gradient(45deg,
      transparent ${p0}%,
      rgba(255,80,120,${.10*dist})  ${p1}%,
      rgba(255,200,80,${.16*dist})  ${p1+1}%,
      rgba(120,255,160,${.18*dist}) ${Math.round((p1+p2)/2)}%,
      rgba(80,180,255,${.16*dist})  ${p2-1}%,
      rgba(200,80,255,${.10*dist})  ${p2}%,
      transparent ${p3}%)`;
  } else if (tier === 'gold') {
    return `linear-gradient(45deg,
      transparent ${p0}%,
      rgba(200,140,20,${.08*dist})  ${p1}%,
      rgba(255,230,100,${.22*dist}) ${p1+1}%,
      rgba(255,250,180,${.32*dist}) ${Math.round((p1+p2)/2)}%,
      rgba(255,230,100,${.22*dist}) ${p2-1}%,
      rgba(200,140,20,${.08*dist})  ${p2}%,
      transparent ${p3}%)`;
  } else {
    return `linear-gradient(45deg,
      transparent ${p0}%,
      rgba(255,255,255,${.06*dist}) ${p1}%,
      rgba(255,255,255,${.18*dist}) ${p1+1}%,
      rgba(255,255,255,${.24*dist}) ${Math.round((p1+p2)/2)}%,
      rgba(255,255,255,${.18*dist}) ${p2-1}%,
      rgba(255,255,255,${.06*dist}) ${p2}%,
      transparent ${p3}%)`;
  }
}

function bindTilt(card) {
  const tier = card.classList.contains('prismatic') ? 'prismatic'
             : card.classList.contains('gold')      ? 'gold'
             : 'neutral';

  card.addEventListener('mousemove', e => {
    const r  = card.getBoundingClientRect();
    const nx = (e.clientX - r.left  - r.width  / 2) / (r.width  / 2);
    const ny = (r.height  / 2 - (e.clientY - r.top)) / (r.height / 2);

    card.style.transform =
      `perspective(800px) rotateX(${(ny*TILT_MAX).toFixed(2)}deg) rotateY(${(nx*TILT_MAX).toFixed(2)}deg) scale(1.02)`;

    const rf = card.querySelector('.card-reflet');
    if (rf) {
      rf.style.background = makeDiagLine(nx, ny, tier);
      rf.style.opacity = '1';
    }
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    const rf = card.querySelector('.card-reflet');
    if (rf) { rf.style.background = ''; rf.style.opacity = '0'; }
  });
}

/* ── Text scramble on hover ── */
const CHARS='アイウエオカキクケΨΩΣΔЯЖЩABCDEFGHIJKLMNOPQRSTUVWXYZ';
function scramble(el){
  if(!el)return;
  const orig=el.dataset.orig||el.textContent;
  el.dataset.orig=orig;
  let i=0;
  clearInterval(el._si);
  el.style.fontFamily='"Share Tech Mono",monospace';
  el._si=setInterval(()=>{
    el.textContent=orig.split('').map((c,j)=>{
      if(c===' ')return' ';
      return j<i?orig[j]:CHARS[Math.floor(Math.random()*CHARS.length)];
    }).join('');
    if(i>=orig.length){clearInterval(el._si);el.style.fontFamily='';}
    i+=0.5;
  },35);
}
function bindScramble(card){
  card.addEventListener('mouseenter',()=>{
    scramble(card.querySelector('.card-fn'));
    scramble(card.querySelector('.card-ln'));
  });
}

/* ── Build card ── */
function buildCard(ch,idx){
  const RACES=window.RACES||{}, RANKS=window.RANKS||{};
  const rc=RACES[ch.race]||{color:'#4DA3FF'};
  const rk=RANKS[ch.rank]||{color:'#6b7280'};
  const C=rc.color, RC=rk.color;
  const rank=ch.rank||'F', level=ch.level||0;
  const stats=ch.stats||{};

  const wrap=document.createElement('div');
  wrap.style.display='contents';
  wrap.dataset.race=ch.race||'';
  wrap.dataset.rank=rank;

  const card=document.createElement('div');
  const isGold=GOLD_RANKS.includes(rank);
  const isPrism=PRISM_RANKS.includes(rank);
  card.className='rp-card'+(isPrism?' prismatic':isGold?' gold':'');
  card.dataset.race=ch.race||'';
  card.dataset.rank=rank;
  card.dataset.level=level;
  card.style.setProperty('--rc',C);
  let tot=0;STATS.forEach(s=>tot+=(stats[s.k]||0));
  card.dataset.totalStats=tot;

  /* Reflet holographique */
  const rf=document.createElement('div');rf.className='card-reflet';card.appendChild(rf);
  const gl=document.createElement('div');gl.className='card-glow';
  gl.style.cssText=`box-shadow:0 0 40px ${C}18,0 0 80px ${C}0a`;card.appendChild(gl);

  /* ── PHOTO ── */
  const photo=document.createElement('div');photo.className='card-photo';


  if(ch.photoUrl||ch.photo){
    const img=document.createElement('img');
    img.alt=ch.firstname||'';
    if(idx<4){img.loading='eager';img.fetchPriority='high';}
    else{img.loading='lazy';}
    if(window.JImgCache&&ch.id){window.JImgCache.applyTo(img,'fc_'+ch.id,ch.photoUrl||ch.photo);}
    else{img.src=ch.photoUrl||ch.photo;}
    photo.appendChild(img);
  } else {
    const ph=document.createElement('div');ph.className='card-photo-ph';
    ph.style.color=C;
    ph.textContent=(ch.firstname?.[0]||'')+(ch.lastname?.[0]||'');
    photo.appendChild(ph);
  }

  const ov=document.createElement('div');ov.className='card-photo-ov';photo.appendChild(ov);

  /* Rank badge — inchangé */
  const badge=document.createElement('div');
  badge.className='rank-badge';badge.style.color=RC;
  if(isPrism||isGold)badge.style.animation='rankPulse 2.5s infinite';
  const rv=document.createElement('div');rv.className='rb-val';rv.textContent=rank;
  const rl=document.createElement('div');rl.className='rb-lbl';rl.textContent='RANG';
  badge.appendChild(rv);badge.appendChild(rl);
  if(level){
    const rlv=document.createElement('div');rlv.className='rb-level';
    rlv.textContent='Nv.'+level;badge.appendChild(rlv);
  }
  photo.appendChild(badge);

  /* Stats bar */
  const hasStats=STATS.some(s=>s.k!=='aura'&&(stats[s.k]||0)>0);
  const bonusStats=ch.bonusStats||{};
  const hasAnyBonus=Object.values(bonusStats).some(v=>v>0);
  if(hasStats){
    const bar=document.createElement('div');bar.className='stats-bar';
    STATS.forEach(s=>{
      const v=stats[s.k]||0;if(s.k==='aura'&&v===0)return;
      const bon=bonusStats[s.k]||0;
      const it=document.createElement('div');it.className=`sb-item ${s.c}`;
      it.innerHTML=`<div class="sb-lbl">${s.l}</div><div class="sb-val">${v}${bon>0?'<span style="font-size:.38rem;opacity:.7;color:#44ff88;margin-left:1px">▲</span>':''}</div>`+
        `<div class="sb-bar"><div class="sb-fill" style="width:${Math.min(100,Math.round(v/9999*100))}%"></div></div>`;
      if(bon>0)it.title=`Base: ${v-bon} + Bonus: ${bon}`;
      bar.appendChild(it);
    });
    photo.appendChild(bar);
  }
  card.appendChild(photo);

  /* ── BODY ── */
  const body=document.createElement('div');body.className='card-body';

  const fn=document.createElement('div');fn.className='card-fn';fn.textContent=(ch.firstname||'').toUpperCase();body.appendChild(fn);
  const ln=document.createElement('div');ln.className='card-ln';ln.textContent=(ch.lastname||'').toUpperCase();body.appendChild(ln);

  /* Race pill */
  const pill=document.createElement('div');pill.className='card-rpill';
  pill.style.cssText=`color:${C};border-color:${C}44;background:${C}0e`;
  const pip=document.createElement('span');pip.className='rpip';
  pip.style.cssText=`background:${C};box-shadow:0 0 5px ${C}`;pill.appendChild(pip);
  const rs=document.createElement('span');rs.textContent=ch.race||'';pill.appendChild(rs);
  if(ch.raceSpecific){
    const sep=document.createElement('span');sep.className='rp-sep';sep.textContent='·';
    const sp=document.createElement('span');sp.className='rp-specific';sp.textContent=ch.raceSpecific;
    pill.appendChild(sep);pill.appendChild(sp);
  }
  body.appendChild(pill);

  const desc=document.createElement('p');desc.className='card-desc';
  desc.textContent=ch.desc||ch.bio||'';body.appendChild(desc);

  /* Pouvoirs */
  const powers=ch.powers||[];
  if(powers.length){
    const ps=document.createElement('div');ps.className='powers-section';
    const pt=document.createElement('div');pt.className='powers-title';pt.textContent='POUVOIRS';ps.appendChild(pt);
    const pl=document.createElement('div');pl.className='powers-list';
    powers.forEach(pw=>{
      const pi=document.createElement('div');pi.className='power-item';
      const pc=pw.rarity?(RARITY_COLORS[pw.rarity]||'#8a8fa8'):C;
      pi.style.cssText=`border-color:${pc}88;background:${pc}08`;
      const ph=document.createElement('div');ph.className='power-header';
      const pn=document.createElement('div');pn.className='power-name';pn.style.color=pc;pn.textContent=pw.name||pw;ph.appendChild(pn);
      if(pw.rarity){const pr=document.createElement('span');pr.className='power-rarity';pr.textContent=pw.rarity;pr.style.cssText=`color:${pc};border-color:${pc}55;background:${pc}0d`;ph.appendChild(pr);}
      pi.appendChild(ph);
      if(pw.desc){const pd=document.createElement('div');pd.className='power-desc';pd.textContent=pw.desc;pi.appendChild(pd);}
      pl.appendChild(pi);
    });
    ps.appendChild(pl);body.appendChild(ps);
  }

  /* Liens — seuls http(s) autorisés (anti javascript: XSS) */
  const links=(ch.links&&ch.links.length?ch.links:null)||(ch.linkUrl?[{t:ch.linkType||'Fiche',h:ch.linkUrl}]:[]);
  if(links.length){
    const ld=document.createElement('div');ld.className='card-links';
    links.forEach(l=>{
      const rawHref=l.h||'';
      let safeHref='#';
      try{const u=new URL(rawHref);if(u.protocol==='https:'||u.protocol==='http:')safeHref=rawHref;}catch{}
      const a=document.createElement('a');a.className='lbtn';
      a.href=safeHref;a.target='_blank';a.rel='noopener noreferrer';
      a.textContent=l.t||'Lien';
      ld.appendChild(a);
    });
    body.appendChild(ld);
  }

  /* Admin — Modifier disponible pour TOUTES les fiches (bot + manuelles).
     Supprimer reste réservé aux fiches manuelles (les persos bot sont gérés via Discord). */
  if(ch.id){
    const ar=document.createElement('div');ar.className='card-admin-row';
    ar.style.display=window._isAdmin?'flex':'none';
    const eb=document.createElement('button');eb.className='card-edit-btn';eb.textContent='✎ Modifier';
    eb.onclick=()=>window.openEditFiche?.(ch.id,ch._source||'fiches');
    ar.appendChild(eb);
    const _isManual=(ch._source!=='characters'&&ch._source!=='irp_characters');
    if(_isManual){
      const db2=document.createElement('button');db2.className='card-del-btn';db2.textContent='✕ Supprimer';
      db2.onclick=()=>window.deleteFicheById?.(ch.id);
      ar.appendChild(db2);
    }
    body.appendChild(ar);
  }

  card.appendChild(body);
  /* Frame overlay — static */
  (function(){
    var id='fo'+(Math.random()*1e6|0);
    var svg='<svg class="card-frame-overlay" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 520" preserveAspectRatio="none" style="position:absolute;inset:0;pointer-events:none;z-index:15;overflow:visible"><defs><pattern id="sl-'+id+'" x="0" y="0" width="300" height="4" patternUnits="userSpaceOnUse"><rect width="300" height="2" fill="rgba(0,0,0,0.07)"/></pattern></defs><rect width="300" height="520" fill="url(#sl-'+id+')" opacity="0.5"/><path fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.25" d="M22,6 L278,6 Q294,6 294,22 L294,382 L274,402 L294,402 L294,498 Q294,514 278,514 L44,514 Q28,514 6,498 L6,136 L26,116 L6,116 L6,22 Q6,6 22,6Z"/><g opacity="0.22" stroke="currentColor" fill="none"><polygon points="268,17 283,29 268,41" stroke-width="1.2"/><polygon points="271,23 278,29 271,35" stroke-width="0.8"/><rect x="256" y="50" width="30" height="5" stroke-width="1"/><rect x="256" y="62" width="24" height="5" stroke-width="1"/><rect x="256" y="74" width="16" height="5" stroke-width="1"/></g><g opacity="0.22" stroke="currentColor" fill="none"><polygon points="6,396 40,396 34,416 6,416" stroke-width="1.2"/><polygon points="10,400 34,400 30,412 10,412" stroke-width="0.8"/><rect x="6" y="424" width="38" height="5" stroke-width="1"/><rect x="6" y="436" width="28" height="5" stroke-width="1"/><rect x="6" y="448" width="18" height="5" stroke-width="1"/></g></svg>';
    var el=document.createElement('div');el.innerHTML=svg;
    card.appendChild(el.firstChild);
  })();
  wrap.appendChild(card);
  bindTilt(card);
  bindScramble(card);
  return wrap;
}

/* ── Window helpers ── */
window.revealCards=function(){
  document.querySelectorAll('.rp-card:not(.card-revealed)').forEach((c,i)=>
    setTimeout(()=>c.classList.add('card-revealed'),i*100));
};
window.resetReveals=function(){
  document.querySelectorAll('.rp-card.card-revealed').forEach(c=>c.classList.remove('card-revealed'));
  setTimeout(()=>{let i=0;document.querySelectorAll('.rp-card').forEach(c=>{
    if(c.offsetParent)setTimeout(()=>c.classList.add('card-revealed'),i++*100);
  });},60);
};
window.animateCount=function(n){
  const el=document.getElementById('count-chars');if(!el)return;
  let v=0;const iv=setInterval(()=>{el.textContent=++v;if(v>=n)clearInterval(iv);},60);
};
window.setLive=function(){
  const sc=document.getElementById('status-container');
  if(sc)sc.innerHTML='<span class="hero-stat-num"><span class="live-dot"></span><span class="live-text">LIVE</span></span><span class="hero-stat-lbl">Statut</span>';
};
window.updateCounts=function(){
  const by={};document.querySelectorAll('.rp-card[data-race]').forEach(c=>{by[c.dataset.race]=(by[c.dataset.race]||0)+1;});
  let all=0;Object.entries(by).forEach(([r,n])=>{const el=document.getElementById('cnt-'+r);if(el)el.textContent=n;all+=n;});
  const ca=document.getElementById('cnt-all');if(ca)ca.textContent=all;
};
window.sortCards=function(mode,btn){
  document.querySelectorAll('#sort-filters .fbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const container=document.getElementById('cards-container');
  const noRes=document.getElementById('no-results');
  const wraps=[...container.querySelectorAll('div[style*="contents"]')];
  const getCard=w=>w.querySelector('.rp-card');
  if(mode==='none')wraps.sort((a,b)=>+(getCard(a).dataset.index||0)-(getCard(b).dataset.index||0));
  else if(mode==='stats')wraps.sort((a,b)=>+(getCard(b).dataset.totalStats||0)-(getCard(a).dataset.totalStats||0));
  else if(mode==='level')wraps.sort((a,b)=>+(getCard(b).dataset.level||0)-(getCard(a).dataset.level||0));
  wraps.forEach(w=>container.insertBefore(w,noRes));
  window.resetReveals();
};

/* ── Firebase loader ── */
let _cardsLoaded=false;
let _unsubChars=null,_unsubFiches=null;
window._loadCards=function(){
  if(_cardsLoaded)return; // Déjà abonné — pas de double snapshot
  _cardsLoaded=true;
  if(typeof window.Skeleton!=='undefined')Skeleton.show('cards-container',6);
  try{
    // ── Source 1 : collection characters (persos bot — source de vérité) ──
    // ── Source 2 : collection fiches (fiches manuelles admin — legacy)    ──
    // On fusionne les deux. Les characters sont toujours affichés ;
    // les fiches manuelles sont affichées uniquement si admin ou status=validee.

    let charDocs=[];
    let ficheDocs=[];
    let charLoaded=false, ficheLoaded=false;

    async function renderAll(){
      if(!charLoaded||!ficheLoaded)return;
      // Load bonus data (equipment, companions, buffs) once
      await loadBonusData();
      const ctn=document.getElementById('cards-container');
      const noRes=document.getElementById('no-results');
      const empty=document.getElementById('empty-state');
      if(empty)empty.remove();
      if(typeof window.Skeleton!=='undefined')Skeleton.hide('cards-container');
      [...ctn.children].forEach(el=>{if(el!==noRes&&!el.id&&el.dataset?.irp!=='true')el.remove();});

      // Convertir characters → format fiche
      const fromChars=charDocs
        .filter(c=>c.status!=='graveyard')
        .map(c=>charToFiche(c.id,c));

      // Fiches manuelles (admin legacy)
      const fromFiches=ficheDocs
        .filter(d=>d.status==='validee'||(window._isAdmin&&d.status));

      // Fusionner — characters d'abord, puis fiches manuelles
      const all=[...fromChars,...fromFiches];

      // Tri par date de création (plus récent en premier)
      all.sort((a,b)=>{
        const ta=a.createdAt?.toMillis?.()??
                 (a.created_at?new Date(a.created_at).getTime():0);
        const tb=b.createdAt?.toMillis?.()??
                 (b.created_at?new Date(b.created_at).getTime():0);
        return tb-ta;
      });

      all.forEach((d,idx)=>{
        const el=buildCard(d,idx);
        el.querySelector('.rp-card').dataset.index=idx;
        ctn.insertBefore(el,noRes);
      });
      window.animateCount(all.length);
      window.updateCounts();
      window.setLive();
      setTimeout(window.revealCards,120);
      const e2=document.getElementById('empty-state2');
      if(e2)e2.style.display=all.length===0?'block':'none';
      /* ── Auto-load IRP si le mode est actif ── */
      if(window._irpMode&&typeof window._loadIRPCards==='function')window._loadIRPCards();
    }

    // Charger characters (snapshot live)
    _unsubChars=onSnapshot(collection(db,'characters'),snap=>{
      charDocs=[];
      snap.forEach(d=>charDocs.push({id:d.id,...d.data()}));
      charLoaded=true;
      renderAll();
    },err=>{
      window._dbg?.warn('[Fiches] characters load:',err.message);
      charLoaded=true;
      renderAll();
    });

    // Charger fiches manuelles (snapshot live)
    _unsubFiches=onSnapshot(collection(db,'fiches'),snap=>{
      ficheDocs=[];
      snap.forEach(d=>ficheDocs.push({id:d.id,...d.data()}));
      ficheLoaded=true;
      renderAll();
    },err=>{
      window._dbg?.warn('[Fiches] fiches load:',err.message);
      ficheLoaded=true;
      renderAll();
    });

  }catch(e){
    const el=document.getElementById('empty-state');
    if(el)el.textContent='⚠ Firebase: '+e.message;
  }
};

/* ── IRP Mode — charge les personnages IRP en plus ── */
let _irpCardsLoaded=false;
let _unsubIRPChars=null,_unsubFleshMarks=null;
window._loadIRPCards=function(){
  if(_irpCardsLoaded)return;
  if(!window._irpMode)return;
  _irpCardsLoaded=true;
  try{
    /* Also load flesh marks collection once */
    var _fleshMarksCache={};
    _unsubFleshMarks=onSnapshot(collection(db,'irp_flesh_marks'),snap=>{
      snap.forEach(d=>{
        _fleshMarksCache[d.id]=d.data().marks||[];
      });
    });

    _unsubIRPChars=onSnapshot(collection(db,'irp_characters'),snap=>{
      const ctn=document.getElementById('cards-container');
      const noRes=document.getElementById('no-results');
      if(!ctn)return;
      /* Retirer les anciennes cartes IRP */
      ctn.querySelectorAll('[data-irp="true"]').forEach(el=>el.remove());
      const irpDocs=[];
      snap.forEach(d=>irpDocs.push({id:d.id,...d.data()}));
      const irpCards=irpDocs
        .filter(c=>c.status!=='graveyard')
        .map(c=>{
          const f=charToFiche(c.id,c,'irp_characters');
          f._isIRP=true;
          f._fleshMarks=_fleshMarksCache[c.id]||[];
          return f;
        });
      irpCards.sort((a,b)=>{
        const ta=a.createdAt?.toMillis?.()??(a.created_at?new Date(a.created_at).getTime():0);
        const tb=b.createdAt?.toMillis?.()??(b.created_at?new Date(b.created_at).getTime():0);
        return tb-ta;
      });
      const startIdx=ctn.querySelectorAll('div[style*="contents"]').length;
      irpCards.forEach((d,i)=>{
        const el=buildCard(d,startIdx+i);
        el.dataset.irp='true';
        /* Badge IRP sur la carte */
        const card=el.querySelector('.rp-card');
        if(card){
          card.dataset.index=startIdx+i;
          const badge=document.createElement('div');
          badge.style.cssText='position:absolute;top:8px;right:8px;z-index:20;background:rgba(220,20,60,0.85);color:#fff;font-family:var(--font-h);font-size:0.45rem;letter-spacing:0.1em;padding:3px 8px;border-radius:4px;';
          badge.textContent='IRP';
          card.style.position='relative';
          card.appendChild(badge);
          /* Marques de chair indicator */
          if(d._fleshMarks&&d._fleshMarks.length>0){
            const markBadge=document.createElement('div');
            markBadge.style.cssText='position:absolute;top:8px;left:8px;z-index:20;background:rgba(139,0,139,0.85);color:#fff;font-family:var(--font-h);font-size:0.4rem;letter-spacing:0.08em;padding:3px 6px;border-radius:4px;cursor:help;';
            markBadge.textContent='🔥 '+d._fleshMarks.length+' marque(s)';
            markBadge.title=d._fleshMarks.map(function(m){return m.name+' ('+m.location+') — '+m.owner_name;}).join('\n');
            card.appendChild(markBadge);
          }
        }
        ctn.insertBefore(el,noRes);
      });
      /* Update count */
      const total=ctn.querySelectorAll('div[style*="contents"]').length;
      window.animateCount(total);
      window.updateCounts();
      setTimeout(window.revealCards,120);
    },err=>{
      window._dbg?.warn('[Fiches] irp_characters load:',err.message);
    });
  }catch(e){
    window._dbg?.warn('[Fiches] IRP load error:',e.message);
  }
};

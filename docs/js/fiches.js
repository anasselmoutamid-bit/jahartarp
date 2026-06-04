/* ── Migration Firebase -> D1 (Worker https://jahartarp-api.jahartarp.workers.dev) ── */
import{collection,addDoc,onSnapshot,doc,getDoc,getDocs,updateDoc,deleteDoc,serverTimestamp,query,where,getFirestore,getAuth,onAuthStateChanged,getStorage,ref,uploadBytes,getDownloadURL}from"./d1-client.js?v=1";

const db=getFirestore();
const auth=getAuth();
const storage=getStorage();

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
const RARITY_COLORS={Common:'#8a8fa8',Uncommon:'#44ff88',Rare:'#4DA3FF',Epic:'#8B5CF6',Racial:'#14b8a6',Voie:'#9d00ff',Legendary:'#ffd60a',Mythic:'#ff8800',Unique:'#00ffcc',Pandemonium:'#9d00ff',Signature:'#ffd60a',Artifact:'#ff006e',Forgeflamme:'#ff4500',Mastercraft:'#ffffff'};
const STATS=[{k:'str',l:'STR',c:'sb-str'},{k:'DEX',l:'DEX',c:'sb-agi'},{k:'spd',l:'SPD',c:'sb-spd'},{k:'int',l:'INT',c:'sb-int'},{k:'mana',l:'MNA',c:'sb-mana'},{k:'res',l:'RES',c:'sb-res'},{k:'cha',l:'CHA',c:'sb-cha'},{k:'aura',l:'AUR',c:'sb-aura'}];

/* ── Mapping short → long stat keys ── */
const SMAP={str:'strength',agi:'dexterity',spd:'speed',int:'intelligence',mana:'mana',res:'resistance',cha:'charisma',aura:'aura'};

/* ── Link type detection (GDocs, GSites, HTML, PDF, etc.) ── */
const LINK_TYPES={
  gdoc:   {ico:'G',  col:'#4285f4', lbl:'Google Docs'},
  gsheet: {ico:'GS', col:'#0f9d58', lbl:'Sheets'},
  gslide: {ico:'GP', col:'#f4b400', lbl:'Slides'},
  gform:  {ico:'GF', col:'#7e57c2', lbl:'Forms'},
  gsite:  {ico:'S',  col:'#7c4dff', lbl:'Google Sites'},
  gdrive: {ico:'GD', col:'#1fa463', lbl:'Drive'},
  html:   {ico:'</>',col:'#e34c26', lbl:'HTML'},
  pdf:    {ico:'PDF',col:'#dc143c', lbl:'PDF'},
  doc:    {ico:'W',  col:'#2b579a', lbl:'Word'},
  image:  {ico:'IMG',col:'#ff9800', lbl:'Image'},
  text:   {ico:'TXT',col:'#9aa0b8', lbl:'Texte'},
  file:   {ico:'F',  col:'#9aa0b8', lbl:'Fichier'},
  discord:{ico:'DC', col:'#5865f2', lbl:'Discord'},
  youtube:{ico:'▶',  col:'#ff0000', lbl:'Video'},
  notion: {ico:'N',  col:'#c8cde0', lbl:'Notion'},
  github: {ico:'GH', col:'#c8cde0', lbl:'GitHub'},
  url:    {ico:'↗',  col:'#4DA3FF', lbl:'Lien'}
};
function detectLinkType(url){
  const lower=(url||'').toLowerCase();
  if(lower.includes('docs.google.com/document'))return 'gdoc';
  if(lower.includes('docs.google.com/spreadsheets'))return 'gsheet';
  if(lower.includes('docs.google.com/presentation'))return 'gslide';
  if(lower.includes('docs.google.com/forms'))return 'gform';
  if(lower.includes('sites.google.com'))return 'gsite';
  if(lower.includes('drive.google.com'))return 'gdrive';
  let ext='';
  try{const u=new URL(url);const p=decodeURIComponent(u.pathname);const m=p.match(/\.([a-z0-9]+)$/i);if(m)ext=m[1].toLowerCase();}catch(e){}
  if(ext==='html'||ext==='htm')return 'html';
  if(ext==='pdf')return 'pdf';
  if(['doc','docx','odt','rtf'].includes(ext))return 'doc';
  if(['png','jpg','jpeg','webp','gif','svg'].includes(ext))return 'image';
  if(['md','txt'].includes(ext))return 'text';
  if(lower.includes('firebasestorage.googleapis.com'))return 'file';
  if(lower.includes('discord.gg')||lower.includes('discord.com'))return 'discord';
  if(lower.includes('youtube.com')||lower.includes('youtu.be'))return 'youtube';
  if(lower.includes('notion.so')||lower.includes('notion.site'))return 'notion';
  if(lower.includes('github.com'))return 'github';
  return 'url';
}

/* ── Signature Items (port from signature_items.py) ── */
const SIGNATURE_ITEMS_F={
  cyclo_arcana:{name:"Cyclo-Arcana"},fake_twins:{name:"Fake Twins"},kings_jewel:{name:"King's Jewel"},
  real_twins:{name:"Real Twins"},diademe_du_nexus:{name:"Diadème du Nexus"},faux_modele_0:{name:"Faux, Modèle 0"},
  epee_de_damocles:{name:"Épée de Damoclès"},blitz_runners:{name:"Blitz Runners"},
  survivai_kit:{name:"Survivai Kit"},riviere_dopalines:{name:"Rivière d'Opalines"},
  faux_ongles_tisserand:{name:"Faux-Ongles du Tisserand"},
  cape_sombre_xiii:{name:"Cape Sombre, Modèle XIII"},
  lame_sang_sushel:{name:"Lame-Sang de Sushel"},
  lust_incarnate:{name:"Lust Incarnate"},
  kings_mantle:{name:"King's Mantle"}
};
/* ── Pandemonium Items (port from utils/pandemonium_items.py) ── */
const PANDEMONIUM_ITEMS_F={
  pandemonium_scyth:{stats:["charisma","mana","intelligence","dexterity"]},
  pandemonium_double_dagger:{stats:["speed","dexterity","intelligence","mana"]},
  pandemonium_aegis:{stats:["resistance","strength","charisma","mana"]},
  pandemonium_double_revolvers:{stats:["dexterity","intelligence","charisma","mana"]},
  pandemonium_heavy_sword:{stats:["strength","dexterity","charisma","mana"]}
};
const PANDEMONIUM_SOLO_BONUS=310;
const PANDEMONIUM_PARTY_BONUS=540;
const SIG_ALL=["strength","dexterity","speed","intelligence","mana","resistance","charisma"];
function calcSigBonuses(eqIds,cs,aura,eb){
  const b={};
  function a(s,v){b[s]=(b[s]||0)+Math.floor(v);}
  function bs(s){return parseInt((cs||{})[s]||0)||0;}
  for(const id of eqIds.filter(i=>SIGNATURE_ITEMS_F[i])){
    if(id==='cyclo_arcana'){a('speed',(bs('speed')+(eb.speed||0))*0.5);}
    else if(id==='fake_twins'){a('dexterity',20);a('charisma',50);if(aura){SIG_ALL.forEach(s=>a(s,50));a('aura',100);}}
    else if(id==='kings_jewel'){a('mana',50);if(aura)a('mana',50);}
    else if(id==='real_twins'){Object.entries(eb).forEach(([s,v])=>{if(v>0)a(s,v*0.5);});}
    else if(id==='diademe_du_nexus'){a('dexterity',50);a('intelligence',50);if(bs('mana')>300)a('mana',100);}
    else if(id==='faux_modele_0'){a('intelligence',75);if(bs('mana')>300)a('mana',100);}
    else if(id==='epee_de_damocles'){a('dexterity',50);}
    else if(id==='blitz_runners'){a('dexterity',75);a('speed',75);a('mana',75);}
    else if(id==='survivai_kit'){
      if(cs){const h=SIG_ALL.reduce((x,s)=>bs(s)>bs(x)?s:x,SIG_ALL[0]);SIG_ALL.forEach(s=>a(s,s===h?75:50));}
      if(bs('dexterity')>600)Object.entries(eb).forEach(([s,v])=>{if(v>0)a(s,v*0.5);});
    }
    else if(id==='riviere_dopalines'){SIG_ALL.forEach(s=>a(s,50));if(bs('mana')>300){SIG_ALL.forEach(s=>a(s,25));a('mana',100);}}
    else if(id==='faux_ongles_tisserand'){a('mana',150);if(bs('mana')>700)SIG_ALL.forEach(s=>a(s,150));}
    else if(id==='cape_sombre_xiii'){a('resistance',45);}
    else if(id==='lame_sang_sushel'){SIG_ALL.forEach(s=>a(s,65));}
    else if(id==='lust_incarnate'){a('mana',100);a('charisma',100);a('dexterity',100);a('intelligence',100);}
    else if(id==='kings_mantle'){
      // Toutes les stats x1.2 (dynamique : +20% sur base + buffs courants)
      SIG_ALL.forEach(s=>{
        const total=bs(s)+(parseInt(eb[s]||0)||0);
        if(total>0)a(s,Math.round(total*0.20));
      });
    }
  }
  return b;
}

/* ── Pandemonium bonuses (party-conditional) ────────────────────────────────
   Mirror of utils/pandemonium_items.calculate_pandemonium_bonuses.
   `partySynergy` doit être préchargé (lookup Firestore async).
*/
function calcPandemoniumBonuses(eqIds, partySynergy){
  const out={};
  const own=(eqIds||[]).filter(i=>PANDEMONIUM_ITEMS_F[i]);
  if(!own.length)return out;
  const per=partySynergy?PANDEMONIUM_PARTY_BONUS:PANDEMONIUM_SOLO_BONUS;
  for(const id of own){
    for(const s of PANDEMONIUM_ITEMS_F[id].stats){
      out[s]=(out[s]||0)+per;
    }
  }
  return out;
}

/* ── Préfetch config axiomes (parité avec hub-dashboard.js — sert au
   multiplicateur buff_stat/malus_stat appliqué dans la pipeline effective). */
(function(){
  if (window._AXIOME_CFG || window._AXIOME_CFG_PROMISE) return;
  window._AXIOME_CFG_PROMISE = fetch('data/axiomes.json?v=1')
    .then(function(r){ if (!r.ok) throw new Error('axiomes ' + r.status); return r.json(); })
    .then(function(j){ window._AXIOME_CFG = j; return j; })
    .catch(function(e){ console.warn('[fiches] axiomes config load failed:', e); return null; });
})();

/* Helpers pipeline stats EFFECTIVES (port de hub-dashboard.js +
   hub-character.js) — appliqués sur totalStats dans charToFiche après
   computeCharBonuses + companion buff_mult + Endurance Partagée.
   Ordre miroir : axiome mult → axiome skills → bénédictions → singularité. */
function _fichesAxiomeMults(c){
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

/* Bénédictions actives : walk c.benedictions[], cumule stat_mult /
   stat_mult_all / stat_mult_random. Retourne {longStat: multCumulé}. */
function _fichesBenedictionMults(c){
  var out = {};
  if (!c || !Array.isArray(c.benedictions)) return out;
  var STATS = ['strength','dexterity','speed','intelligence','mana','resistance','charisma','aura'];
  var now = Date.now();
  c.benedictions.forEach(function(b){
    if (!b || !b.expires_at || b.expires_at <= now) return;
    var m = parseFloat(b.mult || 0);
    if (!m || m === 1) return;
    if (b.kind === 'stat_mult_all') {
      STATS.forEach(function(s){ out[s] = (out[s] || 1) * m; });
    } else if (b.kind === 'stat_mult' || b.kind === 'stat_mult_random') {
      var arr = Array.isArray(b.stats) ? b.stats : (b.stat ? [b.stat] : []);
      arr.forEach(function(s){ if (s) out[s] = (out[s] || 1) * m; });
    }
  });
  return out;
}

/* Somme des % étoiles forge sur les items équipés d'un perso (clé inv).
   Reproduit hub-dashboard._forgeStarsTotalPctFor mais lit _allInvs[invKey]
   au lieu de INV_DATA. Tolère le legacy CHAR.forge_stars (passé via charObj). */
function _fichesForgeStarsBonus(invKey, charObj){
  if (!invKey) return 0;
  var total = 0;
  try {
    var inv = _allInvs[invKey] || {};
    var eq = inv.equipped_assets || [];
    var ups = inv.item_upgrades || {};
    eq.forEach(function(id){
      var up = ups[id];
      if (up && Array.isArray(up.bonuses_pct)) {
        up.bonuses_pct.forEach(function(p){ if (typeof p === 'number') total += p; });
        return;
      }
      var leg = charObj && charObj.forge_stars && charObj.forge_stars[id];
      if (Array.isArray(leg)) {
        leg.forEach(function(p){ if (typeof p === 'number') total += p; });
      }
    });
  } catch(_){}
  return total;
}

/* Items Singularité équipés pour un perso donné (clé inventaire userId_charId).
   Reproduit hub-dashboard._singularityBonusesFor mais lit _allInvs par clé
   au lieu de INV_DATA (qui n'existe que sur le hub). */
function _fichesSingularityBonuses(invKey){
  var out = { flat: {}, mult: {} };
  if (!invKey) return out;
  try {
    var inv = _allInvs[invKey] || {};
    var sg = inv.singularity_items || {};
    var eq = inv.equipped_assets || [];
    eq.forEach(function(id){
      var sgItem = sg[id];
      if (!sgItem) return;
      Object.entries(sgItem.stats_flat || {}).forEach(function(kv){
        out.flat[kv[0]] = (out.flat[kv[0]] || 0) + (parseInt(kv[1],10)||0);
      });
      Object.entries(sgItem.stats_mult || {}).forEach(function(kv){
        var m = parseFloat(kv[1]) || 1;
        out.mult[kv[0]] = (out.mult[kv[0]] || 1) * m;
      });
    });
  } catch(_){}
  return out;
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
let _allPartyMembers={};   // party_membership/{userId_charId} → {party_id,...}
let _allParties={};        // parties/{partyId} → {members:[{char_key,...}]}

async function loadBonusData(){
  if(_bonusDataLoaded)return;
  _bonusDataLoaded=true;
  try{
    const [itemsCfgSnap,activesSnap,invsSnap,buffsSnap,compUsersSnap,compCfgSnap,setsCfgSnap,pmSnap,prtSnap]=await Promise.all([
      getDoc(doc(db,'config','items')),
      getDocs(collection(db,'active_characters')),
      getDocs(collection(db,'inventories')),
      getDocs(collection(db,'buffs')),
      getDocs(collection(db,'companions_user')),
      getDoc(doc(db,'config','companions_data')),
      getDoc(doc(db,'config','item_sets')),
      getDocs(collection(db,'party_membership')),
      getDocs(collection(db,'parties'))
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
    pmSnap.forEach(d=>{_allPartyMembers[d.id]=d.data();});
    prtSnap.forEach(d=>{_allParties[d.id]=d.data();});
  }catch(err){window._dbg?.warn('[Fiches] bonus data load:',err.message);}
}

/* ── Pandemonium party-synergy detection (sync) ────────────────────────────
   Renvoie true si un AUTRE membre de la party du porteur (userId/charId)
   porte une arme Pandemonium équipée. Lecture purement locale (pré-chargée).
*/
function _isPandemoniumPartySynergy(userId, charId){
  try{
    const ck=`${userId}_${charId}`;
    const pm=_allPartyMembers[ck];
    if(!pm||!pm.party_id)return false;
    const party=_allParties[String(pm.party_id)];
    if(!party||!party.members)return false;
    for(const m of party.members){
      const mck=m&&m.char_key;
      if(!mck||mck===ck)continue;
      const inv=_allInvs[mck];
      if(!inv||!inv.equipped_assets)continue;
      if(inv.equipped_assets.some(eid=>PANDEMONIUM_ITEMS_F[eid]))return true;
    }
  }catch(_){}
  return false;
}

/* ── Set Valkyrie (port from utils/item_sets.py — racial set) ──────────────
   Le mécanisme `race_bonus` est appliqué dans la boucle des sets ci-dessous.
*/
const _VALKYRIE_SET={
  name:"Set Valkyrie",
  rarity:"racial",
  items:["heaume_valkyrie","plastron_valkyrie","brassards_valkyrie","tunique_valkyrie",
         "cuissardes_valkyrie","bottes_valkyrie","gantelets_valkyrie","lame_valkyrie"],
  bonuses:{
    "8":{
      stats:{strength:60,resistance:60,charisma:60,mana:60},
      race_bonus:{race:"Valkyrie",stats:{strength:120,resistance:120,charisma:120,mana:120}}
    }
  }
};
// Injecté dans le fallback global pour rester cohérent avec hub-inventory.js
if(typeof window!=='undefined'){
  window._ITEM_SETS_FALLBACK=window._ITEM_SETS_FALLBACK||{};
  window._ITEM_SETS_FALLBACK.valkyrie_set=_VALKYRIE_SET;
}

/* ── Companion sync_power → flat stat bonuses map ── */
function _ficheSyncPowerBonuses(power){
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

/* ── Compute total bonuses for a character ──
   @param {string} charId
   @param {object} charStats - stats stockées (.strength, .charisma, ...)
   @param {string} charRace - race_category ou race
   @param {object} [charForPassives] - char complet (.powers, .racial_power)
       requis pour les passifs raciaux dérivés. Si absent, les passifs sont skip. */
function computeCharBonuses(charId,charStats,charRace,charForPassives){
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

  // 1) Equipment stats (skip signature + equalizer + pandemonium)
  eqList.forEach(id=>{
    const it=_allItemsDef[id]||{};
    if((it.rarity||'').toLowerCase()==='signature')return;
    if((it.rarity||'').toLowerCase()==='pandemonium')return;
    if(id==='equalizer')return;
    Object.entries(it.stat_effects||it.stats||{}).forEach(([s,v])=>{
      try{add(s,parseInt(String(v).replace('+','')));}catch(_){}
    });
  });
  // 2) Sets — highest threshold only (mirrors bot). Inclut le Set Valkyrie
  //    via fallback + race_bonus pour les sets racial-locked.
  const _setsBase=_itemSets&&Object.keys(_itemSets).length?_itemSets:(window._ITEM_SETS_FALLBACK||{});
  // Toujours fusionner valkyrie_set (race-locked) car non porté en config Firestore
  const sets={..._setsBase};
  if(typeof _VALKYRIE_SET!=='undefined' && !sets.valkyrie_set) sets.valkyrie_set=_VALKYRIE_SET;
  const eqSet=new Set(eqList);
  const SK8=['strength','dexterity','speed','intelligence','mana','resistance','charisma'];
  let _ficheSetSpecial=null;
  const _ficheSetBuffMult={};
  let _ficheSetBuffMultAll=1;
  const _normRace=(charRace||'').toString().trim().toLowerCase();
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
        // Race-locked extra bonus (e.g. Valkyrie set on a Valkyrie)
        if(b.race_bonus && _normRace){
          const tgt=(b.race_bonus.race||'').toString().trim().toLowerCase();
          if(tgt && tgt===_normRace){
            if(b.race_bonus.stats)Object.entries(b.race_bonus.stats).forEach(([s,v])=>add(s,v));
            if(b.race_bonus.stats_all)SK8.forEach(s=>add(s,b.race_bonus.stats_all));
          }
        }
        break; // only highest threshold per set
      }
    }
  });
  // 2c) Pandemonium weapons (party-conditional)
  if(eqList.some(id=>PANDEMONIUM_ITEMS_F[id])){
    const synergy=_isPandemoniumPartySynergy(discordId,charId);
    const pdm=calcPandemoniumBonuses(eqList,synergy);
    Object.entries(pdm).forEach(([s,v])=>add(s,v));
  }
  // 3) Buffs — IGNORE les sources racial_passive_* et axiome_passive_*, recalculées
  //    en dérivé plus bas via window.RacialPassives.computeRacialPassiveBuffs.
  //    Cf. docs/js/racial-passives.js pour la doc complète.
  const _isManagedSrc = (window.RacialPassives && window.RacialPassives.isManagedPassiveSource)
    ? window.RacialPassives.isManagedPassiveSource
    : function(s){ s=String(s||''); return s.indexOf('racial_passive_')===0 || s.indexOf('axiome_passive_')===0; };
  (bufData.buffs||[]).forEach(b=>{
    if(_isManagedSrc(b&&b.source)) return;
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
    diademe_eveil_primordial:{buff_mult:{mana:1.25}},heaume_jugement_final:{pct_base:{resistance:0.10}},
    manteau_neant_absolu:{nerf_reduction:0.30},anneau_apocalypse:{buff_mult:{strength:1.25}},
    bague_eternel_retour:{pct_base:{speed:0.12}},
    anneau_unique_systeme:{conditional:()=>_ficheBS('mana')>500?{mana:100}:{}},
    poignes_destructeur_code:{buff_mult:{strength:1.25}},
    bracelets_horizon_evenements:{conditional:()=>_ficheBS('speed')>300?{speed:50}:{}},
    bottes_transcendance:{buff_mult:{speed:1.25}},manteau_gravite_zero:{buff_mult:{dexterity:1.25}},
    coeur_supernova:{buff_mult:{mana:1.25}},
    excalibur_neon:{buff_mult:{strength:1.25},pct_base:{charisma:0.05}},
    auroras_mythril_hammer:{conditional:()=>_ficheBS('strength')>400?{strength:50}:{}},
    dagues_fin_temps:{buff_mult:{dexterity:1.25}},
    pistolet_singularite:{conditional:()=>_ficheBS('intelligence')>300?{mana:50}:{}},
    ia_conscience_gaia:{nerf_reduction:0.20},
    original_fragment_core_nexus:{conditional:()=>['fragment_of_reality','birth_of_the_imaginary','ia_conscience_gaia'].some(i=>eqSet.has(i))?{mana:100}:{}},
    ethereal_halo:{buff_mult:{intelligence:1.25,mana:1.15}},quantum_mirror_coat:{nerf_reduction:0.40},
    time_paradox_ring:{pct_base_all:0.08},
    silver_ring_nexus:{conditional:()=>_ficheBS('dexterity')>400?{dexterity:50}:{}},
    silver_tear_nexus:{conditional:()=>({mana:100})},
    wings_principle_speed:{buff_mult:{speed:1.3}},kang_soos_great_sword:{buff_mult:{strength:1.3}},
    dagger_principle_reality:{buff_mult:{dexterity:1.3}},
    destinys_cuffs:{conditional:()=>_ficheBS('resistance')>_ficheBS('strength')?{strength:Math.floor(_ficheBS('strength')*0.3)}:{}},
    omega_nexus:{pct_base_all:0.10},
    invisi_gloves:{conditional:()=>_ficheBS('charisma')>300?{dexterity:75}:{}},
    old_chaos_mask:{buff_mult:{intelligence:1.4}},
    forgotten_kings_crown:{conditional:()=>_ficheBS('charisma')>500?{charisma:100}:{}},
    origins_chestplate:{nerf_reduction:0.50},old_chaos_ring:{buff_mult:{strength:1.4}},
    origins_ring:{buff_mult:{mana:1.4}},destinys_gauntelet:{buff_mult:{dexterity:1.4}},
    destinys_chains:{conditional:()=>_ficheBS('speed')>500?{speed:100}:{}},
    stars_devourer:{conditional:()=>_ficheBS('mana')>300?{strength:100}:{}},
    the_betrayer:{conditional:()=>_ficheBS('strength')<_ficheBS('dexterity')?{dexterity:100}:{}},
    inertia_bracelets:{buff_mult:{resistance:1.4}},lost_entitys_core:{pct_base_all:0.10},
    balduns_crown:{buff_mult:{intelligence:1.5}},balduns_chivalery:{buff_mult:{dexterity:1.5}},
    balduns_gauntelet:{buff_mult:{charisma:1.5}},balduns_chains:{pct_base_all:0.15},
    balduns_cape:{conditional:()=>eqSet.has('balduns_chestplate')?{resistance:600}:{}},
    balduns_executionner:{buff_mult:{strength:1.5}},balduns_claws:{buff_mult:{strength:1.5}},
    balduns_bracelet:{buff_mult:{mana:1.5}},balduns_god_shoes:{buff_mult:{speed:1.5}},
    balduns_ring:{conditional:()=>{if(!aura)return {};const r={};SK8.forEach(s=>{r[s]=Math.floor(_ficheBS(s)*0.5);});return r;}},
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

  // 9) Passifs raciaux (dérivé, parité avec utils/racial_passives.py côté bot).
  //    buffScope = bonuses accumulés jusqu'ici (équip + sets + pandem + signature
  //    + mythic + buff_mults + equalizer + companion sync + buffs filtrés). Pas
  //    de titres/party/achievements/singu/bénédictions ici — fiches.js ne les
  //    inclut pas, et le bot non plus dans son scope racial.
  if (window.RacialPassives && charForPassives){
    const _rpChar = {
      powers: charForPassives.powers,
      racial_power: charForPassives.racial_power,
      stats: charStats,
    };
    const _rpBuffs = window.RacialPassives.computeRacialPassiveBuffs(_rpChar, bonuses);
    for (const b of _rpBuffs){
      const eff = (b && b.effects) || {};
      for (const k in eff){ const v=parseInt(eff[k])||0; if (v) bonuses[k]=(bonuses[k]||0)+v; }
    }
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
  // ── AURA gating (Cultivator) ──
  // Si cultivator.root pas débloqué, on force la stat aura à 0 partout.
  const _auraUnlocked = (window.Jaharta && Jaharta.isAuraUnlocked)
    ? Jaharta.isAuraUnlocked(c)
    : !!((c.axiome_tree_unlocked||{})['cultivator.root']);
  const _rawAura = _auraUnlocked ? (s.aura||0) : 0;
  const baseStats={
    str:s.strength||0,agi:s.dexterity||0,spd:s.speed||0,
    int:s.intelligence||0,mana:s.mana||0,res:s.resistance||0,
    cha:s.charisma||0,aura:_rawAura
  };
  // Compute bonuses from equipment, companions, signature items, buffs
  const longStats={strength:s.strength||0,dexterity:s.dexterity||0,speed:s.speed||0,intelligence:s.intelligence||0,mana:s.mana||0,resistance:s.resistance||0,charisma:s.charisma||0,aura:_rawAura};
  const _charRace=c.race||c.race_category||'';
  const bonResult=computeCharBonuses(id,longStats,_charRace,c);
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

  // ── Endurance Partagée (Chef de Meute) ────────────────────────────────
  // Bonus RES dynamique = +0.5% par compagnon synchronisé actif.
  // Source d'autorité : AxiomeSkills.getEndurancePartageeBonus(char, count).
  try {
    if (window.AxiomeSkills && AxiomeSkills.has(c,'chef_meute.endurance-partagee')) {
      // Compte les compagnons synchronisés à partir de _allCompUsers
      let _syncedCount = 0;
      try {
        // Reproduire la résolution discordId → key pour piocher compUser
        let _did = null;
        for (const [did, ad] of Object.entries(_allActives||{})) {
          if (ad.character_id === id) { _did = did; break; }
        }
        if (_did) {
          const _cu = _allCompUsers[_did + '_' + id] || {};
          const _owned = _cu.owned_companions || {};
          _syncedCount = Object.values(_owned).filter(function(cd){ return cd && cd.synchronized; }).length;
        }
      } catch(_) {}
      const _epPct = AxiomeSkills.getEndurancePartageeBonus(c, _syncedCount) || 0;
      if (_epPct > 0 && totalStats.res > 0) {
        const _epDelta = Math.floor(totalStats.res * _epPct);
        totalStats.res += _epDelta;
        bonusStats.res = (bonusStats.res||0) + _epDelta;
      }
    }
  } catch(_) {}

  // ═══════════════════════════════════════════════════════════════════
  //  PIPELINE STATS EFFECTIVES — parité avec hub#personnage
  //  Ordre miroir hub-character.js / hub-dashboard.js :
  //    1) axiome buff/malus mult (T1±3%, T2±6%, etc.)
  //    2) axiome skills stat_bonus (permanent + conditionnel)
  //    3) bénédictions mult
  //    4) singularité (flat + mult)
  //  La fiche montrait avant le total post-equipment uniquement ("stats
  //  flats"). Maintenant elle affiche le total effectif comme dans le hub.
  // ═══════════════════════════════════════════════════════════════════
  let _fEquippedIds = [];
  let _fInvKey = null;
  try {
    let _did = null;
    for (const [did, ad] of Object.entries(_allActives || {})) {
      if (ad && ad.character_id === id) { _did = did; break; }
    }
    if (_did) {
      _fInvKey = _did + '_' + id;
      _fEquippedIds = (_allInvs[_fInvKey] || {}).equipped_assets || [];
    }
  } catch(_){}

  const _fAxMults     = _fichesAxiomeMults(c);
  const _fBenMults    = _fichesBenedictionMults(c);
  const _fSgBon       = _fichesSingularityBonuses(_fInvKey);
  const _fStarsPct    = _fichesForgeStarsBonus(_fInvKey, c);

  Object.keys(totalStats).forEach(shortK => {
    const longK = SMAP[shortK] || shortK;
    let v = parseInt(totalStats[shortK] || 0, 10) || 0;
    // Singularité FLAT (additionné avant les mults, comme un bonus équipement)
    const sgFlat = parseInt((_fSgBon.flat || {})[longK] || 0, 10) || 0;
    if (sgFlat) {
      v += sgFlat;
      bonusStats[shortK] = (bonusStats[shortK] || 0) + sgFlat;
    }
    // 1. Axiome buff/malus
    if (_fAxMults) {
      if (_fAxMults.buffStat === longK && _fAxMults.buffMult !== 1) {
        v = Math.floor(v * _fAxMults.buffMult);
      } else if (_fAxMults.malusStat === longK && _fAxMults.malusMult !== 1) {
        v = Math.floor(v * _fAxMults.malusMult);
      }
    }
    // 2. Axiome skills (permanent + conditionnels actifs)
    if (window.AxiomeSkills) {
      let pct = (typeof AxiomeSkills.getStatBonusTotal === 'function')
        ? (AxiomeSkills.getStatBonusTotal(c, longK) || 0)
        : 0;
      if (typeof AxiomeSkills.getConditionalStatBonusTotalApplied === 'function') {
        pct += AxiomeSkills.getConditionalStatBonusTotalApplied(c, longK, _fEquippedIds, _allItemsDef) || 0;
      }
      if (pct && Math.abs(pct) > 0.0001) {
        v = Math.floor(v * (1 + pct));
      }
    }
    // 2b. Étoiles forge — bonus % cumul toutes stats des items équipés
    if (_fStarsPct && Math.abs(_fStarsPct) > 0.0001) {
      v = Math.floor(v * (1 + _fStarsPct));
    }
    // 3. Bénédictions
    const benM = parseFloat(_fBenMults[longK] || 0);
    if (benM > 0 && benM !== 1) {
      v = Math.floor(v * benM);
    }
    // 4. Singularité MULT
    const sgM = parseFloat((_fSgBon.mult || {})[longK] || 0);
    if (sgM > 0 && sgM !== 1) {
      v = Math.floor(v * sgM);
    }
    totalStats[shortK] = v;
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

  // ── Supreme Privilege désormais géré DANS computeCharBonuses via
  //    window.RacialPassives (port de utils/racial_passives.py côté bot).
  //    Voir étape 9 dans computeCharBonuses. True Self continue de verrouiller INT=10.

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

/* ── Text scramble on hover (kept for IRP compat) ── */
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

/* ── Build card — quinconce layout ── */
function buildCard(ch,idx){
  const RACES=window.RACES||{}, RANKS=window.RANKS||{};
  const rc=RACES[ch.race]||{color:'#4DA3FF'};
  const rk=RANKS[ch.rank]||{color:'#6b7280'};
  const C=rc.color;
  const rank=ch.rank||'F', level=ch.level||0;
  const stats=ch.stats||{};

  const isGold=GOLD_RANKS.includes(rank);
  const isPrism=PRISM_RANKS.includes(rank);
  const isRev=idx%2===1; // quinconce

  const _esc=window.escHtml||function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};

  const wrap=document.createElement('div');
  wrap.style.display='contents';
  wrap.dataset.race=ch.race||'';
  wrap.dataset.rank=rank;

  const card=document.createElement('article');
  card.className='card-alt'+(isRev?' rev':'');
  card.style.setProperty('--rc',C);
  card.dataset.race=ch.race||'';
  card.dataset.rank=rank;
  card.dataset.rankTier=isPrism?'prism':isGold?'gold':'standard';
  card.dataset.name=((ch.firstname||'')+' '+(ch.lastname||'')).trim();
  card.dataset.level=level;
  let tot=0;STATS.forEach(s=>tot+=(stats[s.k]||0));
  card.dataset.totalStats=tot;

  /* ── IMAGE ZONE ── */
  const imgZone=document.createElement('div');imgZone.className='ca-img';

  const bgDiv=document.createElement('div');bgDiv.className='ca-img-bg';
  bgDiv.innerHTML='<div class="ca-img-bg-text">'+_esc(ch.race||'JAHARTA')+'</div>';
  imgZone.appendChild(bgDiv);

  const artDiv=document.createElement('div');artDiv.className='ca-img-art';
  if(ch.photoUrl||ch.photo){
    const img=document.createElement('img');
    img.alt=ch.firstname||'';
    if(idx<4){img.loading='eager';img.fetchPriority='high';}else{img.loading='lazy';}
    if(window.JImgCache&&ch.id){window.JImgCache.applyTo(img,'fc_'+ch.id,ch.photoUrl||ch.photo);}
    else{img.src=ch.photoUrl||ch.photo;}
    artDiv.appendChild(img);
  } else {
    const init=document.createElement('div');init.className='ca-initials';
    init.textContent=((ch.firstname?.[0]||'')+(ch.lastname?.[0]||'')).toUpperCase()||'?';
    artDiv.appendChild(init);
  }
  imgZone.appendChild(artDiv);

  ['ca-img-tint','ca-img-scan'].forEach(cn=>{const d=document.createElement('div');d.className=cn;imgZone.appendChild(d);});

  const hudStrip=document.createElement('div');hudStrip.className='ca-hud-strip';
  hudStrip.innerHTML='<span class="ca-hud-id">▼ // ID-'+String(idx+1).padStart(3,'0')+' · JAHARTA</span>'+
    '<span class="ca-hud-nv">Nv. '+level+'</span>';
  imgZone.appendChild(hudStrip);

  const stDiv=document.createElement('div');stDiv.className='ca-status';
  stDiv.innerHTML='<div class="ca-status-dot"></div>';imgZone.appendChild(stDiv);
  ['bl','br'].forEach(p=>{const d=document.createElement('div');d.className='ca-hc '+p;imgZone.appendChild(d);});

  const raceBadge=document.createElement('div');raceBadge.className='ca-race-badge';
  raceBadge.textContent=(ch.race||'')+(ch.raceSpecific&&ch.raceSpecific!==ch.race?' · '+ch.raceSpecific:'');
  imgZone.appendChild(raceBadge);
  card.appendChild(imgZone);

  /* ── INFO ZONE ── */
  const infoDiv=document.createElement('div');infoDiv.className='ca-info';
  const infoInner=document.createElement('div');

  /* Top row: rank + index */
  const topRow=document.createElement('div');topRow.className='ca-top';
  const rbadge=document.createElement('div');
  rbadge.className='ca-rank-badge'+(isPrism?' prism':isGold?' gold':'');
  if(!isGold&&!isPrism){rbadge.style.color=rk.color;rbadge.style.textShadow='0 0 20px '+rk.color+',0 0 40px '+rk.color+'40';}
  rbadge.textContent=rank;
  const idxSpan=document.createElement('div');idxSpan.className='ca-index';
  idxSpan.textContent='#'+String(idx+1).padStart(3,'0')+' · ACTIF';
  topRow.appendChild(rbadge);topRow.appendChild(idxSpan);infoInner.appendChild(topRow);

  /* Name */
  const nameW=document.createElement('div');nameW.className='ca-name-wrap';
  const fnS=document.createElement('span');fnS.className='ca-firstname';fnS.textContent=ch.firstname||'';
  const lnS=document.createElement('span');lnS.className='ca-lastname';lnS.textContent=(ch.lastname||'').toUpperCase();
  nameW.appendChild(fnS);nameW.appendChild(lnS);infoInner.appendChild(nameW);

  /* Identity */
  const identDiv=document.createElement('div');identDiv.className='ca-identity';
  const iFields=[];
  if(ch.age)iFields.push({l:'Âge',v:String(ch.age)+(String(ch.age).match(/^\d+$/)?' ans':'')});
  if(ch.race)iFields.push({l:'Race',v:ch.race+(ch.raceSpecific&&ch.raceSpecific!==ch.race?' — '+ch.raceSpecific:'')});
  iFields.forEach((f,i)=>{
    if(i>0){const sep=document.createElement('span');sep.className='ca-sep';sep.textContent='·';identDiv.appendChild(sep);}
    const tag=document.createElement('span');tag.className='ca-tag';
    const lNode=document.createTextNode(f.l+' ');const vSpan=document.createElement('span');vSpan.textContent=f.v;
    tag.appendChild(lNode);tag.appendChild(vSpan);identDiv.appendChild(tag);
  });
  infoInner.appendChild(identDiv);

  /* Stats grid */
  const statsDiv=document.createElement('div');statsDiv.className='ca-stats';
  const maxStat=Math.max(1000,...STATS.map(s=>stats[s.k]||0));
  const bonusStats=ch.bonusStats||{};
  STATS.forEach(s=>{
    const v=stats[s.k]||0,bon=bonusStats[s.k]||0;
    const pct=Math.min(100,Math.round(v/maxStat*100));
    const si=document.createElement('div');si.className='ca-stat';
    si.innerHTML='<span class="ca-stat-lbl">'+s.l+'</span>'+
      '<span class="ca-stat-val">'+v+(bon>0?'<span class="ca-bonus-tag">+'+bon+'</span>':'')+'</span>'+
      '<div class="ca-stat-bar"><div class="ca-stat-bar-fill" style="width:'+pct+'%"></div></div>';
    if(bon>0)si.title='Base: '+(v-bon)+' + Bonus: '+bon;
    statsDiv.appendChild(si);
  });
  infoInner.appendChild(statsDiv);

  /* Powers */
  const powers=ch.powers||[];
  if(powers.length){
    const pwDiv=document.createElement('div');pwDiv.className='ca-powers';
    const pwT=document.createElement('div');pwT.className='ca-powers-title';pwT.textContent='Pouvoirs débloqués';pwDiv.appendChild(pwT);
    powers.slice(0,4).forEach(pw=>{
      const pc=pw.rarity?(RARITY_COLORS[pw.rarity]||'#8a8fa8'):C;
      const pwI=document.createElement('div');pwI.className='ca-power';
      const dot=document.createElement('div');dot.className='ca-power-dot';dot.style.setProperty('--pw-c',pc);
      const nm=document.createElement('span');nm.className='ca-power-name';nm.textContent=pw.name||pw;
      pwI.appendChild(dot);pwI.appendChild(nm);
      if(pw.rarity){const rar=document.createElement('span');rar.className='ca-power-rarity';rar.style.setProperty('--pw-c',pc);rar.textContent=pw.rarity;pwI.appendChild(rar);}
      pwDiv.appendChild(pwI);
    });
    infoInner.appendChild(pwDiv);
  }

  infoDiv.appendChild(infoInner);

  /* CTA + admin row */
  const ctaRow=document.createElement('div');ctaRow.className='ca-cta-row';

  /* Links (Fiche RP) */
  const links=(ch.links&&ch.links.length?ch.links:null)||(ch.linkUrl?[{t:ch.linkType||'Fiche RP',h:ch.linkUrl}]:[]);
  links.forEach(l=>{
    const rawHref=l.h||'';let safeHref='#';
    try{const u=new URL(rawHref);if(u.protocol==='https:'||u.protocol==='http:')safeHref=rawHref;}catch{}
    const type=(l.type&&LINK_TYPES[l.type])?l.type:detectLinkType(safeHref);
    const ts=LINK_TYPES[type]||LINK_TYPES.url;
    const a=document.createElement('a');a.className='ca-cta-btn';
    a.href=safeHref;a.target='_blank';a.rel='noopener noreferrer';
    a.style.setProperty('--lc',ts.col);
    const ico=document.createElement('svg');ico.setAttribute('viewBox','0 0 24 24');ico.setAttribute('fill','none');ico.setAttribute('stroke','currentColor');ico.setAttribute('stroke-width','2');
    ico.innerHTML='<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
    const lbl=document.createElement('span');lbl.textContent=l.t||ts.lbl||'Fiche RP';
    a.appendChild(ico);a.appendChild(lbl);
    ctaRow.appendChild(a);
  });

  /* Admin row */
  if(ch.id){
    const ar=document.createElement('div');ar.className='card-admin-row';
    ar.style.display=window._isAdmin?'flex':'none';
    const eb=document.createElement('button');eb.className='card-edit-btn';eb.textContent='✎ Modifier';
    eb.onclick=()=>window.openEditFiche?.(ch.id,ch._source||'fiches');ar.appendChild(eb);
    const isManual=(ch._source!=='characters'&&ch._source!=='irp_characters');
    if(isManual){
      const db2=document.createElement('button');db2.className='card-del-btn';db2.textContent='✕ Supprimer';
      db2.onclick=()=>window.deleteFicheById?.(ch.id);ar.appendChild(db2);
    }
    ctaRow.appendChild(ar);
  }

  infoDiv.appendChild(ctaRow);
  card.appendChild(infoDiv);
  wrap.appendChild(card);
  return wrap;
}

/* ── Window helpers ── */
window.revealCards=function(){
  document.querySelectorAll('.card-alt:not(.card-revealed)').forEach((c,i)=>
    setTimeout(()=>c.classList.add('card-revealed'),i*80));
};
window.resetReveals=function(){
  document.querySelectorAll('.card-alt.card-revealed').forEach(c=>c.classList.remove('card-revealed'));
  setTimeout(()=>{let i=0;document.querySelectorAll('.card-alt').forEach(c=>{
    if(c.offsetParent)setTimeout(()=>c.classList.add('card-revealed'),i++*80);
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
  const by={};document.querySelectorAll('.card-alt[data-race]').forEach(c=>{by[c.dataset.race]=(by[c.dataset.race]||0)+1;});
  let all=0;Object.entries(by).forEach(([r,n])=>{const el=document.getElementById('cnt-'+r);if(el)el.textContent=n;all+=n;});
  const ca=document.getElementById('cnt-all');if(ca)ca.textContent=all;
};
window.sortCards=function(mode,btn){
  document.querySelectorAll('#sort-filters .fbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const container=document.getElementById('cards-container');
  const noRes=document.getElementById('no-results');
  const wraps=[...container.querySelectorAll('div[style*="contents"]')];
  const getCard=w=>w.querySelector('.card-alt');
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
        el.querySelector('.card-alt').dataset.index=idx;
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
        const card=el.querySelector('.card-alt');
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

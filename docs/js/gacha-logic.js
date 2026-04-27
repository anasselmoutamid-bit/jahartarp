/* ── gacha-logic.js — constantes, auth, data, UI, pull, animation ── */
/* Dépendances : db (firebase), FX (gacha-fx.js), blob (gacha-blob.js) */
// ═══ CONSTANTS ═══
const RCSS={'Common':'r-c','Uncommon':'r-u','Rare':'r-r','Epic':'r-e','Legendary':'r-l','Mythic':'r-m','Unique':'r-q','Artifact':'r-a','Mastercraft':'r-mc'};
const RCOL={'Common':'#8a8fa8','Uncommon':'#44ff88','Rare':'#4DA3FF','Epic':'#8B5CF6','Legendary':'#ffd60a','Mythic':'#ff8800','Unique':'#00ffcc','Artifact':'#ff006e','Mastercraft':'#ffffff'};
const RARITY_ORDER=['Common','Uncommon','Rare','Epic','Legendary','Mythic','Unique','Artifact','Mastercraft'];
const RC_CHIP={Common:'rc-c',Uncommon:'rc-u',Rare:'rc-r',Epic:'rc-e',Legendary:'rc-l',Mythic:'rc-m',Unique:'rc-q',Artifact:'rc-a',Mastercraft:'rc-mc'};
const LR_CHIP={Common:'lr-c',Uncommon:'lr-u',Rare:'lr-r',Epic:'lr-e',Legendary:'lr-l',Mythic:'lr-m',Unique:'lr-q',Artifact:'lr-a',Mastercraft:'lr-mc'};

const DEFAULT_BG={nexus_flux:'linear-gradient(135deg,#0a1628,#0d2847,#061a30)',arcanae_memorium:'linear-gradient(135deg,#1a0a28,#2d0d47,#1a0630)',golden_nexus:'linear-gradient(135deg,#281a0a,#473d0d,#302306)'};
function bannerAccent(id,name){
  if(id.includes('golden')||name.includes('Gold'))return '#ffd60a';
  if(id.includes('arcanae')||name.includes('Arcanae'))return '#8B5CF6';
  if(id.includes('rouge')||name.includes('Rouge'))return '#FF4757';
  if(id.includes('cyan')||name.includes('Cyan'))return '#00d4e8';
  if(id.includes('violet')||name.includes('Violet'))return '#8B5CF6';
  if(id.includes('blanc')||name.includes('Blanc'))return '#e8eaf0';
  if(id.includes('gris')||name.includes('Gris'))return '#8a8fa8';
  if(id.includes('dore')||name.includes('Doré'))return '#ffd60a';
  if(id.includes('indigo')||name.includes('Indigo'))return '#6366f1';
  if(id.includes('chrome')||name.includes('Chrome'))return '#a0a0a0';
  if(id.includes('arcane')||name.includes('Arcane'))return '#b44aff';
  if(id.includes('bastion')||name.includes('Bastion'))return '#60a5fa';
  if(id.includes('predateur')||name.includes('Préd'))return '#ef4444';
  if(id.includes('conscience')||name.includes('Conscience'))return '#06b6d4';
  if(id.includes('genesis')||name.includes('Genesis'))return '#22d3ee';
  if(id.includes('iron')||name.includes('Iron'))return '#94a3b8';
  if(id.includes('hero')||name.includes('Hero'))return '#f59e0b';
  return '#4DA3FF';
}

const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
let U=null,SB=null,BANNERS=[];
const IS_IRP = !!window._irpMode;
function currencyUnit(){ return IS_IRP ? 'JAHARTITE' : 'NAVARITE'; }
function currencyPlural(){ return IS_IRP ? 'JAHARTITES' : 'NAVARITES'; }
function currencyShort(){ return IS_IRP ? 'JAH' : 'NAV'; }
function applyIRPGachaLabels(){
  if(!IS_IRP) return;
  document.title='ATRAHAJ — Gacha IRP';
  const tag=document.querySelector('.hero-sub-tag');
  const desc=document.querySelector('.hero-sub-desc');
  const gate=document.querySelector('.gate-sub');
  const note=document.querySelector('.gate-note');
  if(tag) tag.textContent='Nexus System · Tirage IRP';
  if(desc) desc.textContent='Consulte les bannières IRP exclusives et ton solde de Jahartites.';
  if(gate) gate.innerHTML='Utilise la commande <strong style="color:#dc143c">/link</strong> sur le bot pour ouvrir une session site, y compris pour le Gacha IRP.';
  if(note) note.textContent='Code valable 5 min · usage unique · partage la session du hub et du gacha';
  const badge=document.querySelector('.nv-badge');
  if(badge) badge.innerHTML='<img src="https://firebasestorage.googleapis.com/v0/b/jaharta-rp.firebasestorage.app/o/icons%2FChatGPT%20Image%2013%20avr.%202026%2C%2018_19_29.png?alt=media&token=ac0476c3-965f-4806-aad0-ee6c917e02cd" alt="" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:4px;filter:drop-shadow(0 0 4px rgba(220,20,60,0.3))"> JAHARTITE <span class="nv-val" id="nv-c">0</span>';
  const pull=document.querySelector('.pull-nv');
  if(pull) pull.innerHTML='SOLDE : <span class="nv-count" id="pnv">0</span> JAHARTITE(S)';
  document.querySelectorAll('.btn-cost').forEach(function(el){
    el.innerHTML=el.innerHTML.replace(/NAVARITES?/gi, function(m){ return m.endsWith('S') ? currencyPlural() : currencyUnit(); }).replace(/\bNAV\b/g, currencyShort());
  });
  const pityLbls=document.querySelectorAll('.pity-lbl');
  if(pityLbls[0]) pityLbls[0].textContent='PITY LEG+';
  if(pityLbls[1]) pityLbls[1].textContent='PITY MYTH+';
  if(pityLbls[2]) pityLbls[2].textContent='STREAK JAHARTITE';
}
async function loadIRPBannersPage(){
  const [snap, cfgSnap, imgSnap] = await Promise.all([
    db.collection('irp_gacha_banners').get(),
    db.collection('irp_gacha_config').doc('rotation').get().catch(()=>null),
    db.collection('gacha_config').doc('banner_images').get().catch(()=>null),
  ]);

  /* Per-banner images from gacha_config/banner_images */
  const bannerImages = (imgSnap && imgSnap.exists) ? (imgSnap.data() || {}) : {};

  const raw=[];
  snap.forEach(function(d){
    const data = d.data() || {};
    raw.push({ id:d.id, ...data });
  });
  raw.sort(function(a,b){
    return (Number(a.order ?? 9999) - Number(b.order ?? 9999)) || String(a.name||a.id).localeCompare(String(b.name||b.id));
  });

  const cfg = (cfgSnap && cfgSnap.exists) ? (cfgSnap.data() || {}) : {};
  const activeIds = new Set(cfg.active_ids || raw.filter(b=>b.active).map(b=>b.id).slice(0,2));
  const nextIds = new Set(cfg.next_ids || []);
  window._irpRotationInfo = {
    days_until_next: Number(cfg.days_until_next ?? 7),
    rotation_days: Number(cfg.rotation_days ?? 7),
    next_rotation_at: cfg.next_rotation_at || '',
  };

  const out = [];
  raw.forEach(function(data){
    const rarities = data.rarities || {};
    const totalW = Object.values(rarities).reduce((sum, r) => sum + (Number(r.weight) || 0), 0) || 1;
    const normalized = {};
    Object.entries(rarities).forEach(function(entry){
      const rarity = entry[0];
      const info = entry[1] || {};
      normalized[rarity] = {
        pct: (((Number(info.weight) || 0) / totalW) * 100).toFixed(2),
        items: (info.items || []).map(function(it){
          return {
            id: it.id,
            name: it.name || (it.id || '').replace(/_/g,' '),
            icon: it.icon || '📦',
            qty: it.quantity || 1,
          };
        })
      };
    });
    const featuredNames=(data.featured || []).map(function(fid){
      for(const rarity in rarities){
        const found=((rarities[rarity]||{}).items || []).find(function(it){ return it.id===fid; });
        if(found) return found.name || fid;
      }
      return fid;
    });
    const status = activeIds.has(data.id) ? 'live' : (nextIds.has(data.id) ? 'next' : (data.status || 'next'));
    out.push({
      id: data.id,
      name: data.name || data.id,
      description: data.description || '',
      featured: featuredNames,
      featured_rarity: data.featured_rarity || 'legendary',
      image: data.image_url || data.image || (bannerImages[data.id] && bannerImages[data.id].url) || '',
      status,
      active: status === 'live',
      rarities: normalized,
    });
  });
  return out;
}
function renderIRPBannersPage(banners){
  const grid=document.getElementById('bg');
  const rot=document.getElementById('rot-info');
  const info=window._irpRotationInfo||{};
  if(rot){
    const jours=Number.isFinite(info.days_until_next)?info.days_until_next:'?';
    rot.textContent=banners.length ? 'Mode IRP actif — rotation auto 2 bannières / 7 jours · prochaine rotation dans '+jours+' jour(s)' : 'Mode IRP actif — aucune bannière IRP configurée';

    /* ── Bouton de rotation manuelle (admin uniquement) ── */
    if(window._isAdmin && !document.getElementById('irp-manual-rot-btn')){
      const btn=document.createElement('button');
      btn.id='irp-manual-rot-btn';
      btn.textContent='⟳ ROTATION MANUELLE';
      btn.style.cssText='margin-left:12px;padding:6px 14px;border-radius:6px;border:1px solid rgba(220,20,60,0.35);background:linear-gradient(135deg,rgba(220,20,60,0.15),rgba(139,0,0,0.15));color:#dc143c;font-family:var(--font-h);font-size:0.48rem;font-weight:700;letter-spacing:0.1em;cursor:pointer;transition:background 0.3s,box-shadow 0.3s;vertical-align:middle';
      btn.addEventListener('mouseenter',function(){btn.style.background='linear-gradient(135deg,rgba(220,20,60,0.3),rgba(139,0,0,0.3))';btn.style.boxShadow='0 0 12px rgba(220,20,60,0.25)';});
      btn.addEventListener('mouseleave',function(){btn.style.background='linear-gradient(135deg,rgba(220,20,60,0.15),rgba(139,0,0,0.15))';btn.style.boxShadow='none';});
      btn.addEventListener('click',function(){
        showConfirm('Forcer une rotation manuelle des bannières IRP ?',async function(){
        btn.disabled=true;btn.textContent='⟳ ROTATION...';
        try{
          /* Lire l'état actuel, avancer le pointer, persister */
          const cfgSnap=await db.collection('irp_gacha_config').doc('rotation').get();
          const state=cfgSnap.exists?cfgSnap.data():{};
          const order=state.banner_order||[];
          if(!order.length){showToast('Aucune bannière dans l\'ordre de rotation','error');btn.disabled=false;btn.textContent='⟳ ROTATION MANUELLE';return;}
          const oldPointer=Number(state.pointer||0);
          const step=Number(state.active_ids?.length||2);
          const newPointer=(oldPointer+step)%order.length;
          const now=new Date().toISOString();
          const rotDays=Number(state.rotation_days||7);
          const nextRot=new Date(Date.now()+rotDays*86400000).toISOString();
          const activeIds=[];for(let i=0;i<Math.min(step,order.length);i++)activeIds.push(order[(newPointer+i)%order.length]);
          const nextIds=[];for(let i=0;i<Math.min(step,order.length);i++)nextIds.push(order[(newPointer+step+i)%order.length]);
          await db.collection('irp_gacha_config').doc('rotation').set({
            ...state,
            pointer:newPointer,
            last_rotation:now,
            next_rotation_at:nextRot,
            active_ids:activeIds,
            next_ids:nextIds,
            manual_override:false,
            updated_at:now
          },{merge:false});
          /* Mettre à jour le statut des bannières */
          const batch=db.batch();
          for(const bid of order){
            const ref=db.collection('irp_gacha_banners').doc(bid);
            batch.update(ref,{active:activeIds.includes(bid),status:activeIds.includes(bid)?'live':'next',next_rotation_at:nextRot});
          }
          await batch.commit();
          showToast('Rotation effectuée !','success');
          /* Recharger les bannières */
          JCache.invalidate('irp_gacha_banners',null);JCache.invalidate('irp_gacha_config','rotation');
          const newBanners=await loadIRPBannersPage();
          renderIRPBannersPage(newBanners);
        }catch(err){
          window._dbg?.error('[MANUAL_ROTATION]',err);
          showToast('Erreur : '+err.message,'error');
        }finally{
          btn.disabled=false;btn.textContent='⟳ ROTATION MANUELLE';
        }
        });
      });
      rot.appendChild(btn);
    }
  }
  if(!grid) return;
  if(!banners.length){
    grid.innerHTML='<div class="empty" style="grid-column:1/-1;text-align:center;padding:48px 18px">Aucune bannière IRP configurée.</div>';
    return;
  }
  renderBanners(banners);
}

function ensureIRPCodeUI(){
  if(!IS_IRP) return;
  const ps=document.getElementById('ps');
  if(!ps || document.getElementById('irp-code-wrap')) return;
  const wrap=document.createElement('div');
  wrap.id='irp-code-wrap';
  wrap.style.cssText='margin-top:18px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap';
  wrap.innerHTML=''
    + '<input id="irp-special-code" type="text" maxlength="20" placeholder="Code IRP optionnel" '
    + 'style="min-width:220px;padding:12px 14px;border-radius:10px;border:1px solid rgba(220,20,60,.22);background:rgba(8,12,30,.8);color:#fff;font-family:var(--font-m);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase">'
    + '<div style="font-family:var(--font-m);font-size:.55rem;color:var(--text3);letter-spacing:.08em">LEG+ · Myth+ · item choisi</div>';
  ps.appendChild(wrap);
  const input=wrap.querySelector('#irp-special-code');
  if(input) input.addEventListener('input',updNV);
}

function getIRPSpecialCode(){
  const input=document.getElementById('irp-special-code');
  return input ? input.value.trim().toUpperCase() : '';
}


// ═══ SESSION (localStorage) — TTL 7 jours ═══
const SESSION_TTL_MS=7*24*60*60*1000;
function getSession(){
  try{
    const raw=localStorage.getItem('gacha_session')||localStorage.getItem('hub_session');
    if(!raw)return null;
    const s=JSON.parse(raw);
    /* Rejeter les sessions expirées */
    if(s._exp&&Date.now()>s._exp){clearSession();return null;}
    return s;
  }catch{return null;}
}
function setSession(s){
  const payload={...s,_exp:Date.now()+SESSION_TTL_MS};
  localStorage.setItem('gacha_session',JSON.stringify(payload));
  localStorage.setItem('hub_session',JSON.stringify(payload));
}
function clearSession(){
  localStorage.removeItem('gacha_session');
  localStorage.removeItem('hub_session');
}

// ═══ AUTH — Code verification via Firestore ═══
async function verifyCode(){
  const inp=document.getElementById('link-code');
  const errEl=document.getElementById('code-error');
  const spinner=document.getElementById('code-spinner');
  errEl.style.display='none';
  const code=inp.value.trim().toUpperCase();
  if(!code||code.length<5){showCodeError('Entre un code valide');return}
  spinner.style.display='inline-block';
  try{
    /* ── Transaction atomique : lecture + suppression en une seule opération ──
       Empêche la réutilisation du même code par deux onglets simultanés (TOCTOU). */
    const codeRef=db.collection('gacha_link_codes').doc(code);
    let sessionData=null;
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(codeRef);
      if(!snap.exists)throw Object.assign(new Error('Code invalide ou déjà utilisé'),{_userMsg:true});
      const data=snap.data();
      if(data.expires_at&&new Date(data.expires_at)<new Date()){
        tx.delete(codeRef);
        throw Object.assign(new Error('Code expiré — utilise /link pour en générer un nouveau'),{_userMsg:true});
      }
      tx.delete(codeRef);
      sessionData={id:data.discord_id,username:data.username,avatar:data.avatar_url};
    });
    setSession(sessionData);
    spinner.style.display='none';
    await loadAndShow();
  }catch(e){
    const msg=e._userMsg?e.message:'Erreur de connexion — réessaye';
    showCodeError(msg);
    spinner.style.display='none';
  }
}

function showCodeError(msg){
  const el=document.getElementById('code-error');
  el.textContent=msg;el.style.display='block';
}

function logout(){
  clearSession();U=null;SB=null;BANNERS=[];
  showLoginGate();
}

// ═══ DATA LOADING (Firestore) ═══
async function loadUser(){
  const s=getSession();
  if(!s||!s.id)return null;
  try{
    if(IS_IRP){
      /* Chaque read isolé : un échec sur players/pity ne doit pas
         empêcher la récupération des jahartites depuis irp_players */
      var [irp, main, pity] = await Promise.all([
        JCache.get(db,'irp_players',s.id,30).catch(function(e){window._dbg?.error('[IRP_PLAYERS]',e);return null;}),
        JCache.get(db,'players',s.id,30).catch(function(){return null;}),
        JCache.get(db,'irp_gacha_pity',s.id,30).catch(function(){return null;}),
      ]);
      /* Fallback direct Firestore si le cache a échoué pour irp_players */
      if(!irp){
        try{var snap=await db.collection('irp_players').doc(s.id).get();irp=snap.exists?snap.data():null;}
        catch(e2){window._dbg?.error('[IRP_PLAYERS_FALLBACK]',e2);}
      }
      U={
        id:s.id,
        username:(main&&main.username)||(irp&&irp.username)||s.username||'—',
        avatar:(main&&main.avatar_url)||(irp&&irp.avatar_url)||s.avatar||'',
        navarites:Number((irp&&irp.jahartites)||0),
        booster:false,
        pity:{
          spent_epic:(pity&&pity.jahartites_spent_leg)||0,
          threshold_epic:60,
          spent_leg:(pity&&pity.jahartites_spent_myth)||0,
          threshold_leg:180,
        },
        streak:{ days_in_cycle:((irp&&irp.consecutive_days)||0)%3 },
      };
      return U;
    }
    var [d, pity] = await Promise.all([
      JCache.get(db,'players',s.id,30).catch(function(e){window._dbg?.error('[PLAYERS]',e);return null;}),
      JCache.get(db,'gacha_pity',s.id,30).catch(function(e){window._dbg?.error('[GACHA_PITY]',e);return null;}),
    ]);
    /* Fallback direct Firestore si le cache a échoué pour players */
    if(!d){
      try{var snap=await db.collection('players').doc(s.id).get();d=snap.exists?snap.data():null;}
      catch(e2){window._dbg?.error('[PLAYERS_FALLBACK]',e2);}
    }
    U={
      id:s.id,
      username:(d&&d.username)||s.username||'—',
      avatar:(d&&d.avatar_url)||s.avatar||'',
      navarites:(d&&d.navarites)||0,
      booster:(d&&d.booster)||false,
      pity:{
        spent_epic:(pity&&pity.navarites_spent_epic)||0,
        threshold_epic:30,
        spent_leg:(pity&&pity.navarites_spent_leg)||0,
        threshold_leg:150,
      },
      streak:{
        days_in_cycle:((d&&d.consecutive_days)||0)%3,
      },
    };
    return U;
  }catch(e){
    window._dbg?.error('[LOAD_USER]',e);
    /* Fallback : utiliser les données de session brutes si Firestore échoue */
    const sf=getSession();
    if(sf&&sf.id){
      U={id:sf.id,username:sf.username||'—',avatar:sf.avatar||'',navarites:0,booster:false,pity:{spent_epic:0,threshold_epic:IS_IRP?60:30,spent_leg:0,threshold_leg:IS_IRP?180:150},streak:{days_in_cycle:0}};
      return U;
    }
    return null;
  }
}

async function loadBanners(){
  try{
    if(IS_IRP){
      BANNERS = await loadIRPBannersPage();
      renderIRPBannersPage(BANNERS);
      return;
    }
    /* Force fresh read (no stale cache) */
    JCache.invalidate('gacha_config','banners');
    const d=await JCache.get(db,'gacha_config','banners',30);
    if(!d)return;
    BANNERS=d.banners||[];
    // Load per-banner images and merge before rendering
    await loadBannerImages();
    renderBanners(BANNERS);
    const rot=d.rotation||{};
    const ri=document.getElementById('rot-info');
    if(ri){
      if(rot.manual_override)ri.textContent='Rotation manuelle active';
      else ri.textContent='Prochaine rotation dans '+(rot.days_until_next||'?')+' jour(s)';
    }
  }catch(e){window._dbg?.error('[LOAD_BANNERS]',e)}
}

/* ── Live banner updates via onSnapshot ── */
var _bannerUnsub = null;
function watchBanners(){
  if(IS_IRP || _bannerUnsub) return;
  try{
    _bannerUnsub = db.collection('gacha_config').doc('banners').onSnapshot(function(snap){
      if(!snap.exists) return;
      var d = snap.data();
      BANNERS = d.banners || [];
      loadBannerImages().then(function(){ renderBanners(BANNERS); });
      var rot = d.rotation || {};
      var ri = document.getElementById('rot-info');
      if(ri){
        if(rot.manual_override) ri.textContent='Rotation manuelle active';
        else ri.textContent='Prochaine rotation dans '+(rot.days_until_next||'?')+' jour(s)';
      }
    });
  }catch(e){window._dbg?.error('[BANNER_WATCH]',e)}
}

// ═══ ADMIN MODE — per-banner image editing ═══
function _applyAdminUI(){
  const main=document.getElementById('gacha-main');
  if(!main)return;
  main.classList.add('admin-mode');
  // Make non-live banners interactive for admin (they were rendered with pointer-events:none)
  main.querySelectorAll('.banner-flip').forEach(f=>{
    if(f.style.pointerEvents==='none'){
      f.style.pointerEvents='';
      f.style.opacity='0.7';
    }
  });
}
function showAdminBannerEditor(){
  /* Fast path : flag déjà setté */
  if(window._isAdmin===true){_applyAdminUI();return;}
  /* Sinon : tenter un live check (Firebase Auth peut être prêt même si
     auth-badge.js n'a pas encore fini son onAuthStateChanged) */
  try{
    const auth=firebase.auth();
    if(!auth.currentUser)return; /* Pas connecté → pas admin */
    db.collection('admins').doc(auth.currentUser.uid).get().then(function(snap){
      if(snap.exists){
        window._isAdmin=true;
        _applyAdminUI();
      }
    }).catch(function(e){window._dbg?.warn('[ADMIN_CHECK_LIVE]',e);});
  }catch(e){window._dbg?.warn('[ADMIN_CHECK]',e);}
}

// ═══ PER-BANNER IMAGE EDITOR ═══
function openBannerImgEditor(bid){
  // Close any other open editors
  document.querySelectorAll('.banner-img-editor.active').forEach(e=>e.classList.remove('active'));
  const editor=document.getElementById('bie-'+bid);
  if(!editor)return;
  editor.classList.add('active');
  // Show preview if URL exists
  const inp=document.getElementById('bie-url-'+bid);
  const prev=document.getElementById('bie-prev-'+bid);
  if(inp&&prev&&inp.value.trim()){prev.src=inp.value.trim();prev.style.display='block';}
}

function closeBannerImgEditor(bid){
  const editor=document.getElementById('bie-'+bid);
  if(editor)editor.classList.remove('active');
}

/* ── Vérification admin LIVE (contourne window._isAdmin potentiellement
   non initialisé si auth-badge.js (module) charge après ce script) ── */
async function _liveAdminCheck(){
  /* Fast path : flag déjà setté par auth-badge.js */
  if(window._isAdmin===true) return {ok:true,uid:firebase.auth().currentUser?.uid||'?'};
  /* Sinon : check Firebase Auth directement */
  try{
    const auth=firebase.auth();
    const user=auth.currentUser;
    if(!user){
      return {ok:false,reason:'no_auth',msg:'Pas connecté à Firebase. Ouvre admin.html dans un autre onglet et connecte-toi avec Google, puis reviens ici.'};
    }
    /* Fresh lookup dans admins/{uid} */
    const snap=await db.collection('admins').doc(user.uid).get();
    if(!snap.exists){
      return {ok:false,reason:'not_whitelisted',msg:'UID non whitelisté : '+user.uid+' ('+user.email+'). Ajoute ce UID dans admins/{uid} via la console Firebase.',uid:user.uid,email:user.email};
    }
    /* OK — synchroniser le flag pour les prochains appels */
    window._isAdmin=true;
    return {ok:true,uid:user.uid,email:user.email};
  }catch(e){
    return {ok:false,reason:'error',msg:'Erreur vérif admin : '+e.message};
  }
}

async function saveBannerImg(bid){
  const inp=document.getElementById('bie-url-'+bid);
  if(!inp){showToast('Erreur: input introuvable (bie-url-'+bid+')','error');return;}
  if(!U){showToast('Erreur: non connecté au gacha (fais /link sur Discord).','error');return;}
  /* Live admin check — ne se fie pas au flag stale window._isAdmin */
  const adm=await _liveAdminCheck();
  if(!adm.ok){
    window._dbg?.error('[SAVE_BANNER_IMG_ADMIN_CHECK]',adm);
    showToast(adm.msg||'Erreur admin','error',8000);
    return;
  }
  const url=inp.value.trim();
  try{
    await db.collection('gacha_config').doc('banner_images').set(
      {[bid]:{url:url,updated_at:new Date().toISOString()}},
      {merge:true}
    );
    /* IRP: also write image_url directly into the banner document */
    if(IS_IRP){
      try{
        await db.collection('irp_gacha_banners').doc(bid).set(
          {image_url:url,image:url},
          {merge:true}
        );
      }catch(_){}
    }
    // Update local banner data
    const b=BANNERS.find(x=>x.id===bid);
    if(b)b.image=url;
    // Update the art background live
    const card=document.querySelector('.banner-flip[data-id="'+bid+'"]');
    if(card){
      const artBg=card.querySelector('.banner-art-bg');
      const placeholder=card.querySelector('.banner-art-placeholder');
      if(artBg){
        if(url){
          artBg.style.backgroundImage="url('"+url+"')";
          artBg.style.background='';
          artBg.style.backgroundImage="url('"+url+"')";
          artBg.style.backgroundSize='cover';
          artBg.style.backgroundPosition='center';
        }else{
          artBg.style.backgroundImage='';
          artBg.style.background=DEFAULT_BG[bid]||'linear-gradient(135deg,#0a1628,#0d2847,#061a30)';
        }
      }
      if(placeholder){
        placeholder.style.display=url?'none':'flex';
      }
    }
    closeBannerImgEditor(bid);
    JCache.invalidate('gacha_config','banner_images');
    showToast('Image sauvegardée !','success');
  }catch(e){
    window._dbg?.error('[SAVE_BANNER_IMG]',e);
    showToast('Erreur : '+e.message,'error');
  }
}

// Load per-banner images from Firestore and merge into BANNERS
async function loadBannerImages(){
  try{
    const snap=await db.collection('gacha_config').doc('banner_images').get();
    if(!snap.exists)return;
    const data=snap.data();
    for(const b of BANNERS){
      if(data[b.id]&&data[b.id].url){
        b.image=data[b.id].url;
      }
    }
  }catch(e){window._dbg?.error('[LOAD_BANNER_IMAGES]',e)}
}

// ═══ UI STATE ═══
function showLoginGate(){
  applyIRPGachaLabels();
  document.getElementById('login-gate').style.display='flex';
  document.getElementById('gacha-main').classList.remove('active');
}

function showMainUI(){
  applyIRPGachaLabels();
  ensureIRPCodeUI();
  document.getElementById('login-gate').style.display='none';
  document.getElementById('gacha-main').classList.add('active');
  document.getElementById('u-av').src=U.avatar||'';
  document.getElementById('u-name').textContent=U.username||'—';
  document.getElementById('u-id').textContent='ID: '+(U.id||'—');
  const p=U.pity||{};
  document.getElementById('psr').textContent=Math.floor(p.spent_epic||0)+'/'+Math.floor(p.threshold_epic||30);
  document.getElementById('pleg').textContent=Math.floor(p.spent_leg||0)+'/'+Math.floor(p.threshold_leg||150);
  document.getElementById('psr-b').style.width=Math.min(100,Math.floor((p.spent_epic||0))/Math.floor(p.threshold_epic||30)*100)+'%';
  document.getElementById('pleg-b').style.width=Math.min(100,Math.floor((p.spent_leg||0))/Math.floor(p.threshold_leg||150)*100)+'%';
  const s=U.streak||{};
  document.getElementById('pstr').textContent=(s.days_in_cycle||0)+'/3';
  document.getElementById('pstr-b').style.width=((s.days_in_cycle||0)/3*100)+'%';
  updNV();
}

function updNV(){
  const n=U?U.navarites||0:0;
  document.getElementById('nv-c').textContent=n;
  document.getElementById('pnv').textContent=n;
  if(IS_IRP){
    const hasBanner=!!SB;
    const code=getIRPSpecialCode();
    document.getElementById('b1').disabled=n<1||!hasBanner;
    document.getElementById('b5').disabled=n<5||!hasBanner;
    document.getElementById('b10').disabled=n<10||!hasBanner;
    document.getElementById('b1').querySelector('span').innerHTML='PULL ×1<span class="btn-cost">1 JAHARTITE</span>';
    document.getElementById('b5').querySelector('span').innerHTML='PULL ×5<span class="btn-cost">5 JAH · +1 BONUS</span>';
    document.getElementById('b10').querySelector('span').innerHTML='PULL ×10<span class="btn-cost">10 JAH · +4 BONUS · 1 EPIC+</span>'+(code?'<span class="btn-cost" style="color:#dc143c;opacity:1">⚡ CODE ACTIF</span>':'');
    return;
  }
  document.getElementById('b1').disabled=n<1||!SB;
  document.getElementById('b5').disabled=n<5||!SB;
  document.getElementById('b10').disabled=n<10||!SB;
  // Reset x10 button text then apply boosts
  const b10=document.getElementById('b10');
  const costText = '10 NAV · +4 BONUS · 1 EPIC+';
  let extra = '';
  if(window.GACHA_SPECIALZ_ACTIVE && !window.GACHA_SPECIALZ_FIRST_PULL_USED){
    const isBoostedUser = window.GACHA_SPECIALZ_BOOSTED_IDS && U && window.GACHA_SPECIALZ_BOOSTED_IDS.includes(String(U.id));
    if(isBoostedUser){
      extra = '<span class="btn-cost" style="color:#ff006e;opacity:1">🔥 FULL LEG+ GARANTI</span>';
    } else {
      extra = '<span class="btn-cost" style="color:#ffd60a;opacity:1">⚡ LEG+ GARANTI</span>';
    }
  }
  b10.querySelector('span').innerHTML='PULL ×10<span class="btn-cost">'+costText+'</span>'+extra;
}

// ═══ TILT 3D ═══
const TILT=5;
function bindTilt(flipEl){
  flipEl.addEventListener('mousemove',e=>{
    if(flipEl.querySelector('.banner-flip-inner').classList.contains('facedown'))return;
    const r=flipEl.getBoundingClientRect();
    const nx=(e.clientX-r.left-r.width/2)/(r.width/2);
    const ny=(r.height/2-(e.clientY-r.top))/(r.height/2);
    flipEl.style.transform=`perspective(800px) rotateX(${(ny*TILT).toFixed(2)}deg) rotateY(${(nx*TILT).toFixed(2)}deg) scale(1.02)`;
    const rf=flipEl.querySelector('.banner-reflet');
    if(rf){
      const off=50+nx*38-ny*38,h=4,p0=Math.max(0,off-h-4),p1=Math.max(0,off-h),p2=Math.min(100,off+h),p3=Math.min(100,off+h+4),d=Math.min(1,Math.sqrt(nx*nx+ny*ny)*1.3);
      rf.style.background=`linear-gradient(45deg,transparent ${p0}%,rgba(77,163,255,${.06*d}) ${p1}%,rgba(255,255,255,${.16*d}) ${Math.round((p1+p2)/2)}%,rgba(77,163,255,${.06*d}) ${p2}%,transparent ${p3}%)`;
      rf.style.opacity='1';
    }
  });
  flipEl.addEventListener('mouseleave',()=>{
    flipEl.style.transform='';
    const rf=flipEl.querySelector('.banner-reflet');
    if(rf){rf.style.background='';rf.style.opacity='0';}
  });
}

// Text scramble
const CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*+=?!';
function scramble(el){if(!el)return;const o=el.dataset.orig||el.textContent;el.dataset.orig=o;let i=0;clearInterval(el._si);el._si=setInterval(()=>{el.textContent=o.split('').map((c,j)=>c===' '?' ':j<i?o[j]:CHARS[Math.floor(Math.random()*CHARS.length)]).join('');if(i>=o.length)clearInterval(el._si);i+=.5},35)}

function flipCard(inner){
  const isFd=inner.classList.contains('facedown');
  inner.classList.remove('flipping-to-back','flipping-to-front');
  void inner.offsetWidth;
  if(isFd){inner.classList.remove('facedown');inner.classList.add('flipping-to-front')}
  else{inner.classList.add('facedown');inner.classList.add('flipping-to-back')}
}

// ═══ RENDER BANNERS ═══
function renderBanners(banners){
  const g=document.getElementById('bg');g.innerHTML='';
  for(const b of banners){
    const c=bannerAccent(b.id,b.name);
    const live=b.status==='live';
    const hasImage=!!b.image;
    const bgStyle=hasImage
      ?`background-image:url('${b.image}');background-size:cover;background-position:center`
      :`background:${DEFAULT_BG[b.id]||'linear-gradient(135deg,#0a1628,#0d2847,#061a30)'}`;
    const sortedRarities=Object.entries(b.rarities||{}).sort((a,b)=>RARITY_ORDER.indexOf(a[0])-RARITY_ORDER.indexOf(b[0]));
    const chips=sortedRarities.map(([r,d])=>`<span class="rate-chip ${RC_CHIP[r]||'rc-c'}">${r} ${d.pct}%</span>`).join('');
    let loot='';
    for(const[r,d]of sortedRarities){
      const items=(d.items||[]).map(it=>{
        const label=it.qty>1?`${it.icon} ${it.name} ×${it.qty}`:`${it.icon} ${it.name}`;
        return `<span class="loot-item">${label}</span>`;
      }).join(' · ');
      loot+=`<div class="loot-section"><div class="loot-rlabel ${LR_CHIP[r]||'lr-c'}"><span>${r.toUpperCase()} — ${d.pct}%</span><span class="loot-chevron">▼</span></div><div class="loot-items-wrap"><div class="loot-items">${items||'—'}</div></div></div>`;
    }
    let featHtml='';
    if(b.featured&&b.featured.length){
      featHtml=`<div class="banner-featured"><span class="banner-featured-label">⭐ FEATURED</span> ${b.featured.join(', ')} <span class="banner-featured-bonus">(×2 drop)</span></div>`;
    }
    const selectBtn=live?`<button class="banner-select-btn" style="--rc:${c}" onclick="event.stopPropagation();selectBanner('${b.id}')">⚡ SÉLECTIONNER</button>`:'';

    // Placeholder if no image
    const placeholderHtml=hasImage?'':`
      <div class="banner-art-placeholder">
        <div class="banner-art-placeholder-icon">🎴</div>
        <div class="banner-art-placeholder-text">Image non définie</div>
      </div>`;

    const isAdminUser=window._isAdmin;
    const cardStyle=live?'':(isAdminUser?'style="opacity:.7"':'style="opacity:.3;pointer-events:none"');
    g.insertAdjacentHTML('beforeend',`
    <div class="banner-flip" data-id="${b.id}" ${cardStyle}>
      <div class="banner-flip-inner">
        <div class="banner-face banner-front" style="--rc:${c}">
          <div class="banner-reflet"></div>
          <div class="banner-glow" style="box-shadow:0 0 50px ${c}20,0 0 100px ${c}0a"></div>
          <div class="banner-scanlines"></div>
          <div class="banner-sweep" style="background:linear-gradient(90deg,transparent,${c}99,transparent)"></div>
          <div class="banner-art">
            <div class="banner-art-bg" style="${bgStyle}"></div>
            ${placeholderHtml}
            <div class="banner-art-ov"></div>
            <span class="b-status ${live?'live':'next'}">${live?'● LIVE':'○ PROCHAINE'}</span>
            <div class="banner-art-title">
              <div class="banner-name" style="color:${c}">${escHtml(b.name)}</div>
              <div class="banner-subtitle">${live?'BANNIÈRE ACTIVE':'EN ATTENTE'}</div>
            </div>
            <button class="banner-admin-edit" data-bid="${b.id}" title="Modifier l'image" aria-label="Modifier l image de la banniere">✏️</button>
          </div>
          <div class="banner-body">
            <div class="banner-desc">${escHtml(b.description||'')}</div>
            <div class="banner-rates">${chips}</div>
            ${featHtml}
            <div class="banner-actions">
              ${selectBtn}
              <div class="banner-flip-hint">↻ VOIR LES ITEMS</div>
            </div>
          </div>
          <!-- Per-banner image editor (admin only) -->
          <div class="banner-img-editor" id="bie-${b.id}">
            <div class="banner-img-editor-title">⚙ IMAGE — ${escHtml(b.name)}</div>
            <img class="banner-img-editor-preview" id="bie-prev-${b.id}" alt="Apercu">
            <input class="banner-img-editor-input" id="bie-url-${b.id}" placeholder="URL de l image (PNG, JPG, WEBP…)" value="${escHtml(b.image||'')}" spellcheck="false" autocomplete="off">
            <div class="banner-img-editor-actions">
              <button class="btn-save-img" data-save-bid="${b.id}">SAUVEGARDER</button>
              <button class="btn-cancel-img" onclick="event.stopPropagation();closeBannerImgEditor('${b.id}')">ANNULER</button>
            </div>
          </div>
        </div>
        <div class="banner-face back banner-back">
          <div class="back-title">TABLE DE LOOT COMPLÈTE</div>
          <div style="text-align:center;font-family:var(--font-m);font-size:.42rem;color:var(--text3);margin:-12px 0 14px;letter-spacing:.1em;opacity:.6">Clique sur une rareté pour déplier</div>
          ${loot}
          <div class="back-hint">↻ CLIQUER POUR REVENIR</div>
        </div>
      </div>
    </div>`);
  }
  g.querySelectorAll('.banner-flip').forEach(f=>{
    const inner=f.querySelector('.banner-flip-inner');
    const bid=f.dataset.id;
    const bdata=banners.find(x=>x.id===bid);
    const isLive=bdata&&bdata.status==='live';
    bindTilt(f);
    f.addEventListener('mouseenter',()=>scramble(f.querySelector('.banner-name')));
    f.addEventListener('click',(e)=>{
      // Don't flip if click is inside the image editor or admin edit button
      if(e.target.closest('.banner-img-editor')||e.target.closest('.banner-admin-edit'))return;
      if(!isLive)return;
      flipCard(inner);
    });
  });
  // Accordion toggle for loot sections
  g.querySelectorAll('.loot-rlabel').forEach(label=>{
    label.addEventListener('click',function(e){
      e.stopPropagation();
      this.closest('.loot-section').classList.toggle('open');
    });
  });
  // Preview image on input change
  g.querySelectorAll('.banner-img-editor-input').forEach(inp=>{
    inp.addEventListener('input',function(){
      const bid=this.id.replace('bie-url-','');
      const prev=document.getElementById('bie-prev-'+bid);
      if(prev&&this.value.trim()){prev.src=this.value.trim();prev.style.display='block';}
      else if(prev){prev.style.display='none';}
    });
    inp.addEventListener('click',function(e){e.stopPropagation();});
  });
  // Bind save buttons — must use addEventListener with proper async catch
  g.querySelectorAll('.btn-save-img[data-save-bid]').forEach(btn=>{
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      e.preventDefault();
      const bid=this.getAttribute('data-save-bid');
      saveBannerImg(bid).then(()=>{}).catch(err=>{
        window._dbg?.error('[SAVE_BANNER]',err);
        showToast('Erreur: '+err.message,'error');
      });
    });
  });
  // Bind edit ✏️ buttons
  g.querySelectorAll('.banner-admin-edit[data-bid]').forEach(btn=>{
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      openBannerImgEditor(this.getAttribute('data-bid'));
    });
  });
  // Height: use FRONT face only
  g.querySelectorAll('.banner-flip-inner').forEach(inner=>{
    const fr=inner.querySelector('.banner-front');
    requestAnimationFrame(()=>{
      const h=fr.offsetHeight;
      inner.style.height=h+'px';
      fr.style.height=h+'px';
      inner.querySelector('.banner-back').style.height=h+'px';
    });
  });
}

function selectBanner(id){
  const b=BANNERS.find(x=>x.id===id);
  if(!b||b.status!=='live')return;
  SB=id;
  const c=bannerAccent(b.id,b.name);
  document.getElementById('pb').textContent=b.name;
  document.getElementById('pb').style.color=c;
  // Highlight selected banner card
  document.querySelectorAll('.banner-flip').forEach(f=>{
    f.classList.remove('selected');
    const btn=f.querySelector('.banner-select-btn');
    if(btn){btn.textContent='⚡ SÉLECTIONNER';btn.style.color='';}
  });
  const sel=document.querySelector('.banner-flip[data-id="'+id+'"]');
  if(sel){
    sel.classList.add('selected');
    const btn=sel.querySelector('.banner-select-btn');
    if(btn){btn.textContent='✓ SÉLECTIONNÉE';btn.style.color='#fff';}
  }
  updNV();
  document.getElementById('ps').scrollIntoView({behavior:'smooth',block:'center'});
}

// ═══ PULL (via Firestore — bot processes server-side) ═══
let _pullBusy=false;
async function doPull(count){
  if(!SB||!U||_pullBusy)return;
  if((U.navarites||0)<count)return;
  _pullBusy=true;

  document.getElementById('b1').disabled=true;
  document.getElementById('b5').disabled=true;
  document.getElementById('b10').disabled=true;

  let pullRef;
  const collection = IS_IRP ? 'irp_gacha_pulls' : 'gacha_pulls';
  const specialzActive = !IS_IRP && window.GACHA_SPECIALZ_ACTIVE && count === 10 && !window.GACHA_SPECIALZ_FIRST_PULL_USED;
  try{
    if(!U||!U.id){showToast('Session expirée — reconnecte-toi','error');_pullBusy=false;updNV();return;}
    const payload={
      user_id:U.id,
      banner_id:SB,
      count:count,
      status:'pending',
      created_at:new Date().toISOString(),
    };
    if(IS_IRP){
      const irpCode=getIRPSpecialCode();
      if(irpCode) payload.special_code=irpCode;
    } else if (specialzActive) {
      payload.specialz_leg_plus=true;
    }
    pullRef=await db.collection(collection).add(payload);
  }catch(e){
    window._dbg?.error('[PULL]',e);
    showToast('Erreur réseau — réessaye','error');
    _pullBusy=false;updNV();return;
  }

  const resultPromise=new Promise((resolve,reject)=>{
    let unsub=()=>{};
    const timeout=setTimeout(()=>{unsub();reject(new Error("Timeout — le bot n'a pas répondu"))},30000);
    unsub=db.collection(collection).doc(pullRef.id).onSnapshot(
      snap=>{
        const d=snap.data();
        if(!d)return;
        if(d.status==='completed'){
          clearTimeout(timeout);unsub();resolve(d);
        }else if(d.status==='error'){
          clearTimeout(timeout);unsub();reject(new Error(d.error||'Erreur du bot'));
        }
      },
      err=>{clearTimeout(timeout);reject(err);}
    );
  });

  try{
    const [result]=await Promise.all([
      resultPromise,
      runPullAnimation(count),
    ]);

    U.navarites=IS_IRP ? result.jahartites : result.navarites;
    if (specialzActive) window.GACHA_SPECIALZ_FIRST_PULL_USED = true;
    const res=(result.results||[]).map(r=>({name:r.name,icon:r.icon||'📦',rarity:r.rarity,qty:r.qty||1}));
    await showPullResults(res,count);

    if(IS_IRP){
      const codeInput=document.getElementById('irp-special-code');
      if(codeInput) codeInput.value='';
      JCache.invalidate('irp_players',U.id);JCache.invalidate('irp_gacha_pity',U.id);
    }else{
      JCache.invalidate('players',U.id);JCache.invalidate('gacha_pity',U.id);
    }
    await loadUser();
    showMainUI();
  }catch(e){
    window._dbg?.error('[PULL]',e);
    dismiss();
    showToast(e.message||'Erreur lors du pull','error');
    if(IS_IRP){
      JCache.invalidate('irp_players',U?U.id:'');JCache.invalidate('irp_gacha_pity',U?U.id:'');
    }else{
      JCache.invalidate('players',U?U.id:'');JCache.invalidate('gacha_pity',U?U.id:'');
    }
    await loadUser();
    showMainUI();
  }finally{
    _pullBusy=false;
    try{await pullRef.delete().catch(()=>{})}catch(e){}
  }
}

// ═══ PULL ANIMATION (separated from result display) ═══
async function runPullAnimation(count){
  const ov=document.getElementById('po'),st=document.getElementById('pst'),bar=document.getElementById('bbar'),bui=document.querySelector('.blob-ui');
  const ra=document.getElementById('ra');
  ra.innerHTML='';ra.classList.remove('active');bui.style.display='flex';

  bReset();bActive=true;
  if(!bClock.running)bClock.start();
  animBlob();ov.classList.add('active');

  // Phase 1: Synchronizing
  st.textContent='SYNCHRONIZING NEXUS';bar.style.width='0%';
  await sleep(200);bar.style.width='25%';
  await sleep(2200);
  bCompact(.55,.28);

  // Phase 2: Channeling
  st.textContent='CHANNELING ENERGY';bar.style.width='50%';
  await sleep(2400);
  bCompact(.4,.18);

  // Phase 3: Materializing
  st.textContent='MATERIALIZING';bar.style.width='75%';
  bStartChannel();
  await sleep(1600);
  bCompact(.28,.1);
  await sleep(1600);
  bar.style.width='95%';
  await sleep(800);
  bar.style.width='100%';
}


// ═══════════════════════════════════════════════════════════════
//  FX PARTICLE ENGINE — comètes, étoiles, burst rareté
// ═══════════════════════════════════════════════════════════════

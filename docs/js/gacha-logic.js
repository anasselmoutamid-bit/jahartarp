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


// ═══ SESSION (localStorage + cookie fallback) — TTL 7 jours ═══
//
// Bug investigué : certains browsers (iOS Safari ITP, mode privé, navigateurs
// privacy-focused) purgent le localStorage à la fermeture → l'utilisateur
// se reconnecte à chaque ouverture. On double la persistance en écrivant
// AUSSI un cookie SameSite=Strict/Secure avec le payload, qui survit mieux
// aux purges ITP que localStorage.
//
// Bug "from_player_id mismatch" : Discord snowflakes (~18 chiffres) dépassent
// Number.MAX_SAFE_INTEGER (16 chiffres). Si une session a été créée à une
// époque où l'ID transitait en Number quelque part, le localStorage peut
// contenir un id LOSSY (3 derniers chiffres ≠ vrais). Le worker compare avec
// la session JWT (préservée) → mismatch. On détecte et force re-login.
const SESSION_TTL_MS=7*24*60*60*1000;
const COOKIE_NAME='jh_sess';

/* Sanity check : un Discord snowflake moderne est string de 17-20 chars.
   Si l'id est Number, ou < 17 chars, ou = NaN, on rejette → re-login. */
function _isValidSnowflake(idVal){
  if(idVal==null) return false;
  if(typeof idVal==='number') return false; /* number = lossy, on refuse */
  const s=String(idVal);
  if(s.length<17||s.length>20) return false;
  if(!/^\d+$/.test(s)) return false;
  return true;
}

function _writeCookie(name,value,maxAgeS){
  try{
    const v=encodeURIComponent(value);
    document.cookie=`${name}=${v}; max-age=${maxAgeS}; path=/; SameSite=Strict; Secure`;
  }catch(_){}
}
function _readCookie(name){
  try{
    const m=document.cookie.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));
    return m?decodeURIComponent(m[1]):null;
  }catch(_){return null;}
}
function _clearCookie(name){
  try{document.cookie=`${name}=; max-age=0; path=/; SameSite=Strict`;}catch(_){}
}

function getSession(){
  try{
    /* 1. localStorage prioritaire (le plus rapide) */
    let raw=localStorage.getItem('gacha_session')||localStorage.getItem('hub_session');
    /* 2. Fallback cookie si localStorage vide (browser a purgé) */
    if(!raw){
      raw=_readCookie(COOKIE_NAME);
      /* Restaure localStorage pour les prochains reads (si non-purgé) */
      if(raw){
        try{
          localStorage.setItem('hub_session',raw);
          localStorage.setItem('gacha_session',raw);
        }catch(_){}
      }
    }
    if(!raw)return null;
    const s=JSON.parse(raw);
    /* Rejeter les sessions expirées */
    if(s._exp&&Date.now()>s._exp){clearSession();return null;}
    /* Rejeter les sessions avec ID Discord lossy (snowflake parsé en Number
       à une époque ancienne → 3 derniers chiffres perdus → mismatch worker). */
    if(!_isValidSnowflake(s.id)){
      console.warn('[session] Discord ID invalide (snowflake lossy ou mal formé) — force re-login');
      clearSession();
      return null;
    }
    return s;
  }catch{return null;}
}
function setSession(s){
  /* Normalise l'id en string AVANT sauvegarde — protection définitive contre
     toute coercion future si l'appelant passe un Number. */
  const safe={...s};
  if(safe.id!=null) safe.id=String(safe.id);
  const payload={...safe,_exp:Date.now()+SESSION_TTL_MS};
  const json=JSON.stringify(payload);
  localStorage.setItem('gacha_session',json);
  localStorage.setItem('hub_session',json);
  _writeCookie(COOKIE_NAME,json,Math.floor(SESSION_TTL_MS/1000));
}
function clearSession(){
  localStorage.removeItem('gacha_session');
  localStorage.removeItem('hub_session');
  _clearCookie(COOKIE_NAME);
}

// ═══ AUTH — Code verification via /auth/link (génère JWT) ═══
//
// IMPORTANT — Avant le fix, ce code lisait directement gacha_link_codes/{code}
// en D1 et sauvait juste hub_session (id+username+avatar). Mais le JWT
// (localStorage.d1_jwt) restait VIDE → tous les appels API guard-by-session
// (friendships, friend_requests, characters update, ...) recevaient sid=""
// côté worker → 403 "must be one of the parties".
//
// Le fix : on délègue à window.d1LinkSignIn (du shim firebase-compat) qui
// appelle POST /api/auth/link sur le worker. Le worker valide le code,
// supprime le doc, signe un JWT contenant discord_id, et renvoie {token,user}.
// Le shim sauve le JWT en localStorage.d1_jwt → toutes les requêtes
// suivantes ont Authorization: Bearer <jwt> → worker reconnaît la session.
async function verifyCode(){
  const inp=document.getElementById('link-code');
  const errEl=document.getElementById('code-error');
  const spinner=document.getElementById('code-spinner');
  errEl.style.display='none';
  const code=inp.value.trim().toUpperCase();
  if(!code||code.length<5){showCodeError('Entre un code valide');return}
  spinner.style.display='inline-block';
  try{
    let sessionData=null;
    /* PRIMARY : POST /auth/link → JWT signé + code consumé côté worker. */
    if(typeof window.d1LinkSignIn==='function'){
      try{
        const user=await window.d1LinkSignIn(code);
        sessionData={id:user.discord_id,username:user.username,avatar:user.avatar_url};
      }catch(eAuth){
        console.warn('[verifyCode] d1LinkSignIn failed, fallback direct read:',eAuth&&eAuth.message);
        /* Si le worker a déjà consommé le code (404/410/400), ne PAS fallback */
        const msg=String(eAuth&&eAuth.message||'');
        if(msg.includes('404')||msg.includes('410')||msg.includes('400')) throw eAuth;
      }
    }
    /* FALLBACK : lecture directe D1 (sans JWT mais permet le login basique) */
    if(!sessionData){
      const codeRef=db.collection('gacha_link_codes').doc(code);
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
    }
    setSession(sessionData);
    spinner.style.display='none';
    await loadAndShow();
  }catch(e){
    /* Mesage utilisateur lisible — distingue 400 (code invalide), 410 (expiré)
       et 5xx (erreur serveur) si possible. */
    let msg='Erreur de connexion — réessaye';
    const txt=String(e&&e.message||e);
    if(txt.includes('410'))      msg='Code expiré — utilise /link pour en générer un nouveau';
    else if(txt.includes('404')||txt.includes('400')) msg='Code invalide ou déjà utilisé';
    else if(e&&e._userMsg)        msg=e.message;
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
    var _consDays = (d&&d.consecutive_days)||0;
    var _booster  = (d&&d.booster)||false;
    U={
      id:s.id,
      username:(d&&d.username)||s.username||'—',
      avatar:(d&&d.avatar_url)||s.avatar||'',
      navarites:(d&&d.navarites)||0,
      booster:_booster,
      pity:{
        spent_epic:(pity&&pity.navarites_spent_epic)||0,
        threshold_epic:30,
        spent_leg:(pity&&pity.navarites_spent_leg)||0,
        threshold_leg:150,
      },
      streak:{
        consecutive_days:_consDays,
        // True iff non-booster has reached the 3-day streak (booster has no streak gate).
        active:(_booster||_consDays>=3),
        // Capped progress for the bar before activation. Once active, stays at 3.
        days_in_cycle:Math.min(_consDays,3),
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
  // Owner free buttons — n'apparaissent que pour l'owner (cliquables si banner active)
  const ownerRow=document.getElementById('owner-free-row');
  const isOwner=!IS_IRP && String((U&&U.id)||'')===OWNER_ID;
  if(ownerRow){
    ownerRow.style.display=isOwner?'flex':'none';
  }
  /* Owner-only : picker d'animation d'intro VIP. Le choix est persisté en
     localStorage et lu par gacha-vip.js au prochain refresh. */
  const animRow=document.getElementById('owner-anim-row');
  if(animRow){
    animRow.style.display=isOwner?'flex':'none';
    if(isOwner){
      let curAnim='default';
      try{ curAnim=localStorage.getItem('gacha_owner_anim_override')||'default'; }catch(_){}
      animRow.querySelectorAll('.owner-btn-anim').forEach(function(b){
        b.classList.toggle('active', b.getAttribute('data-anim')===curAnim);
      });
    }
  }
  const p=U.pity||{};
  document.getElementById('psr').textContent=Math.floor(p.spent_epic||0)+'/'+Math.floor(p.threshold_epic||30);
  document.getElementById('pleg').textContent=Math.floor(p.spent_leg||0)+'/'+Math.floor(p.threshold_leg||150);
  document.getElementById('psr-b').style.width=Math.min(100,Math.floor((p.spent_epic||0))/Math.floor(p.threshold_epic||30)*100)+'%';
  document.getElementById('pleg-b').style.width=Math.min(100,Math.floor((p.spent_leg||0))/Math.floor(p.threshold_leg||150)*100)+'%';
  const s=U.streak||{};
  const pstrEl=document.getElementById('pstr');
  const pstrLbl=pstrEl ? pstrEl.parentElement.querySelector('.pity-lbl') : null;
  if(IS_IRP){
    // IRP keeps the legacy %3 display (jahartites: gain daily on validation, no gate)
    pstrEl.textContent=(s.days_in_cycle||0)+'/3';
    document.getElementById('pstr-b').style.width=((s.days_in_cycle||0)/3*100)+'%';
  } else if(U.booster){
    pstrEl.textContent='✓ BOOST';
    if(pstrLbl) pstrLbl.textContent='BOOSTER · GAINS ACTIFS';
    document.getElementById('pstr-b').style.width='100%';
  } else if(s.active){
    pstrEl.textContent=(s.consecutive_days||0)+'j';
    if(pstrLbl) pstrLbl.textContent='STREAK ACTIVE · +1/JOUR';
    document.getElementById('pstr-b').style.width='100%';
  } else {
    pstrEl.textContent=(s.days_in_cycle||0)+'/3';
    if(pstrLbl) pstrLbl.textContent='STREAK · GAINS VERROUILLÉS';
    document.getElementById('pstr-b').style.width=((s.days_in_cycle||0)/3*100)+'%';
  }
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
  // Owner guaranteed buttons : conditionnés à la bannière active uniquement
  ['bfleg','bfmyth','bfart'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=!SB;});
  const bfc=document.getElementById('bfchoose');
  if(bfc) bfc.disabled=!SB||(U?(U.navarites||0)<250:true);
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

// ═══ FEATURED NAME RESOLVER ═══
// Les items des bannières n'ont PAS de champ `id` (juste name/icon/qty),
// alors que `featured` stocke des slugs (ex: "filament_cyan_gants").
// On résout chaque slug vers le nom réel de l'item par correspondance de
// tokens INDÉPENDANTE DE L'ORDRE ("filament_cyan_gants" == "Gants Filament Cyan").
function _slugTokens(s){
  return String(s||'')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')  // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim().split(/\s+/).filter(Boolean);
}
function resolveFeatured(b){
  const feats = b.featured || [];
  // Index de tous les items de la bannière (toutes raretés confondues)
  const items = [];
  const rar = b.rarities || {};
  for(const r in rar){
    const list = (rar[r] && rar[r].items) || [];
    for(const it of list){
      items.push({ id: it.id, name: it.name, icon: it.icon||'', tokens: new Set(_slugTokens(it.name)) });
    }
  }
  return feats.map(function(fid){
    // 1) match direct par id si présent
    if(typeof fid==='string'){
      for(const it of items){ if(it.id && it.id===fid) return { name: it.name, icon: it.icon }; }
    }
    // 2) match par tokens (ordre-indépendant) : tous les tokens du slug
    //    doivent être présents dans le nom ; on garde le nom le plus serré.
    const ftoks = _slugTokens(fid);
    if(ftoks.length){
      let best=null, bestScore=-Infinity;
      for(const it of items){
        let shared=0; for(const t of ftoks){ if(it.tokens.has(t)) shared++; }
        if(shared!==ftoks.length) continue;            // il faut TOUT le slug
        const score = shared*100 - it.tokens.size;     // pénalise les noms trop longs
        if(score>bestScore){ bestScore=score; best=it; }
      }
      if(best) return { name: best.name, icon: best.icon };
      // 3) fallback : joli titre depuis le slug (jamais l'id brut)
      return { name: ftoks.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' '), icon:'' };
    }
    return { name: String(fid), icon:'' };
  });
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
      const featLabels=resolveFeatured(b).map(function(x){
        return (x.icon?x.icon+' ':'')+escHtml(x.name);
      }).join(', ');
      featHtml=`<div class="banner-featured"><span class="banner-featured-label">⭐ FEATURED</span> ${featLabels} <span class="banner-featured-bonus">(×2 drop)</span></div>`;
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
            <button class="banner-admin-edit" data-bid="${b.id}" title="Modifier l'image" aria-label="Modifier l image de la banniere">✏️</button>
          </div>
          <div class="banner-body">
            <div class="banner-art-title">
              <div class="banner-name" style="color:${c}">${escHtml(b.name)}</div>
              <div class="banner-subtitle">${live?'BANNIÈRE ACTIVE':'EN ATTENTE'}</div>
            </div>
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

// ═══ PULL (standalone — Worker traite directement, pas de bot) ═══
let _pullBusy=false;
const OWNER_ID='372065190142803982';
const _API=window.__D1_API_BASE__||'https://jahartarp-api.jahartarp.workers.dev/api';

async function doPull(count, isFree=false){
  if(!SB||!U||_pullBusy)return;
  if(isFree && String(U.id)!==OWNER_ID){showToast('Owner only','error');return;}
  if(!isFree && (U.navarites||0)<count){showToast('Navarites insuffisants','error');return;}
  _pullBusy=true;
  document.getElementById('b1').disabled=true;
  document.getElementById('b5').disabled=true;
  document.getElementById('b10').disabled=true;

  // IRP : toujours via l'ancien système (bot)
  if(IS_IRP){
    await _doPullIRP(count);
    _pullBusy=false;
    return;
  }

  const specialzActive=window.GACHA_SPECIALZ_ACTIVE && count===10 && !window.GACHA_SPECIALZ_FIRST_PULL_USED;

  // Appel direct au Worker — synchrone, résultat immédiat
  const pullPromise=(async()=>{
    const jwt=localStorage.getItem('d1_jwt')||'';
    const payload={banner_id:SB, count};
    if(isFree)           payload.free=true;
    if(specialzActive)   payload.specialz_leg_plus=true;
    const r=await fetch(`${_API}/gacha/pull`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${jwt}`},
      body:JSON.stringify(payload),
    });
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||`Erreur ${r.status}`);
    return data;
  })();

  try{
    const [result]=await Promise.all([pullPromise, runPullAnimation(count)]);

    U.navarites=result.navarites;
    if(specialzActive) window.GACHA_SPECIALZ_FIRST_PULL_USED=true;
    const res=(result.results||[]).map(r=>({name:r.name,icon:r.icon||'📦',rarity:r.rarity,qty:r.qty||1}));
    await showPullResults(res,count);
    JCache.invalidate('players',U.id);
    JCache.invalidate('gacha_pity',U.id);
    await loadUser();
    showMainUI();
  }catch(e){
    window._dbg?.error('[PULL]',e);
    dismiss();
    showToast(e.message||'Erreur lors du pull','error');
    JCache.invalidate('players',U?U.id:'');
    JCache.invalidate('gacha_pity',U?U.id:'');
    await loadUser();
    showMainUI();
  }finally{
    _pullBusy=false;
  }
}

// ═══ OWNER GUARANTEED PULLS ═══

async function doOwnerGuaranteed(mode){
  if(!SB||!U||_pullBusy)return;
  if(String(U.id)!==OWNER_ID){showToast('Owner only','error');return;}
  _pullBusy=true;
  const count=(mode==='artifact')?1:3;
  try{
    const jwt=localStorage.getItem('d1_jwt')||'';
    const pullPromise=(async()=>{
      const r=await fetch(`${_API}/gacha/pull`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${jwt}`},
        body:JSON.stringify({banner_id:SB,count,free:true,owner_mode:mode}),
      });
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||`Erreur ${r.status}`);
      return data;
    })();
    const [result]=await Promise.all([pullPromise,runPullAnimation(count)]);
    U.navarites=result.navarites;
    const res=(result.results||[]).map(r=>({name:r.name,icon:r.icon||'📦',rarity:r.rarity,qty:r.qty||1}));
    await showPullResults(res,count);
    JCache.invalidate('players',U.id);
    JCache.invalidate('gacha_pity',U.id);
    await loadUser();
    showMainUI();
  }catch(e){
    window._dbg?.error('[OWNER_PULL]',e);
    dismiss();
    showToast(e.message||'Erreur lors du pull','error');
    JCache.invalidate('players',U?U.id:'');
    await loadUser();
    showMainUI();
  }finally{
    _pullBusy=false;
  }
}

// ═══ OWNER ANIM OVERRIDE ═══
// Persiste le choix d'animation d'intro VIP en localStorage. Lu par
// gacha-vip.js au prochain refresh (effet pas immédiat — l'intro a déjà
// joué pour la session courante).
function setOwnerAnim(value){
  if(!U||String(U.id)!==OWNER_ID){ showToast('Owner only','error'); return; }
  try{
    if(!value || value==='default'){
      localStorage.removeItem('gacha_owner_anim_override');
    } else {
      localStorage.setItem('gacha_owner_anim_override', value);
    }
  }catch(_){}
  document.querySelectorAll('.owner-btn-anim').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-anim')===(value||'default'));
  });
  const LABELS={
    default:'Jarvis cyan (par défaut)',
    '213985774771765248':'Godzilla (Kaijuu)',
    '769193650915246131':'Jarvis rose (Partenaire)',
    '424937768704147458':'Jarvis violet (Admin)',
    off:'Désactivée'
  };
  showToast('Animation : '+(LABELS[value]||value)+' · effet au prochain refresh','success');
}
window.setOwnerAnim=setOwnerAnim;

// ═══ CHOSEN ITEM PULL ═══

let _chosenItemId=null;
let _bannerRawCache=null;

async function openChosenModal(){
  if(!SB||!U||_pullBusy)return;
  if(String(U.id)!==OWNER_ID){showToast('Owner only','error');return;}
  if((U.navarites||0)<250){showToast('250 Navarites requis','error');return;}

  if(!_bannerRawCache){
    try{
      const r=await fetch(`${_API}/docs/gacha_config/banners_raw`);
      if(!r.ok)throw new Error('fetch failed');
      _bannerRawCache=await r.json();
    }catch(e){showToast('Erreur chargement bannière','error');return;}
  }

  const bdata=_bannerRawCache&&_bannerRawCache[SB];
  if(!bdata||!bdata.rarities){showToast('Aucun item disponible','error');return;}

  // Collect items with id from banner
  const items=[];
  const RARITY_ORDER_CM=['Mastercraft','Artifact','Unique','Mythic','Legendary','Epic','Rare','Uncommon','Common'];
  for(const rarity of RARITY_ORDER_CM){
    const rdata=bdata.rarities[rarity];
    if(!rdata)continue;
    for(const it of (rdata.items||[])){
      if(it.id&&(it.type==='item'||!it.type)){
        items.push({id:it.id,name:(it.name||(it.id||'').replace(/_/g,' ')),icon:it.icon||'📦',rarity});
      }
    }
  }
  if(!items.length){showToast('Aucun item disponible dans cette bannière','error');return;}

  _chosenItemId=null;
  _injectChosenModalStyles();

  let overlay=document.getElementById('chosen-modal-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='chosen-modal-overlay';
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeChosenModal();});
    document.body.appendChild(overlay);
  }

  const byRarity={};
  for(const it of items){if(!byRarity[it.rarity])byRarity[it.rarity]=[];byRarity[it.rarity].push(it);}

  let sections='';
  for(const rarity of RARITY_ORDER_CM){
    if(!byRarity[rarity]||!byRarity[rarity].length)continue;
    const col=RCOL[rarity]||'#ccc';
    sections+=`<div class="cm-section-title" style="color:${col}">${rarity.toUpperCase()}</div><div class="cm-items-grid">`;
    for(const it of byRarity[rarity]){
      const safeId=it.id.replace(/'/g,"\\'");
      sections+=`<div class="cm-item" data-id="${it.id}" style="--rk:${col}" onclick="_selectChosenItem('${safeId}',this)">
        <div class="cm-item-icon">${it.icon}</div>
        <div class="cm-item-name">${it.name.replace(/_/g,' ')}</div>
        <div class="cm-item-rarity" style="color:${col}">${rarity}</div>
      </div>`;
    }
    sections+='</div>';
  }

  overlay.innerHTML=`<div class="cm-panel">
    <div class="cm-header">
      <div><div class="cm-title">CHOISIR UN ITEM</div><div class="cm-sub">250 NAVARITES · ITEM GARANTI · BANNIÈRE ACTIVE</div></div>
      <button class="cm-close" onclick="closeChosenModal()">✕</button>
    </div>
    <div class="cm-body">${sections}</div>
    <div class="cm-footer">
      <span class="cm-selection" id="cm-selection">Aucun item sélectionné</span>
      <button class="cm-confirm" id="cm-confirm" disabled onclick="doChosenPull()">CONFIRMER · 250 NAV</button>
    </div>
  </div>`;

  overlay.style.display='flex';
  document.body.style.overflow='hidden';
}

function _injectChosenModalStyles(){
  if(document.getElementById('cm-styles'))return;
  const s=document.createElement('style');
  s.id='cm-styles';
  s.textContent=`
    #chosen-modal-overlay{position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,.88);backdrop-filter:blur(10px)}
    .cm-panel{background:var(--g-card,#0a0f1e);border:1px solid rgba(255,214,10,.22);border-radius:16px;width:min(720px,96vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;font-family:var(--font-h,'Orbitron',sans-serif)}
    .cm-header{padding:20px 24px 16px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .cm-title{font-size:.7rem;font-weight:700;letter-spacing:.18em;color:#ffd60a}
    .cm-sub{font-size:.45rem;letter-spacing:.1em;opacity:.45;font-family:var(--font-m,'Share Tech Mono',monospace);margin-top:5px}
    .cm-close{background:none;border:none;color:#888;cursor:pointer;font-size:1.1rem;padding:2px 8px;line-height:1;flex-shrink:0}.cm-close:hover{color:#fff}
    .cm-body{overflow-y:auto;padding:16px 24px;flex:1;display:flex;flex-direction:column;gap:12px}
    .cm-section-title{font-size:.48rem;letter-spacing:.15em;opacity:.55;font-family:var(--font-m,'Share Tech Mono',monospace);padding:6px 0 8px;border-bottom:1px solid rgba(255,255,255,.05)}
    .cm-items-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:9px}
    .cm-item{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px 10px;cursor:pointer;text-align:center;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:7px}
    .cm-item:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.18)}
    .cm-item.selected{border-color:var(--rk,#ffd60a)!important;background:rgba(255,214,10,.06)!important;box-shadow:0 0 18px rgba(255,214,10,.1)}
    .cm-item-icon{font-size:1.7rem;line-height:1}
    .cm-item-name{font-size:.4rem;letter-spacing:.05em;opacity:.85;line-height:1.4;word-break:break-word}
    .cm-item-rarity{font-size:.36rem;letter-spacing:.1em;padding:2px 7px;border-radius:4px;border:1px solid currentColor;opacity:.75}
    .cm-footer{padding:16px 24px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;gap:12px}
    .cm-selection{font-size:.46rem;font-family:var(--font-m,'Share Tech Mono',monospace);opacity:.45;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cm-confirm{font-family:var(--font-h,'Orbitron',sans-serif);font-size:.52rem;font-weight:700;letter-spacing:.14em;padding:12px 22px;border:1px solid rgba(255,214,10,.35);border-radius:10px;background:linear-gradient(135deg,rgba(255,214,10,.1),rgba(255,214,10,.03));color:#ffd60a;cursor:pointer;transition:all .2s;white-space:nowrap}
    .cm-confirm:hover:not(:disabled){border-color:#ffd60a;box-shadow:0 0 20px rgba(255,214,10,.2)}
    .cm-confirm:disabled{opacity:.22;cursor:not-allowed}
  `;
  document.head.appendChild(s);
}

function _selectChosenItem(id,el){
  _chosenItemId=id;
  document.querySelectorAll('.cm-item.selected').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  const name=el.querySelector('.cm-item-name')?.textContent||id;
  const sel=document.getElementById('cm-selection');
  if(sel)sel.textContent='Sélectionné : '+name;
  const btn=document.getElementById('cm-confirm');
  if(btn)btn.disabled=false;
}

function closeChosenModal(){
  const el=document.getElementById('chosen-modal-overlay');
  if(el)el.style.display='none';
  document.body.style.overflow='';
  _chosenItemId=null;
}

async function doChosenPull(){
  if(!_chosenItemId||!SB||!U||_pullBusy)return;
  if((U.navarites||0)<250){showToast('250 Navarites requis','error');return;}
  /* Capture l'id AVANT closeChosenModal() — qui remet _chosenItemId à null */
  const chosenId=_chosenItemId;
  closeChosenModal();
  _pullBusy=true;
  try{
    const jwt=localStorage.getItem('d1_jwt')||'';
    const pullPromise=(async()=>{
      const r=await fetch(`${_API}/gacha/pull`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${jwt}`},
        body:JSON.stringify({banner_id:SB,count:1,chosen_item_id:chosenId}),
      });
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||`Erreur ${r.status}`);
      return data;
    })();
    const [result]=await Promise.all([pullPromise,runPullAnimation(1)]);
    U.navarites=result.navarites;
    const res=(result.results||[]).map(r=>({name:r.name,icon:r.icon||'📦',rarity:r.rarity,qty:r.qty||1}));
    await showPullResults(res,1);
    JCache.invalidate('players',U.id);
    JCache.invalidate('gacha_pity',U.id);
    await loadUser();
    showMainUI();
  }catch(e){
    window._dbg?.error('[CHOSEN_PULL]',e);
    dismiss();
    showToast(e.message||'Erreur lors du pull','error');
    JCache.invalidate('players',U?U.id:'');
    await loadUser();
    showMainUI();
  }finally{
    _pullBusy=false;
    _chosenItemId=null;
  }
}

// IRP inchangé — conserve l'ancien système bot
async function _doPullIRP(count){
  const collection='irp_gacha_pulls';
  let pullRef;
  try{
    if(!U?.id){showToast('Session expirée','error');return;}
    const payload={user_id:U.id,banner_id:SB,count,status:'pending',created_at:new Date().toISOString()};
    const irpCode=getIRPSpecialCode();
    if(irpCode) payload.special_code=irpCode;
    pullRef=await db.collection(collection).add(payload);
  }catch(e){showToast('Erreur réseau','error');return;}

  const resultPromise=new Promise((resolve,reject)=>{
    let unsub=()=>{};
    const t=setTimeout(()=>{unsub();reject(new Error('Timeout — bot non répondu'))},30000);
    unsub=db.collection(collection).doc(pullRef.id).onSnapshot(
      snap=>{const d=snap.data();if(!d)return;
        if(d.status==='completed'){clearTimeout(t);unsub();resolve(d);}
        else if(d.status==='error'){clearTimeout(t);unsub();reject(new Error(d.error||'Erreur bot'));}},
      e=>{clearTimeout(t);reject(e);}
    );
  });

  try{
    const [result]=await Promise.all([resultPromise,runPullAnimation(count)]);
    U.navarites=result.jahartites??U.navarites;
    const res=(result.results||[]).map(r=>({name:r.name,icon:r.icon||'📦',rarity:r.rarity,qty:r.qty||1}));
    await showPullResults(res,count);
    const inp=document.getElementById('irp-special-code');if(inp)inp.value='';
    JCache.invalidate('irp_players',U.id);JCache.invalidate('irp_gacha_pity',U.id);
    await loadUser();showMainUI();
  }catch(e){
    dismiss();showToast(e.message||'Erreur pull IRP','error');
    JCache.invalidate('irp_players',U?U.id:'');JCache.invalidate('irp_gacha_pity',U?U.id:'');
    await loadUser();showMainUI();
  }finally{
    try{await pullRef?.delete().catch(()=>{})}catch(e){}
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

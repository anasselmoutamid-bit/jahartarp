/* ═══════════════════════════════════════════════════════════════════════
   docs/js/hub-shops.js — Systèmes Mon Shop, Alloc Stats, Shops, Universal Shop
   ═══════════════════════════════════════════════════════════════════════
   Fonctions exposées : renderMonShop, toggleShopOpen, addToShop, removeFromShop,
                        initAlloc, confirmAlloc, loadShops, renderShopsList,
                        buyFromPlayerShop, loadUshop, renderUshop, buyFromUshop
   ═══════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════
// MON SHOP (shop personnel du joueur)
// ══════════════════════════════════════════════
let MY_SHOP_DATA = null;
let _monshopLoaded = false;

async function loadMonShop(){
  const el = document.getElementById('monshop-content');
  if(!el) return;
  if(!UID || !CHAR_ID){ el.innerHTML='<div class="empty">Aucun personnage actif</div>'; return; }
  el.innerHTML='<div class="empty">Chargement...</div>';
  try{
    MY_SHOP_DATA = await cachedGet(C.SHOPS,(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`),'_monshop',60);
    _monshopLoaded = true;
    renderMonShop();
  }catch(err){ window._dbg?.error('[MONSHOP]',err); el.innerHTML='<div class="empty">Erreur de chargement</div>'; }
}

function renderMonShop(){
  const el = document.getElementById('monshop-content');
  if(!el) return;

  if(!MY_SHOP_DATA){
    el.innerHTML=`
      <div class="card"><div class="card-body" style="text-align:center;padding:40px 20px">
        <div style="font-size:3rem;margin-bottom:16px">🏪</div>
        <div style="font-family:var(--font-b);font-weight:700;font-size:1.1rem;color:var(--text);margin-bottom:8px">Pas encore de boutique</div>
        <div style="font-family:var(--font-m);font-size:.5rem;letter-spacing:.08em;color:var(--text3)">Utilise <span style="color:var(--blue)">/char_shop_create</span> dans Discord pour créer ta boutique</div>
      </div></div>`;
    return;
  }

  const s = MY_SHOP_DATA;
  const shopItems = s.items || {};
  const entries = Object.entries(shopItems);
  const statusColor = s.open ? 'var(--green)' : 'var(--red)';
  const statusLabel = s.open ? '● OUVERT' : '● FERMÉ';
  const toggleLabel = s.open ? 'Fermer la boutique' : 'Ouvrir la boutique';
  const toggleColor = s.open ? 'var(--red)' : 'var(--green)';

  // Items dans l'inventaire qui ne sont PAS déjà en vente
  const invItems = (INV_DATA && INV_DATA.items) || {};
  const sellable = Object.entries(invItems).filter(([id, qty]) => {
    if(qty <= 0) return false;
    if(shopItems[id]) return false; // déjà en vente
    const it = ALL_ITEMS_DATA[id] || {};
    // Ne pas vendre les items équipés
    const equipped = (INV_DATA && INV_DATA.equipped_assets) || [];
    if(equipped.includes(id)) return false;
    return true;
  });

  el.innerHTML=`
    <div class="card" style="margin-bottom:20px"><div class="card-body">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-family:var(--font-h);font-weight:800;font-size:1.4rem;color:var(--text)">${e(s.name||'Mon Shop')}</div>
        <span style="font-family:var(--font-m);font-size:.48rem;letter-spacing:.1em;color:${statusColor}">${statusLabel}</span>
      </div>
      <div style="font-family:var(--font-m);font-size:.52rem;letter-spacing:.06em;color:var(--text3);margin-bottom:16px">${e(s.tagline||'Aucune accroche')}</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px">
        <div><div style="font-family:var(--font-h);font-weight:800;font-size:1.4rem;color:var(--blue)">${entries.length}</div><div style="font-family:var(--font-m);font-size:.42rem;letter-spacing:.1em;color:var(--text3)">ARTICLES EN VENTE</div></div>
        <div><div style="font-family:var(--font-h);font-weight:800;font-size:1.4rem;color:var(--gold)">${(s.sales_log||[]).length}</div><div style="font-family:var(--font-m);font-size:.42rem;letter-spacing:.1em;color:var(--text3)">VENTES RÉCENTES</div></div>
      </div>
      <button onclick="toggleShopOpen()" style="padding:8px 20px;border-radius:8px;border:1px solid ${toggleColor};background:transparent;color:${toggleColor};font-family:var(--font-b);font-size:.72rem;font-weight:600;cursor:pointer;transition:border-color .2s,color .2s,background .2s">${toggleLabel}</button>
    </div></div>

    ${entries.length ? `
    <div class="card" style="margin-bottom:20px"><div class="card-body">
      <div class="sh" style="margin-bottom:14px"><span class="sh-num">—</span><span class="sh-title">Articles en vente</span><div class="sh-line"></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        ${entries.map(([item_id, si])=>{
          const it = ALL_ITEMS_DATA[item_id] || {};
          const rarity = (it.rarity||'common').toLowerCase();
          const rc = RARITY_COLORS[rarity]||'#6b7280';
          const effects = it.stat_effects || it.stats || {};
          const effStr = Object.entries(effects).slice(0,2).map(([s,v])=>`+${v} ${SI[s]||s}`).join(' ');
          return `<div class="shop-item-card rarity-${rarity}" style="position:relative">
            ${item_id.startsWith('irp_')?'<span style="position:absolute;top:6px;right:6px;font-family:var(--font-m);font-size:0.38rem;letter-spacing:0.08em;color:#dc143c;background:rgba(220,20,60,0.12);border:1px solid rgba(220,20,60,0.25);border-radius:3px;padding:1px 5px;pointer-events:none;z-index:2;white-space:nowrap">EXCLU IRP</span>':''}
            <div class="shop-item-top">
              <span class="shop-item-icon">${it.emoji||'📦'}</span>
              <div class="shop-item-info">
                <div class="shop-item-name" style="color:${rc}">${e(it.name||item_id)}</div>
                ${effStr?`<div class="shop-item-effects">${effStr}</div>`:''}
                <div class="shop-item-qty">×${si.qty||0} en stock</div>
              </div>
            </div>
            <div class="shop-item-price">${formatShopPrice(si.price||{})}</div>
            <button onclick="removeFromShop('${item_id}')" style="margin-top:8px;width:100%;padding:6px;border-radius:6px;border:1px solid var(--red);background:rgba(255,71,87,0.08);color:var(--red);font-family:var(--font-b);font-size:.65rem;font-weight:600;cursor:pointer;transition:background .2s,border-color .2s">✕ Retirer de la vente</button>
          </div>`;
        }).join('')}
      </div>
    </div></div>` : '<div class="empty" style="margin-bottom:20px">Aucun article en vente</div>'}

    <div class="card"><div class="card-body">
      <div class="sh" style="margin-bottom:14px"><span class="sh-num">—</span><span class="sh-title">Mettre en vente depuis l'inventaire</span><div class="sh-line"></div></div>
      ${sellable.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        ${sellable.map(([item_id, qty])=>{
          const it = ALL_ITEMS_DATA[item_id] || {};
          const rarity = (it.rarity||'common').toLowerCase();
          const rc = RARITY_COLORS[rarity]||'#6b7280';
          return `<div class="shop-item-card rarity-${rarity}" style="position:relative">
            ${item_id.startsWith('irp_')?'<span style="position:absolute;top:6px;right:6px;font-family:var(--font-m);font-size:0.38rem;letter-spacing:0.08em;color:#dc143c;background:rgba(220,20,60,0.12);border:1px solid rgba(220,20,60,0.25);border-radius:3px;padding:1px 5px;pointer-events:none;z-index:2;white-space:nowrap">EXCLU IRP</span>':''}
            <div class="shop-item-top">
              <span class="shop-item-icon">${it.emoji||'📦'}</span>
              <div class="shop-item-info">
                <div class="shop-item-name" style="color:${rc}">${e(it.name||item_id)}</div>
                <div class="shop-item-qty">×${qty} en inventaire</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
              <input type="number" id="sell-qty-${item_id}" min="1" max="${qty}" value="1" style="width:50px;padding:4px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-m);font-size:.55rem;text-align:center">
              <input type="number" id="sell-price-${item_id}" min="1" value="100" placeholder="Prix" style="flex:1;padding:4px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--gold);font-family:var(--font-m);font-size:.55rem;text-align:center">
              <select id="sell-cur-${item_id}" style="padding:4px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-m);font-size:.5rem">
                <option value="bronze_kanite">Bronze</option>
                <option value="silver_kanite">Silver</option>
                <option value="gold_kanite">Gold</option>
                <option value="platinum_kanite">Plat.</option>
              </select>
            </div>
            <button onclick="addToShop('${item_id}',${qty})" style="margin-top:6px;width:100%;padding:6px;border-radius:6px;border:1px solid var(--green);background:rgba(52,211,153,0.08);color:var(--green);font-family:var(--font-b);font-size:.65rem;font-weight:600;cursor:pointer;transition:background .2s,border-color .2s">🏷️ Mettre en vente</button>
          </div>`;
        }).join('')}
      </div>` : '<div class="empty">Aucun item disponible à la vente — équipe tes items ou obtiens-en via le gacha</div>'}
    </div></div>

    ${s.sales_log && s.sales_log.length ? `
    <div class="card" style="margin-top:16px"><div class="card-body">
      <div class="sh" style="margin-bottom:14px"><span class="sh-num">—</span><span class="sh-title">Dernières ventes</span><div class="sh-line"></div></div>
      ${s.sales_log.slice(-5).reverse().map(log=>`
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(77,163,255,0.06);font-family:var(--font-m);font-size:.48rem">
          <span style="color:var(--text2)">${e(log.item_name||log.item_id||log.item||'Item')}</span>
          <span style="color:var(--gold)">${typeof log.price==='object'?formatShopPrice(log.price):e(log.price||'')}</span>
        </div>`).join('')}
    </div></div>` : ''}
  `;
}

// ── Shop management actions ──

async function toggleShopOpen(){
  if(!UID||!CHAR_ID||!MY_SHOP_DATA) return;
  const newState = !MY_SHOP_DATA.open;
  try{
    await db.collection(C.SHOPS).doc(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`).set({open:newState},{merge:true});
    MY_SHOP_DATA.open = newState;
    cacheInvalidate('_monshop');cacheInvalidate('_shops');
    renderMonShop();
    showToast(newState ? '✓ Boutique ouverte !' : '✓ Boutique fermée', 'success');
  }catch(err){
    window._dbg?.error('[SHOP_TOGGLE]',err);
    showToast('❌ Erreur — vérifie les permissions','error');
  }
}

async function addToShop(itemId, maxQty){
  if(!UID||!CHAR_ID||!MY_SHOP_DATA) return;
  const qtyEl = document.getElementById('sell-qty-'+itemId);
  const priceEl = document.getElementById('sell-price-'+itemId);
  const curEl = document.getElementById('sell-cur-'+itemId);
  if(!qtyEl||!priceEl||!curEl) return;

  const qty = Math.max(1, Math.min(maxQty, parseInt(qtyEl.value)||1));
  const price = Math.max(1, parseInt(priceEl.value)||100);
  const currency = curEl.value || 'bronze_kanite';

  const charKey = (window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  const invRef=db.collection(C.INV).doc(charKey);
  const shopRef=db.collection(C.SHOPS).doc(charKey);
  let nextInvItems=null,nextShopItems=null;
  try{
    await db.runTransaction(async(tx)=>{
      const[invSnap,shopSnap]=await Promise.all([tx.get(invRef),tx.get(shopRef)]);
      const invItems={...((invSnap.exists?invSnap.data().items:null)||{})};
      const current=invItems[itemId]||0;
      if(current<qty) throw new Error('Pas assez en stock');
      invItems[itemId]=current-qty;
      if(invItems[itemId]<=0) delete invItems[itemId];
      const shopItems={...((shopSnap.exists?shopSnap.data().items:null)||{})};
      if(shopItems[itemId]){
        shopItems[itemId]={...shopItems[itemId],qty:(shopItems[itemId].qty||0)+qty};
      }else{
        shopItems[itemId]={price:{[currency]:price},qty:qty};
      }
      tx.set(invRef,{items:invItems},{merge:true});
      tx.set(shopRef,{items:shopItems},{merge:true});
      nextInvItems=invItems;nextShopItems=shopItems;
    });
    if(nextInvItems) INV_DATA.items=nextInvItems;
    if(nextShopItems) MY_SHOP_DATA.items=nextShopItems;
    cacheInvalidate('_inventory');cacheInvalidate('_monshop');cacheInvalidate('_shops');
    renderMonShop();
    showToast('✓ Article mis en vente !','success');
  }catch(err){
    window._dbg?.error('[SHOP_ADD]',err);
    const msg=(err&&err.message)?err.message:'Erreur lors de la mise en vente';
    showToast('❌ '+msg,'error');
  }
}

async function removeFromShop(itemId){
  if(!UID||!CHAR_ID||!MY_SHOP_DATA) return;
  const charKey = (window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  const invRef=db.collection(C.INV).doc(charKey);
  const shopRef=db.collection(C.SHOPS).doc(charKey);
  let nextInvItems=null,nextShopItems=null;
  try{
    await db.runTransaction(async(tx)=>{
      const[invSnap,shopSnap]=await Promise.all([tx.get(invRef),tx.get(shopRef)]);
      const shopItems={...((shopSnap.exists?shopSnap.data().items:null)||{})};
      const si=shopItems[itemId];
      if(!si) throw new Error('Article introuvable');
      const qty=si.qty||0;
      delete shopItems[itemId];
      const invItems={...((invSnap.exists?invSnap.data().items:null)||{})};
      if(qty>0&&qty!==-1){
        invItems[itemId]=(invItems[itemId]||0)+qty;
      }
      tx.set(shopRef,{items:shopItems},{merge:true});
      tx.set(invRef,{items:invItems},{merge:true});
      nextShopItems=shopItems;nextInvItems=invItems;
    });
    if(nextShopItems) MY_SHOP_DATA.items=nextShopItems;
    if(nextInvItems) INV_DATA.items=nextInvItems;
    cacheInvalidate('_inventory');cacheInvalidate('_monshop');cacheInvalidate('_shops');
    renderMonShop();
    showToast('✓ Article retiré de la vente','success');
  }catch(err){
    window._dbg?.error('[SHOP_REMOVE]',err);
    const msg=(err&&err.message)?err.message:'Erreur lors du retrait';
    showToast('❌ '+msg,'error');
  }
}

// ══════════════════════════════════════════════
// ALLOCATION DES STATS
// ══════════════════════════════════════════════
let _hasTrueSelf_alloc=false; // set by renderFullChar, read by alloc functions
const ALLOC_STATS=[
  {id:'strength',label:'Force',icon:'⚔️'},
  {id:'agility',label:'Agilité',icon:'💨'},
  {id:'speed',label:'Vitesse',icon:'🏃'},
  {id:'intelligence',label:'Intelligence',icon:'🧠'},
  {id:'mana',label:'Mana',icon:'✨'},
  {id:'resistance',label:'Résistance',icon:'🛡️'},
  {id:'charisma',label:'Charisme',icon:'👑'},
];
let ALLOC_PENDING={strength:0,agility:0,speed:0,intelligence:0,mana:0,resistance:0,charisma:0};
let ALLOC_MULT=1;
let ALLOC_AVAIL=0;

function initAlloc(){
  if(!CHAR)return;
  ALLOC_AVAIL=parseInt(CHAR.available_stat_points||CHAR.unallocated_stat_points||0);
  ALLOC_PENDING={strength:0,agility:0,speed:0,intelligence:0,mana:0,resistance:0,charisma:0};
  renderAllocStats();
}

function renderAllocStats(){
  const stats=CHAR?CHAR.stats||{}:{};
  const aura=CHAR&&CHAR.aura_enabled;
  const allocated=Object.values(ALLOC_PENDING).reduce((a,b)=>a+b,0);
  const left=ALLOC_AVAIL-allocated;
  const ptsEl=document.getElementById('alloc-pts-left');
  const confirmEl=document.getElementById('alloc-confirm-btn');
  if(ptsEl)ptsEl.textContent=left;
  if(confirmEl)confirmEl.disabled=allocated===0||left<0;
  const preview=document.getElementById('alloc-preview-card');
  const previewEl=document.getElementById('alloc-preview');
  if(allocated>0&&preview&&previewEl){
    preview.style.display='block';
    previewEl.innerHTML=ALLOC_STATS.filter(s=>ALLOC_PENDING[s.id]>0)
      .map(s=>`<div style="display:flex;justify-content:space-between;padding:4px 0;font-family:var(--font-m);font-size:.5rem"><span style="color:var(--text2)">${s.icon} ${s.label}</span><span style="color:var(--green)">+${ALLOC_PENDING[s.id]}</span></div>`).join('');
  } else if(preview){preview.style.display='none';}
  const auraStats=aura?[...ALLOC_STATS,{id:'aura',label:'Aura',icon:'🌟'}]:ALLOC_STATS;
  const listEl=document.getElementById('alloc-stats-list');
  if(!listEl)return;
  listEl.innerHTML=auraStats.map(s=>{
    const cur=parseInt(stats[s.id]||0);
    const pend=ALLOC_PENDING[s.id]||0;
    const canAdd=left>=ALLOC_MULT;
    const canSub=pend>0;
    // ── True Self: INT row locked ──
    if(s.id==='intelligence' && _hasTrueSelf_alloc){
      return`<div class="alloc-stat-row" style="opacity:.5">
        <span class="alloc-stat-icon">🔒</span>
        <span class="alloc-stat-name" style="color:var(--text3)">${s.label} <span style="font-size:.4rem;color:#a78bfa;letter-spacing:.08em">TRUE SELF</span></span>
        <span class="alloc-stat-val">10</span>
        <span class="alloc-stat-pending"></span>
        <div class="alloc-btns">
          <button class="alloc-btn minus" disabled>−</button>
          <button class="alloc-btn" disabled>+</button>
        </div>
      </div>`;
    }
    return`<div class="alloc-stat-row">
      <span class="alloc-stat-icon">${s.icon}</span>
      <span class="alloc-stat-name">${s.label}</span>
      <span class="alloc-stat-val">${cur}</span>
      <span class="alloc-stat-pending" style="color:${pend>0?'var(--green)':'var(--text3)'}">${pend>0?'+'+pend:''}</span>
      <div class="alloc-btns">
        <button class="alloc-btn minus" onclick="addAllocStat('${s.id}',-1)" ${canSub?'':'disabled'}>−</button>
        <button class="alloc-btn" onclick="addAllocStat('${s.id}',1)" ${canAdd?'':'disabled'}>+</button>
      </div>
    </div>`;
  }).join('');
}

function setAllocMult(m){
  ALLOC_MULT=m;
  document.querySelectorAll('.alloc-mult-btn').forEach(b=>b.classList.toggle('active',b.id==='amult-'+m));
  renderAllocStats();
}

function addAllocStat(stat,dir){
  // ── True Self: block INT allocation ──
  if(stat==='intelligence' && _hasTrueSelf_alloc){return;}
  const allocated=Object.values(ALLOC_PENDING).reduce((a,b)=>a+b,0);
  const left=ALLOC_AVAIL-allocated;
  if(dir>0){const add=Math.min(ALLOC_MULT,left);if(add<=0)return;ALLOC_PENDING[stat]=(ALLOC_PENDING[stat]||0)+add;}
  else{const sub=Math.min(ALLOC_MULT,ALLOC_PENDING[stat]||0);if(sub<=0)return;ALLOC_PENDING[stat]-=sub;}
  renderAllocStats();
}

function resetAlloc(){Object.keys(ALLOC_PENDING).forEach(k=>ALLOC_PENDING[k]=0);renderAllocStats();}

async function confirmAlloc(){
  if(!CHAR_ID||!UID)return;
  const allocated=Object.values(ALLOC_PENDING).reduce((a,b)=>a+b,0);
  if(allocated===0)return;
  const btn=document.getElementById('alloc-confirm-btn');
  btn.disabled=true;btn.textContent='Sauvegarde...';
  try{
    // Copie profonde des stats pour éviter les mutations
    const stats=JSON.parse(JSON.stringify(CHAR.stats||{}));
    Object.entries(ALLOC_PENDING).forEach(([stat,val])=>{
      // ── True Self: never write INT ──
      if(stat==='intelligence' && _hasTrueSelf_alloc) return;
      if(val>0) stats[stat]=(parseInt(stats[stat]||0)+val);
    });
    const newAvail=Math.max(0,ALLOC_AVAIL-allocated);
    // Écriture Firestore
    await db.collection(C.CHARS).doc(CHAR_ID).set(
      {stats, available_stat_points:newAvail, unallocated_stat_points:newAvail},
      {merge:true}
    );
    // Mise à jour locale
    CHAR.stats=stats;
    CHAR.available_stat_points=newAvail;
    CHAR.unallocated_stat_points=newAvail;
    ALLOC_AVAIL=newAvail;
    Object.keys(ALLOC_PENDING).forEach(k=>{ALLOC_PENDING[k]=0;});
    // UI feedback
    btn.textContent='✓ Appliqué';
    btn.style.background='var(--green)';
    btn.style.color='#020713';
    // Re-render sans toucher au bouton (le setTimeout s'en charge)
    renderAllocStats();
    renderFullChar();
    renderProgression();
    showEquipToast('✓ Stats allouées avec succès !');
    cacheInvalidate('_character');
    setTimeout(()=>{
      const b=document.getElementById('alloc-confirm-btn');
      if(b){b.style.background='';b.style.color='';b.textContent="Confirmer l'allocation";b.disabled=true;}
    },2500);
  }catch(err){
    window._dbg?.error('[ALLOC]',err);
    const b=document.getElementById('alloc-confirm-btn');
    if(b){b.disabled=false;b.textContent="Confirmer l'allocation";}
    showEquipToast('❌ Erreur Firestore — vérifie les rules',true);
  }
}

// ══════════════════════════════════════════════
// SHOPS DES JOUEURS
// ══════════════════════════════════════════════
let ALL_SHOPS_DATA=[];
let ACTIVE_SHOP_KEY=null;

async function loadShops(){
  const listEl=document.getElementById('shops-list');
  if(!listEl)return;
  try{
    const docs=await cachedCollection(C.SHOPS,'_shops',60);
    ALL_SHOPS_DATA=docs.filter(d=>d.open&&Object.keys(d.items||{}).length>0).map(d=>({key:d._key,...d}));
    renderShopsList();
  }catch(err){window._dbg?.error('[SHOPS]',err);listEl.innerHTML='<div class="empty">Erreur de chargement</div>';}
}

function renderShopsList(){
  const listEl=document.getElementById('shops-list');if(!listEl)return;
  if(!ALL_SHOPS_DATA.length){listEl.innerHTML='<div class="empty">Aucun shop ouvert</div>';return;}
  listEl.innerHTML=ALL_SHOPS_DATA.map(s=>`
    <div class="shop-list-item${ACTIVE_SHOP_KEY===s.key?' active':''}" onclick="selectShop('${s.key}')">
      <div class="shop-list-dot open"></div>
      <div><div class="shop-list-name">${e(s.name||s.key)}</div><div class="shop-list-owner">${e(s.tagline||'')}</div></div>
    </div>`).join('');
}

function selectShop(key){
  ACTIVE_SHOP_KEY=key;renderShopsList();
  const shop=ALL_SHOPS_DATA.find(s=>s.key===key);
  if(shop)renderShopDetail(shop);
  else{const det=document.getElementById('shop-detail');if(det)det.innerHTML='<div class="empty">Ce shop est maintenant vide</div>';}
}

function renderShopDetail(shop){
  const det=document.getElementById('shop-detail');if(!det)return;
  const entries=Object.entries(shop.items||{});
  if(!entries.length){det.innerHTML='<div class="empty">Ce shop est vide</div>';return;}
  det.innerHTML=`
    <div class="shop-detail-header">
      <div class="shop-detail-name">${e(shop.name||'Shop')}</div>
      <div class="shop-detail-tagline">${e(shop.tagline||'')}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
      ${entries.map(([item_id,si])=>{
        const it=ALL_ITEMS_DATA[item_id]||{};
        const price=si.price||{};
        const effects=it.stat_effects||it.stats||{};
        const effStr=Object.entries(effects).slice(0,2).map(([s,v])=>`+${v} ${SI[s]||s}`).join(' ');
        return`<div class="shop-item-card" style="position:relative">
          ${item_id.startsWith('irp_')?'<span style="position:absolute;top:6px;right:6px;font-family:var(--font-m);font-size:0.38rem;letter-spacing:0.08em;color:#dc143c;background:rgba(220,20,60,0.12);border:1px solid rgba(220,20,60,0.25);border-radius:3px;padding:1px 5px;pointer-events:none;z-index:2;white-space:nowrap">EXCLU IRP</span>':''}
          <div class="shop-item-top">
            <span class="shop-item-icon">${it.emoji||'📦'}</span>
            <div class="shop-item-info">
              <div class="shop-item-name">${e(it.name||item_id)}</div>
              ${effStr?`<div class="shop-item-effects">${effStr}</div>`:''}
              <div class="shop-item-qty">×${si.qty||0} en stock</div>
            </div>
          </div>
          <div class="shop-item-price">${formatShopPrice(price)}</div>
          <button class="shop-buy-btn" onclick="buyFromPlayerShop('${shop.key}','${item_id}')">Acheter</button>
        </div>`;
      }).join('')}
    </div>`;
}

async function buyFromPlayerShop(shopKey,itemId){
  if(!UID||!CHAR_ID){showEquipToast('❌ Connecte-toi',true);return;}
  const shop=ALL_SHOPS_DATA.find(s=>s.key===shopKey);if(!shop)return;
  const si0=shop.items&&shop.items[itemId];
  if(!si0){showEquipToast('❌ Cet article n\'est plus disponible',true);return;}
  const it=ALL_ITEMS_DATA[itemId]||{};
  const charKey=(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  if(charKey===shopKey){showEquipToast('❌ Tu ne peux pas acheter dans ton propre shop',true);return;}
  const buyerEcoRef=db.collection(C.ECONOMY).doc(charKey);
  const buyerInvRef=db.collection(C.INV).doc(charKey);
  const sellerEcoRef=db.collection(C.ECONOMY).doc(shopKey);
  const shopRef=db.collection(C.SHOPS).doc(shopKey);
  let resultShopItems=null;
  try{
    await db.runTransaction(async(tx)=>{
      const[shopSnap,buyerEcoSnap,buyerInvSnap,sellerEcoSnap]=await Promise.all([
        tx.get(shopRef),tx.get(buyerEcoRef),tx.get(buyerInvRef),tx.get(sellerEcoRef)
      ]);
      if(!shopSnap.exists) throw new Error('Shop introuvable');
      const shopData=shopSnap.data()||{};
      const liveItems=Object.assign({},shopData.items||{});
      const live=liveItems[itemId];
      if(!live) throw new Error('Article épuisé');
      const price=live.price||{};
      const buyerPersonal=Object.assign({},(buyerEcoSnap.exists?(buyerEcoSnap.data().personal||{}):{}));
      const totalW=totalInBronze(buyerPersonal);
      const totalC=priceInBronze(price);
      if(totalW<totalC) throw new Error('Fonds insuffisants');
      const deducted=deductWithAutoConversion(buyerPersonal,price);
      if(!deducted) throw new Error('Conversion impossible');
      const newBuyerPersonal=autoConvertUp(deducted);
      const buyerItems=Object.assign({},(buyerInvSnap.exists?(buyerInvSnap.data().items||{}):{}));
      buyerItems[itemId]=(buyerItems[itemId]||0)+1;
      if(live.qty!==-1&&live.qty!==undefined){
        const nq=live.qty-1;
        if(nq<=0) delete liveItems[itemId];
        else liveItems[itemId]={...live,qty:nq};
      }else{
        delete liveItems[itemId];
      }
      const sellerPersonalRaw=Object.assign({},(sellerEcoSnap.exists?(sellerEcoSnap.data().personal||{}):{}));
      for(const[cur,amt] of Object.entries(price)){sellerPersonalRaw[cur]=(sellerPersonalRaw[cur]||0)+(amt||0);}
      const newSellerPersonal=autoConvertUp(sellerPersonalRaw);
      const saleEntry={item_id:itemId,item_name:it.name||itemId,price,buyer:charKey,at:new Date().toISOString()};
      tx.set(buyerEcoRef,{personal:newBuyerPersonal},{merge:true});
      tx.set(buyerInvRef,{items:buyerItems},{merge:true});
      tx.update(shopRef,{items:liveItems,sales_log:firebase.firestore.FieldValue.arrayUnion(saleEntry)});
      tx.set(sellerEcoRef,{personal:newSellerPersonal},{merge:true});
      resultShopItems=liveItems;
    });
    if(resultShopItems){
      shop.items=resultShopItems;
      if(!Object.keys(resultShopItems).length)ALL_SHOPS_DATA=ALL_SHOPS_DATA.filter(s=>s.key!==shopKey);
    }
    cacheInvalidate('_inventory');cacheInvalidate('_economy');cacheInvalidate('_shops');cacheInvalidate('_monshop');
    renderShopsList();selectShop(shopKey);
    showEquipToast(`✓ ${it.name||itemId} acheté !`);
  }catch(err){
    window._dbg?.error('[BUY_SHOP]',err);
    const msg=(err&&err.message)?err.message:'Erreur achat';
    showEquipToast('❌ '+msg,true);
  }
}

function formatShopPrice(price){
  if(!price||!Object.keys(price).length)return'Gratuit';
  return Object.entries(price).map(([c,a])=>`${a} ${formatCurLabel(c)}`).join(' + ');
}
function formatCurLabel(c){const s=c.replace('_kanite','');return s.charAt(0).toUpperCase()+s.slice(1)+' K';}

// ══════════════════════════════════════════════
// UNIVERSAL SHOP
// ══════════════════════════════════════════════
let USHOP_CAT='all';
let USHOP_ITEMS={};

async function loadUshop(){
  /* Skip reload unless IRP mode needs IRP items that weren't loaded yet */
  const _hasIRPItems=Object.keys(USHOP_ITEMS).some(id=>USHOP_ITEMS[id]._irpExclusive);
  if(Object.keys(USHOP_ITEMS).length && (!window._irpMode || _hasIRPItems))return;
  const gridEl=document.getElementById('ushop-grid');if(!gridEl)return;
  try{
    const d=await cachedGet(C.CFG,'items','config/items',600);
    if(!d){gridEl.innerHTML='<div class="empty">Shop indisponible</div>';return;}
    USHOP_ITEMS={};
    for(const sec of['items','equipment','food_items','consumable_items']){
      if(d[sec]&&typeof d[sec]==='object'){
        Object.entries(d[sec]).forEach(([id,it])=>{if(it&&it.price)USHOP_ITEMS[id]={...it,_section:sec};});
      }
    }
    /* ── Fix: reclasser les items selon leur type/slot réel ── */
    Object.entries(USHOP_ITEMS).forEach(([id,it])=>{
      const t=(it.type||'').toLowerCase();
      const s=(it.slot||'').toLowerCase();
      if(t==='equipment'||t==='weapon'||s) it._section='equipment';
      else if(t==='consumable'||t==='usable') it._section='consumable_items';
      else if(t==='food') it._section='food_items';
    });
    /* ── IRP Mode: load IRP items with their real prices from Firestore ── */
    if(window._irpMode){
      try{
        /* Load from Firestore config/irp_items */
        const irpCfg=await db.collection('config').doc('irp_items').get();
        if(irpCfg.exists){
          const irpData=irpCfg.data()||{};
          const irpItems=irpData.items||{};
          Object.entries(irpItems).forEach(([id,it])=>{
            if(!it||typeof it!=='object'||id.startsWith('__'))return;
            if(!it.price)return;
            const section=it.slot?'equipment':(it.type==='consumable'||it.type==='food'?it.type+'_items':'items');
            USHOP_ITEMS[id]={...it,_section:section,_irpExclusive:true};
            if(typeof ALL_ITEMS_DATA!=='undefined') ALL_ITEMS_DATA[id]=it;
          });
        }
      }catch(irpErr){window._dbg?.warn('[USHOP_IRP]',irpErr);}
      /* Mark any existing irp_ prefixed items */
      Object.entries(USHOP_ITEMS).forEach(([id,it])=>{
        if(id.startsWith('irp_')&&!it._irpExclusive) it._irpExclusive=true;
      });
    }
    renderUshop();renderUshopBalance();
    /* Injecter le bouton filtre IRP si en mode IRP */
    if(window._irpMode) _injectIRPFilterButton();
  }catch(err){window._dbg?.error('[USHOP]',err);gridEl.innerHTML='<div class="empty">Erreur chargement</div>';}
}

/* ── IRP Filter toggle state ── */
let _ushopIRPOnly=false;

function _injectIRPFilterButton(){
  const catRow=document.querySelector('#panel-ushop .ushop-cats, .ushop-cat-row');
  if(!catRow) return;
  if(catRow.querySelector('.ushop-irp-filter')) return;
  const btn=document.createElement('button');
  btn.className='ushop-cat ushop-irp-filter';
  btn.id='ucatbtn-irp';
  btn.style.cssText='border:1px solid rgba(220,20,60,0.3);color:#dc143c;background:rgba(220,20,60,0.06);font-family:var(--font-h);font-size:0.5rem;letter-spacing:0.1em;padding:6px 14px;border-radius:6px;cursor:pointer;transition:border-color 0.2s,color 0.2s,background 0.2s;margin-left:6px;font-weight:700;';
  btn.textContent='◆ EXCLU IRP';
  btn.onclick=function(){
    _ushopIRPOnly=!_ushopIRPOnly;
    btn.style.background=_ushopIRPOnly?'rgba(220,20,60,0.2)':'rgba(220,20,60,0.06)';
    btn.style.borderColor=_ushopIRPOnly?'rgba(220,20,60,0.6)':'rgba(220,20,60,0.3)';
    btn.style.boxShadow=_ushopIRPOnly?'0 0 12px rgba(220,20,60,0.2)':'none';
    renderUshop();
  };
  catRow.appendChild(btn);
}

async function renderUshopBalance(){
  if(!UID||!CHAR_ID)return;
  const balEl=document.getElementById('ushop-balance');if(!balEl)return;
  try{
    const snap=await db.collection(C.ECONOMY).doc(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`).get();
    const rawPersonal=snap.exists?(snap.data().personal||{}):{};
    const personal=autoConvertUp(rawPersonal);
    // Show in descending tier order so highest denomination first
    const currencies=['platinum_kanite','gold_kanite','silver_kanite','bronze_kanite'];
    balEl.innerHTML=currencies.filter(c=>(personal[c]||0)>0)
      .map(c=>`<div class="ushop-bal-chip">${personal[c].toLocaleString()} ${formatCurLabel(c)}</div>`).join('')
      ||'<div style="font-family:var(--font-m);font-size:.5rem;color:var(--text3)">Solde vide</div>';
  }catch(err){}
}

function showUshopCat(cat){
  USHOP_CAT=cat;
  document.querySelectorAll('.ushop-cat').forEach(b=>b.classList.toggle('active',b.id==='ucatbtn-'+cat));
  renderUshop();
}

function renderUshop(){
  const gridEl=document.getElementById('ushop-grid');if(!gridEl)return;
  const CAT_SECTIONS={equipment:['equipment'],consumable:['consumable_items'],food:['food_items'],other:['items']};
  const allowed=USHOP_CAT==='all'?null:CAT_SECTIONS[USHOP_CAT]||null;
  let entries=Object.entries(USHOP_ITEMS).filter(([,it])=>!allowed||allowed.includes(it._section));

  /* ── IRP Filter: si activé, ne garder que les items IRP ── */
  if(_ushopIRPOnly){
    entries=entries.filter(([id,it])=>it._irpExclusive||id.startsWith('irp_'));
  }

  // Apply rarity + slot filters
  const fRarity=(document.getElementById('ushop-filter-rarity')||{}).value||'';
  const fSlot=(document.getElementById('ushop-filter-slot')||{}).value||'';
  if(fRarity) entries=entries.filter(([,it])=>(it.rarity||'').toLowerCase()===fRarity);
  if(fSlot) entries=entries.filter(([,it])=>(it.slot||'').toLowerCase()===fSlot);

  // ═══ LEVEL-GATED RARITY FILTER ═══
  const charLvl=CHAR?levelFromXp(CHAR.xp||0).level:1;
  const RARITY_GATE_ORDER=['common','uncommon','rare','epic','legendary','mythic','artifact','mastercraft','unique','signature'];
  let maxRarityIdx=3; // Default: up to epic (index 3)
  if(charLvl>=350) maxRarityIdx=99; // All items
  else if(charLvl>=250) maxRarityIdx=6; // Up to artifact
  else if(charLvl>=100) maxRarityIdx=5; // Up to mythic
  // else < 100: up to epic (idx 3)
  entries=entries.filter(([,it])=>{
    const r=(it.rarity||'common').toLowerCase();
    const idx=RARITY_GATE_ORDER.indexOf(r);
    return idx===-1||idx<=maxRarityIdx;
  });
  // Show gate notice
  let gateNotice='';
  if(charLvl<350){
    let gateMsg='';
    if(charLvl<100) gateMsg='Niv. <strong>'+charLvl+'</strong> — Items jusqu\'à <strong>Epic</strong> disponibles. Niv. 100 pour Legendary+';
    else if(charLvl<250) gateMsg='Niv. <strong>'+charLvl+'</strong> — Items jusqu\'à <strong>Mythic</strong> disponibles. Niv. 250 pour Artifacts';
    else gateMsg='Niv. <strong>'+charLvl+'</strong> — Items jusqu\'à <strong>Artifact</strong> disponibles. Niv. 350 pour tout débloquer';
    gateNotice='<div class="ushop-gate-notice"><span class="gate-icon">🔒</span><span class="gate-text">'+gateMsg+'</span></div>';
  }

  if(!entries.length){gridEl.innerHTML=gateNotice+'<div class="empty">Aucun item</div>';return;}

  const RORD={common:0,uncommon:1,rare:2,epic:3,legendary:4,mythic:5,unique:6,artifact:7,mastercraft:8,signature:9};
  function sortByRarity(a,b){return(RORD[(a[1].rarity||'').toLowerCase()]||0)-(RORD[(b[1].rarity||'').toLowerCase()]||0);}

  function shopCard(id,it){
    const rawPrice=it.price||{};
    let priceStr='—';
    if(rawPrice.amount&&rawPrice.currency){priceStr=`${rawPrice.amount} ${formatCurLabel(rawPrice.currency)}`;}
    else if(typeof rawPrice==='object'){priceStr=Object.entries(rawPrice).filter(([k])=>!['currency','amount','secondary_currency','secondary_amount'].includes(k)).map(([c,a])=>`${a} ${formatCurLabel(c)}`).join(' + ')||'—';}
    const rarity=(it.rarity||'common').toLowerCase();
    const rc=RARITY_COLORS[rarity]||'#6b7280';
    const effects=it.stat_effects||it.stats||{};
    const effStr=Object.entries(effects).slice(0,3).map(([s,v])=>`+${v} ${SI[s]||s}`).join(' ');
    const isIRPExclu=it._irpExclusive||id.startsWith('irp_');
    const irpTag=isIRPExclu?'<span style="position:absolute;top:6px;right:6px;font-family:var(--font-m);font-size:0.38rem;letter-spacing:0.08em;color:#dc143c;background:rgba(220,20,60,0.12);border:1px solid rgba(220,20,60,0.25);border-radius:3px;padding:2px 6px;pointer-events:none;z-index:2;white-space:nowrap;font-weight:600">EXCLU IRP</span>':'';
    return`<div class="ushop-card rarity-${rarity}" style="position:relative">
      ${irpTag}
      <span style="font-size:1.8rem;display:block;margin-bottom:6px">${it.emoji||'📦'}</span>
      <div style="font-family:var(--font-b);font-weight:700;font-size:.82rem;color:${rc};margin-bottom:4px">${e(it.name||id)}</div>
      ${it.slot?`<div style="font-family:var(--font-m);font-size:.42rem;letter-spacing:.08em;color:var(--text3)">${SLOT_LIMITS[(it.slot||'').toLowerCase()]?.label||it.slot}</div>`:''}
      ${effStr?`<div style="font-family:var(--font-m);font-size:.42rem;color:var(--green);margin:4px 0">${effStr}</div>`:''}
      <div style="font-family:var(--font-h);font-weight:700;font-size:.9rem;color:var(--gold);margin:8px 0">${priceStr}</div>
      <button class="shop-buy-btn" onclick="buyFromUshop('${id}')">Acheter</button>
    </div>`;
  }

  // Group by category + slot when viewing 'all' or 'equipment'
  const useGroups=(USHOP_CAT==='all'||USHOP_CAT==='equipment');
  if(!useGroups){
    entries.sort(sortByRarity);
    gridEl.innerHTML=gateNotice+`<div class="ushop-grid-sub">${entries.map(([id,it])=>shopCard(id,it)).join('')}</div>`;
    return;
  }

  const slotOrder=['tete','visage','cou','oreilles','torse','dos','bras','mains','poignets','doigts','jambes','pieds','armes_h','armes_l','special'];
  const groups=[];const used=new Set();
  // Equipment by slot
  for(const s of slotOrder){
    const slotEntries=entries.filter(([id,it])=>!used.has(id)&&it._section==='equipment'&&(it.slot||'').toLowerCase()===s);
    if(slotEntries.length){groups.push({label:(SLOT_LIMITS[s]?.label||s).toUpperCase(),entries:slotEntries});slotEntries.forEach(([id])=>used.add(id));}
  }
  // Equipment without recognized slot
  const eqNoSlot=entries.filter(([id,it])=>!used.has(id)&&it._section==='equipment');
  if(eqNoSlot.length){groups.push({label:'ÉQUIPEMENT DIVERS',entries:eqNoSlot});eqNoSlot.forEach(([id])=>used.add(id));}
  // Consumables
  const cons=entries.filter(([id,it])=>!used.has(id)&&it._section==='consumable_items');
  if(cons.length){groups.push({label:'CONSOMMABLES',entries:cons});cons.forEach(([id])=>used.add(id));}
  // Food
  const food=entries.filter(([id,it])=>!used.has(id)&&it._section==='food_items');
  if(food.length){groups.push({label:'NOURRITURE',entries:food});food.forEach(([id])=>used.add(id));}
  // Other
  const other=entries.filter(([id])=>!used.has(id));
  if(other.length)groups.push({label:'AUTRES',entries:other});

  let html='';
  for(const g of groups){
    g.entries.sort(sortByRarity);
    html+=`<div class="ushop-group-header">${g.label} <span class="ushop-group-count">(${g.entries.length})</span></div>`;
    html+=`<div class="ushop-grid-sub">${g.entries.map(([id,it])=>shopCard(id,it)).join('')}</div>`;
  }
  gridEl.innerHTML=gateNotice+html;
}

// ═══ AUTO-CONVERSION CURRENCY SYSTEM ═══
// Hierarchy: bronze_kanite < silver_kanite < gold_kanite < platinum_kanite
// Chaque palier vaut 100 du précédent.
// Logique factorisée dans js/kanite-wallet.js (window.JKanite) — partagée
// avec casino-core. Aliases locaux conservés pour compat avec le reste du fichier.
const CURRENCY_ORDER = (window.JKanite && window.JKanite.ORDER) || ['bronze_kanite','silver_kanite','gold_kanite','platinum_kanite'];
const CURRENCY_RATE  = (window.JKanite && window.JKanite.RATE)  || 100;

const totalInBronze            = (p)    => window.JKanite.totalInBronze(p);
const priceInBronze            = (p)    => window.JKanite.priceInBronze(p);
const autoConvertUp            = (p)    => window.JKanite.autoConvertUp(p);
const deductWithAutoConversion = (p,pr) => window.JKanite.deductWithAutoConversion(p, pr);

async function buyFromUshop(itemId){
  if(!UID||!CHAR_ID){showEquipToast('❌ Connecte-toi',true);return;}
  const it=USHOP_ITEMS[itemId];if(!it)return;
  const rawPrice=it.price||{};
  let price={};
  if(rawPrice.amount&&rawPrice.currency){price[rawPrice.currency]=rawPrice.amount;}
  else{Object.entries(rawPrice).forEach(([k,v])=>{if(!['currency','amount','secondary_currency','secondary_amount'].includes(k))price[k]=v;});}
  const charKey=(window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  const ecoRef=db.collection(C.ECONOMY).doc(charKey);
  const invRef=db.collection(C.INV).doc(charKey);
  try{
    await db.runTransaction(async(tx)=>{
      const[econSnap,invSnap]=await Promise.all([tx.get(ecoRef),tx.get(invRef)]);
      const personal=Object.assign({},(econSnap.exists?(econSnap.data().personal||{}):{}));
      const totalWallet=totalInBronze(personal);
      const totalCost=priceInBronze(price);
      if(totalWallet<totalCost) throw new Error(`Fonds insuffisants (besoin de ${totalCost.toLocaleString()} Bronze eq.)`);
      const deducted=deductWithAutoConversion(personal,price);
      if(!deducted) throw new Error('Conversion impossible');
      const newPersonal=autoConvertUp(deducted);
      const invItems=Object.assign({},(invSnap.exists?(invSnap.data().items||{}):{}));
      invItems[itemId]=(invItems[itemId]||0)+1;
      tx.set(ecoRef,{personal:newPersonal},{merge:true});
      tx.set(invRef,{items:invItems},{merge:true});
    });
    cacheInvalidate('_inventory');cacheInvalidate('_economy');
    renderUshopBalance();showEquipToast(`✓ ${it.name||itemId} acheté !`);
  }catch(err){
    window._dbg?.error('[USHOP_BUY]',err);
    const msg=(err&&err.message)?err.message:'Erreur achat';
    showEquipToast('❌ '+msg,true);
  }
}



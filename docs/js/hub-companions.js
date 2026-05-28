/* ══════════════════════════════════════════════════════════════════════
   hub-companions.js — Actions compagnons côté hub
   - Activer un compagnon (changer active_companion)
   - Toggle synchronisation (avec cap axiome)
   - Nourrir (modal — sélectionne un item food de l'inventaire)
   Lit/écrit COMP_USER et companions_user/{UID_CHARID}.
   Réutilise _feedActiveCompanionWithFood depuis hub-inventory.js.
   ══════════════════════════════════════════════════════════════════════ */

/* Définit l'active_companion à `compId`. Si déjà actif → no-op. */
async function setActiveCompanion(compId){
  if(!UID||!CHAR_ID||!COMP_USER) return;
  if(!(COMP_USER.owned_companions||{})[compId]){ showEquipToast('❌ Compagnon non possédé', true); return; }
  if(COMP_USER.active_companion===compId) return;
  const key = (window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  try{
    await db.collection(C.COMP).doc(key).set({ active_companion: compId }, { merge: true });
    COMP_USER.active_companion = compId;
    showEquipToast(`✓ Compagnon actif : ${(COMP_CFG?.companions?.[compId]?.name)||compId}`);
    cacheInvalidate('_companions');
    if(typeof loadCompanions==='function') loadCompanions();
  }catch(err){
    window._dbg?.error('[COMP_ACTIVATE]',err);
    showEquipToast('❌ Erreur changement actif', true);
  }
}

/* Toggle synchronized. Applique le cap (axiome Linked Path / Amitié Plurielle /
   Meute Grandissante / 1 par défaut). */
async function toggleCompanionSync(compId){
  if(!UID||!CHAR_ID||!COMP_USER) return;
  const owned = COMP_USER.owned_companions||{};
  const cd = owned[compId];
  if(!cd){ showEquipToast('❌ Compagnon non possédé', true); return; }
  const wasSync = !!cd.synchronized;

  /* Si on essaie de synchroniser → vérifier le cap */
  if(!wasSync){
    let maxSync = 1;
    try{
      const ax = window.AxiomeSkills;
      if(ax && ax.getCompanionsMaxSync) maxSync = ax.getCompanionsMaxSync(CHAR||{}) || 1;
    }catch(_){}
    const currentSyncCount = Object.entries(owned)
      .filter(function(kv){ return kv[0]!==compId && kv[1] && kv[1].synchronized; })
      .length;
    if(currentSyncCount >= maxSync){
      showEquipToast(`❌ Limite sync atteinte (${currentSyncCount}/${maxSync===Infinity?'∞':maxSync})`, true);
      return;
    }
  }

  const newOwned = Object.assign({}, owned);
  newOwned[compId] = Object.assign({}, cd, { synchronized: !wasSync });
  const key = (window._getInventoryKey ? window._getInventoryKey() : `${UID}_${CHAR_ID}`);
  try{
    await db.collection(C.COMP).doc(key).set({ owned_companions: newOwned }, { merge: true });
    COMP_USER.owned_companions = newOwned;
    showEquipToast(wasSync ? '✓ Désynchronisé' : '✓ Synchronisé');
    cacheInvalidate('_companions');
    if(typeof loadCompanions==='function') loadCompanions();
  }catch(err){
    window._dbg?.error('[COMP_SYNC]',err);
    showEquipToast('❌ Erreur sync', true);
  }
}

/* ── Modal Nourrir ─────────────────────────────────────────────────────
   Avant ouverture : si `targetCompId` est passé et différent de l'actif,
   on lui propose de l'activer (sinon le food irait au mauvais compagnon).
   La modal liste tous les items type=food possédés en inventaire.
   Click sur un item → consomme + ajoute companion_xp au compagnon actif. */
function openFeedModal(targetCompId){
  if(!INV_DATA||!COMP_USER){ showEquipToast('❌ Charger inventaire+compagnons d\'abord',true); return; }
  // Si on a un target différent de l'actif → demande confirm puis active
  if(targetCompId && targetCompId !== COMP_USER.active_companion){
    const nm = (COMP_CFG?.companions?.[targetCompId]?.name) || targetCompId;
    if(!window.confirm(`Activer "${nm}" pour le nourrir ?`)) return;
    setActiveCompanion(targetCompId).then(()=>openFeedModal());
    return;
  }

  /* Construit/réutilise l'overlay */
  let ov = document.getElementById('feed-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'feed-overlay';
    ov.className = 'feed-overlay';
    ov.addEventListener('click', function(ev){ if(ev.target===ov) closeFeedModal(); });
    document.body.appendChild(ov);
  }

  const items = INV_DATA.items||{};
  const acId = COMP_USER.active_companion;
  const acName = acId ? ((COMP_CFG?.companions?.[acId]?.name) || acId) : '—';
  const foods = [];
  for(const id in items){
    const d = ALL_ITEMS_DATA[id]; if(!d) continue;
    if(String(d.type||'').toLowerCase() !== 'food') continue;
    const xp = parseInt(d.companion_xp)||0;
    if(xp<=0) continue; /* food sans XP → ignore */
    foods.push({ id, data: d, qty: items[id]||0, xp });
  }
  foods.sort(function(a,b){ return b.xp - a.xp; });

  let body;
  if(!acId){
    body = '<div class="feed-empty">Aucun compagnon actif. Active un compagnon depuis la liste, puis reviens nourrir.</div>';
  } else if(!foods.length){
    body = '<div class="feed-empty">Aucun item type <i>food</i> dans ton inventaire.<br><br>Procure-toi en via le marché ou tes drops.</div>';
  } else {
    body = '<div class="feed-grid">' + foods.map(function(f){
      const safeId = String(f.id).replace(/'/g, "\\'");
      const ic = (typeof getItemIcon==='function') ? getItemIcon(f.data, 34) : (f.data.image ? `<img src="${e(f.data.image)}" alt="">` : (f.data.emoji||'🍖'));
      return `<div class="feed-item" onclick="feedActiveCompanion('${safeId}')" title="Nourrir ${e(acName)} avec ${e(f.data.name||f.id)}">
        <span class="feed-item-icon">${ic}</span>
        <span class="feed-item-name">${e(f.data.name||f.id)}</span>
        <span class="feed-item-meta">×${f.qty}</span>
        <span class="feed-item-xp">+${f.xp} XP</span>
      </div>`;
    }).join('') + '</div>';
  }

  ov.innerHTML = `<div class="feed-modal">
    <div class="feed-modal-hdr">
      <div>
        <div class="feed-modal-title">🍖 Nourrir le compagnon</div>
        <div class="feed-modal-sub">Compagnon actif : <span style="color:var(--green)">${e(acName)}</span></div>
      </div>
      <button class="feed-modal-close" onclick="closeFeedModal()">✕</button>
    </div>
    <div class="feed-modal-body">${body}</div>
  </div>`;
  ov.classList.add('open');
}

function closeFeedModal(){
  const ov = document.getElementById('feed-overlay');
  if(ov) ov.classList.remove('open');
}

/* ── Step "Combien d'items?" ───────────────────────────────────────────
   Click sur un food dans la grille → on remplace le contenu de la modal
   par un picker de quantité. Évite de spammer le bouton item par item
   quand on en a une centaine. */
let _pendingFeedFoodId = null;

/* Appelé depuis la grille de la modal Nourrir → ouvre le picker quantité. */
function feedActiveCompanion(foodId){
  const data = ALL_ITEMS_DATA[foodId];
  if(!data){ showEquipToast('❌ Item introuvable',true); return; }
  _pendingFeedFoodId = foodId;
  _renderFeedQtyPicker();
}

function _renderFeedQtyPicker(){
  const ov = document.getElementById('feed-overlay');
  if(!ov || !_pendingFeedFoodId) return;
  const foodId = _pendingFeedFoodId;
  const data = ALL_ITEMS_DATA[foodId] || {};
  const stock = (INV_DATA.items||{})[foodId] || 0;
  const xpPer = parseInt(data.companion_xp)||0;
  const name = data.name || foodId.replace(/_/g,' ');
  const acId = COMP_USER && COMP_USER.active_companion;
  const acName = acId ? ((COMP_CFG?.companions?.[acId]?.name) || acId) : '—';
  const ic = (typeof getItemIcon==='function')
    ? getItemIcon(data, 46)
    : (data.image ? `<img src="${e(data.image)}" alt="" style="width:46px;height:46px;object-fit:contain">` : (data.emoji||'🍖'));

  /* Valeur initiale 1, mais on rétablit la dernière saisie si présente */
  const initial = Math.min(stock, Math.max(1, parseInt(_pendingFeedFoodIdLastQty||1)));

  ov.querySelector('.feed-modal-body').innerHTML = `
    <div class="feed-qty-card">
      <div class="feed-qty-back" onclick="cancelFeedQty()">‹ Retour à la liste</div>
      <div class="feed-qty-head">
        <span class="feed-qty-ico">${ic}</span>
        <div>
          <div class="feed-qty-name">${e(name)}</div>
          <div class="feed-qty-sub">Stock : <b>${stock}</b> · +${xpPer.toLocaleString()} XP / item</div>
        </div>
      </div>
      <div class="feed-qty-target">Recevra l'XP : <span style="color:var(--green)">${e(acName)}</span></div>
      <div class="feed-qty-ctrl">
        <button class="feed-qty-step" onclick="_feedQtyDelta(-10)" title="−10">−10</button>
        <button class="feed-qty-step" onclick="_feedQtyDelta(-1)" title="−1">−1</button>
        <input id="feed-qty-input" type="number" min="1" max="${stock}" value="${initial}" oninput="_feedQtyClamp()">
        <button class="feed-qty-step" onclick="_feedQtyDelta(1)" title="+1">+1</button>
        <button class="feed-qty-step" onclick="_feedQtyDelta(10)" title="+10">+10</button>
        <button class="feed-qty-step feed-qty-max" onclick="_feedQtySetMax()" title="Stock max">MAX</button>
      </div>
      <div class="feed-qty-total" id="feed-qty-total">Total : <b>+${(xpPer*initial).toLocaleString()} XP</b></div>
      <div class="feed-qty-actions">
        <button class="feed-qty-cancel" onclick="cancelFeedQty()">Annuler</button>
        <button class="feed-qty-confirm" id="feed-qty-confirm-btn" onclick="confirmFeedQty()">🍖 Nourrir ×<span id="feed-qty-confirm-n">${initial}</span></button>
      </div>
    </div>
  `;
  /* focus + sélection pour faciliter la saisie clavier */
  const inp = document.getElementById('feed-qty-input');
  if(inp){ inp.focus(); inp.select(); inp.addEventListener('keydown', function(ev){
    if(ev.key==='Enter'){ ev.preventDefault(); confirmFeedQty(); }
    if(ev.key==='Escape'){ ev.preventDefault(); cancelFeedQty(); }
  }); }
}

let _pendingFeedFoodIdLastQty = 1;

function _feedQtyClamp(){
  const inp = document.getElementById('feed-qty-input');
  if(!inp) return;
  const max = parseInt(inp.max)||1;
  let v = parseInt(inp.value)||1;
  if(v<1) v=1;
  if(v>max) v=max;
  inp.value = v;
  _pendingFeedFoodIdLastQty = v;
  _refreshFeedQtyTotal(v);
}

function _feedQtyDelta(d){
  const inp = document.getElementById('feed-qty-input');
  if(!inp) return;
  const max = parseInt(inp.max)||1;
  let v = (parseInt(inp.value)||1) + d;
  if(v<1) v=1;
  if(v>max) v=max;
  inp.value = v;
  _pendingFeedFoodIdLastQty = v;
  _refreshFeedQtyTotal(v);
}

function _feedQtySetMax(){
  const inp = document.getElementById('feed-qty-input');
  if(!inp) return;
  const max = parseInt(inp.max)||1;
  inp.value = max;
  _pendingFeedFoodIdLastQty = max;
  _refreshFeedQtyTotal(max);
}

function _refreshFeedQtyTotal(v){
  const data = ALL_ITEMS_DATA[_pendingFeedFoodId] || {};
  const xpPer = parseInt(data.companion_xp)||0;
  const total = xpPer * v;
  const totEl = document.getElementById('feed-qty-total');
  if(totEl) totEl.innerHTML = `Total : <b>+${total.toLocaleString()} XP</b>`;
  const nEl = document.getElementById('feed-qty-confirm-n');
  if(nEl) nEl.textContent = v;
}

function cancelFeedQty(){
  _pendingFeedFoodId = null;
  _pendingFeedFoodIdLastQty = 1;
  openFeedModal(); /* revient à la grille des items */
}

async function confirmFeedQty(){
  if(!_pendingFeedFoodId) return;
  const inp = document.getElementById('feed-qty-input');
  const qty = inp ? (parseInt(inp.value)||1) : 1;
  const btn = document.getElementById('feed-qty-confirm-btn');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ ...'; }
  const data = ALL_ITEMS_DATA[_pendingFeedFoodId];
  const name = data?.name || _pendingFeedFoodId.replace(/_/g,' ');
  const foodId = _pendingFeedFoodId;
  const ok = await window._feedActiveCompanionWithFood(foodId, data, name, qty);
  if(ok){
    _pendingFeedFoodId = null;
    _pendingFeedFoodIdLastQty = 1;
    /* Refresh : si encore des foods en stock → grille, sinon ferme */
    const remaining = Object.keys(INV_DATA.items||{}).some(function(id){
      const d = ALL_ITEMS_DATA[id]; if(!d) return false;
      return String(d.type||'').toLowerCase()==='food' && (INV_DATA.items[id]||0)>0 && (parseInt(d.companion_xp)||0)>0;
    });
    if(!remaining) closeFeedModal();
    else openFeedModal();
  } else {
    if(btn){ btn.disabled = false; btn.innerHTML = `🍖 Nourrir ×<span id="feed-qty-confirm-n">${qty}</span>`; }
  }
}

window.setActiveCompanion = setActiveCompanion;
window.toggleCompanionSync = toggleCompanionSync;
window.openFeedModal = openFeedModal;
window.closeFeedModal = closeFeedModal;
window.feedActiveCompanion = feedActiveCompanion;
window._feedQtyDelta = _feedQtyDelta;
window._feedQtyClamp = _feedQtyClamp;
window._feedQtySetMax = _feedQtySetMax;
window.cancelFeedQty = cancelFeedQty;
window.confirmFeedQty = confirmFeedQty;
